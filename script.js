/* script.js — versión completa: COCO-SSD + heurística de derrames + overlay */
let model = null;
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photoPreview');
const heatOverlay = document.getElementById('heatOverlay');
const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const tgBtn = document.getElementById('tgBtn');
const detectionsDiv = document.getElementById('detections');
const areaInput = document.getElementById('areaInput');
const resultBox = document.getElementById('resultBox');
const statusDiv = document.getElementById('status');

let stream = null;
let lastImageDataUrl = null;

/* ----------------- Cargar modelo COCO-SSD ----------------- */
async function loadModel() {
  statusDiv.innerText = 'Cargando modelo de detección (TensorFlow COCO-SSD)...';
  model = await cocoSsd.load();
  statusDiv.innerText = 'Modelo listo ✅';
}
loadModel();

/* ----------------- Cámara ----------------- */
startBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    captureBtn.disabled = false;
    startBtn.disabled = true;
  } catch (err) {
    alert('No se pudo acceder a la cámara. Permisos o dispositivo no disponible.');
    console.error(err);
  }
};

/* ----------------- Capturar y analizar ----------------- */
captureBtn.onclick = () => {
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  lastImageDataUrl = dataUrl;
  photoPreview.src = dataUrl;

  // ajustar overlay al tamaño de la imagen visualizada (espera a que la img cargue)
  photoPreview.onload = () => {
    heatOverlay.width = photoPreview.naturalWidth;
    heatOverlay.height = photoPreview.naturalHeight;
    heatOverlay.style.width = photoPreview.width + 'px';
    heatOverlay.style.height = photoPreview.height + 'px';
    heatOverlay.style.left = photoPreview.offsetLeft + 'px';
    heatOverlay.style.top = photoPreview.offsetTop + 'px';
  };

  downloadBtn.disabled = false;
  copyBtn.disabled = false;
  tgBtn.disabled = false;
  resultBox.innerText = 'Foto capturada. Analizando...';
  analyzeImageDataUrl(dataUrl);
};

/* ----------------- Analizar imagen ----------------- */
async function analyzeImageDataUrl(dataUrl) {
  if (!model) { resultBox.innerText = 'Modelo no cargado aún. Espera.'; return; }
  const img = new Image();
  img.src = dataUrl;
  img.onload = async () => {
    detectionsDiv.innerText = 'Ejecutando detección de objetos...';
    // correr COCO-SSD y heurística (paralelo)
    const [predictions, spill] = await Promise.all([
      model.detect(img, 20),
      detectSpillHeuristic(img, { downscale: 0.25 })
    ]);

    renderDetections(predictions);
    // dibujar heatmap escalado al tamaño real de preview
    drawHeatmapOverlay(spill.heatmapCanvas, img.width, img.height, photoPreview);

    // inferir 5S a partir de detecciones + derrame
    const inference = infer5SFromDetections(predictions, spill);
    showResult(inference, spill);
  };
}

/* ----------------- Render detections ----------------- */
function renderDetections(preds) {
  if (!preds || preds.length === 0) {
    detectionsDiv.innerText = 'No se detectaron objetos relevantes.';
    return;
  }
  let html = '<strong>Objetos detectados:</strong><ul>';
  preds.forEach(p => {
    html += `<li>${p.class} — ${(p.score*100).toFixed(0)}%</li>`;
  });
  html += '</ul>';
  detectionsDiv.innerHTML = html;
}

/* ----------------- Heurística / Inferencia 5S combinada ----------------- */
function infer5SFromDetections(predictions, spill) {
  // similar heurística anterior pero integrando derrame
  const clutterSet = new Set(['bottle','cup','bowl','book','cell phone','remote','laptop','handbag','backpack','chair','box','suitcase','tv','microwave','vase','frisbee']);
  let clutterCount = 0;
  let toolLikeCount = 0;
  let personCount = 0;

  (predictions || []).forEach(p => {
    const cls = p.class.toLowerCase();
    if (clutterSet.has(cls)) clutterCount++;
    if (['box','suitcase','backpack','handbag','book','laptop','microwave'].includes(cls)) toolLikeCount++;
    if (cls === 'person') personCount++;
  });

  // incorporar derrame: si spill.spillScore alto reduce Seiso y Seiri
  const spillScore = spill.spillScore || 0; // 0..100

  let Seiri = 0;
  if (clutterCount <= 1 && spillScore < 25) Seiri = 100;
  else if (clutterCount <= 2 && spillScore < 35) Seiri = 75;
  else if (clutterCount <= 4 && spillScore < 50) Seiri = 50;
  else Seiri = 20;

  let Seiton = 0;
  if (toolLikeCount === 0 && spillScore < 30) Seiton = 100;
  else if (toolLikeCount === 1 && spillScore < 40) Seiton = 75;
  else if (toolLikeCount <= 3) Seiton = 50;
  else Seiton = 20;

  let Seiso = 0;
  if (spillScore < 10 && clutterCount === 0) Seiso = 100;
  else if (spillScore < 25 && clutterCount <= 1) Seiso = 80;
  else if (spillScore < 50 && clutterCount <= 3) Seiso = 50;
  else Seiso = 20;

  let Seiketsu = 50; // no detectable por COCO -> conservador
  let Shitsuke = 50;
  if (personCount > 0 && clutterCount <= 1 && spillScore < 30) Shitsuke = Math.min(90, Shitsuke + 20);

  return {
    Seiri, Seiton, Seiso, Seiketsu, Shitsuke,
    clutterCount, toolLikeCount, personCount, spillScore
  };
}

/* ----------------- Mostrar resultado ----------------- */
function showResult(inf, spill) {
  const values = [inf.Seiri, inf.Seiton, inf.Seiso, inf.Seiketsu, inf.Shitsuke];
  const sum = values.reduce((a,b) => a+b, 0);
  const pct = Math.round(sum / values.length);
  const verdict = pct >= 75 ? 'ACEPTABLE' : 'NO ACEPTABLE';

  const areaText = areaInput.value || 'No especificada';
  let html = `Área: ${escapeHtml(areaText)}\nPuntaje total: ${pct}% — ${verdict}\n\nDesglose 5S (0-100):\n` +
    `Seiri: ${inf.Seiri}\nSeiton: ${inf.Seiton}\nSeiso: ${inf.Seiso}\nSeiketsu: ${inf.Seiketsu}\nShitsuke: ${inf.Shitsuke}\n\n` +
    `Heurística: objetos detectados=${inf.clutterCount}, herramientas visibles=${inf.toolLikeCount}, personas=${inf.personCount}\n` +
    `Derrame estimado: ${inf.spillScore}%  (área sucia estimada: ${(spill.maskPercent*100).toFixed(2)}%)\n\n` +
    `Nota: análisis automático (COCO-SSD + heurística). Validar con inspección humana.`;

  resultBox.innerText = html;
}

/* ----------------- Dibujar heatmap overlay escalado ----------------- */
function drawHeatmapOverlay(heatCanvasSmall, imgW, imgH, imgElement) {
  if (!heatCanvasSmall) {
    heatOverlay.getContext('2d').clearRect(0,0,heatOverlay.width,heatOverlay.height);
    return;
  }
  // escalar heatCanvasSmall (small) a tamaño de preview natural y dibujar
  const hctx = heatOverlay.getContext('2d');
  hctx.clearRect(0,0,heatOverlay.width,heatOverlay.height);
  // usar drawImage para escalar
  hctx.drawImage(heatCanvasSmall, 0, 0, heatOverlay.width, heatOverlay.height);
}

/* ----------------- Descargar foto ----------------- */
downloadBtn.onclick = () => {
  if (!lastImageDataUrl) return alert('No hay foto para descargar.');
  const a = document.createElement('a');
  a.href = lastImageDataUrl;
  a.download = `5S_${(areaInput.value||'area')}_${Date.now()}.jpg`;
  a.click();
};

/* ----------------- Copiar informe ----------------- */
copyBtn.onclick = () => {
  if (!lastImageDataUrl) return alert('No hay informe para copiar.');
  const txt = buildReportText();
  navigator.clipboard.writeText(txt).then(() => {
    alert('Informe copiado al portapapeles.');
  });
};

/* ----------------- Compartir en Telegram (texto) ----------------- */
tgBtn.onclick = () => {
  if (!lastImageDataUrl) return alert('No hay foto para compartir.');
  const txt = encodeURIComponent(buildReportText());
  const url = `https://t.me/share/url?url=&text=${txt}`;
  window.open(url,'_blank');
};

function buildReportText() {
  return resultBox.innerText + '\n\nFoto: guarda la imagen y adjúntala si la envías.';
}

/* ----------------- util ----------------- */
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

/* ----------------- Heurística: detectar derrames (js) ----------------- */
/* Devuelve {spillScore:0..100, heatmapCanvas:HTMLCanvasElement, maskPercent} */
async function detectSpillHeuristic(img, options = {}) {
  const cfg = Object.assign({
    downscale: 0.25,
    brightThreshold: 220,
    darkThreshold: 60,
    saturationThreshold: 20,
    windowSize: 6,
    maskPixelThreshold: 0.08
  }, options);

  const c = document.createElement('canvas');
  const w = Math.max(64, Math.floor(img.width * cfg.downscale));
  const h = Math.max(48, Math.floor(img.height * cfg.downscale));
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0,0,w,h).data;

  function rgb2hsv(r,g,b){
    r/=255; g/=255; b/=255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    let h=0,s=0,v=mx;
    const d=mx-mn;
    s = mx===0 ? 0 : d/mx;
    if(d!==0){
      if(mx===r) h = (g-b)/d + (g<b?6:0);
      else if(mx===g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h /= 6;
    }
    return [h*360, s*100, v*255];
  }

  const gray = new Uint8ClampedArray(w*h);
  for(let i=0;i<w*h;i++){
    const r = data[4*i], g=data[4*i+1], b=data[4*i+2];
    gray[i] = Math.round(0.299*r + 0.587*g + 0.114*b);
  }

  function localVarianceAt(x,y,ws){
    let sum=0, sum2=0, n=0;
    const ymin = Math.max(0, y-ws), ymax = Math.min(h-1, y+ws);
    const xmin = Math.max(0, x-ws), xmax = Math.min(w-1, x+ws);
    for(let yy=ymin; yy<=ymax; yy++){
      for(let xx=xmin; xx<=xmax; xx++){
        const v = gray[yy*w + xx];
        sum += v; sum2 += v*v; n++;
      }
    }
    const mean = sum/n;
    return (sum2/n) - (mean*mean);
  }

  const mask = new Uint8Array(w*h);
  let maskCount = 0;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = y*w + x;
      const r = data[4*i], g = data[4*i+1], b = data[4*i+2];
      const [hue, sat, val] = rgb2hsv(r,g,b);
      const variance = localVarianceAt(x,y, Math.max(1, Math.floor(cfg.windowSize/2)));
      const isDark = val < cfg.darkThreshold;
      const isBright = val > cfg.brightThreshold;
      const lowTexture = variance < 400;
      const likelyLiquidColor = (hue >= 20 && hue <= 70 && sat>cfg.saturationThreshold) || (hue >= 180 && hue <= 260 && sat>cfg.saturationThreshold);
      const suspect = ( (isDark || isBright) && lowTexture ) || likelyLiquidColor;
      if(suspect){ mask[i]=1; maskCount++; }
    }
  }

  const maskPercent = maskCount / (w*h);
  const spillScore = Math.round(Math.min(100, maskPercent * 1000));

  const heat = document.createElement('canvas');
  heat.width = w; heat.height = h;
  const hctx = heat.getContext('2d');
  const heatImg = hctx.createImageData(w,h);
  for(let i=0;i<w*h;i++){
    if(mask[i]){
      heatImg.data[4*i] = 255;
      heatImg.data[4*i+1] = 40;
      heatImg.data[4*i+2] = 40;
      heatImg.data[4*i+3] = 160;
    } else {
      heatImg.data[4*i+3] = 0;
    }
  }
  hctx.putImageData(heatImg,0,0);

  return { spillScore, maskPercent, heatmapCanvas: heat, smallCanvas: c };
}

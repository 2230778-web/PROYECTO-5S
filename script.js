/* script.js - comportamiento principal */
let model = null;
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photoPreview');
const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const calcBtn = document.getElementById('calcBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const tgBtn = document.getElementById('tgBtn');
const detectionsDiv = document.getElementById('detections');
const areaInput = document.getElementById('areaInput');
const resultBox = document.getElementById('resultBox');

const checklistForm = document.getElementById('checklistForm');

let stream = null;
let lastImageDataUrl = null;

/* --------------- Cargar modelo --------------- */
async function loadModel() {
  detectionsDiv.innerText = 'Cargando modelo de detección (TensorFlow COCO-SSD)...';
  model = await cocoSsd.load();
  detectionsDiv.innerText = 'Modelo listo ✅';
}
loadModel();

/* --------------- Cámara --------------- */
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

captureBtn.onclick = () => {
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  lastImageDataUrl = dataUrl;
  photoPreview.src = dataUrl;
  analyzeBtn.disabled = false;
  downloadBtn.disabled = false;
  copyBtn.disabled = true;
  tgBtn.disabled = true;
  resultBox.innerText = 'Foto capturada. Presiona "Analizar".';
};

/* --------------- Analizar con COCO-SSD --------------- */
analyzeBtn.onclick = async () => {
  if (!model) { alert('Modelo no cargado aún. Espera un momento.'); return; }
  if (!lastImageDataUrl) { alert('Primero captura una foto.'); return; }

  // pasar la imagen a un elemento Image para detectar
  const img = new Image();
  img.src = lastImageDataUrl;
  img.onload = async () => {
    detectionsDiv.innerText = 'Analizando imagen...';
    const predictions = await model.detect(img, 10);
    console.log('predictions', predictions);
    renderDetections(predictions);
    suggestAnswers(predictions);
    resultBox.innerText = 'Sugerencias generadas. Ajusta el checklist si deseas y presiona "Calcular veredicto".';
    copyBtn.disabled = false;
    tgBtn.disabled = false;
  };
};

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

/* --------------- Heurísticas para checklist --------------- */
function suggestAnswers(predictions) {
  // Contar ciertos objetos que consideramos "clutter"
  const clutterLabels = new Set(['bottle','cup','bowl','book','cell phone','remote','laptop','handbag','backpack','chair','box','suitcase','tv','microwave']);
  let clutterCount = 0;
  let chairDetected = false;
  let personDetected = false;
  if (predictions && predictions.length) {
    predictions.forEach(p => {
      const cls = p.class.toLowerCase();
      if (clutterLabels.has(cls)) clutterCount++;
      if (cls === 'chair') chairDetected = true;
      if (cls === 'person') personDetected = true;
    });
  }

  // reglas simples:
  // Seiri: si clutterCount <= 2 -> Sí, else No
  // Seiton: si chairDetected true y clutterCount <=3 then Sí else No
  // Seiso: si clutterCount <=1 -> Sí else No
  // Seiketsu: no detectable -> sugerir "No" para que usuario revise
  // Shitsuke: no detectable -> sugerir "No" (necesita auditoría humana)
  const suggestions = {
    Seiri: clutterCount <= 2 ? '1' : '0',
    Seiton: (chairDetected && clutterCount <= 3) ? '1' : '0',
    Seiso: clutterCount <= 1 ? '1' : '0',
    Seiketsu: '0',
    Shitsuke: '0'
  };

  // aplicar sugerencias al formulario (selects)
  document.querySelectorAll('#checklistForm .sel').forEach(sel => {
    const key = sel.getAttribute('data-key');
    if (suggestions[key] !== undefined) sel.value = suggestions[key];
  });
}

/* --------------- Calcular puntaje --------------- */
calcBtn.onclick = () => {
  const selects = Array.from(document.querySelectorAll('#checklistForm .sel'));
  const values = selects.map(s => parseInt(s.value, 10) || 0);
  const sum = values.reduce((a,b) => a + b, 0);
  const pct = Math.round((sum / values.length) * 100);
  const verdict = pct >= 75 ? 'ACEPTABLE' : 'NO ACEPTABLE';
  // calcular faltantes
  const keys = selects.map(s => s.getAttribute('data-key'));
  const faltantes = keys.filter((k,i) => values[i] === 0).join(', ') || 'Ninguno';

  // mostrar resultado
  resultBox.innerHTML = `<strong>Resultado:</strong><br>Área: <em>${(areaInput.value||'No especificada')}</em><br>
  Puntaje: <strong>${pct}%</strong><br>Veredicto: <strong>${verdict}</strong><br>
  Faltantes: ${faltantes}<br><br><small>Nota: análisis foto heurístico + checklist manual.</small>`;

  // activar botones
  downloadBtn.disabled = false;
  copyBtn.disabled = false;
  tgBtn.disabled = false;
};

/* --------------- Descargar foto --------------- */
downloadBtn.onclick = () => {
  if (!lastImageDataUrl) return alert('No hay foto para descargar.');
  const a = document.createElement('a');
  a.href = lastImageDataUrl;
  a.download = `5S_${(areaInput.value||'area')}_${Date.now()}.jpg`;
  a.click();
};

/* --------------- Copiar informe --------------- */
copyBtn.onclick = () => {
  const txt = buildReportText();
  navigator.clipboard.writeText(txt).then(() => {
    alert('Informe copiado al portapapeles. Pégalo en Telegram o en tu registro.');
  });
};

/* --------------- Abrir Telegram con texto (compartir) --------------- */
tgBtn.onclick = () => {
  const txt = encodeURIComponent(buildReportText());
  // Telegram share URL: abre la app web/desktop/mobile para compartir texto
  const url = `https://t.me/share/url?url=&text=${txt}`;
  window.open(url,'_blank');
};

function buildReportText() {
  const selects = Array.from(document.querySelectorAll('#checklistForm .sel'));
  const keys = selects.map(s => s.getAttribute('data-key'));
  const values = selects.map(s => parseInt(s.value,10) || 0);
  const sum = values.reduce((a,b) => a+b, 0);
  const pct = Math.round((sum / values.length) * 100);
  const verdict = pct >= 75 ? 'ACEPTABLE' : 'NO ACEPTABLE';
  const faltantes = keys.filter((k,i) => values[i] === 0).join(', ') || 'Ninguno';

  const txt = `[5S] Área: ${areaInput.value || 'No especificada'}\nPuntaje: ${pct}%\nVeredicto: ${verdict}\nFaltantes: ${faltantes}\nObservaciones: (agrega aquí comentarios)\n*Foto:* guarda la imagen y adjuntala si la compartes.`;
  return txt;
}

/* --------------- Manejar parámetro ?area= en URL (opcional) --------------- */
(function prefillAreaFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const area = params.get('area');
  if (area) areaInput.value = decodeURIComponent(area);
})();

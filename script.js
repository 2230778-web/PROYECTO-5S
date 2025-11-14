// JS/camera.js

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnStart = document.getElementById("btnStart");
const btnCapture = document.getElementById("btnCapture");
const btnAnalyze = document.getElementById("btnAnalyze");
const resultBox = document.getElementById("result");

let currentStream = null;
let photoTaken = false;

// ===== 1. Activar cámara =====
btnStart.addEventListener("click", async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    resultBox.innerHTML = `
      <p>No se pudo acceder a la cámara. Tu navegador no soporta getUserMedia.</p>
    `;
    return;
  }

  try {
    // Si ya había un stream, detenerlo
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    currentStream = stream;

    btnCapture.disabled = false;
    btnAnalyze.disabled = true;
    photoTaken = false;
    canvas.classList.add("hidden");
    resultBox.innerHTML = `
      <p>Cámara activada. Coloca el área de trabajo en el cuadro y presiona
      <strong>“Tomar foto”</strong>.</p>
    `;
  } catch (error) {
    console.error(error);
    resultBox.innerHTML = `
      <p>No se pudo acceder a la cámara. Revisa permisos del navegador
      o intenta con otro dispositivo.</p>
    `;
  }
});

// ===== 2. Tomar foto =====
btnCapture.addEventListener("click", () => {
  if (!video.videoWidth || !video.videoHeight) return;

  const width = video.videoWidth;
  const height = video.videoHeight;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  canvas.classList.remove("hidden");
  photoTaken = true;
  btnAnalyze.disabled = false;

  resultBox.innerHTML = `
    <p>Foto capturada. Ahora haz clic en <strong>“Analizar con 5S”</strong>.</p>
  `;
});

// ===== 3. Analizar la imagen según 5S =====
btnAnalyze.addEventListener("click", () => {
  if (!photoTaken) return;

  const suggestion = analyzeImageWith5S(canvas);

  resultBox.innerHTML = `
    <h3>${suggestion.title}</h3>
    <p>${suggestion.text}</p>
    ${suggestion.actions?.length
      ? `<ul>${suggestion.actions
          .map((a) => `<li>${a}</li>`)
          .join("")}</ul>`
      : ""}
  `;
});

// Heurística súper simple basada en brillo y variación
function analyzeImageWith5S(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  const imgData = ctx.getImageData(0, 0, width, height).data;

  let total = 0;
  let totalSq = 0;
  let darkCount = 0;
  let brightCount = 0;
  let count = 0;

  const step = 4 * 20; // muestrea cada 20 píxeles aprox para no hacerlo tan pesado

  for (let i = 0; i < imgData.length; i += step) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    total += gray;
    totalSq += gray * gray;
    count++;

    if (gray < 70) darkCount++;
    if (gray > 200) brightCount++;
  }

  if (count === 0) {
    return {
      title: "No se pudo analizar la imagen",
      text: "Intenta tomar otra foto con mejor iluminación.",
      actions: [],
    };
  }

  const mean = total / count;
  const variance = totalSq / count - mean * mean;

  // Reglas MUY simples para demo
  // Mucha variación + zonas brillantes => área "caótica" (muchos objetos)
  if (variance > 2500 && brightCount > count * 0.25) {
    return {
      title: "Enfócate en SEIRI (Clasificar) y SEITON (Ordenar)",
      text:
        "La imagen parece tener muchos elementos y bastante contraste, lo que suele indicar objetos mezclados o poco definidos.",
      actions: [
        "Separa lo necesario de lo innecesario (tira, archiva o reubica lo que no se use).",
        "Agrupa por categoría: herramientas juntas, papeles juntos, EPP juntos, etc.",
        "Define ubicaciones fijas (cajas, estantes, sombras) para cada tipo de objeto.",
      ],
    };
  }

  // Muy oscuro => suciedad, mala iluminación o elementos acumulados
  if (mean < 90 || darkCount > count * 0.5) {
    return {
      title: "Refuerza SEISO (Limpiar) y SEIKETSU (Estandarizar)",
      text:
        "La foto parece bastante oscura o con zonas poco definidas. Puede haber suciedad, polvo o acumulación en el área.",
      actions: [
        "Programa una limpieza profunda del área (pisos, mesas, estantes, equipos).",
        "Coloca estándares visuales: checklists de limpieza, frecuencia y responsables.",
        "Mejora la iluminación del área para identificar suciedad rápidamente.",
      ],
    };
  }

  // Caso “medio”: área relativamente homogénea
  return {
    title: "Mantén SHITSUKE (Disciplina) y mejora pequeños detalles",
    text:
      "El área no parece extremadamente saturada ni muy oscura. Puedes trabajar en refinar y sostener los estándares.",
    actions: [
      "Revisa etiquetas, señalización y contornos de objetos: ¿siguen claros y visibles?",
      "Haz auditorías 5S rápidas (5–10 minutos) con el equipo al inicio o fin del turno.",
      "Refuerza hábitos: cada cosa vuelve a su lugar antes de terminar la jornada.",
    ],
  };
}

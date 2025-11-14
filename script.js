// ===== Referencias al DOM =====
const videoFeed = document.getElementById("videoFeed");
const canvas = document.getElementById("canvas");
const cameraBtn = document.getElementById("cameraBtn");
const captureBtn = document.getElementById("captureBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const fileInput = document.getElementById("fileInput");
const errorMessage = document.getElementById("errorMessage");
const loadingSpinner = document.getElementById("loadingSpinner");
const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const newAnalysisBtn = document.getElementById("newAnalysisBtn");

let currentStream = null;

// ===== Helpers de UI =====
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.display = "block";
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.style.display = "none";
}

function showSpinner() {
  loadingSpinner.style.display = "flex";
}

function hideSpinner() {
  loadingSpinner.style.display = "none";
}

function toggleCameraButtons(state) {
  if (state === "on") {
    cameraBtn.style.display = "inline-flex";
    cameraBtn.disabled = true;
    captureBtn.style.display = "inline-flex";
    captureBtn.disabled = false;
    stopCameraBtn.style.display = "inline-flex";
    stopCameraBtn.disabled = false;
  } else {
    cameraBtn.style.display = "inline-flex";
    cameraBtn.disabled = false;
    captureBtn.style.display = "none";
    stopCameraBtn.style.display = "none";
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  videoFeed.srcObject = null;
  toggleCameraButtons("off");
}

// ===== Abrir cámara =====
cameraBtn.addEventListener("click", async () => {
  clearError();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("Tu navegador no permite acceso a la cámara (getUserMedia no soportado).");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    currentStream = stream;
    videoFeed.srcObject = stream;
    toggleCameraButtons("on");
  } catch (err) {
    console.error(err);
    showError("No se pudo acceder a la cámara. Revisa permisos del navegador o intenta con otro dispositivo.");
  }
});

// ===== Capturar foto desde la cámara =====
captureBtn.addEventListener("click", () => {
  clearError();

  if (!videoFeed.videoWidth || !videoFeed.videoHeight) {
    showError("Espera unos segundos mientras se inicia la cámara y vuelve a intentar.");
    return;
  }

  canvas.width = videoFeed.videoWidth;
  canvas.height = videoFeed.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);

  runAnalysis();
});

// ===== Cerrar cámara =====
stopCameraBtn.addEventListener("click", () => {
  stopCamera();
});

// ===== Subir imagen desde archivo =====
fileInput.addEventListener("change", (e) => {
  clearError();
  const file = e.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showError("Por favor selecciona un archivo de imagen válido.");
    return;
  }

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    runAnalysis();
  };
  img.onerror = () => {
    showError("No se pudo cargar la imagen. Intenta con otro archivo.");
  };

  const url = URL.createObjectURL(file);
  img.src = url;
});

// ===== Nuevo análisis =====
if (newAnalysisBtn) {
  newAnalysisBtn.addEventListener("click", () => {
    resultsSection.style.display = "none";
    resultsContainer.innerHTML = "";
    clearError();
  });
}

// ===== Ejecutar análisis con "IA 5S" =====
function runAnalysis() {
  clearError();
  showSpinner();
  resultsSection.style.display = "none";

  setTimeout(() => {
    const suggestion = analyzeImageWith5S(canvas);
    renderSuggestion(suggestion);
    hideSpinner();
  }, 600);
}

function renderSuggestion(suggestion) {
  const { title, summary, focus, actions, extras } = suggestion;

  resultsContainer.innerHTML = `
    <h2>${title}</h2>
    <p>${summary}</p>
    <h3>Énfasis 5S:</h3>
    <p><strong>${focus}</strong></p>
    ${
      actions?.length
        ? `<h3>Acciones recomendadas:</h3>
           <ul>${actions.map((a) => `<li>${a}</li>`).join("")}</ul>`
        : ""
    }
    ${
      extras
        ? `<h3>Tips adicionales:</h3>
           <ul>${extras.map((a) => `<li>${a}</li>`).join("")}</ul>`
        : ""
    }
  `;

  resultsSection.style.display = "block";
}

// ===== Analizador 5S con 20 casos distintos =====
function analyzeImageWith5S(canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) {
    return {
      title: "No se pudo analizar la imagen",
      summary: "Intenta tomar otra foto o subir una imagen diferente.",
      focus: "Repetir captura",
      actions: [
        "Asegúrate de que la cámara tenga buena iluminación.",
        "Evita mover el dispositivo al capturar.",
      ],
    };
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let sumBrightness = 0;
  let sumBrightnessSq = 0;
  let sumSaturation = 0;
  let darkCount = 0;
  let brightCount = 0;
  let midCount = 0;
  let count = 0;

  // Para detectar zonas oscuras por cuadrantes
  const quadSum = [0, 0, 0, 0];
  const quadCount = [0, 0, 0, 0];

  const step = 10; // muestreo

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Brillo en escala de grises
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      sumBrightness += gray;
      sumBrightnessSq += gray * gray;

      if (gray < 70) darkCount++;
      else if (gray > 200) brightCount++;
      else midCount++;

      // Saturación aproximada
      const maxRGB = Math.max(r, g, b);
      const minRGB = Math.min(r, g, b);
      let sat = 0;
      if (maxRGB > 0) {
        sat = (maxRGB - minRGB) / maxRGB;
      }
      sumSaturation += sat;

      // Cuadrantes para suciedad localizada
      let quadIndex = 0;
      const top = y < height / 2;
      const left = x < width / 2;
      if (top && left) quadIndex = 0; // arriba izquierda
      else if (top && !left) quadIndex = 1; // arriba derecha
      else if (!top && left) quadIndex = 2; // abajo izquierda
      else quadIndex = 3; // abajo derecha

      quadSum[quadIndex] += gray;
      quadCount[quadIndex]++;

      count++;
    }
  }

  if (count === 0) {
    return {
      title: "No se pudo analizar la imagen",
      summary:
        "La imagen parece vacía o muy pequeña. Intenta nuevamente con un encuadre más cerrado.",
      focus: "Repetir captura",
      actions: [
        "Acerca un poco más la cámara al área de trabajo.",
        "Verifica que no haya obstáculos frente al lente.",
      ],
    };
  }

  const meanBrightness = sumBrightness / count;
  const variance =
    sumBrightnessSq / count - meanBrightness * meanBrightness;
  const meanSaturation = sumSaturation / count;

  const darkRatio = darkCount / count;
  const brightRatio = brightCount / count;
  const midRatio = midCount / count;

  const quadMean = quadSum.map((s, i) =>
    quadCount[i] ? s / quadCount[i] : 0
  );
  const maxQuad = Math.max(...quadMean);
  const minQuad = Math.min(...quadMean);
  const quadDiff = maxQuad - minQuad;

  // Ratios simple de brillo centro vs bordes (para saber si el caos está al centro o orillas)
  const centerBox = {
    x1: width * 0.3,
    x2: width * 0.7,
    y1: height * 0.3,
    y2: height * 0.7,
  };

  let centerSum = 0;
  let centerCount = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y += step * 2) {
    for (let x = 0; x < width; x += step * 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const inCenter =
        x >= centerBox.x1 &&
        x <= centerBox.x2 &&
        y >= centerBox.y1 &&
        y <= centerBox.y2;

      if (inCenter) {
        centerSum += gray;
        centerCount++;
      } else {
        edgeSum += gray;
        edgeCount++;
      }
    }
  }

  const centerMean = centerCount ? centerSum / centerCount : meanBrightness;
  const edgeMean = edgeCount ? edgeSum / edgeCount : meanBrightness;

  // ============================================================
  //        CLASIFICACIÓN PRINCIPAL EN TIPOS DE ESPACIO
  // ============================================================
  let type = "intermedio";

  // Muy oscuro general (suciedad fuerte)
  if (meanBrightness < 75 && darkRatio > 0.55) {
    type = "muy_oscuro_general";
  }
  // Zonas oscuras claras por cuadrantes
  else if (quadDiff > 45 && darkRatio > 0.35) {
    type = "suciedad_localizada";
  }
  // Mucho desorden y colores fuertes
  else if (variance > 3200 && meanSaturation > 0.35 && midRatio > 0.4) {
    type = "caos_color";
  }
  // Desorden gris (papeles, cajas, piezas)
  else if (variance > 2800 && meanSaturation <= 0.35 && midRatio > 0.4) {
    type = "caos_gris";
  }
  // Muy limpio y ordenado
  else if (
    meanBrightness >= 140 &&
    meanBrightness <= 210 &&
    variance < 1500 &&
    darkRatio < 0.25
  ) {
    type = "limpio_ordenado";
  }
  // Muy despejado, casi vacío
  else if (meanBrightness > 190 && variance < 1000 && midRatio < 0.4) {
    type = "casi_vacio";
  }
  // Mucha luz en bordes, centro cargado
  else if (centerMean < edgeMean - 20 && variance > 2000) {
    type = "centro_congestionado";
  }
  // Bordes cargados, centro despejado
  else if (edgeMean < centerMean - 20 && variance > 2000) {
    type = "bordes_saturados";
  }
  // Imagen muy brillante y con poco contraste
  else if (brightRatio > 0.45 && variance < 1500) {
    type = "sobreiluminado";
  }

  // ============================================================
  //        20 ESCENARIOS DISTINTOS POR TIPO
  // ============================================================

  // Nota: cada tipo tiene varias variantes, en total son 20
  const scenarios = {
    // 1–3: muy oscuro general
    muy_oscuro_general: [
      {
        title: "Tu espacio se ve muy oscuro y probablemente sucio",
        summary:
          "Hay demasiadas zonas oscuras y poco detalle. Normalmente esto indica suciedad, mala iluminación o áreas poco atendidas.",
        focus: "SEISO (Limpiar) + SEIKETSU (Estandarizar)",
        actions: [
          "Realiza una limpieza profunda de rincones, debajo de mesas y equipos.",
          "Mejora la iluminación para que la suciedad no pase desapercibida.",
          "Incluye en tu checklist 5S revisar específicamente estas zonas.",
        ],
      },
      {
        title: "Exceso de sombra: tu espacio puede esconder problemas",
        summary:
          "La imagen está dominada por sombras. Esto suele ocultar fugas, polvo, basura o materiales abandonados.",
        focus: "SEISO (Limpiar) + SEIRI (Clasificar)",
        actions: [
          "Retira objetos que generen sombra innecesaria y que no se usan.",
          "Ilumina mejor el área y revisa fugas, manchas o acumulación de polvo.",
          "Registra las anomalías detectadas para darles seguimiento.",
        ],
      },
      {
        title: "Zona crítica: poca luz, poca visibilidad y riesgo de suciedad",
        summary:
          "El nivel de luminosidad es demasiado bajo para un área de trabajo segura y ordenada.",
        focus: "SEISO (Limpiar) + SHITSUKE (Disciplina)",
        actions: [
          "Asegura que la limpieza diaria incluya verificación de iluminación.",
          "Evita almacenar materiales en lugares donde bloqueen la luz principal.",
          "Incluye la revisión de focos y lámparas en tu rutina de inspección.",
        ],
      },
    ],

    // 4–6: suciedad localizada
    suciedad_localizada: [
      {
        title: "Se detectan focos de suciedad en zonas específicas",
        summary:
          "Hay áreas mucho más oscuras que el resto de la imagen. Suelen corresponder a rincones, debajo de mesas o detrás de equipos.",
        focus: "SEISO (Limpieza focalizada)",
        actions: [
          "Limpia específicamente esquinas y zonas de difícil acceso.",
          "Retira cajas, tarimas o materiales que impidan llegar a esas zonas.",
          "Instala iluminación dirigida para evidenciar la suciedad oculta.",
        ],
      },
      {
        title: "Algunas zonas parecen olvidadas en la rutina de limpieza",
        summary:
          "Se observa que ciertas áreas tienen mucho menos luz y detalle. Son candidatas a ser 'zonas ciegas' en tu 5S.",
        focus: "SEISO (Limpiar) + SEIKETSU (Mantener)",
        actions: [
          "Marca en tu checklist las zonas críticas que no se limpian a diario.",
          "Asigna responsables claros para cada zona de difícil acceso.",
          "Usa fotos del 'antes y después' para evidenciar la mejora.",
        ],
      },
      {
        title: "Tienes acumulación localizada: un pequeño punto negro en tu 5S",
        summary:
          "Hay secciones visiblemente más oscuras que el resto, donde suele acumularse polvo, aceite o residuos.",
        focus: "SEISO (Limpiar) + SEIRI (Clasificar)",
        actions: [
          "Revisa qué objetos están tapando esas zonas y decide si son necesarios.",
          "Rediseña la distribución para poder limpiar sin tener que mover grandes volúmenes cada vez.",
          "Incluye inspecciones sorpresa sobre estas zonas para sostener la disciplina.",
        ],
      },
    ],

    // 7–9: caos con color
    caos_color: [
      {
        title: "Tu espacio se ve saturado y muy colorido",
        summary:
          "Se detecta mucho contraste y variedad de colores. Esto suele indicar mezcla de materiales distintos y desorden visual.",
        focus: "SEIRI (Clasificar) + SEITON (Ordenar)",
        actions: [
          "Separa por familias: herramientas, EPP, papeles, químicos, etc.",
          "Define un color por tipo de contenedor o zona para reducir el ruido visual.",
          "Retira del área principal todo lo que no se use en el turno actual.",
        ],
      },
      {
        title: "Demasiados objetos compitiendo por la atención",
        summary:
          "El nivel de contraste y saturación es alto. Puede ser difícil identificar rápidamente lo que necesitas.",
        focus: "SEITON (Ordenar)",
        actions: [
          "Etiqueta claramente las ubicaciones de los materiales críticos.",
          "Utiliza señalización simple y coherente, evitando demasiados colores distintos.",
          "Agrupa materiales por frecuencia de uso y elimina lo duplicado.",
        ],
        extras: [
          "Un espacio más 'limpio visualmente' reduce errores y tiempos de búsqueda.",
        ],
      },
      {
        title: "Tu área parece un collage: hay mezcla de todo",
        summary:
          "La imagen sugiere un entorno con muchos elementos de distintos colores y tamaños sin un patrón claro.",
        focus: "SEIRI (Clasificar)",
        actions: [
          "Haz una 'limpieza de inventario visual': qué se queda, qué se va, qué se reubica.",
          "Define zonas específicas para cada tipo de objeto y respétalas.",
          "Repite la clasificación al menos una vez por semana hasta estabilizar el orden.",
        ],
      },
    ],

    // 10–12: caos gris (papeles, cajas, piezas)
    caos_gris: [
      {
        title: "Muchos elementos similares sin clasificar",
        summary:
          "Hay bastante variación de luz pero con baja saturación, típico de pilas de papeles, cajas o piezas metálicas.",
        focus: "SEIRI (Clasificar) + SEITON (Ordenar)",
        actions: [
          "Separa lo urgente, lo importante y lo que se puede archivar.",
          "Evita apilar papeles o piezas: utiliza organizadores verticales o contenedores etiquetados.",
          "Depura materiales obsoletos o sin uso reciente.",
        ],
      },
      {
        title: "Tu espacio parece un almacén improvisado",
        summary:
          "La imagen refleja muchos objetos similares que podrían estar mejor organizados o almacenados en otro sitio.",
        focus: "SEIRI (Eliminar exceso) + SEITON (Ordenar)",
        actions: [
          "Define mínimos y máximos de inventario visible en el área.",
          "Envía a un almacén central lo que no sea de uso frecuente.",
          "Marca claramente las ubicaciones de cada lote o contenedor.",
        ],
      },
      {
        title: "Predominan las pilas y acumulaciones",
        summary:
          "Se observa un patrón compatible con montones de materiales, donde es difícil ver el fondo del área.",
        focus: "SEIRI (Clasificar) + SEISO (Limpiar)",
        actions: [
          "Desarma las pilas en unidades más pequeñas y visibles.",
          "Limpia el área al liberar espacio para evidenciar daños o fugas ocultas.",
          "Estandariza el nivel máximo de apilamiento permitido.",
        ],
      },
    ],

    // 13–14: limpio y ordenado
    limpio_ordenado: [
      {
        title: "Tu espacio se ve limpio y ordenado",
        summary:
          "La iluminación es adecuada y no se aprecian grandes zonas de suciedad ni saturación de objetos.",
        focus: "SEIKETSU (Estandarizar) + SHITSUKE (Disciplina)",
        actions: [
          "Toma una foto de referencia y úsala como estándar visual.",
          "Crea una rutina breve de 5–10 minutos para mantener la condición al final de cada turno.",
          "Reconoce al equipo que mantiene el estándar de forma constante.",
        ],
      },
      {
        title: "Buen trabajo: tienes un 5S avanzado en este espacio",
        summary:
          "El área luce controlada, con buena visibilidad y sin desorden aparente.",
        focus: "SHITSUKE (Disciplina)",
        actions: [
          "Realiza auditorías cortas para asegurar que el nivel se mantiene.",
          "Comparte fotos de este espacio como ejemplo para otras áreas.",
          "Registra qué prácticas están funcionando bien para replicarlas.",
        ],
      },
    ],

    // 15–16: casi vacío / mucho espacio libre
    casi_vacio: [
      {
        title: "El área está muy despejada: tienes un gran potencial",
        summary:
          "Se observa mucha superficie libre y pocos elementos. Es un momento ideal para definir estándares visuales.",
        focus: "SEIKETSU (Estandarizar)",
        actions: [
          "Marca contornos en piso o superficies para indicar dónde va cada cosa.",
          "Define qué está permitido almacenar ahí y qué no.",
          "Evita que el espacio se convierta en bodega temporal de 'cualquier cosa'.",
        ],
      },
      {
        title: "Espacio casi vacío: define reglas antes de que se llene de nuevo",
        summary:
          "Un área amplia y despejada es perfecta para empezar bien con las 5S.",
        focus: "SEIKETSU (Estandarizar) + SHITSUKE (Disciplina)",
        actions: [
          "Crea señalización clara para el uso del área.",
          "Establece quién es responsable de mantenerla despejada.",
          "Documenta el 'estado ideal' y revísalo de forma periódica.",
        ],
      },
    ],

    // 17: centro congestionado
    centro_congestionado: [
      {
        title: "El centro del área está sobrecargado",
        summary:
          "La zona central del encuadre parece más densa que los bordes, típico de mesas o estaciones de trabajo saturadas.",
        focus: "SEIRI (Clasificar) + SEITON (Ordenar)",
        actions: [
          "Retira del centro lo que no sea esencial para la operación inmediata.",
          "Desplaza materiales de baja frecuencia de uso hacia los bordes o un almacén.",
          "Libera el área central para mejorar seguridad y ergonomía.",
        ],
      },
    ],

    // 18: bordes saturados
    bordes_saturados: [
      {
        title: "Los bordes del área están saturados de objetos",
        summary:
          "Se observa mayor densidad visual en las orillas, lo cual puede indicar pasillos obstruidos o paredes llenas de materiales.",
        focus: "SEIRI (Eliminar obstáculos) + SEITON (Ordenar)",
        actions: [
          "Verifica que pasillos y rutas de escape no estén bloqueados.",
          "Retira objetos apoyados en paredes si no son necesarios.",
          "Rediseña la distribución para dejar rutas limpias y seguras.",
        ],
      },
    ],

    // 19: sobreiluminado
    sobreiluminado: [
      {
        title: "Tu espacio está muy iluminado pero con poco contraste útil",
        summary:
          "La imagen es muy clara, casi sobreexpuesta. Puede dificultar la detección de detalles finos o etiquetas.",
        focus: "SEIKETSU (Estandarizar visualmente)",
        actions: [
          "Ajusta la iluminación para evitar reflejos excesivos.",
          "Revisa que las etiquetas sean legibles y con buen contraste.",
          "Usa colores sólidos y simples para la señalización.",
        ],
      },
    ],

    // 20: intermedio (caso por defecto)
    intermedio: [
      {
        title: "Tu espacio está en un estado intermedio: ni muy mal, ni excelente",
        summary:
          "No se detectan extremos de suciedad o orden perfecto, lo que indica una buena base para mejorar.",
        focus: "SEIRI (Clasificar) + SEISO (Limpiar)",
        actions: [
          "Retira elementos que claramente no pertenecen al área o al turno actual.",
          "Limpia las superficies principales para dar un 'reset' visual.",
          "Define 3 mejoras simples que puedas implementar hoy mismo.",
        ],
      },
    ],
  };

  // Selección de escenario según tipo
  const list = scenarios[type] || scenarios["intermedio"];
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

const state = {
    stream: null,
    isAnalyzing: false,
    currentImage: null,
};

// DOM Elements
const videoFeed = document.getElementById('videoFeed');
const canvas = document.getElementById('canvas');
const cameraBtn = document.getElementById('cameraBtn');
const captureBtn = document.getElementById('captureBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const fileInput = document.getElementById('fileInput');
const cameraSection = document.getElementById('cameraSection');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsContainer');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const errorMessage = document.getElementById('errorMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const fileLabel = document.querySelector('.file-label');

// Camera Functions
async function startCamera() {
    try {
        errorMessage.style.display = 'none';
        
        // Try to access rear camera first (environment), fallback to any camera
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoFeed.srcObject = state.stream;
        videoFeed.style.display = 'block';
        
        // Wait for video to load before showing capture button
        videoFeed.onloadedmetadata = () => {
            console.log("[v0] Camera loaded successfully");
        };
        
        cameraBtn.style.display = 'none';
        captureBtn.style.display = 'inline-flex';
        stopCameraBtn.style.display = 'inline-flex';
        fileLabel.style.display = 'none';
    } catch (error) {
        console.log("[v0] Camera error:", error);
        // Fallback without facingMode constraint
        try {
            state.stream = await navigator.mediaDevices.getUserMedia({ 
                video: true,
                audio: false
            });
            videoFeed.srcObject = state.stream;
            videoFeed.style.display = 'block';
            cameraBtn.style.display = 'none';
            captureBtn.style.display = 'inline-flex';
            stopCameraBtn.style.display = 'inline-flex';
            fileLabel.style.display = 'none';
        } catch (fallbackError) {
            showError('No se pudo acceder a la cámara. Por favor, verifica los permisos del navegador.');
            console.error('Camera fallback error:', fallbackError);
        }
    }
}

function stopCamera() {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    videoFeed.style.display = 'none';
    cameraBtn.style.display = 'inline-flex';
    captureBtn.style.display = 'none';
    stopCameraBtn.style.display = 'none';
    fileLabel.style.display = 'flex';
}

function capturePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = videoFeed.videoWidth;
    canvas.height = videoFeed.videoHeight;
    context.drawImage(videoFeed, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    state.currentImage = imageData;
    stopCamera();
    analyzeImage(imageData);
}

// File Upload
fileLabel.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.currentImage = e.target?.result;
            analyzeImage(state.currentImage);
        };
        reader.readAsDataURL(file);
    }
});

// Analysis Function
async function analyzeImage(imageData) {
    state.isAnalyzing = true;
    errorMessage.style.display = 'none';
    loadingSpinner.style.display = 'flex';
    
    try {
        // Simulate API delay for demo
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock analysis based on image
        const results = generateMockAnalysis();
        displayResults(results);
    } catch (error) {
        showError('Error al analizar la imagen. Intenta de nuevo.');
        console.error('Analysis error:', error);
    } finally {
        state.isAnalyzing = false;
        loadingSpinner.style.display = 'none';
    }
}

function generateMockAnalysis() {
    return {
        seiri: {
            score: 72,
            description: 'Nivel de clasificación adecuado',
            recommendations: [
                { text: 'Revisar artículos innecesarios en las esquinas', priority: 'High' },
                { text: 'Etiquetar productos por categoría', priority: 'Medium' },
                { text: 'Remover elementos duplicados', priority: 'Medium' }
            ]
        },
        seiton: {
            score: 68,
            description: 'Organización en progreso',
            recommendations: [
                { text: 'Implementar sistema de ubicaciones codificadas', priority: 'High' },
                { text: 'Reorganizar estantes de izquierda a derecha', priority: 'Medium' },
                { text: 'Utilizar contenedores transparentes', priority: 'Low' }
            ]
        },
        seiso: {
            score: 65,
            description: 'Limpieza requerida',
            recommendations: [
                { text: 'Limpiar pisos y superficies diariamente', priority: 'High' },
                { text: 'Establecer horario de limpieza regular', priority: 'High' },
                { text: 'Proporcionar suministros de limpieza accesibles', priority: 'Medium' }
            ]
        },
        seiketsu: {
            score: 70,
            description: 'Estandarización parcial',
            recommendations: [
                { text: 'Crear procedimientos documentados 5S', priority: 'High' },
                { text: 'Diseñar tableros informativos visuales', priority: 'Medium' },
                { text: 'Establecer estándares de color para zonas', priority: 'Low' }
            ]
        },
        shitsuke: {
            score: 75,
            description: 'Buena disciplina de equipo',
            recommendations: [
                { text: 'Realizar auditorías 5S semanales', priority: 'Medium' },
                { text: 'Capacitar a nuevos empleados en 5S', priority: 'Medium' },
                { text: 'Celebrar logros y mejoras del equipo', priority: 'Low' }
            ]
        }
    };
}

// Display Results
function displayResults(results) {
    let html = '<div class="results-container">';
    
    const fiveS = [
        { name: 'Seiri (Clasificación)', key: 'seiri', emoji: '📋' },
        { name: 'Seiton (Organización)', key: 'seiton', emoji: '📦' },
        { name: 'Seiso (Limpieza)', key: 'seiso', emoji: '✨' },
        { name: 'Seiketsu (Estandarización)', key: 'seiketsu', emoji: '📐' },
        { name: 'Shitsuke (Disciplina)', key: 'shitsuke', emoji: '🎯' },
    ];

    fiveS.forEach(s => {
        const data = results[s.key] || {};
        const score = data.score || 0;
        const recommendations = data.recommendations || [];

        html += `
            <div class="score-card">
                <div class="score-header">
                    <div>
                        <div class="score-title">${s.emoji} ${s.name}</div>
                        <div class="score-label">${data.description || ''}</div>
                    </div>
                    <div class="score-value">${score}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${score}%"></div>
                </div>
                <div class="recommendations">
        `;

        recommendations.forEach(rec => {
            const priorityClass = rec.priority?.toLowerCase() || 'low';
            const priorityText = rec.priority || 'Normal';
            html += `
                <div class="recommendation-item">
                    <div>
                        <span class="priority-badge priority-${priorityClass}">${priorityText}</span>
                        <p>${rec.text}</p>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';
    resultsContainer.innerHTML = html;
    cameraSection.style.display = 'none';
    resultsSection.style.display = 'block';
}

// Show Error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// New Analysis
newAnalysisBtn.addEventListener('click', () => {
    state.currentImage = null;
    resultsContainer.innerHTML = '';
    resultsSection.style.display = 'none';
    cameraSection.style.display = 'block';
    fileInput.value = '';
});

// Event Listeners
cameraBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', capturePhoto);
stopCameraBtn.addEventListener('click', stopCamera);

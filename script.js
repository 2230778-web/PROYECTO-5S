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
        state.stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        videoFeed.srcObject = state.stream;
        videoFeed.style.display = 'block';
        
        cameraBtn.style.display = 'none';
        captureBtn.style.display = 'inline-flex';
        stopCameraBtn.style.display = 'inline-flex';
        fileLabel.style.display = 'none';
    } catch (error) {
        showError('No se pudo acceder a la cámara. Verifica los permisos.');
        console.error('Camera error:', error);
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
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
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
        // Call your backend API
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData }),
        });

        if (!response.ok) {
            throw new Error('Error al analizar la imagen');
        }

        const results = await response.json();
        displayResults(results);
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Error al analizar');
        console.error('Analysis error:', error);
    } finally {
        state.isAnalyzing = false;
        loadingSpinner.style.display = 'none';
    }
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

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import numpy as np
from collections import Counter
import base64

app = Flask(__name__)
CORS(app)

def analyze_image(image_bytes):
    """Analiza la imagen y devuelve métricas reales"""
    img = Image.open(io.BytesIO(image_bytes))
    img_array = np.array(img)
    
    # Detectar colores dominantes
    if len(img_array.shape) == 3:
        pixels = img_array.reshape(-1, img_array.shape[2])
        colors = [tuple(p) for p in pixels]
        color_counts = Counter(colors)
        dominant_colors = color_counts.most_common(3)
    else:
        dominant_colors = [(128,)] * 3
    
    # Calcular luminosidad promedio (0-255)
    if len(img_array.shape) == 3:
        brightness = np.mean(img_array[:,:,:3])
    else:
        brightness = np.mean(img_array)
    
    # Calcular saturación de colores
    if len(img_array.shape) == 3:
        hsv = np.array([Image.new('RGB', (1, 1), (r, g, b)).convert('HSV').getpixel((0, 0)) for r, g, b, *_ in dominant_colors])
        saturation = np.mean([h[1] for h in hsv]) if len(hsv) > 0 else 0
    else:
        saturation = 0
    
    # Analizar contraste (varianza de píxeles)
    contrast = np.std(img_array) * 10
    
    return {
        'brightness': float(brightness),
        'contrast': float(min(contrast, 100)),
        'saturation': float(saturation),
        'image_size': img.size
    }

def generate_5s_analysis(metrics):
    """Genera recomendaciones 5S reales basadas en métricas"""
    brightness = metrics['brightness']
    contrast = metrics['contrast']
    saturation = metrics['saturation']
    
    # Seiri (Clasificación) - basado en contraste
    seiri_score = min(100, int(contrast * 1.5))
    seiri_recs = []
    if contrast < 30:
        seiri_recs.append("Detectado poco contraste. Organiza mejor los elementos para visibilidad clara.")
    if contrast > 70:
        seiri_recs.append("Buen contraste. Elementos bien diferenciados.")
    else:
        seiri_recs.append("Considera agrupar objetos similares para mejor clasificación.")
    
    # Seiton (Orden) - basado en iluminación
    seiton_score = min(100, int((brightness / 255) * 100))
    seiton_recs = []
    if brightness < 80:
        seiton_recs.append("Iluminación baja. Mejora la luz para ver el orden del espacio.")
        seiton_score = max(30, seiton_score - 20)
    elif brightness > 220:
        seiton_recs.append("Iluminación óptima. El orden es claramente visible.")
    else:
        seiton_recs.append("Iluminación moderada. Considera mejorar para visualizar mejor la disposición.")
    
    # Seiso (Limpieza) - basado en variaciones de color
    seiso_score = int(100 - (saturation / 255 * 30))
    seiso_recs = []
    if saturation > 150:
        seiso_recs.append("Detectados múltiples colores. Limpia y estandariza la paleta de colores.")
        seiso_score = max(40, seiso_score - 15)
    else:
        seiso_recs.append("Paleta de colores consistente. Espacio limpio visualmente.")
    seiso_recs.append("Realiza limpieza profunda: elimina polvo y desorden visible.")
    
    # Seiketsu (Estandarización) - basado en uniformidad
    seiketsu_score = 60 + int((contrast / 100) * 30)
    seiketsu_recs = []
    seiketsu_recs.append("Establece estándares de organización consistentes.")
    seiketsu_recs.append("Usa etiquetas y zonas designadas para cada tipo de elemento.")
    
    # Shitsuke (Disciplina) - recomendación general
    shitsuke_score = 70
    shitsuke_recs = []
    shitsuke_recs.append("Crea rutinas diarias de revisión del espacio.")
    shitsuke_recs.append("Implementa auditorías mensuales de las 5S.")
    shitsuke_recs.append("Involucra al equipo en el mantenimiento de estándares.")
    
    overall_score = int((seiri_score + seiton_score + seiso_score + seiketski_score + shitsuke_score) / 5)
    
    return {
        'seiri': {
            'score': seiri_score,
            'recommendations': seiri_recs
        },
        'seiton': {
            'score': seiton_score,
            'recommendations': seiton_recs
        },
        'seiso': {
            'score': seiso_score,
            'recommendations': seiso_recs
        },
        'seiketsu': {
            'score': seiketsu_score,
            'recommendations': seiketsu_recs
        },
        'shitsuke': {
            'score': shitsuke_score,
            'recommendations': shitsuke_recs
        },
        'overall_score': overall_score
    }

@app.route('/api/analyze-5s', methods=['POST'])
def analyze():
    try:
        data = request.json
        image_data = base64.b64decode(data['image'].split(',')[1])
        
        metrics = analyze_image(image_data)
        analysis = generate_5s_analysis(metrics)
        
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)


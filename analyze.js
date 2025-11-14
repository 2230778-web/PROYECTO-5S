export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // For demo purposes, return mock analysis
        // In production, you would call Claude/GPT API here
        const mockResults = {
            seiri: {
                score: 65,
                description: 'Eliminación de elementos innecesarios',
                recommendations: [
                    { text: 'Hay varios elementos fuera de lugar que podrían descartarse', priority: 'High' },
                    { text: 'Considera crear zonas específicas para cada tipo de objeto', priority: 'High' },
                    { text: 'Organiza los cables sueltos', priority: 'Medium' },
                ]
            },
            seiton: {
                score: 72,
                description: 'Organización del espacio',
                recommendations: [
                    { text: 'El layout general es correcto pero necesita ajustes menores', priority: 'Low' },
                    { text: 'Usa etiquetas para identificar zonas', priority: 'Medium' },
                    { text: 'Los elementos más usados deben estar más accesibles', priority: 'High' },
                ]
            },
            seiso: {
                score: 58,
                description: 'Limpieza del espacio',
                recommendations: [
                    { text: 'Se observa polvo acumulado en las esquinas', priority: 'High' },
                    { text: 'Realiza una limpieza profunda semanal', priority: 'Medium' },
                    { text: 'Implementa un plan de limpieza diaria', priority: 'High' },
                ]
            },
            seiketsu: {
                score: 70,
                description: 'Estandarización de procesos',
                recommendations: [
                    { text: 'Documenta los estándares del espacio', priority: 'Medium' },
                    { text: 'Crea tableros con normas visuales', priority: 'Low' },
                    { text: 'Establece responsabilidades claras', priority: 'Medium' },
                ]
            },
            shitsuke: {
                score: 62,
                description: 'Autodisciplina y mantención',
                recommendations: [
                    { text: 'Realiza auditorías semanales del espacio', priority: 'Medium' },
                    { text: 'Capacita a tu equipo en metodología 5S', priority: 'High' },
                    { text: 'Crea recordatorios visuales para las normas', priority: 'Low' },
                ]
            }
        };

        res.status(200).json(mockResults);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Error analyzing image' });
    }
}

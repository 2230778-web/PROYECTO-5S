export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { image } = req.body;

    if (!image) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        console.log("[v0] Calling OpenAI Vision API");

        // Call OpenAI Vision API with the image
        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4-vision',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analiza esta imagen de un espacio de trabajo bajo la metodología 5S. Devuelve un JSON con la siguiente estructura exacta (SIN explicaciones adicionales, SOLO el JSON):

{
  "seiri": {
    "score": número 0-100,
    "description": "descripción breve",
    "recommendations": [
      {"text": "recomendación", "priority": "High|Medium|Low"},
      {"text": "recomendación", "priority": "High|Medium|Low"}
    ]
  },
  "seiton": {
    "score": número 0-100,
    "description": "descripción breve",
    "recommendations": [
      {"text": "recomendación", "priority": "High|Medium|Low"},
      {"text": "recomendación", "priority": "High|Medium|Low"}
    ]
  },
  "seiso": {
    "score": número 0-100,
    "description": "descripción breve",
    "recommendations": [
      {"text": "recomendación", "priority": "High|Medium|Low"},
      {"text": "recomendación", "priority": "High|Medium|Low"}
    ]
  },
  "seiketsu": {
    "score": número 0-100,
    "description": "descripción breve",
    "recommendations": [
      {"text": "recomendación", "priority": "High|Medium|Low"},
      {"text": "recomendación", "priority": "High|Medium|Low"}
    ]
  },
  "shitsuke": {
    "score": número 0-100,
    "description": "descripción breve",
    "recommendations": [
      {"text": "recomendación", "priority": "High|Medium|Low"},
      {"text": "recomendación", "priority": "High|Medium|Low"}
    ]
  }
}`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: image,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 2000,
            })
        });

        if (!analysisResponse.ok) {
            const error = await analysisResponse.json();
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI API error: ${error.error?.message}`);
        }

        const analysisData = await analysisResponse.json();
        const analysisText = analysisData.choices[0].message.content;

        // Parse JSON from response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse JSON from AI response');
        }

        const results = JSON.parse(jsonMatch[0]);
        console.log("[v0] Analysis successful");

        return res.status(200).json(results);
    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({ 
            error: 'Failed to analyze image',
            details: error.message 
        });
    }
}

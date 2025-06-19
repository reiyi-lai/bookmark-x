# Bookmark ML Categorization Service

A Python-based microservice for AI-powered bookmark categorization using modern NLP and machine learning techniques.

## Features

- **Multiple ML Approaches**: Combines sentence transformers, TF-IDF, keyword matching, and rule-based classification
- **High Performance**: Optimized for batch processing with async support
- **Easy Integration**: RESTful API that integrates seamlessly with your Node.js backend
- **Extensible**: Easy to add new models and categorization strategies

## Tech Stack

- **FastAPI**: Modern Python web framework
- **Sentence Transformers**: Semantic similarity using pre-trained models
- **scikit-learn**: TF-IDF vectorization and cosine similarity
- **spaCy**: Advanced text preprocessing and NLP
- **Pydantic**: Data validation and serialization

## Quick Start

### 1. Setup Environment

```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Download Required Models

```bash
# Download spaCy English model
python -m spacy download en_core_web_sm
```

### 3. Configure Environment

```bash
cp env.example .env
# Edit .env with your configuration
```

### 4. Run the Service

```bash
# Development
python main.py

# Or with uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Single Categorization
```bash
POST /categorize
Content-Type: application/json

{
  "text": "Check out this amazing productivity tool for developers",
  "categories": [
    {"id": 1, "name": "automation tools", "description": "Tools for productivity"},
    {"id": 2, "name": "interesting reads", "description": "Articles and blog posts"}
  ]
}
```

### Batch Categorization
```bash
POST /categorize/batch
Content-Type: application/json

{
  "texts": [
    "Great quote about success",
    "New job opening at tech company"
  ],
  "categories": [
    {"id": 1, "name": "quotes", "description": "Inspirational quotes"},
    {"id": 2, "name": "job opportunities", "description": "Job postings"}
  ]
}
```

## Integration with Node.js Backend

Update your Node.js bookmark service to call the Python ML service:

```javascript
// In your bookmark-service.ts
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function categorizeWithPython(texts, categories) {
  const response = await fetch(`${ML_SERVICE_URL}/categorize/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, categories })
  });
  
  return await response.json();
}
```

## Deployment Options

### Railway
```bash
# Deploy to Railway
railway login
railway new
railway add
railway deploy
```

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .
EXPOSE 8000

CMD ["python", "main.py"]
```

### Environment Variables for Production
- `PORT`: Service port (default: 8000)
- `ENV`: Set to "production" for production deployment

## Performance Considerations

- **Model Loading**: Models are loaded once at startup for optimal performance
- **Batch Processing**: Use the `/categorize/batch` endpoint for multiple texts
- **Memory Usage**: The service loads ~200MB of ML models into memory
- **Scaling**: Can be horizontally scaled; each instance loads its own models

## Future Enhancements

- **Custom Models**: Train domain-specific models on your bookmark data
- **Caching**: Add Redis caching for frequently categorized content
- **Analytics**: Track categorization accuracy and model performance
- **A/B Testing**: Compare different model approaches

## Development

### Adding New Categories
Edit the `keyword_sets` in `categorizer.py` to add domain-specific keywords.

### Adding New Models
Extend the `BookmarkCategorizer` class to include additional ML approaches.

### Testing
```bash
# Run tests (add your test files)
pytest tests/
``` 
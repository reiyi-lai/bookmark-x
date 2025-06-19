from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv
import uvicorn

from categorizer import BookmarkCategorizer

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Bookmark ML Categorization Service",
    description="Microservice for AI-powered bookmark categorization",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global categorizer instance
categorizer = None

# Pydantic models
class Category(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

class CategorizeRequest(BaseModel):
    text: str
    categories: List[Category]

class BatchCategorizeRequest(BaseModel):
    texts: List[str]
    categories: List[Category]

class CategorizeResponse(BaseModel):
    category_id: int
    category_name: str
    confidence: float

class BatchCategorizeResponse(BaseModel):
    results: List[CategorizeResponse]

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

@app.on_startup
async def startup_event():
    """Initialize the ML categorizer on startup"""
    global categorizer
    try:
        categorizer = BookmarkCategorizer()
        await categorizer.initialize()
        print("✅ ML Categorizer initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize ML Categorizer: {e}")
        categorizer = None

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if categorizer else "unhealthy",
        service="bookmark-ml-categorizer",
        version="1.0.0"
    )

@app.post("/categorize", response_model=CategorizeResponse)
async def categorize_text(request: CategorizeRequest):
    """Categorize a single text"""
    if not categorizer:
        raise HTTPException(status_code=503, detail="ML Categorizer not available")
    
    try:
        result = await categorizer.categorize(
            text=request.text,
            categories=[cat.dict() for cat in request.categories]
        )
        
        return CategorizeResponse(
            category_id=result["category_id"],
            category_name=result["category_name"],
            confidence=result["confidence"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Categorization failed: {str(e)}")

@app.post("/categorize/batch", response_model=BatchCategorizeResponse)
async def categorize_batch(request: BatchCategorizeRequest):
    """Categorize multiple texts in batch"""
    if not categorizer:
        raise HTTPException(status_code=503, detail="ML Categorizer not available")
    
    try:
        results = await categorizer.categorize_batch(
            texts=request.texts,
            categories=[cat.dict() for cat in request.categories]
        )
        
        return BatchCategorizeResponse(
            results=[
                CategorizeResponse(
                    category_id=result["category_id"],
                    category_name=result["category_name"],
                    confidence=result["confidence"]
                )
                for result in results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch categorization failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV") == "development"
    ) 
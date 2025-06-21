from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging
from contextlib import asynccontextmanager

from database import engine, Base
from routes import bookmarks, users, categories
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up BookmarkX API...")
    try:
        # Initialize database with tables and seed data
        from init_db import init_database
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down BookmarkX API...")

# Create FastAPI app with lifespan
app = FastAPI(
    title="BookmarkX API",
    description="API for managing Twitter bookmarks with AI categorization",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler for SQLAlchemy errors
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error occurred"}
    )

# Include routers
app.include_router(bookmarks.router)
app.include_router(users.router)
app.include_router(categories.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "BookmarkX API"}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "BookmarkX API", 
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

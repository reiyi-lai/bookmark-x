from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import CategoryResponse
from services.bookmark_service import BookmarkService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/categories", tags=["categories"])

@router.get("", response_model=List[CategoryResponse])
async def get_categories(db: Session = Depends(get_db)):
    """Get all categories"""
    try:
        categories = BookmarkService.get_categories(db)
        return categories
    except Exception as error:
        logger.error(f"Error fetching categories: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to fetch categories"
        ) 
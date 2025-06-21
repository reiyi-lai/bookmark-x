from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import (
    BookmarkImportRequest, ImportResponse, BookmarksListResponse, 
    BookmarkUpdateCategory, SuccessResponse, CategoryResponse,
    RecategorizeResponse, ImportStats, RecategorizeStats,
    BookmarkResponse
)
from services.bookmark_service import BookmarkService
from auth import get_current_user_id
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])

@router.post("/import", response_model=ImportResponse)
async def import_bookmarks(
    request: BookmarkImportRequest,
    db: Session = Depends(get_db)
):
    """Import bookmarks from Chrome extension"""
    try:
        if not request.bookmarks:
            raise HTTPException(
                status_code=400, 
                detail="Invalid bookmark data"
            )

        if not request.twitterUser.id:
            raise HTTPException(
                status_code=400, 
                detail="Twitter ID required"
            )

        # Get or create user
        user = BookmarkService.get_or_create_user(
            db, 
            request.twitterUser.id, 
            request.twitterUser.username
        )

        # Process bookmarks and get categories
        processed_bookmarks, categories = await BookmarkService.process_bookmarks(
            request.bookmarks, db
        )

        # Initialize stats
        stats = ImportStats(
            total=len(processed_bookmarks),
            imported=0,
            categorized={cat.id: 0 for cat in categories}
        )

        # Check for existing bookmarks
        tweet_ids = [bookmark.id for bookmark in processed_bookmarks]
        existing_tweet_ids = BookmarkService.check_existing_bookmarks(
            db, user.id, tweet_ids
        )

        # Filter out duplicates
        new_bookmarks = [
            bookmark for bookmark in processed_bookmarks 
            if bookmark.id not in existing_tweet_ids
        ]

        if not new_bookmarks:
                    return ImportResponse(
            success=True,
            stats=ImportStats(
                total=len(processed_bookmarks),
                imported=0,
                categorized={}
            ),
            userId=str(user.id),
            message="All bookmarks already exist"
        )

        logger.info(f"Importing {len(new_bookmarks)} new bookmarks ({len(existing_tweet_ids)} duplicates skipped)")

        # Prepare bookmark data for bulk insert
        bookmark_data_list = []
        for bookmark in new_bookmarks:
            bookmark_data = {
                "tweet_id": bookmark.id,
                "tweet_url": bookmark.url,
                "tweet_content": bookmark.text,
                "author_username": bookmark.author.username,
                "author_display_name": bookmark.author.name,
                "author_profile_picture": bookmark.author.profile_image_url,
                "tweet_date": bookmark.created_at,
                "category_id": bookmark.categoryId,
                "media_attachments": bookmark.media_attachments,
                "user_id": user.id
            }
            bookmark_data_list.append(bookmark_data)

        # Bulk insert bookmarks
        imported_count = BookmarkService.bulk_create_bookmarks(db, bookmark_data_list)
        
        # Calculate category stats
        for bookmark in new_bookmarks:
            category_id = bookmark.categoryId
            if category_id in stats.categorized:
                stats.categorized[category_id] += 1

        stats.imported = imported_count

        return ImportResponse(
            success=True,
            stats=stats,
            userId=str(user.id)
        )

    except Exception as error:
        logger.error(f"Error importing bookmarks: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to import bookmarks"
        )

@router.get("", response_model=BookmarksListResponse)
async def get_bookmarks(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user's bookmarks with category counts"""
    try:
        # Get bookmarks
        bookmarks = BookmarkService.get_user_bookmarks(db, user_id)
        
        # Get category counts
        category_counts = BookmarkService.get_category_counts(db, user_id)

        # Transform bookmarks to response format
        transformed_bookmarks = []
        for bookmark in bookmarks:
            transformed_bookmark = BookmarkResponse(
                id=bookmark.id,
                url=bookmark.tweet_url,
                content=bookmark.tweet_content,
                categoryId=bookmark.category_id,
                tweetId=bookmark.tweet_id,
                authorName=bookmark.author_display_name,
                authorUsername=bookmark.author_username,
                authorProfileImage=bookmark.author_profile_picture,
                createdAt=bookmark.tweet_date,
                bookmarkedAt=bookmark.created_at,
                updatedAt=bookmark.updated_at,
                lastSyncedAt=bookmark.last_synced_at
            )
            transformed_bookmarks.append(transformed_bookmark)

        return BookmarksListResponse(
            bookmarks=transformed_bookmarks,
            categoryCounts=category_counts
        )

    except Exception as error:
        logger.error(f"Error fetching bookmarks: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to fetch bookmarks"
        )

@router.delete("/{bookmark_id}", response_model=SuccessResponse)
async def delete_bookmark(
    bookmark_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a bookmark"""
    try:
        success = BookmarkService.delete_bookmark(db, bookmark_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Bookmark not found"
            )

        return SuccessResponse(success=True)

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting bookmark: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to delete bookmark"
        )

@router.patch("/{bookmark_id}/category", response_model=SuccessResponse)
async def update_bookmark_category(
    bookmark_id: str,
    request: BookmarkUpdateCategory,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update bookmark category"""
    try:
        success = BookmarkService.update_bookmark_category(
            db, bookmark_id, user_id, request.categoryId
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Bookmark not found"
            )

        return SuccessResponse(success=True)

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error updating bookmark category: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to update bookmark category"
        )

@router.post("/recategorize", response_model=RecategorizeResponse)
async def recategorize_bookmarks(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Recategorize all user bookmarks using ML"""
    try:
        # Use ML-powered recategorization
        stats = await BookmarkService.recategorize_all_bookmarks(db, user_id)
        
        return RecategorizeResponse(
            success=True,
            stats=RecategorizeStats(
                total=stats["total"],
                updated=stats["updated"]
            )
        )

    except Exception as error:
        logger.error(f"Error recategorizing bookmarks: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to recategorize bookmarks"
        ) 
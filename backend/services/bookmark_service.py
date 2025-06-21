from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.bookmark import User, Bookmark, Category
from schemas import ImportBookmark, CategoryResponse
from typing import List, Dict, Optional, Tuple
import logging
import asyncio
from .ml_categorizer import get_categorizer

logger = logging.getLogger(__name__)

class BookmarkService:
    @staticmethod
    def get_or_create_user(db: Session, twitter_id: str, twitter_username: Optional[str] = None) -> User:
        """Get existing user or create new one"""
        user = db.query(User).filter(User.twitter_id == twitter_id).first()
        
        if not user:
            # For new users, we'll create them with placeholder email that can be updated later
            user = User(
                twitter_id=twitter_id,
                twitter_username=twitter_username or f"user_{twitter_id[:8]}",
                email=f"placeholder_{twitter_id}@temp.com"  # Placeholder that will be updated
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        return user
    
    @staticmethod
    def get_categories(db: Session) -> List[CategoryResponse]:
        """Get all categories"""
        categories = db.query(Category).all()
        return [CategoryResponse.from_orm(cat) for cat in categories]
    
    @staticmethod
    async def process_bookmarks(bookmarks: List[ImportBookmark], db: Session) -> Tuple[List[ImportBookmark], List[CategoryResponse]]:
        """Process bookmarks and assign categories using ML"""
        # Get categories
        categories = BookmarkService.get_categories(db)
        
        # Categorize bookmarks that don't have a category assigned
        bookmarks_to_categorize = []
        for bookmark in bookmarks:
            if bookmark.categoryId is None:
                bookmarks_to_categorize.append(bookmark)
        
        if bookmarks_to_categorize:
            logger.info(f"Categorizing {len(bookmarks_to_categorize)} bookmarks using ML...")
            
            # Extract content for ML categorization
            contents = [bookmark.text for bookmark in bookmarks_to_categorize]
            
            # Get ML categorizer and categorize in batch
            categorizer = get_categorizer()
            try:
                predicted_categories = await categorizer.categorize_batch([
                    {"tweet_content": content} for content in contents
                ])
                
                # Assign predicted categories
                for bookmark, predicted_category in zip(bookmarks_to_categorize, predicted_categories):
                    bookmark.categoryId = predicted_category
                    logger.debug(f"Assigned category {predicted_category} to bookmark: {bookmark.text[:50]}...")
                    
            except Exception as e:
                logger.error(f"ML categorization failed: {e}")
                # Fallback to default category
                default_category_id = categories[0].id if categories else 1
                for bookmark in bookmarks_to_categorize:
                    bookmark.categoryId = default_category_id
        
        # Ensure all bookmarks have a category
        default_category_id = categories[0].id if categories else 1
        for bookmark in bookmarks:
            if bookmark.categoryId is None:
                bookmark.categoryId = default_category_id
        
        return bookmarks, categories
    
    @staticmethod
    def check_existing_bookmarks(db: Session, user_id: str, tweet_ids: List[str]) -> set:
        """Check which tweet IDs already exist for a user"""
        existing = db.query(Bookmark.tweet_id).filter(
            Bookmark.user_id == user_id,
            Bookmark.tweet_id.in_(tweet_ids)
        ).all()
        
        return set(result.tweet_id for result in existing)
    
    @staticmethod
    def bulk_create_bookmarks(db: Session, bookmarks_data: List[dict]) -> int:
        """Bulk create bookmarks and return count of created records"""
        bookmark_objects = []
        
        for data in bookmarks_data:
            bookmark = Bookmark(**data)
            bookmark_objects.append(bookmark)
        
        db.bulk_save_objects(bookmark_objects)
        db.commit()
        
        return len(bookmark_objects)
    
    @staticmethod
    def get_user_bookmarks(db: Session, user_id: str) -> List[Bookmark]:
        """Get all bookmarks for a user"""
        return db.query(Bookmark).filter(
            Bookmark.user_id == user_id
        ).order_by(Bookmark.created_at.desc()).all()
    
    @staticmethod
    def get_category_counts(db: Session, user_id: str) -> Dict[int, int]:
        """Get bookmark counts by category for a user"""
        counts = db.query(
            Bookmark.category_id,
            db.func.count(Bookmark.id).label('count')
        ).filter(
            Bookmark.user_id == user_id
        ).group_by(Bookmark.category_id).all()
        
        return {category_id: count for category_id, count in counts}
    
    @staticmethod
    def delete_bookmark(db: Session, bookmark_id: str, user_id: str) -> bool:
        """Delete a bookmark if it belongs to the user"""
        result = db.query(Bookmark).filter(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == user_id
        ).delete()
        
        db.commit()
        return result > 0
    
    @staticmethod
    def update_bookmark_category(db: Session, bookmark_id: str, user_id: str, category_id: int) -> bool:
        """Update bookmark category if it belongs to the user"""
        result = db.query(Bookmark).filter(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == user_id
        ).update({"category_id": category_id})
        
        db.commit()
        return result > 0
    
    @staticmethod
    def complete_user_registration(db: Session, user_id: str, email: str) -> bool:
        """Complete user registration by adding email"""
        try:
            # Check if email already exists for a different user
            existing_email = db.query(User).filter(
                User.email == email,
                User.id != user_id
            ).first()
            
            if existing_email:
                raise ValueError("EMAIL_ALREADY_EXISTS")
            
            # Update user
            result = db.query(User).filter(User.id == user_id).update({"email": email})
            db.commit()
            
            return result > 0
        except IntegrityError:
            db.rollback()
            raise ValueError("EMAIL_ALREADY_EXISTS")
    
    @staticmethod
    async def recategorize_all_bookmarks(db: Session, user_id: str) -> Dict[str, int]:
        """Recategorize all bookmarks for a user using ML"""
        try:
            # Get all user bookmarks
            bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user_id).all()
            
            if not bookmarks:
                logger.info(f"No bookmarks found for user {user_id}")
                return {"total": 0, "updated": 0}
            
            logger.info(f"Recategorizing {len(bookmarks)} bookmarks for user {user_id}")
            
            # Extract content for ML categorization
            contents = [bookmark.tweet_content for bookmark in bookmarks]
            
            # Get ML predictions
            categorizer = get_categorizer()
            predicted_categories = await categorizer.categorize_batch([
                {"tweet_content": content} for content in contents
            ])
            
            logger.info(f"ML categorization complete, got {len(predicted_categories)} predictions")
            
            # Prepare bulk updates
            updates_to_make = []
            updated_count = 0
            changes_made = []
            
            for i, (bookmark, new_category_id) in enumerate(zip(bookmarks, predicted_categories)):
                old_category_id = bookmark.category_id
                if old_category_id != new_category_id:
                    logger.debug(f"Updating bookmark {bookmark.id}: category {old_category_id} -> {new_category_id}")
                    
                    # Prepare bulk update data
                    updates_to_make.append({
                        "id": bookmark.id,
                        "category_id": new_category_id
                    })
                    
                    updated_count += 1
                    changes_made.append({
                        "bookmark_id": str(bookmark.id),
                        "old_category": old_category_id,
                        "new_category": new_category_id,
                        "content": bookmark.tweet_content[:50] + "..."
                    })
                else:
                    logger.debug(f"Bookmark {bookmark.id}: category unchanged ({old_category_id})")
            
            # Perform bulk update if there are changes
            if updated_count > 0:
                logger.info(f"Performing bulk update for {updated_count} bookmarks...")
                
                # Use SQLAlchemy's bulk_update_mappings for maximum performance
                db.bulk_update_mappings(Bookmark, updates_to_make)
                
                # Single commit for all updates
                db.commit()
                logger.info(f"Successfully bulk updated {updated_count} bookmarks in database")
                
                # Log some sample changes for debugging
                for change in changes_made[:5]:  # Log first 5 changes
                    logger.info(f"Updated: {change}")
            else:
                logger.info("No category changes needed - all bookmarks already have correct categories")
            
            logger.info(f"Recategorization complete: {updated_count}/{len(bookmarks)} bookmarks updated")
            
            return {
                "total": len(bookmarks),
                "updated": updated_count
            }
            
        except Exception as e:
            logger.error(f"Recategorization failed: {e}")
            db.rollback()
            raise 
#!/usr/bin/env python3
"""
Test script to verify database updates are working correctly
"""

import os
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.bookmark import Bookmark, User
from services.bookmark_service import BookmarkService
from config import Settings

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def test_database_connection():
    """Test basic database connectivity"""
    try:
        settings = Settings()
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        with SessionLocal() as db:
            # Test basic query
            user_count = db.query(User).count()
            bookmark_count = db.query(Bookmark).count()
            
            print(f"✅ Database connection successful!")
            print(f"📊 Users: {user_count}, Bookmarks: {bookmark_count}")
            
            # Get a sample user with bookmarks
            user_with_bookmarks = db.query(User).join(Bookmark).first()
            if user_with_bookmarks:
                print(f"👤 Sample user: {user_with_bookmarks.twitter_username} ({user_with_bookmarks.id})")
                
                # Get their bookmarks with categories
                bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user_with_bookmarks.id).limit(5).all()
                print(f"📚 Sample bookmarks:")
                for bookmark in bookmarks:
                    print(f"   - ID: {bookmark.id}, Category: {bookmark.category_id}, Content: {bookmark.tweet_content[:50]}...")
                
                return str(user_with_bookmarks.id)
            else:
                print("❌ No user with bookmarks found")
                return None
                
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

async def test_recategorization(user_id: str):
    """Test the recategorization process"""
    try:
        settings = Settings()
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        with SessionLocal() as db:
            print(f"\n🔄 Testing recategorization for user {user_id}")
            
            # Get bookmarks before
            bookmarks_before = db.query(Bookmark).filter(Bookmark.user_id == user_id).limit(10).all()
            print(f"📊 Before recategorization:")
            for bookmark in bookmarks_before:
                print(f"   - ID: {bookmark.id}, Category: {bookmark.category_id}")
            
            # Run recategorization
            stats = await BookmarkService.recategorize_all_bookmarks(db, user_id)
            print(f"📈 Recategorization stats: {stats}")
            
            # Get bookmarks after (fresh query)
            db.expire_all()  # Clear session cache
            bookmarks_after = db.query(Bookmark).filter(Bookmark.user_id == user_id).limit(10).all()
            print(f"📊 After recategorization:")
            for bookmark in bookmarks_after:
                print(f"   - ID: {bookmark.id}, Category: {bookmark.category_id}")
            
            # Compare changes
            changes = 0
            for before, after in zip(bookmarks_before, bookmarks_after):
                if before.category_id != after.category_id:
                    changes += 1
                    print(f"✅ Changed: {before.id} from {before.category_id} to {after.category_id}")
            
            print(f"🎯 Total changes detected: {changes}")
            return changes > 0
            
    except Exception as e:
        print(f"❌ Recategorization test failed: {e}")
        return False

async def main():
    print("🧪 Testing Database Updates")
    print("=" * 50)
    
    # Test database connection
    user_id = test_database_connection()
    
    if user_id:
        # Test recategorization
        success = await test_recategorization(user_id)
        
        if success:
            print("\n✅ Database update test PASSED!")
        else:
            print("\n❌ Database update test FAILED!")
    else:
        print("\n❌ Cannot run tests - no database connection or data")

if __name__ == "__main__":
    asyncio.run(main()) 
"""
Database initialization script
Creates tables and seeds initial data only if they don't exist
"""
from sqlalchemy import create_engine, inspect
from database import Base
from models.bookmark import User, Category, Bookmark
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """Initialize database with tables and seed data"""
    engine = create_engine(settings.DATABASE_URL)
    
    # Check if tables already exist
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    # Only create tables if they don't exist
    tables_to_create = ['users', 'categories', 'bookmarks']
    missing_tables = [table for table in tables_to_create if table not in existing_tables]
    
    if missing_tables:
        logger.info(f"Creating missing tables: {missing_tables}")
        Base.metadata.create_all(bind=engine)
    else:
        logger.info("All database tables already exist, skipping creation")
    
    # Seed categories
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if categories already exist
        existing_categories = db.query(Category).count()
        if existing_categories > 0:
            logger.info(f"Categories already exist ({existing_categories} found)")
            return
        
        # Seed initial categories with color values (hex colors)
        categories = [
            Category(id=1, name="Technology", description="Tech news, programming, AI, and software", color="#3B82F6"),
            Category(id=2, name="Business", description="Business news, entrepreneurship, and finance", color="#10B981"),
            Category(id=3, name="Entertainment", description="Movies, TV shows, music, and celebrity news", color="#F59E0B"),
            Category(id=4, name="Sports", description="Sports news, games, and athlete updates", color="#EF4444"),
            Category(id=5, name="Science", description="Scientific discoveries, research, and academic content", color="#8B5CF6"),
            Category(id=6, name="Politics", description="Political news, government, and policy discussions", color="#6B7280"),
            Category(id=7, name="Health", description="Health tips, medical news, and wellness content", color="#06B6D4"),
            Category(id=8, name="Education", description="Learning resources, courses, and educational content", color="#84CC16"),
            Category(id=9, name="Travel", description="Travel guides, destinations, and adventure stories", color="#F97316"),
            Category(id=10, name="Food", description="Recipes, restaurant reviews, and culinary content", color="#EC4899"),
            Category(id=11, name="Art & Design", description="Creative work, design inspiration, and artistic content", color="#A855F7"),
            Category(id=12, name="Personal Development", description="Self-improvement, productivity, and life advice", color="#14B8A6"),
            Category(id=13, name="News", description="Breaking news, current events, and journalism", color="#DC2626"),
            Category(id=14, name="Humor", description="Funny content, memes, and comedy", color="#FBBF24"),
            Category(id=15, name="Other", description="Miscellaneous content that doesn't fit other categories", color="#9CA3AF")
        ]
        
        db.add_all(categories)
        db.commit()
        logger.info(f"Successfully seeded {len(categories)} categories")
        
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_database() 
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=func.gen_random_uuid())
    twitter_id = Column(String, unique=True, nullable=False)
    twitter_username = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationship
    bookmarks = relationship("Bookmark", back_populates="user")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    
    # Relationship
    bookmarks = relationship("Bookmark", back_populates="category")

class Bookmark(Base):
    __tablename__ = "bookmarks"
    
    id = Column(String, primary_key=True, default=func.gen_random_uuid())
    tweet_id = Column(String, nullable=False)
    tweet_url = Column(String, nullable=False)
    tweet_content = Column(Text, nullable=False)
    author_username = Column(String, nullable=False)
    author_display_name = Column(String, nullable=False)
    author_profile_picture = Column(String, nullable=True)
    tweet_date = Column(DateTime, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    media_attachments = Column(JSON, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_synced_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="bookmarks")
    category = relationship("Category", back_populates="bookmarks")

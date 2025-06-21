from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# User schemas
class TwitterUser(BaseModel):
    id: str
    username: Optional[str] = None

class UserCreate(BaseModel):
    twitter_id: str
    twitter_username: str
    email: EmailStr

class UserCompleteRegistration(BaseModel):
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    twitter_id: str
    twitter_username: str
    email: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Category schemas
class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Bookmark schemas
class BookmarkAuthor(BaseModel):
    username: str
    name: str
    profile_image_url: Optional[str] = None

class ImportBookmark(BaseModel):
    id: str
    url: str
    text: str
    author: BookmarkAuthor
    created_at: datetime
    media_attachments: Optional[List[Dict[str, Any]]] = None
    categoryId: Optional[int] = None

class BookmarkImportRequest(BaseModel):
    bookmarks: List[ImportBookmark]
    twitterUser: TwitterUser

class BookmarkResponse(BaseModel):
    id: str
    url: str
    content: str
    categoryId: int
    tweetId: str
    authorName: str
    authorUsername: str
    authorProfileImage: Optional[str]
    createdAt: datetime
    bookmarkedAt: datetime
    updatedAt: Optional[datetime] = None
    lastSyncedAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class BookmarkUpdateCategory(BaseModel):
    categoryId: int

class BookmarksListResponse(BaseModel):
    bookmarks: List[BookmarkResponse]
    categoryCounts: Dict[int, int]

# Import response schemas
class ImportStats(BaseModel):
    total: int
    imported: int
    categorized: Dict[int, int]

class ImportResponse(BaseModel):
    success: bool
    stats: ImportStats
    userId: str
    message: Optional[str] = None

class RecategorizeStats(BaseModel):
    total: int
    updated: int

class RecategorizeResponse(BaseModel):
    success: bool
    stats: RecategorizeStats

# Generic response schemas
class SuccessResponse(BaseModel):
    success: bool
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str
    title: Optional[str] = None
    message: Optional[str] = None 
from fastapi import HTTPException, Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.bookmark import User

def get_current_user_id(
    x_twitter_id: Optional[str] = Header(None, alias="x-twitter-id"),
    db: Session = Depends(get_db)
) -> str:
    """
    Extract user ID from request headers.
    Looks for x-twitter-id header and returns the corresponding user ID.
    """
    if not x_twitter_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # Get user by twitter_id
    user = db.query(User).filter(User.twitter_id == x_twitter_id).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user.id

def get_optional_user_id(
    x_twitter_id: Optional[str] = Header(None, alias="x-twitter-id"),
    db: Session = Depends(get_db)
) -> Optional[str]:
    """
    Optionally extract user ID from request headers.
    Returns None if no valid user is found.
    """
    if not x_twitter_id:
        return None
    
    # Get user by twitter_id
    user = db.query(User).filter(User.twitter_id == x_twitter_id).first()
    
    return user.id if user else None 
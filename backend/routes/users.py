from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from schemas import UserCompleteRegistration, SuccessResponse, ErrorResponse
from services.bookmark_service import BookmarkService
from models.bookmark import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/{user_id}/complete-registration", response_model=SuccessResponse)
async def complete_user_registration(
    user_id: str,
    request: UserCompleteRegistration,
    db: Session = Depends(get_db)
):
    """Complete user registration with email"""
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=404, 
                detail="User not found"
            )

        # Check if user already has email
        if user.email:
            raise HTTPException(
                status_code=400, 
                detail="User already has an email registered"
            )

        # Try to complete registration
        try:
            success = BookmarkService.complete_user_registration(
                db, user_id, request.email
            )
            
            if not success:
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to complete registration"
                )

            return SuccessResponse(
                success=True,
                message="Registration completed successfully"
            )

        except ValueError as e:
            if str(e) == "EMAIL_ALREADY_EXISTS":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "EMAIL_ALREADY_EXISTS",
                        "title": "Enter another email",
                        "message": "Email already exists under another x.com account"
                    }
                )
            raise

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error completing registration: {error}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to complete registration"
        ) 
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .cookies import SESSION_COOKIE, clear_session_cookies, set_session_cookies
from .db import get_db
from .limiter import limiter
from .models import User
from .security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["auth"])

# Lazy dummy hash — used to equalize bcrypt timing on login so an attacker
# can't tell "user doesn't exist" from "wrong password" via response time.
_DUMMY_HASH: str | None = None


def _get_dummy_hash() -> str:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("__not_a_real_password__")
    return _DUMMY_HASH


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    is_active: bool
    created_at: datetime


# ── Current-user dependency ───────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise credentials_exc

    try:
        payload = decode_access_token(token)
    except ValueError:
        raise credentials_exc

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exc

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise credentials_exc

    user = await db.get(User, user_uuid)
    if user is None or not user.is_active:
        raise credentials_exc

    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    body: RegisterIn,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    await db.refresh(user)

    # Registration logs the user straight in (cookie session).
    set_session_cookies(response, create_access_token(subject=str(user.id)))
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginIn,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is not None and user.hashed_password is not None:
        valid = verify_password(body.password, user.hashed_password)
    else:
        # No user, or an OAuth-only account with no local password — run the
        # dummy hash so response timing doesn't leak which case it was.
        verify_password(body.password, _get_dummy_hash())
        valid = False

    if not valid or not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    set_session_cookies(response, create_access_token(subject=str(user.id)))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookies(response)
    return response


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user

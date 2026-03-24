from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import os

IS_VERCEL = os.getenv("VERCEL") == "1"

if IS_VERCEL:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/automanual.db")
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./storage/automanual.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get DB session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and perform simple migrations"""
    if not IS_VERCEL:
        # Ensure local storage directory exists
        os.makedirs("storage/screenshots", exist_ok=True)
        os.makedirs("storage/docs", exist_ok=True)
        os.makedirs("storage/logos", exist_ok=True)
    else:
        # On Vercel, we can only really use /tmp
        os.makedirs("/tmp/screenshots", exist_ok=True)
        os.makedirs("/tmp/docs", exist_ok=True)
        
    print("[DATABASE] Performing hard reset of schema to fix missing columns...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("[DATABASE] Schema reset complete.")

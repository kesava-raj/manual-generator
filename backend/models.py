from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    github_id = Column(String, unique=True, nullable=False)
    username = Column(String, nullable=False)
    email = Column(String, default="")
    avatar_url = Column(String, default="")
    access_token = Column(String, default="")  # GitHub access token
    created_at = Column(DateTime, default=utcnow)

    runs = relationship("Run", back_populates="user")


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    url = Column(String, nullable=False)
    username_cred = Column(String, default="")
    status = Column(String, default="pending")  # pending, running, completed, failed
    total_steps = Column(Integer, default=0)
    github_repo = Column(String, default="")  # linked repo (owner/name)
    logo_path = Column(String, nullable=True)
    mode = Column(String, default="dual")  # user, tech, dual
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="runs")
    steps = relationship("Step", back_populates="run", order_by="Step.step_number")


class Step(Base):
    __tablename__ = "steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    description = Column(Text, default="")
    ai_reasoning = Column(Text, default="")  # Claude's thought process
    url = Column(String, default="")
    screenshot_path = Column(String, default="")
    source_file = Column(String, default="")  # mapped source code file
    mapped_code = Column(Text, default="")  # technical source snippet
    created_at = Column(DateTime, default=utcnow)

    run = relationship("Run", back_populates="steps")

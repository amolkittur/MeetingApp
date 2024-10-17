from sqlalchemy import create_engine, Column, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./meeting_app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AudioFile(Base):
    __tablename__ = "audio_files"

    filename = Column(String, primary_key=True, index=True)
    filepath = Column(String, nullable=False)
    duration = Column(Float, nullable=False)
    upload_time = Column(DateTime, nullable=False)
    transcript_path = Column(String, nullable=True)
    transcription_status = Column(String, nullable=False)
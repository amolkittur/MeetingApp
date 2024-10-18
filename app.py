from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from db import SessionLocal, engine, Base, AudioFile
import assemblyai as aai
import os
import ffmpeg as ffmpeg_tools
import shutil
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError
import uuid
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import Optional, List
import json
from sqlalchemy import or_
from agents.pattern_agent import PatternAgent

load_dotenv()


# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

UPLOAD_DIRECTORY = "static/uploads"
AUDIO_DIRECTORY = os.path.join(UPLOAD_DIRECTORY, "audio")
TRANSCRIPT_DIRECTORY = os.path.join(UPLOAD_DIRECTORY, "transcripts")

os.makedirs(AUDIO_DIRECTORY, exist_ok=True)
os.makedirs(TRANSCRIPT_DIRECTORY, exist_ok=True)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
async def serve_home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    create_transcript: bool = Form(...),
    department: str = Form(...),
    language: str = Form(...),  # This will be a JSON string
    db: Session = Depends(get_db)
):
    try:
        # Parse the JSON string back into a list
        languages = json.loads(language)

        # Original filename from the user
        original_filename = os.path.basename(file.filename)

        # Generate a unique filename for storage
        unique_filename = f"{uuid.uuid4()}.mp3"
        mp3_file_path = os.path.join(AUDIO_DIRECTORY, unique_filename)

        # Save the uploaded file temporarily
        temp_file_path = os.path.join(AUDIO_DIRECTORY, f"temp_{unique_filename}")
        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Convert to mp3 if necessary
        if not original_filename.lower().endswith(".mp3"):
            # Convert file to mp3 format
            ffmpeg_tools.input(temp_file_path).output(mp3_file_path).run()
            os.remove(temp_file_path)  # Remove the temp file
        else:
            os.rename(temp_file_path, mp3_file_path)

        # Extract metadata
        duration = get_audio_duration(mp3_file_path)
        upload_time = datetime.now(timezone.utc)

        # Join multiple languages into a comma-separated string for storage
        languages_str = ",".join(languages)

        # Save metadata in the database
        audio_file_entry = AudioFile(
            filename=unique_filename,
            original_filename=original_filename,
            filepath=mp3_file_path,
            duration=duration,
            upload_time=upload_time,
            transcript_path=None,
            transcription_status="pending" if create_transcript else "not_requested",
            department=department,
            language=languages_str,  # Store as comma-separated string
        )
        db.add(audio_file_entry)
        db.commit()
        db.refresh(audio_file_entry)

        # Generate transcript if requested
        if create_transcript:
            transcript_text = await generate_transcript(mp3_file_path)
            if transcript_text:
                transcript_filename = f"{unique_filename}.txt"
                transcript_path = os.path.join(TRANSCRIPT_DIRECTORY, transcript_filename)
                with open(transcript_path, "w") as transcript_file:
                    transcript_file.write(transcript_text)
                audio_file_entry.transcript_path = transcript_path
                audio_file_entry.transcription_status = "completed"
            else:
                audio_file_entry.transcription_status = "failed"
            db.commit()

        return {"message": "File uploaded successfully", "filename": original_filename}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

async def generate_transcript(file_path: str):
    try:
        # Use AssemblyAI API to generate transcript
        config = aai.TranscriptionConfig(speaker_labels=True)
        transcriber = aai.Transcriber(config=config)
        transcript = transcriber.transcribe(file_path)
        
        # Format the transcript with speaker labels
        formatted_transcript = ""
        for utterance in transcript.utterances:
            formatted_transcript += f"Speaker {utterance.speaker}: {utterance.text}\n\n"
        
        return formatted_transcript
    except Exception as e:
        print(f"Error generating transcript: {e}")
        return None

def get_audio_duration(file_path: str):
    try:
        probe = ffmpeg_tools.probe(file_path)
        duration = float(probe['format']['duration'])
        return duration
    except Exception as e:
        print(f"Error extracting audio duration: {e}")
        return 0.0

@app.get("/list-audio-files")
async def list_audio_files(
    page: int = 1,
    page_size: int = 5,
    department: Optional[str] = None,
    language: Optional[str] = None,
    filename: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AudioFile)

    # Apply filters if provided
    if department:
        departments = [dep.strip() for dep in department.split(',')]
        query = query.filter(AudioFile.department.in_(departments))
    if language:
        languages = [lang.strip().lower() for lang in language.split(',')]
        language_filters = [AudioFile.language.like(f"%{lang}%") for lang in languages]
        query = query.filter(or_(*language_filters))
    if filename:
        query = query.filter(AudioFile.original_filename.ilike(f"%{filename}%"))

    total_files = query.count()
    audio_files = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "recordings": [
            {
                "id": file.id,
                "filename": file.filename,
                "original_filename": file.original_filename,
                "duration": file.duration,
                "upload_time": file.upload_time,
                "transcription_status": file.transcription_status,
                "department": file.department,
                "language": file.language,
            }
            for file in audio_files
        ],
        "has_previous": page > 1,
        "has_next": (page * page_size) < total_files
    }


@app.get("/serve-audio/{file_id}")
async def serve_audio(file_id: int = Path(..., description="The ID of the audio file"), db: Session = Depends(get_db)):
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=audio_file.filepath,
        media_type='audio/mpeg',
        filename=audio_file.original_filename  # Optional: Helps with downloads
    )



@app.get("/get-audio-details/{file_id}")
async def get_audio_details(file_id: int, db: Session = Depends(get_db)):
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    transcript_text = ""
    if audio_file.transcript_path and os.path.exists(audio_file.transcript_path):
        with open(audio_file.transcript_path, 'r') as file:
            transcript_text = file.read()
    return {
        "filename": audio_file.filename,
        "original_filename": audio_file.original_filename,
        "transcript": transcript_text
    }



# Endpoint to delete an audio file and its metadata
@app.delete("/delete-audio/{file_id}")
async def delete_audio(file_id: int, db: Session = Depends(get_db)):
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove audio file and transcript from the filesystem
    if os.path.exists(audio_file.filepath):
        os.remove(audio_file.filepath)
    if audio_file.transcript_path and os.path.exists(audio_file.transcript_path):
        os.remove(audio_file.transcript_path)

    # Remove entry from the database
    db.delete(audio_file)
    db.commit()

    return {"message": "Audio file and its transcript deleted successfully"}



#copy the transcript to the clipboard button
#add another layer of meta tags like language, speaker tags, timestamps, etc.
#audio naming
#upload all the previous recordings
#add search functionality
#integrate with hakuna matata

# Add this new endpoint
@app.post("/generate-patterns")
async def generate_patterns(request: Request):
    data = await request.json()
    transcript = data.get("transcript")
    patterns = data.get("patterns")
    
    if not transcript or not patterns:
        raise HTTPException(status_code=400, detail="Transcript and patterns are required")
    
    pattern_agent = PatternAgent(transcript, patterns)
    results = await pattern_agent.process_patterns()
    
    return {"results": results}

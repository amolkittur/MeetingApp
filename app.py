from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
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
    db: Session = Depends(get_db)
):
    try:
        # Generate a unique filename
        original_filename = file.filename
        unique_filename = f"{uuid.uuid4()}_{original_filename}"
        
        # Save the audio file locally with the unique filename
        original_file_path = os.path.join(AUDIO_DIRECTORY, unique_filename)
        with open(original_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Convert to mp3 if necessary
        mp3_filename = f"{os.path.splitext(unique_filename)[0]}.mp3"
        mp3_file_path = os.path.join(AUDIO_DIRECTORY, mp3_filename)

        if not original_filename.lower().endswith(".mp3"):
            # Convert file to mp3 format
            ffmpeg_tools.input(original_file_path).output(mp3_file_path).run()
            os.remove(original_file_path)  # Remove the original file to save space
        else:
            mp3_file_path = original_file_path

        # Extract metadata (e.g., duration)
        duration = get_audio_duration(mp3_file_path)
        upload_time = datetime.now(timezone.utc)

        # Save metadata in the database
        audio_file_entry = AudioFile(
            filename=mp3_filename,
            filepath=mp3_file_path,
            duration=duration,
            upload_time=upload_time,
            transcript_path=None,
            transcription_status="pending" if create_transcript else "not_requested",
        )
        db.add(audio_file_entry)
        db.commit()
        db.refresh(audio_file_entry)

        # Generate transcript if requested
        if create_transcript:
            transcript_text = await generate_transcript(mp3_file_path)
            if transcript_text:
                transcript_filename = f"{mp3_filename}.txt"
                transcript_path = os.path.join(TRANSCRIPT_DIRECTORY, transcript_filename)
                with open(transcript_path, "w") as transcript_file:
                    transcript_file.write(transcript_text)
                audio_file_entry.transcript_path = transcript_path
                audio_file_entry.transcription_status = "completed"
            else:
                audio_file_entry.transcription_status = "failed"
            db.commit()

        return {"message": "File uploaded successfully", "filename": mp3_filename}

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="A file with this name already exists")
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
async def list_audio_files(page: int = 1, page_size: int = 5, db: Session = Depends(get_db)):
    total_files = db.query(AudioFile).count()
    audio_files = db.query(AudioFile).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "recordings": [
            {
                "filename": file.filename,
                "duration": file.duration,
                "upload_time": file.upload_time,
                "transcription_status": file.transcription_status,
            }
            for file in audio_files
        ],
        "has_previous": page > 1,
        "has_next": (page * page_size) < total_files
    }

@app.get("/serve-audio/{filename}")
async def serve_audio(filename: str):
    file_path = os.path.join(AUDIO_DIRECTORY, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.get("/get-transcript/{filename}")
async def get_transcript(filename: str, db: Session = Depends(get_db)):
    audio_file = db.query(AudioFile).filter(AudioFile.filename == filename).first()
    if not audio_file or not audio_file.transcript_path or not os.path.exists(audio_file.transcript_path):
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    with open(audio_file.transcript_path, 'r') as file:
        transcript_text = file.read()
    
    return {"transcript": transcript_text}

# Endpoint to delete an audio file and its metadata
@app.delete("/delete-audio/{filename}")
async def delete_audio(filename: str, db: Session = Depends(get_db)):
    audio_file = db.query(AudioFile).filter(AudioFile.filename == filename).first()
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
# python_engine/api.py
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request
import uvicorn
import os
import shutil
import aiofiles
from datetime import datetime
import json
from pathlib import Path
import asyncio
import gc
import pandas as pd

# Import your existing scripts
from excel_bot import process_report_316, process_report_316_large_file
from import_master import import_agent_master
from database import supabase

app = FastAPI(title="SuperAchiever Data Processing API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Create necessary directories
UPLOAD_DIR = Path("uploads")
DAILY_SUBMISSIONS_DIR = Path("../data/daily_submissions")
UPLOAD_DIR.mkdir(exist_ok=True)
DAILY_SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

# History file to track uploads
HISTORY_FILE = UPLOAD_DIR / "history.json"

# Processing status tracking
processing_status = {}

# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB in bytes

# --- Helper Functions ---

def load_history():
    """Load upload history from JSON file"""
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    return []

def save_history(history):
    """Save upload history to JSON file"""
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history[-50:], f)

def add_to_history(entry):
    """Add an entry to upload history"""
    history = load_history()
    history.insert(0, entry)
    save_history(history)

def format_file_size(size_bytes):
    """Format file size in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

def parse_entry_month(value, submission_date=None):
    """
    Parse Entry Month from Excel to get first day of the month
    Handles month abbreviations: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
    Returns date in YYYY-MM-DD format (first day of the month)
    """
    if not value or pd.isna(value):
        return None
    
    # Month abbreviation mapping
    month_map = {
        'JAN': 1, 'JANUARY': 1,
        'FEB': 2, 'FEBRUARY': 2,
        'MAR': 3, 'MARCH': 3,
        'APR': 4, 'APRIL': 4,
        'MAY': 5,
        'JUN': 6, 'JUNE': 6,
        'JUL': 7, 'JULY': 7,
        'AUG': 8, 'AUGUST': 8,
        'SEP': 9, 'SEPTEMBER': 9,
        'OCT': 10, 'OCTOBER': 10,
        'NOV': 11, 'NOVEMBER': 11,
        'DEC': 12, 'DECEMBER': 12,
    }
    
    try:
        # If it's already a datetime object
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.replace(day=1).date().isoformat()
        
        # Convert to string and clean
        value_str = str(value).strip().upper()
        
        # Check if it's a month abbreviation or full month name
        if value_str in month_map:
            month_num = month_map[value_str]
            
            # Try to get year from submission_date if available
            year = None
            if submission_date and not pd.isna(submission_date):
                if isinstance(submission_date, (datetime, pd.Timestamp)):
                    year = submission_date.year
                else:
                    try:
                        sub_date = pd.to_datetime(submission_date)
                        year = sub_date.year
                    except:
                        pass
            
            # Fallback to current year
            if not year:
                year = datetime.now().year
            
            entry_month_date = datetime(year, month_num, 1)
            return entry_month_date.date().isoformat()
        
        # Try YYYY-MM-DD format
        if len(value_str) == 10 and value_str.count('-') == 2:
            parsed = datetime.strptime(value_str, '%Y-%m-%d')
            return parsed.replace(day=1).date().isoformat()
        
        # Try YYYY-MM format
        if len(value_str) == 7 and value_str.count('-') == 1:
            parsed = datetime.strptime(value_str, '%Y-%m')
            return parsed.replace(day=1).date().isoformat()
        
        # Try MM/DD/YYYY or MM/YYYY
        if '/' in value_str:
            parts = value_str.split('/')
            if len(parts) == 3:  # MM/DD/YYYY
                parsed = datetime.strptime(value_str, '%m/%d/%Y')
                return parsed.replace(day=1).date().isoformat()
            elif len(parts) == 2:  # MM/YYYY
                parsed = datetime.strptime(value_str, '%m/%Y')
                return parsed.replace(day=1).date().isoformat()
        
        # Try Month YYYY (e.g., "Jan 2024" or "January 2024")
        try:
            parsed = datetime.strptime(value_str, '%b %Y')
            return parsed.replace(day=1).date().isoformat()
        except:
            pass
        
        try:
            parsed = datetime.strptime(value_str, '%B %Y')
            return parsed.replace(day=1).date().isoformat()
        except:
            pass
        
        # Try YYYYMMDD format
        if value_str.isdigit() and len(value_str) == 8:
            parsed = datetime.strptime(value_str, '%Y%m%d')
            return parsed.replace(day=1).date().isoformat()
        
        # Try YYYYMM format
        if value_str.isdigit() and len(value_str) == 6:
            parsed = datetime.strptime(value_str, '%Y%m')
            return parsed.replace(day=1).date().isoformat()
        
        # If it's a numeric value (Excel serial date)
        if isinstance(value, (int, float)):
            from datetime import timedelta
            excel_base = datetime(1899, 12, 30)
            parsed = excel_base + timedelta(days=value)
            return parsed.replace(day=1).date().isoformat()
        
    except Exception as e:
        print(f"⚠️ Error parsing Entry Month '{value}': {e}")
    
    return None

# --- OPTIONS Handlers ---
@app.options("/api/health")
@app.options("/api/stats")
@app.options("/api/process-report-316")
@app.options("/api/import-agent-master")
@app.options("/api/history")
@app.options("/api/download-latest/{filename}")
@app.options("/api/processing-status/{job_id}")
@app.options("/api/recent-cases")
@app.options("/api/total-production")
async def options_handler(request: Request):
    """Handle OPTIONS requests for CORS preflight"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "600",
        }
    )

# --- API Endpoints ---

@app.get("/")
async def root():
    return {
        "message": "SuperAchiever Data Processing API",
        "status": "running",
        "endpoints": [
            "/api/health",
            "/api/stats",
            "/api/total-production",
            "/api/process-report-316",
            "/api/import-agent-master",
            "/api/history",
            "/api/download-latest/{filename}",
            "/api/processing-status/{job_id}",
            "/api/recent-cases"
        ]
    }

@app.get("/api/health")
async def health_check():
    """Check if API is running and Supabase is connected"""
    try:
        result = supabase.table("profiles").select("count", count="exact").limit(1).execute()
        return {
            "status": "healthy",
            "supabase": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "degraded",
            "supabase": f"error: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/total-production")
async def get_total_production():
    """Get total production from ALL cases - matches dashboard exactly"""
    try:
        # First, get total count
        count_result = supabase.table("cases").select("*", count="exact").execute()
        total_count = count_result.count if hasattr(count_result, 'count') else 0
        
        # Fetch ALL cases using pagination
        all_premiums = []
        page = 0
        page_size = 1000
        has_more = True

        while has_more:
            result = supabase.table("cases") \
                .select("premium") \
                .range(page * page_size, (page + 1) * page_size - 1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                all_premiums.extend(result.data)
                page += 1
                print(f"📊 API fetched page {page}: {len(result.data)} records (total so far: {len(all_premiums)})")
            
            if not result.data or len(result.data) < page_size:
                has_more = False

        print(f"📊 API total-production: fetched {len(all_premiums)} cases")
        
        total = sum(item['premium'] or 0 for item in all_premiums)
        count = len(all_premiums)
        
        print(f"📊 Total production from API: {total} across {count} cases")
        
        return {
            "total": total,
            "count": count
        }
    except Exception as e:
        print(f"❌ Error getting total production: {e}")
        return {
            "total": 0,
            "count": 0
        }

@app.get("/api/stats")
async def get_stats():
    """Get dashboard statistics"""
    try:
        print("📊 Fetching dashboard stats...")
        
        # Get total agents from profiles
        try:
            agent_result = supabase.table("profiles").select("*", count="exact").execute()
            total_agents = agent_result.count if hasattr(agent_result, 'count') else 0
            print(f"  ✅ Agents: {total_agents}")
        except Exception as e:
            print(f"  ❌ Error fetching agents: {str(e)}")
            total_agents = 0
        
        # Get total cases
        try:
            cases_result = supabase.table("cases").select("*", count="exact").execute()
            total_cases = cases_result.count if hasattr(cases_result, 'count') else 0
            print(f"  ✅ Cases: {total_cases}")
        except Exception as e:
            print(f"  ❌ Error fetching cases: {str(e)}")
            total_cases = 0
        
        # Get latest case
        last_updated = None
        try:
            latest_case = supabase.table("cases") \
                .select("submission_date_timestamp") \
                .order("submission_date_timestamp", desc=True) \
                .limit(1) \
                .execute()
            
            if latest_case.data and len(latest_case.data) > 0:
                last_updated = latest_case.data[0]['submission_date_timestamp']
                print(f"  ✅ Last updated (timestamp): {last_updated}")
        except Exception as e:
            print(f"  ⚠️ Error getting last updated: {e}")
        
        return {
            "totalAgents": total_agents,
            "totalCases": total_cases,
            "lastUpdated": last_updated,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Unexpected error in /api/stats: {str(e)}")
        return {
            "totalAgents": 0,
            "totalCases": 0,
            "lastUpdated": None,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@app.post("/api/process-report-316")
async def process_report_316_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Process Report 316 Excel file with support for large files and XLSB format"""
    # Allow .xlsx, .xls, and .xlsb files
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsb')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload .xlsx, .xls, or .xlsb file")
    
    # Check content length if available
    if file.size and file.size > MAX_FILE_SIZE:
        size_str = format_file_size(file.size)
        max_size_str = format_file_size(MAX_FILE_SIZE)
        raise HTTPException(
            status_code=413, 
            detail=f"File too large ({size_str}). Maximum size is {max_size_str}"
        )
    
    try:
        # Save uploaded file with progress tracking
        file_path = UPLOAD_DIR / file.filename
        total_size = 0
        
        print(f"📥 Receiving file: {file.filename}")
        
        # Use aiofiles for efficient async file writing
        async with aiofiles.open(file_path, 'wb') as buffer:
            while chunk := await file.read(1024 * 1024):  # Read 1MB chunks
                total_size += len(chunk)
                
                # Check size during upload
                if total_size > MAX_FILE_SIZE:
                    await buffer.close()
                    os.remove(file_path)
                    size_str = format_file_size(total_size)
                    max_size_str = format_file_size(MAX_FILE_SIZE)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large ({size_str}). Maximum size is {max_size_str}"
                    )
                
                await buffer.write(chunk)
        
        file_size_mb = total_size / (1024 * 1024)
        print(f"✅ File saved: {file.filename} ({file_size_mb:.2f}MB)")
        
        # Generate a unique job ID
        job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Determine processing method based on file size
        use_large_file_processor = file_size_mb > 50  # Use large file processor for files > 50MB
        
        # Process in background
        background_tasks.add_task(
            process_report_316_background,
            job_id,
            str(file_path),
            file.filename,
            file_size_mb,
            use_large_file_processor
        )
        
        return {
            "job_id": job_id,
            "status": "processing",
            "message": f"File uploaded successfully ({file_size_mb:.2f}MB). Processing in background.",
            "filename": file.filename,
            "file_size_mb": round(file_size_mb, 2),
            "processing_method": "chunked" if use_large_file_processor else "standard",
            "file_type": os.path.splitext(file.filename)[1]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def process_report_316_background(
    job_id: str, 
    file_path: str, 
    original_filename: str,
    file_size_mb: float,
    use_large_file_processor: bool = False
):
    """Background task to process Report 316 with progress tracking"""
    try:
        processing_status[job_id] = {
            "status": "processing", 
            "progress": 5, 
            "stage": "Starting...",
            "file_size_mb": file_size_mb
        }
        
        # Update progress
        processing_status[job_id] = {
            "status": "processing", 
            "progress": 20, 
            "stage": "Reading Excel..."
        }
        
        # Choose the appropriate processor
        if use_large_file_processor:
            print(f"📏 Using large file processor for {file_size_mb:.2f}MB file")
            count, output_file = process_report_316_large_file(file_path, parse_entry_month)
        else:
            count, output_file = process_report_316(file_path, parse_entry_month)
        
        processing_status[job_id] = {
            "status": "completed", 
            "progress": 100, 
            "stage": "Complete",
            "records": count
        }
        
        # Add to history
        history_entry = {
            "id": job_id,
            "fileName": original_filename,
            "uploadDate": datetime.now().isoformat(),
            "status": "success",
            "records": count,
            "outputFile": os.path.basename(output_file) if output_file else None,
            "type": "report_316",
            "file_size_mb": round(file_size_mb, 2)
        }
        add_to_history(history_entry)
        
        # Clean up uploaded file after processing
        try:
            os.remove(file_path)
            print(f"🧹 Cleaned up: {file_path}")
        except:
            pass
        
    except Exception as e:
        print(f"❌ Processing error: {e}")
        processing_status[job_id] = {
            "status": "failed", 
            "error": str(e), 
            "progress": 0
        }
        
        history_entry = {
            "id": job_id,
            "fileName": original_filename,
            "uploadDate": datetime.now().isoformat(),
            "status": "error",
            "records": 0,
            "error": str(e),
            "type": "report_316",
            "file_size_mb": round(file_size_mb, 2)
        }
        add_to_history(history_entry)

@app.post("/api/import-agent-master")
async def import_agent_master_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Import Agent Master Listing"""
    # Allow .xlsx, .xls, and .xlsb files for master import
    if not file.filename.endswith(('.xlsx', '.xls', '.xlsb')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload .xlsx, .xls, or .xlsb file")
    
    try:
        # Save uploaded file
        file_path = UPLOAD_DIR / file.filename
        total_size = 0
        
        async with aiofiles.open(file_path, 'wb') as buffer:
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large")
                await buffer.write(chunk)
        
        file_size_mb = total_size / (1024 * 1024)
        
        job_id = datetime.now().strftime("%Y%m%d_%H%M%S_MASTER")
        
        background_tasks.add_task(
            import_agent_master_background,
            job_id,
            str(file_path),
            file.filename,
            file_size_mb
        )
        
        return {
            "job_id": job_id,
            "status": "processing",
            "message": f"Master file uploaded ({file_size_mb:.2f}MB). Importing in background.",
            "filename": file.filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def import_agent_master_background(
    job_id: str, 
    file_path: str, 
    original_filename: str,
    file_size_mb: float
):
    """Background task to import agent master"""
    try:
        processing_status[job_id] = {
            "status": "processing", 
            "progress": 10, 
            "stage": "Starting import..."
        }
        
        import_agent_master(file_path)
        
        # Get updated agent count
        result = supabase.table("profiles").select("*", count="exact").execute()
        agent_count = result.count if hasattr(result, 'count') else 0
        
        processing_status[job_id] = {
            "status": "completed", 
            "progress": 100, 
            "stage": "Complete"
        }
        
        history_entry = {
            "id": job_id,
            "fileName": original_filename,
            "uploadDate": datetime.now().isoformat(),
            "status": "success",
            "records": agent_count,
            "type": "master_import",
            "file_size_mb": round(file_size_mb, 2)
        }
        add_to_history(history_entry)
        
        # Clean up
        try:
            os.remove(file_path)
        except:
            pass
        
    except Exception as e:
        processing_status[job_id] = {"status": "failed", "error": str(e), "progress": 0}
        
        history_entry = {
            "id": job_id,
            "fileName": original_filename,
            "uploadDate": datetime.now().isoformat(),
            "status": "error",
            "records": 0,
            "error": str(e),
            "type": "master_import"
        }
        add_to_history(history_entry)

@app.get("/api/processing-status/{job_id}")
async def get_processing_status(job_id: str):
    """Get the status of a processing job"""
    status = processing_status.get(job_id, {"status": "not_found"})
    return status

@app.get("/api/history")
async def get_history(limit: int = 20):
    """Get upload history"""
    history = load_history()
    return history[:limit]

@app.get("/api/download-latest/{filename}")
async def download_latest(filename: str):
    """Download a generated file"""
    file_path = DAILY_SUBMISSIONS_DIR / filename
    if not file_path.exists():
        file_path = UPLOAD_DIR / filename
    
    if file_path.exists():
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    else:
        raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/recent-cases")
async def get_recent_cases(limit: int = 10):
    """Get most recently added cases"""
    try:
        result = supabase.table("cases") \
            .select("*") \
            .order("submission_date_timestamp", desc=True) \
            .limit(limit) \
            .execute()
        
        return {
            "cases": result.data,
            "count": len(result.data)
        }
    except Exception as e:
        print(f"❌ Error in recent-cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
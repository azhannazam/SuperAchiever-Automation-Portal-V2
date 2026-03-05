# python_engine/database.py
from supabase import create_client
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
import pandas as pd
import gc  # Garbage collection
import time
import re
from typing import Tuple, Optional

# Load from root .env file
env_path = Path(__file__).parent.parent / '.env'
print(f"📁 Looking for .env at: {env_path}")
load_dotenv(dotenv_path=env_path)

# Use the credentials from your project
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"🔑 URL found: {'✅' if url else '❌'}")
print(f"🔑 Key found: {'✅' if key else '❌'}")

if not url or not key:
    print("⚠️ WARNING: Missing Supabase credentials!")
    print(f"VITE_SUPABASE_URL: {url}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'[SET]' if key else '[NOT SET]'}")
    supabase = None
else:
    print("✅ Supabase credentials loaded successfully")
    supabase = create_client(url, key)

def parse_date(date_value):
    """Helper function to parse dates from various formats"""
    if pd.isna(date_value) or date_value is None or date_value == '':
        return None
    
    try:
        # If it's already a datetime object
        if hasattr(date_value, 'isoformat'):
            return date_value.isoformat()
        
        # If it's a string, try to parse it
        if isinstance(date_value, str):
            # Handle Excel serial numbers (if it's a number stored as string)
            if date_value.replace('.', '').isdigit():
                try:
                    # Excel serial date (days since 1900-01-01)
                    from datetime import timedelta
                    excel_epoch = datetime(1899, 12, 30)
                    days = float(date_value)
                    parsed_date = excel_epoch + timedelta(days=days)
                    return parsed_date.isoformat()
                except:
                    pass
            
            # Try common date formats
            from dateutil import parser
            parsed_date = parser.parse(date_value)
            return parsed_date.isoformat()
        
        # If it's a number (Excel serial date)
        if isinstance(date_value, (int, float)):
            from datetime import timedelta
            excel_epoch = datetime(1899, 12, 30)
            parsed_date = excel_epoch + timedelta(days=float(date_value))
            return parsed_date.isoformat()
        
        return None
    except Exception as e:
        print(f"⚠️ Date parsing error for value '{date_value}': {e}")
        return None

def extract_premium_value(row) -> float:
    """
    Extract premium value from row, trying multiple possible column names and formats
    """
    # List of possible column names for premium/AFYC
    possible_columns = [
        'AFYC',
        'AFYC  W/O Regular Top Up',
        'AFYC Regular Top Up',
        'premium',
        'PREMIUM',
        'Annual Premium',
        'TOTAL_PREMIUM',
        'Modal Premium',
        'MODAL_PREMIUM',
        'ANNUAL_PREM'
    ]
    
    # Try each possible column
    for col in possible_columns:
        if col in row and row[col] is not None:
            value = row[col]
            try:
                # If it's already a number
                if isinstance(value, (int, float)):
                    if float(value) > 0:
                        print(f"    ✅ Found premium in '{col}': {value}")
                        return float(value)
                
                # If it's a string, clean and convert
                if isinstance(value, str):
                    # Remove currency symbols, commas, and spaces
                    cleaned = re.sub(r'[RM$,%\s]', '', value)
                    if cleaned and cleaned.replace('.', '').replace('-', '').isdigit():
                        num_val = float(cleaned)
                        if num_val > 0:
                            print(f"    ✅ Found premium in '{col}': {value} -> {num_val}")
                            return num_val
            except (ValueError, TypeError) as e:
                continue
    
    # If no premium found, return 0
    return 0.0

def sync_to_supabase_chunked(df: pd.DataFrame, chunk_size: int = 100) -> Tuple[int, int]:
    """
    Sync dataframe to Supabase cases table in chunks to handle large datasets
    """
    if not supabase:
        print("❌ Supabase client not initialized")
        return 0, 0
    
    total_records = len(df)
    print(f"🚀 Starting chunked sync of {total_records} records...")
    print(f"📦 Using chunk size: {chunk_size}")
    
    # Debug: Print sample of AFYC values
    print("\n📊 Sample premium values from first 10 rows:")
    for i in range(min(10, len(df))):
        row = df.iloc[i]
        premium = extract_premium_value(row)
        print(f"  Row {i}: AGENT_CODE={row.get('AGENT_CODE', 'N/A')}, AFYC={row.get('AFYC', 'N/A')}, Extracted={premium}")
    
    success_count = 0
    error_count = 0
    start_time = time.time()
    
    # Process in chunks
    for start_idx in range(0, total_records, chunk_size):
        end_idx = min(start_idx + chunk_size, total_records)
        chunk = df.iloc[start_idx:end_idx]
        
        chunk_num = start_idx // chunk_size + 1
        total_chunks = (total_records - 1) // chunk_size + 1
        
        print(f"\n📦 Processing chunk {chunk_num}/{total_chunks} (rows {start_idx+1}-{end_idx})")
        
        chunk_success = 0
        chunk_error = 0
        
        for idx, (_, row) in enumerate(chunk.iterrows()):
            try:
                agent_code = str(row.get('AGENT_CODE', '')).strip()
                if not agent_code:
                    continue
                
                # Check if agent exists in profiles
                check = supabase.table("profiles").select("agent_code").eq("agent_code", agent_code).execute()
                
                if not check.data:
                    print(f"  ⚠️ Skipping row {start_idx + idx + 1}: Agent {agent_code} not found")
                    chunk_error += 1
                    continue
                
                # Get current timestamp
                now = datetime.now().isoformat()
                
                # Parse dates - use the already parsed dates from excel_bot
                submission_date = row.get('PROPOSAL_RECEIVED_DATE')
                risk_date = row.get('RISK_COMMENCEMENT_DATE')
                
                # Extract premium value
                premium_value = extract_premium_value(row)
                
                # Prepare case data
                case_data = {
                    "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                    "agent_id": agent_code,
                    "client_name": str(row.get('AGENT_NAME', 'Unknown')),
                    "premium": premium_value,
                    "status": "approved" if "Inforce" in str(row.get('PROPOSAL_STATUS', '')) else "pending",
                    "submission_date_timestamp": submission_date,
                    "enforce_date": risk_date,
                    "product_type": str(row.get('PRODUCT_NAME', 'Standard')),
                    "created_at": now,
                    "updated_at": now,
                }
                
                # Remove empty values
                case_data = {k: v for k, v in case_data.items() if v is not None and v != ''}
                
                # Upsert to Supabase
                supabase.table("cases").upsert(
                    case_data, 
                    on_conflict="policy_number"
                ).execute()
                
                chunk_success += 1
                
                # Progress indicator
                if (idx + 1) % 25 == 0:
                    print(f"  ✅ Progress: {idx + 1}/{len(chunk)} in current chunk")
                
            except Exception as e:
                print(f"  ❌ Error at row {start_idx + idx + 1}: {e}")
                chunk_error += 1
        
        success_count += chunk_success
        error_count += chunk_error
        
        # Show chunk summary
        elapsed = time.time() - start_time
        rate = success_count / elapsed if elapsed > 0 else 0
        print(f"  📊 Chunk {chunk_num} complete: {chunk_success} success, {chunk_error} errors")
        print(f"  📈 Overall progress: {success_count}/{total_records} ({rate:.1f} records/sec)")
        
        # Force garbage collection after each chunk
        del chunk
        gc.collect()
        
        # Small delay to prevent rate limiting
        time.sleep(0.5)
    
    # Final summary
    elapsed = time.time() - start_time
    print(f"\n✅ Sync complete!")
    print(f"  📊 Results: {success_count} successful, {error_count} errors")
    print(f"  ⏱️  Time: {elapsed:.2f} seconds")
    print(f"  📈 Average rate: {success_count/elapsed:.1f} records/sec")
    
    return success_count, error_count

def sync_to_supabase(df: pd.DataFrame, use_chunking: bool = True, chunk_size: int = 100) -> Tuple[int, int]:
    """
    Main sync function - automatically uses chunking for large datasets
    """
    if not supabase:
        print("❌ Supabase client not initialized")
        return 0, 0
    
    # Auto-detect if chunking is needed based on dataframe size
    if use_chunking and len(df) > 500:
        print(f"📏 Large dataset detected ({len(df)} records). Using chunked processing...")
        return sync_to_supabase_chunked(df, chunk_size)
    
    # Original implementation for smaller datasets
    print(f"🚀 Starting sync of {len(df)} records (direct mode)...")
    success_count = 0
    error_count = 0
    start_time = time.time()
    
    for idx, (_, row) in enumerate(df.iterrows()):
        try:
            agent_code = str(row.get('AGENT_CODE', '')).strip()
            if not agent_code:
                continue
                
            # Check if agent exists in profiles
            check = supabase.table("profiles").select("agent_code").eq("agent_code", agent_code).execute()
            
            if not check.data:
                print(f"⚠️ Skipping row {idx + 1}: Agent {agent_code} not found")
                error_count += 1
                continue
            
            # Get current timestamp
            now = datetime.now().isoformat()
            
            # Parse dates - use the already parsed dates from excel_bot
            submission_date = row.get('PROPOSAL_RECEIVED_DATE')
            risk_date = row.get('RISK_COMMENCEMENT_DATE')
            
            # Extract premium value
            premium_value = extract_premium_value(row)
            
            # Prepare case data
            case_data = {
                "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                "agent_id": agent_code,
                "client_name": str(row.get('AGENT_NAME', row.get('CLIENT_NAME', 'Unknown'))),
                "premium": premium_value,
                "status": "approved" if "Inforce" in str(row.get('PROPOSAL_STATUS', '')) else "pending",
                "submission_date_timestamp": submission_date,
                "enforce_date": risk_date,
                "product_type": str(row.get('PRODUCT_NAME', 'Standard')),
                "created_at": now,
                "updated_at": now,
            }
            
            # Remove empty values
            case_data = {k: v for k, v in case_data.items() if v is not None and v != ''}
            
            # Upsert to Supabase
            supabase.table("cases").upsert(
                case_data, 
                on_conflict="policy_number"
            ).execute()
            
            success_count += 1
            
            # Progress indicator
            if (idx + 1) % 100 == 0:
                elapsed = time.time() - start_time
                print(f"  ✅ Processed {idx + 1}/{len(df)} records ({success_count/(elapsed+0.001):.1f} records/sec)")
                
        except Exception as e:
            print(f"❌ Error at row {idx + 1}: {e}")
            error_count += 1
    
    elapsed = time.time() - start_time
    print(f"✅ Sync complete: {success_count} successful, {error_count} errors in {elapsed:.2f} seconds")
    return success_count, error_count

def batch_get_agent_codes(agent_codes: list) -> dict:
    """
    Batch check multiple agent codes at once to reduce API calls
    """
    if not supabase or not agent_codes:
        return {}
    
    try:
        # Remove duplicates and empty values
        unique_codes = list(set([code for code in agent_codes if code]))
        
        # Fetch in batches of 100 (Supabase limit)
        agent_map = {}
        for i in range(0, len(unique_codes), 100):
            batch = unique_codes[i:i+100]
            result = supabase.table("profiles") \
                .select("agent_code") \
                .in_("agent_code", batch) \
                .execute()
            
            for item in result.data:
                agent_map[item['agent_code']] = True
        
        return agent_map
    except Exception as e:
        print(f"❌ Error batch checking agents: {e}")
        return {}

def sync_to_supabase_optimized(df: pd.DataFrame, batch_size: int = 50) -> Tuple[int, int]:
    """
    Optimized version using batch operations for maximum performance
    """
    if not supabase:
        print("❌ Supabase client not initialized")
        return 0, 0
    
    print(f"🚀 Starting optimized sync of {len(df)} records...")
    
    # Debug: Print sample of AFYC values
    print("\n📊 Sample premium values from first 10 rows:")
    for i in range(min(10, len(df))):
        row = df.iloc[i]
        premium = extract_premium_value(row)
        print(f"  Row {i}: AGENT_CODE={row.get('AGENT_CODE', 'N/A')}, AFYC={row.get('AFYC', 'N/A')}, Extracted={premium}")
    
    # Get all unique agent codes from the dataframe
    unique_agent_codes = df['AGENT_CODE'].dropna().unique().tolist()
    unique_agent_codes = [str(code).strip() for code in unique_agent_codes]
    
    # Batch check which agents exist
    print(f"🔍 Checking {len(unique_agent_codes)} unique agent codes...")
    existing_agents = batch_get_agent_codes(unique_agent_codes)
    
    success_count = 0
    error_count = 0
    start_time = time.time()
    skipped_no_agent = 0
    skipped_zero_premium = 0
    
    # Prepare batches for upsert
    batches = []
    current_batch = []
    
    for idx, (_, row) in enumerate(df.iterrows()):
        try:
            agent_code = str(row.get('AGENT_CODE', '')).strip()
            if not agent_code:
                skipped_no_agent += 1
                continue
            
            # Check if agent exists using our cached map
            if agent_code not in existing_agents:
                skipped_no_agent += 1
                continue
            
            now = datetime.now().isoformat()
            
            # Use the already parsed dates from excel_bot
            submission_date = row.get('PROPOSAL_RECEIVED_DATE')
            risk_date = row.get('RISK_COMMENCEMENT_DATE')
            
            # Extract premium value
            premium_value = extract_premium_value(row)
            
            if premium_value == 0:
                skipped_zero_premium += 1
                if idx < 10:  # Log first few zero premiums
                    print(f"  ⚠️ Zero premium for agent {agent_code}, AFYC={row.get('AFYC', 'N/A')}")
            
            case_data = {
                "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                "agent_id": agent_code,
                "client_name": str(row.get('AGENT_NAME', row.get('CLIENT_NAME', 'Unknown'))),
                "premium": premium_value,
                "status": "approved" if "Inforce" in str(row.get('PROPOSAL_STATUS', '')) else "pending",
                "submission_date_timestamp": submission_date,
                "enforce_date": risk_date,
                "product_type": str(row.get('PRODUCT_NAME', 'Standard')),
                "created_at": now,
                "updated_at": now,
            }
            
            # Remove None values
            case_data = {k: v for k, v in case_data.items() if v is not None}
            
            current_batch.append(case_data)
            
            # When batch is full, add to batches list
            if len(current_batch) >= batch_size:
                batches.append(current_batch)
                current_batch = []
                
        except Exception as e:
            print(f"❌ Error preparing row {idx}: {e}")
            error_count += 1
    
    # Add final batch
    if current_batch:
        batches.append(current_batch)
    
    print(f"\n📊 Summary:")
    print(f"  Total rows processed: {len(df)}")
    print(f"  Rows skipped (no agent/not found): {skipped_no_agent}")
    print(f"  Rows with zero premium: {skipped_zero_premium}")
    print(f"  Batches to execute: {len(batches)}")
    
    # Execute all batches
    print(f"\n📦 Executing {len(batches)} batches...")
    for i, batch in enumerate(batches):
        try:
            # Debug: Print first record in batch to verify premium and dates
            if i == 0 and batch:
                print(f"\n  Sample record from batch 1:")
                print(f"    Policy: {batch[0].get('policy_number', 'N/A')}")
                print(f"    Agent: {batch[0].get('agent_id', 'N/A')}")
                print(f"    Premium: {batch[0].get('premium', 'N/A')}")
                print(f"    Submission Date: {batch[0].get('submission_date_timestamp', 'N/A')}")
                print(f"    Enforce Date: {batch[0].get('enforce_date', 'N/A')}")
            
            supabase.table("cases").upsert(batch, on_conflict="policy_number").execute()
            success_count += len(batch)
            
            elapsed = time.time() - start_time
            rate = success_count / elapsed if elapsed > 0 else 0
            print(f"  ✅ Batch {i+1}/{len(batches)} complete ({success_count}/{len(df)} records, {rate:.1f} rec/sec)")
            
        except Exception as e:
            print(f"❌ Batch {i+1} failed: {e}")
            error_count += len(batch)
        
        # Small delay between batches
        time.sleep(0.2)
    
    elapsed = time.time() - start_time
    print(f"\n✅ Optimized sync complete:")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Time: {elapsed:.2f} seconds")
    print(f"  Avg rate: {success_count/elapsed:.1f} records/sec")
    
    return success_count, error_count

def check_premium_values(limit: int = 20):
    """Check premium values in the database for debugging"""
    try:
        result = supabase.table("cases") \
            .select("policy_number, agent_id, premium, submission_date_timestamp, enforce_date, created_at") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        print("\n📊 Current values in database (most recent):")
        print("-" * 80)
        for item in result.data:
            sub_date = item.get('submission_date_timestamp', 'N/A')
            if sub_date and sub_date != 'N/A':
                sub_date = sub_date[:10]  # Show only YYYY-MM-DD
            print(f"  Policy: {item['policy_number'][:15]:<15} Premium: {item['premium']:>10.2f}  Sub: {sub_date}")
        print("-" * 80)
        
        return result.data
    except Exception as e:
        print(f"❌ Error checking values: {e}")
        return []

def get_recent_cases(limit=10):
    """Get most recent cases using timestamp column"""
    try:
        result = supabase.table("cases") \
            .select("*") \
            .order("submission_date_timestamp", desc=True) \
            .limit(limit) \
            .execute()
        return result.data
    except Exception as e:
        print(f"❌ Error fetching recent cases: {e}")
        return []

def get_stats():
    """Get database statistics"""
    try:
        # Get counts
        agent_result = supabase.table("profiles").select("*", count="exact").execute()
        cases_result = supabase.table("cases").select("*", count="exact").execute()
        
        # Get latest case using timestamp
        latest = supabase.table("cases") \
            .select("submission_date_timestamp") \
            .order("submission_date_timestamp", desc=True) \
            .limit(1) \
            .execute()
        
        last_updated = None
        if latest.data and len(latest.data) > 0:
            last_updated = latest.data[0]['submission_date_timestamp']
        
        return {
            "totalAgents": agent_result.count if hasattr(agent_result, 'count') else 0,
            "totalCases": cases_result.count if hasattr(cases_result, 'count') else 0,
            "lastUpdated": last_updated
        }
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        return {
            "totalAgents": 0,
            "totalCases": 0,
            "lastUpdated": None
        }
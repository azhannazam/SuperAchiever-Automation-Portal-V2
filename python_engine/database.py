# python_engine/database.py
from supabase import create_client  # ADD THIS - was missing
from supabase_client import supabase  # Import from new file
import os
from datetime import datetime
import pandas as pd
import gc  # Garbage collection
import time
import re
from typing import Tuple, Optional
from pathlib import Path
from dotenv import load_dotenv

# Import TransferManager
from manage_transfers import TransferManager

# Initialize Transfer Manager
transfer_manager = TransferManager() if supabase else None

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
    transfer_manager = None
else:
    print("✅ Supabase credentials loaded successfully")
    supabase = create_client(url, key)
    # Initialize Transfer Manager
    transfer_manager = TransferManager()

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
                
                # Parse dates
                submission_date = row.get('PROPOSAL_RECEIVED_DATE')
                risk_date = row.get('RISK_COMMENCEMENT_DATE')
                
                # Extract premium value
                premium_value = extract_premium_value(row)
                
                # Get credited agent considering transfers
                credited_agent = agent_code
                if transfer_manager:
                    credited_agent = transfer_manager.get_credited_agent(
                        agent_code, 
                        submission_date or now
                    )
                
                # Prepare case data with transfer tracking
                case_data = {
                    "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                    "agent_id": agent_code,
                    "credited_agent_id": credited_agent,
                    "original_agent_id": agent_code if credited_agent != agent_code else None,
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
            
            # Parse dates
            submission_date = row.get('PROPOSAL_RECEIVED_DATE')
            risk_date = row.get('RISK_COMMENCEMENT_DATE')
            
            # Extract premium value
            premium_value = extract_premium_value(row)
            
            # Get credited agent considering transfers
            credited_agent = agent_code
            if transfer_manager:
                credited_agent = transfer_manager.get_credited_agent(
                    agent_code, 
                    submission_date or now
                )
            
            # Prepare case data with transfer tracking
            case_data = {
                "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                "agent_id": agent_code,
                "credited_agent_id": credited_agent,
                "original_agent_id": agent_code if credited_agent != agent_code else None,
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
    Optimized version using batch operations for maximum performance with transfer handling
    """
    if not supabase:
        print("❌ Supabase client not initialized")
        return 0, 0
    
    print(f"\n{'='*60}")
    print(f"🚀 Starting optimized sync of {len(df)} records...")
    print(f"{'='*60}\n")
    
    # Get all unique agent codes from the dataframe
    unique_agent_codes = df['AGENT_CODE'].dropna().unique().tolist()
    unique_agent_codes = [str(code).strip() for code in unique_agent_codes]
    
    print(f"📊 EXCEL FILE STATISTICS:")
    print(f"  Total rows in Excel: {len(df)}")
    print(f"  Unique agent codes in Excel: {len(unique_agent_codes)}")
    print(f"  Sample of Excel agent codes (first 20):")
    for i, code in enumerate(sorted(unique_agent_codes)[:20], 1):
        print(f"    {i:3}. {code}")
    
    # Fetch ALL agent codes from profiles table
    print(f"\n📡 Fetching all agent codes from profiles table...")
    result = supabase.table("profiles").select("agent_code").execute()
    existing_agents = {item['agent_code'] for item in result.data}
    
    print(f"  Total agents in profiles: {len(existing_agents)}")
    print(f"  Sample of profile agent codes (first 20):")
    for i, code in enumerate(sorted(existing_agents)[:20], 1):
        print(f"    {i:3}. {code}")
    
    # Find which codes are missing
    missing_codes = []
    matched_codes = []
    
    for code in unique_agent_codes:
        if code in existing_agents:
            matched_codes.append(code)
        else:
            missing_codes.append(code)
    
    print(f"\n🔍 AGENT CODE MATCHING RESULTS:")
    print(f"  ✅ Matched codes: {len(matched_codes)}")
    print(f"  ❌ Missing codes: {len(missing_codes)}")
    
    if matched_codes:
        print(f"\n✅ MATCHED CODES (will be processed):")
        for i, code in enumerate(sorted(matched_codes)[:20], 1):
            print(f"    {i:3}. {code}")
        if len(matched_codes) > 20:
            print(f"    ... and {len(matched_codes) - 20} more")
    
    if missing_codes:
        print(f"\n❌ MISSING CODES (will be skipped):")
        for i, code in enumerate(sorted(missing_codes)[:20], 1):
            print(f"    {i:3}. {code}")
        if len(missing_codes) > 20:
            print(f"    ... and {len(missing_codes) - 20} more")
        
        # Save to file
        filename = f"missing_agent_codes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(filename, 'w') as f:
            f.write(f"Missing Agent Codes Report\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write(f"Total missing: {len(missing_codes)}\n")
            f.write("=" * 50 + "\n")
            for code in sorted(missing_codes):
                f.write(f"{code}\n")
        print(f"\n📁 Full list saved to: {os.path.abspath(filename)}")
    
    # Now process only matched codes
    print(f"\n{'='*60}")
    print(f"📦 PROCESSING {len(matched_codes)} MATCHED AGENT CODES...")
    print(f"{'='*60}\n")
    
    success_count = 0
    error_count = 0
    start_time = time.time()
    skipped_no_agent = 0
    skipped_zero_premium = 0
    transfer_count = 0
    
    # Filter dataframe to only include matched agent codes
    matched_df = df[df['AGENT_CODE'].isin(matched_codes)]
    print(f"  Records after filtering by matched codes: {len(matched_df)}")
    
    # Prepare batches for upsert
    batches = []
    current_batch = []
    
    for idx, (_, row) in enumerate(matched_df.iterrows()):
        try:
            agent_code = str(row.get('AGENT_CODE', '')).strip()
            
            now = datetime.now().isoformat()
            
            # Use the already parsed dates from excel_bot
            submission_date = row.get('PROPOSAL_RECEIVED_DATE')
            risk_date = row.get('RISK_COMMENCEMENT_DATE')
            
            # Extract premium value
            premium_value = extract_premium_value(row)
            
            if premium_value == 0:
                skipped_zero_premium += 1
                if idx < 10:
                    print(f"  ⚠️ Zero premium for {agent_code}")
            
            # Get credited agent considering transfers
            credited_agent = agent_code
            if transfer_manager:
                credited_agent = transfer_manager.get_credited_agent(
                    agent_code, 
                    submission_date or now
                )
            
            if credited_agent != agent_code:
                transfer_count += 1
                if transfer_count <= 10:
                    print(f"  🔄 Transfer: {agent_code} → {credited_agent}")
            
            # Prepare case data with transfer tracking
            case_data = {
                "policy_number": str(row.get('PROPOSALNO', row.get('POLICYNO', ''))).strip(),
                "agent_id": agent_code,
                "credited_agent_id": credited_agent,
                "original_agent_id": agent_code if credited_agent != agent_code else None,
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
    
    print(f"\n📊 BATCH SUMMARY:")
    print(f"  Total rows in filtered data: {len(matched_df)}")
    print(f"  Batches created: {len(batches)}")
    print(f"  Rows with zero premium: {skipped_zero_premium}")
    print(f"  Cases transferred: {transfer_count}")
    
    # Execute all batches
    print(f"\n📦 Executing {len(batches)} batches...")
    for i, batch in enumerate(batches):
        try:
            # Debug: Print first record in batch
            if i == 0 and batch:
                print(f"\n  Sample record from batch 1:")
                print(f"    Policy: {batch[0].get('policy_number', 'N/A')}")
                print(f"    Agent: {batch[0].get('agent_id', 'N/A')}")
                if batch[0].get('credited_agent_id') and batch[0].get('credited_agent_id') != batch[0].get('agent_id'):
                    print(f"    Credited to: {batch[0].get('credited_agent_id')}")
                print(f"    Premium: {batch[0].get('premium', 'N/A')}")
                print(f"    Submission Date: {batch[0].get('submission_date_timestamp', 'N/A')}")
            
            supabase.table("cases").upsert(batch, on_conflict="policy_number").execute()
            success_count += len(batch)
            
            elapsed = time.time() - start_time
            rate = success_count / elapsed if elapsed > 0 else 0
            print(f"  ✅ Batch {i+1}/{len(batches)} complete ({success_count}/{len(matched_df)} records, {rate:.1f} rec/sec)")
            
        except Exception as e:
            print(f"❌ Batch {i+1} failed: {e}")
            error_count += len(batch)
        
        time.sleep(0.2)
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"✅ FINAL RESULTS:")
    print(f"  Successfully synced: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Time: {elapsed:.2f} seconds")
    print(f"  Cases transferred: {transfer_count}")
    print(f"{'='*60}\n")
    
    return success_count, error_count

def check_premium_values(limit: int = 20):
    """Check premium values in the database for debugging"""
    try:
        result = supabase.table("cases") \
            .select("policy_number, agent_id, credited_agent_id, premium, submission_date_timestamp, enforce_date, created_at") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        print("\n📊 Current values in database (most recent):")
        print("-" * 100)
        for item in result.data:
            sub_date = item.get('submission_date_timestamp', 'N/A')
            if sub_date and sub_date != 'N/A':
                sub_date = sub_date[:10]
            
            credited = item.get('credited_agent_id', '')
            if credited and credited != item.get('agent_id'):
                print(f"  Policy: {item['policy_number'][:15]:<15} Agent: {item['agent_id']:<10} → {credited:<10} Premium: {item['premium']:>10.2f}  Sub: {sub_date}")
            else:
                print(f"  Policy: {item['policy_number'][:15]:<15} Agent: {item['agent_id']:<10} Premium: {item['premium']:>10.2f}  Sub: {sub_date}")
        print("-" * 100)
        
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
        
        # Get transfer stats
        transfer_count = 0
        if transfer_manager:
            report = transfer_manager.generate_report()
            transfer_count = report.get('cases_with_transfers', 0)
        
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
            "transferredCases": transfer_count,
            "lastUpdated": last_updated
        }
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        return {
            "totalAgents": 0,
            "totalCases": 0,
            "transferredCases": 0,
            "lastUpdated": None
        }
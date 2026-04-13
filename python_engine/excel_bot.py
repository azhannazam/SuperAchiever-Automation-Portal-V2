# python_engine/excel_bot.py
import pandas as pd
import os
from datetime import datetime
from database import sync_to_supabase_optimized
import gc
import logging
from pathlib import Path
import re

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

def parse_ddmmyyyy(date_value):
    """
    Parse dates in DDMMYYYY format (e.g., 22112026 -> 22/11/2026)
    Also handles Excel serial numbers and other formats as fallback
    """
    if pd.isna(date_value) or date_value is None or date_value == '':
        return None
    
    # Convert to string and clean
    date_str = str(date_value).strip()
    
    # Check if it's 8 digits (DDMMYYYY format)
    if len(date_str) == 8 and date_str.isdigit():
        try:
            day = int(date_str[0:2])
            month = int(date_str[2:4])
            year = int(date_str[4:8])
            
            # Validate ranges
            if 1 <= day <= 31 and 1 <= month <= 12 and 2000 <= year <= 2100:
                parsed_date = datetime(year, month, day)
                logger.debug(f"    ✅ Parsed DDMMYYYY date: {date_str} -> {parsed_date.strftime('%Y-%m-%d')}")
                return parsed_date.isoformat()
        except Exception as e:
            logger.debug(f"    ⚠️ Error parsing date '{date_str}': {e}")
    
    # Try standard date parsing as last resort
    try:
        from dateutil import parser
        parsed = parser.parse(date_str, fuzzy=True)
        if 2000 <= parsed.year <= 2100:
            logger.debug(f"    ✅ Parsed date: {date_str} -> {parsed.strftime('%Y-%m-%d')}")
            return parsed.isoformat()
    except:
        pass
    
    return None

def parse_status(status_value):
    """
    Convert status from Excel to standard format
    """
    if pd.isna(status_value):
        return 'pending'
    
    status_str = str(status_value).strip().upper()
    
    # Map various status values to standard ones
    if any(word in status_str for word in ['INFORCE', 'Inforce', 'inforce','IN FORCE', 'ACTIVE', 'APPROVED', 'LIVE', 'IN-FORCE']):
        return 'approved'
    elif any(word in status_str for word in ['PENDING', 'IN PROGRESS', 'SUBMITTED', 'Pending for UnderWriting', 'Postponed', 'Pending', 'Pending for Counter Offer', 'Pending for Payment']):
        return 'pending'
    elif any(word in status_str for word in ['REJECTED', 'DECLINED', 'Declined', 'CANCELLED']):
        return 'rejected'
    else:
        return 'pending'

def parse_payment_frequency(freq_value):
    """
    Parse and standardize payment frequency values
    Handles both text values and numeric codes
    """
    if pd.isna(freq_value):
        return None
    
    # Handle numeric values (0, 1, 2, etc.)
    if isinstance(freq_value, (int, float)):
        # Map numeric codes to text values
        # Common mappings (adjust based on your actual Excel data)
        freq_map = {
            0: 'Monthly',
            1: 'Quarterly', 
            2: 'Yearly',
            3: 'Monthly',  # Some systems use 3 for Monthly
            4: 'Quarterly',
            5: 'Yearly',
            12: 'Monthly',  # 12 payments per year
            4: 'Quarterly',  # 4 payments per year
            1: 'Yearly',     # 1 payment per year
        }
        
        # Try exact match
        if freq_value in freq_map:
            return freq_map[freq_value]
        
        # Try to infer from value
        if freq_value == 0:
            return 'Monthly'
        elif freq_value == 1:
            return 'Quarterly'
        elif freq_value == 2:
            return 'Yearly'
        else:
            # Return as string for debugging
            return str(freq_value)
    
    # Handle string values
    freq_str = str(freq_value).strip().upper()

def map_report316_columns(df):
    """
    Map columns specifically for Report 316 format
    This function looks for the exact column names in your Report 316
    """
    column_mapping = {}
    
    # Log all columns found for debugging
    logger.info(f"📋 Available columns in file: {list(df.columns)}")
    
    # Define expected column names (case insensitive)
    expected_columns = {
        'PROPOSALNO': ['PROPOSALNO', 'PROPOSAL NO', 'PROPOSAL_NUMBER', 'PROPOSAL NO.', 'NO. PROPOSAL'],
        'AGENT_CODE': ['AGENT_CODE', 'AGENT CODE', 'AGENTCODE', 'AGENT ID', 'AGENT_ID', 'AGENT'],
        'AGENT_NAME': ['AGENT_NAME', 'AGENT NAME'],
        'AFYC': ['AFYC'],
        'PROPOSAL_STATUS': ['PROPOSAL_STATUS', 'PROPOSAL STATUS', 'STATUS', 'POLICY STATUS', 'POLY_STATUS'],
        'ENTRY_DATE': ['ENTRY_DATE', 'ENTRY DATE', 'SUBMISSION DATE', 'PROPOSAL RECEIVED DATE', 'RECEIVED DATE'],
        'RISK_COMMENCEMENT_DATE': ['RISK_COMMENCEMENT_DATE', 'RISK COMMENCEMENT DATE', 'COMMENCEMENT DATE', 'ENFORCE DATE', 'EFFECTIVE DATE'],
        'PRODUCT_NAME': ['PRODUCT_NAME', 'PRODUCT NAME'],
        'PAYMENT_FREQUENCY': [
            'PAYMENT_FREQUENCY', 'PAYMENT FREQUENCY', 'FREQUENCY', 'PAYMENT', 'PAY FREQ', 
            'PAYMENT TERM', 'PREMIUM FREQUENCY', 'PAYMENT_MODE', 'PAYMENT MODE', 'FREQ'
        ],
        'ENTRY_MONTH': ['ENTRY_MONTH', 'ENTRY MONTH', 'MONTH', 'ENTRY MONTHLY', 'Entry Month']
    }
    
    # Try to map each column
    for col in df.columns:
        col_clean = str(col).strip()
        col_upper = col_clean.upper()
        
        for target, patterns in expected_columns.items():
            if target in column_mapping:
                continue
            for pattern in patterns:
                if pattern.upper() == col_upper or pattern.upper() in col_upper:
                    column_mapping[target] = col
                    logger.info(f"  ✅ Mapped '{target}' → column: '{col}'")
                    break
    
    # Special handling for PAYMENT_FREQUENCY - look for columns containing frequency values
    if 'PAYMENT_FREQUENCY' not in column_mapping:
        for col in df.columns:
            if col in column_mapping.values():
                continue
            sample = df[col].dropna().head(10)
            if len(sample) > 0:
                # Check for frequency keywords or numeric values (0,1,2)
                sample_str = ' '.join([str(x).upper() for x in sample])
                if any(word in sample_str for word in ['MONTHLY', 'QUARTERLY', 'YEARLY', 'MONTH', 'QUARTER', 'YEAR']):
                    column_mapping['PAYMENT_FREQUENCY'] = col
                    logger.info(f"  ✅ Auto-detected PAYMENT_FREQUENCY column: '{col}' (contains frequency keywords)")
                    break
                # Check for numeric values that might represent frequencies (0,1,2)
                numeric_sample = [x for x in sample if isinstance(x, (int, float)) and x in [0, 1, 2, 3, 4, 5, 12]]
                if len(numeric_sample) > 0:
                    column_mapping['PAYMENT_FREQUENCY'] = col
                    logger.info(f"  ✅ Auto-detected PAYMENT_FREQUENCY column: '{col}' (contains numeric frequency codes: {set(numeric_sample)})")
                    break
    
    # If PROPOSALNO still not found, try to find by position or sample data
    if 'PROPOSALNO' not in column_mapping:
        for col in df.columns:
            sample = df[col].dropna().head(3)
            if len(sample) > 0:
                sample_str = ' '.join([str(x) for x in sample])
                # Look for pattern like "P123456" or numbers
                if re.search(r'[A-Za-z]*\d{5,}', sample_str):
                    column_mapping['PROPOSALNO'] = col
                    logger.info(f"  ✅ Auto-detected PROPOSALNO column: '{col}' (contains policy numbers)")
                    break
    
    # If AGENT_CODE still not found, try to find by sample data
    if 'AGENT_CODE' not in column_mapping:
        for col in df.columns:
            sample = df[col].dropna().head(3)
            if len(sample) > 0:
                sample_str = ' '.join([str(x) for x in sample])
                # Look for pattern like "4ET12345" or "KET12345"
                if re.search(r'[0-9A-Z]{6,}', sample_str):
                    column_mapping['AGENT_CODE'] = col
                    logger.info(f"  ✅ Auto-detected AGENT_CODE column: '{col}' (contains agent codes)")
                    break
    
    # If AFYC not found, look for columns with numbers
    if 'AFYC' not in column_mapping:
        for col in df.columns:
            if col in column_mapping.values():
                continue
            sample = df[col].dropna().head(3)
            if len(sample) > 0:
                # Check if column contains numbers (likely premium)
                numeric_count = sum(1 for x in sample if isinstance(x, (int, float)) or (isinstance(x, str) and x.replace('.', '').isdigit()))
                if numeric_count >= 2:
                    column_mapping['AFYC'] = col
                    logger.info(f"  ✅ Auto-detected AFYC column: '{col}' (contains numeric values)")
                    break
    
    logger.info(f"\n📋 Final column mapping: {column_mapping}")
    return column_mapping

def process_excel_file(file_path, parse_entry_month_func=None, chunk_size=5000):
    """
    Process Report 316 Excel files (supports .xlsx, .xls, and .xlsb)
    """
    file_ext = os.path.splitext(file_path)[1].lower()
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    logger.info(f"🚀 Processing {file_size_mb:.2f}MB file with extension {file_ext}...")
    
    try:
        # Read the Excel file
        if file_ext == '.xlsb':
            logger.info("📊 Using pyxlsb engine for XLSB file...")
            df = pd.read_excel(file_path, engine='pyxlsb')
        else:
            df = pd.read_excel(file_path, engine='openpyxl' if file_ext == '.xlsx' else 'xlrd')
        
        logger.info(f"📄 Loaded {len(df)} rows and {len(df.columns)} columns")
        
        # Map columns for Report 316
        column_mapping = map_report316_columns(df)
        
        # Check for essential columns
        if 'AGENT_CODE' not in column_mapping:
            logger.error("❌ AGENT_CODE column not found! Cannot proceed.")
            logger.info(f"Available columns: {list(df.columns)}")
            return 0, None
        
        if 'PROPOSALNO' not in column_mapping:
            logger.error("❌ PROPOSALNO column not found! Cannot proceed.")
            logger.info(f"Available columns: {list(df.columns)}")
            return 0, None
        
        logger.info("✅ Required columns found. Processing data...")
        
        # Process rows
        chunk_data = []
        total_records = 0
        matching_records = 0
        stats = {
            'total_rows': len(df),
            'no_agent': 0,
            'no_proposal': 0,
            'zero_premium': 0,
            'approved_count': 0,
            'pending_count': 0,
            'payment_frequency_count': 0
        }
        
        for idx, row in df.iterrows():
            # Get agent code
            agent_code = row.get(column_mapping.get('AGENT_CODE'))
            if pd.isna(agent_code) or str(agent_code).strip() == '':
                stats['no_agent'] += 1
                continue
            
            # Get proposal number
            proposal_no = row.get(column_mapping.get('PROPOSALNO'))
            if pd.isna(proposal_no) or str(proposal_no).strip() == '':
                stats['no_proposal'] += 1
                continue
            
            # Get premium value (AFYC)
            afyc_col = column_mapping.get('AFYC')
            premium = 0.0
            if afyc_col and not pd.isna(row.get(afyc_col)):
                afyc_value = row.get(afyc_col)
                try:
                    if isinstance(afyc_value, (int, float)):
                        premium = float(afyc_value)
                    elif isinstance(afyc_value, str):
                        # Remove RM, commas, spaces, etc.
                        cleaned = re.sub(r'[RM$,%\s]', '', afyc_value)
                        if cleaned and cleaned.replace('.', '').replace('-', '').isdigit():
                            premium = float(cleaned)
                except:
                    premium = 0.0
            
            if premium == 0:
                stats['zero_premium'] += 1
            
            # Get status
            status_col = column_mapping.get('PROPOSAL_STATUS')
            status = 'pending'
            if status_col and not pd.isna(row.get(status_col)):
                status = parse_status(row.get(status_col))
            
            if status == 'approved':
                stats['approved_count'] += 1
            else:
                stats['pending_count'] += 1
            
            # Get submission date (ENTRY_DATE)
            submission_date = None
            date_col = column_mapping.get('ENTRY_DATE')
            if date_col and not pd.isna(row.get(date_col)):
                submission_date = parse_ddmmyyyy(row.get(date_col))
            
            # Get enforce date (RISK_COMMENCEMENT_DATE)
            enforce_date = None
            enforce_col = column_mapping.get('RISK_COMMENCEMENT_DATE')
            if enforce_col and not pd.isna(row.get(enforce_col)):
                enforce_date = parse_ddmmyyyy(row.get(enforce_col))
            
            # Get payment frequency - with improved parsing
            payment_frequency = None
            freq_col = column_mapping.get('PAYMENT_FREQUENCY')
            if freq_col and not pd.isna(row.get(freq_col)):
                raw_freq = row.get(freq_col)
                payment_frequency = parse_payment_frequency(raw_freq)
                if payment_frequency:
                    stats['payment_frequency_count'] += 1
                    logger.debug(f"  💳 Payment Frequency: {raw_freq} → {payment_frequency}")
            
            # Get entry month
            entry_month = None
            entry_col = column_mapping.get('ENTRY_MONTH')
            if entry_col and not pd.isna(row.get(entry_col)) and parse_entry_month_func:
                entry_month = parse_entry_month_func(row.get(entry_col), submission_date)
            
            # Get product name
            product_name = None
            product_col = column_mapping.get('PRODUCT_NAME')
            if product_col and not pd.isna(row.get(product_col)):
                product_name = str(row.get(product_col)).strip()
            
            # Get client/agent name
            client_name = None
            name_col = column_mapping.get('AGENT_NAME')
            if name_col and not pd.isna(row.get(name_col)):
                client_name = str(row.get(name_col)).strip()
            else:
                client_name = f"Agent {agent_code}"
            
            matching_records += 1
            
            # Prepare row dict for database
            row_dict = {
                'PROPOSALNO': str(proposal_no).strip(),
                'POLICYNO': str(proposal_no).strip(),
                'PROPOSAL_RECEIVED_DATE': submission_date,
                'RISK_COMMENCEMENT_DATE': enforce_date,
                'AGENT_CODE': str(agent_code).strip(),
                'AGENT_NAME': client_name,
                'AFYC': premium,
                'PROPOSAL_STATUS': status,
                'PRODUCT_NAME': product_name or "Standard",
                'PAYMENT_FREQUENCY': payment_frequency,
                'ENTRY_MONTH': entry_month,
            }
            
            chunk_data.append(row_dict)
            
            if len(chunk_data) >= chunk_size:
                df_chunk = pd.DataFrame(chunk_data)
                logger.info(f"📦 Processing chunk with {len(df_chunk)} records")
                
                # Count records with payment frequency
                has_payment_freq = len(df_chunk[df_chunk['PAYMENT_FREQUENCY'].notna()])
                logger.info(f"  💳 Records with Payment Frequency: {has_payment_freq}/{len(df_chunk)}")
                
                success, errors = sync_to_supabase_optimized(df_chunk, batch_size=100)
                total_records += success
                chunk_data = []
                gc.collect()
        
        # Process remaining chunk
        if chunk_data:
            df_chunk = pd.DataFrame(chunk_data)
            logger.info(f"📦 Processing final chunk with {len(df_chunk)} records")
            
            has_payment_freq = len(df_chunk[df_chunk['PAYMENT_FREQUENCY'].notna()])
            logger.info(f"  💳 Records with Payment Frequency: {has_payment_freq}/{len(df_chunk)}")
            
            success, errors = sync_to_supabase_optimized(df_chunk, batch_size=100)
            total_records += success
        
        # Print statistics
        logger.info(f"\n📊 PROCESSING STATISTICS:")
        logger.info(f"  Total rows in Excel: {stats['total_rows']}")
        logger.info(f"  Missing Agent Code: {stats['no_agent']}")
        logger.info(f"  Missing Proposal No: {stats['no_proposal']}")
        logger.info(f"  Zero Premium records: {stats['zero_premium']}")
        logger.info(f"  Valid records processed: {matching_records}")
        logger.info(f"  Successfully synced: {total_records}")
        logger.info(f"\n📊 STATUS DISTRIBUTION:")
        logger.info(f"  Approved (Inforce): {stats['approved_count']}")
        logger.info(f"  Pending: {stats['pending_count']}")
        logger.info(f"\n📊 PAYMENT FREQUENCY:")
        logger.info(f"  Records with Payment Frequency: {stats['payment_frequency_count']}")
        
        return total_records, None
        
    except Exception as e:
        logger.error(f"❌ Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return 0, None

def process_report_316_large_file(file_path, parse_entry_month_func=None, chunk_size=5000):
    """Process large Report 316 files with support for XLSB format"""
    return process_excel_file(file_path, parse_entry_month_func, chunk_size)

def process_report_316(file_path, parse_entry_month_func=None):
    """Main function to process Report 316 files"""
    if not os.path.exists(file_path):
        logger.error(f"❌ File not found: {file_path}")
        return 0, None
    
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    logger.info(f"📏 File size: {file_size_mb:.2f}MB")
    
    return process_report_316_large_file(file_path, parse_entry_month_func)
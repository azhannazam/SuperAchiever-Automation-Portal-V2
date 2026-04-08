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
                logger.info(f"    ✅ Parsed DDMMYYYY date: {date_str} -> {parsed_date.strftime('%Y-%m-%d')}")
                return parsed_date.isoformat()
            else:
                logger.warning(f"    ⚠️ Invalid date values: day={day}, month={month}, year={year}")
        except Exception as e:
            logger.warning(f"    ⚠️ Error parsing date '{date_str}': {e}")
    
    # Try Excel serial number format
    if date_str.replace('.', '').isdigit():
        try:
            from datetime import timedelta
            excel_epoch = datetime(1899, 12, 30)
            days = float(date_str)
            parsed_date = excel_epoch + timedelta(days=days)
            if 2000 <= parsed_date.year <= 2100:
                logger.info(f"    ✅ Parsed Excel serial date: {date_str} -> {parsed_date.strftime('%Y-%m-%d')}")
                return parsed_date.isoformat()
        except:
            pass
    
    # Try standard date parsing
    try:
        from dateutil import parser
        parsed = parser.parse(date_str, fuzzy=True)
        if 2000 <= parsed.year <= 2100:
            logger.info(f"    ✅ Parsed fuzzy date: {date_str} -> {parsed.strftime('%Y-%m-%d')}")
            return parsed.isoformat()
    except:
        pass
    
    logger.warning(f"    ⚠️ Could not parse date: '{date_str}'")
    return None

def extract_premium_value(row) -> float:
    """Extract premium value from row, specifically looking for AFYC column"""
    if 'AFYC' in row and row['AFYC'] is not None:
        value = row['AFYC']
        try:
            if isinstance(value, (int, float)):
                if float(value) > 0:
                    return float(value)
            elif isinstance(value, str):
                cleaned = re.sub(r'[RM$,%\s]', '', value)
                if cleaned and cleaned.replace('.', '').isdigit():
                    num_val = float(cleaned)
                    if num_val > 0:
                        return num_val
        except (ValueError, TypeError) as e:
            logger.warning(f"    ⚠️ Could not convert AFYC value '{value}': {e}")
    
    return 0.0

def process_excel_file(file_path, parse_entry_month_func=None, chunk_size=5000):
    """
    Process Excel files (supports .xlsx, .xls, and .xlsb)
    """
    file_ext = os.path.splitext(file_path)[1].lower()
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    logger.info(f"🚀 Processing {file_size_mb:.2f}MB file with extension {file_ext}...")
    
    try:
        # For XLSB files, use pyxlsb engine
        if file_ext == '.xlsb':
            logger.info("📊 Using pyxlsb engine for XLSB file...")
            df = pd.read_excel(file_path, engine='pyxlsb')
        else:
            # For XLSX and XLS files, use openpyxl or xlrd
            df = pd.read_excel(file_path, engine='openpyxl' if file_ext == '.xlsx' else 'xlrd')
        
        logger.info(f"📄 Loaded {len(df)} rows and {len(df.columns)} columns")
        logger.info(f"📋 Columns found: {df.columns.tolist()}")
        
        # Find required columns (case insensitive)
        column_mapping = {}
        for col in df.columns:
            col_upper = str(col).upper().strip()
            
            if 'PROPOSALNO' in col_upper:
                column_mapping['PROPOSALNO'] = col
            elif 'PROPOSAL_RECEIVED_DATE' in col_upper:
                column_mapping['PROPOSAL_RECEIVED_DATE'] = col
            elif 'RISK_COMMENCEMENT_DATE' in col_upper:
                column_mapping['RISK_COMMENCEMENT_DATE'] = col
            elif 'AGENT_CODE' in col_upper:
                column_mapping['AGENT_CODE'] = col
            elif 'AGENT_NAME' in col_upper:
                column_mapping['AGENT_NAME'] = col
            elif 'AFYC' in col_upper:
                column_mapping['AFYC'] = col
            elif 'PROPOSAL_STATUS' in col_upper:
                column_mapping['PROPOSAL_STATUS'] = col
            elif 'AM_NAME' in col_upper:
                column_mapping['AM_NAME'] = col
            elif 'POLICYNO' in col_upper:
                column_mapping['POLICYNO'] = col
            elif 'PRODUCT_NAME' in col_upper:
                column_mapping['PRODUCT_NAME'] = col
            elif 'POLY_STATUS' in col_upper:
                column_mapping['POLY_STATUS'] = col
            elif 'PAYMENT_FREQUENCY' in col_upper:
                column_mapping['PAYMENT_FREQUENCY'] = col
                logger.info(f"  ✅ Found PAYMENT_FREQUENCY column: '{col}'")
            elif 'ENTRY' in col_upper and 'MONTH' in col_upper:
                column_mapping['ENTRY_MONTH'] = col
                logger.info(f"  ✅ Found ENTRY_MONTH column: '{col}'")
        
        # Check for essential columns
        if 'AGENT_CODE' not in column_mapping:
            logger.error("❌ AGENT_CODE column not found")
            return 0, None
        
        if 'PROPOSALNO' not in column_mapping:
            logger.error("❌ PROPOSALNO column not found")
            return 0, None
        
        logger.info("✅ Required columns found")
        
        # Process in chunks
        chunk_data = []
        total_records = 0
        matching_records = 0
        
        for idx, row in df.iterrows():
            agent_code = row.get(column_mapping.get('AGENT_CODE'))
            proposal_no = row.get(column_mapping.get('PROPOSALNO'))
            
            if pd.isna(agent_code) or pd.isna(proposal_no):
                continue
            
            # Get premium value
            afic_value = row.get(column_mapping.get('AFYC', None))
            premium = 0.0
            if not pd.isna(afic_value):
                try:
                    if isinstance(afic_value, (int, float)):
                        premium = float(afic_value)
                    elif isinstance(afic_value, str):
                        cleaned = re.sub(r'[RM$,%\s]', '', afic_value)
                        if cleaned and cleaned.replace('.', '').isdigit():
                            premium = float(cleaned)
                except (ValueError, TypeError):
                    premium = 0.0
            
            # Get submission date
            submission_date = None
            if 'PROPOSAL_RECEIVED_DATE' in column_mapping:
                raw_date = row.get(column_mapping['PROPOSAL_RECEIVED_DATE'])
                if not pd.isna(raw_date):
                    submission_date = parse_ddmmyyyy(raw_date)
            
            # Get risk commencement date
            risk_date = None
            if 'RISK_COMMENCEMENT_DATE' in column_mapping:
                raw_risk_date = row.get(column_mapping['RISK_COMMENCEMENT_DATE'])
                if not pd.isna(raw_risk_date):
                    risk_date = parse_ddmmyyyy(raw_risk_date)
            
            # Get Entry Month
            entry_month = None
            if 'ENTRY_MONTH' in column_mapping and parse_entry_month_func:
                raw_entry_month = row.get(column_mapping['ENTRY_MONTH'])
                if not pd.isna(raw_entry_month):
                    entry_month = parse_entry_month_func(raw_entry_month, submission_date)
            
            # Get payment frequency
            payment_frequency = None
            if 'PAYMENT_FREQUENCY' in column_mapping:
                raw_payment_freq = row.get(column_mapping['PAYMENT_FREQUENCY'])
                if not pd.isna(raw_payment_freq):
                    payment_frequency = str(raw_payment_freq).strip()
                    logger.debug(f"  💳 Payment Frequency: {payment_frequency}")
            
            # Get other values
            agent_name = row.get(column_mapping.get('AGENT_NAME', None), 'Unknown')
            if pd.isna(agent_name):
                agent_name = 'Unknown'
            
            proposal_status = row.get(column_mapping.get('PROPOSAL_STATUS', None), '')
            if pd.isna(proposal_status):
                proposal_status = ''
            
            am_name = row.get(column_mapping.get('AM_NAME', None), None)
            if pd.isna(am_name):
                am_name = None
            
            policy_no = row.get(column_mapping.get('POLICYNO', None), proposal_no)
            if pd.isna(policy_no):
                policy_no = proposal_no
            
            product_name = row.get(column_mapping.get('PRODUCT_NAME', None), 'Standard')
            if pd.isna(product_name):
                product_name = 'Standard'
            
            poly_status = row.get(column_mapping.get('POLY_STATUS', None), '')
            if pd.isna(poly_status):
                poly_status = ''
            
            matching_records += 1
            
            row_dict = {
                'PROPOSALNO': str(proposal_no),
                'POLICYNO': str(policy_no),
                'PROPOSAL_RECEIVED_DATE': submission_date,
                'RISK_COMMENCEMENT_DATE': risk_date,
                'AGENT_CODE': str(agent_code),
                'AGENT_NAME': str(agent_name),
                'AFYC': premium,
                'PROPOSAL_STATUS': str(proposal_status).lower(),
                'AM_NAME': am_name,
                'PRODUCT_NAME': str(product_name),
                'POLY_STATUS': str(poly_status).lower(),
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
        
        logger.info(f"📊 Matching records found: {matching_records}")
        logger.info(f"✅ Successfully synced {total_records} records")
        
        return total_records, None
        
    except Exception as e:
        logger.error(f"❌ Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return 0, None

def process_report_316_large_file(file_path, parse_entry_month_func=None, chunk_size=5000):
    """
    Process large Report 316 files with support for XLSB format
    """
    return process_excel_file(file_path, parse_entry_month_func, chunk_size)

def process_report_316(file_path, parse_entry_month_func=None):
    """
    Main function to process Report 316 files
    """
    if not os.path.exists(file_path):
        logger.error(f"❌ File not found: {file_path}")
        return 0, None
    
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    logger.info(f"📏 File size: {file_size_mb:.2f}MB")
    
    return process_report_316_large_file(file_path, parse_entry_month_func)
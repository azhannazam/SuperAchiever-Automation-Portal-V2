import pandas as pd
import os
from datetime import datetime
# Updated import to match your new folder structure
from database import sync_to_supabase 

def process_report_316(file_path):
    # 1. Load the file
    df = pd.read_excel(file_path)
    
    # 2. Filter by GAM_NAME (Matches the 164 records you fixed earlier)
    filtered_df = df[df['GAM_NAME'].str.strip().str.contains('SuperAchiever', case=False, na=False)].copy()
    
    # 3. Required columns (Matches your SQLite schema)
    required_columns = [
        "PROPOSAL_STATUS", "ENTRY_DATE", "PROPOSALNO", 
        "RISK_COMMENCEMENT_DATE", "AM_NAME", "AGENT_NAME", 
        "AGENT_CODE", "PAYMENT_METHOD", "AFYC", "Factor", 
        "TOTAL_EXPECTED_DUE", "POLY_STATUS", "POLICYNO", "PRODUCT_NAME", "PAYMENT_FREQUENCY"
    ]
    
    existing_cols = [col for col in required_columns if col in filtered_df.columns]
    final_df = filtered_df[existing_cols].copy()

    # 4. Data Cleaning
    numeric_cols = ["AFYC", "Factor", "TOTAL_EXPECTED_DUE"]
    for col in numeric_cols:
        if col in final_df.columns:
            final_df[col] = pd.to_numeric(final_df[col], errors='coerce').fillna(0)
    
    # 5. Save to Supabase (Cloud Sync)
    # Instead of local SQLite, we now push to the cloud for the React UI
    sync_to_supabase(final_df)
    
    # 6. Create the "Daily Submission" Excel file
    # We move this to the root data folder
    output_folder = "../data/daily_submissions" 
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    output_filename = f"{output_folder}/Daily_Submissions_{timestamp}.xlsx"
    
    final_df.to_excel(output_filename, index=False)
    
    return len(final_df), output_filename
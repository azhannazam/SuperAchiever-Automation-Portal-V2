import os
from excel_bot import process_report_316

# 1. Provide the path to your raw Excel report
# Place your Report 316 inside the python_engine folder for this test
raw_file = "Report_316_Actual_Feb.xlsx" 

if __name__ == "__main__":
    if os.path.exists(raw_file):
        print("🤖 Starting SuperAchiever Bot...")
        count, output = process_report_316(raw_file)
        print(f"✅ Success! Processed {count} records and synced to Supabase.")
        print(f"📁 Clean report saved at: {output}")
    else:
        print(f"❌ Error: Could not find {raw_file} in the python_engine folder.")
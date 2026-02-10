import pandas as pd
from database import supabase # Reuses your existing setup

def import_agent_master(file_path):
    # 1. Read Sheet 1 (All Agents)
    # 'header=2' tells Python that the real headers are on the 3rd row
    df = pd.read_excel(file_path, sheet_name="Sheet1", header=2) 
    
    # 2. Rename columns to match your Supabase 'profiles' table
    # Mapping: Excel Column -> Supabase Column
    df = df.rename(columns={
        'NAME': 'full_name', 
        'AGENT CODE': 'agent_code', 
        'Email': 'email',
        'RANK': 'rank'
    })

    # 3. Clean up: Remove rows without an Agent Code
    df = df.dropna(subset=['agent_code'])

    print(f"🚀 Found {len(df)} agents. Starting sync...")

    for _, row in df.iterrows():
        # --- CLEANING DATA FOR NULL VALUES ---
        # Extracts values and handles empty (NaN) cells gracefully
        email_val = row.get('email')
        name_val = row.get('full_name')
        agent_code_val = str(row.get('agent_code')).strip() # Removes hidden spaces
        
        profile_data = {
            "agent_code": agent_code_val,
            "full_name": str(name_val) if pd.notnull(name_val) else "Unknown Agent",
            "email": str(email_val).lower().strip() if pd.notnull(email_val) and str(email_val).lower() != 'nan' else None,
            "rank": str(row.get('rank', ''))
        }
        
        try:
            # 'upsert' adds the agent or updates them if the agent_code already exists
            # Requires 'agent_code' to be set as a Unique/Primary Key in Supabase
            supabase.table("profiles").upsert(profile_data, on_conflict="agent_code").execute()
        except Exception as e:
            print(f"❌ Error importing {agent_code_val}: {e}")

if __name__ == "__main__":
    # Ensure this filename matches your file exactly
    import_agent_master("Master Listing 2026.xlsx")
    print("✅ Master Listing Import Complete!")
# python_engine/import_master.py
import pandas as pd
from database import supabase

def import_agent_master(file_path):
    """
    Import agent master and return count of imported agents
    """
    # 1. Read Sheet 1
    df = pd.read_excel(file_path, sheet_name="Sheet1", header=2) 
    
    # 2. Rename columns
    df = df.rename(columns={
        'NAME': 'full_name', 
        'AGENT CODE': 'agent_code', 
        'Email': 'email',
        'RANK': 'rank',
        'INTRODUCER': 'introducer_name',
        'LEADER': 'leader_name'
    })

    # 3. Clean up
    df = df.dropna(subset=['agent_code'])
    
    print(f"🚀 Found {len(df)} agents. Starting sync...")
    
    success_count = 0
    error_count = 0

    for _, row in df.iterrows():
        try:
            email_val = row.get('email')
            name_val = row.get('full_name')
            agent_code_val = str(row.get('agent_code')).strip()
            
            profile_data = {
                "agent_code": agent_code_val,
                "full_name": str(name_val) if pd.notnull(name_val) else "Unknown Agent",
                "email": str(email_val).lower().strip() if pd.notnull(email_val) and str(email_val).lower() != 'nan' else None,
                "rank": str(row.get('rank', '')),
                "introducer_name": str(row.get('introducer_name', '')), 
                "leader_name": str(row.get('leader_name', ''))
            }
            
            supabase.table("profiles").upsert(profile_data, on_conflict="agent_code").execute()
            success_count += 1
            
        except Exception as e:
            print(f"❌ Error importing {agent_code_val}: {e}")
            error_count += 1
    
    print(f"✅ Import complete: {success_count} successful, {error_count} errors")
    return success_count

if __name__ == "__main__":
    import_agent_master("Master Listing 2026.xlsx")
    print("✅ Master Listing Import Complete!")
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

# Use the credentials from your project
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role key for backend scripts
supabase = create_client(url, key)

def sync_to_supabase(df):
    for _, row in df.iterrows():
        agent_code = str(row.get('AGENT_CODE')).strip()
        
        # 1. Check if agent exists
        check = supabase.table("profiles").select("agent_code").eq("agent_code", agent_code).execute()
        
        if not check.data:
            print(f"⚠️ Skipping: Agent {agent_code} not found in Master Listing.")
            continue
            
        case_data = {
            # Use AGENT_NAME for the client_name field in your app
            "client_name": str(row.get('AGENT_NAME')), 
            "policy_number": str(row.get('PROPOSALNO')),
            "premium": float(row.get('AFYC')),
            "status": "approved" if "Inforce" in str(row.get('PROPOSAL_STATUS')) else "pending",
            "submission_date": str(row.get('ENTRY_DATE')),
            # Use the actual AGENT_CODE from the row
            "agent_id": str(row.get('AGENT_CODE')).strip() 
        }
        
        try:
            # CHANGE: Use .upsert() and specify 'policy_number' as the conflict column
            supabase.table("cases").upsert(case_data, on_conflict="policy_number").execute()
        except Exception as e:
            print(f"❌ Error syncing policy {row.get('PROPOSALNO')}: {e}")
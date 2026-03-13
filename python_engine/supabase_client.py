# python_engine/supabase_client.py
from supabase import create_client
import os
from dotenv import load_dotenv
from pathlib import Path

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
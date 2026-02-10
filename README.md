🏆 SuperAchiever Dashboard
A real-time insurance case management system built with React, TypeScript, and Supabase. This dashboard allows agents to track their premium performance and view live leaderboards based on synced Excel data.

🚀 Features
Live Dashboard: Real-time calculation of total premiums and case counts for the logged-in agent.

Dynamic Leaderboards: Rankings categorized by GAD, AD, AGM, and Agent levels.

Excel Data Sync: A Python integration that automatically cleans and uploads insurance records to Supabase.

Secure Auth: Gmail/Email login system with role-based access.

🛠️ Tech Stack
Frontend: React + Vite, Tailwind CSS, Lucide Icons.

Backend: Supabase (PostgreSQL, Auth, RLS).

Data Processing: Python (Pandas) for Excel ingestion.

📂 Project Structure
Plaintext
├── src/
│   ├── integrations/supabase/  # Supabase client & types
│   ├── pages/                 # Dashboard, Leaderboards, Auth views
│   └── hooks/                 # Auth and session management
├── python/
│   ├── run.py                 # Main sync script
│   └── database.py            # Database connection logic
└── supabase/
    └── migrations/            # SQL schema history
    
⚙️ Setup & Installation
1. Database Configuration
Create a profiles table and a cases table in Supabase.

Link your User UUID from Supabase Auth to your Agent Code in the profiles table to enable personal data tracking.

2. Syncing Excel Data
Ensure your Python environment is set up, then run the sync script:

Bash
python run.py
This script will process the records and update the Supabase cases table.

3. Frontend Development
Install dependencies and start the local server:

Bash
npm install
npm run dev
🛡️ License
Private - For Internal Use Only.
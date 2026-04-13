# python_engine/import_master.py
import pandas as pd
from database import supabase
from manage_transfers import TransferManager
from datetime import datetime, date
import traceback

def find_header_row(file_path, sheet_name, max_rows_to_check=5):
    """
    Scan through the first few rows to find where the actual headers are.
    Returns the row index (0-based) where headers are found, or None if not found.
    """
    # Expected column keywords to look for
    expected_keywords = ['NAME', 'AGENT', 'CODE', 'EMAIL', 'RANK', 'INTRODUCER', 'LEADER', 'STATUS', 'EFFECTIVE', 'TERMINATED']
    
    # Read the first max_rows_to_check rows without headers
    df_preview = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=max_rows_to_check)
    
    print(f"🔍 Scanning first {max_rows_to_check} rows for headers...")
    
    for row_idx in range(max_rows_to_check):
        row = df_preview.iloc[row_idx]
        row_str = ' | '.join([str(val) for val in row if pd.notna(val)])
        print(f"  Row {row_idx + 1}: {row_str[:100]}...")
        
        # Count how many expected keywords are in this row
        keyword_matches = 0
        for cell in row:
            if pd.isna(cell):
                continue
            cell_str = str(cell).upper()
            for keyword in expected_keywords:
                if keyword in cell_str:
                    keyword_matches += 1
                    break
        
        # If we find at least 3 keywords, this is likely the header row
        if keyword_matches >= 3:
            print(f"✅ Found header at row {row_idx + 1} with {keyword_matches} keyword matches")
            return row_idx
    
    print("⚠️ Could not find header row, using first row")
    return 0

def detect_status_changes(old_profiles_df, new_profiles_df):
    """
    Detect agents whose status changed from active to terminated
    Returns list of terminated agents with their details
    """
    # Create lookup dictionaries
    old_status = {}
    old_rank = {}
    
    for _, row in old_profiles_df.iterrows():
        agent_code = row.get('agent_code')
        if agent_code:
            old_status[agent_code] = row.get('status', 'active')
            old_rank[agent_code] = row.get('rank', '')
    
    terminated_agents = []
    reactivated_agents = []
    
    for _, row in new_profiles_df.iterrows():
        agent_code = row.get('agent_code')
        if not agent_code:
            continue
        
        new_status = row.get('agent_status', 'active')
        new_rank = row.get('rank', '')
        
        # Try to get terminated date from various possible column names
        terminated_date = None
        if 'terminated_date' in row and pd.notna(row['terminated_date']):
            terminated_date = row['terminated_date']
        elif 'termination_date' in row and pd.notna(row['termination_date']):
            terminated_date = row['termination_date']
        elif 'effective_date' in row and pd.notna(row['effective_date']):
            terminated_date = row['effective_date']
        
        # Convert status to lowercase for comparison
        if isinstance(new_status, str):
            new_status = new_status.lower().strip()
        
        old_status_val = old_status.get(agent_code, 'active')
        old_rank_val = old_rank.get(agent_code, '')
        
        # Detect termination (active → terminated/inactive/removed)
        if old_status_val == 'active' and new_status in ['terminated', 'inactive', 'removed']:
            # Parse terminated date
            effective_date = None
            if terminated_date:
                try:
                    if isinstance(terminated_date, (datetime, pd.Timestamp)):
                        effective_date = terminated_date.date().isoformat()
                    else:
                        effective_date = pd.to_datetime(terminated_date).date().isoformat()
                except:
                    effective_date = date.today().isoformat()
            else:
                effective_date = date.today().isoformat()
            
            terminated_agents.append({
                'agent_code': agent_code,
                'old_rank': old_rank_val,
                'new_rank': new_rank,
                'terminated_date': effective_date
            })
            print(f"  🔴 Detected terminated: {agent_code}")
        
        # Detect reactivation (terminated → active)
        elif old_status_val in ['terminated', 'inactive', 'removed'] and new_status == 'active':
            reactivated_agents.append({
                'agent_code': agent_code,
                'old_rank': old_rank_val,
                'new_rank': new_rank
            })
            print(f"  🟢 Detected reactivated: {agent_code}")
    
    return terminated_agents, reactivated_agents

def get_upline_for_terminated_agent(agent_code: str, agent_rank: str, profiles_df: pd.DataFrame, transfer_manager: TransferManager):
    """
    Determine who should get credit for a terminated agent
    Returns (upline_code, transfer_type)
    """
    rank_upper = agent_rank.upper() if agent_rank else ''
    
    # Get agent's record from the new master listing
    agent_row = profiles_df[profiles_df['agent_code'] == agent_code]
    if agent_row.empty:
        return None, None
    
    leader_name = agent_row.iloc[0].get('leader_name', '')
    introducer_name = agent_row.iloc[0].get('introducer_name', '')
    
    upline = leader_name or introducer_name
    
    # Determine transfer type based on rank
    if 'AGENT' in rank_upper:
        transfer_type = 'AGENT_TO_AD'
        
        # Agent should go to AD or GAD
        if upline:
            upline_rank = transfer_manager.get_agent_rank(upline)
            if upline_rank and ('AGENCY DIRECTOR' in upline_rank.upper() or 'AD' in upline_rank.upper()):
                return upline, transfer_type
            elif upline_rank and ('GROUP AGENCY DIRECTOR' in upline_rank.upper() or 'GAD' in upline_rank.upper()):
                return upline, transfer_type
        
        # Fallback to GAD
        return transfer_manager.gad_code, transfer_type
    
    elif 'AGENCY GROWTH MANAGER' in rank_upper or 'AGM' in rank_upper:
        transfer_type = 'AGM_TO_AD'
        
        # AGM should go to AD or GAD
        if upline:
            upline_rank = transfer_manager.get_agent_rank(upline)
            if upline_rank and ('AGENCY DIRECTOR' in upline_rank.upper() or 'AD' in upline_rank.upper()):
                return upline, transfer_type
            elif upline_rank and ('GROUP AGENCY DIRECTOR' in upline_rank.upper() or 'GAD' in upline_rank.upper()):
                return upline, transfer_type
        
        return transfer_manager.gad_code, transfer_type
    
    elif 'AGENCY DIRECTOR' in rank_upper or 'AD' in rank_upper:
        transfer_type = 'AD_TO_GAD'
        
        # AD should go to GAD
        if upline:
            upline_rank = transfer_manager.get_agent_rank(upline)
            if upline_rank and ('GROUP AGENCY DIRECTOR' in upline_rank.upper() or 'GAD' in upline_rank.upper()):
                return upline, transfer_type
        
        return transfer_manager.gad_code, transfer_type
    
    else:
        return None, None

def create_transfer_record(agent_code: str, transferred_to: str, effective_date: str, 
                          transfer_type: str, reason: str) -> bool:
    """
    Create transfer records in both current_transfers and agent_transfers tables
    """
    try:
        # Insert into agent_transfers (history table)
        agent_transfer_data = {
            "agent_code": agent_code,
            "transferred_to": transferred_to,
            "transfer_date": date.today().isoformat(),
            "effective_date": effective_date,
            "reason": reason,
            "transfer_type": transfer_type,
            "notes": f"Auto-generated from master listing import. Effective from {effective_date}",
            "created_by": "system",
            "updated_by": "system"
        }
        
        history_result = supabase.table("agent_transfers").insert(agent_transfer_data).execute()
        
        if not history_result.data:
            print(f"    ❌ Failed to insert into agent_transfers")
            return False
        
        # Insert into current_transfers (active transfers table)
        current_transfer_data = {
            "agent_code": agent_code,
            "transferred_to": transferred_to,
            "effective_date": effective_date,
            "reason": reason,
            "transfer_type": transfer_type
        }
        
        current_result = supabase.table("current_transfers").upsert(
            current_transfer_data, on_conflict="agent_code"
        ).execute()
        
        if current_result.data:
            print(f"    ✅ Created {transfer_type} transfer: {agent_code} → {transferred_to}")
            return True
        else:
            print(f"    ❌ Failed to insert into current_transfers")
            return False
            
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return False

def remove_transfer_record(agent_code: str) -> bool:
    """
    Remove transfer records for reactivated agents
    """
    try:
        # Remove from current_transfers
        supabase.table("current_transfers").delete().eq("agent_code", agent_code).execute()
        
        # Add a note to agent_transfers that the transfer ended
        note_data = {
            "agent_code": agent_code,
            "transferred_to": None,
            "transfer_date": date.today().isoformat(),
            "effective_date": date.today().isoformat(),
            "reason": "Agent reactivated - transfer ended",
            "transfer_type": "REACTIVATED",
            "notes": "Agent status changed back to active",
            "created_by": "system",
            "updated_by": "system"
        }
        supabase.table("agent_transfers").insert(note_data).execute()
        
        print(f"    ✅ Removed transfer for reactivated agent")
        return True
        
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return False

def detect_removed_ads(old_df, new_df):
    """
    Compare old and new master listings to find ADs that were completely removed
    Returns list of AD codes that disappeared
    """
    # Get ADs from old master (assuming rank column indicates AD)
    old_ads = old_df[old_df['rank'].str.contains('AGENCY DIRECTOR', na=False, case=False)]['agent_code'].tolist()
    
    # Get ADs from new master
    new_ads = new_df[new_df['rank'].str.contains('AGENCY DIRECTOR', na=False, case=False)]['agent_code'].tolist()
    
    # Find ADs that were in old but not in new
    removed_ads = [ad for ad in old_ads if ad not in new_ads]
    
    return removed_ads

def handle_removed_ads(removed_ads):
    """
    Mark removed ADs and all their agents as 'removed' in status
    """
    if not removed_ads:
        print("✅ No removed ADs found")
        return
    
    print(f"\n🔍 Found {len(removed_ads)} ADs completely removed from master listing:")
    total_agents_removed = 0
    
    for ad_code in removed_ads:
        # Find all agents under this AD
        agents_result = supabase.table("profiles") \
            .select("agent_code") \
            .eq("leader_name", ad_code) \
            .execute()
        
        agent_codes = [a['agent_code'] for a in agents_result.data]
        
        # Mark AD as removed
        supabase.table("profiles") \
            .update({"status": "removed"}) \
            .eq("agent_code", ad_code) \
            .execute()
        
        print(f"  ✅ Marked AD {ad_code} as removed")
        
        # Mark all agents under this AD as removed
        if agent_codes:
            supabase.table("profiles") \
                .update({"status": "removed"}) \
                .in_("agent_code", agent_codes) \
                .execute()
            print(f"     Marked {len(agent_codes)} agents under {ad_code} as removed")
            total_agents_removed += len(agent_codes)
    
    print(f"\n✅ Total: {len(removed_ads)} ADs and {total_agents_removed} agents marked as removed")

def parse_join_date(date_value):
    """
    Parse join date from Excel to proper date format
    Returns None if invalid, otherwise returns date string in YYYY-MM-DD format
    """
    if pd.isna(date_value) or str(date_value).lower() == 'nan' or str(date_value).strip() == '':
        return None
    
    try:
        # If it's already a datetime object
        if isinstance(date_value, (datetime, pd.Timestamp)):
            return date_value.strftime('%Y-%m-%d')
        
        # If it's a string, try to parse it
        date_str = str(date_value).strip()
        
        # Try common date formats
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%m-%d-%Y', '%Y/%m/%d']:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # Try Excel serial number (days since 1899-12-30)
        if isinstance(date_value, (int, float)):
            excel_epoch = datetime(1899, 12, 30)
            parsed_date = excel_epoch + pd.Timedelta(days=date_value)
            return parsed_date.strftime('%Y-%m-%d')
        
        print(f"⚠️ Could not parse date: {date_value}")
        return None
    except Exception as e:
        print(f"⚠️ Error parsing date {date_value}: {e}")
        return None

def import_agent_master(file_path, previous_master_path=None):
    """
    Import agent master and return count of imported agents
    If previous_master_path is provided, will detect removed ADs
    """
    try:
        # ============================================
        # STEP 1: Read the Excel file
        # ============================================
        
        # First, check what sheets are available in the Excel file
        xl = pd.ExcelFile(file_path)
        available_sheets = xl.sheet_names
        print(f"📊 Available sheets: {available_sheets}")
        
        # Try to find the correct sheet
        sheet_to_use = None
        
        # Look for common sheet names
        possible_sheets = ['Sheet1', 'Sheet 1', 'MASTER', 'Master', 'DATA', 'Data', 'Agents', 'AGENTS', 'RawData']
        
        for sheet in possible_sheets:
            if sheet in available_sheets:
                sheet_to_use = sheet
                print(f"✅ Using sheet: {sheet_to_use}")
                break
        
        # If no common sheet found, use the first sheet
        if sheet_to_use is None and len(available_sheets) > 0:
            sheet_to_use = available_sheets[0]
            print(f"⚠️ No common sheet found, using first sheet: {sheet_to_use}")
        
        if sheet_to_use is None:
            raise ValueError("No sheets found in the Excel file")
        
        # Automatically find the header row
        header_row = find_header_row(file_path, sheet_to_use)
        
        # Read the Excel file with the detected header row
        print(f"📖 Reading file with header at row {header_row + 1}")
        df = pd.read_excel(file_path, sheet_name=sheet_to_use, header=header_row)
        
        # Clean up column names (remove any leading/trailing spaces)
        df.columns = [str(col).strip() if pd.notna(col) else f"Unnamed_{i}" for i, col in enumerate(df.columns)]
        
        # Print actual column names to help debugging
        print(f"📋 Actual columns in file: {list(df.columns)}")
        
        # ============================================
        # STEP 2: Map columns
        # ============================================
        
        # Create a clean column mapping without duplicates
        column_mapping = {}
        used_targets = set()
        
        # Priority mapping - most important columns first
        priority_mapping = [
            ('NAME', 'full_name'),
            ('AGENT CODE', 'agent_code'),
            ('AGENT_CODE', 'agent_code'),
            ('EMAIL', 'email'),
            ('RANK', 'rank'),
            ('INTRODUCER', 'introducer_name'),
            ('LEADER', 'leader_name'),
            ('STATUS', 'agent_status'),
            ('EFFECTIVE', 'join_date'),
            ('TERMINATED DATE', 'terminated_date'),
            ('TERMINATION DATE', 'terminated_date')
        ]
        
        # First pass: try exact matches with priority
        for col in df.columns:
            col_str = str(col).upper().strip()
            
            for search_term, target in priority_mapping:
                if search_term in col_str and target not in used_targets:
                    # Check if this is the best match (avoid 'INTRODUCER RANK' matching 'rank')
                    if search_term == 'RANK' and 'INTRODUCER' in col_str:
                        continue
                    
                    column_mapping[col] = target
                    used_targets.add(target)
                    print(f"  ✅ Mapped '{col}' → '{target}'")
                    break
        
        # Second pass: for any remaining unmapped columns, try contains matching
        for col in df.columns:
            if col in column_mapping:
                continue
                
            col_str = str(col).upper().strip()
            
            if 'NAME' in col_str and 'full_name' not in used_targets:
                column_mapping[col] = 'full_name'
                used_targets.add('full_name')
                print(f"  ✅ Mapped '{col}' → 'full_name' (fallback)")
            elif 'AGENT CODE' in col_str and 'agent_code' not in used_targets:
                column_mapping[col] = 'agent_code'
                used_targets.add('agent_code')
                print(f"  ✅ Mapped '{col}' → 'agent_code' (fallback)")
            elif 'EMAIL' in col_str and 'email' not in used_targets:
                column_mapping[col] = 'email'
                used_targets.add('email')
                print(f"  ✅ Mapped '{col}' → 'email' (fallback)")
            elif 'RANK' in col_str and 'rank' not in used_targets and 'INTRODUCER' not in col_str:
                column_mapping[col] = 'rank'
                used_targets.add('rank')
                print(f"  ✅ Mapped '{col}' → 'rank' (fallback)")
            elif 'INTRODUCER' in col_str and 'introducer_name' not in used_targets:
                column_mapping[col] = 'introducer_name'
                used_targets.add('introducer_name')
                print(f"  ✅ Mapped '{col}' → 'introducer_name' (fallback)")
            elif 'LEADER' in col_str and 'leader_name' not in used_targets:
                column_mapping[col] = 'leader_name'
                used_targets.add('leader_name')
                print(f"  ✅ Mapped '{col}' → 'leader_name' (fallback)")
            elif 'STATUS' in col_str and 'agent_status' not in used_targets:
                column_mapping[col] = 'agent_status'
                used_targets.add('agent_status')
                print(f"  ✅ Mapped '{col}' → 'agent_status' (fallback)")
            elif 'EFFECTIVE' in col_str and 'join_date' not in used_targets:
                column_mapping[col] = 'join_date'
                used_targets.add('join_date')
                print(f"  ✅ Mapped '{col}' → 'join_date' (fallback)")
        
        if column_mapping:
            print(f"\n🔄 Renaming columns: {column_mapping}")
            df = df.rename(columns=column_mapping)
        else:
            # Fallback to original mapping
            print("⚠️ No columns matched, using default mapping")
            if len(df.columns) >= 6:
                df = df.rename(columns={
                    df.columns[0]: 'full_name',
                    df.columns[1]: 'agent_code',
                    df.columns[2]: 'email',
                    df.columns[3]: 'rank',
                    df.columns[4]: 'introducer_name',
                    df.columns[5]: 'leader_name'
                })
                print(f"  Using column positions: 0→full_name, 1→agent_code, 2→email, 3→rank, 4→introducer_name, 5→leader_name")
        
        # ============================================
        # STEP 3: Get current profiles before import
        # ============================================
        
        print("\n📊 Fetching current profiles from database...")
        current_result = supabase.table("profiles").select("*").execute()
        old_profiles_df = pd.DataFrame(current_result.data) if current_result.data else pd.DataFrame()
        print(f"  Found {len(old_profiles_df)} existing profiles")
        
        # ============================================
        # STEP 4: Clean and prepare data
        # ============================================
        
        # Check if we have the required agent_code column
        if 'agent_code' not in df.columns:
            print("❌ No 'agent_code' column found after mapping!")
            print(f"Available columns: {list(df.columns)}")
            
            # Try to find any column that might contain agent codes
            for col in df.columns:
                sample = df[col].iloc[0] if len(df) > 0 else ""
                if isinstance(sample, str) and (sample.startswith('4ET') or sample.startswith('KET') or sample.startswith('1ET')):
                    print(f"🔍 Found potential agent codes in column '{col}'")
                    df = df.rename(columns={col: 'agent_code'})
                    break
            
            if 'agent_code' not in df.columns:
                return 0

        # Clean up - remove rows without agent_code
        df = df.dropna(subset=['agent_code'])
        df = df[df['agent_code'].astype(str).str.strip() != '']
        df = df[df['agent_code'].astype(str).str.lower() != 'nan']
        
        print(f"🚀 Found {len(df)} agents. Starting sync...")
        
        # ============================================
        # STEP 5: Import profiles to database
        # ============================================
        
        success_count = 0
        error_count = 0
        status_mapping = {
            'ACTIVE': 'active',
            'TERMINATED': 'terminated',
            'SUSPENDED': 'suspended',
            'INACTIVE': 'terminated',
            'REMOVED': 'terminated',
            'active': 'active',
            'terminated': 'terminated',
            'suspended': 'suspended'
        }

        for _, row in df.iterrows():
            try:
                agent_code_val = str(row.get('agent_code', '')).strip()
                
                if not agent_code_val or agent_code_val == 'nan' or agent_code_val == '':
                    continue
                
                # Get other values with proper null handling
                name_val = row.get('full_name')
                if pd.isna(name_val) or str(name_val).lower() == 'nan':
                    name_val = "Unknown Agent"
                
                email_val = row.get('email')
                if pd.isna(email_val) or str(email_val).lower() == 'nan':
                    email_val = None
                
                rank_val = row.get('rank')
                if pd.isna(rank_val) or str(rank_val).lower() == 'nan':
                    rank_val = ''
                
                introducer_val = row.get('introducer_name')
                if pd.isna(introducer_val) or str(introducer_val).lower() == 'nan':
                    introducer_val = ''
                
                leader_val = row.get('leader_name')
                if pd.isna(leader_val) or str(leader_val).lower() == 'nan':
                    leader_val = ''
                
                # Handle agent status from Excel
                status_val = row.get('agent_status')
                if pd.isna(status_val) or str(status_val).lower() == 'nan' or str(status_val).strip() == '':
                    status_val = 'active'
                else:
                    status_str = str(status_val).strip().upper()
                    status_val = status_mapping.get(status_str, 'active')
                
                # Handle join_date from EFFECTIVE column
                join_date_val = row.get('join_date')
                join_date_parsed = parse_join_date(join_date_val)
                
                # Handle terminated date if present
                terminated_date_val = row.get('terminated_date')
                terminated_date_parsed = None
                if terminated_date_val and pd.notna(terminated_date_val):
                    terminated_date_parsed = parse_join_date(terminated_date_val)
                
                profile_data = {
                    "agent_code": agent_code_val,
                    "full_name": str(name_val),
                    "email": str(email_val).lower().strip() if email_val else None,
                    "rank": str(rank_val),
                    "introducer_name": str(introducer_val), 
                    "leader_name": str(leader_val),
                    "status": status_val,
                    "join_date": join_date_parsed,
                    "terminated_date": terminated_date_parsed
                }
                
                # Remove None values to avoid Supabase issues
                profile_data = {k: v for k, v in profile_data.items() if v is not None}
                
                supabase.table("profiles").upsert(profile_data, on_conflict="agent_code").execute()
                success_count += 1
                
                if success_count % 100 == 0:
                    print(f"  ✅ Imported {success_count} agents...")
                
            except Exception as e:
                print(f"❌ Error importing {agent_code_val if 'agent_code_val' in locals() else 'unknown'}: {e}")
                error_count += 1
        
        print(f"✅ Import complete: {success_count} successful, {error_count} errors")
        
        # ============================================
        # STEP 6: AUTO-CREATE TRANSFERS FOR TERMINATED AGENTS
        # ============================================
        
        print("\n" + "="*60)
        print("🤖 AUTO-CREATING TRANSFERS FOR TERMINATED AGENTS")
        print("="*60)
        
        # Detect status changes
        terminated_agents, reactivated_agents = detect_status_changes(old_profiles_df, df)
        
        print(f"\n📊 Detected Changes:")
        print(f"  Terminated agents: {len(terminated_agents)}")
        print(f"  Reactivated agents: {len(reactivated_agents)}")
        
        if terminated_agents:
            print(f"\n🔄 Processing {len(terminated_agents)} terminated agents...")
            
            # Initialize transfer manager
            transfer_manager = TransferManager()
            
            transfers_created = 0
            transfers_failed = 0
            
            for agent in terminated_agents:
                agent_code = agent['agent_code']
                agent_rank = agent['old_rank']
                effective_date = agent['terminated_date']
                
                print(f"\n  Processing: {agent_code} (Rank: {agent_rank})")
                
                # Determine upline and transfer type
                upline, transfer_type = get_upline_for_terminated_agent(
                    agent_code, agent_rank, df, transfer_manager
                )
                
                if not upline:
                    print(f"    ⚠️ Could not determine upline, skipping...")
                    transfers_failed += 1
                    continue
                
                # Create reason
                reason = f"Agent terminated. Credit transferred to {upline}"
                
                # Create transfer record
                success = create_transfer_record(
                    agent_code, upline, effective_date, transfer_type, reason
                )
                
                if success:
                    transfers_created += 1
                else:
                    transfers_failed += 1
            
            print(f"\n📊 Transfer Creation Results:")
            print(f"  ✅ Created: {transfers_created}")
            print(f"  ❌ Failed: {transfers_failed}")
        
        # Process reactivated agents (remove their transfers)
        if reactivated_agents:
            print(f"\n🔄 Processing {len(reactivated_agents)} reactivated agents...")
            
            transfers_removed = 0
            transfers_failed = 0
            
            for agent in reactivated_agents:
                agent_code = agent['agent_code']
                print(f"  Processing: {agent_code}")
                
                success = remove_transfer_record(agent_code)
                
                if success:
                    transfers_removed += 1
                else:
                    transfers_failed += 1
            
            print(f"\n📊 Transfer Removal Results:")
            print(f"  ✅ Removed: {transfers_removed}")
            print(f"  ❌ Failed: {transfers_failed}")
        
        # ============================================
        # STEP 7: Handle removed ADs (existing functionality)
        # ============================================
        
        if previous_master_path:
            print(f"\n📊 Comparing with previous master: {previous_master_path}")
            prev_df = pd.read_excel(previous_master_path)
            removed_ads = detect_removed_ads(prev_df, df)
            handle_removed_ads(removed_ads)
        
        # ============================================
        # STEP 8: Final verification
        # ============================================
        
        print("\n" + "="*60)
        print("📊 FINAL VERIFICATION")
        print("="*60)
        
        final_profiles = supabase.table("profiles").select("*", count="exact").execute()
        final_transfers = supabase.table("current_transfers").select("*", count="exact").execute()
        
        print(f"  Total profiles: {final_profiles.count if hasattr(final_profiles, 'count') else 0}")
        print(f"  Active transfers: {final_transfers.count if hasattr(final_transfers, 'count') else 0}")
        
        # Summary of status distribution
        print("\n📊 Status Distribution After Import:")
        status_counts = supabase.table("profiles") \
            .select("status", count="exact") \
            .execute()
        
        # Aggregate status counts
        status_summary = {}
        for profile in status_counts.data:
            status = profile.get('status', 'unknown')
            status_summary[status] = status_summary.get(status, 0) + 1
        
        for status, count in status_summary.items():
            print(f"  {status.upper()}: {count} agents")
        
        return success_count
        
    except Exception as e:
        print(f"❌ Error processing file: {e}")
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        previous_path = sys.argv[2] if len(sys.argv) > 2 else None
        import_agent_master(file_path, previous_path)
    else:
        import_agent_master("Master Listing 2026.xlsx")
    
    print("✅ Master Listing Import Complete!")
# python_engine/import_master.py
import pandas as pd
from database import supabase
from manage_transfers import TransferManager

def find_header_row(file_path, sheet_name, max_rows_to_check=5):
    """
    Scan through the first few rows to find where the actual headers are.
    Returns the row index (0-based) where headers are found, or None if not found.
    """
    # Expected column keywords to look for
    expected_keywords = ['NAME', 'AGENT', 'CODE', 'EMAIL', 'RANK', 'INTRODUCER', 'LEADER']
    
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

def import_agent_master(file_path, previous_master_path=None):
    """
    Import agent master and return count of imported agents
    If previous_master_path is provided, will detect removed ADs
    """
    try:
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
            ('LEADER', 'leader_name')
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
        
        # If previous master file provided, detect removed ADs
        if previous_master_path:
            print(f"\n📊 Comparing with previous master: {previous_master_path}")
            prev_df = pd.read_excel(previous_master_path)
            removed_ads = detect_removed_ads(prev_df, df)
            handle_removed_ads(removed_ads)
        
        success_count = 0
        error_count = 0

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
                
                # Check if there's a status column in the Excel
                status_val = row.get('status')
                if pd.isna(status_val) or str(status_val).lower() == 'nan':
                    status_val = 'active'  # Default to active
                
                profile_data = {
                    "agent_code": agent_code_val,
                    "full_name": str(name_val),
                    "email": str(email_val).lower().strip() if email_val else None,
                    "rank": str(rank_val),
                    "introducer_name": str(introducer_val), 
                    "leader_name": str(leader_val),
                    "status": str(status_val)  # Use status from Excel or default
                }
                
                supabase.table("profiles").upsert(profile_data, on_conflict="agent_code").execute()
                success_count += 1
                
                if success_count % 100 == 0:
                    print(f"  ✅ Imported {success_count} agents...")
                
            except Exception as e:
                print(f"❌ Error importing {agent_code_val if 'agent_code_val' in locals() else 'unknown'}: {e}")
                error_count += 1
        
        print(f"✅ Import complete: {success_count} successful, {error_count} errors")
        return success_count
        
    except Exception as e:
        print(f"❌ Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    # You can now pass previous master file
    import_agent_master("Master Listing 2026.xlsx", previous_master_path="Previous_Master_2025.xlsx")
    print("✅ Master Listing Import Complete!")
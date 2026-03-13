# python_engine/manage_transfers.py
from supabase_client import supabase  # Import from new file instead of database
import pandas as pd
from datetime import datetime, date
import logging
from typing import Optional, Dict, List, Tuple
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

class TransferManager:
    """Manage agent transfers with chain: Agent → AD → GAD (with AGM support)"""
    
    def __init__(self):
        self.supabase = supabase
        self.transfer_cache = {}
        self.gad_code = self._get_gad_code()
        self.load_current_transfers()
    
    def _get_gad_code(self) -> Optional[str]:
        """Get GAD agent code from profiles using rank column"""
        try:
            # Look for GROUP AGENCY DIRECTOR in rank column
            result = self.supabase.table("profiles") \
                .select("agent_code") \
                .ilike("rank", "%GROUP AGENCY DIRECTOR%") \
                .limit(1) \
                .execute()
            
            if result.data:
                return result.data[0]['agent_code']
            
            # Fallback: check for GAD in rank
            result = self.supabase.table("profiles") \
                .select("agent_code") \
                .ilike("rank", "%GAD%") \
                .limit(1) \
                .execute()
            
            if result.data:
                return result.data[0]['agent_code']
                
            logger.warning("⚠️ No GAD found in profiles")
            return None
        except Exception as e:
            logger.error(f"❌ Error fetching GAD: {e}")
            return None
    
    def load_current_transfers(self):
        """Load current transfers into cache"""
        try:
            result = self.supabase.table("agent_transfers") \
                .select("agent_code, transferred_to, transfer_type") \
                .order("effective_date", desc=True) \
                .execute()
            
            # Get only most recent per agent
            seen = set()
            for item in result.data:
                if item['agent_code'] not in seen:
                    self.transfer_cache[item['agent_code']] = {
                        'transferred_to': item['transferred_to'],
                        'type': item['transfer_type']
                    }
                    seen.add(item['agent_code'])
            
            logger.info(f"✅ Loaded {len(self.transfer_cache)} current transfers")
        except Exception as e:
            logger.error(f"❌ Error loading transfers: {e}")
    
    def get_agent_rank(self, agent_code: str) -> Optional[str]:
        """Get rank of an agent from profiles table"""
        try:
            result = self.supabase.table("profiles") \
                .select("rank") \
                .eq("agent_code", agent_code) \
                .maybe_single() \
                .execute()
            
            if result.data:
                return result.data.get('rank', '')
            return None
        except Exception as e:
            logger.error(f"❌ Error fetching rank for {agent_code}: {e}")
            return None
    
    def get_credited_agent(self, agent_code: str, submission_date: str = None) -> str:
        """
        Get the final credited agent following transfer chain
        Uses database function for accuracy
        """
        try:
            if submission_date:
                # Call the database function we created
                result = self.supabase.rpc(
                    'get_credited_agent',
                    {
                        'p_agent_code': agent_code,
                        'p_submission_date': submission_date[:10]  # Get just date part
                    }
                ).execute()
                if result.data:
                    return result.data
        except Exception as e:
            logger.error(f"❌ Error calling get_credited_agent: {e}")
        
        # Fallback to cache if RPC fails
        current = agent_code
        depth = 0
        max_depth = 3
        
        while depth < max_depth:
            transfer = self.transfer_cache.get(current)
            if not transfer:
                return current
            
            current = transfer['transferred_to']
            depth += 1
        
        return self.gad_code or current
    
    def import_transfers_from_excel(self, file_path: str) -> Dict[str, int]:
        """
        Import transfers from Excel
        Expected columns: agent_code, transferred_to, effective_date, reason, transfer_type, notes
        """
        try:
            df = pd.read_excel(file_path)
            required_cols = ['agent_code', 'transferred_to', 'effective_date', 'reason', 'transfer_type']
            
            missing = [col for col in required_cols if col not in df.columns]
            if missing:
                raise ValueError(f"Missing columns: {missing}")
            
            success_count = 0
            error_count = 0
            skipped_count = 0
            
            for idx, row in df.iterrows():
                try:
                    agent_code = str(row['agent_code']).strip()
                    transferred_to = str(row['transferred_to']).strip()
                    
                    # Validate agents exist
                    result = self.supabase.table("profiles") \
                        .select("agent_code, rank") \
                        .in_("agent_code", [agent_code, transferred_to]) \
                        .execute()
                    
                    if len(result.data) != 2:
                        logger.warning(f"⚠️ Row {idx+2}: One or both agents not found")
                        skipped_count += 1
                        continue
                    
                    # Create profile map for quick lookup
                    profile_map = {p['agent_code']: p['rank'] for p in result.data}
                    
                    # Convert transfer_type to lowercase for case-insensitive matching
                    raw_transfer_type = str(row['transfer_type']).strip()
                    transfer_type = raw_transfer_type.lower()
                    target_rank = profile_map[transferred_to].upper() if profile_map[transferred_to] else ''
                    
                    if transfer_type == 'agent_to_ad':
                        # Agent to AD - target must be AD or GAD
                        if 'AGENCY DIRECTOR' not in target_rank and 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                            logger.warning(f"⚠️ Row {idx+2}: {transferred_to} rank '{target_rank}' is not AD/GAD")
                            skipped_count += 1
                            continue
                    elif transfer_type == 'agm_to_ad':
                        # AGM to AD - target must be AD or GAD
                        if 'AGENCY DIRECTOR' not in target_rank and 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                            logger.warning(f"⚠️ Row {idx+2}: {transferred_to} rank '{target_rank}' is not AD/GAD")
                            skipped_count += 1
                            continue
                    elif transfer_type == 'ad_to_gad':
                        # AD to GAD - target must be GAD
                        if 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                            logger.warning(f"⚠️ Row {idx+2}: {transferred_to} rank '{target_rank}' is not GAD")
                            skipped_count += 1
                            continue
                    else:
                        logger.warning(f"⚠️ Row {idx+2}: Unknown transfer type '{raw_transfer_type}'")
                        skipped_count += 1
                        continue
                    
                    # Insert transfer (store in original case or lowercase? Let's use lowercase for consistency)
                    transfer_data = {
                        "agent_code": agent_code,
                        "transferred_to": transferred_to,
                        "transfer_date": date.today().isoformat(),
                        "effective_date": pd.to_datetime(row['effective_date']).date().isoformat(),
                        "reason": str(row['reason']).strip(),
                        "transfer_type": transfer_type,  # Store in lowercase
                        "notes": str(row.get('notes', '')).strip() if pd.notna(row.get('notes')) else None
                    }
                    
                    insert_result = self.supabase.table("agent_transfers").insert(transfer_data).execute()
                    
                    if insert_result.data:
                        success_count += 1
                        logger.info(f"  ✅ Added {transfer_type}: {agent_code} → {transferred_to}")
                    
                except Exception as e:
                    logger.error(f"❌ Error processing row {idx+2}: {e}")
                    error_count += 1
            
            # Reload cache
            self.load_current_transfers()
            
            return {
                "success": success_count,
                "error": error_count,
                "skipped": skipped_count,
                "total": len(df)
            }
            
        except Exception as e:
            logger.error(f"❌ Error importing transfers: {e}")
            return {"success": 0, "error": 0, "skipped": 0, "total": 0}
    
    def add_transfer(self, agent_code: str, transferred_to: str, 
                    effective_date: str, reason: str, 
                    transfer_type: str, notes: str = None) -> bool:
        """Add a single transfer manually"""
        try:
            # Validate agents exist
            result = self.supabase.table("profiles") \
                .select("agent_code, rank") \
                .in_("agent_code", [agent_code, transferred_to]) \
                .execute()
            
            if len(result.data) != 2:
                logger.error(f"❌ One or both agents not found")
                return False
            
            # Create profile map
            profile_map = {p['agent_code']: p['rank'] for p in result.data}
            
            # Convert transfer_type to lowercase for case-insensitive matching
            transfer_type = transfer_type.lower()
            target_rank = profile_map[transferred_to].upper() if profile_map[transferred_to] else ''
            
            if transfer_type == 'agent_to_ad':
                # Agent to AD - target must be AD or GAD
                if 'AGENCY DIRECTOR' not in target_rank and 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                    logger.error(f"❌ {transferred_to} rank '{target_rank}' is not AD/GAD")
                    return False
            elif transfer_type == 'agm_to_ad':
                # AGM to AD - target must be AD or GAD
                if 'AGENCY DIRECTOR' not in target_rank and 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                    logger.error(f"❌ {transferred_to} rank '{target_rank}' is not AD/GAD")
                    return False
            elif transfer_type == 'ad_to_gad':
                # AD to GAD - target must be GAD
                if 'GAD' not in target_rank and 'GROUP AGENCY DIRECTOR' not in target_rank:
                    logger.error(f"❌ {transferred_to} rank '{target_rank}' is not GAD")
                    return False
            else:
                logger.error(f"❌ Unknown transfer type: {transfer_type}")
                return False
            
            transfer_data = {
                "agent_code": agent_code,
                "transferred_to": transferred_to,
                "transfer_date": date.today().isoformat(),
                "effective_date": effective_date,
                "reason": reason,
                "transfer_type": transfer_type,  # Store in lowercase
                "notes": notes
            }
            
            insert_result = self.supabase.table("agent_transfers").insert(transfer_data).execute()
            
            if insert_result.data:
                # Reload cache
                self.load_current_transfers()
                logger.info(f"✅ Added {transfer_type}: {agent_code} → {transferred_to}")
                return True
            else:
                return False
            
        except Exception as e:
            logger.error(f"❌ Error adding transfer: {e}")
            return False
    
    def get_transfer_chain(self, agent_code: str) -> List[Dict]:
        """Get complete transfer chain for an agent"""
        try:
            result = self.supabase.table("agent_transfers") \
                .select("*") \
                .eq("agent_code", agent_code) \
                .order("effective_date", desc=True) \
                .execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"❌ Error getting transfer chain: {e}")
            return []
    
    def get_agents_under_ad(self, ad_code: str) -> List[Dict]:
        """Get all agents currently under a specific AD"""
        try:
            # Get from current transfers view
            result = self.supabase.table("current_transfers") \
                .select("agent_code, effective_date, reason, transfer_type") \
                .eq("transferred_to", ad_code) \
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"❌ Error getting agents under AD: {e}")
            return []
    
    def generate_report(self) -> Dict:
        """Generate transfer statistics report"""
        try:
            # Get transfer counts
            transfer_count = self.supabase.table("agent_transfers") \
                .select("*", count="exact", head=True) \
                .execute()
            
            # Get active transfers
            active = self.supabase.table("current_transfers") \
                .select("*", count="exact", head=True) \
                .execute()
            
            # Get cases with transfers
            cases = self.supabase.table("cases") \
                .select("*", count="exact", head=True) \
                .not_.is_("credited_agent_id", "null") \
                .execute()
            
            # Get counts by type (case insensitive using ilike)
            agent_to_ad = self.supabase.table("agent_transfers") \
                .select("*", count="exact", head=True) \
                .ilike("transfer_type", "agent_to_ad") \
                .execute()
            
            agm_to_ad = self.supabase.table("agent_transfers") \
                .select("*", count="exact", head=True) \
                .ilike("transfer_type", "agm_to_ad") \
                .execute()
            
            ad_to_gad = self.supabase.table("agent_transfers") \
                .select("*", count="exact", head=True) \
                .ilike("transfer_type", "ad_to_gad") \
                .execute()
            
            return {
                "total_transfers": transfer_count.count if hasattr(transfer_count, 'count') else 0,
                "active_transfers": active.count if hasattr(active, 'count') else 0,
                "cases_with_transfers": cases.count if hasattr(cases, 'count') else 0,
                "agent_to_ad_transfers": agent_to_ad.count if hasattr(agent_to_ad, 'count') else 0,
                "agm_to_ad_transfers": agm_to_ad.count if hasattr(agm_to_ad, 'count') else 0,
                "ad_to_gad_transfers": ad_to_gad.count if hasattr(ad_to_gad, 'count') else 0,
                "gad_code": self.gad_code
            }
            
        except Exception as e:
            logger.error(f"❌ Error generating report: {e}")
            return {}
    
    def export_transfers_to_csv(self, output_file: str):
        """Export all transfers to CSV for backup"""
        try:
            result = self.supabase.table("agent_transfers") \
                .select("*") \
                .order("effective_date", desc=True) \
                .execute()
            
            if result.data:
                df = pd.DataFrame(result.data)
                df.to_csv(output_file, index=False)
                logger.info(f"✅ Exported {len(df)} transfers to {output_file}")
            else:
                logger.warning("⚠️ No transfers to export")
            
        except Exception as e:
            logger.error(f"❌ Error exporting transfers: {e}")

# CLI Interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Manage agent transfers (Agent → AD → GAD with AGM support)")
    parser.add_argument("--import-excel", help="Import transfers from Excel file")
    parser.add_argument("--add", nargs=5, 
                       metavar=('AGENT', 'AD', 'DATE', 'REASON', 'TYPE'),
                       help="Add transfer: agent_code ad_code YYYY-MM-DD reason transfer_type (agent_to_ad/agm_to_ad/ad_to_gad)")
    parser.add_argument("--chain", help="Show full transfer chain for agent_code")
    parser.add_argument("--under-ad", help="Show all agents under an AD code")
    parser.add_argument("--report", action="store_true", help="Generate transfer report")
    parser.add_argument("--export", help="Export all transfers to CSV file")
    
    args = parser.parse_args()
    manager = TransferManager()
    
    if args.import_excel:
        result = manager.import_transfers_from_excel(args.import_excel)
        print(f"\n📊 Import Results:")
        print(f"  ✅ Success: {result['success']}")
        print(f"  ❌ Errors: {result['error']}")
        print(f"  ⚠️ Skipped: {result['skipped']}")
        print(f"  📁 Total: {result['total']}")
    
    elif args.add:
        agent, ad, date, reason, transfer_type = args.add
        success = manager.add_transfer(agent, ad, date, reason, transfer_type)
        print(f"Transfer {'added' if success else 'failed'}")
    
    elif args.chain:
        chain = manager.get_transfer_chain(args.chain)
        print(f"\n🔗 Transfer chain for {args.chain}:")
        if chain:
            for i, transfer in enumerate(chain, 1):
                print(f"  {i}. → {transfer['transferred_to']} ({transfer['effective_date']}, {transfer['transfer_type']}, {transfer['reason']})")
        else:
            print("  No transfers found")
    
    elif args.under_ad:
        agents = manager.get_agents_under_ad(args.under_ad)
        print(f"\n👥 Agents under AD {args.under_ad}:")
        if agents:
            for agent in agents:
                print(f"  • {agent['agent_code']} ({agent['transfer_type']}) since {agent['effective_date']}")
        else:
            print("  No agents found")
    
    elif args.report:
        report = manager.generate_report()
        print(f"\n📊 Transfer System Report:")
        print(f"  GAD Code: {report.get('gad_code', 'Not set')}")
        print(f"  Total Transfers: {report.get('total_transfers', 0)}")
        print(f"  Active Transfers: {report.get('active_transfers', 0)}")
        print(f"  Agent → AD Transfers: {report.get('agent_to_ad_transfers', 0)}")
        print(f"  AGM → AD Transfers: {report.get('agm_to_ad_transfers', 0)}")
        print(f"  AD → GAD Transfers: {report.get('ad_to_gad_transfers', 0)}")
        print(f"  Cases with Transfers: {report.get('cases_with_transfers', 0)}")
    
    elif args.export:
        manager.export_transfers_to_csv(args.export)
        print(f"✅ Exported to {args.export}")
    
    else:
        parser.print_help()
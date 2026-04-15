import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence, useAnimation, useInView } from "framer-motion";
import * as XLSX from 'xlsx';
import { 
  Trophy, Ticket, Sparkles, Users, Crown, Medal, Activity,
  Target, Flame, DollarSign, Award, CheckCircle2, AlertCircle,
  TrendingUp, Star, Clock, ShieldCheck, Plane, Gift, Coffee,
  TreePalm, Globe, MapPin, Umbrella, Upload, FileSpreadsheet,
  Database, RefreshCw, Zap, Rocket, Compass, Sun, Cloud,
  Mountain, Waves, Landmark, PartyPopper, Gem, Diamond,
  CalendarDays, AlertTriangle, Server, WifiOff, BookOpen,
  UsersRound, Briefcase, Building2, GraduationCap, HeartHandshake
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================
// 1. INTERFACES
// ============================================================

interface Profile {
  id: string;
  agent_code: string;
  full_name: string;
  rank: string;
  join_date: string;
  introducer_name?: string | null;
  leader_name?: string | null;
  cypr?: number;
  pr13?: number;
  cpd_hours?: number;
  status?: string;
  termination_date?: string | null;
}

interface Case {
  id: string;
  agent_id: string;
  premium: number;
  created_at: string;
  status: string;
  product_code?: string;
}

interface ENACEntry {
  agent_code: string;
  agent_name: string;
  rank: string;
  join_date: string;
  category: string;
  jan_to_mar_cases: number;
  apr_to_jun_cases: number;
  potential_ticket: "VIP" | "ORDINARY" | "NONE";
  pr13: number;
  cypr: number;
  cpd_hours: number;
  qualifies: boolean;
  persistency_pending?: boolean;
}

// ============================================================
// 2. ANIMATION VARIANTS
// ============================================================

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
  transition: { duration: 0.5, ease: "easeOut" }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } }
};

// ============================================================
// 3. MAIN PAGE COMPONENT
// ============================================================

export default function Contests() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeContest, setActiveContest] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string>("All");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // State for all contest data
  const [agentData, setAgentData] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allCases, setAllCases] = useState<Case[]>([]);
  
  // eNAC specific
  const [enacLeaderboard, setEnacLeaderboard] = useState<ENACEntry[]>([]);
  const [uploadedEnacData, setUploadedEnacData] = useState<Map<string, any>>(new Map());
  const [lastUploadDate, setLastUploadDate] = useState<string | null>(null);
  
  // Other leaderboards
  const [afycLeaderboard, setAfycLeaderboard] = useState<any[]>([]);
  const [growBigLeaderboard, setGrowBigLeaderboard] = useState<any[]>([]);

  const isAdmin = useMemo(() => role === "admin" || user?.email === "admin@superachiever.com", [role, user]);

  useEffect(() => { if (user) fetchAllData(); }, [user]);
  useEffect(() => { if (isAdmin) fetchUploadedData(); }, [isAdmin]);

  // Helper Functions
  const getPersistencyRatio = (profile: Profile, useUploadedData: boolean = false): { value: number; pending: boolean } => {
    if (useUploadedData && uploadedEnacData.has(profile.agent_code)) {
      const uploaded = uploadedEnacData.get(profile.agent_code);
      if (uploaded?.pr13 > 0) return { value: uploaded.pr13, pending: false };
      if (uploaded?.cypr > 0) return { value: uploaded.cypr, pending: false };
    }
    if (profile.pr13 !== undefined && profile.pr13 > 0) return { value: profile.pr13, pending: false };
    if (profile.cypr !== undefined && profile.cypr > 0) return { value: profile.cypr, pending: false };
    return { value: 90, pending: true };
  };

  const calculateLapseRatio = (agentCode: string, cases: Case[]): number => {
    const agentCases = cases.filter(c => c.agent_id === agentCode);
    if (agentCases.length === 0) return 0;
    const lapsedCases = agentCases.filter(c => c.status === 'LAPSED' || c.status === 'TERMINATED');
    return (lapsedCases.length / agentCases.length) * 100;
  };

  const getRookieCategory = (joinDate: Date): string => {
    const year1Start = new Date(2026, 0, 1);
    const year1End = new Date(2026, 5, 30);
    const year2Start = new Date(2025, 0, 1);
    const year2End = new Date(2025, 11, 31);
    
    if (isAfter(joinDate, year1Start) && !isAfter(joinDate, year1End)) return "ROOKIE Y1";
    if (isAfter(joinDate, year2Start) && !isAfter(joinDate, year2End)) return "ROOKIE Y2";
    return "EXISTING";
  };

  const calculateENACTicket = (p1: number, p2: number, category: string): "VIP" | "ORDINARY" | "NONE" => {
    const isRookie = category === "ROOKIE Y1" || category === "ROOKIE Y2";
    const total = p1 + p2;
    
    const vipP1Min = isRookie ? 6 : 24;
    const vipP2Min = isRookie ? 6 : 24;
    const vipWashout = isRookie ? 14 : 50;
    const ordP1Min = isRookie ? 3 : 12;
    const ordP2Min = isRookie ? 3 : 12;
    const ordWashout = isRookie ? 8 : 26;
    
    if ((p1 >= vipP1Min && p2 >= vipP2Min) || total >= vipWashout) return "VIP";
    if ((p1 >= ordP1Min && p2 >= ordP2Min) || total >= ordWashout) return "ORDINARY";
    return "NONE";
  };

  const checkENACQualification = (ticket: string, profile: Profile, lapseRatio: number, useUploadedData: boolean = false): { qualifies: boolean; pending: boolean } => {
    if (ticket === "NONE") return { qualifies: false, pending: false };
    
    const requiredRatio = profile.rank?.toUpperCase().includes("GROUP AGENCY DIRECTOR") ? 80 :
                         profile.rank?.toUpperCase().includes("AGENCY DIRECTOR") ? 85 : 90;
    const persistency = getPersistencyRatio(profile, useUploadedData);
    
    const cpdOk = (profile.cpd_hours || 0) >= 15;
    const lapseOk = lapseRatio < 20;
    const persistencyOk = persistency.value >= requiredRatio;
    
    if (persistency.pending) {
      return { qualifies: cpdOk && lapseOk, pending: true };
    }
    
    return { qualifies: persistencyOk && cpdOk && lapseOk, pending: false };
  };

  // Fetch uploaded data from database
  const fetchUploadedData = async () => {
    try {
      const { error: tableCheck } = await supabase
        .from('contest_uploads')
        .select('id')
        .limit(1);
      
      if (tableCheck && tableCheck.code === '42P01') {
        console.log('contest_uploads table not created yet');
        return;
      }
      
      const { data, error } = await supabase
        .from('contest_uploads')
        .select('*')
        .eq('contest_id', 'enac')
        .order('uploaded_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setLastUploadDate(data[0].uploaded_at);
        const dataMap = new Map();
        if (Array.isArray(data[0].data)) {
          data[0].data.forEach((item: any) => {
            dataMap.set(item.agent_code, item);
          });
        }
        setUploadedEnacData(dataMap);
      }
    } catch (error) {
      console.error('Error fetching uploaded data:', error);
    }
  };

  // Handle Excel upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>, contestId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      let transformedData = [];
      if (contestId === 'enac') {
        transformedData = jsonData.map((row: any) => ({
          agent_code: row.AGENT_CODE || row.agent_code,
          agent_name: row.AGENT_NAME || row.agent_name,
          rank: row.Agent_Remarks || row.rank,
          category: row.AGENT_CATEGORY || row.category,
          jan_to_mar_cases: row['Jan to Mac'] || row.jan_to_mar_cases || 0,
          apr_to_jun_cases: row['Apr to Jun'] || row.apr_to_jun_cases || 0,
          potential_ticket: row.Potential_Ticket || row.potential_ticket,
          pr13: row.PR13 || row.pr13 || 0,
          cypr: row.CYPR || row.cypr || 0,
          cpd_hours: row.CPD || row.cpd_hours || 0
        }));
      }
      
      try {
        const { error } = await supabase.from('contest_uploads').insert({
          contest_id: contestId,
          data: transformedData,
          file_name: file.name,
          uploaded_by: user?.id
        });
        
        if (error && error.code !== '42P01') throw error;
      } catch (dbErr) {
        console.warn('Could not save to database, but data is still processed:', dbErr);
      }
      
      const dataMap = new Map();
      transformedData.forEach((item: any) => {
        dataMap.set(item.agent_code, item);
      });
      setUploadedEnacData(dataMap);
      setLastUploadDate(new Date().toISOString());
      
      await fetchAllData();
      
      alert(`Successfully uploaded ${transformedData.length} records for ${contestId.toUpperCase()}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please check the format.');
    } finally {
      setUploading(false);
      setUploadDialogOpen(false);
    }
  };

  // ============================================================
  // MAIN FETCH FUNCTION
  // ============================================================
  
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setDbError(null);
      
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle();
      const effectiveProfile = profile || { 
        id: user?.id, agent_code: "ADMIN", full_name: "Admin", rank: "GAD", 
        join_date: "2020-01-01", cypr: 90, cpd_hours: 30 
      };
      
      const { data: profilesData } = await supabase.from("profiles").select("*");
      if (!profilesData) {
        setDbError("Unable to load profiles data");
        setLoading(false);
        return;
      }
      setAllProfiles(profilesData);
      
      let allCasesData: Case[] = [];
      let page = 0, pageSize = 1000, hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("cases")
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.warn("Error fetching cases:", error);
          break;
        }
        
        if (data && data.length > 0) { 
          allCasesData = [...allCasesData, ...data]; 
          page++; 
        }
        if (!data || data.length < pageSize) hasMore = false;
      }
      setAllCases(allCasesData);
      
      const allActiveCases = allCasesData.filter(c => c.status === 'ACTIVE');
      const enacCases = allActiveCases.filter(c => {
        const createdAt = parseISO(c.created_at);
        return createdAt >= new Date(2026, 0, 1) && createdAt <= new Date(2026, 5, 30);
      });
      
      const enacStatsMap = new Map<string, { p1: number; p2: number }>();
      enacCases.forEach(c => {
        const m = format(parseISO(c.created_at), 'MM');
        if (!enacStatsMap.has(c.agent_id)) {
          enacStatsMap.set(c.agent_id, { p1: 0, p2: 0 });
        }
        const stats = enacStatsMap.get(c.agent_id)!;
        if (['01','02','03'].includes(m)) stats.p1++;
        if (['04','05','06'].includes(m)) stats.p2++;
      });
      
      const afycMap: Record<string, number> = {};
      allActiveCases.forEach(c => {
        afycMap[c.agent_id] = (afycMap[c.agent_id] || 0) + Number(c.premium);
      });
      
      // Build eNAC leaderboard
      const enacList: ENACEntry[] = profilesData.map(p => {
        const stats = enacStatsMap.get(p.agent_code) || { p1: 0, p2: 0 };
        const joinDate = parseISO(p.join_date);
        const category = getRookieCategory(joinDate);
        const ticket = calculateENACTicket(stats.p1, stats.p2, category);
        const lapseRatio = calculateLapseRatio(p.agent_code, allActiveCases);
        const uploaded = uploadedEnacData.get(p.agent_code);
        
        const pr13 = uploaded?.pr13 || p.pr13 || 0;
        const cypr = uploaded?.cypr || p.cypr || 90;
        const cpd = uploaded?.cpd_hours || p.cpd_hours || 0;
        
        const qualification = checkENACQualification(ticket, { ...p, cpd_hours: cpd, pr13, cypr }, lapseRatio, true);
        
        return {
          agent_code: p.agent_code,
          agent_name: p.full_name,
          rank: p.rank || "Agent",
          join_date: p.join_date,
          category,
          jan_to_mar_cases: stats.p1,
          apr_to_jun_cases: stats.p2,
          potential_ticket: ticket,
          pr13,
          cypr,
          cpd_hours: cpd,
          qualifies: qualification.qualifies,
          persistency_pending: qualification.pending
        };
      }).sort((a, b) => (b.jan_to_mar_cases + b.apr_to_jun_cases) - (a.jan_to_mar_cases + a.apr_to_jun_cases));
      
      setEnacLeaderboard(enacList);
      
      const afycList = Object.entries(afycMap).map(([id, val]) => {
        const p = profilesData.find(p => p.agent_code === id);
        return { id, name: p?.full_name || id, value: val, designation: p?.rank || "Agent" };
      }).sort((a, b) => b.value - a.value);
      setAfycLeaderboard(afycList);
      
      const growBigList = profilesData.filter(p => {
        const rank = p.rank?.toUpperCase() || "";
        return rank.includes("DIRECTOR");
      }).map(p => {
        const afyc = afycMap[p.agent_code] || 0;
        return { id: p.agent_code, name: p.full_name, value: afyc, designation: p.rank };
      }).sort((a, b) => b.value - a.value);
      setGrowBigLeaderboard(growBigList);
      
      const myCases = enacCases.filter(c => c.agent_id === effectiveProfile.agent_code);
      const myENACStats = enacStatsMap.get(effectiveProfile.agent_code) || { p1: 0, p2: 0 };
      const myJoinDate = parseISO(effectiveProfile.join_date);
      const myCategory = getRookieCategory(myJoinDate);
      const myTicket = calculateENACTicket(myENACStats.p1, myENACStats.p2, myCategory);
      const myLapseRatio = calculateLapseRatio(effectiveProfile.agent_code, allActiveCases);
      const myUploaded = uploadedEnacData.get(effectiveProfile.agent_code);
      const myCpd = myUploaded?.cpd_hours || effectiveProfile.cpd_hours || 0;
      const myQualification = checkENACQualification(myTicket, { ...effectiveProfile, cpd_hours: myCpd }, myLapseRatio, true);
      
      setAgentData({
        ...effectiveProfile,
        totalAfyc: afycMap[effectiveProfile.agent_code] || 0,
        totalCases: myCases.length,
        category: myCategory,
        enacP1: myENACStats.p1,
        enacP2: myENACStats.p2,
        enacTotal: myENACStats.p1 + myENACStats.p2,
        enacTicket: myTicket,
        enacQualifies: myQualification.qualifies,
        enacPending: myQualification.pending,
        persistencyRatio: getPersistencyRatio(effectiveProfile, true).value,
        persistencyPending: getPersistencyRatio(effectiveProfile, true).pending,
        lapseRatio: myLapseRatio,
        cpdHours: myCpd,
        janAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '01').reduce((s, c) => s + Number(c.premium), 0),
        febAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '02').reduce((s, c) => s + Number(c.premium), 0),
        consistentReward: 0 // Placeholder for consistent club bonus
      });
      
    } catch (e) { 
      console.error(e);
      setDbError("Failed to load data. Please refresh the page.");
    } finally { 
      setLoading(false); 
    }
  };

  const openModal = (type: string) => {
    setActiveContest(type);
    if (type === "enac") setActiveSegment("ALL");
    else if (type === "growbig") setActiveSegment("Monthly");
    else setActiveSegment("All");
    setIsDialogOpen(true);
  };

  if (loading || !agentData) return <ContestSkeleton />;

  // Contest cards configuration
  const contestCards = [
    { id: 'experience', title: 'AIT Experience', destination: 'Hanoi, Vietnam', image: '/contests/hanoi.webp', target: 100000, color: 'from-cyan-500 to-blue-600', icon: <TreePalm />, description: '3 Days 2 Nights • Twin Sharing' },
    { id: 'summit', title: 'AIT Summit', destination: 'Andalusia, Spain', image: '/contests/spain.webp', target: 300000, color: 'from-amber-500 to-orange-600', icon: <Landmark />, description: '5 Days 4 Nights • Twin Sharing' },
    { id: 'star', title: 'AIT Star', destination: 'Tashkent, Uzbekistan', image: '/contests/uzbekistan.webp', target: 150000, color: 'from-emerald-500 to-teal-600', icon: <Compass />, description: '4 Days 3 Nights • Twin Sharing' },
    { id: 'enac', title: 'eNAC 2026', destination: 'National Achievers Congress', image: '/contests/enac.jpeg', target: agentData.category === 'ROOKIE Y1' || agentData.category === 'ROOKIE Y2' ? 8 : 26, unit: 'Cases', color: 'from-amber-500 to-yellow-600', icon: <Crown />, description: 'VIP/Ordinary Ticket' },
    { id: 'risingstar', title: 'AIT Rising Star', destination: 'Yogyakarta, Indonesia', image: '/contests/yogya.jpg', target: 60000, color: 'from-purple-500 to-pink-600', icon: <Star />, description: 'iPad / Trip Reward' },
    { id: 'allstars', title: 'All-Stars 2026', destination: 'Award Ceremony', image: '/contests/allstars.jpg', target: 100000, color: 'from-red-500 to-rose-600', icon: <Trophy />, description: 'Club Recognition' },
    { id: 'consistent', title: 'Consistent Club', destination: 'Bonus Payout', image: '/contests/consistent.jpg', target: 0, color: 'from-violet-500 to-purple-600', icon: <Flame />, description: 'Monthly & Quarterly Rewards' },
    { id: 'growbig', title: 'Grow Big', destination: 'Agency Growth', image: '/contests/growbig.jpg', target: 90000, color: 'from-rose-500 to-pink-600', icon: <TrendingUp />, description: 'Up to RM30,000 Reward' }
  ];

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative z-10 p-8 md:p-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-sm">
                      <Sparkles className="h-3 w-3 mr-1" />
                      8 Active Campaigns
                    </Badge>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                    Contest & Incentives 2026
                  </h1>
                  <p className="text-white/60 text-base max-w-2xl">
                    Track your performance, compete with top agents, and qualify for exclusive rewards worldwide.
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                  <div className="text-right">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider">Welcome back,</p>
                    <p className="text-white font-semibold text-lg">{agentData.full_name}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge className="bg-white/20 text-white text-[8px]">{agentData.category}</Badge>
                      {agentData.enacTicket !== "NONE" && (
                        <Badge className={cn(
                          "text-[8px]",
                          agentData.enacTicket === "VIP" ? "bg-amber-500" : "bg-blue-500"
                        )}>
                          {agentData.enacTicket}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center border-2 border-white/30">
                    <span className="text-primary font-bold text-xl">
                      {agentData.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats Overview Cards */}
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            <StatOverviewCard 
              title="Total AFYC" 
              value={`RM ${agentData.totalAfyc?.toLocaleString() || 0}`} 
              icon={<DollarSign />} 
              color="from-blue-500 to-blue-600"
            />
            <StatOverviewCard 
              title="Total Cases" 
              value={agentData.totalCases?.toString() || "0"} 
              icon={<Target />} 
              color="from-emerald-500 to-emerald-600"
            />
            <StatOverviewCard 
              title="Persistency Ratio" 
              value={`${agentData.persistencyRatio || 90}%`} 
              icon={<ShieldCheck />} 
              color="from-amber-500 to-amber-600"
              pending={agentData.persistencyPending}
            />
            <StatOverviewCard 
              title="eNAC Ticket" 
              value={agentData.enacTicket || "NONE"} 
              icon={<Ticket />} 
              color="from-violet-500 to-violet-600"
            />
          </motion.div>

          {/* Contest Grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-1 w-8 rounded-full bg-gradient-to-r from-primary to-primary/50" />
                <h2 className="text-xl font-bold text-slate-800">Active Campaigns 2026</h2>
              </div>
              <Badge variant="outline" className="bg-white shadow-sm">
                <CalendarDays className="h-3 w-3 mr-1" />
                Jan - Dec 2026
              </Badge>
            </div>
            <motion.div 
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {contestCards.map((contest, idx) => (
                <ContestCard
                  key={contest.id}
                  {...contest}
                  onClick={() => openModal(contest.id)}
                  isAdmin={isAdmin}
                  currentValue={contest.id === 'enac' ? agentData.enacTotal : agentData.totalAfyc}
                  unit={contest.unit || "RM"}
                  leaderboard={contest.id === 'enac' ? enacLeaderboard : contest.id === 'growbig' ? growBigLeaderboard : afycLeaderboard}
                  onUpload={() => {
                    setActiveContest(contest.id);
                    setUploadDialogOpen(true);
                  }}
                  lastUploadDate={contest.id === 'enac' ? lastUploadDate : null}
                />
              ))}
            </motion.div>
          </div>

          {/* Error Banner */}
          {dbError && (
            <div className="fixed bottom-4 right-4 z-50">
              <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{dbError}</span>
                <Button variant="ghost" size="sm" className="text-white hover:bg-red-600" onClick={fetchAllData}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Upload Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent className="sm:max-w-md p-0 rounded-2xl overflow-hidden">
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Upload Contest Data</DialogTitle>
                    <p className="text-sm text-slate-500">Upload Excel file for {activeContest?.toUpperCase()} standings</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer block">
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600 mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-400">Excel files only (.xlsx, .xls)</p>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => handleExcelUpload(e, activeContest || 'enac')}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {uploading && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                  {lastUploadDate && (
                    <div className="text-center text-xs text-slate-400">
                      Last upload: {new Date(lastUploadDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Contest Modal - FIXED: No admin override */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[1100px] p-0 border-none rounded-2xl bg-white shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeContest}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* eNAC Contest - Admin sees same as users but with upload button */}
                  {activeContest === 'enac' && (
                    isAdmin ? (
                      <AdminENACView 
                        activeSegment={activeSegment}
                        setActiveSegment={setActiveSegment}
                        enacLeaderboard={enacLeaderboard}
                        onUpload={() => setUploadDialogOpen(true)}
                        lastUploadDate={lastUploadDate}
                      />
                    ) : (
                      <ENACDetailView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={enacLeaderboard} />
                    )
                  )}
                  
                  {/* Grow Big Contest */}
                  {activeContest === 'growbig' && (
                    <GrowBigDetailView data={agentData} leaderboard={growBigLeaderboard} />
                  )}
                  
                  {/* AIT Experience Contest */}
                  {activeContest === 'experience' && (
                    <ExperienceDetailView data={agentData} />
                  )}
                  
                  {/* AIT Summit Contest */}
                  {activeContest === 'summit' && (
                    <SummitDetailView />
                  )}
                  
                  {/* AIT Star Contest */}
                  {activeContest === 'star' && (
                    <StarDetailView />
                  )}
                  
                  {/* AIT Rising Star Contest */}
                  {activeContest === 'risingstar' && (
                    <RisingStarDetailView />
                  )}
                  
                  {/* All-Stars Contest */}
                  {activeContest === 'allstars' && (
                    <AllStarsDetailView />
                  )}
                  
                  {/* Consistent Club Contest */}
                  {activeContest === 'consistent' && (
                    <ConsistentClubDetailView data={agentData} />
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="p-6 bg-slate-50 border-t flex justify-center">
                <Button onClick={() => setIsDialogOpen(false)} variant="ghost" 
                  className="rounded-full px-8 font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600">
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// STAT OVERVIEW CARD COMPONENT
// ============================================================

function StatOverviewCard({ title, value, icon, color, pending }: any) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="border-none bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
            </div>
            <div className={cn("p-3 rounded-xl bg-gradient-to-br text-white shadow-lg", color)}>
              {icon}
            </div>
          </div>
          {pending && (
            <div className="mt-3 flex items-center gap-1 text-[9px] text-amber-500">
              <AlertCircle className="h-3 w-3" />
              <span>Pending agency verification</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// CONTEST CARD COMPONENT - FIXED: Better image visibility
// ============================================================

function ContestCard({ title, image, target, onClick, unit = "RM", color, isAdmin, currentValue, description, icon, leaderboard, onUpload, lastUploadDate }: any) {
  const progress = target > 0 ? Math.min(100, (currentValue / target) * 100) : 0;
  const qualifiedCount = useMemo(() => {
    if (!isAdmin || !leaderboard) return 0;
    if (unit === "Cases") {
      return leaderboard.filter((a: any) => {
        const total = (a.jan_to_mar_cases || 0) + (a.apr_to_jun_cases || 0);
        return total >= target;
      }).length;
    }
    return leaderboard.filter((a: any) => (a.value || 0) >= target).length;
  }, [isAdmin, leaderboard, target, unit]);
  
  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="group relative cursor-pointer border-none bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden">
        {/* Background Image - More visible on hover */}
        <div className="absolute inset-0 opacity-20 group-hover:opacity-100 transition-opacity duration-500">
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
        
        {/* Dark Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 group-hover:opacity-90 transition-opacity duration-500" />
        
        {/* Upload Button */}
        <div className="absolute top-3 right-3 z-20">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onUpload();
            }}
          >
            <Upload className="h-3 w-3" />
          </Button>
        </div>
        
        <CardContent className="p-5 relative z-10" onClick={onClick}>
          <div className="flex justify-between items-start mb-4">
            <div className={cn("p-3 rounded-xl text-white shadow-lg relative z-10", color)}>
              {icon}
            </div>
            <Badge variant="ghost" className="bg-green-500/80 text-white font-bold text-[8px] uppercase tracking-wider animate-pulse backdrop-blur-sm border-none">
              Active
            </Badge>
          </div>
          
          <div className="mb-3">
            <h3 className="text-base font-black text-white leading-tight drop-shadow-md">{title}</h3>
            <p className="text-[10px] text-white/80 font-medium mt-0.5 line-clamp-1 drop-shadow-sm">{description}</p>
          </div>
          
          {isAdmin ? (
            <div className="pt-3 border-t border-white/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[8px] text-white/60 font-bold uppercase tracking-wider">Total Qualified</p>
                <p className="text-xl font-black text-white">{qualifiedCount} Agents</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="text-xl font-black text-white drop-shadow-md">
                  {unit === "RM" ? "RM " : ""}{currentValue.toLocaleString()}
                </div>
                {target > 0 && <div className="text-[8px] font-bold text-white/60 drop-shadow-sm">/ {target.toLocaleString()}</div>}
              </div>
              {target > 0 && (
                <>
                  <div className="relative">
                    <div className="h-2 w-full bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                      <motion.div 
                        className={cn("h-full rounded-full", color.replace('from-', 'bg-').replace('to-', ''))}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <p className="text-[8px] text-white/60 font-medium">Progress</p>
                    <p className="text-[8px] font-bold text-white">{Math.round(progress)}%</p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// ENAC DETAIL VIEW
// ============================================================

function ENACDetailView({ data, segment, setSegment, leaderboard }: any) {
  const isRookie = data?.category === 'ROOKIE Y1' || data?.category === 'ROOKIE Y2';
  const target = isRookie ? 8 : 26;
  const total = (data?.enacP1 || 0) + (data?.enacP2 || 0);
  const progress = (total / target) * 100;
  
  const filteredLeaderboard = leaderboard.filter((a: any) => {
    if (segment === "ALL") return true;
    if (segment === "ROOKIE") return a.category === 'ROOKIE Y1' || a.category === 'ROOKIE Y2';
    if (segment === "EXISTING") return a.category === 'EXISTING';
    return true;
  });
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/enac.jpeg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/90 to-amber-900/50" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">eNAC 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">National Achievers Congress</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Jun 30, 2026</p>
          </div>
          <div className="flex gap-1 bg-white/10 p-1 rounded-full">
            {["ALL", "ROOKIE", "EXISTING"].map(opt => (
              <Button key={opt} onClick={() => setSegment(opt)} 
                className={cn("h-8 px-5 text-[10px] font-black rounded-full", 
                  segment === opt ? "bg-white text-slate-900" : "text-white/60 hover:text-white hover:bg-white/10")}>
                {opt}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-4">
              Your Progress ({data?.category})
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-[8px] text-slate-400 uppercase">P1 (Jan-Mar)</p>
                <p className="text-3xl font-black text-blue-600">{data?.enacP1 || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-[8px] text-slate-400 uppercase">P2 (Apr-Jun)</p>
                <p className="text-3xl font-black text-blue-600">{data?.enacP2 || 0}</p>
              </div>
            </div>
            <div className="flex justify-between text-[10px] mb-2">
              <span className="text-slate-500">Total Cases</span>
              <span className="font-bold text-blue-600">{total} / {target}</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          </div>
          
          <div className={cn("p-6 rounded-2xl text-center shadow-xl", 
            data?.enacTicket === 'VIP' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
            data?.enacTicket === 'ORDINARY' ? 'bg-gradient-to-r from-blue-500 to-sky-500' :
            'bg-gradient-to-r from-slate-500 to-slate-600'
          )}>
            <Ticket className="h-10 w-10 text-white mx-auto mb-2" />
            <p className="text-3xl font-black text-white italic">{data?.enacTicket || "NONE"}</p>
            {data?.enacQualifies && (
              <Badge className="mt-2 bg-white/20 text-white">FULLY QUALIFIED</Badge>
            )}
            {data?.enacPending && data?.enacTicket !== "NONE" && (
              <div className="mt-2 text-white/80 text-[10px]">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Pending persistency verification
              </div>
            )}
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Standings {segment !== "ALL" ? `(${segment})` : ""}
            </h4>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black">
              <Activity className="h-2 w-2 mr-1" />
              Live
            </Badge>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {filteredLeaderboard.slice(0, 20).map((agent: any, i: number) => {
              const isMe = agent.agent_code === data?.agent_code;
              const totalCases = (agent.jan_to_mar_cases || 0) + (agent.apr_to_jun_cases || 0);
              const hasPassed = totalCases >= target;
              const rank = i + 1;
              
              return (
                <div
                  key={agent.agent_code}
                  className={cn(
                    "flex justify-between items-center p-3 rounded-xl border transition-all duration-300",
                    isMe ? 'bg-gradient-to-r from-blue-50 to-white border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:shadow-md'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                      rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white' :
                      rank === 3 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white' :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {rank === 1 ? <Crown className="h-4 w-4" /> : rank}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {agent.agent_name} {isMe && <span className="text-blue-600 ml-1">★</span>}
                      </p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{agent.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-slate-900">{totalCases} Cases</p>
                      <Badge className={cn(
                        "text-[7px] h-4 px-1 font-black",
                        hasPassed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                      )}>
                        {hasPassed ? "PASSED" : `${target - totalCases} left`}
                      </Badge>
                    </div>
                    {agent.potential_ticket !== "NONE" && (
                      <p className={cn(
                        "text-[6px] font-bold mt-1",
                        agent.potential_ticket === 'VIP' ? 'text-amber-500' : 'text-blue-500'
                      )}>
                        {agent.potential_ticket} TICKET
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// ADMIN ENAC VIEW
// ============================================================

function AdminENACView({ activeSegment, setActiveSegment, enacLeaderboard, onUpload, lastUploadDate }: any) {
  const filteredLeaderboard = enacLeaderboard.filter((a: any) => {
    if (activeSegment === "ALL") return true;
    if (activeSegment === "ROOKIE") return a.category === 'ROOKIE Y1' || a.category === 'ROOKIE Y2';
    if (activeSegment === "EXISTING") return a.category === 'EXISTING';
    return true;
  });
  
  const getTarget = (category: string) => {
    return (category === 'ROOKIE Y1' || category === 'ROOKIE Y2') ? 8 : 26;
  };
  
  return (
    <motion.div variants={fadeInUp} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/enac.jpeg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-transparent" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white mb-2">Admin View</Badge>
            <DialogTitle className="text-4xl font-black text-white italic">eNAC 2026 Rankings</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Jun 30, 2026</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onUpload} className="bg-white/20 text-white hover:bg-white/30">
              <Upload className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
            <div className="flex gap-1 bg-white/10 p-1 rounded-full">
              {["ALL", "ROOKIE", "EXISTING"].map(opt => (
                <Button key={opt} onClick={() => setActiveSegment(opt)} 
                  className={cn("h-9 px-6 text-[10px] font-black rounded-full", 
                    activeSegment === opt ? "bg-white text-slate-900" : "text-white/60 hover:text-white")}>
                  {opt}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="p-8">
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {filteredLeaderboard.slice(0, 50).map((agent: any, i: number) => {
            const totalCases = (agent.jan_to_mar_cases || 0) + (agent.apr_to_jun_cases || 0);
            const target = getTarget(agent.category);
            const hasPassed = totalCases >= target;
            const rank = i + 1;
            
            return (
              <div key={agent.agent_code} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-white hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                    rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                    rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white' :
                    rank === 3 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white' :
                    'bg-slate-100 text-slate-400'
                  )}>
                    {rank === 1 ? <Crown className="h-4 w-4" /> : rank}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{agent.agent_name}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{agent.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-900">{totalCases} Cases</p>
                    <Badge className={cn(
                      "text-[7px] h-4 px-1 font-black",
                      hasPassed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                    )}>
                      {hasPassed ? "PASSED" : `${target - totalCases} to go`}
                    </Badge>
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <span className="text-[8px] text-slate-400">P1: {agent.jan_to_mar_cases}</span>
                    <span className="text-[8px] text-slate-400">P2: {agent.apr_to_jun_cases}</span>
                    <span className={cn(
                      "text-[8px] font-bold",
                      agent.potential_ticket === 'VIP' ? 'text-amber-500' : 
                      agent.potential_ticket === 'ORDINARY' ? 'text-blue-500' : 'text-slate-300'
                    )}>
                      {agent.potential_ticket}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// GROW BIG DETAIL VIEW
// ============================================================

function GrowBigDetailView({ data, leaderboard }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-48 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/growbig.jpg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-rose-900/80 to-rose-900/40" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">Grow Big 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Agency Growth Challenge</DialogTitle>
          </div>
        </div>
      </div>
      
      <div className="p-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {[
            { tier: "Tier 1", reward: "RM30,000", increment: "40% OR RM300,000", active: "12 agents", recruits: "10 recruits", color: "from-rose-500 to-rose-600" },
            { tier: "Tier 2", reward: "RM20,000", increment: "30% OR RM200,000", active: "8 agents", recruits: "6 recruits", color: "from-rose-400 to-rose-500" },
            { tier: "Tier 3", reward: "RM10,000", increment: "20% OR RM100,000", active: "6 agents", recruits: "3 recruits", color: "from-rose-300 to-rose-400" }
          ].map((tier, i) => (
            <div key={tier.tier} className={cn("p-4 rounded-xl bg-gradient-to-br text-white", tier.color)}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold">{tier.tier}</h4>
                <Badge className="bg-white/20 text-white border-none">{tier.reward}</Badge>
              </div>
              <div className="space-y-1 text-xs opacity-90">
                <p>• AFYC Increment: {tier.increment}</p>
                <p>• Active Agents: {tier.active}</p>
                <p>• New Recruits: {tier.recruits}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div>
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Director Leaderboard</h4>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black">
              <Users className="h-2 w-2 mr-1" />
              {leaderboard.length} Directors
            </Badge>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {leaderboard.slice(0, 20).map((agent: any, i: number) => {
              const isMe = agent.id === data?.agent_code;
              const rank = i + 1;
              
              return (
                <div key={agent.id} className={cn(
                  "flex justify-between items-center p-3 rounded-xl border",
                  isMe ? 'bg-gradient-to-r from-blue-50 to-white border-blue-200' : 'bg-white border-slate-100'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                      rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white' :
                      rank === 3 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white' :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {rank === 1 ? <Crown className="h-4 w-4" /> : rank}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {agent.name} {isMe && <span className="text-blue-600 ml-1">★</span>}
                      </p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{agent.designation}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">RM {agent.value.toLocaleString()}</p>
                    <p className="text-[8px] text-slate-400">AFYC</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// AIT EXPERIENCE DETAIL VIEW
// ============================================================

function ExperienceDetailView({ data }: any) {
  const isRookie = data?.category === 'ROOKIE Y1' || data?.category === 'ROOKIE Y2';
  const janRequired = isRookie ? 5000 : 10000;
  const febRequired = isRookie ? 5000 : 10000;
  const targetAfyc = isRookie ? 75000 : 100000;
  const targetAfycPlus = isRookie ? 100000 : 150000;
  
  const janMet = (data?.janAfyc || 0) >= janRequired;
  const febMet = (data?.febAfyc || 0) >= febRequired;
  const afycMet = (data?.totalAfyc || 0) >= targetAfyc;
  const afycPlusMet = (data?.totalAfyc || 0) >= targetAfycPlus;
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/hanoi.webp")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/80 to-blue-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">AIT Experience 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Hanoi, Vietnam</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Jun 30, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-cyan-50 to-white rounded-2xl border border-cyan-100">
            <h4 className="text-[10px] font-black text-cyan-600 uppercase tracking-wider mb-4">
              Qualification Requirements ({isRookie ? "Rookie" : "Personal Producer"})
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-xs">January AFYC (Min RM {janRequired.toLocaleString()})</span>
                <Badge className={janMet ? "bg-green-500" : "bg-slate-200"}>
                  RM {(data?.janAfyc || 0).toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-xs">February AFYC (Min RM {febRequired.toLocaleString()})</span>
                <Badge className={febMet ? "bg-green-500" : "bg-slate-200"}>
                  RM {(data?.febAfyc || 0).toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-xs">Minimum 1 Case Per Month (Jan-Jun)</span>
                <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100">
            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-4">Rewards</h4>
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold">Standard Ticket</p>
                  <p className="text-[10px] text-slate-500">AFYC RM {targetAfyc.toLocaleString()}</p>
                </div>
                <Badge className={afycMet ? "bg-emerald-500" : "bg-slate-200"}>
                  {afycMet ? "QUALIFIED" : `${targetAfyc - (data?.totalAfyc || 0)} left`}
                </Badge>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold">Premium Ticket + RM1,000</p>
                  <p className="text-[10px] text-slate-500">AFYC RM {targetAfycPlus.toLocaleString()}</p>
                </div>
                <Badge className={afycPlusMet ? "bg-amber-500" : "bg-slate-200"}>
                  {afycPlusMet ? "QUALIFIED" : `${targetAfycPlus - (data?.totalAfyc || 0)} left`}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-slate-900 rounded-2xl text-center text-white">
          <Plane className="h-12 w-12 mx-auto mb-4 text-cyan-400" />
          <p className="text-sm font-bold">AIT Experience Trip</p>
          <p className="text-2xl font-black">Hanoi, Vietnam</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span>3 Days 2 Nights</span>
            <span>•</span>
            <span>Twin Sharing</span>
            <span>•</span>
            <span>Economy Class</span>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Persistency Required</p>
              <p className="text-sm font-bold">90% (Agent)</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Lapse Ratio</p>
              <p className="text-sm font-bold text-red-400">&lt;20%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">CPD Hours</p>
              <p className="text-sm font-bold">15 Hours</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// AIT SUMMIT DETAIL VIEW
// ============================================================

function SummitDetailView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/spain.webp")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/80 to-orange-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">AIT Summit 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Andalusia, Spain</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Oct 31, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-gradient-to-br from-amber-50 to-white rounded-2xl">
            <h4 className="text-[10px] font-black text-amber-600 mb-4">Qualification Categories</h4>
            <div className="space-y-3">
              {[
                { title: "Personal Producer", requirement: "AFYC RM300,000 + 12 cases", icon: <UsersRound className="h-4 w-4" /> },
                { title: "Director (AD/GAD)", requirement: "AFYC RM1,000,000 + 3 AGMs + 7 recruits", icon: <Briefcase className="h-4 w-4" /> },
                { title: "Super Star (GAD)", requirement: "AFYC RM2,000,000 + 5 AGMs + 11 recruits", icon: <Star className="h-4 w-4" /> },
                { title: "Mega Star (GAD)", requirement: "AFYC RM5,000,000 + 1 AD + 5 AGMs + 15 recruits", icon: <Gem className="h-4 w-4" /> }
              ].map((cat, i) => (
                <div key={i} className="p-3 bg-white rounded-xl border border-amber-100 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">{cat.icon}</div>
                  <div>
                    <p className="text-xs font-bold">{cat.title}</p>
                    <p className="text-[10px] text-slate-500">{cat.requirement}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-6 bg-slate-900 rounded-2xl text-center text-white">
            <Landmark className="h-12 w-12 mx-auto mb-4 text-amber-400" />
            <p className="text-sm font-bold">AIT Summit Trip</p>
            <p className="text-2xl font-black">Andalusia, Spain</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span>5 Days 4 Nights</span>
              <span>•</span>
              <span>Twin Sharing</span>
              <span>•</span>
              <span>Economy Class</span>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-[10px] text-slate-400">Up to 4 tickets for Mega Star!</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// AIT STAR DETAIL VIEW
// ============================================================

function StarDetailView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/uzbekistan.webp")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/80 to-teal-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">AIT Star 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Tashkent, Uzbekistan</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Oct 31, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-2xl">
            <h4 className="text-[10px] font-black text-emerald-600 mb-4">Qualification Categories</h4>
            <div className="space-y-3">
              {[
                { title: "Rookie", requirement: "AFYC RM150,000 + 12 cases", icon: <Star className="h-4 w-4" /> },
                { title: "Personal Producer", requirement: "AFYC RM200,000 + 12 cases", icon: <UsersRound className="h-4 w-4" /> },
                { title: "Director (AD/GAD)", requirement: "AFYC RM500,000 + 3 AGMs + 6 recruits", icon: <Briefcase className="h-4 w-4" /> },
                { title: "Group (GAD)", requirement: "AFYC RM1,000,000 + 4 AGMs + 10 recruits", icon: <Building2 className="h-4 w-4" /> }
              ].map((cat, i) => (
                <div key={i} className="p-3 bg-white rounded-xl border border-emerald-100 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">{cat.icon}</div>
                  <div>
                    <p className="text-xs font-bold">{cat.title}</p>
                    <p className="text-[10px] text-slate-500">{cat.requirement}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-6 bg-slate-900 rounded-2xl text-center text-white">
            <Compass className="h-12 w-12 mx-auto mb-4 text-emerald-400" />
            <p className="text-sm font-bold">AIT Star Trip</p>
            <p className="text-2xl font-black">Tashkent, Uzbekistan</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span>4 Days 3 Nights</span>
              <span>•</span>
              <span>Twin Sharing</span>
              <span>•</span>
              <span>Economy Class</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// AIT RISING STAR DETAIL VIEW
// ============================================================

function RisingStarDetailView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-56 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/yogya.jpg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-pink-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">AIT Rising Star 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Yogyakarta, Indonesia</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Dec 31, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-purple-50 to-white rounded-2xl">
              <h4 className="text-[10px] font-black text-purple-600 mb-4">Level 1: Rising Star (0+3 Months)</h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Minimum AFYC RM30,000</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Minimum NOC 3</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Attend VB101 Program</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-bold text-purple-600">Reward: iPad Voucher (RM1,800)</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-pink-50 to-white rounded-2xl">
              <h4 className="text-[10px] font-black text-pink-600 mb-4">Level 2: Rising Star (0+6 Months)</h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Minimum AFYC RM60,000</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Minimum NOC 6</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-xs">Minimum 1 case in first month</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-bold text-pink-600">Reward: 1 Ticket to Yogyakarta</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-slate-900 rounded-2xl text-center text-white">
            <Star className="h-12 w-12 mx-auto mb-4 text-purple-400" />
            <p className="text-sm font-bold">AIT Rising Star Trip</p>
            <p className="text-2xl font-black">Yogyakarta, Indonesia</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span>3 Days 2 Nights</span>
              <span>•</span>
              <span>Twin Sharing</span>
              <span>•</span>
              <span>Economy Class</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// ALL-STARS DETAIL VIEW
// ============================================================

function AllStarsDetailView() {
  const clubs = [
    { name: "Platinum", color: "from-slate-400 to-slate-600", textColor: "text-slate-600", requirements: ["GAD: RM3M/26rec", "AD: RM1M/14rec", "AGM: RM350k/10rec", "Agent: RM250k"] },
    { name: "Gold", color: "from-amber-500 to-yellow-500", textColor: "text-amber-600", requirements: ["GAD: RM2M/22rec", "AD: RM680k/12rec", "AGM: RM280k/8rec", "Agent: RM200k"] },
    { name: "Silver", color: "from-slate-300 to-slate-400", textColor: "text-slate-500", requirements: ["GAD: RM1M/18rec", "AD: RM340k/10rec", "AGM: RM180k/6rec", "Agent: RM150k"] },
    { name: "Bronze", color: "from-amber-700 to-orange-700", textColor: "text-amber-700", requirements: ["GAD: RM500k/12rec", "AD: RM170k/6rec", "AGM: RM100k/4rec", "Agent: RM80k"] }
  ];
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-48 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/allstars.jpg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/80 to-rose-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">All-Stars 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Award & Recognition</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Dec 31, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {clubs.map((club) => (
            <div key={club.name} className={cn("p-4 rounded-xl bg-gradient-to-br text-white", club.color)}>
              <Award className="h-8 w-8 mb-2" />
              <h4 className="text-xl font-black">{club.name} Club</h4>
              <div className="mt-3 space-y-1 text-[10px] opacity-90">
                {club.requirements.map((req, i) => (
                  <p key={i}>• {req}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-slate-100 rounded-xl text-center">
          <p className="text-xs text-slate-600">
            ✨ Platinum, Gold, Silver: Stage Recognition + Pin Lapel + Plaque + Certificate + All-Stars Invitation
          </p>
          <p className="text-xs text-slate-500 mt-1">
            🏆 Bronze: Pin Lapel + Certificate + All-Stars Invitation (No stage recognition)
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CONSISTENT CLUB DETAIL VIEW
// ============================================================

function ConsistentClubDetailView({ data }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="relative overflow-hidden h-48 bg-cover bg-center" style={{ backgroundImage: 'url("/contests/consistent.jpg")' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-violet-900/80 to-purple-900/60" />
        <div className="relative z-10 p-8 flex justify-between items-center h-full">
          <div>
            <Badge className="bg-white/20 backdrop-blur-md text-white">Consistent Club 2026</Badge>
            <DialogTitle className="text-3xl font-black text-white italic mt-2">Consistency Bonus</DialogTitle>
            <p className="text-white/70 text-sm mt-1">Campaign: Jan 1 - Jun 30, 2026</p>
          </div>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-violet-50 to-white rounded-2xl">
              <h4 className="text-[10px] font-black text-violet-600 mb-4">Monthly Rewards (3-Month Periods)</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>1-3 cases</span>
                  <span className="font-bold">+RM100 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>4-5 cases</span>
                  <span className="font-bold">+RM400 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>6-9 cases</span>
                  <span className="font-bold">+RM600 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>10+ cases</span>
                  <span className="font-bold">+RM1,000 bonus</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-purple-50 to-white rounded-2xl">
              <h4 className="text-[10px] font-black text-purple-600 mb-4">Quarterly Rewards</h4>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>5-14 cases</span>
                  <span className="font-bold">+RM100 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>15-20 cases</span>
                  <span className="font-bold">+RM400 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>21-34 cases</span>
                  <span className="font-bold">+RM600 bonus</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded-lg">
                  <span>35+ cases</span>
                  <span className="font-bold">+RM1,000 bonus</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-amber-50 to-white rounded-2xl">
              <h4 className="text-[10px] font-black text-amber-600 mb-4">Per-Case Rewards</h4>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-white rounded-xl">
                  <span>AFYC RM2,000 - RM3,000</span>
                  <span className="font-bold text-emerald-600">RM100 per case</span>
                </div>
                <div className="flex justify-between p-3 bg-white rounded-xl">
                  <span>AFYC RM3,001 and above</span>
                  <span className="font-bold text-emerald-600">RM200 per case</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-2xl text-center">
              <Flame className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-[10px] text-slate-400 uppercase">Estimated Bonus</p>
              <p className="text-3xl font-black text-emerald-600">RM {(data?.consistentReward || 0).toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 mt-2">Based on your current performance</p>
              <div className="mt-4 p-2 bg-emerald-100 rounded-lg">
                <p className="text-[9px] text-emerald-700">💰 Payment within 3 months after meeting requirements</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// SKELETON COMPONENT
// ============================================================

function ContestSkeleton() {
  return (
    <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto">
      <div className="h-48 bg-gradient-to-r from-slate-800 to-slate-700 rounded-3xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-56 bg-white rounded-2xl shadow-sm animate-pulse" />
        ))}
      </div>
    </div>
  );
}
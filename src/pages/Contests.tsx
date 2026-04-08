import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Smartphone, Zap, CheckCircle2, AlertCircle, Trophy, Ticket, Gift, TrendingUp, Sparkles, Users, Layers } from "lucide-react";
import { format, parseISO, isAfter, differenceInMonths, startOfMonth } from "date-fns";

// --- 1. INTERFACES ---
interface Profile {
  id: string;
  agent_code: string;
  full_name: string;
  rank: string;
  join_date: string;
  cypr?: number;
  attended_vb101?: boolean;
}

interface LeaderboardEntry {
  id: string;
  value: number;
  designation: string;
  enacP1: number;
  enacP2: number;
  category: string;
}

interface AgentStats extends Profile {
  category: string;
  totalAfyc: number;
  caseCount: number;
  janAfyc: number;
  febAfyc: number;
  monthlyCounts: Record<number, number>;
  enacPeriod1: number;
  enacPeriod2: number;
}

// --- 2. SKELETON COMPONENT ---
function ContestSkeleton() {
  return (
    <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto animate-pulse">
      <header className="flex flex-col gap-2">
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="h-4 w-48 bg-slate-100 rounded-md" />
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-[220px] bg-white rounded-[2rem] border border-slate-100 p-8 space-y-4">
            <div className="h-12 w-12 bg-slate-100 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-6 w-3/4 bg-slate-100 rounded" />
              <div className="h-3 w-1/2 bg-slate-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 3. MAIN PAGE COMPONENT ---
export default function Contests() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeContest, setActiveContest] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string>("All");
  const [agentData, setAgentData] = useState<AgentStats | null>(null);
  const [afycLeaderboard, setAfycLeaderboard] = useState<any[]>([]);
  const [enacLeaderboard, setEnacLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const isAdmin = useMemo(() => role === "admin" || user?.email === "admin@superachiever.com", [role, user]);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle() as { data: Profile | null };
      const effectiveProfile = profile || { id: user?.id, agent_code: "ADMIN", full_name: "Admin", rank: "GAD", join_date: "2020-01-01", cypr: 100, attended_vb101: true } as Profile;
      
      const { data: profilesData } = await supabase.from("profiles").select("*") as { data: Profile[] };
      if (!profilesData) return;
      setAllProfiles(profilesData);

      let allCases: any[] = [];
      let page = 0, pageSize = 1000, hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("cases").select("*").range(page * pageSize, (page + 1) * pageSize - 1);
        if (data && data.length > 0) { allCases = [...allCases, ...data]; page++; }
        if (!data || data.length < pageSize) hasMore = false;
      }

      const myCases = allCases.filter(c => c.agent_id === effectiveProfile.agent_code);
      const joinDate = parseISO(effectiveProfile.join_date);

      const afycMap = allCases.reduce((acc, c) => { acc[c.agent_id] = (acc[c.agent_id] || 0) + Number(c.premium); return acc; }, {});
      setAfycLeaderboard(Object.entries(afycMap).map(([id, val]) => ({
        id, value: val as number, designation: profilesData.find(p => p.agent_code === id)?.rank || "PP"
      })).sort((a, b) => b.value - a.value));

      const enacStats = allCases.reduce((acc: any, c) => {
        const m = format(parseISO(c.created_at), 'MM');
        if (!acc[c.agent_id]) acc[c.agent_id] = { p1: 0, p2: 0 };
        if (['01','02','03'].includes(m)) acc[c.agent_id].p1++;
        if (['04','05','06'].includes(m)) acc[c.agent_id].p2++;
        return acc;
      }, {});

      const enacList = Object.entries(enacStats).map(([id, stats]: any) => {
        const p = profilesData.find(p => p.agent_code === id);
        const jDate = p?.join_date ? parseISO(p.join_date) : new Date(2020, 0, 1);
        return {
          id, value: stats.p1 + stats.p2, enacP1: stats.p1, enacP2: stats.p2,
          designation: p?.rank || "PP", category: isAfter(jDate, new Date(2025, 0, 1)) ? 'ROOKIE' : 'PP'
        };
      }).sort((a, b) => b.value - a.value);

      setEnacLeaderboard(enacList);

      setAgentData({
        ...effectiveProfile,
        category: isAfter(joinDate, new Date(2025, 0, 1)) ? 'ROOKIE' : 'PP',
        totalAfyc: myCases.reduce((s, c) => s + Number(c.premium || 0), 0),
        caseCount: myCases.length,
        janAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '01').reduce((s, c) => s + Number(c.premium), 0),
        febAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '02').reduce((s, c) => s + Number(c.premium), 0),
        monthlyCounts: myCases.reduce((acc, c) => {
           const idx = differenceInMonths(startOfMonth(parseISO(c.created_at)), startOfMonth(joinDate));
           if (idx >= 0 && idx <= 3) acc[idx] = (acc[idx] || 0) + 1;
           return acc;
        }, {0:0, 1:0, 2:0, 3:0}),
        enacPeriod1: enacStats[effectiveProfile.agent_code]?.p1 || 0,
        enacPeriod2: enacStats[effectiveProfile.agent_code]?.p2 || 0
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openModal = (type: string) => {
    setActiveContest(type);
    if (type === "growbig" || type === "growbiggroup" || type === "consistentclub") {
        setActiveSegment("Monthly");
    } else if (type === "enac") {
        setActiveSegment("ROOKIE");
    } else if (type === "rs") {
        setActiveSegment("Level 1");
    } else if (type === "consistent") {
        setActiveSegment("Tier 1");
    } else {
        setActiveSegment("All");
    }
    setIsDialogOpen(true);
  };

  const renderAdminLeaderboard = () => {
    const list = activeContest === 'enac' ? enacLeaderboard.filter(a => a.category === activeSegment) : afycLeaderboard;
    const unit = activeContest === 'enac' ? "Cases" : "RM";
    
    // Select image based on active contest
    let bgImage = "/consistentclub.jpeg";
    if (activeContest === 'experience') bgImage = "/danang.jpeg";
    if (activeContest === 'rs') bgImage = "/surabaya.jpeg";
    if (activeContest === 'enac') bgImage = "/enac.jpeg";

    return (
      <div className="flex flex-col">
        <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
             style={{ backgroundImage: `url("${bgImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-slate-900/50 z-0" />
          <div className="relative z-10">
            <Badge className="bg-blue-600 mb-2 uppercase text-[10px] font-black">Admin Management</Badge>
            <DialogTitle className="text-4xl font-black italic uppercase tracking-tighter">Leaderboard Standings</DialogTitle>
          </div>
          <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
            {activeContest === 'enac' ? ["ROOKIE", "PP"].map(opt => (
              <Button key={opt} onClick={() => setActiveSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${activeSegment === opt ? "bg-white text-slate-900" : "text-white/40"}`}>{opt}</Button>
            )) : ["All"].map(opt => (
              <Button key={opt} className="h-9 px-6 text-[10px] font-black rounded-full bg-white text-slate-900">{opt}</Button>
            ))}
          </div>
        </div>
        <div className="p-10">
           <ContestLeaderboard list={list} unit={unit} currentAgentCode={agentData?.agent_code} isEnac={activeContest === 'enac'} />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      {loading || !agentData ? (
        <ContestSkeleton />
      ) : (
        <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto min-h-screen transition-opacity duration-500">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">Contest Page</h1>
              <p className="text-muted-foreground">Performance Ranking for {agentData.full_name}</p>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <StatCard title="AIT Experience" image="/danang.jpeg" target={100000} color="blue" onClick={() => openModal('experience')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
            <StatCard title="AIT RS 2026" image="/surabaya.jpeg" target={60000} color="indigo" onClick={() => openModal('rs')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
            <StatCard title="eNAC 2026" image="/enac.jpeg" target={agentData.category === 'ROOKIE' ? 8 : 26} unit="Cases" color="amber" onClick={() => openModal('enac')} isAdmin={isAdmin} currentAfyc={agentData.caseCount} leaderboard={enacLeaderboard} />
            <StatCard title="Consistent Club Rookie Year 1" image="/consistentclub.jpeg" target={36000} color="emerald" onClick={() => openModal('consistent')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
            <StatCard title="Consistent Club" image="/consistentclub.jpeg" target={30000} color="violet" onClick={() => openModal('consistentclub')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
            <StatCard title="Grow Big (Direct)" image="/consistentclub.jpeg" target={90000} color="rose" onClick={() => openModal('growbig')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
            <StatCard title="Grow Big (Group)" image="/consistentclub.jpeg" target={100000} color="sky" onClick={() => openModal('growbiggroup')} isAdmin={isAdmin} currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[950px] p-0 border-none rounded-[2.5rem] bg-white shadow-2xl overflow-hidden">
              {isAdmin ? renderAdminLeaderboard() : (
                <>
                  {activeContest === 'enac' && <ENACView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={enacLeaderboard} />}
                  {activeContest === 'experience' && <ExperienceView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} allProfiles={allProfiles} />}
                  {activeContest === 'rs' && <RSView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                  {activeContest === 'consistent' && <ConsistentView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                  {activeContest === 'consistentclub' && <ConsistentClubView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                  {activeContest === 'growbig' && <GrowBigView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                  {activeContest === 'growbiggroup' && <GrowBigGroupView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                </>
              )}
              <div className="p-6 bg-slate-50 border-t flex justify-center">
                <Button onClick={() => setIsDialogOpen(false)} variant="ghost" className="rounded-full px-10 font-black text-[11px] uppercase tracking-[0.2em] text-slate-400">Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}

// --- SHARED UI ---

function StatCard({ title, icon, image, target, onClick, unit = "RM", color, isAdmin, currentAfyc, leaderboard }: any) {
  const colorMap: any = { blue: "bg-blue-600", indigo: "bg-indigo-600", amber: "bg-amber-500", emerald: "bg-emerald-600", rose: "bg-rose-600", sky: "bg-sky-600", violet: "bg-violet-600" };
  
  const winnersCount = useMemo(() => {
    if (!isAdmin || !leaderboard) return 0;
    return leaderboard.filter((agent: any) => agent.value >= target).length;
  }, [isAdmin, leaderboard, target]);

  const progress = Math.min(100, (currentAfyc / target) * 100);

  return (
    <Card onClick={onClick} className="group relative cursor-pointer border-none bg-white rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden">
      <CardContent className="p-8">
        <div className="flex justify-between items-start mb-10">
          <div className={`p-4 ${colorMap[color]} text-white rounded-2xl shadow-lg relative overflow-hidden h-14 w-14 flex items-center justify-center`}>
            {image ? <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100" /> : icon}
          </div>
          <Badge variant="ghost" className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest leading-none">Active</Badge>
        </div>
        
        <div className="mb-8">
          <h3 className="text-xl font-black text-slate-900 leading-tight">{title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Campaign 2026</p>
        </div>

        {isAdmin ? (
          <div className="pt-4 border-t border-slate-50 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
               <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Total Qualified</p>
              <p className="text-xl font-black text-slate-900">{winnersCount} Agents</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-2xl font-black text-slate-900">{unit === "RM" ? "RM" : ""} {currentAfyc.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-slate-400">/ {target.toLocaleString()}</div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${colorMap[color]} transition-all duration-1000`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- REMAINING DYNAMIC VIEWS ---

function ExperienceView({ data, segment, setSegment, leaderboard, allProfiles }: any) {
  const isRookie = data.category === 'ROOKIE';
  const passedPreReq = isRookie ? (data.janAfyc >= 5000 && data.febAfyc >= 5000) : (data.janAfyc >= 10000 && data.febAfyc >= 10000);
  const filtered = useMemo(() => leaderboard.filter((agent: any) => {
    const p = allProfiles.find((ap: any) => ap.agent_code === agent.id);
    if (segment === "All") return true;
    if (!p) return false;
    const rank = p.rank?.toLowerCase();
    if (segment === "PP") return rank === "agent";
    if (segment === "AD") return rank === "ad" || rank === "agency director";
    if (segment === "GAD") return rank === "gad" || rank === "group agency director";
    return true;
  }), [segment, leaderboard, allProfiles]);

  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/danang.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">AIT Experience 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Leaderboard Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["All", "PP", "AD", "GAD"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 border-b border-blue-100 pb-2">Qualification Status</h4>
            <CheckItem label="Pre-requisite (Jan & Feb Production)" done={passedPreReq} />
            <CheckItem label="Minimum AFYC: RM 100,000" done={data.totalAfyc >= 100000} />
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Plane className="w-8 h-8 text-blue-400 mx-auto mb-3 opacity-80" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">AIT Experience Trip 2026</h2>
          </div>
        </div>
        <ContestLeaderboard list={filtered} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function RSView({ data, segment, setSegment, leaderboard }: any) {
  const isL1 = segment === "Level 1";
  const targetAfyc = isL1 ? 30000 : 60000;
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/surabaya.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">AIT RS 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Retail Sales Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["Level 1", "Level 2"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">{isL1 ? "Level 1 Requirements" : "Level 2 Requirements"}</h4>
            <CheckItem label={`Minimum AFYC: RM ${targetAfyc.toLocaleString()}`} done={data.totalAfyc >= targetAfyc} />
            <CheckItem label={`Minimum Number of Cases: ${isL1 ? 3 : 6}`} done={data.caseCount >= (isL1 ? 3 : 6)} />
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Gift className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-80" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter">{isL1 ? "Ipad Voucher (RM 1,800)" : "1 Ticket to Yogyakarta"}</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function ENACView({ data, segment, setSegment, leaderboard }: any) {
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/enac.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">eNAC 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Segment Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["ROOKIE", "PP"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 font-bold">Your Progress ({data.category})</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-blue-100 text-center shadow-sm"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">P1 Cases</p><p className="text-2xl font-black">{data.enacPeriod1}</p></div>
              <div className="bg-white p-4 rounded-2xl border border-blue-100 text-center shadow-sm"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">P2 Cases</p><p className="text-2xl font-black">{data.enacPeriod2}</p></div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-[2rem] p-8 text-center shadow-xl">
             <Ticket className="w-10 h-10 text-blue-500 mx-auto mb-2 opacity-50" />
             <p className="text-4xl font-black text-white italic leading-tight uppercase">{getQualifiedTicket(data.enacPeriod1, data.enacPeriod2, data.category)}</p>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard.filter((a:any) => a.category === segment)} unit="Cases" currentAgentCode={data.agent_code} isEnac={true} />
      </div>
    </div>
  );
}

function ConsistentClubView({ data, segment, setSegment, leaderboard }: any) {
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-violet-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">Consistent Club</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Consistency Challenge</DialogTitle>
        </div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["Monthly", "Quarterly"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-violet-50/50 border border-violet-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-4 border-b border-violet-100 pb-2">{segment} Prize Tiers</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-2xl border border-violet-100"><span className="text-xs font-bold">1st Place Reward</span><span className="text-sm font-black text-violet-600">RM 1,000</span></div>
              <div className="flex justify-between items-center p-3 bg-white rounded-2xl border border-violet-100"><span className="text-xs font-bold">Consolation Reward</span><span className="text-sm font-black text-violet-600">RM 100</span></div>
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Trophy className="w-8 h-8 text-violet-400 mx-auto mb-3 opacity-80" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">Consistency Pay-out</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function GrowBigGroupView({ data, segment, setSegment, leaderboard }: any) {
  const isMonthly = segment === "Monthly";
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-sky-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">Grow Big With Quality (Group)</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Group Growth Ranking</DialogTitle>
        </div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["Monthly", "Quarterly"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-sky-50/50 border border-sky-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-4 border-b border-sky-100 pb-2">{segment} Prize Requirements</h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-sky-100 shadow-sm"><span className="text-xs font-bold text-slate-900">1st Prize: {isMonthly ? "RM 30,000" : "RM 90,000"}</span></div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "40% or RM 600,000 (Higher)" : "40% or RM 2,000,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 20 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "20" : "70"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-sky-100 shadow-sm"><span className="text-xs font-bold text-slate-900">2nd Prize: {isMonthly ? "RM 20,000" : "RM 60,000"}</span></div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "30% or RM 400,000 (Higher)" : "30% or RM 1,500,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 15 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "12" : "20"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-sky-100 shadow-sm"><span className="text-xs font-bold text-slate-900">3rd Prize: {isMonthly ? "RM 10,000" : "RM 30,000"}</span></div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "20% or RM 200,000 (Higher)" : "20% or RM 700,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 8 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "8" : "20"}</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Trophy className="w-8 h-8 text-sky-400 mx-auto mb-3 opacity-80" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">Elite Group Awards</h2>
             <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase border-t border-slate-800 pt-4 tracking-widest">Leaders under NALIS are excluded</p>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function GrowBigView({ data, segment, setSegment, leaderboard }: any) {
  const isMonthly = segment === "Monthly";

  return (
    <div className="flex flex-col">
      <div 
        className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-rose-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">Grow Big With Quality (Direct)</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Personal Growth Ranking</DialogTitle>
        </div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
          {["Monthly", "Quarterly"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-rose-50/50 border border-rose-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4 border-b border-rose-100 pb-2">{segment} Prize Requirements</h4>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <span className="text-xs font-bold text-slate-900">1st Prize: {isMonthly ? "RM 30,000" : "RM 90,000"}</span>
                </div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "40% or RM 300,000 (Higher)" : "40% or RM 1,000,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 12 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "10" : "35"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <span className="text-xs font-bold text-slate-900">2nd Prize: {isMonthly ? "RM 20,000" : "RM 60,000"}</span>
                </div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "30% or RM 200,000 (Higher)" : "30% or RM 700,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 8 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "6" : "20"}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <span className="text-xs font-bold text-slate-900">3rd Prize: {isMonthly ? "RM 10,000" : "RM 30,000"}</span>
                </div>
                <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                  <li>• AFYC Increment: {isMonthly ? "20% or RM 100,000 (Higher)" : "20% or RM 400,000 (Higher)"}</li>
                  <li>• Min. Active Agents: 6 {isMonthly ? "" : "Monthly"}</li>
                  <li>• Min. New Recruits: {isMonthly ? "3" : "10"}</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Sparkles className="w-8 h-8 text-rose-400 mx-auto mb-3 opacity-80" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">Top Growth Awards</h2>
             <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase border-t border-slate-800 pt-4 tracking-widest">Leaders under NALIS are excluded</p>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function ContestLeaderboard({ list, unit = "RM", currentAgentCode, isEnac = false }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-3"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-[0.2em]">Ranking Standings</h4><Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-50 text-[9px] font-black uppercase tracking-widest">Live</Badge></div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {list.slice(0, 10).map((agent: any, i: number) => {
          const isMe = agent.id === currentAgentCode;
          const ticket = isEnac ? getQualifiedTicket(agent.enacP1, agent.enacP2, agent.category) : null;
          return (
            <div key={agent.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isMe ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-50 shadow-sm'}`}>
              <div className="flex items-center gap-4"><span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span><div><p className="text-xs font-bold text-slate-800 tracking-tight">{agent.id} {isMe && "★"}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{agent.designation}</p></div></div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-900">{unit === "RM" ? `RM ${agent.value.toLocaleString()}` : `${agent.value} Cases`}</p>
                {isEnac && <p className={`text-[8px] font-bold mt-1 uppercase ${ticket === 'VIP' ? 'text-amber-500' : ticket === 'ORDINARY' ? 'text-blue-500' : 'text-slate-300'}`}>{ticket}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getQualifiedTicket(p1: number, p2: number, category: string): "VIP" | "ORDINARY" | "NONE" {
  const isRookie = category === 'ROOKIE';
  const total = p1 + p2;
  const vipWash = isRookie ? 14 : 50; const ordWash = isRookie ? 8 : 26;
  if ((p1 >= (isRookie ? 6 : 24) && p2 >= (isRookie ? 6 : 24)) || total >= vipWash) return "VIP";
  if ((p1 >= (isRookie ? 3 : 12) && p2 >= (isRookie ? 3 : 12)) || total >= ordWash) return "ORDINARY";
  return "NONE";
}

function CheckItem({ label, done }: any) {
  return (
    <div className="flex items-center justify-between py-3"><span className={`text-xs ${done ? "text-slate-900 font-black" : "text-slate-400 font-medium"}`}>{label}</span>{done ? (<div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg shadow-emerald-500/20"><CheckCircle2 className="h-3 w-3" /></div>) : (<div className="bg-slate-100 text-slate-300 p-1 rounded-full"><AlertCircle className="h-3 w-3" /></div>)}</div>
  );
}
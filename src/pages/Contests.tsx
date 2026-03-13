import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Smartphone, Zap, CheckCircle2, AlertCircle, Trophy, Ticket, Gift } from "lucide-react";
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[220px] bg-white rounded-[2rem] border border-slate-100 p-8 space-y-4">
            <div className="h-12 w-12 bg-slate-100 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-6 w-3/4 bg-slate-100 rounded" />
              <div className="h-3 w-1/2 bg-slate-50 rounded" />
            </div>
            <div className="pt-4 space-y-2">
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-2 w-full bg-slate-50 rounded-full" />
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
          id,
          value: stats.p1 + stats.p2,
          enacP1: stats.p1,
          enacP2: stats.p2,
          designation: p?.rank || "PP",
          category: isAfter(jDate, new Date(2025, 0, 1)) ? 'ROOKIE' : 'PP'
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
    if (type === "enac") setActiveSegment("ROOKIE");
    else if (type === "rs") setActiveSegment("Level 1");
    else if (type === "consistent") setActiveSegment("Tier 1");
    else setActiveSegment("All");
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      {loading || !agentData ? (
        <ContestSkeleton />
      ) : (
        <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto min-h-screen transition-opacity duration-500">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                Elite <span className="text-blue-600">Contests</span>
              </h1>
              <p className="text-slate-500 font-medium tracking-tight italic">Performance Status for {agentData.full_name}</p>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="AIT Experience" icon={<Plane className="w-5 h-5" />} afyc={agentData.totalAfyc} target={100000} color="blue" onClick={() => openModal('experience')} />
            <StatCard title="AIT RS 2026" icon={<Smartphone className="w-5 h-5" />} afyc={agentData.totalAfyc} target={60000} color="indigo" onClick={() => openModal('rs')} />
            <StatCard title="eNAC 2026" icon={<Trophy className="w-5 h-5" />} afyc={agentData.caseCount} target={agentData.category === 'ROOKIE' ? 8 : 26} unit="Cases" color="amber" onClick={() => openModal('enac')} />
            <StatCard title="Consistent Club" icon={<Zap className="w-5 h-5" />} afyc={agentData.totalAfyc} target={36000} color="emerald" onClick={() => openModal('consistent')} />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[950px] p-0 border-none rounded-[2.5rem] bg-white shadow-2xl overflow-hidden">
              {activeContest === 'enac' && <ENACView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={enacLeaderboard} />}
              {activeContest === 'experience' && <ExperienceView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} allProfiles={allProfiles} />}
              {activeContest === 'rs' && <RSView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
              {activeContest === 'consistent' && <ConsistentView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
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

// --- 4. DYNAMIC MODAL VIEWS (Rest of components remain the same) ---

function ExperienceView({ data, segment, setSegment, leaderboard, allProfiles }: any) {
  const isRookie = data.category === 'ROOKIE';
  const passedPreReq = isRookie ? (data.janAfyc >= 5000 && data.febAfyc >= 5000) : (data.janAfyc >= 10000 && data.febAfyc >= 10000);

  const filteredLeaderboard = useMemo(() => {
      return leaderboard.filter((agent: any) => {
          const p = allProfiles.find((ap: any) => ap.agent_code === agent.id);
          if (!p || segment === "All") return true;
          return p.rank === segment;
      });
  }, [segment, leaderboard, allProfiles]);

  return (
    <div className="flex flex-col">
      <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
        <div>
          <Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">AIT Experience 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Leaderboard Ranking</DialogTitle>
        </div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20">
          {["All", "PP", "AD", "GAD"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 border-b border-blue-100 pb-2">Qualification Status</h4>
            <div className="space-y-1">
              <CheckItem label="Pre-requisite (Jan & Feb Production)" done={passedPreReq} />
              <CheckItem label="Minimum AFYC: RM 100,000" done={data.totalAfyc >= 100000} />
              <p className="text-[9px] text-slate-400 italic mt-2 uppercase">* Rookie: RM 5k/mo | Leader: RM 10k/mo (Jan & Feb)</p>
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Plane className="w-8 h-8 text-blue-400 mx-auto mb-3 opacity-80" />
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Campaign Prize</p>
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">AIT Experience Trip 2026</h2>
             <p className="text-[9px] text-slate-600 mt-2 uppercase font-medium italic tracking-wider">Flight + Accommodation Included</p>
          </div>
        </div>
        <ContestLeaderboard list={filteredLeaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function RSView({ data, segment, setSegment, leaderboard }: any) {
  const isL1 = segment === "Level 1";
  const targetAfyc = isL1 ? 30000 : 60000;
  const targetCases = isL1 ? 3 : 6;
  const targetCypr = 90;

  return (
    <div className="flex flex-col">
      <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
        <div>
          <Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">AIT RS 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Retail Sales Ranking</DialogTitle>
        </div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20">
          {["Level 1", "Level 2"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">{isL1 ? "Level 1 Requirements" : "Level 2 Requirements"}</h4>
            <div className="space-y-1">
              <CheckItem label={`Minimum AFYC: RM ${targetAfyc.toLocaleString()}`} done={data.totalAfyc >= targetAfyc} />
              <CheckItem label={`Minimum Number of Cases: ${targetCases}`} done={data.caseCount >= targetCases} />
              <CheckItem label={`Minimum CYPR: ${targetCypr}%`} done={(data.cypr || 0) >= targetCypr} />
              {isL1 && <CheckItem label="Attended VB101" done={!!data.attended_vb101} />}
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
             <Gift className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-80" />
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Expected Reward</p>
             <h2 className="text-3xl font-black text-white italic tracking-tighter">{isL1 ? "Ipad Voucher (RM 1,800)" : "1 Ticket to Yogyakarta"}</h2>
             <p className="text-[9px] text-slate-600 mt-2 uppercase font-medium italic">Terms & conditions apply</p>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
      </div>
    </div>
  );
}

function ENACView({ data, segment, setSegment, leaderboard }: any) {
  const filteredLeaderboard = leaderboard.filter((agent: any) => agent.category === segment);
  return (
    <div className="flex flex-col">
      <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
        <div><Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">eNAC 2026</Badge><DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Segment Ranking</DialogTitle></div>
        <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20">
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
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Qualified Ticket</p>
             <p className="text-4xl font-black text-white italic leading-tight uppercase">{getQualifiedTicket(data.enacPeriod1, data.enacPeriod2, data.category)}</p>
          </div>
        </div>
        <ContestLeaderboard list={filteredLeaderboard} unit="Cases" currentAgentCode={data.agent_code} isEnac={true} />
      </div>
    </div>
  );
}

function ConsistentView({ data, segment, setSegment, leaderboard }: any) {
    const isT2 = segment === "Tier 2";
    const totalM0toM3 = (data.monthlyCounts[0] || 0) + (data.monthlyCounts[1] || 0) + (data.monthlyCounts[2] || 0) + (data.monthlyCounts[3] || 0);
    const expectedReward = data.totalAfyc * 0.01;

    return (
      <div className="flex flex-col">
        <div className="p-10 bg-[#0F172A] text-white flex justify-between items-center">
          <div><Badge className="bg-blue-600 mb-2 border-none px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest leading-none">Consistent Club</Badge><DialogTitle className="text-4xl font-black italic tracking-tighter leading-tight">Consistency Tracker</DialogTitle></div>
          <div className="relative z-50 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20">
            {["Tier 1", "Tier 2"].map((opt) => (
              <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>{opt}</Button>
            ))}
          </div>
        </div>
        <div className="p-10 grid md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">{isT2 ? "Tier 2 Requirement" : "Tier 1 Requirement"}</h4>
              {isT2 ? (
                <div className="space-y-1">
                   <CheckItem label="Total Cases (Month 0 - Month 3)" done={totalM0toM3 >= 6} />
                   <p className="text-[10px] text-slate-400 italic mt-2">Current Count: {totalM0toM3} / 6 Cases</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <CheckItem label="M1 Goal (3 Cases)" done={data.monthlyCounts[0] >= 3} />
                  <CheckItem label="M2 Goal (3 Cases)" done={data.monthlyCounts[1] >= 3} />
                  <CheckItem label="M3 Goal (3 Cases)" done={data.monthlyCounts[2] >= 3} />
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-900 rounded-[2rem] text-center shadow-xl border border-slate-800">
               <Zap className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-80" />
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Estimated Club Bonus</p>
               <h2 className="text-4xl font-black text-emerald-400 tracking-tighter">RM {expectedReward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
               <p className="text-[9px] text-slate-600 mt-2 uppercase font-medium italic">Calculated at 1% of total production</p>
            </div>
          </div>
          <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} />
        </div>
      </div>
    );
}

// --- LOGIC HELPERS ---
function getQualifiedTicket(p1: number, p2: number, category: string): "VIP" | "ORDINARY" | "NONE" {
  const isRookie = category === 'ROOKIE';
  const total = p1 + p2;
  const vipP1 = isRookie ? 6 : 24; const vipP2 = isRookie ? 6 : 24; const vipWash = isRookie ? 14 : 50;
  if ((p1 >= vipP1 && p2 >= vipP2) || total >= vipWash) return "VIP";
  const ordP1 = isRookie ? 3 : 12; const ordP2 = isRookie ? 3 : 12; const ordWash = isRookie ? 8 : 26;
  if ((p1 >= ordP1 && p2 >= ordP2) || total >= ordWash) return "ORDINARY";
  return "NONE";
}

// --- SHARED UI ---
function StatCard({ title, icon, afyc, target, onClick, unit = "RM", color }: any) {
  const progress = Math.min(100, (afyc / target) * 100);
  const colorMap: any = { blue: "bg-blue-600", indigo: "bg-indigo-600", amber: "bg-amber-500", emerald: "bg-emerald-600" };
  return (
    <Card onClick={onClick} className="group relative cursor-pointer border-none bg-white rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden">
      <CardContent className="p-8">
        <div className="flex justify-between items-start mb-10"><div className={`p-4 ${colorMap[color]} text-white rounded-2xl shadow-lg`}>{icon}</div><Badge variant="ghost" className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest leading-none">Active</Badge></div>
        <div className="mb-8"><h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{title}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Campaign 2026</p></div>
        <div className="space-y-4"><div className="flex justify-between items-end"><div className="text-2xl font-black text-slate-900">{unit === "RM" ? "RM" : ""} {afyc.toLocaleString()}</div><div className="text-[10px] font-bold text-slate-400">/ {target.toLocaleString()}</div></div><div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${colorMap[color]} transition-all duration-1000`} style={{ width: `${progress}%` }} /></div></div>
      </CardContent>
    </Card>
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

function CheckItem({ label, done }: any) {
  return (
    <div className="flex items-center justify-between py-3"><span className={`text-xs ${done ? "text-slate-900 font-black" : "text-slate-400 font-medium"}`}>{label}</span>{done ? (<div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg shadow-emerald-500/20"><CheckCircle2 className="h-3 w-3" /></div>) : (<div className="bg-slate-100 text-slate-300 p-1 rounded-full"><AlertCircle className="h-3 w-3" /></div>)}</div>
  );
}
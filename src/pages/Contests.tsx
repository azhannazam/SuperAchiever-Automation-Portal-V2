import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plane, Zap, CheckCircle2, AlertCircle, Trophy, Ticket, 
  Sparkles, Users, TrendingUp, Calendar, Award, Star,
  ShieldCheck, Clock, Gift, Crown, Medal, UserCheck, Activity
} from "lucide-react";
import { format, parseISO, isAfter, differenceInMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

// --- 1. INTERFACES ---
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
  attended_vb101?: boolean;
  cpd_hours?: number;
  status?: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  value: number;
  designation: string;
  enacP1: number;
  enacP2: number;
  enacTotal: number;
  category: string;
  ticket: "VIP" | "ORDINARY" | "NONE";
  cypr?: number;
  pr13?: number;
  cpd_hours?: number;
  qualifies: boolean;
}

interface AgentStats extends Profile {
  category: string;
  totalAfyc: number;
  caseCount: number;
  enacP1: number;
  enacP2: number;
  enacTotal: number;
  enacTicket: "VIP" | "ORDINARY" | "NONE";
  enacQualifies: boolean;
  janAfyc: number;
  febAfyc: number;
  monthlyCounts: Record<number, number>;
}

interface ADENACStats {
  adCode: string;
  adName: string;
  totalWinners: number;
  rookieWinners: number;
  productionWinners: number;
  activeAgentsPerMonth: number;
  newRecruits: number;
  qualifiesOrdinary: boolean;
  qualifiesVIP: boolean;
  ticket: "VIP" | "ORDINARY" | "NONE";
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
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[220px] bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <div className="h-12 w-12 bg-slate-100 rounded-xl" />
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
  const [growBigLeaderboard, setGrowBigLeaderboard] = useState<any[]>([]);
  const [enacLeaderboard, setEnacLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [adENACStats, setAdENACStats] = useState<ADENACStats[]>([]);
  const [gadENACStats, setGadENACStats] = useState<ADENACStats[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allCases, setAllCases] = useState<any[]>([]);

  const isAdmin = useMemo(() => role === "admin" || user?.email === "admin@superachiever.com", [role, user]);

  useEffect(() => { if (user) fetchData(); }, [user]);

  // Helper to check if someone is under a specific leader
  const isUnderLeader = (person: Profile, leaderName: string, leaderCode: string) => {
    const introducer = person.introducer_name?.trim();
    const leader = person.leader_name?.trim();
    return (
      introducer === leaderName || introducer === leaderCode ||
      leader === leaderName || leader === leaderCode
    );
  };

  // Calculate eNAC ticket based on P1 and P2 cases
  const calculateENACTicket = (p1: number, p2: number, category: string): "VIP" | "ORDINARY" | "NONE" => {
    const isRookie = category === 'ROOKIE';
    const total = p1 + p2;
    
    const vipP1 = isRookie ? 6 : 24;
    const vipP2 = isRookie ? 6 : 24;
    const vipWash = isRookie ? 14 : 50;
    
    const ordP1 = isRookie ? 3 : 12;
    const ordP2 = isRookie ? 3 : 12;
    const ordWash = isRookie ? 8 : 26;
    
    if ((p1 >= vipP1 && p2 >= vipP2) || total >= vipWash) return "VIP";
    if ((p1 >= ordP1 && p2 >= ordP2) || total >= ordWash) return "ORDINARY";
    return "NONE";
  };

  // Check if agent qualifies for eNAC (meets all requirements)
  const checkENACQualification = (agent: LeaderboardEntry): boolean => {
    if (agent.ticket === "NONE") return false;
    
    const requiredRatio = agent.designation.includes("AGENCY DIRECTOR") ? 85 : 
                         agent.designation.includes("GROUP AGENCY DIRECTOR") ? 80 : 90;
    
    const ratio = agent.pr13 || agent.cypr || 0;
    if (ratio < requiredRatio) return false;
    
    if ((agent.cpd_hours || 0) < 15) return false;
    
    return true;
  };

  // Calculate AD/GAD eNAC qualification
  const calculateADENACStats = (profilesData: Profile[], enacQualifiedList: LeaderboardEntry[]) => {
    const ads = profilesData.filter(p => {
      const rank = p.rank?.trim().toUpperCase();
      return rank === "AD" || rank === "AGENCY DIRECTOR";
    });
    
    const gads = profilesData.filter(p => {
      const rank = p.rank?.trim().toUpperCase();
      return rank === "GAD" || rank === "GROUP AGENCY DIRECTOR";
    });
    
    const adStats: ADENACStats[] = ads.map(ad => {
      const agentsUnderAD: string[] = [];
      
      const level1 = profilesData.filter(p => isUnderLeader(p, ad.full_name, ad.agent_code));
      level1.forEach(p1 => {
        agentsUnderAD.push(p1.agent_code);
        
        const r1 = p1.rank?.trim().toUpperCase();
        if (r1 === "AGENCY GROWTH MANAGER" || r1 === "AGM") {
          const level2 = profilesData.filter(p => isUnderLeader(p, p1.full_name, p1.agent_code));
          level2.forEach(p2 => {
            agentsUnderAD.push(p2.agent_code);
            
            const r2 = p2.rank?.trim().toUpperCase();
            if (r2 === "SENIOR AGM") {
              const level3 = profilesData.filter(p => isUnderLeader(p, p2.full_name, p2.agent_code));
              level3.forEach(p3 => agentsUnderAD.push(p3.agent_code));
            }
          });
        } else if (r1 === "SENIOR AGM") {
          const level2 = profilesData.filter(p => isUnderLeader(p, p1.full_name, p1.agent_code));
          level2.forEach(p2 => agentsUnderAD.push(p2.agent_code));
        }
      });
      
      const winnersUnderAD = enacQualifiedList.filter(w => agentsUnderAD.includes(w.id));
      const rookieWinners = winnersUnderAD.filter(w => w.category === "ROOKIE");
      const productionWinners = winnersUnderAD.filter(w => w.category === "PP");
      
      const activeAgentsPerMonth = Math.min(4, Math.floor(winnersUnderAD.length / 3));
      
      const newRecruits = profilesData.filter(p => {
        const joinDate = parseISO(p.join_date);
        return isAfter(joinDate, new Date(2026, 0, 1)) && isUnderLeader(p, ad.full_name, ad.agent_code);
      }).length;
      
      const qualifiesOrdinary = winnersUnderAD.length >= 4 && activeAgentsPerMonth >= 4 && newRecruits >= 3;
      const qualifiesVIP = winnersUnderAD.length >= 8 && activeAgentsPerMonth >= 4 && newRecruits >= 3;
      
      let ticket: "VIP" | "ORDINARY" | "NONE" = "NONE";
      if (qualifiesVIP) ticket = "VIP";
      else if (qualifiesOrdinary) ticket = "ORDINARY";
      
      return {
        adCode: ad.agent_code,
        adName: ad.full_name,
        totalWinners: winnersUnderAD.length,
        rookieWinners: rookieWinners.length,
        productionWinners: productionWinners.length,
        activeAgentsPerMonth,
        newRecruits,
        qualifiesOrdinary,
        qualifiesVIP,
        ticket
      };
    });
    
    const gadStats: ADENACStats[] = gads.map(gad => {
      const adsUnderGAD = ads.filter(ad => isUnderLeader(ad, gad.full_name, gad.agent_code));
      
      let totalWinners = 0;
      adsUnderGAD.forEach(ad => {
        const adStat = adStats.find(a => a.adCode === ad.agent_code);
        if (adStat) totalWinners += adStat.totalWinners;
      });
      
      const directAgents = profilesData.filter(p => isUnderLeader(p, gad.full_name, gad.agent_code));
      const directWinners = enacQualifiedList.filter(w => directAgents.some(a => a.agent_code === w.id));
      totalWinners += directWinners.length;
      
      const qualifiesOrdinary = totalWinners >= 6;
      const qualifiesVIP = totalWinners >= 12;
      
      let ticket: "VIP" | "ORDINARY" | "NONE" = "NONE";
      if (qualifiesVIP) ticket = "VIP";
      else if (qualifiesOrdinary) ticket = "ORDINARY";
      
      return {
        adCode: gad.agent_code,
        adName: gad.full_name,
        totalWinners,
        rookieWinners: 0,
        productionWinners: 0,
        activeAgentsPerMonth: 8,
        newRecruits: 6,
        qualifiesOrdinary,
        qualifiesVIP,
        ticket
      };
    });
    
    setAdENACStats(adStats);
    setGadENACStats(gadStats);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle() as { data: Profile | null };
      const effectiveProfile = profile || { 
        id: user?.id, agent_code: "ADMIN", full_name: "Admin", rank: "GAD", 
        join_date: "2020-01-01", cypr: 100, attended_vb101: true, cpd_hours: 15 
      } as Profile;
      
      const { data: profilesData } = await supabase.from("profiles").select("*") as { data: Profile[] };
      if (!profilesData) return;
      setAllProfiles(profilesData);

      let allCasesData: any[] = [];
      let page = 0, pageSize = 1000, hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("cases").select("*").range(page * pageSize, (page + 1) * pageSize - 1);
        if (data && data.length > 0) { allCasesData = [...allCasesData, ...data]; page++; }
        if (!data || data.length < pageSize) hasMore = false;
      }
      setAllCases(allCasesData);

      // Calculate eNAC stats per agent
      const enacStatsMap = new Map<string, { p1: number; p2: number }>();
      allCasesData.forEach(c => {
        const m = format(parseISO(c.created_at), 'MM');
        if (!enacStatsMap.has(c.agent_id)) {
          enacStatsMap.set(c.agent_id, { p1: 0, p2: 0 });
        }
        const stats = enacStatsMap.get(c.agent_id)!;
        if (['01','02','03'].includes(m)) stats.p1++;
        if (['04','05','06'].includes(m)) stats.p2++;
      });

      // Build eNAC leaderboard
      const enacList: LeaderboardEntry[] = profilesData.map(p => {
        const stats = enacStatsMap.get(p.agent_code) || { p1: 0, p2: 0 };
        const joinDate = parseISO(p.join_date);
        const category = isAfter(joinDate, new Date(2026, 0, 1)) ? 'ROOKIE' : 'PP';
        const ticket = calculateENACTicket(stats.p1, stats.p2, category);
        
        return {
          id: p.agent_code,
          name: p.full_name,
          value: stats.p1 + stats.p2,
          enacP1: stats.p1,
          enacP2: stats.p2,
          enacTotal: stats.p1 + stats.p2,
          designation: p.rank || "Agent",
          category,
          ticket,
          cypr: p.cypr || 0,
          pr13: p.pr13 || 0,
          cpd_hours: p.cpd_hours || 0,
          qualifies: checkENACQualification({
            id: p.agent_code,
            name: p.full_name,
            value: stats.p1 + stats.p2,
            designation: p.rank || "Agent",
            enacP1: stats.p1,
            enacP2: stats.p2,
            enacTotal: stats.p1 + stats.p2,
            category,
            ticket,
            cypr: p.cypr || 0,
            pr13: p.pr13 || 0,
            cpd_hours: p.cpd_hours || 0,
            qualifies: false
          })
        };
      }).sort((a, b) => b.value - a.value);

      setEnacLeaderboard(enacList);

      const qualifiedWinners = enacList.filter(e => e.qualifies);
      calculateADENACStats(profilesData, qualifiedWinners);

      // Calculate AFYC leaderboard
      const afycMap = allCasesData.reduce((acc, c) => {
        acc[c.agent_id] = (acc[c.agent_id] || 0) + Number(c.premium);
        return acc;
      }, {});

      setAfycLeaderboard(Object.entries(afycMap).map(([id, val]) => {
        const p = profilesData.find(p => p.agent_code === id);
        return { id, name: p?.full_name || id, value: val as number, designation: p?.rank || "PP" };
      }).sort((a, b) => b.value - a.value));

      // Calculate Grow Big leaderboard
      const leaders = profilesData.filter(p => {
        const r = p.rank?.trim().toUpperCase();
        return r === "AD" || r === "GAD" || r === "AGENCY DIRECTOR" || r === "GROUP AGENCY DIRECTOR";
      });

      const growBigMapped = leaders.map(ad => {
        let unitTotal = afycMap[ad.agent_code] || 0;
        const countedInThisUnit = new Set<string>([ad.agent_code]);

        const level1 = profilesData.filter(p => isUnderLeader(p, ad.full_name, ad.agent_code));
        level1.forEach(p1 => {
          if (!countedInThisUnit.has(p1.agent_code)) {
            unitTotal += (afycMap[p1.agent_code] || 0);
            countedInThisUnit.add(p1.agent_code);

            const r1 = p1.rank?.trim().toUpperCase();
            if (r1 === "AGENCY GROWTH MANAGER" || r1 === "AGM") {
              const level2 = profilesData.filter(p => isUnderLeader(p, p1.full_name, p1.agent_code));
              level2.forEach(p2 => {
                if (!countedInThisUnit.has(p2.agent_code)) {
                  unitTotal += (afycMap[p2.agent_code] || 0);
                  countedInThisUnit.add(p2.agent_code);

                  const r2 = p2.rank?.trim().toUpperCase();
                  if (r2 === "SENIOR AGM") {
                    const level3 = profilesData.filter(p => isUnderLeader(p, p2.full_name, p2.agent_code));
                    level3.forEach(p3 => {
                      if (!countedInThisUnit.has(p3.agent_code)) {
                        unitTotal += (afycMap[p3.agent_code] || 0);
                        countedInThisUnit.add(p3.agent_code);
                      }
                    });
                  }
                }
              });
            } else if (r1 === "SENIOR AGM") {
              const level2 = profilesData.filter(p => isUnderLeader(p, p1.full_name, p1.agent_code));
              level2.forEach(p2 => {
                if (!countedInThisUnit.has(p2.agent_code)) {
                  unitTotal += (afycMap[p2.agent_code] || 0);
                  countedInThisUnit.add(p2.agent_code);
                }
              });
            }
          }
        });
        return { id: ad.agent_code, name: ad.full_name, value: unitTotal, designation: ad.rank };
      }).sort((a, b) => b.value - a.value);

      setGrowBigLeaderboard(growBigMapped);

      // Calculate user's personal stats
      const myCases = allCasesData.filter(c => c.agent_id === effectiveProfile.agent_code);
      const myENACStats = enacStatsMap.get(effectiveProfile.agent_code) || { p1: 0, p2: 0 };
      const joinDate = parseISO(effectiveProfile.join_date);
      const isRookie = isAfter(joinDate, new Date(2026, 0, 1));

      setAgentData({
        ...effectiveProfile,
        category: isRookie ? 'ROOKIE' : 'PP',
        totalAfyc: afycMap[effectiveProfile.agent_code] || 0,
        caseCount: myCases.length,
        enacP1: myENACStats.p1,
        enacP2: myENACStats.p2,
        enacTotal: myENACStats.p1 + myENACStats.p2,
        enacTicket: calculateENACTicket(myENACStats.p1, myENACStats.p2, isRookie ? 'ROOKIE' : 'PP'),
        enacQualifies: (() => {
          const ticket = calculateENACTicket(myENACStats.p1, myENACStats.p2, isRookie ? 'ROOKIE' : 'PP');
          if (ticket === "NONE") return false;
          const requiredRatio = effectiveProfile.rank?.includes("DIRECTOR") ? 85 : 90;
          const ratio = effectiveProfile.pr13 || effectiveProfile.cypr || 0;
          return ratio >= requiredRatio && (effectiveProfile.cpd_hours || 0) >= 15;
        })(),
        janAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '01').reduce((s, c) => s + Number(c.premium), 0),
        febAfyc: myCases.filter(c => format(parseISO(c.created_at), 'MM') === '02').reduce((s, c) => s + Number(c.premium), 0),
        monthlyCounts: myCases.reduce((acc, c) => {
          const idx = differenceInMonths(startOfMonth(parseISO(c.created_at)), startOfMonth(joinDate));
          if (idx >= 0 && idx <= 3) acc[idx] = (acc[idx] || 0) + 1;
          return acc;
        }, {0:0, 1:0, 2:0, 3:0})
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openModal = (type: string) => {
    setActiveContest(type);
    if (["growbig", "consistentclub", "consistent"].includes(type)) {
        setActiveSegment(type === "consistent" ? "Tier 1" : "Monthly");
    } else if (type === "enac") {
        setActiveSegment("ROOKIE");
    } else if (type === "rs") {
        setActiveSegment("Level 1");
    } else {
        setActiveSegment("All");
    }
    setIsDialogOpen(true);
  };

  const renderAdminLeaderboard = () => {
    const isEnac = activeContest === 'enac';
    const isGrowBig = activeContest === 'growbig';
    let list = isEnac ? enacLeaderboard.filter(a => a.category === activeSegment) : (isGrowBig ? growBigLeaderboard : afycLeaderboard);
    const unit = isEnac ? "Cases" : "RM";
    const target = isGrowBig ? 90000 : (activeContest === 'experience' ? 100000 : (activeContest === 'rs' ? 60000 : 30000));

    let bgImage = "/consistentclub.jpeg";
    let title = "Leaderboard Standings";
    if (activeContest === 'experience') { bgImage = "/danang.jpeg"; title = "AIT Experience Rankings"; }
    if (activeContest === 'rs') { bgImage = "/surabaya.jpeg"; title = "AIT RS Rankings"; }
    if (activeContest === 'enac') { bgImage = "/enac.jpeg"; title = "eNAC 2026 Rankings"; }

    return (
      <div className="flex flex-col text-slate-900">
        <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-52"
             style={{ backgroundImage: `url("${bgImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-slate-900/50 z-0" />
          <div className="relative z-10">
            <Badge className="bg-blue-600 mb-2 uppercase text-[10px] font-black">Admin Management</Badge>
            <DialogTitle className="text-4xl font-black italic uppercase tracking-tighter">{title}</DialogTitle>
          </div>
          <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
            {isEnac ? ["ROOKIE", "PP"].map(opt => (
              <Button key={opt} onClick={() => setActiveSegment(opt)} 
                className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${activeSegment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40 hover:text-white"}`}>
                {opt}
              </Button>
            )) : ["All"].map(opt => (
              <Button key={opt} className="h-9 px-6 text-[10px] font-black rounded-full bg-white text-slate-900">{opt}</Button>
            ))}
          </div>
        </div>
        <div className="p-10">
           <ContestLeaderboard list={list} unit={unit} currentAgentCode={agentData?.agent_code} isEnac={isEnac} target={target} />
        </div>
      </div>
    );
  };

  const isEligibleForGrowBigDirect = useMemo(() => {
    const userRank = agentData?.rank?.trim().toUpperCase();
    return isAdmin || userRank === "AD" || userRank === "GAD" || 
           userRank === "AGENCY DIRECTOR" || userRank === "GROUP AGENCY DIRECTOR";
  }, [isAdmin, agentData]);

  if (loading || !agentData) return <ContestSkeleton />;

  return (
    <DashboardLayout>
      <div className="relative p-6 space-y-10 max-w-[1400px] mx-auto min-h-screen transition-opacity duration-500 text-slate-900">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Contest Page
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </h1>
                <p className="text-muted-foreground text-sm">
                  Performance Ranking for {agentData.full_name}
                </p>
              </div>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border-amber-200 px-3 py-1.5">
            <Activity className="h-3 w-3 mr-1" />
            {agentData.category} Segment
          </Badge>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="AIT Experience" image="/danang.jpeg" target={100000} color="blue" 
            onClick={() => openModal('experience')} isAdmin={isAdmin} 
            currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
          
          <StatCard title="AIT RS 2026" image="/surabaya.jpeg" target={60000} color="indigo" 
            onClick={() => openModal('rs')} isAdmin={isAdmin} 
            currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
          
          <StatCard title="eNAC 2026" image="/enac.jpeg" target={agentData.category === 'ROOKIE' ? 8 : 26} 
            unit="Cases" color="amber" onClick={() => openModal('enac')} isAdmin={isAdmin} 
            currentAfyc={agentData.caseCount} leaderboard={enacLeaderboard} />
          
          <StatCard title="Consistent Club Rookie Year 1" image="/consistentclub.jpeg" target={36000} color="emerald" 
            onClick={() => openModal('consistent')} isAdmin={isAdmin} 
            currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
          
          <StatCard title="Consistent Club" image="/consistentclub.jpeg" target={30000} color="violet" 
            onClick={() => openModal('consistentclub')} isAdmin={isAdmin} 
            currentAfyc={agentData.totalAfyc} leaderboard={afycLeaderboard} />
          
          {isEligibleForGrowBigDirect && (
            <StatCard title="Grow Big (Direct)" image="/consistentclub.jpeg" target={90000} color="rose" 
              onClick={() => openModal('growbig')} isAdmin={isAdmin} 
              currentAfyc={agentData.totalAfyc} leaderboard={growBigLeaderboard} />
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[950px] p-0 border-none rounded-2xl bg-white shadow-2xl overflow-hidden">
            {isAdmin ? renderAdminLeaderboard() : (
              <>
                {activeContest === 'enac' && <ENACView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={enacLeaderboard} adStats={adENACStats} gadStats={gadENACStats} />}
                {activeContest === 'experience' && <ExperienceView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                {activeContest === 'rs' && <RSView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                {activeContest === 'consistent' && <ConsistentView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                {activeContest === 'consistentclub' && <ConsistentClubView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={afycLeaderboard} />}
                {activeContest === 'growbig' && <GrowBigView data={agentData} segment={activeSegment} setSegment={setActiveSegment} leaderboard={growBigLeaderboard} />}
              </>
            )}
            <div className="p-6 bg-slate-50 border-t flex justify-center">
              <Button onClick={() => setIsDialogOpen(false)} variant="ghost" 
                className="rounded-full px-10 font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-all duration-300">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// --- SHARED UI COMPONENTS ---

function StatCard({ title, icon, image, target, onClick, unit = "RM", color, isAdmin, currentAfyc, leaderboard }: any) {
  const colorMap: any = { 
    blue: "bg-blue-600", indigo: "bg-indigo-600", amber: "bg-amber-500", 
    emerald: "bg-emerald-600", rose: "bg-rose-600", sky: "bg-sky-600", violet: "bg-violet-600" 
  };
  
  const winnersCount = useMemo(() => (!isAdmin || !leaderboard) ? 0 : leaderboard.filter((a: any) => a.value >= target).length, [isAdmin, leaderboard, target]);
  const progress = Math.min(100, (currentAfyc / target) * 100);

  return (
    <Card onClick={onClick} className="group relative cursor-pointer border-none bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className={`p-3 rounded-xl ${colorMap[color]} text-white shadow-lg relative overflow-hidden h-12 w-12 flex items-center justify-center`}>
            {image ? <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-90" /> : icon}
          </div>
          <Badge variant="ghost" className="bg-green-100 text-green-700 font-bold text-[8px] uppercase tracking-wider animate-pulse">Active</Badge>
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-black text-slate-900 leading-tight">{title}</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Campaign 2026</p>
        </div>
        {isAdmin ? (
          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-5 w-5" />
            </div>
            <div><p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Total Qualified</p><p className="text-xl font-black text-slate-900">{winnersCount} Agents</p></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="text-xl font-black text-slate-900">{unit === "RM" ? "RM" : ""} {currentAfyc.toLocaleString()}</div>
              <div className="text-[8px] font-bold text-slate-400">/ {target.toLocaleString()}</div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${colorMap[color]} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContestLeaderboard({ list, unit = "RM", currentAgentCode, isEnac = false, target = 0 }: any) {
  const top10 = list.slice(0, 10);
  const isMeInTop10 = top10.some((a: any) => a.id === currentAgentCode);
  const displayList = isMeInTop10 ? top10 : [...top10, list.find((a: any) => a.id === currentAgentCode)].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Standings (Top 10)</h4>
        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black uppercase tracking-wider animate-pulse">
          <Activity className="h-2 w-2 mr-1" />
          Live
        </Badge>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {displayList.map((agent: any, i: number) => {
          const isMe = agent.id === currentAgentCode;
          const hasPassed = agent.value >= target && target > 0;
          const rank = list.indexOf(agent) + 1;
          
          return (
            <div key={agent.id} className={cn(
              "flex justify-between items-center p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02]",
              isMe ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:shadow-md'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300",
                  rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg' :
                  rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white' :
                  rank === 3 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white' :
                  'bg-slate-100 text-slate-400'
                )}>
                  {rank === 1 ? <Crown className="h-4 w-4" /> : rank}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 tracking-tight line-clamp-1">
                    {agent.name} {isMe && <span className="text-blue-600">★</span>}
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{agent.designation}</p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-slate-900">
                    {unit === "RM" ? `RM ${agent.value.toLocaleString()}` : `${agent.value} Cases`}
                  </p>
                  <Badge className={cn(
                    "text-[7px] h-4 px-1 font-black",
                    hasPassed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    {hasPassed ? "PASSED" : "IN PROGRESS"}
                  </Badge>
                </div>
                {isEnac && agent.ticket && (
                  <p className={cn(
                    "text-[7px] font-bold uppercase",
                    agent.ticket === 'VIP' ? 'text-amber-500' : 
                    agent.ticket === 'ORDINARY' ? 'text-blue-500' : 'text-slate-300'
                  )}>
                    {agent.ticket}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ENAC VIEW COMPONENT ---
function ENACView({ data, segment, setSegment, leaderboard, adStats, gadStats }: any) {
  const target = data?.category === 'ROOKIE' ? 8 : 26;
  const ticket = data?.enacTicket || "NONE";
  const qualifies = data?.enacQualifies || false;
  
  const ticketColors = {
    VIP: "from-amber-500 to-yellow-500",
    ORDINARY: "from-blue-500 to-sky-500",
    NONE: "from-slate-600 to-slate-700"
  };
  
  const userADStats = adStats?.find((a: any) => a.adCode === data?.agent_code);
  const userGADStats = gadStats?.find((g: any) => g.adCode === data?.agent_code);
  
  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden h-52 bg-cover bg-center"
        style={{ backgroundImage: 'url("/enac.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/70 to-amber-900/30" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 p-10 flex justify-between items-center h-full">
          <div className="space-y-2">
            <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 text-[10px] font-black uppercase tracking-wider">eNAC 2026</Badge>
            <DialogTitle className="text-4xl font-black text-white italic tracking-tighter">Segment Ranking</DialogTitle>
          </div>
          <div className="flex gap-1 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-md">
            {["ROOKIE", "PP"].map((opt) => (
              <Button key={opt} onClick={() => setSegment(opt)} 
                className={cn("h-9 px-6 text-[10px] font-black rounded-full transition-all duration-300",
                  segment === opt ? "bg-white text-slate-900 shadow-lg scale-105" : "text-white/40 hover:text-white hover:bg-white/10")}>
                {opt}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-10 grid lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Your Progress ({data?.category})</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-blue-100 text-center shadow-sm group">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">P1 Cases</p>
                <p className="text-3xl font-black text-blue-600 group-hover:scale-110 transition-transform duration-300">{data?.enacP1 || 0}</p>
                <p className="text-[8px] text-slate-400 mt-1">Jan - Mar</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 text-center shadow-sm group">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">P2 Cases</p>
                <p className="text-3xl font-black text-blue-600 group-hover:scale-110 transition-transform duration-300">{data?.enacP2 || 0}</p>
                <p className="text-[8px] text-slate-400 mt-1">Apr - Jun</p>
              </div>
            </div>
          </div>
          
          <div className={cn("p-6 rounded-2xl text-center shadow-xl border transition-all duration-500 hover:scale-105 bg-gradient-to-br", ticketColors[ticket])}>
            <Ticket className="w-10 h-10 text-white mx-auto mb-3" />
            <p className="text-4xl font-black text-white italic leading-tight uppercase">{ticket}</p>
            {qualifies && (
              <div className="mt-3 inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <CheckCircle2 className="h-3 w-3 text-white" />
                <span className="text-[8px] font-bold text-white uppercase">Fully Qualified</span>
              </div>
            )}
          </div>
          
          {(userADStats || userGADStats) && (
            <div className="p-6 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-2xl">
              <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Crown className="h-3 w-3" /> Leadership Achievement
              </h4>
              {userADStats && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Agents Qualified Under You</span>
                    <Badge className="bg-purple-100 text-purple-700">{userADStats.totalWinners} winners</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Your Ticket</span>
                    <Badge className={userADStats.ticket === "VIP" ? "bg-amber-500 text-white" : "bg-blue-500 text-white"}>
                      {userADStats.ticket}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <ContestLeaderboard list={leaderboard.filter((a:any) => a.category === segment)} 
          unit="Cases" currentAgentCode={data?.agent_code} isEnac={true} target={target} />
      </div>
    </div>
  );
}

// --- EXPERIENCE VIEW ---
function ExperienceView({ data, segment, setSegment, leaderboard }: any) {
  const isRookie = data.category === 'ROOKIE';
  const passedPreReq = isRookie ? (data.janAfyc >= 5000 && data.febAfyc >= 5000) : (data.janAfyc >= 10000 && data.febAfyc >= 10000);
  
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/danang.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2">AIT Experience 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter">Leaderboard Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full">
          {["All", "PP", "AD", "GAD"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-2xl">
            <h4 className="text-[10px] font-black text-blue-600 mb-4">Qualification Status</h4>
            <CheckItem label="Pre-requisite (Jan & Feb Production)" done={passedPreReq} />
            <CheckItem label="Minimum AFYC: RM 100,000" done={data.totalAfyc >= 100000} />
          </div>
          <div className="p-8 bg-slate-900 rounded-2xl text-center shadow-xl">
             <Plane className="w-8 h-8 text-blue-400 mx-auto mb-3" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter">AIT Experience Trip 2026</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} target={100000} />
      </div>
    </div>
  );
}

// --- RS VIEW ---
function RSView({ data, segment, setSegment, leaderboard }: any) {
  const isL1 = segment === "Level 1";
  const targetAfyc = isL1 ? 30000 : 60000;
  
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/surabaya.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2">AIT RS 2026</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter">Retail Sales Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full">
          {["Level 1", "Level 2"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
            <h4 className="text-[10px] font-black text-indigo-600 mb-4">{isL1 ? "Level 1 Requirements" : "Level 2 Requirements"}</h4>
            <CheckItem label={`Minimum AFYC: RM ${targetAfyc.toLocaleString()}`} done={data.totalAfyc >= targetAfyc} />
            <CheckItem label={`Minimum Cases: ${isL1 ? 3 : 6}`} done={data.caseCount >= (isL1 ? 3 : 6)} />
          </div>
          <div className="p-8 bg-slate-900 rounded-2xl text-center shadow-xl">
             <Gift className="w-8 h-8 text-amber-400 mx-auto mb-3" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter">{isL1 ? "Ipad Voucher (RM 1,800)" : "1 Ticket to Yogyakarta"}</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} target={targetAfyc} />
      </div>
    </div>
  );
}

// --- CONSISTENT VIEW ---
function ConsistentView({ data, segment, setSegment, leaderboard }: any) {
  const isT2 = segment === "Tier 2";
  const m0 = data?.monthlyCounts?.[0] || 0;
  const m1 = data?.monthlyCounts?.[1] || 0;
  const m2 = data?.monthlyCounts?.[2] || 0;
  const m3 = data?.monthlyCounts?.[3] || 0;
  const totalM0toM3 = m0 + m1 + m2 + m3;
  const currentAfyc = (data?.totalAfyc || 0);
  const expectedReward = currentAfyc * 0.01;

  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-blue-600 mb-2">Consistent Club RY1</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter">Consistency Tracker</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full">
          {["Tier 1", "Tier 2"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
            <h4 className="text-[10px] font-black text-indigo-600 mb-4">{isT2 ? "Tier 2 Requirement" : "Tier 1 Requirement"}</h4>
            {isT2 ? <CheckItem label="Total 6 Cases (M0-M3)" done={totalM0toM3 >= 6} /> : <CheckItem label="M1 Goal (3 Cases)" done={m0 >= 3} />}
          </div>
          <div className="p-8 bg-slate-900 rounded-2xl text-center shadow-xl">
            <Zap className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Estimated Club Bonus</p>
            <h2 className="text-4xl font-black text-emerald-400 tracking-tighter">RM {expectedReward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data?.agent_code} target={36000} />
      </div>
    </div>
  );
}

// --- CONSISTENT CLUB VIEW ---
function ConsistentClubView({ data, segment, setSegment, leaderboard }: any) {
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-violet-600 mb-2">Consistent Club</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter">Consistency Challenge</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full">
          {["Monthly", "Quarterly"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-violet-50/50 border border-violet-100 rounded-2xl">
            <h4 className="text-[10px] font-black text-violet-600 mb-4">{segment} Prize Tiers</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-2xl"><span className="text-xs font-bold">1st Place Reward</span><span className="text-sm font-black text-violet-600">RM 1,000</span></div>
              <div className="flex justify-between items-center p-3 bg-white rounded-2xl"><span className="text-xs font-bold">Consolation Reward</span><span className="text-sm font-black text-violet-600">RM 100</span></div>
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-2xl text-center shadow-xl">
             <Trophy className="w-8 h-8 text-violet-400 mx-auto mb-3" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter">Consistency Pay-out</h2>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} target={30000} />
      </div>
    </div>
  );
}

// --- GROW BIG VIEW ---
function GrowBigView({ data, segment, setSegment, leaderboard }: any) {
  const isMonthly = segment === "Monthly";
  
  return (
    <div className="flex flex-col">
      <div className="p-10 text-white flex justify-between items-center relative overflow-hidden h-44"
        style={{ backgroundImage: 'url("/consistentclub.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-900/50 z-0" />
        <div className="relative z-10">
          <Badge className="bg-rose-600 mb-2">Grow Big With Quality (Direct)</Badge>
          <DialogTitle className="text-4xl font-black italic tracking-tighter">Personal Growth Ranking</DialogTitle>
        </div>
        <div className="relative z-10 flex gap-1 bg-white/10 p-1 rounded-full">
          {["Monthly", "Quarterly"].map((opt) => (
            <Button key={opt} onClick={() => setSegment(opt)} className={`h-9 px-6 text-[10px] font-black rounded-full transition-all ${segment === opt ? "bg-white text-slate-900 shadow-xl" : "bg-transparent text-white/40"}`}>{opt}</Button>
          ))}
        </div>
      </div>
      <div className="p-10 grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="p-8 bg-rose-50/50 border border-rose-100 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
               <h4 className="text-[10px] font-black text-rose-600 uppercase">{segment} Prize Requirements</h4>
               {!isMonthly && <Badge variant="outline" className="text-[8px] border-rose-200 text-rose-500 uppercase">Catch-up Enabled</Badge>}
            </div>
            <div className="space-y-6">
              {[
                { tier: "1st", mCash: "30,000", qCash: "90,000", incM: "40% or RM 300k", incQ: "40% or RM 1.0M", active: 12, recruitM: 10, recruitQ: 35 },
                { tier: "2nd", mCash: "20,000", qCash: "60,000", incM: "30% or RM 200k", incQ: "30% or RM 700k", active: 8, recruitM: 6, recruitQ: 20 },
                { tier: "3rd", mCash: "10,000", qCash: "30,000", incM: "20% or RM 100k", incQ: "20% or RM 400k", active: 6, recruitM: 3, recruitQ: 10 }
              ].map((p) => (
                <div key={p.tier} className="space-y-2">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-900">{p.tier} Prize: RM {isMonthly ? p.mCash : p.qCash}</span>
                  </div>
                  <ul className="text-[10px] space-y-1 text-slate-500 ml-2">
                    <li>• AFYC Increment: {isMonthly ? p.incM : p.incQ} (Higher)</li>
                    <li>• Min. Active Agents: {p.active} {isMonthly ? "" : "Monthly Average"}</li>
                    <li>• Min. New Recruits: {isMonthly ? p.recruitM : `${p.recruitQ} (Accumulative)`}</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8 bg-slate-900 rounded-2xl text-center shadow-xl">
             <Sparkles className="w-8 h-8 text-rose-400 mx-auto mb-3" />
             <h2 className="text-3xl font-black text-white italic tracking-tighter">Top Growth Awards</h2>
             <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase border-t border-slate-800 pt-4 tracking-widest">Leaders under NALIS are excluded</p>
          </div>
        </div>
        <ContestLeaderboard list={leaderboard} currentAgentCode={data.agent_code} target={90000} />
      </div>
    </div>
  );
}

// --- HELPER FUNCTIONS ---
function getQualifiedTicket(p1: number, p2: number, category: string): "VIP" | "ORDINARY" | "NONE" {
  const isRookie = category === 'ROOKIE';
  const total = p1 + p2;
  const vipWash = isRookie ? 14 : 50;
  const ordWash = isRookie ? 8 : 26;
  if ((p1 >= (isRookie ? 6 : 24) && p2 >= (isRookie ? 6 : 24)) || total >= vipWash) return "VIP";
  if ((p1 >= (isRookie ? 3 : 12) && p2 >= (isRookie ? 3 : 12)) || total >= ordWash) return "ORDINARY";
  return "NONE";
}

function CheckItem({ label, done }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className={cn("text-xs transition-all duration-300", done ? "text-slate-900 font-bold" : "text-slate-400")}>{label}</span>
      {done ? (
        <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:scale-110">
          <CheckCircle2 className="h-3 w-3" />
        </div>
      ) : (
        <div className="bg-slate-100 text-slate-300 p-1 rounded-full">
          <AlertCircle className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
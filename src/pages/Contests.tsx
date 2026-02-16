import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Trophy, Target, Loader2, Download, Info, Users,
  Calendar, Clock, Plane, Award, Star, Zap, TrendingUp, Smartphone, 
  ChevronRight, Sparkles
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import confetti from "canvas-confetti";

export default function Contests() {
  const { user, role, isLoading } = useAuth();
  const [loadingData, setLoadingData] = useState(true);
  const [selectedContest, setSelectedContest] = useState<number | null>(null);
  const [stats, setStats] = useState({ afyc: 0, noc: 0, rank: 225, topAgents: [] as any[] });

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchContestData();
  }, [user, role]);

  const fetchContestData = async () => {
    try {
      setLoadingData(true);
      const { data: profile } = await supabase.from("profiles").select("agent_code").eq("id", user?.id).maybeSingle();
      const { data: allCases } = await (supabase.from("cases") as any).select("premium, agent_id");
      
      const totalsByAgent = (allCases || []).reduce((acc: any, curr: any) => {
        acc[curr.agent_id] = (acc[curr.agent_id] || 0) + Number(curr.premium || 0);
        return acc;
      }, {});

      const sorted = Object.entries(totalsByAgent)
        .sort(([, a]: any, [, b]: any) => b - a)
        .map(([id, prem], idx) => ({ id, premium: prem as number, rank: idx + 1 }));

      if (profile?.agent_code) {
        const myData = sorted.find(s => s.id === profile.agent_code);
        setStats({
          afyc: myData?.premium || 0,
          noc: (allCases || []).filter((c: any) => c.agent_id === profile.agent_code).length,
          rank: myData?.rank || 225,
          topAgents: sorted.slice(0, 3)
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoadingData(false); }
  };

  const handleCardClick = (id: number, progress: number) => {
    if (isAdmin) return;
    if (selectedContest !== id && progress >= 100) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#ffffff'] });
    }
    setSelectedContest(selectedContest === id ? null : id);
  };

  const downloadContestReport = () => {
    const headers = "Contest, End Date, Target, Description\n";
    const rows = contestCards.map(c => `"${c.name}", ${c.endDate}, "${c.targetReq}", "${c.desc}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contest_Report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // RESTORED: All 7 Contests with correct targets
  const contestCards = [
    { id: 1, name: "AIT Experience 2026", icon: <Plane />, target: 100000, targetReq: "RM 100k AFYC", endDate: "2026-06-30", desc: "National Overseas reward for top producers.", prize: "Paris Trip Ticket" },
    { id: 2, name: "eNAC 2026", icon: <Award />, target: 24, targetReq: "24 Cases Yearly", endDate: "2026-12-31", desc: "Quarterly production for VIP Tickets.", isCaseBased: true, prize: "VIP Convention Ticket" },
    { id: 3, name: "All Stars Aspirant", icon: <Star />, target: 36000, targetReq: "RM 36k AFYC", endDate: "2026-12-31", desc: "Annual Ticket Reward for all categories.", prize: "Recognition Trophy" },
    { id: 4, name: "Consistent Club (Rookie Y1)", icon: <Zap />, target: 36000, targetReq: "RM 36k AFYC", endDate: "2026-03-31", desc: "Bonus Tiers for Month 0 to 3.", prize: "Cash Bonus RM3,500" },
    { id: 5, name: "Consistent Club", icon: <TrendingUp />, target: 35, targetReq: "35 Cases Quarterly", endDate: "2026-06-30", desc: "Monthly & Quarterly bonus tiers.", isCaseBased: true, prize: "Quarterly Cash Bonus" },
    { id: 6, name: "Grow Big with Quality", icon: <Target />, target: 100000, targetReq: "40% Growth + 10 Recruits", endDate: "2026-12-31", desc: "AFYC growth and recruitment rewards.", prize: "RM 30k Mega Bonus" },
    { id: 7, name: "New Agent Bonus", icon: <Sparkles />, target: 5000, targetReq: "RM 5k AFYC", endDate: "2026-03-31", desc: "Fast start bonus for 2026 recruits.", prize: "iPad Voucher" }
  ];

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{isAdmin ? "Sales Contests" : "My Contests"}</h1>
            <p className="text-muted-foreground text-sm">Elevating your performance in 2026</p>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <Button onClick={downloadContestReport} variant="outline" className="border-primary text-primary hover:bg-success">
                <Download className="mr-2 h-4 w-4" /> Download Report
              </Button>
            ) : (
              <div className="text-">
                <Badge variant="outline" className="text-[12px] font-bold uppercase tracking-tighter mb-1">Status: Existing Agent</Badge>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Global Rank: #{stats.rank}</p>
              </div>
            )}
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contestCards.map((contest) => {
            const currentVal = contest.isCaseBased ? stats.noc : stats.afyc;
            const progress = Math.min(100, (currentVal / contest.target) * 100);
            const isQualified = progress >= 100;
            const gap = Math.max(0, contest.target - currentVal);
            const isSelected = selectedContest === contest.id;

            return (
              <Card 
                key={contest.id} 
                className={`relative overflow-hidden border-none shadow-lg transition-all duration-500 
                ${!isAdmin && isQualified ? 'ring-2 ring-emerald-500 shadow-emerald-100' : ''} 
                ${isSelected ? 'ring-2 ring-primary scale-[1.01]' : ''}`}
              >
                <div 
                  className={`p-6 cursor-pointer transition-colors ${isQualified && !isAdmin ? 'bg-emerald-600' : 'gradient-hero'} text-white`}
                  onClick={() => handleCardClick(contest.id, progress)}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                      {cloneElement(contest.icon as React.ReactElement, { className: "h-5 w-5" })}
                    </div>
                    <Badge className="bg-white/20 text-white border-none uppercase text-[9px] font-bold tracking-widest">ACTIVE</Badge>
                  </div>
                  <CardTitle className="text-lg font-bold mb-1">{contest.name}</CardTitle>
                  <CardDescription className="text-white/70 text-[11px] line-clamp-1">{contest.desc}</CardDescription>
                </div>
                
                <CardContent className="pt-6 space-y-5">
                  {!isAdmin ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center group/info">
                          <div className="flex items-center gap-1 cursor-help">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Progress</span>
                            <Info className="h-3 w-3 text-slate-300" />
                          </div>
                          <span className="text-sm font-black text-slate-700">{progress.toFixed(1)}%</span>
                        </div>
                        <Progress value={progress} className={`h-2 ${isQualified ? '[&>div]:bg-emerald-500' : ''}`} />
                        {!isQualified && (
                          <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 italic">
                            <TrendingUp className="h-3 w-3" /> RM {gap.toLocaleString()} to reach Tier 1 Milestone
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 bg-slate-50/80 backdrop-blur-md rounded-xl p-4 border border-slate-100">
                           <div className="space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Users className="h-3 w-3"/> Live Standings (Top 3)</p>
                              {stats.topAgents.map((a, i) => (
                                <div key={i} className="flex justify-between text-[10px] font-bold bg-white p-2 rounded border border-slate-100 shadow-sm">
                                  <span className="text-slate-500">#{i+1} {a.id}</span>
                                  <span className="text-primary">RM {a.premium.toLocaleString()}</span>
                                </div>
                              ))}
                           </div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Smartphone className="h-3 w-3"/> Reward Unlock</p>
                              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-100">
                                <Badge className="bg-emerald-500 text-white border-none p-1"><Sparkles className="h-3 w-3"/></Badge>
                                <span className="text-[10px] font-black text-emerald-700 uppercase">{contest.prize}</span>
                              </div>
                           </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Goal Requirement</p>
                      <p className="text-xs font-bold text-slate-600">{contest.targetReq}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] font-bold pt-2 border-t border-slate-50">
                    <span className="flex items-center gap-1 text-slate-400"><Calendar className="h-3 w-3" /> {format(new Date(contest.endDate), "dd MMM yyyy")}</span>
                    <span className="text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{differenceInDays(new Date(contest.endDate), new Date())} DAYS LEFT</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper for icon cloning
import { cloneElement } from "react";
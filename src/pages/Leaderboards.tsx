import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Crown, Loader2, Users, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// --- TYPES & INTERFACES ---
interface CaseRow {
  premium: number | null;
  agent_id: string;
  introducer_name: string | null;
  leader_name: string | null;
  profiles: {
    full_name: string | null;
    rank: string | null;
    email: string | null;
  } | null;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  agentCode: string;
  cases: number;
  premium: number;
  category: string;
  isCurrentUser: boolean;
}

const rankCategories = [
  { id: "GAD", label: "GAD", description: "SuperAchiever Group Statistics" },
  { id: "AD", label: "AD", description: "Agency Director" },
  { id: "AGM", label: "AGM", description: "Agency Group Manager" },
  { id: "Agt", label: "Agent", description: "Insurance Agent" },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1: return <Crown className="h-5 w-5 text-warning" />;
    case 2: return <Medal className="h-5 w-5 text-muted-foreground" />;
    case 3: return <Award className="h-5 w-5 text-warning" />;
    default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
}

export default function Leaderboards() {
  const { user, role, isLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState("GAD");
  const [leaderboardData, setLeaderboardData] = useState<Record<string, LeaderboardEntry[]>>({
    GAD: [], AD: [], AGM: [], Agt: []
  });
  const [loadingData, setLoadingData] = useState(true);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchRealLeaderboard();
  }, [user]);

  const fetchRealLeaderboard = async () => {
    try {
      setLoadingData(true);
      
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select(`
          premium,
          agent_id,
          introducer_name,
          leader_name,
          profiles (
            full_name,
            rank,
            email
          )
        `);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('agent_code, full_name, rank, email');

      if (casesError || profilesError) throw casesError || profilesError;

      if (casesData && profilesData) {
        const stats: Record<string, { premium: number; cases: number }> = {};

        // HIERARCHY ROLL-UP LOGIC
        casesData.forEach((c: any) => {
          const amt = Number(c.premium || 0);
          // Credit the Agent, Introducer, and Leader
          const agentsToCredit = [c.agent_id, c.introducer_name, c.leader_name].filter(Boolean);
          
          agentsToCredit.forEach(codeOrName => {
            if (!stats[codeOrName]) stats[codeOrName] = { premium: 0, cases: 0 };
            stats[codeOrName].premium += amt;
            stats[codeOrName].cases += 1;
          });
        });

        const categories: Record<string, LeaderboardEntry[]> = { GAD: [], AD: [], AGM: [], Agt: [] };
        
        profilesData.forEach((p: any) => {
          // Look up stats by agent_code (individual) or full_name (hierarchy)
          const pStats = stats[p.agent_code] || stats[p.full_name] || { premium: 0, cases: 0 };
          const entry: LeaderboardEntry = {
            rank: 0,
            name: p.full_name || "Unknown",
            agentCode: p.agent_code || "",
            cases: pStats.cases,
            premium: pStats.premium,
            category: p.rank || "Agt",
            isCurrentUser: p.email === user?.email
          };

          // GAD TAB: Always includes everyone for total group statistics
          categories["GAD"].push(entry);

          // Other Tabs: Filtered by specific rank
          const dbRank = String(p.rank).toUpperCase();
          if (dbRank.includes("AGENCY DIRECTOR")) {
            categories["AD"].push(entry);
          } else if (dbRank.includes("AGENCY GROWTH MANAGER")) {
            categories["AGM"].push(entry);
          } else if (!dbRank.includes("GROUP AGENCY DIRECTOR")) {
            categories["Agt"].push(entry);
          }
        });

        Object.keys(categories).forEach(cat => {
          categories[cat].sort((a, b) => b.premium - a.premium);
          categories[cat] = categories[cat].map((item, index) => ({ ...item, rank: index + 1 }));
        });

        setLeaderboardData(categories);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleExportCSV = () => {
    const currentData = leaderboardData[activeCategory] || [];
    const headers = ["Rank", "Name", "Agent Code", "Total Cases", "Total AFYC"];
    const csvContent = [
      headers.join(","),
      ...currentData.map(entry => [entry.rank, `"${entry.name}"`, entry.agentCode, entry.cases, entry.premium.toFixed(2)].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeCategory}_Leaderboard_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const currentData = leaderboardData[activeCategory] || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-7 w-7 text-warning" />
              Live Leaderboards
            </h1>
            <p className="text-muted-foreground">Real-time rankings across all rank categories</p>
          </div>
          {isAdmin && (
            <Button onClick={handleExportCSV} className="flex gap-2 shadow-md">
              <Download className="h-4 w-4" /> Export {activeCategory} Rankings
            </Button>
          )}
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            {rankCategories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-2">
                <Users className="h-4 w-4 hidden sm:block" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {rankCategories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-6">
              {loadingData ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Calculating rankings...</p>
                </div>
              ) : currentData.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No records found for this category</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-3">
                    <Card className="shadow-soft overflow-hidden border-none bg-gradient-to-br from-slate-50 to-slate-100">
                      <div className="bg-primary/5 p-4 border-b">
                        <h3 className="font-semibold text-primary">{cat.description} Rankings</h3>
                      </div>
                      <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row items-end justify-center gap-8 mb-4">
                          {currentData[1] && (
                            <div className="flex flex-col items-center">
                              <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl mb-2 border-4 border-white shadow-md">
                                {currentData[1].name.charAt(0)}
                              </div>
                              <Medal className="h-6 w-6 text-slate-400 mb-1" />
                              <p className="font-semibold text-sm truncate max-w-[120px]">{currentData[1].name}</p>
                              <p className="text-[10px] font-bold text-slate-400 mb-2">{currentData[1].agentCode}</p>
                              <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border">
                                {currentData[1].premium.toLocaleString()} AFYC
                              </div>
                            </div>
                          )}

                          {currentData[0] && (
                            <div className="flex flex-col items-center pb-6">
                              <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center text-white font-bold text-3xl mb-2 border-4 border-white shadow-xl ring-4 ring-primary/10">
                                {currentData[0].name.charAt(0)}
                              </div>
                              <Crown className="h-10 w-10 text-warning mb-1" />
                              <p className="font-bold text-lg truncate max-w-[150px]">{currentData[0].name}</p>
                              <p className="text-xs font-bold text-slate-400 mb-3">{currentData[0].agentCode}</p>
                              <div className="bg-primary px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg">
                                {currentData[0].premium.toLocaleString()} AFYC
                              </div>
                            </div>
                          )}

                          {currentData[2] && (
                            <div className="flex flex-col items-center">
                              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 font-bold text-xl mb-2 border-4 border-white shadow-md">
                                {currentData[2].name.charAt(0)}
                              </div>
                              <Award className="h-6 w-6 text-orange-400 mb-1" />
                              <p className="font-semibold text-sm truncate max-w-[120px]">{currentData[2].name}</p>
                              <p className="text-[10px] font-bold text-slate-400 mb-2">{currentData[2].agentCode}</p>
                              <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border">
                                {currentData[2].premium.toLocaleString()} AFYC
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="lg:col-span-3 shadow-soft border-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Full Leaderboard</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentData.map((entry) => (
                        <div
                          key={entry.agentCode}
                          className={cn(
                            "flex items-center gap-4 rounded-xl border p-4 transition-all hover:translate-x-1",
                            entry.isCurrentUser ? "bg-primary/10 border-primary ring-1 ring-primary/20" : "bg-card border-slate-100",
                            entry.rank <= 3 && !entry.isCurrentUser && "bg-primary/[0.02] border-primary/10"
                          )}
                        >
                          <div className="flex items-center justify-center w-8 italic text-slate-300 font-black text-sm">
                            {entry.rank}.
                          </div>
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                            {entry.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-bold truncate text-sm uppercase", entry.isCurrentUser && "text-primary")}>
                              {entry.name} {entry.isCurrentUser && "(You)"}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{entry.agentCode}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black">
                              {entry.premium.toLocaleString()} <span className="text-[10px] text-primary">AFYC</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">{entry.cases} cases</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
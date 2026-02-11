import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Crown, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// --- TYPES & INTERFACES ---
interface CaseRow {
  premium: number | null;
  agent_id: string;
  profiles: {
    full_name: string | null;
    rank: string | null;
  } | null;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  agentCode: string;
  cases: number;
  premium: number;
  category: string;
}

const rankCategories = [
  { id: "GAD", label: "GAD", description: "Group Agency Director" },
  { id: "AD", label: "AD", description: "Agency Director" },
  { id: "AGM", label: "AGM", description: "Agency Group Manager" },
  { id: "Agt", label: "Agent", description: "Insurance Agent" },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-warning" />;
    case 2:
      return <Medal className="h-5 w-5 text-muted-foreground" />;
    case 3:
      return <Award className="h-5 w-5 text-warning" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
}

export default function Leaderboards() {
  const { user, isLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState("GAD");
  const [leaderboardData, setLeaderboardData] = useState<Record<string, LeaderboardEntry[]>>({
    GAD: [], AD: [], AGM: [], Agt: []
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRealLeaderboard();
    }
  }, [user]);

  const fetchRealLeaderboard = async () => {
    try {
      setLoadingData(true);
      
      // 1. Fetch ALL cases and join with profiles to get the 'rank'
      const { data, error } = await supabase
        .from('cases')
        .select(`
          premium,
          agent_id,
          profiles (
            full_name,
            rank
          )
        `) as { data: CaseRow[] | null, error: any };

      if (error) throw error;

      if (data) {
        const tempMap: Record<string, LeaderboardEntry> = {};

        data.forEach((row: CaseRow) => {
          const code = row.agent_id;
          const profile = row.profiles;
          
          // Use 'Agt' as the default if rank is null or not found
          const agentRank = profile?.rank || "Agt";

          if (!tempMap[code]) {
            tempMap[code] = { 
              rank: 0, 
              name: profile?.full_name || "Unknown Agent", 
              agentCode: code, 
              cases: 0, 
              premium: 0,
              category: agentRank 
            };
          }
          tempMap[code].cases += 1;
          tempMap[code].premium += Number(row.premium || 0);
        });

        // 2. Initialize categories to match your Tabs exactly
        const categories: Record<string, LeaderboardEntry[]> = { 
          GAD: [], AD: [], AGM: [], Agt: [] 
        };
        
        Object.values(tempMap).forEach((entry) => {
          // Check if the rank exists in our categories, else put in 'Agt'
          if (categories[entry.category]) {
            categories[entry.category].push(entry);
          } else {
            categories["Agt"].push(entry);
          }
        });

        // 3. Sort by premium and assign Rank #
        Object.keys(categories).forEach(cat => {
          categories[cat].sort((a, b) => b.premium - a.premium);
          categories[cat] = categories[cat].map((item, index) => ({
            ...item,
            rank: index + 1
          }));
        });

        setLeaderboardData(categories);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoadingData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const currentData = leaderboardData[activeCategory] || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-warning" />
            Live Leaderboards
          </h1>
          <p className="text-muted-foreground">
            Real-time rankings across all rank categories
          </p>
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
                  <p className="text-sm text-muted-foreground">Sync more data to see rankings</p>
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
                              <p className="font-semibold text-sm">{currentData[1].name}</p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{currentData[1].agentCode}</p>
                              <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border">
                                RM {currentData[1].premium.toLocaleString()}
                              </div>
                            </div>
                          )}

                          {currentData[0] && (
                            <div className="flex flex-col items-center pb-6">
                              <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center text-white font-bold text-3xl mb-2 border-4 border-white shadow-xl ring-4 ring-primary/10">
                                {currentData[0].name.charAt(0)}
                              </div>
                              <Crown className="h-10 w-10 text-warning mb-1" />
                              <p className="font-bold text-lg">{currentData[0].name}</p>
                              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{currentData[0].agentCode}</p>
                              <div className="bg-primary px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg">
                                RM {currentData[0].premium.toLocaleString()}
                              </div>
                            </div>
                          )}

                          {currentData[2] && (
                            <div className="flex flex-col items-center">
                              <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 font-bold text-xl mb-2 border-4 border-white shadow-md">
                                {currentData[2].name.charAt(0)}
                              </div>
                              <Award className="h-6 w-6 text-orange-400 mb-1" />
                              <p className="font-semibold text-sm">{currentData[2].name}</p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{currentData[2].agentCode}</p>
                              <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border">
                                RM {currentData[2].premium.toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="lg:col-span-3 shadow-soft">
                    <CardHeader>
                      <CardTitle className="text-lg">Full Leaderboard</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {currentData.map((entry) => (
                          <div
                            key={entry.agentCode}
                            className={cn(
                              "flex items-center gap-4 rounded-xl border p-4 transition-all hover:translate-x-1",
                              entry.rank <= 3 ? "bg-primary/[0.02] border-primary/10" : "bg-card"
                            )}
                          >
                            <div className="flex items-center justify-center w-8">
                              {getRankIcon(entry.rank)}
                            </div>
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                              {entry.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{entry.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{entry.agentCode}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">RM {entry.premium.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{entry.cases} cases</p>
                            </div>
                          </div>
                        ))}
                      </div>
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
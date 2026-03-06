import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  Trophy, 
  Medal, 
  Award, 
  Crown, 
  Loader2, 
  Users, 
  Download,
  Calendar,
  ChevronRight,
  Building2,
  AlertCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// --- TYPES & INTERFACES ---
interface Profile {
  agent_code: string;
  full_name: string;
  rank: string | null;
  email: string | null;
  introducer_name: string | null;
  leader_name: string | null;
}

interface CaseWithDate {
  premium: number;
  submission_date_timestamp: string;
  agent_id: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  agentCode: string;
  cases: number;
  premium: number;
  rank_title: string;
  isCurrentUser: boolean;
}

interface AgentEntry {
  name: string;
  agentCode: string;
  cases: number;
  premium: number;
  rank: string;
}

interface ADProduction {
  adName: string;
  adCode: string;
  totalPremium: number;
  totalCases: number;
  agents: AgentEntry[];
}

interface ProductionData {
  period: string;
  total: number;
}

const rankCategories = [
  { id: "GAD", label: "GAD", description: "SuperAchiever Group Statistics" },
  { id: "AD", label: "AD", description: "Agency Director" },
  { id: "AGM", label: "AGM", description: "Agency Group Manager" },
  { id: "Agt", label: "Agent", description: "Insurance Agent" },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2: return <Medal className="h-5 w-5 text-gray-400" />;
    case 3: return <Award className="h-5 w-5 text-orange-400" />;
    default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
}

// Helper to format AFYC
const formatAFYC = (value: number): string => {
  return value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function Leaderboards() {
  const { user, role, isLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState("GAD");
  const [leaderboardData, setLeaderboardData] = useState<Record<string, LeaderboardEntry[]>>({
    GAD: [], AD: [], AGM: [], Agt: []
  });
  const [loadingData, setLoadingData] = useState(true);
  const [adProduction, setAdProduction] = useState<ADProduction[]>([]);
  const [selectedAD, setSelectedAD] = useState<ADProduction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"day" | "month" | "year">("month");
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [totalGroupProduction, setTotalGroupProduction] = useState(0);
  const [totalGroupCases, setTotalGroupCases] = useState(0);
  const [profilesMap, setProfilesMap] = useState<Map<string, Profile>>(new Map());
  const [allCases, setAllCases] = useState<CaseWithDate[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [orphanedCases, setOrphanedCases] = useState(0);
  const [orphanedPremium, setOrphanedPremium] = useState(0);
  const [dbStats, setDbStats] = useState<{ total: number; withPremium: number; withoutPremium: number }>({
    total: 0,
    withPremium: 0,
    withoutPremium: 0
  });

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";
  const API_BASE_URL = "http://127.0.0.1:8000";

  useEffect(() => {
    if (user) {
      fetchRealLeaderboard();
      fetchTotalProduction();
    }
  }, [user]);

  useEffect(() => {
    if (activeCategory === "GAD" && allCases.length > 0) {
      calculateProductionByTimeFilter();
    }
  }, [activeCategory, timeFilter, allCases]);

  useEffect(() => {
    if (activeCategory === "GAD" && leaderboardData.GAD.length > 0) {
      buildADHierarchy();
    }
  }, [activeCategory, leaderboardData]);

  const fetchTotalProduction = async () => {
    try {
      console.log("🔍 Fetching total production from API...");
      const response = await fetch(`${API_BASE_URL}/api/total-production`);
      if (response.ok) {
        const data = await response.json();
        console.log("📊 API Response:", data);
        console.log("📊 Total from API:", data.total);
        console.log("📊 Count from API:", data.count);
        
        setTotalGroupProduction(data.total);
        setTotalGroupCases(data.count);
        
        // Compare with local calculation
        if (allCases.length > 0) {
          const localTotal = allCases.reduce((sum, c) => sum + c.premium, 0);
          console.log("📊 Local total from allCases:", localTotal);
          console.log("📊 Difference:", data.total - localTotal);
          setDebugInfo(`API: ${data.total.toFixed(2)} | Local: ${localTotal.toFixed(2)} | Diff: ${(data.total - localTotal).toFixed(2)}`);
        }
      } else {
        console.error("❌ API response not OK:", response.status);
      }
    } catch (err) {
      console.error("❌ Error fetching total production:", err);
    }
  };

  const calculateProductionByTimeFilter = () => {
    if (allCases.length === 0) return;

    const now = new Date();
    let groupedData: Map<string, number> = new Map();

    if (timeFilter === "month") {
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        
        const monthCases = allCases.filter(c => {
          const caseDate = new Date(c.submission_date_timestamp);
          return caseDate >= monthStart && caseDate <= monthEnd;
        });
        
        const monthTotal = monthCases.reduce((sum, c) => sum + c.premium, 0);
        groupedData.set(format(date, "MMM yyyy"), monthTotal);
      }
    } else if (timeFilter === "day") {
      for (let i = 6; i >= 0; i--) {
        const date = subDays(now, i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const dayCases = allCases.filter(c => {
          const caseDate = new Date(c.submission_date_timestamp);
          return caseDate >= dayStart && caseDate <= dayEnd;
        });
        
        const dayTotal = dayCases.reduce((sum, c) => sum + c.premium, 0);
        groupedData.set(format(date, "dd MMM"), dayTotal);
      }
    } else {
      const currentYear = now.getFullYear();
      for (let i = 2; i >= 0; i--) {
        const year = currentYear - i;
        const yearStart = startOfYear(new Date(year, 0, 1));
        const yearEnd = endOfYear(new Date(year, 0, 1));
        
        const yearCases = allCases.filter(c => {
          const caseDate = new Date(c.submission_date_timestamp);
          return caseDate >= yearStart && caseDate <= yearEnd;
        });
        
        const yearTotal = yearCases.reduce((sum, c) => sum + c.premium, 0);
        groupedData.set(year.toString(), yearTotal);
      }
    }

    const data: ProductionData[] = Array.from(groupedData.entries()).map(([period, total]) => ({
      period,
      total
    }));

    setProductionData(data);
  };

  const buildADHierarchy = () => {
    const ads = leaderboardData.AD.map(ad => ({
      name: ad.name,
      code: ad.agentCode,
      premium: ad.premium,
      cases: ad.cases
    }));

    const agentsMap = new Map<string, AgentEntry>();
    
    leaderboardData.GAD.forEach(person => {
      if (!ads.some(ad => ad.code === person.agentCode)) {
        agentsMap.set(person.agentCode, {
          name: person.name,
          agentCode: person.agentCode,
          premium: person.premium,
          cases: person.cases,
          rank: person.rank_title
        });
      }
    });

    const adProductionList: ADProduction[] = ads.map(ad => {
      const agentsUnderAD: AgentEntry[] = [];
      
      agentsMap.forEach((agent, agentCode) => {
        const profile = profilesMap.get(agentCode);
        if (profile) {
          const isUnderThisAD = 
            (profile.introducer_name && 
              (profile.introducer_name === ad.name || 
               profile.introducer_name === ad.code)) ||
            (profile.leader_name && 
              (profile.leader_name === ad.name || 
               profile.leader_name === ad.code));
          
          if (isUnderThisAD) {
            agentsUnderAD.push(agent);
          }
        }
      });

      const agentsTotal = agentsUnderAD.reduce((sum, agent) => sum + agent.premium, 0);
      const agentsCases = agentsUnderAD.reduce((sum, agent) => sum + agent.cases, 0);

      return {
        adName: ad.name,
        adCode: ad.code,
        totalPremium: ad.premium + agentsTotal,
        totalCases: ad.cases + agentsCases,
        agents: agentsUnderAD
      };
    });

    const sortedADs = adProductionList.sort((a, b) => b.totalPremium - a.totalPremium);
    setAdProduction(sortedADs);
  };

  const fetchAllCasesWithPagination = async (table: string, select: string, pageSize: number = 1000) => {
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        page++;
        console.log(`📊 Fetched page ${page}: ${data.length} records from ${table} (total so far: ${allData.length})`);
      }
      
      if (!data || data.length < pageSize) {
        hasMore = false;
      }
    }

    return allData;
  };

  const fetchRealLeaderboard = async () => {
    try {
      setLoadingData(true);
      
      // Get total count first
      const { count: totalCasesCount, error: countError } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      console.log("📊 REAL total cases in database:", totalCasesCount);

      // Fetch ALL profiles (profiles table is small, no pagination needed)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, Profile>();
      profilesData?.forEach((profile: any) => {
        profileMap.set(profile.agent_code, profile);
      });
      setProfilesMap(profileMap);

      // Fetch ALL cases with dates using pagination
      const allCasesWithDates = await fetchAllCasesWithPagination(
        'cases', 
        'premium, submission_date_timestamp, agent_id'
      );

      console.log("📊 TOTAL cases fetched with pagination:", allCasesWithDates.length);

      const formattedCases = allCasesWithDates.map(c => ({
        premium: Number(c.premium || 0),
        submission_date_timestamp: c.submission_date_timestamp,
        agent_id: c.agent_id
      }));
      
      setAllCases(formattedCases);

      // Fetch ALL cases data with pagination
      const allCasesData = await fetchAllCasesWithPagination(
        'cases',
        'premium, agent_id'
      );

      if (allCasesData && profilesData) {
        const stats: Record<string, { premium: number; cases: number }> = {};
        let orphanedCount = 0;
        let orphanedTotal = 0;
        let matchedTotal = 0;

        allCasesData.forEach((c: any) => {
          const amt = Number(c.premium || 0);
          const agentId = c.agent_id;
          
          if (profileMap.has(agentId)) {
            if (!stats[agentId]) stats[agentId] = { premium: 0, cases: 0 };
            stats[agentId].premium += amt;
            stats[agentId].cases += 1;
            matchedTotal += amt;
          } else {
            orphanedCount++;
            orphanedTotal += amt;
          }
        });

        console.log("📊 Matched total:", matchedTotal);
        console.log("📊 Orphaned total:", orphanedTotal);
        console.log("📊 Combined total:", matchedTotal + orphanedTotal);
        console.log("📊 Expected total from count:", totalCasesCount);

        setOrphanedCases(orphanedCount);
        setOrphanedPremium(orphanedTotal);
        setDbStats({
          total: allCasesData.length,
          withPremium: allCasesData.filter((c: any) => c.premium > 0).length,
          withoutPremium: allCasesData.filter((c: any) => !c.premium || c.premium === 0).length
        });

        const categories: Record<string, LeaderboardEntry[]> = { 
          GAD: [], 
          AD: [], 
          AGM: [], 
          Agt: [] 
        };
        
        profilesData.forEach((p: any) => {
          const pStats = stats[p.agent_code] || { premium: 0, cases: 0 };
          const rankTitle = p.rank || "Agent";
          
          const entry: LeaderboardEntry = {
            rank: 0,
            name: p.full_name || "Unknown",
            agentCode: p.agent_code || "",
            cases: pStats.cases,
            premium: pStats.premium,
            rank_title: rankTitle,
            isCurrentUser: p.email === user?.email
          };

          categories["GAD"].push(entry);

          const rankUpper = String(rankTitle).toUpperCase();
          if (rankUpper.includes("AGENCY DIRECTOR") || rankUpper.includes("AD")) {
            categories["AD"].push(entry);
          } else if (rankUpper.includes("AGENCY GROWTH MANAGER") || rankUpper.includes("AGM")) {
            categories["AGM"].push(entry);
          } else if (!rankUpper.includes("GROUP AGENCY DIRECTOR") && !rankUpper.includes("GAD")) {
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
    const headers = ["Rank", "Name", "Agent Code", "Rank", "Total Cases", "Total AFYC"];
    const csvContent = [
      headers.join(","),
      ...currentData.map(entry => [
        entry.rank, 
        `"${entry.name}"`, 
        entry.agentCode, 
        `"${entry.rank_title}"`,
        entry.cases, 
        entry.premium.toFixed(2)
      ].join(","))
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
              <Trophy className="h-7 w-7 text-yellow-500" />
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
                {cat.id === "GAD" ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
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
              ) : cat.id === "GAD" ? (
                <div className="space-y-6">
                  {/* Database Stats Card with Info Icons */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                        <Info className="h-5 w-5" />
                        Database Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="relative group">
                          <div className="flex items-center gap-1">
                            <p className="text-blue-600 font-medium">Total Cases</p>
                            <div className="relative">
                              <Info className="h-3 w-3 text-blue-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                Total number of cases in the database
                              </div>
                            </div>
                          </div>
                          <p className="text-xl font-bold text-blue-800">{dbStats.total}</p>
                        </div>
                        
                        <div className="relative group">
                          <div className="flex items-center gap-1">
                            <p className="text-green-600 font-medium">With Premium</p>
                            <div className="relative">
                              <Info className="h-3 w-3 text-green-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                Cases with premium value greater than 0
                              </div>
                            </div>
                          </div>
                          <p className="text-xl font-bold text-green-800">{dbStats.withPremium}</p>
                        </div>
                        
                        <div className="relative group">
                          <div className="flex items-center gap-1">
                            <p className="text-orange-600 font-medium">Zero Premium</p>
                            <div className="relative">
                              <Info className="h-3 w-3 text-orange-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                Cases with premium = 0 or null (may need attention)
                              </div>
                            </div>
                          </div>
                          <p className="text-xl font-bold text-orange-800">{dbStats.withoutPremium}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Debug Info */}
                  {debugInfo && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-2">
                        <p className="text-xs font-mono">{debugInfo}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Total Production Card with Info Icons */}
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="p-8">
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="relative group">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-primary/80 mb-2">Total Group Production</p>
                            <div className="relative">
                              <Info className="h-3 w-3 text-primary/40 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                Sum of all AFYC from all cases in the system
                              </div>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-primary">{formatAFYC(totalGroupProduction)} AFYC</p>
                          <p className="text-sm text-muted-foreground mt-2">Across {totalGroupCases} cases</p>
                        </div>
                        
                        <div className="relative group">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-primary/80 mb-2">Active Members</p>
                            <div className="relative">
                              <Info className="h-3 w-3 text-primary/40 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                Number of agents with profiles in the system
                              </div>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-primary">{leaderboardData.GAD.length}</p>
                          <p className="text-sm text-muted-foreground mt-2">In SuperAchiever Group</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Unattributed Production Section with Info Icon */}
                  {orphanedCases > 0 && (
                    <Card className="border-2 border-orange-200 bg-orange-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                          <AlertCircle className="h-5 w-5" />
                          Unattributed Production
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-white/50">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-orange-700">Cases without Agent Profiles</p>
                              <div className="relative group">
                                <Info className="h-3 w-3 text-orange-400 cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                  Cases where agent_id doesn't match any profile in the database
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600 mt-1">
                              These cases exist but are not linked to any agent profile
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-orange-700">{formatAFYC(orphanedPremium)} AFYC</p>
                            <p className="text-xs text-orange-600">{orphanedCases} cases</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Production Graph */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Production Trend</CardTitle>
                      <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
                        <SelectTrigger className="w-[120px]">
                          <Calendar className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Daily</SelectItem>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={productionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: any) => [`${formatAFYC(value)} AFYC`, 'Production']}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#8884d8" 
                              name="Total Production"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AD Production List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">AD Production Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {adProduction.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No AD data available
                          </div>
                        ) : (
                          adProduction.map((ad, index) => (
                            <div key={ad.adCode}>
                              <div
                                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/5 cursor-pointer transition-all"
                                onClick={() => {
                                  setSelectedAD(ad);
                                  setDialogOpen(true);
                                }}
                              >
                                <div className="flex items-center justify-center w-8">
                                  {getRankIcon(index + 1)}
                                </div>
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                  {ad.adName.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold">{ad.adName}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{ad.adCode}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-primary">
                                    {formatAFYC(ad.totalPremium)} AFYC
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {ad.totalCases} cases • {ad.agents.length} agents
                                  </p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : currentData.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No records found for this category</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Top 3 Podium */}
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
                                {formatAFYC(currentData[1].premium)} AFYC
                              </div>
                            </div>
                          )}

                          {currentData[0] && (
                            <div className="flex flex-col items-center pb-6">
                              <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center text-white font-bold text-3xl mb-2 border-4 border-white shadow-xl ring-4 ring-primary/10">
                                {currentData[0].name.charAt(0)}
                              </div>
                              <Crown className="h-10 w-10 text-yellow-500 mb-1" />
                              <p className="font-bold text-lg truncate max-w-[150px]">{currentData[0].name}</p>
                              <p className="text-xs font-bold text-slate-400 mb-3">{currentData[0].agentCode}</p>
                              <div className="bg-primary px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg">
                                {formatAFYC(currentData[0].premium)} AFYC
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
                                {formatAFYC(currentData[2].premium)} AFYC
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Full Leaderboard List */}
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
                              {formatAFYC(entry.premium)} <span className="text-[10px] text-primary">AFYC</span>
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

        {/* AD Agent Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedAD?.adName} - Agency Details
              </DialogTitle>
            </DialogHeader>
            {selectedAD && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Production</p>
                      <p className="text-2xl font-bold text-primary">{formatAFYC(selectedAD.totalPremium)} AFYC</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Cases</p>
                      <p className="text-2xl font-bold text-primary">{selectedAD.totalCases}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg">
                  <div className="bg-muted/50 p-3 border-b">
                    <div className="grid grid-cols-12 gap-2 text-sm font-medium">
                      <div className="col-span-4">Agent Name</div>
                      <div className="col-span-2">Agent Code</div>
                      <div className="col-span-2">Rank</div>
                      <div className="col-span-2 text-right">Cases</div>
                      <div className="col-span-2 text-right">Production</div>
                    </div>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {selectedAD.agents.map((agent, idx) => (
                      <div key={idx} className="p-3 hover:bg-muted/30">
                        <div className="grid grid-cols-12 gap-2 text-sm">
                          <div className="col-span-4 font-medium truncate">{agent.name}</div>
                          <div className="col-span-2 font-mono text-xs text-muted-foreground">{agent.agentCode}</div>
                          <div className="col-span-2 text-xs">
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[8px]">
                              {agent.rank}
                            </span>
                          </div>
                          <div className="col-span-2 text-right font-bold">{agent.cases}</div>
                          <div className="col-span-2 text-right font-bold text-primary">{formatAFYC(agent.premium)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
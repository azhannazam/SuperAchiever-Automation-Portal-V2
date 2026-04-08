import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Medal, Award, Trophy, Users, DollarSign, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { parseISO, isValid } from "date-fns";

interface RankingEntry {
  rank: number;
  name: string;
  agentCode: string;
  cases: number;
  afyc: number;
  rank_title: string;
}

interface LiveRankingsProps {
  cases: any[];
  profiles: any[];
  testMode?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
  currentUserCode?: string;
}

// Category mapping - must match tab ids
const getCategoryFromRank = (rank: string | null): string => {
  if (!rank) return "Agent";
  const rankUpper = rank.toUpperCase();
  
  if (rankUpper.includes("GROUP AGENCY DIRECTOR") || rankUpper.includes("GAD")) {
    return "GAD";
  }
  if (rankUpper.includes("AGENCY DIRECTOR") || rankUpper.includes("AD")) {
    return "AD";
  }
  if (rankUpper.includes("AGENCY GROWTH MANAGER") || rankUpper.includes("AGM")) {
    return "AGM";
  }
  return "Agent";
};

const categories = [
  { id: "GAD", label: "GAD" },
  { id: "AD", label: "AD" },
  { id: "AGM", label: "AGM" },
  { id: "Agent", label: "Agent" },
];

const monthOptions = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-slate-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return (
        <span className="flex h-5 w-5 items-center justify-center text-sm font-bold text-slate-400">
          {rank}
        </span>
      );
  }
}

interface RankingListProps {
  entries: RankingEntry[];
  metric: "afyc" | "cases";
  currentUserCode?: string;
}

function RankingList({ entries, metric, currentUserCode }: RankingListProps) {
  const sorted = [...entries].sort((a, b) =>
    metric === "afyc" ? b.afyc - a.afyc : b.cases - a.cases
  );

  return (
    <div className="space-y-2">
      {sorted.map((entry, i) => {
        const isCurrentUser = entry.agentCode === currentUserCode;
        return (
          <div
            key={entry.agentCode}
            id={`ranking-${metric}-${entry.agentCode}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-all duration-300 hover:bg-muted/50 hover:shadow-sm cursor-pointer animate-fade-in",
              i < 3 && "border-yellow-200 bg-yellow-50/30",
              isCurrentUser && "ring-2 ring-primary ring-offset-2 bg-primary/5"
            )}
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className="flex w-7 items-center justify-center">
              {getRankIcon(i + 1)}
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg">
              <span className="text-xs font-semibold">{entry.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {entry.name} {isCurrentUser && <span className="text-primary text-xs ml-1">(You)</span>}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{entry.agentCode}</p>
                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {entry.rank_title}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              {metric === "afyc" ? (
                <>
                  <p className="text-sm font-semibold text-primary">{entry.afyc.toLocaleString()} AFYC</p>
                  <p className="text-xs text-muted-foreground">AFYC</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-primary">{entry.cases} cases</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LiveRankingSectionProps {
  title: string;
  icon: React.ReactNode;
  metric: "afyc" | "cases";
  cases: any[];
  profiles: any[];
  testMode?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
  currentUserCode?: string;
  onJumpToUser?: () => void;
}

function LiveRankingSection({ 
  title, 
  icon, 
  metric, 
  cases, 
  profiles, 
  testMode, 
  selectedMonth, 
  selectedYear,
  currentUserCode,
  onJumpToUser
}: LiveRankingSectionProps) {
  const [activeCategory, setActiveCategory] = useState("AD");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [userRankInfo, setUserRankInfo] = useState<{ rank: number; category: string } | null>(null);

  // Helper to filter cases based on test mode
  const getFilteredCases = () => {
    if (!testMode || selectedMonth === undefined || selectedYear === undefined) {
      return cases;
    }
    
    const filtered = cases.filter(c => {
      // Try to use entry_month first
      if (c.entry_month) {
        try {
          const entryDate = parseISO(c.entry_month);
          if (isValid(entryDate)) {
            return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
          }
        } catch (e) {
          // Fall through
        }
      }
      
      // Fallback to submission_date_timestamp
      if (c.submission_date_timestamp) {
        try {
          const date = parseISO(c.submission_date_timestamp);
          if (isValid(date)) {
            return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
      return false;
    });
    
    return filtered;
  };

  // Find user's rank in the current rankings
  const findUserRank = (rankingsList: RankingEntry[], userCode: string) => {
    const userEntry = rankingsList.find(r => r.agentCode === userCode);
    return userEntry ? userEntry.rank : null;
  };

  useEffect(() => {
    const calculateRankings = () => {
      const filteredCases = getFilteredCases();
      
      // Create a map of agent_id to their stats from cases
      const agentStatsMap = new Map<string, { cases: number; afyc: number }>();
      
      filteredCases.forEach(c => {
        const agentId = c.agent_id;
        if (!agentStatsMap.has(agentId)) {
          agentStatsMap.set(agentId, { cases: 0, afyc: 0 });
        }
        const stats = agentStatsMap.get(agentId)!;
        stats.cases += 1;
        stats.afyc += Number(c.premium) || 0;
      });
      
      // Create rankings for ALL agents who have cases, then filter by category
      const allAgentRankings: RankingEntry[] = [];
      
      agentStatsMap.forEach((stats, agentId) => {
        // Find the profile for this agent
        const profile = profiles.find(p => p.agent_code === agentId);
        
        if (profile) {
          const profileCategory = getCategoryFromRank(profile.rank);
          
          // Only include if matches selected category
          if (profileCategory === activeCategory) {
            allAgentRankings.push({
              rank: 0,
              name: profile.full_name,
              agentCode: agentId,
              cases: stats.cases,
              afyc: stats.afyc,
              rank_title: profile.rank || "Agent",
            });
          }
        }
      });
      
      // Sort based on metric and take top 10
      const sorted = [...allAgentRankings]
        .sort((a, b) => metric === "afyc" ? b.afyc - a.afyc : b.cases - a.cases)
        .slice(0, 10);
      
      // Assign ranks
      sorted.forEach((item, idx) => { item.rank = idx + 1; });
      
      setRankings(sorted);
      
      // Find user's rank if currentUserCode exists
      if (currentUserCode) {
        const userRank = findUserRank(sorted, currentUserCode);
        if (userRank) {
          setUserRankInfo({ rank: userRank, category: activeCategory });
        } else {
          setUserRankInfo(null);
        }
      }
    };

    if (cases.length > 0 && profiles.length > 0) {
      calculateRankings();
    }
  }, [cases, profiles, activeCategory, metric, testMode, selectedMonth, selectedYear, currentUserCode]);

  const getFilterText = () => {
    if (testMode && selectedMonth !== undefined && selectedYear !== undefined) {
      return `${monthOptions[selectedMonth]?.label} ${selectedYear}`;
    }
    return null;
  };

  const filterText = getFilterText();

  // Handle jump to user
  const handleJumpToUser = () => {
    if (currentUserCode) {
      const element = document.getElementById(`ranking-${metric}-${currentUserCode}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/10');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/10');
        }, 3000);
      }
      if (onJumpToUser) onJumpToUser();
    }
  };

  return (
    <Card className="shadow-soft border-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </CardTitle>
          {filterText && (
            <p className="text-xs text-muted-foreground mt-1">
              Filtered: {filterText}
            </p>
          )}
          {userRankInfo && (
            <p className="text-xs text-primary mt-1">
              Your rank: #{userRankInfo.rank} in {userRankInfo.category}
            </p>
          )}
        </div>
        {currentUserCode && (
          <button
            onClick={handleJumpToUser}
            className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-full transition-colors"
          >
            Jump to Me
          </button>
        )}
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="mb-4 grid w-full grid-cols-4 gap-2 bg-slate-100 p-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
                <Users className="hidden h-3.5 w-3.5 sm:block" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-0">
              {rankings.length > 0 ? (
                <RankingList entries={rankings} metric={metric} currentUserCode={currentUserCode} />
              ) : (
                <div className="py-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-400">
                    {filterText ? `No data available for ${cat.label} in ${filterText}` : `No data available for ${cat.label}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Total cases in period: {cases.length}
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function LiveRankings({ cases, profiles, testMode = false, selectedMonth, selectedYear, currentUserCode }: LiveRankingsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:col-span-2">
      <LiveRankingSection
        title="Rankings by AFYC"
        icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
        metric="afyc"
        cases={cases}
        profiles={profiles}
        testMode={testMode}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        currentUserCode={currentUserCode}
      />
      <LiveRankingSection
        title="Rankings by Cases"
        icon={<FileText className="h-5 w-5 text-blue-500" />}
        metric="cases"
        cases={cases}
        profiles={profiles}
        testMode={testMode}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        currentUserCode={currentUserCode}
      />
    </div>
  );
}
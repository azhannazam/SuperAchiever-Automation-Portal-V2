import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Calendar, Target, Gift, Loader2, Clock, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Contest {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

// Mock contests for demonstration
const mockContests: Contest[] = [
  {
    id: "1",
    name: "NAIS Contest",
    description: "National Agent Incentive Scheme - Top performers win cash prizes and overseas trips",
    start_date: "2024-01-01",
    end_date: "2024-06-30",
    is_active: true,
  },
  {
    id: "2",
    name: "Etiqa Contest",
    description: "Quarterly sales competition with exclusive rewards for top 10 agents",
    start_date: "2024-04-01",
    end_date: "2024-06-30",
    is_active: true,
  },
  {
    id: "3",
    name: "New Agent Bonus",
    description: "Special incentives for agents who joined within the last 12 months",
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    is_active: true,
  },
];

const prizeData: Record<string, { rank: number; prize: string }[]> = {
  "1": [
    { rank: 1, prize: "RM 50,000 + Paris Trip" },
    { rank: 2, prize: "RM 30,000 + Tokyo Trip" },
    { rank: 3, prize: "RM 20,000 + Bali Trip" },
    { rank: 4, prize: "RM 10,000" },
    { rank: 5, prize: "RM 5,000" },
  ],
  "2": [
    { rank: 1, prize: "RM 15,000" },
    { rank: 2, prize: "RM 10,000" },
    { rank: 3, prize: "RM 7,500" },
    { rank: 4, prize: "RM 5,000" },
    { rank: 5, prize: "RM 2,500" },
  ],
  "3": [
    { rank: 1, prize: "RM 8,000 + Mentorship Program" },
    { rank: 2, prize: "RM 5,000" },
    { rank: 3, prize: "RM 3,000" },
  ],
};

export default function Contests() {
  const { user, role, isLoading } = useAuth();
  const [contests, setContests] = useState<Contest[]>(mockContests);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedContest, setSelectedContest] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchContests();
    }
  }, [user]);

  const fetchContests = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("contests")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setContests(data);
      }
    } catch (error) {
      console.error("Error fetching contests:", error);
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

  const isAdmin = role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-7 w-7 text-warning" />
            Contests
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage contests and view participant standings" : "View active contests and your rankings"}
          </p>
        </div>

        {/* Contest cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contests.map((contest) => {
            const daysRemaining = differenceInDays(new Date(contest.end_date), new Date());
            const totalDays = differenceInDays(new Date(contest.end_date), new Date(contest.start_date));
            const daysPassed = totalDays - daysRemaining;
            const progress = Math.max(0, Math.min(100, (daysPassed / totalDays) * 100));
            const prizes = prizeData[contest.id] || [];

            return (
              <Card
                key={contest.id}
                className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer overflow-hidden"
                onClick={() => setSelectedContest(selectedContest === contest.id ? null : contest.id)}
              >
                <CardHeader className="gradient-hero text-white pb-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{contest.name}</CardTitle>
                      <CardDescription className="text-white/70 mt-1">
                        {contest.description?.slice(0, 60)}...
                      </CardDescription>
                    </div>
                    <Badge
                      variant={contest.is_active ? "default" : "secondary"}
                      className={contest.is_active ? "bg-success" : ""}
                    >
                      {contest.is_active ? "Active" : "Ended"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Progress */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ends</p>
                        <p className="text-sm font-medium">
                          {format(new Date(contest.end_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                        <p className="text-sm font-medium">
                          {daysRemaining > 0 ? `${daysRemaining} days` : "Ended"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prizes section - expandable */}
                  {selectedContest === contest.id && prizes.length > 0 && (
                    <div className="border-t pt-4 mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Gift className="h-4 w-4 text-warning" />
                        Prizes
                      </div>
                      {prizes.map((prize) => (
                        <div
                          key={prize.rank}
                          className="flex items-center justify-between text-sm rounded-lg bg-muted/50 px-3 py-2"
                        >
                          <span className="font-medium">Rank #{prize.rank}</span>
                          <span className="text-muted-foreground">{prize.prize}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Your ranking (for agents) */}
                  {!isAdmin && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Your Rank</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">#5</span>
                          <Target className="h-4 w-4 text-success" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

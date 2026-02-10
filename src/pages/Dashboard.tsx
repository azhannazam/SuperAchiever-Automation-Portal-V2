import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  CheckCircle2,
  Clock,
  Bell,
  Trophy,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface CaseData {
  id: string;
  policy_number: string;
  client_name: string;
  product_type: string | null;
  premium: number | null;
  status: "approved" | "pending";
  submission_date: string;
}

interface AlertData {
  id: string;
  alert_type: "normal" | "high_priority";
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function Dashboard() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);

      // 1. Get the agent_code tied to your specific login
      const { data: profile } = await supabase
        .from('profiles')
        .select('agent_code')
        .eq('id', user?.id)
        .single();

      if (profile) {
        // 2. Fetch cases that belong to your code
        const { data: myCases, error: casesError } = await supabase
          .from("cases")
          .select("*")
          .eq("agent_id", profile.agent_code)
          .order("submission_date", { ascending: false });

        if (myCases) setCases(myCases);
      }

      // 3. Fetch recent alerts
      const { data: alertsRes } = await supabase
        .from("alerts")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (alertsRes) setAlerts(alertsRes);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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

  // --- STATS CALCULATION ---
  const approvedCount = cases.filter((c) => c.status === "approved").length;
  const pendingCount = cases.filter((c) => c.status === "pending").length;
  const totalPremium = cases.reduce((sum, c) => sum + (c.premium || 0), 0);
  const isAdmin = role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdmin ? "Admin Dashboard" : "Agent Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Overview of all cases, alerts, and contest performance"
              : "Track your cases and contest rankings"}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Cases"
            value={cases.length}
            subtitle={isAdmin ? "All agents" : "Your submissions"}
            icon={<FileText className="h-6 w-6 text-primary" />}
          />
          <StatCard
            title="Approved"
            value={approvedCount}
            subtitle="Active policies"
            icon={<CheckCircle2 className="h-6 w-6 text-success" />}
            variant="success"
          />
          <StatCard
            title="Pending"
            value={pendingCount}
            subtitle="Awaiting approval"
            icon={<Clock className="h-6 w-6 text-warning" />}
            variant="warning"
          />
          <StatCard
            title="Total Premium"
            value={`RM ${totalPremium.toLocaleString()}`}
            subtitle="This month"
            icon={<TrendingUp className="h-6 w-6 text-primary" />}
            variant="primary"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cases table */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Cases</CardTitle>
              <Tabs defaultValue="all" className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No cases found for your agent code.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.slice(0, 10).map((caseItem) => (
                      <TableRow key={caseItem.id}>
                        <TableCell className="font-medium">
                          {caseItem.policy_number}
                        </TableCell>
                        <TableCell>{caseItem.client_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {caseItem.product_type || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {caseItem.premium
                            ? `RM ${caseItem.premium.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={caseItem.status === "approved" ? "approved" : "pending"}
                          >
                            {caseItem.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Alerts sidebar */}
          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg font-semibold">Alerts</CardTitle>
                {alerts.length > 0 && (
                  <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                    {alerts.length}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No new alerts
                  </p>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-lg border p-3 ${
                          alert.alert_type === "high_priority"
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-warning/30 bg-warning/5"
                        }`}
                      >
                        <p className="text-sm">{alert.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg font-semibold">Active Contests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["NAIS Contest", "Etiqa Contest", "New Agent Bonus"].map(
                    (contest, i) => (
                      <div
                        key={contest}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium text-sm">{contest}</p>
                          <p className="text-xs text-muted-foreground">Ends in {10 + i * 5} days</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">#{i + 1}</p>
                          <p className="text-xs text-muted-foreground">Your Rank</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
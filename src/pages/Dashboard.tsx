import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";

interface CaseData {
  id: string;
  policy_number: string;
  client_name: string;
  product_type: string | null;
  premium: number | null;
  status: "approved" | "pending";
  submission_date: string;
  agent_id: string;
}

export default function Dashboard() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Admin Detection
  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, role]);

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);
      let finalCases: CaseData[] = [];
      let finalAlerts: any[] = [];

      if (isAdmin) {
        // ADMIN: Sum up everything
        const { data: allCases } = await (supabase.from("cases") as any)
          .select("*")
          .order("submission_date", { ascending: false });
        finalCases = allCases || [];

        // ADMIN ALERTS: Global pending cases
        const { data: pending } = await (supabase.from("cases") as any)
          .select("*")
          .eq("status", "pending")
          .limit(5);
        finalAlerts = pending || [];
      } else {
        // AGENT: Personal data
        const { data: profile } = await supabase
          .from('profiles')
          .select('agent_code')
          .eq('id', user?.id)
          .maybeSingle();

        if (profile?.agent_code) {
          const { data: myCases } = await (supabase.from("cases") as any)
            .select("*")
            .eq("agent_id", profile.agent_code)
            .order("submission_date", { ascending: false });
          finalCases = myCases || [];
        }

        const { data: myAlerts } = await (supabase.from("alerts") as any)
          .select("*")
          .eq("user_id", user?.id)
          .limit(5);
        finalAlerts = myAlerts || [];
      }

      setCases(finalCases);
      setAlerts(finalAlerts);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const approvedCount = cases.filter((c) => c.status === "approved").length;
  const pendingCount = cases.filter((c) => c.status === "pending").length;
  const totalPremium = cases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdmin ? "Admin Dashboard" : "Agent Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Global oversight of all performance" : "Track your personal cases and rankings"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Cases" value={cases.length} subtitle={isAdmin ? "Total Company" : "Your submissions"} icon={<FileText className="h-6 w-6" />} />
          <StatCard title="Approved" value={approvedCount} subtitle="Active policies" icon={<CheckCircle2 className="h-6 w-6" />} variant="success" />
          <StatCard title="Pending" value={pendingCount} subtitle="Awaiting action" icon={<Clock className="h-6 w-6" />} variant="warning" />
          <StatCard title="Total Premium" value={`RM ${totalPremium.toLocaleString()}`} subtitle={isAdmin ? "Company total" : "This month"} icon={<TrendingUp className="h-6 w-6" />} variant="primary" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader><CardTitle className="text-lg font-semibold">Recent Submissions</CardTitle></CardHeader>
            <CardContent>
              {loadingData ? <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy #</TableHead>
                      {isAdmin && <TableHead>Agent ID</TableHead>}
                      <TableHead>Agent Name</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.slice(0, 10).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.policy_number}</TableCell>
                        {isAdmin && <TableCell className="text-xs font-bold text-primary">{c.agent_id}</TableCell>}
                        <TableCell>{c.client_name}</TableCell>
                        <TableCell className="text-right">RM {Number(c.premium || 0).toLocaleString()}</TableCell>
                        <TableCell><StatusBadge variant={c.status === "approved" ? "approved" : "pending"}>{c.status}</StatusBadge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center gap-2"><Bell className="h-5 w-5 text-warning" /><CardTitle className="text-lg font-semibold">{isAdmin ? "Pending Approval" : "Alerts"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {alerts.length === 0 ? <p className="text-xs text-center py-4 text-muted-foreground">All caught up!</p> : alerts.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border bg-slate-50">
                    <p className="text-xs font-bold">{isAdmin ? `Policy: ${a.policy_number}` : a.message}</p>
                    <p className="text-[10px] text-muted-foreground">{isAdmin ? `ID: ${a.agent_id}` : format(new Date(a.created_at), "MMM d, h:mm a")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center gap-2"><Trophy className="h-5 w-5 text-warning" /><CardTitle className="text-lg font-semibold">Active Contests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {["AIT Experience", "eNAC", "Grow Big"].map((contest, i) => (
                  <div key={contest} className="flex justify-between items-center p-3 rounded-lg border">
                    <p className="text-xs font-bold">{contest}</p>
                    {isAdmin ? <Badge variant="outline" className="text-[9px] text-emerald-600 bg-emerald-50">ACTIVE</Badge> : (
                      <div className="text-right">
                         <p className="text-sm font-semibold text-primary">#{i + 5}</p>
                         <p className="text-[10px] text-muted-foreground">Rank</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
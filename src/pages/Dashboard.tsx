import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format, parseISO, isValid } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface CaseData {
  id: string;
  policy_number: string;
  client_name: string;
  product_type: string | null;
  premium: number | null;
  status: "approved" | "pending" | "error";
  submission_date_timestamp: string;  // Changed from submission_date
  enforce_date: string | null;
  agent_id: string;
}

// Helper to safely parse and format dates
const formatDisplayDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  
  try {
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, "dd MMM yyyy");
    }
    return "-";
  } catch {
    return "-";
  }
};

// Format AFYC/premium values
const formatAFYC = (value: number | null): string => {
  if (!value) return "0 AFYC";
  return `${value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} AFYC`;
};

export default function Dashboard() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user, role]);

  const fetchDashboardData = async () => {
  try {
    setLoadingData(true);
    
    // Fetch all cases using pagination
    let allCases: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("submission_date_timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        allCases = [...allCases, ...data];
        page++;
        console.log(`📊 Dashboard fetched page ${page}: ${data.length} cases (total so far: ${allCases.length})`);
      }
      
      if (!data || data.length < pageSize) {
        hasMore = false;
      }
    }

    console.log("📊 Dashboard TOTAL cases fetched:", allCases.length);

    let finalCases: CaseData[] = [];
    let finalAlerts: any[] = [];

    if (isAdmin) {
      finalCases = allCases || [];
      finalAlerts = (allCases || []).filter(c => c.status === "pending").slice(0, 5);
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agent_code')
        .eq('id', user?.id)
        .maybeSingle();

      if (profile?.agent_code) {
        finalCases = (allCases || []).filter(c => c.agent_id === profile.agent_code);
      }
    }

    setCases(finalCases);
    setAlerts(finalAlerts);
  } catch (error) {
    console.error(error);
  } finally {
    setLoadingData(false);
  }
};

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const approvedCases = cases.filter((c) => c.status === "approved");
  const pendingCases = cases.filter((c) => c.status === "pending");
  
  const approvedAFYC = approvedCases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
  const pendingAFYC = pendingCases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
  const totalAFYC = cases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isAdmin ? "SuperAchiever Admin Oversight" : "My Personal Production"}
          </h1>
          <p className="text-muted-foreground text-sm">Global performance and agency roll-up</p>
        </header>

        {/* Stat Cards - Updated to AFYC format */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Submissions" 
            value={cases.length} 
            subtitle={isAdmin ? "Total Company Cases" : "Your lifetime cases"} 
            icon={<FileText className="h-6 w-6" />} 
          />
          <StatCard 
            title="Approved (Enforced)" 
            value={formatAFYC(approvedAFYC)} 
            subtitle={`${approvedCases.length} Enforced Cases`} 
            icon={<CheckCircle2 className="h-6 w-6" />} 
            variant="success" 
          />
          <StatCard 
            title="Pending Sync" 
            value={formatAFYC(pendingAFYC)} 
            subtitle={`${pendingCases.length} Awaiting Action`} 
            icon={<Clock className="h-6 w-6" />} 
            variant="warning" 
          />
          <StatCard 
            title="Total Production" 
            value={formatAFYC(totalAFYC)} 
            subtitle="Current AFYC Total" 
            icon={<TrendingUp className="h-6 w-6" />} 
            variant="primary" 
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Recent Case Activities</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="py-8 text-center">
                  <Loader2 className="animate-spin mx-auto text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold text-slate-700">Proposal No</TableHead>
                      <TableHead className="font-bold text-slate-700">Agent Name</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Submission</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Enforced Date</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">AFYC</TableHead>
                      <TableHead className="font-bold text-center text-slate-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.slice(0, 10).map((c) => (
                      <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                        <TableCell className="font-mono text-[10px] font-black text-primary uppercase">
                          {c.policy_number}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-slate-700">
                          {c.client_name}
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium text-slate-500 italic">
                          {formatDisplayDate(c.submission_date_timestamp)}
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-emerald-600">
                          {formatDisplayDate(c.enforce_date)}
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-slate-900">
                          {Number(c.premium || 0).toLocaleString('en-MY', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} AFYC
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge variant={c.status === "approved" ? "approved" : "pending"}>
                            {c.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-soft border-none bg-white">
              <CardHeader className="flex flex-row items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg font-bold text-slate-800">
                  Priority Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-xs text-center py-4 text-muted-foreground font-medium">
                    No urgent updates
                  </p>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl border border-slate-50 bg-slate-50/50">
                      <p className="text-xs font-black text-slate-800">
                        {isAdmin ? `Policy: ${a.policy_number}` : a.message}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                        {isAdmin ? `Agent ID: ${a.agent_id}` : formatDisplayDate(a.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Contest Progress */}
            <Card className="shadow-soft border-none bg-[#0F172A] text-white">
              <CardHeader className="flex flex-row items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg font-bold">Contest Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["AIT Experience", "ENAC", "GROW BIG"].map((contest) => (
                  <div key={contest} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">{contest}</p>
                      <p className="text-[10px] text-white/40 italic">Qualification in progress</p>
                    </div>
                    <Badge className="bg-warning text-slate-900 font-black text-[9px] hover:bg-warning/80 cursor-pointer">
                      VIEW RANK
                    </Badge>
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
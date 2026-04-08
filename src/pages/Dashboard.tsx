import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
  Bell,
  Trophy,
  BarChart3,
  DollarSign,
  AlertCircle,
  Timer,
  Users,
  Zap,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { SuperAchieverHeader } from "@/components/dashboard/SuperAchieverHeader";
import { StatCardDetail } from "@/components/dashboard/StatCardDetail";
import { LiveRankings } from "@/components/dashboard/LiveRankings";

// Add Select component if not available, or import from shadcn
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CaseData {
  id: string;
  policy_number: string;
  client_name: string;
  product_type: string | null;
  premium: number | null;
  status: "approved" | "pending" | "error";
  remark: string | null;
  submission_date_timestamp: string;
  enforce_date: string | null;
  agent_id: string;
  created_at: string;
  entry_month: string | null;
}

interface Profile {
  id: string;
  agent_code: string;
  full_name: string;
  rank: string;
  join_date: string;
  cypr?: number;
  attended_vb101?: boolean;
}

interface Alert {
  id: string;
  policy_number: string;
  client_name: string;
  agent_id: string;
  status: string;
  remark: string | null;
  created_at: string;
}

interface Contest {
  id: string;
  name: string;
  end_date: string;
  description?: string;
  rank?: number;
  progress?: number;
  target?: number;
  achieved?: number;
}

interface StatDetail {
  title: string;
  value: string | number;
  subtitle?: string;
  details: { label: string; value: string | number }[];
}

// Helper functions
const formatAFYC = (value: number | null): string => {
  if (!value || value === 0) return "0 AFYC";
  return `${value.toLocaleString('en-MY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} AFYC`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString('en-MY');
};

// Month options for testing
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

export default function Dashboard() {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [lastUploadDate, setLastUploadDate] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<StatDetail | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  
  // Test mode: Allow selecting a specific month for MTD
  const [testMode, setTestMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Current user's agent code for "Jump to Me" functionality
  const [currentUserCode, setCurrentUserCode] = useState<string>("");

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";
  const API_BASE_URL = "http://127.0.0.1:8000";

  // Get current date for filtering (or use selected month/year for test mode)
  const getCurrentDate = () => {
    if (testMode) {
      return new Date(selectedYear, selectedMonth, 1);
    }
    return new Date();
  };

  const currentDate = getCurrentDate();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Helper to get the start of current month as DATE string
  const getCurrentMonthStart = (): string => {
    const start = startOfMonth(currentDate);
    return format(start, 'yyyy-MM-dd');
  };

  // Helper to get the start of current year as DATE string
  const getCurrentYearStart = (): string => {
    const start = startOfYear(currentDate);
    return format(start, 'yyyy-MM-dd');
  };

  const fetchCurrentUserCode = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('agent_code')
        .eq('id', user?.id)
        .maybeSingle();
      
      if (data?.agent_code) {
        setCurrentUserCode(data.agent_code);
      }
    } catch (err) {
      console.error("Error fetching user code:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentUserCode();
      fetchDashboardData();
      fetchLastUploadDateFromAPI();
      fetchContestsFromSupabase();
    }
  }, [user, role]);

  const fetchLastUploadDateFromAPI = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history?limit=1`);
      
      if (response.ok) {
        const historyData = await response.json();
        if (historyData && historyData.length > 0) {
          setLastUploadDate(historyData[0].uploadDate);
          setApiConnected(true);
          return;
        }
      }
      
      const { data, error } = await supabase
        .from("reports_history")
        .select("upload_date")
        .order("upload_date", { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setLastUploadDate(data[0].upload_date);
      }
    } catch (error) {
      console.error("Error fetching last upload date:", error);
    }
  };

  const fetchContestsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from("contests")
        .select("*")
        .gte("end_date", new Date().toISOString())
        .order("end_date", { ascending: true })
        .limit(3);
      
      if (data && data.length > 0) {
        const contestsWithProgress = data.map(contest => {
          let progress = 0;
          
          if (contest.name === "NAIS Contest") {
            const totalAfyc = cases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
            progress = Math.min(100, Math.round((totalAfyc / (contest.target || 100000)) * 100));
          } else if (contest.name === "Etiqua Contest") {
            progress = Math.min(100, Math.round((cases.length / (contest.target || 50)) * 100));
          } else {
            progress = Math.floor(Math.random() * 100);
          }
          
          const rank = Math.floor(Math.random() * 5) + 1;
          return { ...contest, progress, rank };
        });
        setContests(contestsWithProgress);
      } else {
        const totalAfyc = cases.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
        const totalCases_ = cases.length;
        
        setContests([
          { 
            id: "1", 
            name: "NAIS Contest", 
            end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), 
            description: "Top AFYC performers",
            target: 100000,
            achieved: totalAfyc,
            progress: Math.min(100, Math.round((totalAfyc / 100000) * 100)),
            rank: 1
          },
          { 
            id: "2", 
            name: "Etiqua Contest", 
            end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            description: "Most cases submitted",
            target: 50,
            achieved: totalCases_,
            progress: Math.min(100, Math.round((totalCases_ / 50) * 100)),
            rank: 2
          },
          { 
            id: "3", 
            name: "New Agent Bonus", 
            end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
            description: "Bonus for new agents",
            target: 30000,
            achieved: totalAfyc,
            progress: Math.min(100, Math.round((totalAfyc / 30000) * 100)),
            rank: 3
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching contests:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);
      
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
        }
        
        if (!data || data.length < pageSize) hasMore = false;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");

      if (profilesData) setProfiles(profilesData);

      if (isAdmin) {
        setCases(allCases);
        const pendingAlerts = allCases
          .filter(c => c.status === "pending")
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            policy_number: c.policy_number,
            client_name: c.client_name,
            agent_id: c.agent_id,
            status: c.status,
            remark: c.remark,
            created_at: c.created_at,
          }));
        setAlerts(pendingAlerts);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agent_code')
          .eq('id', user?.id)
          .maybeSingle();

        if (profile?.agent_code) {
          const userCases = allCases.filter(c => c.agent_id === profile.agent_code);
          setCases(userCases);
          const userAlerts = userCases
            .filter(c => c.status === "pending")
            .slice(0, 5)
            .map(c => ({
              id: c.id,
              policy_number: c.policy_number,
              client_name: c.client_name,
              agent_id: c.agent_id,
              status: c.status,
              remark: c.remark,
              created_at: c.created_at,
            }));
          setAlerts(userAlerts);
        }
      }
    } catch (error) {
      console.error(error);
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

  // ============================================
  // MTD CALCULATION - Uses selected month/year for test mode
  // ============================================
  const currentMonthStart = getCurrentMonthStart();
  
  const mtdCases = cases.filter((c) => {
    // First try to use entry_month if available
    if (c.entry_month) {
      return c.entry_month === currentMonthStart;
    }
    // Fallback: use submission_date_timestamp
    if (c.submission_date_timestamp) {
      try {
        const date = parseISO(c.submission_date_timestamp);
        if (isValid(date)) {
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    return false;
  });
  
  const mtdApproved = mtdCases.filter((c) => c.status === "approved").length;
  const mtdPending = mtdCases.filter((c) => c.status === "pending").length;
  const mtdPremium = mtdCases.reduce((s, c) => s + (Number(c.premium) || 0), 0);
  const mtdApprovedPremium = mtdCases.filter(c => c.status === "approved").reduce((s, c) => s + (Number(c.premium) || 0), 0);
  const mtdPendingPremium = mtdCases.filter(c => c.status === "pending").reduce((s, c) => s + (Number(c.premium) || 0), 0);

  // ============================================
  // YTD CALCULATION - Uses current year (real or test)
  // ============================================
  const currentYearStart = getCurrentYearStart();
  
  const ytdCases = cases.filter((c) => {
    // First try to use entry_month
    if (c.entry_month) {
      return c.entry_month >= currentYearStart;
    }
    // Fallback: use submission_date_timestamp
    if (c.submission_date_timestamp) {
      try {
        const date = parseISO(c.submission_date_timestamp);
        if (isValid(date)) {
          return date.getFullYear() === currentYear;
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    return false;
  });
  
  const ytdApproved = ytdCases.filter((c) => c.status === "approved").length;
  const ytdPending = ytdCases.filter((c) => c.status === "pending").length;
  const ytdPremium = ytdCases.reduce((s, c) => s + (Number(c.premium) || 0), 0);
  const ytdApprovedPremium = ytdCases.filter(c => c.status === "approved").reduce((s, c) => s + (Number(c.premium) || 0), 0);
  const ytdPendingPremium = ytdCases.filter(c => c.status === "pending").reduce((s, c) => s + (Number(c.premium) || 0), 0);

  // Lifetime stats (all time)
  const totalCases = cases.length;
  const totalApproved = cases.filter(c => c.status === "approved").length;
  const totalPending = cases.filter(c => c.status === "pending").length;
  const totalPremium = cases.reduce((s, c) => s + (Number(c.premium) || 0), 0);

  // Agent stats
  const agentCount = profiles.length;
  const activeAgents = profiles.filter(p => p.rank && p.rank !== "Inactive").length;

  console.log('📊 Dashboard Stats:', {
    totalCases,
    mtdCases: mtdCases.length,
    ytdCases: ytdCases.length,
    currentMonth: monthOptions[currentMonth]?.label,
    currentYear,
    testMode,
    selectedMonth: monthOptions[selectedMonth]?.label,
    selectedYear,
    entryMonthNullCount: cases.filter(c => !c.entry_month).length,
    currentUserCode,
  });

  const mtdStats = [
    {
      title: "MTD Cases",
      value: formatNumber(mtdCases.length),
      subtitle: testMode ? `${monthOptions[currentMonth]?.label} ${currentYear} (Test Mode)` : `${format(currentDate, "MMMM yyyy")}`,
      icon: <FileText className="h-6 w-6" />,
      variant: "default" as const,
      details: [
        { label: "Approved", value: formatNumber(mtdApproved) },
        { label: "Pending", value: formatNumber(mtdPending) },
        { label: "Total AFYC", value: formatAFYC(mtdPremium) },
        { label: "Approval Rate", value: mtdCases.length ? `${Math.round((mtdApproved / mtdCases.length) * 100)}%` : "0%" },
        { label: "Filter Period", value: `${monthOptions[currentMonth]?.label} ${currentYear}` },
      ],
    },
    {
      title: "MTD Approved",
      value: formatAFYC(mtdApprovedPremium),
      subtitle: testMode ? `${monthOptions[currentMonth]?.label} ${currentYear} (Test Mode)` : `${format(currentDate, "MMMM yyyy")}`,
      icon: <CheckCircle2 className="h-6 w-6" />,
      variant: "success" as const,
      details: [
        { label: "Number of Cases", value: formatNumber(mtdApproved) },
        { label: "Total AFYC", value: formatAFYC(mtdApprovedPremium) },
        { label: "Average per Case", value: mtdApproved ? formatAFYC(mtdApprovedPremium / mtdApproved) : "0 AFYC" },
        { label: "Approval Rate", value: mtdCases.length ? `${Math.round((mtdApproved / mtdCases.length) * 100)}%` : "0%" },
      ],
    },
    {
      title: "MTD Pending",
      value: formatAFYC(mtdPendingPremium),
      subtitle: testMode ? `${monthOptions[currentMonth]?.label} ${currentYear} (Test Mode)` : `${format(currentDate, "MMMM yyyy")}`,
      icon: <Clock className="h-6 w-6" />,
      variant: "warning" as const,
      details: [
        { label: "Number of Cases", value: formatNumber(mtdPending) },
        { label: "Total AFYC", value: formatAFYC(mtdPendingPremium) },
        { label: "Average per Case", value: mtdPending ? formatAFYC(mtdPendingPremium / mtdPending) : "0 AFYC" },
        { label: "Pending Rate", value: mtdCases.length ? `${Math.round((mtdPending / mtdCases.length) * 100)}%` : "0%" },
      ],
    },
    {
      title: "MTD Total AFYC",
      value: formatAFYC(mtdPremium),
      subtitle: testMode ? `${monthOptions[currentMonth]?.label} ${currentYear} (Test Mode)` : `${format(currentDate, "MMMM yyyy")}`,
      icon: <DollarSign className="h-6 w-6" />,
      variant: "primary" as const,
      details: [
        { label: "Approved AFYC", value: formatAFYC(mtdApprovedPremium) },
        { label: "Pending AFYC", value: formatAFYC(mtdPendingPremium) },
        { label: "Average per Case", value: mtdCases.length ? formatAFYC(mtdPremium / mtdCases.length) : "0 AFYC" },
        { label: "Total Cases", value: formatNumber(mtdCases.length) },
      ],
    },
  ];

  const ytdStats = [
    {
      title: "YTD Cases",
      value: formatNumber(ytdCases.length),
      subtitle: testMode ? `${currentYear} Year-to-Date (Test Mode)` : `${currentYear} Year-to-Date`,
      icon: <BarChart3 className="h-6 w-6" />,
      variant: "default" as const,
      details: [
        { label: "Approved", value: formatNumber(ytdApproved) },
        { label: "Pending", value: formatNumber(ytdPending) },
        { label: "Total AFYC", value: formatAFYC(ytdPremium) },
        { label: "Approval Rate", value: ytdCases.length ? `${Math.round((ytdApproved / ytdCases.length) * 100)}%` : "0%" },
        { label: "Filter Period", value: `${currentYear} Year-to-Date (Jan - ${monthOptions[currentMonth]?.label})` },
      ],
    },
    {
      title: "YTD Approved",
      value: formatAFYC(ytdApprovedPremium),
      subtitle: testMode ? `${currentYear} Year-to-Date (Test Mode)` : `${currentYear} Year-to-Date`,
      icon: <CheckCircle2 className="h-6 w-6" />,
      variant: "success" as const,
      details: [
        { label: "Number of Cases", value: formatNumber(ytdApproved) },
        { label: "Total AFYC", value: formatAFYC(ytdApprovedPremium) },
        { label: "Average per Case", value: ytdApproved ? formatAFYC(ytdApprovedPremium / ytdApproved) : "0 AFYC" },
        { label: "Monthly Average", value: formatAFYC(ytdApprovedPremium / (currentMonth + 1)) },
      ],
    },
    {
      title: "YTD Pending",
      value: formatAFYC(ytdPendingPremium),
      subtitle: testMode ? `${currentYear} Year-to-Date (Test Mode)` : `${currentYear} Year-to-Date`,
      icon: <Clock className="h-6 w-6" />,
      variant: "warning" as const,
      details: [
        { label: "Number of Cases", value: formatNumber(ytdPending) },
        { label: "Total AFYC", value: formatAFYC(ytdPendingPremium) },
        { label: "Average per Case", value: ytdPending ? formatAFYC(ytdPendingPremium / ytdPending) : "0 AFYC" },
        { label: "Pending Rate", value: ytdCases.length ? `${Math.round((ytdPending / ytdCases.length) * 100)}%` : "0%" },
      ],
    },
    {
      title: "YTD Total AFYC",
      value: formatAFYC(ytdPremium),
      subtitle: testMode ? `${currentYear} Year-to-Date (Test Mode)` : `${currentYear} Year-to-Date`,
      icon: <TrendingUp className="h-6 w-6" />,
      variant: "primary" as const,
      details: [
        { label: "Approved AFYC", value: formatAFYC(ytdApprovedPremium) },
        { label: "Pending AFYC", value: formatAFYC(ytdPendingPremium) },
        { label: "Average per Case", value: ytdCases.length ? formatAFYC(ytdPremium / ytdCases.length) : "0 AFYC" },
        { label: "Total Cases", value: formatNumber(ytdCases.length) },
        { label: "Monthly Average", value: formatAFYC(ytdPremium / (currentMonth + 1)) },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* SUPERACHIEVER Header */}
        <SuperAchieverHeader lastUploadDate={lastUploadDate} />

        {/* Test Mode Toggle and Month Selector */}
        <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="testMode"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-slate-300"
              />
              <label htmlFor="testMode" className="text-sm font-medium text-slate-700">
                Test Mode (Select Month/Year)
              </label>
            </div>
            
            {testMode && (
              <div className="flex items-center gap-3 ml-4">
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-32 h-8 text-sm">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedYear(selectedYear - 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-16 text-center">{selectedYear}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedYear(selectedYear + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {testMode && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
              Testing: {monthOptions[selectedMonth]?.label} {selectedYear}
            </Badge>
          )}
        </div>

        {/* Quick Stats Row for Admin */}
        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Agents</p>
                    <p className="text-2xl font-bold text-blue-900">{formatNumber(agentCount)}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Active Agents</p>
                    <p className="text-2xl font-bold text-emerald-900">{formatNumber(activeAgents)}</p>
                  </div>
                  <Zap className="h-8 w-8 text-emerald-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Total Cases</p>
                    <p className="text-2xl font-bold text-purple-900">{formatNumber(totalCases)}</p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600 font-medium">Total AFYC</p>
                    <p className="text-2xl font-bold text-amber-900">{formatAFYC(totalPremium)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MTD Stats - Resets every month */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Month-to-Date Performance
            </h2>
            <Badge variant="outline" className="text-xs">
              {mtdCases.length > 0 ? `${mtdCases.length} Cases` : 'No Data'}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {mtdStats.map((stat, i) => (
              <div
                key={stat.title}
                className="cursor-pointer transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() =>
                  setSelectedStat({
                    title: stat.title,
                    value: stat.value,
                    subtitle: stat.subtitle,
                    details: stat.details,
                  })
                }
              >
                <StatCard
                  title={stat.title}
                  value={stat.value}
                  subtitle={stat.subtitle}
                  icon={stat.icon}
                  variant={stat.variant}
                />
              </div>
            ))}
          </div>
        </div>

        {/* YTD Stats - Accumulates throughout the year */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Year-to-Date Performance
            </h2>
            <Badge variant="outline" className="text-xs">
              {ytdCases.length > 0 ? `${ytdCases.length} Cases` : 'No Data'}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ytdStats.map((stat, i) => (
              <div
                key={stat.title}
                className="cursor-pointer transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() =>
                  setSelectedStat({
                    title: stat.title,
                    value: stat.value,
                    subtitle: stat.subtitle,
                    details: stat.details,
                  })
                }
              >
                <StatCard
                  title={stat.title}
                  value={stat.value}
                  subtitle={stat.subtitle}
                  icon={stat.icon}
                  variant={stat.variant}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live Rankings + Alerts & Contests */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveRankings 
              cases={cases} 
              profiles={profiles} 
              testMode={testMode} 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear}
              currentUserCode={currentUserCode}
            />
          </div>

          <div className="space-y-6">
            {/* Alerts Card */}
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
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-success opacity-50" />
                    <p className="text-sm text-muted-foreground mt-2">No new alerts</p>
                    <p className="text-xs text-muted-foreground">All cases are processed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="cursor-pointer rounded-lg border border-warning/30 bg-warning/5 p-3 transition-all duration-300 hover:shadow-sm"
                        onClick={() => navigate("/dashboard/alerts")}
                      >
                        <StatusBadge variant="pending">Pending</StatusBadge>
                        <p className="mt-2 text-sm font-medium">{alert.policy_number}</p>
                        <p className="text-xs text-muted-foreground">{alert.client_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Agent: {alert.agent_id}</p>
                        {alert.remark && (
                          <p className="mt-1 text-xs text-warning flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {alert.remark}
                          </p>
                        )}
                      </div>
                    ))}
                    {alerts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard/alerts")}
                        className="w-full text-xs"
                      >
                        View All Alerts ({alerts.length})
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Contests Card */}
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg font-semibold">Active Contests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contests.map((contest) => {
                    const daysLeft = Math.ceil(
                      (new Date(contest.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={contest.id}
                        className="cursor-pointer rounded-lg border p-3 transition-all duration-300 hover:bg-muted/50 hover:shadow-sm"
                        onClick={() => navigate("/dashboard/contests")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{contest.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Timer className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                Ends in {daysLeft} days
                              </p>
                            </div>
                            {contest.description && (
                              <p className="text-xs text-muted-foreground mt-1">{contest.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">
                              #{contest.rank || Math.floor(Math.random() * 5) + 1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Your Rank
                            </p>
                          </div>
                        </div>
                        {contest.progress !== undefined && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium text-primary">{contest.progress}%</span>
                            </div>
                            <Progress value={contest.progress} className="h-1.5" />
                            {contest.target && contest.achieved && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatAFYC(contest.achieved)} / {formatAFYC(contest.target)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <StatCardDetail
        open={!!selectedStat}
        onOpenChange={(open) => !open && setSelectedStat(null)}
        title={selectedStat?.title || ""}
        value={selectedStat?.value || ""}
        subtitle={selectedStat?.subtitle}
        details={selectedStat?.details || []}
      />
    </DashboardLayout>
  );
}
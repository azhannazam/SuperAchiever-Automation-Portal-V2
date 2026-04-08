import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, 
  FileText, 
  Loader2, 
  Calendar,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  Zap,
  FileSpreadsheet,
} from "lucide-react";
import { format, parseISO, isValid, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Case {
  id: string;
  policy_number: string;
  agent_id: string;
  client_name: string;
  product_type: string;
  premium: number;
  status: string;
  submission_date_timestamp: string;
  enforce_date: string | null;
  payment_frequency: string | null;
  created_at: string;
}

// Helper function to safely parse dates
const parseDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  try {
    const date = parseISO(dateString);
    if (isValid(date)) return date;
    const timestamp = Date.parse(dateString);
    if (!isNaN(timestamp)) return new Date(timestamp);
    return null;
  } catch {
    return null;
  }
};

// Helper to format date for display
const formatDisplayDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  const date = parseDate(dateString);
  if (!date) return "Invalid date";
  if (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1) {
    return "Date not available";
  }
  return format(date, "dd MMM yyyy");
};

// Format AFYC
const formatAFYC = (value: number | null): string => {
  if (!value) return "0 AFYC";
  return `${value.toLocaleString('en-MY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} AFYC`;
};

export default function TodayCases() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUploadInfo, setLastUploadInfo] = useState<{ date: string; fileName: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [exporting, setExporting] = useState(false);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";
  const API_BASE_URL = "http://127.0.0.1:8000";

  useEffect(() => {
    if (user) {
      fetchTodayCases();
      fetchLastUploadInfo();
    }
  }, [user]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchTodayCases(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchTodayCases = async (showToast = false) => {
    try {
      setLoading(true);
      
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .order("created_at", { ascending: false });

      if (error) throw error;

      let finalCases = data || [];
      
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agent_code')
          .eq('id', user?.id)
          .maybeSingle();

        if (profile?.agent_code) {
          finalCases = finalCases.filter(c => c.agent_id === profile.agent_code);
        } else {
          setCases([]);
          setLoading(false);
          return;
        }
      }

      setCases(finalCases);
      
      if (showToast) {
        toast.success(`Found ${finalCases.length} cases for today`);
      }
      
      console.log(`📊 Today's cases: ${finalCases.length}`);
      
    } catch (error) {
      console.error("Error fetching today's cases:", error);
      if (showToast) {
        toast.error("Failed to load today's cases");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLastUploadInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history?limit=1`);
      if (response.ok) {
        const historyData = await response.json();
        if (historyData && historyData.length > 0) {
          setLastUploadInfo({
            date: historyData[0].uploadDate,
            fileName: historyData[0].fileName
          });
        }
      }
    } catch (error) {
      console.error("Error fetching last upload info:", error);
    }
  };

  const handleExportStyledExcel = () => {
    if (cases.length === 0) {
      toast.error("No data to export");
      return;
    }

    setExporting(true);

    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // ===== SHEET 1: Cover Page with Logo =====
      const coverData = [
        ["SUPERACHIEVER"],
        ["Daily Submissions Report"],
        [""],
        [`Report Date: ${format(new Date(), "dd MMMM yyyy")}`],
        [`Generated Time: ${format(new Date(), "HH:mm:ss")}`],
        [""],
        ["Report Summary"],
        [`Total Cases: ${cases.length}`],
        [`Total AFYC: ${calculateTotalPremium().toLocaleString()}`],
        [`Approved Cases: ${getApprovedCount()}`],
        [`Pending Cases: ${getPendingCount()}`],
        [""],
        ["Prepared by: SuperAchiever System"],
        ["This report is auto-generated by SuperAchiever Data Management System"],
      ];
      
      const wsCover = XLSX.utils.aoa_to_sheet(coverData);
      
      // Set column widths for cover sheet
      wsCover['!cols'] = [{ wch: 50 }];
      
      XLSX.utils.book_append_sheet(wb, wsCover, "Cover");

      // ===== SHEET 2: Daily Submissions Data with Styling =====
      const exportData = cases.map(c => ({
        "No.": cases.indexOf(c) + 1,
        "Policy Number": c.policy_number,
        "Agent ID": c.agent_id,
        "Agent Name": c.client_name,
        "Product": c.product_type || "N/A",
        "AFYC (RM)": (c.premium || 0).toFixed(0),
        "Status": c.status === "approved" ? "Approved" : "Pending",
        "Submission Date": c.submission_date_timestamp 
          ? format(parseDate(c.submission_date_timestamp) || new Date(), "dd MMM yyyy") 
          : "N/A",
        "Enforce Date": c.enforce_date 
          ? format(parseDate(c.enforce_date) || new Date(), "dd MMM yyyy") 
          : "N/A",
        "Payment Frequency": c.payment_frequency || "N/A",
      }));

      const wsData = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      wsData['!cols'] = [
        { wch: 6 },   // No.
        { wch: 18 },  // Policy Number
        { wch: 12 },  // Agent ID
        { wch: 30 },  // Agent Name
        { wch: 15 },  // Product
        { wch: 15 },  // AFYC
        { wch: 12 },  // Status
        { wch: 15 },  // Submission Date
        { wch: 15 },  // Enforce Date
        { wch: 18 },  // Payment Frequency
      ];
      
      XLSX.utils.book_append_sheet(wb, wsData, "Daily Submissions");

      // ===== SHEET 3: Summary Statistics =====
      const summaryData = [
        { "Metric": "Report Information", "Value": "" },
        { "Metric": "Report Date", "Value": format(new Date(), "dd MMMM yyyy") },
        { "Metric": "Report Time", "Value": format(new Date(), "HH:mm:ss") },
        { "Metric": "Generated By", "Value": user?.email || "System" },
        { "Metric": "", "Value": "" },
        { "Metric": "Production Summary", "Value": "" },
        { "Metric": "Total Cases", "Value": cases.length },
        { "Metric": "Total AFYC", "Value": `RM ${calculateTotalPremium().toLocaleString()}` },
        { "Metric": "Average AFYC per Case", "Value": cases.length > 0 ? `RM ${Math.round(calculateTotalPremium() / cases.length).toLocaleString()}` : "RM 0" },
        { "Metric": "", "Value": "" },
        { "Metric": "Status Breakdown", "Value": "" },
        { "Metric": "Approved Cases", "Value": `${getApprovedCount()} (${cases.length > 0 ? Math.round((getApprovedCount() / cases.length) * 100) : 0}%)` },
        { "Metric": "Pending Cases", "Value": `${getPendingCount()} (${cases.length > 0 ? Math.round((getPendingCount() / cases.length) * 100) : 0}%)` },
        { "Metric": "", "Value": "" },
        { "Metric": "Payment Frequency Breakdown", "Value": "" },
      ];
      
      // Add payment frequency breakdown
      const frequencyMap = new Map<string, number>();
      cases.forEach(c => {
        const freq = c.payment_frequency || "Not Specified";
        frequencyMap.set(freq, (frequencyMap.get(freq) || 0) + 1);
      });
      
      frequencyMap.forEach((count, freq) => {
        summaryData.push({ "Metric": `  ${freq}`, "Value": `${count} cases` });
      });
      
      summaryData.push(
        { "Metric": "", "Value": "" },
        { "Metric": "Last Upload Information", "Value": "" },
        { "Metric": "Last Upload Date", "Value": lastUploadInfo ? format(new Date(lastUploadInfo.date), "dd MMMM yyyy, HH:mm") : "N/A" },
        { "Metric": "Last File Name", "Value": lastUploadInfo?.fileName || "N/A" },
      );
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // ===== SHEET 4: Agent Performance =====
      const agentPerformance = new Map<string, { name: string; cases: number; afyc: number }>();
      cases.forEach(c => {
        if (!agentPerformance.has(c.agent_id)) {
          agentPerformance.set(c.agent_id, { name: c.client_name, cases: 0, afyc: 0 });
        }
        const perf = agentPerformance.get(c.agent_id)!;
        perf.cases += 1;
        perf.afyc += c.premium || 0;
      });
      
      const agentData = Array.from(agentPerformance.entries())
        .map(([id, data]) => ({
          "Rank": 0,
          "Agent ID": id,
          "Agent Name": data.name,
          "Total Cases": data.cases,
          "Total AFYC": `RM ${data.afyc.toLocaleString()}`,
          "Average AFYC": `RM ${Math.round(data.afyc / data.cases).toLocaleString()}`,
        }))
        .sort((a, b) => {
          const afycA = parseInt(a["Total AFYC"].replace(/[^0-9]/g, ''));
          const afycB = parseInt(b["Total AFYC"].replace(/[^0-9]/g, ''));
          return afycB - afycA;
        })
        .map((item, idx) => ({ ...item, "Rank": idx + 1 }));
      
      const wsAgents = XLSX.utils.json_to_sheet(agentData);
      wsAgents['!cols'] = [
        { wch: 8 },   // Rank
        { wch: 12 },  // Agent ID
        { wch: 30 },  // Agent Name
        { wch: 12 },  // Total Cases
        { wch: 15 },  // Total AFYC
        { wch: 15 },  // Average AFYC
      ];
      XLSX.utils.book_append_sheet(wb, wsAgents, "Agent Performance");

      // Generate filename
      const dateStr = format(new Date(), "yyyyMMdd");
      const filename = `SuperAchiever_Daily_Submissions_${dateStr}.xlsx`;

      // Export
      XLSX.writeFile(wb, filename);
      
      toast.success(`Exported ${cases.length} cases to beautifully formatted Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (cases.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Policy Number", 
      "Agent ID", 
      "Agent Name", 
      "Product", 
      "AFYC", 
      "Status", 
      "Submission Date",
      "Enforce Date",
      "Payment Frequency"
    ];
    
    const csvContent = [
      headers.join(","),
      ...cases.map(c => [
        c.policy_number,
        c.agent_id,
        `"${c.client_name.replace(/"/g, '""')}"`,
        `"${c.product_type || "N/A"}"`,
        (c.premium || 0).toFixed(0),
        c.status,
        c.submission_date_timestamp ? format(parseDate(c.submission_date_timestamp) || new Date(), "yyyy-MM-dd") : "N/A",
        c.enforce_date ? format(parseDate(c.enforce_date) || new Date(), "yyyy-MM-dd") : "N/A",
        c.payment_frequency || "N/A"
      ].join(","))
    ].join("\n");

    const dateStr = format(new Date(), "yyyyMMdd");
    const filename = `Daily_Submissions_${dateStr}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${cases.length} cases to CSV`);
  };

  const calculateTotalPremium = () => {
    return cases.reduce((sum, c) => sum + (c.premium || 0), 0);
  };

  const getApprovedCount = () => {
    return cases.filter(c => c.status === "approved").length;
  };

  const getPendingCount = () => {
    return cases.filter(c => c.status === "pending").length;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Today's Cases
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Daily View
                  </Badge>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Cases submitted today - Resets daily at midnight
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "gap-2 transition-all duration-300",
                autoRefresh && "bg-green-50 text-green-700 border-green-200"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin-slow")} />
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Button>
            
            {isAdmin && cases.length > 0 && (
              <>
                <Button 
                  onClick={handleExportStyledExcel} 
                  disabled={exporting}
                  className="flex gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all duration-300"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )} 
                  Export Beautiful Excel
                </Button>
                <Button 
                  onClick={handleExportCSV} 
                  variant="outline"
                  className="flex gap-2"
                >
                  <Download className="h-4 w-4" /> 
                  Export CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Last Upload Info */}
        {lastUploadInfo && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 animate-slide-in-right">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Last Upload</p>
                    <p className="text-xs text-blue-600">{lastUploadInfo.fileName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-700">
                    {format(new Date(lastUploadInfo.date), "dd MMM yyyy, HH:mm")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-white border-none shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Cases</p>
                  <p className="text-3xl font-bold text-green-900">{cases.length}</p>
                  <p className="text-xs text-green-500 mt-1">Today</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white border-none shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Total AFYC</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatAFYC(calculateTotalPremium())}</p>
                  <p className="text-xs text-emerald-500 mt-1">Today's value</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-none shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Approved</p>
                  <p className="text-3xl font-bold text-blue-900">{getApprovedCount()}</p>
                  <p className="text-xs text-blue-500 mt-1">Cases</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-none shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Pending</p>
                  <p className="text-3xl font-bold text-amber-900">{getPendingCount()}</p>
                  <p className="text-xs text-amber-500 mt-1">Cases</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cases Table */}
        <Card className="border-none shadow-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-green-500" />
                Today's Submissions
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fetchTodayCases(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Loading today's cases...</p>
              </div>
            ) : cases.length === 0 ? (
              <div className="py-20 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <Calendar className="h-16 w-16 mx-auto text-slate-300 opacity-30" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-slate-200/50" />
                </div>
                <p className="text-lg font-semibold text-slate-400">No Cases Today</p>
                <p className="text-sm text-slate-400 mt-1">Upload a report to see today's submissions</p>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="mt-4 gap-2"
                    onClick={() => window.location.href = "/dashboard/reports"}
                  >
                    <Zap className="h-4 w-4" />
                    Go to Reports
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-bold">Submission Date</TableHead>
                        <TableHead className="font-bold">Proposal No #</TableHead>
                        {isAdmin && <TableHead className="font-bold">Agent ID</TableHead>}
                        <TableHead className="font-bold">Agent Name</TableHead>
                        <TableHead className="font-bold">Product</TableHead>
                        <TableHead className="text-right font-bold">AFYC</TableHead>
                        <TableHead className="font-bold">Payment Freq</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Enforce Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cases.map((item, index) => (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-slate-50/50 transition-colors group animate-slide-in-right"
                          style={{ animationDelay: `${index * 20}ms` }}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDisplayDate(item.submission_date_timestamp)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">
                            {item.policy_number}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-xs">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase">
                                {item.agent_id}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{item.client_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {item.product_type || "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatAFYC(item.premium)}
                          </TableCell>
                          <TableCell>
                            {item.payment_frequency ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <CreditCard className="h-3 w-3 mr-1" />
                                {item.payment_frequency}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={item.status === "approved" ? "approved" : "pending"}>
                              {item.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDisplayDate(item.enforce_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="p-4 border-t bg-slate-50/30">
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <p className="text-sm text-muted-foreground">
                      Total Cases Today: <span className="font-bold text-primary">{cases.length}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total AFYC: <span className="font-bold text-primary">{formatAFYC(calculateTotalPremium())}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Approved: <span className="font-bold text-green-600">{getApprovedCount()}</span> | 
                      Pending: <span className="font-bold text-amber-600">{getPendingCount()}</span>
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out forwards;
          opacity: 0;
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </DashboardLayout>
  );
}
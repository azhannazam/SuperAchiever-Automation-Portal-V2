import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Search, 
  Download, 
  FileText, 
  Loader2, 
  Calendar,
  X,
  ChevronDown,
  CreditCard,
  FileSpreadsheet,
  Sparkles,
  TrendingUp,
  Database,
  Clock,
  CheckCircle2,
  RefreshCw,
  Ban,
} from "lucide-react";
import { format, parseISO, isValid, subDays, subMonths, startOfToday, endOfToday, startOfMonth, endOfMonth } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

interface Filters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  status: string;
  search: string;
  datePreset?: string;
  paymentFrequency: string;
}

// Helper function to check if a status is declined or cancelled
const isDeclinedOrCancelled = (status: string): boolean => {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  return statusLower.includes('decline') || 
         statusLower.includes('cancel') ||
         statusLower === 'rejected';
};

// Helper function to check if a status should be included in AFYC calculation
// Only Approved/Inforce, Pending, and Postponed count towards AFYC
const isAFYCEligible = (status: string): boolean => {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  
  // Approved/Inforce statuses
  if (statusLower.includes('inforce') || 
      statusLower.includes('approved') || 
      statusLower.includes('issued')) {
    return true;
  }
  
  // Pending statuses
  if (statusLower.includes('pending') || 
      statusLower.includes('underwriting') || 
      statusLower.includes('counter') || 
      statusLower.includes('payment') ||
      statusLower === 'entered') {
    return true;
  }
  
  // Postponed status
  if (statusLower.includes('postponed')) {
    return true;
  }
  
  return false;
};

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

// Format AFYC/premium values
const formatAFYC = (value: number | null): string => {
  if (!value) return "0";
  return `${value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// Get status badge variant based on actual status text
const getStatusVariant = (status: string): "approved" | "pending" | "rejected" => {
  const statusLower = status.toLowerCase();
  
  // Check for approved/inforce statuses (Green)
  if (statusLower.includes('inforce') || 
      statusLower.includes('approved') || 
      statusLower.includes('issued') ||
      statusLower === 'inforce') {
    return "approved";
  }
  
  // Check for postponed (Orange/Yellow - pending category)
  if (statusLower.includes('postponed')) {
    return "pending";
  }
  
  // Check for pending statuses (Yellow)
  if (statusLower.includes('pending') || 
      statusLower.includes('underwriting') || 
      statusLower.includes('counter') || 
      statusLower.includes('payment') ||
      statusLower === 'entered') {
    return "pending";
  }
  
  // Check for declined/cancelled (Red)
  if (statusLower.includes('decline') || 
      statusLower.includes('cancel') ||
      statusLower.includes('reject')) {
    return "rejected";
  }
  
  // Default to pending
  return "pending";
};

// Get human-readable status label
const getStatusLabel = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('inforce')) return "Inforce";
  if (statusLower.includes('approved')) return "Approved";
  if (statusLower.includes('issued')) return "Issued";
  if (statusLower.includes('pending for underwriting')) return "Pending Underwriting";
  if (statusLower.includes('pending for payment')) return "Pending Payment";
  if (statusLower.includes('pending for counter offer')) return "Pending Counter Offer";
  if (statusLower.includes('postponed')) return "Postponed";
  if (statusLower.includes('reject')) return "Rejected";
  if (statusLower.includes('decline')) return "Declined";
  if (statusLower.includes('cancelled')) return "Cancelled";
  if (statusLower.includes('entered')) return "Entered";
  
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Date format for inputs
const formatDateInput = (date: Date | null): string => {
  if (!date) return "";
  return format(date, "dd.MM.yyyy");
};

const parseDateInput = (dateString: string): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return isValid(date) ? date : null;
  }
  return null;
};

const paymentFrequencyOptions = ["all", "Monthly", "Yearly", "Quarterly"];

export default function Cases() {
  const { user, role, isLoading } = useAuth();
  const [allCases, setAllCases] = useState<Case[]>([]); // ALL cases for stats
  const [displayCases, setDisplayCases] = useState<Case[]>([]); // Paginated cases for table
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    dateRange: { from: null, to: null },
    status: "all",
    search: "",
    datePreset: "any",
    paymentFrequency: "all"
  });
  const [dateInputs, setDateInputs] = useState({
    from: "",
    to: ""
  });
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  const PAGE_SIZE = 50;
  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) {
      fetchAllCases();
    }
  }, [user, role]);

  useEffect(() => {
    if (allCases.length > 0) {
      applyFiltersAndPaginate();
    }
  }, [allCases, filters, currentPage]);

  useEffect(() => {
    if (filters.dateRange.from) {
      setDateInputs(prev => ({ ...prev, from: formatDateInput(filters.dateRange.from) }));
    } else {
      setDateInputs(prev => ({ ...prev, from: "" }));
    }
    
    if (filters.dateRange.to) {
      setDateInputs(prev => ({ ...prev, to: formatDateInput(filters.dateRange.to) }));
    } else {
      setDateInputs(prev => ({ ...prev, to: "" }));
    }
  }, [filters.dateRange]);

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAllCases();
    toast.success("Data refreshed");
    setRefreshing(false);
  };

  const fetchAllCases = async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
      
      let query = supabase.from("cases").select("*");
      
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agent_code')
          .eq('id', user?.id)
          .maybeSingle();
        
        if (profile?.agent_code) {
          query = query.eq('agent_id', profile.agent_code);
        } else {
          setAllCases([]);
          setDisplayCases([]);
          setLoading(false);
          return;
        }
      }
      
      const { data, error } = await query.order("submission_date_timestamp", { ascending: false });
      
      if (error) throw error;
      
      setAllCases(data || []);
      setHasMore((data?.length || 0) > PAGE_SIZE);
      
    } catch (error) {
      console.error("Error fetching cases:", error);
      toast.error("Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndPaginate = () => {
    let filtered = [...allCases];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.policy_number?.toLowerCase().includes(searchLower) ||
          c.client_name?.toLowerCase().includes(searchLower) ||
          c.agent_id?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((c) => {
        const statusLower = c.status.toLowerCase();
        const filterLower = filters.status.toLowerCase();
        
        if (filterLower === 'inforce') {
          return statusLower.includes('inforce') || statusLower.includes('approved') || statusLower.includes('issued');
        } else if (filterLower === 'pending') {
          return statusLower.includes('pending') || statusLower.includes('underwriting') || statusLower.includes('counter') || statusLower.includes('payment') || statusLower === 'entered';
        } else if (filterLower === 'postponed') {
          return statusLower.includes('postponed');
        } else if (filterLower === 'declined') {
          return statusLower.includes('decline');
        } else if (filterLower === 'cancelled') {
          return statusLower.includes('cancel');
        }
        return c.status.toLowerCase() === filterLower;
      });
    }

    // Apply payment frequency filter
    if (filters.paymentFrequency !== "all") {
      filtered = filtered.filter((c) => c.payment_frequency === filters.paymentFrequency);
    }

    // Apply date range filter
    if (filters.dateRange.from) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        return caseDate ? caseDate >= filters.dateRange.from! : false;
      });
    }

    if (filters.dateRange.to) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        const endDate = new Date(filters.dateRange.to!);
        endDate.setDate(endDate.getDate() + 1);
        return caseDate ? caseDate <= endDate : false;
      });
    }

    // Apply pagination for display
    const start = 0;
    const end = currentPage * PAGE_SIZE;
    setDisplayCases(filtered.slice(start, end));
    setHasMore(filtered.length > end);
  };

  const loadMoreCases = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setCurrentPage(prev => prev + 1);
    setTimeout(() => setLoadingMore(false), 300);
  };

  const handleDatePreset = (preset: string) => {
    const today = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    switch (preset) {
      case "today":
        from = startOfToday();
        to = endOfToday();
        break;
      case "yesterday":
        from = subDays(startOfToday(), 1);
        to = subDays(endOfToday(), 1);
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "pastMonth":
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
      case "past3Months":
        from = subMonths(today, 3);
        to = today;
        break;
      default:
        from = null;
        to = null;
    }

    setFilters(prev => ({
      ...prev,
      dateRange: { from, to },
      datePreset: preset
    }));
    setCurrentPage(1);
  };

  const handleDateInputChange = (type: 'from' | 'to', value: string) => {
    setDateInputs(prev => ({ ...prev, [type]: value }));
    
    const date = parseDateInput(value);
    if (date) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [type]: date },
        datePreset: "custom"
      }));
      setCurrentPage(1);
    }
  };

  const handleDateInputBlur = (type: 'from' | 'to') => {
    if (!dateInputs[type]) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [type]: null },
        datePreset: "custom"
      }));
      setCurrentPage(1);
    }
  };

  const handleFromDateSelect = (date: Date | undefined) => {
    if (date) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, from: date },
        datePreset: "custom"
      }));
      setCurrentPage(1);
    }
    setFromCalendarOpen(false);
  };

  const handleToDateSelect = (date: Date | undefined) => {
    if (date) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, to: date },
        datePreset: "custom"
      }));
      setCurrentPage(1);
    }
    setToCalendarOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      status: "all",
      search: "",
      datePreset: "any",
      paymentFrequency: "all"
    });
    setDateInputs({ from: "", to: "" });
    setCurrentPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== "all") count++;
    if (filters.paymentFrequency !== "all") count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  };

  const getFilteredCases = () => {
    let filtered = [...allCases];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.policy_number?.toLowerCase().includes(searchLower) ||
          c.client_name?.toLowerCase().includes(searchLower) ||
          c.agent_id?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status !== "all") {
      filtered = filtered.filter((c) => {
        const statusLower = c.status.toLowerCase();
        const filterLower = filters.status.toLowerCase();
        
        if (filterLower === 'inforce') {
          return statusLower.includes('inforce') || statusLower.includes('approved') || statusLower.includes('issued');
        } else if (filterLower === 'pending') {
          return statusLower.includes('pending') || statusLower.includes('underwriting') || statusLower.includes('counter') || statusLower.includes('payment') || statusLower === 'entered';
        } else if (filterLower === 'postponed') {
          return statusLower.includes('postponed');
        } else if (filterLower === 'declined') {
          return statusLower.includes('decline');
        } else if (filterLower === 'cancelled') {
          return statusLower.includes('cancel');
        }
        return c.status.toLowerCase() === filterLower;
      });
    }

    if (filters.paymentFrequency !== "all") {
      filtered = filtered.filter((c) => c.payment_frequency === filters.paymentFrequency);
    }

    if (filters.dateRange.from) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        return caseDate ? caseDate >= filters.dateRange.from! : false;
      });
    }

    if (filters.dateRange.to) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        const endDate = new Date(filters.dateRange.to!);
        endDate.setDate(endDate.getDate() + 1);
        return caseDate ? caseDate <= endDate : false;
      });
    }

    return filtered;
  };

  const handleExportStyledExcel = () => {
    const filteredForExport = getFilteredCases();
    
    if (filteredForExport.length === 0) {
      toast.error("No data to export based on current filters.");
      return;
    }

    setExporting(true);

    try {
      const wb = XLSX.utils.book_new();

      const coverData = [
        ["SUPERACHIEVER"],
        ["All Cases Report"],
        [""],
        [`Report Generated: ${format(new Date(), "dd MMMM yyyy, HH:mm:ss")}`],
        [""],
        ["Filter Information"],
        [`Date Range: ${filters.dateRange.from ? format(filters.dateRange.from, "dd MMM yyyy") : "All"} - ${filters.dateRange.to ? format(filters.dateRange.to, "dd MMM yyyy") : "All"}`],
        [`Status: ${filters.status === "all" ? "All Status" : filters.status}`],
        [`Payment Frequency: ${filters.paymentFrequency === "all" ? "All Frequencies" : filters.paymentFrequency}`],
        [`Search Query: ${filters.search || "None"}`],
        [""],
        ["Report Summary"],
        [`Total Cases: ${filteredForExport.length}`],
        [`Total AFYC (Approved + Pending + Postponed): ${calculateTotalPremium(filteredForExport).toLocaleString()}`],
        [`Approved/Inforce Cases: ${filteredForExport.filter(c => getStatusVariant(c.status) === "approved").length}`],
        [`Pending Cases (incl. Postponed): ${filteredForExport.filter(c => getStatusVariant(c.status) === "pending").length}`],
        [`Declined/Cancelled Cases: ${filteredForExport.filter(c => isDeclinedOrCancelled(c.status)).length}`],
        [""],
        ["Prepared by: SuperAchiever System"],
        ["This report is auto-generated by SuperAchiever Data Management System"],
      ];
      
      const wsCover = XLSX.utils.aoa_to_sheet(coverData);
      wsCover['!cols'] = [{ wch: 50 }];
      XLSX.utils.book_append_sheet(wb, wsCover, "Cover");

      const exportData = filteredForExport.map((c, index) => ({
        "No.": index + 1,
        "Policy Number": c.policy_number,
        "Agent ID": c.agent_id,
        "Agent Name": c.client_name,
        "Product": c.product_type || "N/A",
        "AFYC (RM)": (c.premium || 0).toFixed(0),
        "Status": getStatusLabel(c.status),
        "Submission Date": c.submission_date_timestamp 
          ? format(parseDate(c.submission_date_timestamp) || new Date(), "dd MMM yyyy") 
          : "N/A",
        "Enforce Date": c.enforce_date 
          ? format(parseDate(c.enforce_date) || new Date(), "dd MMM yyyy") 
          : "N/A",
        "Payment Frequency": c.payment_frequency || "N/A",
        "Included in AFYC": isAFYCEligible(c.status) ? "Yes" : "No"
      }));

      const wsData = XLSX.utils.json_to_sheet(exportData);
      wsData['!cols'] = [
        { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, wsData, "All Cases");

      const approvedCount = filteredForExport.filter(c => getStatusVariant(c.status) === "approved").length;
      const pendingCount = filteredForExport.filter(c => getStatusVariant(c.status) === "pending").length;
      const declinedCancelledCount = filteredForExport.filter(c => isDeclinedOrCancelled(c.status)).length;
      
      const summaryData = [
        { "Metric": "Report Information", "Value": "" },
        { "Metric": "Report Date", "Value": format(new Date(), "dd MMMM yyyy") },
        { "Metric": "Report Time", "Value": format(new Date(), "HH:mm:ss") },
        { "Metric": "Generated By", "Value": user?.email || "System" },
        { "Metric": "", "Value": "" },
        { "Metric": "Production Summary", "Value": "" },
        { "Metric": "Total Cases", "Value": filteredForExport.length },
        { "Metric": "Total AFYC (Approved + Pending + Postponed)", "Value": `RM ${calculateTotalPremium(filteredForExport).toLocaleString()}` },
        { "Metric": "Average AFYC per Case", "Value": filteredForExport.length > 0 ? `RM ${Math.round(calculateTotalPremium(filteredForExport) / filteredForExport.length).toLocaleString()}` : "RM 0" },
        { "Metric": "", "Value": "" },
        { "Metric": "Status Breakdown", "Value": "" },
        { "Metric": "Approved/Inforce Cases", "Value": `${approvedCount} (${filteredForExport.length > 0 ? Math.round((approvedCount / filteredForExport.length) * 100) : 0}%)` },
        { "Metric": "Pending Cases (incl. Postponed)", "Value": `${pendingCount} (${filteredForExport.length > 0 ? Math.round((pendingCount / filteredForExport.length) * 100) : 0}%)` },
        { "Metric": "Declined/Cancelled Cases", "Value": `${declinedCancelledCount} (${filteredForExport.length > 0 ? Math.round((declinedCancelledCount / filteredForExport.length) * 100) : 0}%)` },
      ];
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 40 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      const dateStr = format(new Date(), "yyyyMMdd_HHmm");
      const filterStr = filters.status !== "all" ? `_${filters.status}` : "";
      const filename = `SuperAchiever_Cases_Report${filterStr}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      toast.success(`Exported ${filteredForExport.length} cases to beautifully formatted Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    const filteredForExport = getFilteredCases();
    
    if (filteredForExport.length === 0) {
      toast.error("No data to export based on current filters.");
      return;
    }

    const headers = [
      "Policy Number", "Agent ID", "Agent Name", "Product", "AFYC", 
      "Status", "Submission Date", "Enforce Date", "Payment Frequency", "Included in AFYC"
    ];
    
    const csvContent = [
      headers.join(","),
      ...filteredForExport.map(c => [
        c.policy_number,
        c.agent_id,
        `"${c.client_name.replace(/"/g, '""')}"`,
        `"${c.product_type || "N/A"}"`,
        (c.premium || 0).toFixed(0),
        getStatusLabel(c.status),
        c.submission_date_timestamp ? format(parseDate(c.submission_date_timestamp) || new Date(), "yyyy-MM-dd") : "N/A",
        c.enforce_date ? format(parseDate(c.enforce_date) || new Date(), "yyyy-MM-dd") : "N/A",
        c.payment_frequency || "N/A",
        isAFYCEligible(c.status) ? "Yes" : "No"
      ].join(","))
    ].join("\n");

    const dateStr = format(new Date(), "yyyyMMdd_HHmm");
    const filterStr = filters.status !== "all" ? `_${filters.status}` : "";
    const filename = `Cases_Report${filterStr}_${dateStr}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${filteredForExport.length} cases to CSV`);
  };

  const calculateTotalPremium = (casesToCalculate: Case[]) => {
    return casesToCalculate
      .filter(c => isAFYCEligible(c.status))
      .reduce((sum, c) => sum + (c.premium || 0), 0);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variant = getStatusVariant(status);
    const label = getStatusLabel(status);
    const isPostponed = status.toLowerCase().includes('postponed');
    
    const variantStyles = {
      approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: isPostponed ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-amber-100 text-amber-700 border-amber-200",
      rejected: "bg-rose-100 text-rose-700 border-rose-200"
    };
    
    const icons = {
      approved: <CheckCircle2 className="h-3 w-3 mr-1" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      rejected: <Ban className="h-3 w-3 mr-1" />
    };
    
    return (
      <Badge variant="outline" className={cn("font-medium", variantStyles[variant])}>
        {icons[variant]}
        {label}
      </Badge>
    );
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        </div>
        <p className="text-slate-500 font-medium animate-pulse">Loading Cases...</p>
      </div>
    </div>
  );
  
  if (!user) return <Navigate to="/auth" replace />;

  const filteredForStats = getFilteredCases();
  const totalCasesCount = filteredForStats.length;
  const approvedCount = filteredForStats.filter(c => getStatusVariant(c.status) === "approved").length;
  const pendingCount = filteredForStats.filter(c => getStatusVariant(c.status) === "pending").length;
  const declinedCancelledCount = filteredForStats.filter(c => isDeclinedOrCancelled(c.status)).length;
  const totalPremiumSum = calculateTotalPremium(filteredForStats);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 animate-slide-in-right">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  {isAdmin ? "Global Case Management" : "My Cases"}
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </h1>
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? "Full archive of all cases with advanced filtering" : "Your case history"}
                </p>
              </div>
            </div>
          </div>
          
          {isAdmin && filteredForStats.length > 0 && (
            <div className="flex items-center gap-2 animate-slide-in-left">
              <Button 
                variant="outline" 
                size="sm"
                onClick={refreshData}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button 
                onClick={handleExportStyledExcel} 
                disabled={exporting}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )} 
                Export Excel
              </Button>
              <Button 
                onClick={handleExportCSV} 
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" /> 
                CSV
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards - Now showing accurate counts from all cases */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-blue-100 p-3">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-blue-900">{totalCasesCount.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Total Cases</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-emerald-50 to-white" style={{ animationDelay: "0.1s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-emerald-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-900">{approvedCount.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Approved/Inforce</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-amber-50 to-white" style={{ animationDelay: "0.2s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-amber-100 p-3">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-amber-900">{pendingCount.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pending (incl. Postponed)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-rose-50 to-white" style={{ animationDelay: "0.3s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-rose-100 p-3">
                <Ban className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-rose-900">{declinedCancelledCount.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Declined/Cancelled</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-purple-50 to-white" style={{ animationDelay: "0.4s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-purple-100 p-3">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-purple-900">{formatAFYC(totalPremiumSum)}</p>
                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Total AFYC*</p>
                <p className="text-[6px] text-purple-400 mt-0.5">*Approved + Pending + Postponed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDatePreset("any")}>Any Date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("today")}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("yesterday")}>Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("thisMonth")}>This Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("pastMonth")}>Past Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("past3Months")}>Past 3 Months</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Input
                  placeholder="From"
                  value={dateInputs.from}
                  onChange={(e) => handleDateInputChange('from', e.target.value)}
                  onBlur={() => handleDateInputBlur('from')}
                  className="w-32 pr-8"
                />
                <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateRange.from || undefined}
                onSelect={handleFromDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Input
                  placeholder="To"
                  value={dateInputs.to}
                  onChange={(e) => handleDateInputChange('to', e.target.value)}
                  onBlur={() => handleDateInputBlur('to')}
                  className="w-32 pr-8"
                />
                <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateRange.to || undefined}
                onSelect={handleToDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {(filters.dateRange.from || filters.dateRange.to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, dateRange: { from: null, to: null } }))}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Policy, Client, or Agent ID..." 
              className="pl-10"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="inforce">Inforce / Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="postponed">Postponed</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.paymentFrequency} onValueChange={(value) => setFilters(prev => ({ ...prev, paymentFrequency: value }))}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Payment Frequency" />
            </SelectTrigger>
            <SelectContent>
              {paymentFrequencyOptions.map((freq) => (
                <SelectItem key={freq} value={freq}>
                  {freq === "all" ? "All Frequencies" : freq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {getActiveFilterCount() > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear ({getActiveFilterCount()})
            </Button>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex justify-between items-center animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 text-sm font-bold">
              <FileText className="h-3 w-3 mr-1" />
              {displayCases.length} of {filteredForStats.length} cases
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-sm font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
              <TrendingUp className="h-3 w-3 mr-1" />
              {formatAFYC(totalPremiumSum)}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-[8px] font-bold bg-purple-50 text-purple-600 border-purple-200">
              *AFYC includes Approved + Pending + Postponed only
            </Badge>
          </div>
          {filters.dateRange.from && filters.dateRange.to && (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(filters.dateRange.from, "dd MMM yyyy")} - {format(filters.dateRange.to, "dd MMM yyyy")}
            </div>
          )}
        </div>

        {/* Cases Table */}
        <Card className="border-none shadow-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Loading cases...</p>
              </div>
            ) : displayCases.length === 0 ? (
              <div className="py-20 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <FileText className="h-16 w-16 mx-auto text-slate-300 opacity-30" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-slate-200/50" />
                </div>
                <p className="text-lg font-semibold text-slate-400">No cases found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
                {getActiveFilterCount() > 0 && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-50 to-white">
                        <TableHead className="font-bold">Submission Date</TableHead>
                        <TableHead className="font-bold">Proposal No #</TableHead>
                        {isAdmin && <TableHead className="font-bold">Agent ID</TableHead>}
                        <TableHead className="font-bold">Agent Name</TableHead>
                        <TableHead className="font-bold">Product</TableHead>
                        <TableHead className="text-right font-bold">AFYC</TableHead>
                        <TableHead className="font-bold">Payment Frequency</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Enforce Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayCases.map((item, index) => (
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
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDisplayDate(item.enforce_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {hasMore && (
                  <div className="flex justify-center py-6 border-t">
                    <Button
                      variant="outline"
                      onClick={loadMoreCases}
                      disabled={loadingMore}
                      className="min-w-[200px] gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Load More Cases
                        </>
                      )}
                    </Button>
                  </div>
                )}
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
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
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
        .animate-slide-in-left {
          animation: slide-in-left 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </DashboardLayout>
  );
}
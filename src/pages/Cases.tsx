import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Download, 
  FileText, 
  Loader2, 
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
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
}

interface Filters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  status: string;
  search: string;
  datePreset?: string;
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

export default function Cases() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [displayedCases, setDisplayedCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    dateRange: { from: null, to: null },
    status: "all",
    search: "",
    datePreset: "any"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dateInputs, setDateInputs] = useState({
    from: "",
    to: ""
  });
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  const PAGE_SIZE = 50;
  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";
  const statusOptions = ["all", "approved", "pending", "rejected"];

  useEffect(() => {
    if (user) {
      fetchInitialCases();
    }
  }, [user, role]);

  useEffect(() => {
    if (cases.length > 0) {
      applyFilters();
    }
  }, [cases, filters]);

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

  const fetchInitialCases = async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
      
      // Get total count first
      const { count: totalCount, error: countError } = await supabase
        .from("cases")
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(totalCount || 0);
      console.log("📊 Total cases in database:", totalCount);

      // Fetch first page only
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("submission_date_timestamp", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;
      
      console.log(`📊 Fetched first page: ${data?.length} cases`);

      let finalCases = data || [];
      
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agent_code')
          .eq('id', user?.id)
          .maybeSingle();

        if (profile?.agent_code) {
          finalCases = (data || []).filter(c => c.agent_id === profile.agent_code);
        } else {
          setCases([]);
          setDisplayedCases([]);
          setFilteredCases([]);
          setLoading(false);
          return;
        }
      }

      setCases(finalCases);
      setHasMore((totalCount || 0) > PAGE_SIZE);
      
    } catch (error) {
      console.error("Error fetching cases:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCases = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const start = currentPage * PAGE_SIZE;
      const end = (nextPage * PAGE_SIZE) - 1;

      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("submission_date_timestamp", { ascending: false })
        .range(start, end);

      if (error) throw error;

      if (data && data.length > 0) {
        let newCases = data;
        
        // Apply role filtering if needed
        if (!isAdmin) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('agent_code')
            .eq('id', user?.id)
            .maybeSingle();

          if (profile?.agent_code) {
            newCases = data.filter(c => c.agent_id === profile.agent_code);
          }
        }

        const updatedCases = [...cases, ...newCases];
        setCases(updatedCases);
        setCurrentPage(nextPage);
        setHasMore((nextPage * PAGE_SIZE) < totalCount);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more cases:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...cases];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.policy_number?.toLowerCase().includes(searchLower) ||
          c.client_name?.toLowerCase().includes(searchLower) ||
          c.agent_id?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((c) => c.status === filters.status);
    }

    // Date range filter
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

    setFilteredCases(filtered);
    setDisplayedCases(filtered);
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
    }
  };

  const handleDateInputBlur = (type: 'from' | 'to') => {
    if (!dateInputs[type]) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, [type]: null },
        datePreset: "custom"
      }));
    }
  };

  const handleFromDateSelect = (date: Date | undefined) => {
    if (date) {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, from: date },
        datePreset: "custom"
      }));
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
    }
    setToCalendarOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      status: "all",
      search: "",
      datePreset: "any"
    });
    setDateInputs({ from: "", to: "" });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== "all") count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  };

  const handleExportCSV = () => {
    if (filteredCases.length === 0) {
      alert("No data to export based on current filters.");
      return;
    }

    const headers = [
      "Policy Number", 
      "Agent ID", 
      "Agent Name", 
      "Product", 
      "Premium (RM)", 
      "Status", 
      "Submission Date",
      "Enforce Date"
    ];
    
    const csvContent = [
      headers.join(","),
      ...filteredCases.map(c => [
        c.policy_number,
        c.agent_id,
        `"${c.client_name.replace(/"/g, '""')}"`,
        `"${c.product_type || "N/A"}"`,
        c.premium.toFixed(2),
        c.status,
        c.submission_date_timestamp ? format(parseDate(c.submission_date_timestamp) || new Date(), "yyyy-MM-dd") : "N/A",
        c.enforce_date ? format(parseDate(c.enforce_date) || new Date(), "yyyy-MM-dd") : "N/A"
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
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateTotalPremium = () => {
    return filteredCases.reduce((sum, c) => sum + (c.premium || 0), 0);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdmin ? "Global Case Management" : "My Cases"}
            </h1>
          </div>
          
          {isAdmin && (
            <Button 
              onClick={handleExportCSV} 
              className="flex gap-2"
              disabled={filteredCases.length === 0}
            >
              <Download className="h-4 w-4" /> 
              Export CSV
            </Button>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort By Date Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                Sort by Date
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Date Range</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDatePreset("any")}>
                Any Date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("today")}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("yesterday")}>
                Yesterday
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("thisMonth")}>
                This Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("pastMonth")}>
                Past Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDatePreset("past3Months")}>
                Past 3 Months
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* From Date with Calendar */}
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

          {/* To Date with Calendar */}
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

          {/* Clear Date Buttons */}
          {filters.dateRange.from && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: null } }))}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={isAdmin ? "Search by Policy, Client, or Agent ID..." : "Search by Policy or Client..."} 
              className="pl-10"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Status Filter */}
          <Select 
            value={filters.status} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "all" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters Button */}
          {getActiveFilterCount() > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex justify-between items-center">
          <div>
            <span className="text-lg font-semibold">Showing {filteredCases.length} of {totalCount}</span>
            <span className="text-muted-foreground ml-2">
              ${calculateTotalPremium().toLocaleString()}
            </span>
          </div>
          {filters.dateRange.from && filters.dateRange.to && (
            <div className="text-sm text-muted-foreground">
              {format(filters.dateRange.from, "MM-dd-yyyy")} - {format(filters.dateRange.to, "MM-dd-yyyy")}
            </div>
          )}
        </div>

        {/* Cases Table */}
        <Card className="border-none shadow-soft">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No records found matching your filters.</p>
                {getActiveFilterCount() > 0 && (
                  <Button variant="link" onClick={clearFilters}>
                    Clear filters to see all cases
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold">Submission Date</TableHead>
                      <TableHead className="font-bold">Proposal No #</TableHead>
                      {isAdmin && <TableHead className="font-bold">Agent ID</TableHead>}
                      <TableHead className="font-bold">Agent Name</TableHead>
                      <TableHead className="font-bold">Product</TableHead>
                      <TableHead className="text-right font-bold">Premium</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Enforce Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
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
                          ${Number(item.premium || 0).toLocaleString('en-MY', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
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

                {/* Load More Button */}
                {hasMore && filteredCases.length === cases.length && (
                  <div className="flex justify-center py-6 border-t">
                    <Button
                      variant="outline"
                      onClick={loadMoreCases}
                      disabled={loadingMore}
                      className="min-w-[200px]"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Show message when filters are applied but not all data is loaded */}
                {hasMore && filteredCases.length < cases.length && (
                  <div className="text-center py-4 text-sm text-muted-foreground border-t">
                    Filters are applied to currently loaded data. Load more to filter additional records.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
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
  Filter,
  Calendar,
  X,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
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

interface Case {
  id: string;
  policy_number: string;
  agent_id: string;
  client_name: string;
  product_type: string;
  premium: number;
  status: string;
  submission_date_timestamp: string;  // Changed from submission_date
  enforce_date: string | null;
}

interface Filters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  status: string;
  search: string;
}

// Helper function to safely parse dates
const parseDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  
  try {
    // Try parsing as ISO string first
    const date = parseISO(dateString);
    if (isValid(date)) return date;
    
    // Try parsing as timestamp
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
  
  // Check if it's the epoch (1970-01-01)
  if (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1) {
    return "Date not available";
  }
  
  return format(date, "dd MMM yyyy");
};

export default function Cases() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    dateRange: { from: null, to: null },
    status: "all",
    search: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";
  const statusOptions = ["all", "approved", "pending", "rejected"];

  useEffect(() => {
    if (user) fetchCases();
  }, [user, role]);

  // Apply filters whenever cases or filters change
  useEffect(() => {
    applyFilters();
  }, [cases, filters]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("cases")
        .select("*")
        .order("submission_date_timestamp", { ascending: false }); // Using timestamp column

      // If not admin, filter by agent_code
      if (!isAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("agent_code")
          .eq("id", user?.id)
          .maybeSingle();

        if (profile?.agent_code) {
          query = query.eq("agent_id", profile.agent_code);
        } else {
          setCases([]);
          setFilteredCases([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Log first few dates for debugging
      console.log("Sample dates from DB:", data?.slice(0, 3).map(c => ({
        submission: c.submission_date_timestamp,
        enforce: c.enforce_date
      })));
      
      setCases(data || []);
    } catch (error) {
      console.error("Error fetching cases:", error);
    } finally {
      setLoading(false);
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

    // Date range filter using submission_date_timestamp
    if (filters.dateRange.from) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        return caseDate ? caseDate >= filters.dateRange.from! : false;
      });
    }

    if (filters.dateRange.to) {
      filtered = filtered.filter((c) => {
        const caseDate = parseDate(c.submission_date_timestamp);
        // Add one day to include the end date
        const endDate = new Date(filters.dateRange.to!);
        endDate.setDate(endDate.getDate() + 1);
        return caseDate ? caseDate <= endDate : false;
      });
    }

    setFilteredCases(filtered);
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      status: "all",
      search: "",
    });
  };

  const handleDateSelect = (range: { from: Date | null; to: Date | null }) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range
    }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== "all") count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  };

  // CSV Export - uses filtered cases (respects current filters)
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
        `"${c.client_name.replace(/"/g, '""')}"`, // Escape quotes in names
        `"${c.product_type || "N/A"}"`,
        c.premium.toFixed(2),
        c.status,
        c.submission_date_timestamp ? format(parseDate(c.submission_date_timestamp) || new Date(), "yyyy-MM-dd") : "N/A",
        c.enforce_date ? format(parseDate(c.enforce_date) || new Date(), "yyyy-MM-dd") : "N/A"
      ].join(","))
    ].join("\n");

    // Generate filename with filter info
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdmin ? "Global Case Management" : "My Cases"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? `Showing ${filteredCases.length} of ${cases.length} submissions` 
                : "View and manage your policy submissions"}
            </p>
            {isAdmin && filters.dateRange.from && (
              <p className="text-sm text-primary mt-1">
                📅 Showing submissions from {filters.dateRange.from ? format(filters.dateRange.from, "dd MMM yyyy") : "any"} 
                {filters.dateRange.to ? ` to ${format(filters.dateRange.to, "dd MMM yyyy")}` : ""}
              </p>
            )}
          </div>
          
          {isAdmin && (
            <Button 
              onClick={handleExportCSV} 
              className="flex gap-2"
              disabled={filteredCases.length === 0}
            >
              <Download className="h-4 w-4" /> 
              Export {filteredCases.length} Records
            </Button>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="border-none shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={isAdmin ? "Search by Policy, Client, or Agent ID..." : "Search by Policy or Client..."} 
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              
              {/* Filter Button */}
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                    {getActiveFilterCount() > 0 && (
                      <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-primary">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium">Filter Cases</h4>
                    
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select 
                        value={filters.status} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status === "all" ? "All Statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter - Using submission_date_timestamp */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Submission Date Range</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {filters.dateRange.from ? (
                              filters.dateRange.to ? (
                                <>
                                  {format(filters.dateRange.from, "dd MMM yyyy")} -{" "}
                                  {format(filters.dateRange.to, "dd MMM yyyy")}
                                </>
                              ) : (
                                format(filters.dateRange.from, "dd MMM yyyy")
                              )
                            ) : (
                              "Select date range"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="range"
                            selected={{
                              from: filters.dateRange.from || undefined,
                              to: filters.dateRange.to || undefined
                            }}
                            onSelect={(range) => handleDateSelect({
                              from: range?.from || null,
                              to: range?.to || null
                            })}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Clear Filters */}
                    {getActiveFilterCount() > 0 && (
                      <Button 
                        variant="ghost" 
                        className="w-full mt-2"
                        onClick={clearFilters}
                      >
                        <X className="h-4 w-4 mr-2" /> Clear All Filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Active Filter Badges */}
            {getActiveFilterCount() > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.search && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {filters.search}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, search: "" }))}
                    />
                  </Badge>
                )}
                {filters.status !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {filters.status}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ ...prev, status: "all" }))}
                    />
                  </Badge>
                )}
                {filters.dateRange.from && (
                  <Badge variant="secondary" className="gap-1">
                    From: {format(filters.dateRange.from, "dd MMM yyyy")}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ 
                        ...prev, 
                        dateRange: { from: null, to: prev.dateRange.to }
                      }))}
                    />
                  </Badge>
                )}
                {filters.dateRange.to && (
                  <Badge variant="secondary" className="gap-1">
                    To: {format(filters.dateRange.to, "dd MMM yyyy")}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setFilters(prev => ({ 
                        ...prev, 
                        dateRange: { from: prev.dateRange.from, to: null }
                      }))}
                    />
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>

          {/* Cases Table */}
          <CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">Submission Date</TableHead>
                    <TableHead className="font-bold">Enforce Date</TableHead>
                    <TableHead className="font-bold">Policy #</TableHead>
                    {isAdmin && <TableHead className="font-bold">Agent ID</TableHead>}
                    <TableHead className="font-bold">Agent Name</TableHead>
                    <TableHead className="font-bold">Product</TableHead>
                    <TableHead className="text-right font-bold">Premium (RM)</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDate(item.submission_date_timestamp)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDate(item.enforce_date)}
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
                        {Number(item.premium || 0).toLocaleString('en-MY', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={item.status === "approved" ? "approved" : "pending"}>
                          {item.status}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
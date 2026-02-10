import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Loader2, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

interface CaseData {
  id: string;
  policy_number: string;
  client_name: string;
  product_type: string | null;
  premium: number | null;
  status: "approved" | "pending";
  submission_date: string;
  approval_date: string | null;
}

export default function Cases() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchCases();
    }
  }, [user]);

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setCases(data);
    } catch (error) {
      console.error("Error fetching cases:", error);
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

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.policy_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.product_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && c.status === activeTab;
  });

  const approvedCount = cases.filter((c) => c.status === "approved").length;
  const pendingCount = cases.filter((c) => c.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
            <p className="text-muted-foreground">
              {role === "admin" ? "Manage all submitted cases" : "View your submitted cases"}
            </p>
          </div>
          
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cases.length}</p>
                <p className="text-sm text-muted-foreground">Total Cases</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-success/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-warning/10 p-3">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cases table */}
        <Card className="shadow-soft">
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({cases.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No cases found</p>
                <p className="text-sm">
                  {searchQuery ? "Try adjusting your search" : "Cases will appear here once submitted"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy Number</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((caseItem) => (
                      <TableRow key={caseItem.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium font-mono">
                          {caseItem.policy_number}
                        </TableCell>
                        <TableCell>{caseItem.client_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {caseItem.product_type || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {caseItem.premium
                            ? `RM ${caseItem.premium.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(caseItem.submission_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={caseItem.status === "approved" ? "approved" : "pending"}
                            icon={
                              caseItem.status === "approved" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )
                            }
                          >
                            {caseItem.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

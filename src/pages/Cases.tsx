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
import { Search, Download, FileText, Loader2, Filter } from "lucide-react";
import { format } from "date-fns";

export default function Cases() {
  const { user, role, isLoading } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchCases();
  }, [user, role]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      let query = (supabase.from("cases") as any).select("*");

      // LOGIC FORK: If not admin, filter by agent_code
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
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.order("submission_date", { ascending: false });
      if (error) throw error;
      setCases(data || []);
    } catch (error) {
      console.error("Error fetching cases:", error);
    } finally {
      setLoading(false);
    }
  };

  // CSV Export Logic for Admin
  const handleExportCSV = () => {
    const headers = ["Policy Number", "Agent ID", "Agent Name", "Product", "Premium", "Status", "Date"];
    const csvContent = [
      headers.join(","),
      ...cases.map(c => [
        c.policy_number,
        c.agent_id,
        `"${c.client_name}"`, // Quote names to handle commas
        c.product_type,
        c.premium,
        c.status,
        format(new Date(c.submission_date), "yyyy-MM-dd")
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `All_Cases_Report_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCases = cases.filter(c => 
    c.policy_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.agent_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdmin ? "Global Case Management" : "My Cases"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? `Viewing all ${cases.length} submissions in the system` : "View and manage your policy submissions"}
            </p>
          </div>
          
          {isAdmin && (
            <Button onClick={handleExportCSV} className="flex gap-2">
              <Download className="h-4 w-4" /> Export All to CSV
            </Button>
          )}
        </div>

        <Card className="border-none shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={isAdmin ? "Search Policy, Client, or Agent ID..." : "Search Policy or Client..."} 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>
            ) : filteredCases.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No records found matching your search.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Policy #</TableHead>
                    {isAdmin && <TableHead className="font-bold">Agent ID</TableHead>}
                    <TableHead className="font-bold">Agent Name</TableHead>
                    <TableHead className="font-bold">Product</TableHead>
                    <TableHead className="text-right font-bold">Premium</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.submission_date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{item.policy_number}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-xs">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase">
                            {item.agent_id}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{item.client_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.product_type || "N/A"}</TableCell>
                      <TableCell className="text-right font-bold">
                        RM {Number(item.premium || 0).toLocaleString()}
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
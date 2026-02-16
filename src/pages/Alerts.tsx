import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle2, Loader2, Clock, Calendar, ShieldCheck, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Alerts() {
  const { user, role, isLoading } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, role]);

  const fetchAlerts = async () => {
    try {
      setLoadingData(true);
      if (isAdmin) {
        const { data, error } = await (supabase.from("cases") as any)
          .select("*")
          .eq("status", "pending")
          .order("submission_date", { ascending: false });

        if (error) throw error;
        const mapped = (data || []).map((c: any) => ({
          id: c.id,
          title: `Pending Approval: ${c.policy_number}`,
          message: `Agent ${c.agent_id} submitted for ${c.client_name} (RM ${Number(c.premium || 0).toLocaleString()}).`,
          created_at: c.submission_date,
          is_read: false,
          agent_id: c.agent_id
        }));
        setAlerts(mapped);
      } else {
        const { data, error } = await (supabase.from("alerts") as any)
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAlerts(data || []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    if (isAdmin) return;
    try {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      toast.success("Marked as read");
    } catch (error) { toast.error("Update failed"); }
  };

  // NEW: Mark All As Read Logic
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("user_id", user?.id).eq("is_read", false);
      if (error) throw error;
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      toast.success("All alerts cleared");
    } catch (error) { toast.error("Failed to clear alerts"); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const filteredAlerts = activeTab === "unread" ? alerts.filter(a => !a.is_read) : alerts;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-7 w-7 text-warning" />
              {isAdmin ? "Global Action Center" : "My Alerts"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdmin ? "Managing global pending cases" : "Personal policy and sync updates"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* NEW: Top Button */}
            {!isAdmin && unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead} className="hidden sm:flex border-primary text-primary hover:bg-primary/5">
                <Check className="mr-2 h-4 w-4" /> Mark all as read
              </Button>
            )}
            <Badge className="px-6 py-2 text-sm font-black bg-slate-800 text-white border-none shadow-md uppercase tracking-wider">
               Status: {isAdmin ? "System Admin" : "Existing Agent"}
            </Badge>
          </div>
        </header>

        {/* Action Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-soft">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-primary/10 p-3"><Bell className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-2xl font-black">{alerts.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isAdmin ? "Pending Approval" : "Total Alerts"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-soft">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-warning/10 p-3"><Clock className="h-6 w-6 text-warning" /></div>
              <div>
                <p className="text-2xl font-black">{isAdmin ? alerts.length : unreadCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isAdmin ? "To-Action" : "Unread"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-soft">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-success/10 p-3"><ShieldCheck className="h-6 w-6 text-success" /></div>
              <div>
                <p className="text-2xl font-black">Online</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Status</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-soft border-none">
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-100/50">
                <TabsTrigger value="all" className="font-bold">All Alerts</TabsTrigger>
                {!isAdmin && <TabsTrigger value="unread" className="font-bold">Unread ({unreadCount})</TabsTrigger>}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20 text-success" />
                <p className="font-bold text-slate-400 text-sm">All Caught Up</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border p-5 transition-all ${alert.is_read ? 'bg-white border-slate-100 opacity-60' : 'bg-white border-primary/10 shadow-sm'}`}>
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-2 bg-amber-50 rounded-lg shrink-0"><Clock className="h-5 w-5 text-amber-500" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{alert.title}</p>
                          {isAdmin && <Badge variant="secondary" className="text-[9px] font-black">{alert.agent_id}</Badge>}
                          {!isAdmin && !alert.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2">{alert.message}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5 uppercase">
                          <Calendar className="h-3 w-3" /> {format(new Date(alert.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    
                    {/* ENHANCED: Highly Visible Button */}
                    {!isAdmin && !alert.is_read && (
                      <Button 
                        size="sm" 
                        onClick={() => markAsRead(alert.id)} 
                        className="bg-primary text-white hover:bg-primary/90 font-bold text-xs px-4"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
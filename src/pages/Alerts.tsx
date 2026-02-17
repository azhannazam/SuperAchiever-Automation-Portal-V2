import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bell, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  Check, 
  AlertTriangle, 
  AlertOctagon, 
  Send 
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
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
        // ADMIN: Stale Case Monitor
        const { data, error } = await (supabase.from("cases") as any)
          .select("*")
          .eq("status", "pending")
          .order("submission_date", { ascending: true });

        if (error) throw error;
        setAlerts(data || []);
      } else {
        // AGENT: Regular Notifications
        const { data, error } = await (supabase.from("alerts") as any)
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        // Logic: Identify if alert is a Case Follow-up or General Message
        const mappedData = (data || []).map(a => ({
          ...a,
          isCaseAlert: a.title.toLowerCase().includes("pending") || a.title.toLowerCase().includes("policy")
        }));
        setAlerts(mappedData);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      toast.success("Marked as read");
    } catch (error) { toast.error("Update failed"); }
  };

  const notifyAgent = async (caseItem: any, dayCount: number) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("id").eq("agent_id", caseItem.agent_id).single();
      if (!profile) return toast.error("Agent profile not found");

      await supabase.from("alerts").insert({
        user_id: profile.id,
        title: `⚠️ Pending Follow-up: Day ${dayCount}`,
        message: `Policy ${caseItem.policy_number} for ${caseItem.client_name} is still pending after ${dayCount} days.`,
        is_read: false
      });
      toast.success(`Reminder sent to Agent ${caseItem.agent_id}`);
    } catch (err) { toast.error("Failed to notify agent"); }
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
              {isAdmin ? "Stale Case Monitor" : "My Alerts"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdmin ? "Tracking cases that require agent follow-up" : "Personal policy and sync updates"}
            </p>
          </div>

          <Badge className="px-6 py-2 text-sm font-black bg-slate-800 text-white border-none shadow-md uppercase tracking-wider">
             Status: {isAdmin ? "System Admin" : "Existing Agent"}
          </Badge>
        </header>

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
                <TabsTrigger value="all" className="font-bold">All {isAdmin ? "Pending" : "Alerts"}</TabsTrigger>
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
                {filteredAlerts.map((item) => {
                  const itemDate = isAdmin ? (item.submission_date || item.created_at) : item.created_at;
                  const daysPending = differenceInDays(new Date(), new Date(itemDate));
                  
                  // NEW: Only color code if it's a Case Alert, NOT for Welcome/Sync messages
                  const isWarning = (isAdmin || item.isCaseAlert) && daysPending >= 3 && daysPending < 7;
                  const isCritical = (isAdmin || item.isCaseAlert) && daysPending >= 7;

                  return (
                    <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border p-5 transition-all 
                      ${isCritical ? 'border-destructive/30 bg-destructive/5' : 
                        isWarning ? 'border-warning/30 bg-warning/5' : 
                        'bg-white border-slate-100'}`}>
                      
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-2 rounded-lg shrink-0 ${isCritical ? 'bg-destructive/10' : isWarning ? 'bg-warning/10' : 'bg-amber-50'}`}>
                           {isCritical ? <AlertOctagon className="h-5 w-5 text-destructive" /> : 
                            isWarning ? <AlertTriangle className="h-5 w-5 text-warning" /> : 
                            <Clock className="h-5 w-5 text-amber-500" />}
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-black text-sm text-slate-800 uppercase tracking-tight">
                              {isAdmin ? item.policy_number : item.title}
                            </p>
                            {(isAdmin || item.isCaseAlert) && (
                              <Badge variant="secondary" className="text-[9px] font-black uppercase">
                                {daysPending} Days Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            {isAdmin ? `Agent ${item.agent_id} | Client: ${item.client_name}` : item.message}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5 uppercase">
                            <Calendar className="h-3 w-3" /> {format(new Date(itemDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      
                      {/* ACTION BUTTONS */}
                      {isAdmin ? (
                        daysPending >= 3 && (
                          <Button size="sm" onClick={() => notifyAgent(item, daysPending)} className="font-bold gap-2">
                            <Send className="h-4 w-4" /> Notify Agent
                          </Button>
                        )
                      ) : (
                        !item.is_read && (
                          <Button 
                            size="sm" 
                            onClick={() => markAsRead(item.id)} 
                            className="bg-primary text-white hover:bg-primary/90 font-bold text-xs px-4"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as read
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
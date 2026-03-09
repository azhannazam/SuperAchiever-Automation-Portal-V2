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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bell, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  Calendar, 
  ShieldCheck, 
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

  // --- POPUP STATES ---
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState("");

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, role]);

  const fetchAlerts = async () => {
    try {
      setLoadingData(true);
      if (isAdmin) {
        // ADMIN: Fetches 'pending' cases (the 70 cases from your dashboard)
        const { data, error } = await supabase
          .from("cases")
          .select("*")
          .eq("status", "pending")
          .order("submission_date_timestamp", { ascending: false });

        if (error) throw error;
        setAlerts(data || []);
      } else {
        // AGENT: Personal notifications
        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAlerts(data || []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load alerts");
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

  const openNotifyPopup = (caseItem: any) => {
    setSelectedCase(caseItem);
    setCustomMessage("");
    setIsNotifyOpen(true);
  };

  const handleSendNotification = async () => {
    const wordCount = customMessage.trim() === "" ? 0 : customMessage.trim().split(/\s+/).length;
    if (wordCount > 50) return toast.error("Message exceeds 50 words!");

    try {
      const { data: profile } = await supabase.from("profiles").select("id").eq("agent_code", selectedCase.agent_id).single();
      if (!profile) return toast.error("Agent profile not found");

      const days = differenceInDays(new Date(), new Date(selectedCase.submission_date_timestamp));

      await supabase.from("alerts").insert({
        user_id: profile.id,
        title: `⚠️ Admin Follow-up: ${selectedCase.policy_number}`,
        message: customMessage || `Proposal for ${selectedCase.client_name} is still ${selectedCase.remark} after ${days} days.`,
        is_read: false
      });

      toast.success(`Reminder sent to Agent ${selectedCase.agent_id}`);
      setIsNotifyOpen(false);
    } catch (err) { toast.error("Failed to notify agent"); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const filteredAlerts = activeTab === "unread" ? alerts.filter(a => !a.is_read) : alerts;
  const currentWordCount = customMessage.trim() === "" ? 0 : customMessage.trim().split(/\s+/).length;

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
              {isAdmin ? "Tracking cases requiring agent follow-up" : "Personal policy updates"}
            </p>
          </div>
          <Badge className="px-6 py-2 text-sm font-black bg-slate-800 text-white uppercase tracking-wider">
              Status: {isAdmin ? "System Admin" : "Existing Agent"}
          </Badge>
        </header>

        {/* --- STATS CARDS --- */}
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
                <p className="text-2xl font-black">Active</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Sync</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- MAIN CONTENT --- */}
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
                <p className="font-bold text-slate-400 text-sm">All Clear</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((item) => {
                  const itemDate = isAdmin ? (item.submission_date_timestamp) : item.created_at;
                  const daysPending = differenceInDays(new Date(), new Date(itemDate));
                  const isCritical = daysPending >= 7;
                  const isWarning = daysPending >= 3 && daysPending < 7;

                  return (
                    <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border p-5 transition-all 
                      ${isCritical ? 'border-destructive/30 bg-destructive/5' : isWarning ? 'border-warning/30 bg-warning/5' : 'bg-white border-slate-100'}`}>
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-2 rounded-lg shrink-0 ${isCritical ? 'bg-destructive/10' : isWarning ? 'bg-warning/10' : 'bg-amber-50'}`}>
                           {isCritical ? <AlertOctagon className="h-5 w-5 text-destructive" /> : isWarning ? <AlertTriangle className="h-5 w-5 text-warning" /> : <Clock className="h-5 w-5 text-amber-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-black text-base text-slate-800 uppercase tracking-tight">
                              {isAdmin ? `Prop: ${item.policy_number}` : item.title}
                            </p>
                            <Badge variant="secondary" className="text-[10px] font-black uppercase">
                              {daysPending} Days {isAdmin ? 'Stale' : 'Ago'}
                            </Badge>
                          </div>
                          {isAdmin ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <p className="text-slate-600"><span className="font-bold text-[10px] text-slate-400 uppercase mr-1">Agent Name:</span> {item.client_name}</p>
                              <p className="text-slate-600"><span className="font-bold text-[10px] text-slate-400 uppercase mr-1">Agent Code:</span> {item.agent_id}</p>
                              <p className="text-slate-600"><span className="font-bold text-[10px] text-slate-400 uppercase mr-1">Submission Date:</span> {item.submission_date_timestamp ? format(new Date(item.submission_date_timestamp), "dd/MM/yyyy") : "N/A"}</p>
                              <p className="text-destructive font-bold italic">
                                <span className="font-bold text-[10px] text-slate-400 uppercase not-italic mr-1">Status:</span> 
                                {item.remark || "Action Required"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">{item.message}</p>
                          )}
                        </div>
                      </div>
                      {isAdmin ? (
                        <Button size="sm" onClick={() => openNotifyPopup(item)} className="font-bold gap-2"><Send className="h-4 w-4" /> Notify</Button>
                      ) : (
                        !item.is_read && <Button size="sm" onClick={() => markAsRead(item.id)} className="font-bold text-xs"><CheckCircle2 className="mr-2 h-4 w-4" /> Mark Read</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- NOTIFY DIALOG --- */}
        <Dialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen}>
          <DialogContent className="sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Notify {selectedCase?.client_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Follow-up Message</p>
              <Textarea 
                placeholder="Type instructions..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className={`text-[10px] font-bold ${currentWordCount > 50 ? 'text-destructive' : 'text-slate-400'}`}>
                Words: {currentWordCount} / 50
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNotifyOpen(false)}>Cancel</Button>
              <Button onClick={handleSendNotification} disabled={currentWordCount > 50}>Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
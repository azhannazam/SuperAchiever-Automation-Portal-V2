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
  Send,
  Sparkles,
  TrendingUp,
  Zap,
  RefreshCw,
  Mail,
  MailCheck,
  MailOpen,
  X,
  Hourglass,
  Flame,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Helper function to check if a status is pending
const isPendingStatus = (status: string): boolean => {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  return statusLower.includes('pending') || 
         statusLower.includes('underwriting') || 
         statusLower.includes('counter') || 
         statusLower.includes('payment') ||
         statusLower === 'entered';
};

// Info icon component
const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function Alerts() {
  const { user, role, isLoading } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // --- POPUP STATES ---
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState("");

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  // Calculate word count
  const currentWordCount = customMessage.trim() === "" ? 0 : customMessage.trim().split(/\s+/).length;

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, role]);

  const fetchAlerts = async (showToast = false) => {
    try {
      setLoadingData(true);
      if (isAdmin) {
        // Fetch ALL cases first, then filter for pending statuses
        const { data, error } = await supabase
          .from("cases")
          .select("*")
          .order("submission_date_timestamp", { ascending: false });

        if (error) throw error;
        
        // Filter for pending statuses (case insensitive)
        const pendingCases = (data || []).filter(caseItem => isPendingStatus(caseItem.status));
        setAlerts(pendingCases);
        
        if (showToast) toast.success(`Found ${pendingCases.length} pending cases`);
      } else {
        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAlerts(data || []);
        if (showToast) toast.success(`${data?.length || 0} alerts loaded`);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoadingData(false);
    }
  };

  const refreshAlerts = async () => {
    setRefreshing(true);
    await fetchAlerts(true);
    setRefreshing(false);
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      toast.success("Marked as read");
    } catch (error) { 
      toast.error("Update failed"); 
    }
  };

  const markAllAsRead = async () => {
    const unreadAlerts = alerts.filter(a => !a.is_read);
    if (unreadAlerts.length === 0) {
      toast.info("No unread alerts");
      return;
    }
    
    try {
      for (const alert of unreadAlerts) {
        await supabase.from("alerts").update({ is_read: true }).eq("id", alert.id);
      }
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      toast.success(`Marked ${unreadAlerts.length} alerts as read`);
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const openNotifyPopup = (caseItem: any) => {
    setSelectedCase(caseItem);
    setCustomMessage("");
    setIsNotifyOpen(true);
  };

  const handleSendNotification = async () => {
    if (currentWordCount > 50) return toast.error("Message exceeds 50 words!");

    try {
      const { data: profile } = await supabase.from("profiles").select("id").eq("agent_code", selectedCase.agent_id).single();
      if (!profile) return toast.error("Agent profile not found");

      const days = differenceInDays(new Date(), new Date(selectedCase.submission_date_timestamp));

      await supabase.from("alerts").insert({
        user_id: profile.id,
        title: `⚠️ Admin Follow-up: ${selectedCase.policy_number}`,
        message: customMessage || `Proposal for ${selectedCase.client_name} is still ${selectedCase.status} after ${days} days.`,
        is_read: false
      });

      toast.success(`Reminder sent to Agent ${selectedCase.agent_id}`);
      setIsNotifyOpen(false);
    } catch (err) { 
      toast.error("Failed to notify agent"); 
    }
  };

  // Calculate stats for admin dashboard
  const totalPending = alerts.length;
  const pendingLessThan3Days = alerts.filter(item => {
    const daysPending = differenceInDays(new Date(), new Date(item.submission_date_timestamp));
    return daysPending < 3;
  }).length;
  const urgentCases = alerts.filter(item => {
    const daysPending = differenceInDays(new Date(), new Date(item.submission_date_timestamp));
    return daysPending > 7;
  }).length;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        </div>
        <p className="text-slate-500 font-medium animate-pulse">Loading Alerts Center...</p>
      </div>
    </div>
  );
  
  if (!user) return <Navigate to="/auth" replace />;

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const filteredAlerts = activeTab === "unread" ? alerts.filter(a => !a.is_read) : alerts;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header with Animation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 animate-slide-in-right">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <Bell className="h-8 w-8 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  {isAdmin ? "Stale Case Monitor" : "My Alerts"}
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </h1>
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? "Tracking cases requiring agent follow-up" : "Personal policy updates and notifications"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 animate-slide-in-left">
            <Badge className="px-4 py-2 text-xs font-black bg-gradient-to-r from-slate-800 to-slate-900 text-white uppercase tracking-wider shadow-lg">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Status: {isAdmin ? "System Admin" : "Existing Agent"}
            </Badge>
          </div>
        </div>

        {/* --- STATS CARDS with Animation --- */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-blue-100 p-3 group-hover:scale-110 transition-transform duration-300">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-blue-900">{totalPending}</p>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Total Pending Cases</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-orange-50 to-white" style={{ animationDelay: "0.1s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-orange-100 p-3 group-hover:scale-110 transition-transform duration-300">
                <Hourglass className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-orange-900">{pendingLessThan3Days}</p>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Under Review (&lt; 3 days)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-red-50 to-white" style={{ animationDelay: "0.2s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-red-100 p-3 group-hover:scale-110 transition-transform duration-300">
                <Flame className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-red-900">{urgentCases}</p>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Urgent (&gt; 7 days)</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-up bg-gradient-to-br from-emerald-50 to-white" style={{ animationDelay: "0.3s" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-emerald-100 p-3 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-900">Active</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Database Sync</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- MAIN CONTENT --- */}
        <Card className="shadow-xl border-none overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                <TabsList className="bg-slate-100/50 p-1">
                  <TabsTrigger value="all" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
                    <Mail className="h-4 w-4 mr-2" />
                    All {isAdmin ? "Pending" : "Alerts"}
                  </TabsTrigger>
                  {!isAdmin && (
                    <TabsTrigger value="unread" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
                      <MailOpen className="h-4 w-4 mr-2" />
                      Unread ({unreadCount})
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-2">
                {!isAdmin && unreadCount > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={markAllAsRead}
                    className="gap-2 hover:bg-primary/5 transition-all duration-300"
                  >
                    <MailCheck className="h-4 w-4" />
                    Mark All Read
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshAlerts}
                  disabled={refreshing}
                  className="gap-2 hover:bg-primary/5 transition-all duration-300"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Loading alerts...</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <ShieldCheck className="h-16 w-16 mx-auto text-emerald-300 opacity-30" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-200/50" />
                </div>
                <p className="text-lg font-semibold text-slate-400">All Clear!</p>
                <p className="text-sm text-slate-400 mt-1">No {isAdmin ? "pending cases" : "unread alerts"} at this time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAlerts.map((item, index) => {
                  const itemDate = isAdmin ? item.submission_date_timestamp : item.created_at;
                  const daysPending = differenceInDays(new Date(), new Date(itemDate));
                  const isCritical = daysPending >= 7;
                  const isWarning = daysPending >= 3 && daysPending < 7;
                  
                  // Get display status
                  const displayStatus = isAdmin ? item.status : item.title;
                  const statusLabel = isAdmin ? 
                    (item.status || "Pending").charAt(0).toUpperCase() + (item.status || "pending").slice(1) : 
                    "Alert";

                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-500 hover:shadow-xl animate-slide-in-right",
                        isCritical ? 'border-red-200 bg-gradient-to-r from-red-50/50 to-white' : 
                        isWarning ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white' : 
                        'border-slate-100 bg-white hover:border-primary/20',
                        "hover:scale-[1.01]"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      
                      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={cn(
                            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
                            isCritical ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-amber-50'
                          )}>
                            {isCritical ? 
                              <AlertOctagon className="h-5 w-5 text-red-600 animate-pulse" /> : 
                              isWarning ? 
                              <AlertTriangle className="h-5 w-5 text-amber-600" /> : 
                              <Clock className="h-5 w-5 text-amber-500" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <p className="font-black text-base text-slate-800 uppercase tracking-tight">
                                {isAdmin ? `Prop: ${item.policy_number}` : item.title}
                              </p>
                              <Badge className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5",
                                isCritical ? 'bg-red-100 text-red-700' : 
                                isWarning ? 'bg-amber-100 text-amber-700' : 
                                'bg-slate-100 text-slate-600'
                              )}>
                                {daysPending} Days {isAdmin ? 'Pending' : 'Ago'}
                              </Badge>
                              {isAdmin && (
                                <Badge className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5">
                                  {statusLabel}
                                </Badge>
                              )}
                            </div>
                            {isAdmin ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Agent Name:</span>
                                  <span className="font-medium text-slate-700">{item.client_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Agent Code:</span>
                                  <span className="font-mono text-xs font-bold text-primary">{item.agent_id}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Submission:</span>
                                  <span className="text-xs text-slate-600">
                                    {item.submission_date_timestamp ? format(new Date(item.submission_date_timestamp), "dd MMM yyyy") : "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  <span className="text-[10px] font-bold text-amber-500 uppercase">Status:</span>
                                  <span className="text-xs font-medium text-amber-600">{item.status || "Pending"}</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
                                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(item.created_at), "dd MMM yyyy, hh:mm a")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {isAdmin ? (
                          <Button 
                            size="sm" 
                            onClick={() => openNotifyPopup(item)} 
                            className="font-bold gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                          >
                            <Send className="h-4 w-4" /> 
                            Notify Agent
                          </Button>
                        ) : (
                          !item.is_read && (
                            <Button 
                              size="sm" 
                              onClick={() => markAsRead(item.id)} 
                              variant="outline"
                              className="font-bold gap-2 border-primary/20 text-primary hover:bg-primary/5 transition-all duration-300"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> 
                              Mark Read
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- NOTIFY DIALOG with Animation --- */}
        <Dialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen}>
          <DialogContent className="sm:max-w-[425px] bg-white animate-in zoom-in-95 fade-in-0 duration-300">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="h-1 w-8 rounded-full bg-gradient-to-r from-primary to-primary/40" />
                <Send className="h-5 w-5 text-primary" />
                Notify {selectedCase?.client_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <InfoIcon className="h-3 w-3" />
                  Case: {selectedCase?.policy_number}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Status: {selectedCase?.status}
                </p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Mail className="h-3 w-3" />
                Follow-up Message
              </p>
              <Textarea 
                placeholder="Type your message to the agent..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="min-h-[120px] resize-none focus:ring-2 focus:ring-primary/20 transition-all duration-300"
              />
              <div className="flex justify-between items-center">
                <p className={cn(
                  "text-[10px] font-bold transition-colors duration-300",
                  currentWordCount > 50 ? 'text-red-500' : 'text-slate-400'
                )}>
                  Words: {currentWordCount} / 50
                </p>
                {currentWordCount > 0 && (
                  <Badge variant="outline" className="text-[8px]">
                    {50 - currentWordCount} remaining
                  </Badge>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsNotifyOpen(false)} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button 
                onClick={handleSendNotification} 
                disabled={currentWordCount > 50}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg transition-all duration-300"
              >
                <Send className="h-4 w-4" />
                Send Notification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        @keyframes zoom-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
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
        .animate-in {
          animation: zoom-in 0.3s ease-out;
        }
        .zoom-in-95 {
          transform: scale(0.95);
          animation: zoom-in 0.3s ease-out forwards;
        }
        .fade-in-0 {
          opacity: 0;
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </DashboardLayout>
  );
}
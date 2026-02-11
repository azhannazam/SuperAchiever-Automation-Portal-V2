import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, CheckCircle2, Loader2, Clock, Info } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// --- UPDATED INTERFACE TO MATCH SCHEMA ---
interface AlertData {
  id: string;
  type: "info" | "warning" | "urgent"; 
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

export default function Alerts() {
  const { user, isLoading } = useAuth();
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      setLoadingData(true);
      
      // Explicitly casting to 'any' stops the infinite type recursion
      const { data, error } = await (supabase
        .from("alerts") as any)
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setAlerts(data as AlertData[]);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .eq("id", alertId);

      if (error) throw error;
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
      toast.success("Alert marked as read");
    } catch (error) {
      console.error("Error updating alert:", error);
      toast.error("Failed to update alert");
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (error) throw error;
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      toast.success("All alerts marked as read");
    } catch (error) {
      console.error("Error updating alerts:", error);
      toast.error("Failed to update alerts");
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

  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !a.is_read;
    if (activeTab === "urgent") return a.type === "urgent";
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const urgentCount = alerts.filter((a) => a.type === "urgent").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-7 w-7 text-warning" />
              Alerts
            </h1>
            <p className="text-muted-foreground">
              Notifications for your synced records and case updates
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-warning/10 p-3">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Unread</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-destructive/10 p-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{urgentCount}</p>
                <p className="text-sm text-muted-foreground">Urgent</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({alerts.length})</TabsTrigger>
                <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
                <TabsTrigger value="urgent">Urgent ({urgentCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No alerts</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                      alert.type === "urgent"
                        ? "border-destructive/30 bg-destructive/5"
                        : alert.is_read
                        ? "border-border bg-background"
                        : "border-primary/20 bg-primary/5 shadow-sm"
                    }`}
                  >
                    <div className="mt-0.5">
                      {alert.type === "urgent" ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      ) : alert.type === "warning" ? (
                        <Clock className="h-5 w-5 text-warning" />
                      ) : (
                        <Info className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm">{alert.title}</p>
                        {!alert.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(alert.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(alert.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
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
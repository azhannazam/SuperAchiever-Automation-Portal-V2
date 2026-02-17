import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface ReportHistory {
  id: string;
  fileName: string;
  uploadDate: string;
  status: "processed" | "pending" | "error";
  recordsProcessed?: number;
}

export default function Reports() {
  const { user, role, isLoading: authLoading } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        setPreviewData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || previewData.length === 0) {
      toast.error("No data found in file.");
      return;
    }

    setUploading(true);
    
    try {
      // MAPPING LOGIC: Matched to your PROPOSALNO/AFYC headers
      const formattedData = previewData.map((row: any) => ({
        policy_number: String(row["POLICYNO"] || row["PROPOSALNO"]),
        agent_id: String(row["AGENT_CODE"]),
        client_name: row["CLIENT_CHOICE"] || row["AGENT_NAME"] || "Unknown Client",
        product_type: row["PRODUCT_NAME"],
        premium: parseFloat(row["AFYC"] || row["ANNUAL_PREM"] || 0),
        status: String(row["POLY_STATUS"] || "approved").toLowerCase(),
        submission_date: row["ENTRY_DATE"] ? new Date(row["ENTRY_DATE"]).toISOString() : new Date().toISOString(),
      })).filter(item => item.policy_number !== "undefined" && item.agent_id !== "undefined");

      // BULK UPSERT
      const { error } = await supabase
        .from("cases")
        .upsert(formattedData, { onConflict: "policy_number" });

      if (error) throw error;

      const newReport: ReportHistory = {
        id: Date.now().toString(),
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        status: "processed",
        recordsProcessed: formattedData.length
      };
      
      setReportHistory((prev) => [newReport, ...prev]);
      setSelectedFile(null);
      setPreviewData([]);
      toast.success(`Successfully synced ${formattedData.length} records to the portal!`);
    } catch (error: any) {
      console.error(error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: ReportHistory["status"]) => {
    switch (status) {
      case "processed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "pending": return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
      case "error": return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Data Management</h1>
          <p className="text-muted-foreground">Sync Report 316 data directly to the agent production system</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-soft border-none bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Upload className="h-5 w-5" /> Bulk Sync
              </CardTitle>
              <CardDescription>Upload Master Report 316 to update all 164+ records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-all">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm font-bold text-slate-600">
                    {selectedFile ? selectedFile.name : "Drag Master Excel here or browse"}
                  </span>
                  <Input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </Label>
              </div>
              <Button className="w-full font-bold" onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                {uploading ? "Syncing Database..." : "Sync to Supabase"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-none bg-[#0F172A] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary"><Database className="h-5 w-5" /> Sync Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/70 text-sm font-medium">Data Pending Sync</span>
                <span className="text-xl font-black">{previewData.length}</span>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Detected Mappings</p>
                <div className="grid grid-cols-2 gap-y-1 text-[11px] font-bold text-white/80">
                  <span>ID: POLICYNO</span>
                  <span>PREM: AFYC</span>
                  <span>AGENT: AGENT_CODE</span>
                  <span>PROD: PRODUCT_NAME</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-soft border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Recent Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            {reportHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-bold">No recent sync activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportHistory.map((report) => (
                  <div key={report.id} className="flex items-center justify-between rounded-xl border border-slate-50 p-4 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-2 rounded-lg"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /></div>
                      <div>
                        <p className="font-bold text-sm text-slate-700">{report.fileName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          Synced {format(new Date(report.uploadDate), "dd MMM yyyy, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Badge variant="secondary" className="bg-white text-[10px] font-black px-3">{report.recordsProcessed} RECORDS</Badge>
                      <div className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider">
                        {getStatusIcon(report.status)}
                        {report.status}
                      </div>
                    </div>
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

function Badge({ children, className, variant }: any) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border border-slate-200 ${className}`}>
      {children}
    </span>
  );
}
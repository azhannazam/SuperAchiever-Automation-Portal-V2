import { useState, useCallback, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  FileJson,
  RefreshCw,
  Download,
  HardDrive,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
  Activity,
  Server,
  CloudUpload,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

// --- Types & Interfaces ---

interface SyncStats {
  total: number;
  processed: number;
  errors: number;
  startTime: number | null;
}

interface ReportHistory {
  id: string;
  fileName: string;
  uploadDate: string;
  status: "success" | "partial" | "error";
  records: number;
  outputFile?: string;
  type?: string;
  file_size_mb?: number;
}

interface AgentMasterStats {
  totalAgents: number;
  lastUpdated: string | null;
  totalCases: number;
}

// Helper to safely parse dates for display
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  
  try {
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, "dd MMM yyyy, HH:mm");
    }
    return "Invalid date";
  } catch {
    return "Invalid date";
  }
};

export default function Reports() {
  const { user, role, isLoading: authLoading } = useAuth();
  
  // State Management
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImportingMaster, setIsImportingMaster] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMasterFile, setSelectedMasterFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [masterFileSize, setMasterFileSize] = useState<number>(0);
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [masterStats, setMasterStats] = useState<AgentMasterStats>({
    totalAgents: 0,
    lastUpdated: null,
    totalCases: 0,
  });
  
  const [stats, setStats] = useState<SyncStats>({
    total: 0,
    processed: 0,
    errors: 0,
    startTime: null,
  });

  const [apiStatus, setApiStatus] = useState<string>("checking");
  const API_BASE_URL = "http://127.0.0.1:8000";

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  // --- Check API Connection ---
  const checkApiConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setApiStatus("connected");
        return true;
      } else {
        setApiStatus("error");
        return false;
      }
    } catch (err) {
      setApiStatus("disconnected");
      return false;
    }
  }, [API_BASE_URL]);

  // --- Fetch Dashboard Stats ---
  const fetchDashboardStats = useCallback(async () => {
    try {
      const isConnected = await checkApiConnection();
      
      if (!isConnected) {
        const [agentResult, casesResult] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("cases").select("*", { count: "exact", head: true })
        ]);
        
        setMasterStats({
          totalAgents: agentResult.count || 0,
          lastUpdated: null,
          totalCases: casesResult.count || 0,
        });
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (response.ok) {
        const data = await response.json();
        setMasterStats({
          totalAgents: Number(data.totalAgents) || 0,
          lastUpdated: data.lastUpdated || null,
          totalCases: Number(data.totalCases) || 0,
        });
      }
      
      const historyResponse = await fetch(`${API_BASE_URL}/api/history?limit=10`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData);
      }
      
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, [API_BASE_URL, checkApiConnection]);

  // --- Poll for job status ---
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    if (currentJobId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/processing-status/${currentJobId}`);
          if (response.ok) {
            const status = await response.json();
            
            if (status.progress !== undefined) {
              setUploadProgress(status.progress);
            }
            
            if (status.stage) {
              setProcessingStage(status.stage);
            }
            
            if (status.status === 'completed') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              setProcessingStage('Complete!');
              setCurrentJobId(null);
              
              setIsProcessing(false);
              setIsImportingMaster(false);
              setSelectedFile(null);
              setSelectedMasterFile(null);
              
              await fetchDashboardStats();
              toast.success('Operation completed successfully!');
              
            } else if (status.status === 'failed') {
              clearInterval(pollInterval);
              setCurrentJobId(null);
              setIsProcessing(false);
              setIsImportingMaster(false);
              toast.error(`Operation failed: ${status.error || 'Unknown error'}`);
            }
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 2000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJobId, API_BASE_URL, fetchDashboardStats]);

  // Load stats on mount and set up periodic refresh
  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardStats]);

  // Manual refresh
  const refreshStats = () => {
    fetchDashboardStats();
    toast.success("Stats refreshed");
  };

  // --- File Selection Handler for Report 316 ---
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|xlsb)$/)) {
      toast.error("Invalid file format. Please upload a .xlsx, .xls, or .xlsb file.");
      return;
    }

    setSelectedFile(file);
    setFileSize(file.size);

    if (file.size > 50 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.warning(`Large file detected (${sizeMB}MB). Processing may take several minutes.`);
    }
  }, []);

  // --- File Selection Handler for Master Listing ---
  const handleMasterFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|xlsb)$/)) {
      toast.error("Invalid file format. Please upload a .xlsx, .xls, or .xlsb file.");
      return;
    }

    setSelectedMasterFile(file);
    setMasterFileSize(file.size);
  }, []);

  // --- Process Report 316 ---
  const processReport316 = async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);
    setUploadProgress(0);
    setProcessingStage("Uploading to Python API...");

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/process-report-316`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      setCurrentJobId(result.job_id);
      
      const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setProcessingStage(`Processing started... (${sizeMB}MB file)`);
      
      toast.info('File uploaded successfully. Processing in background.');
      
    } catch (err: any) {
      toast.error(`Processing failed: ${err.message}`);
      setIsProcessing(false);
      setCurrentJobId(null);
    }
  };

  // --- Import Agent Master ---
  const importAgentMaster = async () => {
    if (!selectedMasterFile || isImportingMaster) return;

    setIsImportingMaster(true);
    setProcessingStage("Uploading Master Listing...");

    const formData = new FormData();
    formData.append('file', selectedMasterFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/import-agent-master`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      setCurrentJobId(result.job_id);
      
      const sizeMB = (selectedMasterFile.size / (1024 * 1024)).toFixed(2);
      setProcessingStage(`Import started... (${sizeMB}MB file)`);
      
      toast.info('Master file uploaded successfully. Importing in background.');
      
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setIsImportingMaster(false);
      setCurrentJobId(null);
    }
  };

  // --- Download Generated File ---
  const downloadFile = async (filename: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/download-latest/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error('File not found');
      }
    } catch (err) {
      toast.error('Failed to download file');
    }
  };

  // --- Loading State ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Loading Data Management Console...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header with Animation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-slide-in-right">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Data Management Console
                </h1>
                <p className="text-slate-500 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Python-powered Excel processing engine
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={cn(
                "px-3 py-1.5 transition-all duration-300 animate-pulse-slow",
                apiStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                apiStatus === 'checking' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50 text-red-700 border-red-200'
              )}
            >
              <div className={cn(
                "h-2 w-2 rounded-full mr-2",
                apiStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                apiStatus === 'checking' ? 'bg-yellow-500' :
                'bg-red-500'
              )} />
              <HardDrive className="h-3.5 w-3.5 mr-1" />
              API: {apiStatus}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshStats}
              className="gap-2 hover:scale-105 transition-transform duration-300"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards with Modern Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 animate-fade-in-up border-none bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Total Agents</p>
                  <p className="text-4xl font-bold text-blue-900">{masterStats.totalAgents.toLocaleString()}</p>
                  {masterStats.lastUpdated && (
                    <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Updated: {formatDate(masterStats.lastUpdated)}
                    </p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 animate-fade-in-up border-none bg-gradient-to-br from-emerald-50 to-white" style={{ animationDelay: "0.1s" }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600 mb-1">Total Cases</p>
                  <p className="text-4xl font-bold text-emerald-900">{masterStats.totalCases.toLocaleString()}</p>
                  <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    In database
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 animate-fade-in-up border-none bg-gradient-to-br from-purple-50 to-white" style={{ animationDelay: "0.2s" }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1">Python Scripts</p>
                  <p className="text-4xl font-bold text-purple-900">3</p>
                  <p className="text-xs text-purple-500 mt-2 flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    Active engines
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Report 316 Card - Modern Design */}
          <Card className="border-none shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-fade-in-up">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600" />
            <CardHeader className="bg-gradient-to-r from-blue-50/50 to-white pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-xl bg-blue-100">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                Report 316 Processor
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                Filters by GAM_NAME='SuperAchiever' and syncs to Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <Label 
                htmlFor="report-upload" 
                className={cn(
                  "relative border-2 border-dashed rounded-2xl p-10 text-center block cursor-pointer transition-all duration-500 group/upload",
                  selectedFile ? "border-blue-500 bg-blue-50/30" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/20",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover/upload:opacity-100 transition-opacity duration-700 rounded-2xl" />
                <div className={cn(
                  "p-4 rounded-full mx-auto mb-4 transition-all duration-500 w-16 h-16 flex items-center justify-center",
                  selectedFile ? "bg-blue-500 scale-110" : "bg-slate-100 group-hover/upload:bg-blue-100 group-hover/upload:scale-110"
                )}>
                  <Upload className={cn(
                    "h-8 w-8 transition-all duration-500",
                    selectedFile ? "text-white" : "text-slate-400 group-hover/upload:text-blue-500"
                  )} />
                </div>
                <p className="font-semibold text-lg mb-1">
                  {selectedFile ? selectedFile.name : "Upload Report 316"}
                </p>
                {selectedFile && (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm text-slate-500">
                      Size: {(fileSize / (1024 * 1024)).toFixed(2)}MB
                    </p>
                    {fileSize > 50 * 1024 * 1024 && (
                      <p className="text-xs text-amber-500 flex items-center justify-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Large file detected
                      </p>
                    )}
                  </div>
                )}
                {!selectedFile && (
                  <p className="text-sm text-slate-400 mt-2">Supports .xlsx, .xls, .xlsb</p>
                )}
                <Input 
                  id="report-upload" 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx,.xls,.xlsb" 
                  onChange={handleFileChange} 
                  disabled={isProcessing} 
                />
              </Label>

              {(isProcessing || currentJobId) && (
                <div className="space-y-3 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl animate-fade-in">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-blue-700 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {processingStage}
                    </span>
                    <span className="text-blue-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 bg-blue-100" />
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-6">
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                onClick={processReport316} 
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Run Excel Bot
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Master Import Card - Modern Design */}
          <Card className="border-none shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
            <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-white pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-xl bg-emerald-100">
                  <Database className="h-5 w-5 text-emerald-600" />
                </div>
                Agent Master Importer
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                Updates profiles table from Master Listing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <Label 
                htmlFor="master-upload" 
                className={cn(
                  "relative border-2 border-dashed rounded-2xl p-10 text-center block cursor-pointer transition-all duration-500 group/upload",
                  selectedMasterFile ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20",
                  isImportingMaster && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover/upload:opacity-100 transition-opacity duration-700 rounded-2xl" />
                <div className={cn(
                  "p-4 rounded-full mx-auto mb-4 transition-all duration-500 w-16 h-16 flex items-center justify-center",
                  selectedMasterFile ? "bg-emerald-500 scale-110" : "bg-slate-100 group-hover/upload:bg-emerald-100 group-hover/upload:scale-110"
                )}>
                  <Upload className={cn(
                    "h-8 w-8 transition-all duration-500",
                    selectedMasterFile ? "text-white" : "text-slate-400 group-hover/upload:text-emerald-500"
                  )} />
                </div>
                <p className="font-semibold text-lg mb-1">
                  {selectedMasterFile ? selectedMasterFile.name : "Upload Master Listing"}
                </p>
                {selectedMasterFile && (
                  <p className="text-sm text-slate-500 mt-2">
                    Size: {(masterFileSize / (1024 * 1024)).toFixed(2)}MB
                  </p>
                )}
                {!selectedMasterFile && (
                  <p className="text-sm text-slate-400 mt-2">Supports .xlsx, .xls, .xlsb</p>
                )}
                <Input 
                  id="master-upload" 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx,.xls,.xlsb" 
                  onChange={handleMasterFileChange} 
                  disabled={isImportingMaster} 
                />
              </Label>

              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white rounded-xl">
                <span className="font-semibold text-emerald-800 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Current Agent Count:
                </span>
                <Badge className="bg-emerald-500 text-white px-3 py-1 text-sm">
                  {masterStats.totalAgents.toLocaleString()}
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-6">
              <Button 
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                onClick={importAgentMaster} 
                disabled={!selectedMasterFile || isImportingMaster}
              >
                {isImportingMaster ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-4 w-4" />
                    Import Master Listing
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* History Section - Modern Design */}
        <Card className="border-none shadow-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-xl bg-slate-100">
                <Clock className="h-5 w-5 text-slate-600" />
              </div>
              Recent Uploads
            </CardTitle>
            <CardDescription>
              History of all file processing activities
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {history.length === 0 ? (
                <div className="text-center py-20">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <Clock className="h-16 w-16 mx-auto text-slate-300 opacity-30" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-slate-200/50" />
                  </div>
                  <p className="text-lg font-semibold text-slate-400">No Upload History</p>
                  <p className="text-sm text-slate-400 mt-1">Upload a file to see history</p>
                </div>
              ) : (
                <div className="divide-y">
                  {history.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="flex flex-col sm:flex-row justify-between p-5 hover:bg-slate-50 transition-all duration-300 group animate-slide-in-right"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-2 rounded-xl transition-all duration-300 group-hover:scale-110",
                          item.status === "success" ? "bg-emerald-100" : "bg-red-100"
                        )}>
                          {item.status === "success" ? (
                            <FileCheck className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-primary transition-colors">
                            {item.fileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(item.uploadDate)}
                            </p>
                            {item.file_size_mb && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {item.file_size_mb}MB
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right mt-3 sm:mt-0">
                        <Badge 
                          className={cn(
                            "px-3 py-1 text-xs font-bold",
                            item.status === "success" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"
                          )}
                        >
                          {item.records.toLocaleString()} RECORDS
                        </Badge>
                        <p className="text-xs mt-1 text-slate-400 capitalize flex items-center gap-1 justify-start sm:justify-end">
                          {item.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          {item.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Add CSS animations */}
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
        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-fade-in-right {
          animation: fade-in-right 0.6s ease-out forwards;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out forwards;
          opacity: 0;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </DashboardLayout>
  );
}
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
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";

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
      return format(date, "dd MMM yyyy");
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
        // Fallback to Supabase
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
      
      // Fetch from Python API
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (response.ok) {
        const data = await response.json();
        setMasterStats({
          totalAgents: Number(data.totalAgents) || 0,
          lastUpdated: data.lastUpdated || null,
          totalCases: Number(data.totalCases) || 0,
        });
      }
      
      // Fetch history
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
            
            // Update progress
            if (status.progress !== undefined) {
              setUploadProgress(status.progress);
            }
            
            // Update stage
            if (status.stage) {
              setProcessingStage(status.stage);
            }
            
            // Check if completed
            if (status.status === 'completed') {
              clearInterval(pollInterval);
              setUploadProgress(100);
              setProcessingStage('Complete!');
              setCurrentJobId(null);
              
              // Reset processing states
              setIsProcessing(false);
              setIsImportingMaster(false);
              setSelectedFile(null);
              setSelectedMasterFile(null);
              
              // Refresh stats and history
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

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Invalid file format. Please upload a .xlsx or .xls file.");
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

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Invalid file format. Please upload a .xlsx or .xls file.");
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              Data Management Console
            </h1>
            <p className="text-slate-500">Python-powered Excel processing engine</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`
              ${apiStatus === 'connected' ? 'bg-emerald-50 text-emerald-700' :
                apiStatus === 'checking' ? 'bg-yellow-50 text-yellow-700' :
                'bg-red-50 text-red-700'}
            `}>
              <HardDrive className="h-4 w-4 mr-2" />
              API: {apiStatus}
            </Badge>
            <Button variant="outline" size="sm" onClick={refreshStats}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-6">
          <Card className="bg-blue-50">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-blue-600">Total Agents</p>
              <p className="text-3xl font-bold text-blue-900">{masterStats.totalAgents.toLocaleString()}</p>
              {masterStats.lastUpdated && (
                <p className="text-xs text-blue-500 mt-1">
                  Updated: {formatDate(masterStats.lastUpdated)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-emerald-50">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-emerald-600">Total Cases</p>
              <p className="text-3xl font-bold text-emerald-900">{masterStats.totalCases.toLocaleString()}</p>
              <p className="text-xs text-emerald-500 mt-1">In database</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-purple-600">Python Scripts</p>
              <p className="text-3xl font-bold text-purple-900">3</p>
              <p className="text-xs text-purple-500">excel_bot.py, import_master.py, database.py</p>
            </CardContent>
          </Card>
        </div>

        {/* Processing Cards */}
        <div className="grid grid-cols-2 gap-8">
          
          {/* Report 316 Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                Report 316 Processor
              </CardTitle>
              <CardDescription>
                Filters by GAM_NAME='SuperAchiever' and syncs to Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="report-upload" className="border-2 border-dashed rounded-xl p-8 text-center block cursor-pointer hover:border-blue-500">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="font-medium">
                  {selectedFile ? selectedFile.name : "Upload Report_316_Actual_Feb.xlsx"}
                </p>
                {selectedFile && (
                  <p className="text-xs text-slate-500 mt-1">
                    Size: {(fileSize / (1024 * 1024)).toFixed(2)}MB
                    {fileSize > 50 * 1024 * 1024 && (
                      <span className="text-amber-500 ml-2">⚠️ Large file</span>
                    )}
                  </p>
                )}
                <Input id="report-upload" type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isProcessing} />
              </Label>

              {(isProcessing || currentJobId) && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-blue-700">{processingStage}</span>
                    <span className="text-blue-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-blue-500" onClick={processReport316} disabled={!selectedFile || isProcessing}>
                {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Run Excel Bot"}
              </Button>
            </CardFooter>
          </Card>

          {/* Master Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-500" />
                Agent Master Importer
              </CardTitle>
              <CardDescription>
                Updates profiles table from Master Listing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="master-upload" className="border-2 border-dashed rounded-xl p-8 text-center block cursor-pointer hover:border-emerald-500">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="font-medium">
                  {selectedMasterFile ? selectedMasterFile.name : "Upload Master Listing 2026.xlsx"}
                </p>
                {selectedMasterFile && (
                  <p className="text-xs text-slate-500 mt-1">
                    Size: {(masterFileSize / (1024 * 1024)).toFixed(2)}MB
                  </p>
                )}
                <Input id="master-upload" type="file" className="hidden" accept=".xlsx,.xls" onChange={handleMasterFileChange} disabled={isImportingMaster} />
              </Label>

              <div className="flex justify-between p-3 bg-emerald-50 rounded-lg">
                <span className="font-medium">Current Agent Count:</span>
                <Badge className="bg-emerald-500">{masterStats.totalAgents}</Badge>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-emerald-500" onClick={importAgentMaster} disabled={!selectedMasterFile || isImportingMaster}>
                {isImportingMaster ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> : "Import Master Listing"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {history.length === 0 ? (
                <div className="text-center py-16 opacity-30">
                  <Clock className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm font-bold">No Upload History</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="flex justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold">{item.fileName}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(item.uploadDate)}
                        </p>
                        {item.file_size_mb && (
                          <p className="text-xs text-slate-500">Size: {item.file_size_mb}MB</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant={item.status === "success" ? "default" : "destructive"}>
                          {item.records} RECORDS
                        </Badge>
                        <p className="text-xs mt-1 text-slate-400 capitalize">{item.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
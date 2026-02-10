import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReportHistory {
  id: string;
  fileName: string;
  uploadDate: string;
  status: "processed" | "pending" | "error";
  recordsProcessed?: number;
}

// Mock report history
const mockHistory: ReportHistory[] = [
  {
    id: "1",
    fileName: "Report_316_2024-01-15.xlsx",
    uploadDate: "2024-01-15T10:30:00Z",
    status: "processed",
    recordsProcessed: 45,
  },
  {
    id: "2",
    fileName: "Report_316_2024-01-14.xlsx",
    uploadDate: "2024-01-14T09:15:00Z",
    status: "processed",
    recordsProcessed: 38,
  },
  {
    id: "3",
    fileName: "Report_316_2024-01-13.xlsx",
    uploadDate: "2024-01-13T11:00:00Z",
    status: "processed",
    recordsProcessed: 52,
  },
];

export default function Reports() {
  const { user, role, isLoading } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>(mockHistory);

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

  // Only admins can access this page
  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const newReport: ReportHistory = {
      id: Date.now().toString(),
      fileName: selectedFile.name,
      uploadDate: new Date().toISOString(),
      status: "pending",
    };
    
    setReportHistory((prev) => [newReport, ...prev]);
    setSelectedFile(null);
    setUploading(false);
    toast.success("Report uploaded successfully! Processing will begin shortly.");
  };

  const handleExport = () => {
    toast.success("Daily Submission report is being generated...");
    // In production, this would trigger an actual file download
  };

  const getStatusIcon = (status: ReportHistory["status"]) => {
    switch (status) {
      case "processed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports Management</h1>
          <p className="text-muted-foreground">
            Upload Report 316 files and download daily submissions
          </p>
        </div>

        {/* Upload and Export cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload card */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Report 316
              </CardTitle>
              <CardDescription>
                Upload the daily Report 316 Excel file to process SuperE-related data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm text-muted-foreground">
                    {selectedFile ? (
                      <span className="text-foreground font-medium">
                        {selectedFile.name}
                      </span>
                    ) : (
                      <>
                        Drag and drop or{" "}
                        <span className="text-primary font-medium">browse</span> to upload
                      </>
                    )}
                  </span>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports .xlsx and .xls files
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Export card */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-success" />
                Download Daily Submission
              </CardTitle>
              <CardDescription>
                Export the latest processed data as a Daily Submission report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-success mb-3" />
                <p className="text-sm font-medium">Daily Submission Report</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last updated: {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Report history */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Upload History</CardTitle>
            <CardDescription>
              Recent Report 316 uploads and their processing status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No reports uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportHistory.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-success" />
                      <div>
                        <p className="font-medium text-sm">{report.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(new Date(report.uploadDate), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {report.recordsProcessed && (
                        <span className="text-sm text-muted-foreground">
                          {report.recordsProcessed} records
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 capitalize text-sm">
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

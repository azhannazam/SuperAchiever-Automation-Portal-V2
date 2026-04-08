import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  ShieldCheck, TrendingUp, HeartPulse, Briefcase,
  Download, Upload, Trash2, FileText, Presentation, Info, Loader2,
  Sparkles, FolderOpen, FileCheck, Clock, CheckCircle2, X,
  Eye, FileSpreadsheet, Grid3x3, LayoutGrid,
} from "lucide-react";
import { format } from "date-fns";

// --- 1. PRODUCT DATA STRUCTURE ---
const INITIAL_PRODUCTS = {
  Traditional: [
    { id: "term-secure", name: "Etiqa Term Secure Takaful", icon: <ShieldCheck className="text-blue-500" />, description: "Comprehensive term life protection with Takaful benefits", features: ["Death Benefit", "Total Permanent Disability", "Flexible Terms"] },
    { id: "medicmate", name: "Etiqa MedicMate Takaful", icon: <HeartPulse className="text-rose-500" />, description: "Medical and health coverage for you and your family", features: ["Annual Limit up to RM1M", "No Co-Insurance", "Global Coverage"] },
    { id: "icare-oku", name: "i-Care OKU", icon: <ShieldCheck className="text-emerald-500" />, description: "Specialized protection for persons with disabilities", features: ["Affordable Premium", "Special Benefits", "Easy Application"] }
  ],
  Investment: [
    { id: "eliteplus", name: "ElitePlus Takafulink", icon: <TrendingUp className="text-amber-500" />, description: "Investment-linked plan with growth potential", features: ["Multiple Fund Options", "Free Switching", "Top-up Flexibility"] },
    { id: "mahabbah", name: "Mahabbah Takafulink", icon: <Briefcase className="text-indigo-500" />, description: "Shariah-compliant investment with protection", features: ["Shariah Compliant", "Competitive Returns", "Low Entry Cost"] },
    { id: "legacypro", name: "LegacyPro", icon: <TrendingUp className="text-purple-500" />, description: "Wealth accumulation and legacy planning", features: ["Estate Planning", "Wealth Transfer", "Tax Benefits"] }
  ]
};

export default function ProductInformation() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<"Traditional" | "Investment">("Traditional");
  const [uploading, setUploading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  // --- FILE MANAGEMENT LOGIC ---
  const handleFileUpload = async (productId: string, type: 'brochure' | 'slide', file: File) => {
    try {
      setUploading(`${productId}-${type}`);
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${type}.${fileExt}`;
      const filePath = `${activeCategory}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      toast({ title: "Success", description: `${type} uploaded successfully.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (productId: string, type: 'brochure' | 'slide') => {
    const filePath = `${activeCategory}/${productId}-${type}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('product-assets')
      .createSignedUrl(filePath, 60);

    if (error) {
      toast({ variant: "destructive", title: "File Not Found", description: "This file hasn't been uploaded yet." });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (productId: string, type: 'brochure' | 'slide') => {
    const filePath = `${activeCategory}/${productId}-${type}.pdf`;
    const { error } = await supabase.storage.from('product-assets').remove([filePath]);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove file." });
    } else {
      toast({ title: "Removed", description: "File successfully deleted." });
    }
  };

  const openProductModal = (product: any) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const currentProducts = useMemo(() => INITIAL_PRODUCTS[activeCategory], [activeCategory]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header with Animation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 animate-slide-in-right">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <FolderOpen className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Product Information
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </h1>
                <p className="text-muted-foreground text-sm">
                  Download brochures and presentation slides for our products
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 animate-slide-in-left">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn("h-8 w-8 p-0", viewMode === "grid" && "bg-white shadow-sm")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn("h-8 w-8 p-0", viewMode === "list" && "bg-white shadow-sm")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            {isAdmin && (
              <Badge className="bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border-amber-200 px-3 py-1.5">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Admin Mode
              </Badge>
            )}
          </div>
        </div>

        {/* Category Selector with Animation */}
        <div className="flex justify-center animate-fade-in-up">
          <div className="flex p-1.5 bg-gradient-to-r from-slate-100 to-slate-50 rounded-full border border-slate-200/60 shadow-sm">
            {["Traditional", "Investment"].map((cat, idx) => (
              <Button
                key={cat}
                variant="ghost"
                onClick={() => setActiveCategory(cat as any)}
                className={cn(
                  "rounded-full px-8 font-black text-[11px] uppercase tracking-[0.1em] transition-all duration-300 h-10",
                  activeCategory === cat 
                    ? "bg-white text-slate-900 shadow-md border border-slate-100 scale-105" 
                    : "text-slate-400 hover:text-slate-600"
                )}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {cat === "Traditional" ? <ShieldCheck className="h-3 w-3 mr-2" /> : <TrendingUp className="h-3 w-3 mr-2" />}
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Grid/List */}
        <div className={cn(
          "transition-all duration-500",
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "space-y-4"
        )}>
          {currentProducts.map((product, index) => (
            <div
              key={product.id}
              className={cn(
                "animate-fade-in-up cursor-pointer",
                viewMode === "list" && "w-full"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
              onClick={() => openProductModal(product)}
            >
              <Card className={cn(
                "border-none shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden group",
                viewMode === "list" && "flex",
                hoveredProduct === product.id && "scale-[1.02]"
              )}>
                <CardContent className={cn(
                  "p-6 space-y-4",
                  viewMode === "list" && "flex-1"
                )}>
                  <div className="flex justify-between items-start">
                    <div className="relative">
                      <div className={cn(
                        "p-4 rounded-2xl transition-all duration-500",
                        hoveredProduct === product.id ? "bg-gradient-to-br from-primary/20 to-primary/10 scale-110" : "bg-slate-50"
                      )}>
                        {product.icon}
                      </div>
                      {hoveredProduct === product.id && (
                        <div className="absolute -top-1 -right-1">
                          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[9px] font-bold uppercase bg-white/50 backdrop-blur">
                      {activeCategory}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-tight">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                  </div>

                  {viewMode === "grid" && (
                    <div className="flex flex-wrap gap-2">
                      {product.features.slice(0, 2).map((feature: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-[8px] font-bold bg-slate-100">
                          {feature}
                        </Badge>
                      ))}
                      {product.features.length > 2 && (
                        <Badge variant="secondary" className="text-[8px] font-bold bg-slate-100">
                          +{product.features.length - 2} more
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {/* Brochure Section */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                        <FileText className="h-3 w-3" />
                        Brochure
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full rounded-xl border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:from-blue-50 hover:to-blue-50 hover:text-blue-600 hover:border-blue-200 gap-2 h-14 transition-all duration-300 group/btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(product.id, 'brochure');
                        }}
                      >
                        <FileText className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                        <span className="text-xs font-bold uppercase">Download</span>
                      </Button>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <label className="flex-1">
                            <div className="w-full flex items-center justify-center h-8 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all duration-300 hover:scale-105">
                              {uploading === `${product.id}-brochure` ? 
                                <Loader2 className="w-3 h-3 animate-spin" /> : 
                                <Upload className="w-3 h-3" />
                              }
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf" 
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(product.id, 'brochure', e.target.files[0])} 
                            />
                          </label>
                          <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 transition-all duration-300 hover:scale-110" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(product.id, 'brochure');
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Slides Section */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                        <Presentation className="h-3 w-3" />
                        Slides
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full rounded-xl border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:from-indigo-50 hover:to-indigo-50 hover:text-indigo-600 hover:border-indigo-200 gap-2 h-14 transition-all duration-300 group/btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(product.id, 'slide');
                        }}
                      >
                        <Presentation className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                        <span className="text-xs font-bold uppercase">Download</span>
                      </Button>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <label className="flex-1">
                            <div className="w-full flex items-center justify-center h-8 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all duration-300 hover:scale-105">
                              {uploading === `${product.id}-slide` ? 
                                <Loader2 className="w-3 h-3 animate-spin" /> : 
                                <Upload className="w-3 h-3" />
                              }
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf,.pptx" 
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(product.id, 'slide', e.target.files[0])} 
                            />
                          </label>
                          <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 transition-all duration-300 hover:scale-110" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(product.id, 'slide');
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View Details Link */}
                  <div className="pt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-[10px] font-bold text-primary hover:bg-primary/5 gap-1 group/link"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductModal(product);
                      }}
                    >
                      <Eye className="h-3 w-3 transition-transform group-hover/link:scale-110" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Product Details Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-zoom-in">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                    {selectedProduct.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                    <Badge variant="outline" className="text-[8px]">{activeCategory}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">{selectedProduct.description}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Features</p>
                  <div className="space-y-2">
                    {selectedProduct.features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDownload(selectedProduct.id, 'brochure')}
                    >
                      <FileText className="h-4 w-4" />
                      Brochure
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDownload(selectedProduct.id, 'slide')}
                    >
                      <Presentation className="h-4 w-4" />
                      Slides
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(20px);
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
          animation: slide-in-right 0.6s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out forwards;
        }
        .animate-zoom-in {
          animation: zoom-in 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </DashboardLayout>
  );
}
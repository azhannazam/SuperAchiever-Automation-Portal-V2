import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, TrendingUp, HeartPulse, Briefcase,
  Download, Upload, Trash2, FileText, Presentation, Info, Loader2,
  Sparkles, FolderOpen, FileCheck, Clock, CheckCircle2, X,
  Eye, FileSpreadsheet, Grid3x3, LayoutGrid, ChevronRight,
  Zap, Gem, Crown, Star, Leaf, Heart, Shield, Award,
  GraduationCap, Building2, Users, Handshake, Globe, Sun,
  Gift
} from "lucide-react";
import { format } from "date-fns";

// ============================================================
// 1. PRODUCT DATA STRUCTURE (Updated with correct products)
// ============================================================

const PRODUCTS = {
  "Investment Link": [
    { 
      id: "eliteplus", 
      name: "ElitePlus Takafulink", 
      icon: <Crown className="text-amber-500" />, 
      description: "Premium investment-linked plan for high-growth potential with comprehensive protection", 
      features: ["Multiple Fund Options", "Free Switching", "Top-up Flexibility", "Death Benefit", "Total Permanent Disability"],
      color: "from-amber-500 to-orange-600",
      badgeColor: "bg-amber-100 text-amber-700"
    },
    { 
      id: "mahabbah", 
      name: "Mahabbah Takafulink", 
      icon: <Heart className="text-rose-500" />, 
      description: "Shariah-compliant investment with love and care for your family's future", 
      features: ["Shariah Compliant", "Competitive Returns", "Low Entry Cost", "Family Protection", "Flexible Contributions"],
      color: "from-rose-500 to-pink-600",
      badgeColor: "bg-rose-100 text-rose-700"
    },
    { 
      id: "hadiyyah", 
      name: "Hadiyyah Takafulink", 
      icon: <Gift className="text-emerald-500" />, 
      description: "Gift of protection and investment for your loved ones", 
      features: ["Gift Coverage", "Investment Growth", "Affordable Premium", "Simple Application", "Quick Approval"],
      color: "from-emerald-500 to-teal-600",
      badgeColor: "bg-emerald-100 text-emerald-700"
    }
  ],
  "Traditional": [
    { 
      id: "prisma", 
      name: "Prisma", 
      icon: <Gem className="text-purple-500" />, 
      description: "Comprehensive term life protection with multi-dimensional benefits", 
      features: ["Death Benefit", "Total Permanent Disability", "Accidental Death", "Flexible Terms", "Renewable Coverage"],
      color: "from-purple-500 to-indigo-600",
      badgeColor: "bg-purple-100 text-purple-700"
    },
    { 
      id: "harmoni", 
      name: "Harmoni", 
      icon: <Users className="text-blue-500" />, 
      description: "Balanced protection for family harmony and financial security", 
      features: ["Family Coverage", "Joint Protection", "Child Benefit", "Affordable Premium", "Simple Claims"],
      color: "from-blue-500 to-cyan-600",
      badgeColor: "bg-blue-100 text-blue-700"
    },
    { 
      id: "karisma", 
      name: "Karisma", 
      icon: <Star className="text-yellow-500" />, 
      description: "Charismatic coverage with premium benefits and exclusive features", 
      features: ["Premium Benefits", "Higher Coverage", "Value-added Services", "Fast Claims", "24/7 Support"],
      color: "from-yellow-500 to-amber-600",
      badgeColor: "bg-yellow-100 text-yellow-700"
    },
    { 
      id: "madani", 
      name: "Madani", 
      icon: <Building2 className="text-teal-500" />, 
      description: "Civilization-inspired plan for community and family well-being", 
      features: ["Community Benefits", "Group Coverage", "Social Protection", "Affordable Rates", "Wide Acceptance"],
      color: "from-teal-500 to-emerald-600",
      badgeColor: "bg-teal-100 text-teal-700"
    },
    { 
      id: "aatifa", 
      name: "Aatifa", 
      icon: <Handshake className="text-indigo-500" />, 
      description: "Compassionate coverage with caring benefits for your loved ones", 
      features: ["Compassionate Benefits", "Caregiver Coverage", "Extended Family", "Flexible Payment", "Easy Renewal"],
      color: "from-indigo-500 to-purple-600",
      badgeColor: "bg-indigo-100 text-indigo-700"
    },
    { 
      id: "aafiahcare", 
      name: "AafiahCare", 
      icon: <HeartPulse className="text-rose-500" />, 
      description: "Comprehensive medical and health coverage for wellness and healing", 
      features: ["Medical Coverage", "Hospitalization", "Surgical Benefits", "Outpatient Care", "Wellness Programs"],
      color: "from-rose-500 to-red-600",
      badgeColor: "bg-rose-100 text-rose-700"
    },
    { 
      id: "eliteedge", 
      name: "ELITE eDGE Takaful", 
      icon: <Zap className="text-orange-500" />, 
      description: "Cutting-edge protection with premium features for elite members", 
      features: ["Premium Coverage", "Elite Benefits", "Priority Service", "Global Protection", "Exclusive Access"],
      color: "from-orange-500 to-red-600",
      badgeColor: "bg-orange-100 text-orange-700"
    },
    { 
      id: "medicedge", 
      name: "MEDIC eDGE Takaful", 
      icon: <Shield className="text-green-500" />, 
      description: "Advanced medical coverage with edge-cutting healthcare benefits", 
      features: ["Advanced Medical", "Specialist Coverage", "International Treatment", "No Co-Insurance", "High Annual Limit"],
      color: "from-green-500 to-emerald-600",
      badgeColor: "bg-green-100 text-green-700"
    }
  ]
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
  transition: { duration: 0.5, ease: "easeOut" }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } }
};

const scaleOnHover = {
  whileHover: { scale: 1.02, transition: { duration: 0.2 } },
  whileTap: { scale: 0.98 }
};

export default function ProductInformation() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<"Investment Link" | "Traditional">("Investment Link");
  const [uploading, setUploading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

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

  const currentProducts = useMemo(() => PRODUCTS[activeCategory], [activeCategory]);

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse delay-2000" />
        </div>

        <div className="relative p-6 space-y-8 max-w-[1400px] mx-auto">
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl"
          >
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative z-10 p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="p-2 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm"
                    >
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </motion.div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-sm">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {Object.keys(PRODUCTS).reduce((acc, cat) => acc + PRODUCTS[cat as keyof typeof PRODUCTS].length, 0)} Products
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Product Information
                  </h1>
                  <p className="text-white/60 text-sm">
                    Download brochures and presentation slides for our comprehensive range of Takaful products
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={cn("h-8 w-8 p-0 text-white/60 hover:text-white", viewMode === "grid" && "bg-white/20 text-white")}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={cn("h-8 w-8 p-0 text-white/60 hover:text-white", viewMode === "list" && "bg-white/20 text-white")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                  {isAdmin && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 backdrop-blur-sm px-3 py-1.5">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Admin Mode
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Category Tabs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center"
          >
            <Tabs 
              value={activeCategory} 
              onValueChange={(v) => setActiveCategory(v as "Investment Link" | "Traditional")}
              className="w-full max-w-md"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-auto">
                <TabsTrigger 
                  value="Investment Link" 
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300 py-2.5"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Investment Link
                </TabsTrigger>
                <TabsTrigger 
                  value="Traditional"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300 py-2.5"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Traditional
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Stats Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-80">Investment Link Products</p>
                  <p className="text-2xl font-bold">{PRODUCTS["Investment Link"].length}</p>
                </div>
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-80">Traditional Products</p>
                  <p className="text-2xl font-bold">{PRODUCTS["Traditional"].length}</p>
                </div>
                <ShieldCheck className="h-8 w-8 opacity-80" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-80">Total Products</p>
                  <p className="text-2xl font-bold">{PRODUCTS["Investment Link"].length + PRODUCTS["Traditional"].length}</p>
                </div>
                <Gem className="h-8 w-8 opacity-80" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-80">Last Updated</p>
                  <p className="text-lg font-bold">March 2026</p>
                </div>
                <Clock className="h-8 w-8 opacity-80" />
              </div>
            </div>
          </motion.div>

          {/* Product Grid/List */}
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className={cn(
              "transition-all duration-500",
              viewMode === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                : "space-y-4"
            )}
          >
            <AnimatePresence>
              {currentProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  variants={fadeInUp}
                  layout
                  onMouseEnter={() => setHoveredProduct(product.id)}
                  onMouseLeave={() => setHoveredProduct(null)}
                >
                  <Card 
                    className={cn(
                      "group relative cursor-pointer border-none bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden",
                      viewMode === "list" && "flex",
                      hoveredProduct === product.id && "scale-[1.02]"
                    )}
                    onClick={() => openProductModal(product)}
                  >
                    {/* Gradient Border Effect on Hover */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl",
                      product.color
                    )} style={{ padding: 2, margin: -2, zIndex: 0 }} />
                    
                    <CardContent className={cn(
                      "p-6 relative z-10 bg-white rounded-2xl",
                      viewMode === "list" && "flex-1"
                    )}>
                      <div className="flex justify-between items-start mb-4">
                        <motion.div 
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className={cn(
                            "p-4 rounded-2xl transition-all duration-500 bg-gradient-to-br",
                            product.color
                          )}
                        >
                          <div className="text-white">{product.icon}</div>
                        </motion.div>
                        <Badge className={cn("text-[9px] font-bold uppercase", product.badgeColor)}>
                          {activeCategory === "Investment Link" ? "Investment" : "Traditional"}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <h3 className="text-lg font-black text-slate-900 leading-tight">{product.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                      </div>

                      {/* FIXED: Feature Badges with better visibility */}
                      {viewMode === "grid" && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {product.features.slice(0, 3).map((feature: string, idx: number) => (
                            <Badge 
                              key={idx} 
                              className="text-[9px] font-bold bg-gradient-to-r from-slate-700 to-slate-600 text-white border-none shadow-sm hover:scale-105 transition-transform duration-200"
                            >
                              {feature.length > 15 ? feature.substring(0, 12) + "..." : feature}
                            </Badge>
                          ))}
                          {product.features.length > 3 && (
                            <Badge 
                              variant="secondary" 
                              className="text-[9px] font-bold bg-slate-200 text-slate-700 border-none"
                            >
                              +{product.features.length - 3} more
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
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "w-full py-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2",
                              "border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:from-blue-50 hover:to-blue-50 hover:text-blue-600 hover:border-blue-200"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(product.id, 'brochure');
                            }}
                          >
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-bold">Download</span>
                          </motion.button>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <label className="flex-1">
                                <div className="w-full flex items-center justify-center h-8 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all duration-300">
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
                                className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" 
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
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "w-full py-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2",
                              "border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:from-indigo-50 hover:to-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(product.id, 'slide');
                            }}
                          >
                            <Presentation className="w-4 h-4" />
                            <span className="text-xs font-bold">Download</span>
                          </motion.button>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <label className="flex-1">
                                <div className="w-full flex items-center justify-center h-8 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all duration-300">
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
                                className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" 
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
                      <motion.div 
                        className="pt-4 mt-2 border-t border-slate-100"
                        whileHover={{ x: 5 }}
                      >
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-[10px] font-bold text-primary hover:bg-primary/5 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductModal(product);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          View Details
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Product Details Modal */}
      <AnimatePresence>
        {modalOpen && selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header with Gradient */}
              <div className={cn("p-6 bg-gradient-to-r text-white", selectedProduct.color)}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      {selectedProduct.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                      <Badge className="bg-white/20 text-white border-none mt-1 text-[8px]">
                        {activeCategory === "Investment Link" ? "Investment Link" : "Traditional"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalOpen(false)}
                    className="h-8 w-8 p-0 rounded-full text-white hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Key Features
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedProduct.features.map((feature: string, idx: number) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-2 text-sm p-2 rounded-lg bg-slate-50"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-700">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Download className="h-3 w-3" />
                    Quick Actions
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2 border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      onClick={() => handleDownload(selectedProduct.id, 'brochure')}
                    >
                      <FileText className="h-4 w-4" />
                      Brochure
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                      onClick={() => handleDownload(selectedProduct.id, 'slide')}
                    >
                      <Presentation className="h-4 w-4" />
                      Slides
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
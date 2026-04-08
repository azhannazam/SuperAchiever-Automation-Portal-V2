import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: "default" | "success" | "warning" | "primary";
  onClick?: () => void;
  animated?: boolean;
  delay?: number;
}

const variantStyles = {
  default: {
    bg: "from-slate-50 to-white",
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    gradient: "from-slate-500 to-slate-600",
  },
  success: {
    bg: "from-emerald-50 to-white",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    gradient: "from-emerald-500 to-teal-600",
  },
  warning: {
    bg: "from-amber-50 to-white",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    gradient: "from-amber-500 to-orange-600",
  },
  primary: {
    bg: "from-blue-50 to-white",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    gradient: "from-blue-500 to-purple-600",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  onClick,
  animated = true,
  delay = 0,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "group relative",
        animated && "animate-fade-in-up",
        onClick && "cursor-pointer"
      )}
      style={{ animationDelay: `${delay}s`, animationFillMode: "both" }}
      onClick={onClick}
    >
      {/* Animated Gradient Border on Hover */}
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 blur transition-all duration-500 group-hover:opacity-100 group-hover:blur-md" />
      
      {/* Main Card */}
      <Card
        className={cn(
          "relative overflow-hidden border shadow-soft transition-all duration-500",
          styles.bg,
          styles.border,
          onClick && "hover:scale-105 hover:shadow-xl active:scale-95",
          "hover:border-primary/20"
        )}
      >
        {/* Animated Shimmer Effect on Hover */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        
        {/* Animated Gradient Line at Top */}
        <div
          className={cn(
            "absolute left-0 top-0 h-1 w-0 bg-gradient-to-r transition-all duration-700 group-hover:w-full",
            styles.gradient
          )}
        />
        
        {/* Pulse Effect Ring */}
        <div className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="absolute inset-0 animate-ping-slow rounded-xl bg-primary/5" />
        </div>

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          <div
            className={cn(
              "rounded-full p-2 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12",
              styles.iconBg,
              styles.iconColor
            )}
          >
            {icon}
          </div>
        </CardHeader>

        <CardContent>
          {/* Animated Value Counter Effect */}
          <div className="relative">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            
            {/* Animated Underline for Numbers */}
            {typeof value === 'number' && (
              <div className="mt-1 h-0.5 w-0 bg-gradient-to-r from-primary to-primary/20 transition-all duration-1000 group-hover:w-full" />
            )}
          </div>
          
          {/* Subtitle with Animation */}
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 transition-all duration-300 group-hover:text-slate-700">
              {subtitle}
            </p>
          )}

          {/* Animated Progress Indicator for Production Cards */}
          {title.includes("Production") && typeof value === 'string' && (
            <div className="mt-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full w-0 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000 group-hover:w-full"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          )}
        </CardContent>

        {/* Click Hint Animation */}
        {onClick && (
          <div className="absolute bottom-2 right-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
            <div className="rounded-full bg-primary/10 p-1">
              <svg
                className="h-3 w-3 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// StatCardDetail Component (Enhanced with animations)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StatCardDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string | number;
  subtitle?: string;
  details?: { label: string; value: string | number }[];
}

export function StatCardDetail({
  open,
  onOpenChange,
  title,
  value,
  subtitle,
  details = [],
}: StatCardDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="h-1 w-8 rounded-full bg-gradient-to-r from-primary to-primary/40" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Animated Value Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 p-6 text-center shadow-lg">
            {/* Animated Background Particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-float rounded-full bg-white/10"
                  style={{
                    width: `${Math.random() * 100 + 50}px`,
                    height: `${Math.random() * 100 + 50}px`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 2}s`,
                  }}
                />
              ))}
            </div>
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            <div className="relative z-10">
              <p className="text-4xl font-bold text-white">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {subtitle && (
                <p className="mt-2 text-sm text-white/80">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Details Section */}
          {details.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span>Detailed Breakdown</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              
              {details.map((d, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between rounded-lg border p-3 transition-all duration-300 hover:scale-[1.02] hover:border-primary/20 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span className="text-sm text-slate-600 transition-colors duration-300 group-hover:text-slate-900">
                    {d.label}
                  </span>
                  <span className="font-semibold text-slate-900 transition-all duration-300 group-hover:scale-110 group-hover:text-primary">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Animated Footer */}
          <div className="pt-2 text-center">
            <div className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add these animations to your global CSS if not already present
const styles = `
@keyframes ping-slow {
  0% {
    transform: scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.05);
    opacity: 0;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.5;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(5deg);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-ping-slow {
  animation: ping-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

/* Scroll-based animations */
@keyframes fade-in-zoom {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in {
  animation: fade-in-zoom 0.3s ease-out;
}

.fade-in-0 {
  opacity: 0;
  animation: fade-in-zoom 0.3s ease-out forwards;
}

.zoom-in-95 {
  transform: scale(0.95);
  animation: fade-in-zoom 0.3s ease-out forwards;
}

.duration-300 {
  transition-duration: 300ms;
}
`;
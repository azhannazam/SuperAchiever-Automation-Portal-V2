import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { cva, type VariantProps } from "class-variance-authority";

const statCardVariants = cva(
  "relative overflow-hidden transition-all duration-300 hover:shadow-medium",
  {
    variants: {
      variant: {
        default: "bg-card shadow-soft",
        primary: "gradient-primary text-primary-foreground",
        success: "gradient-success text-success-foreground",
        warning: "gradient-warning text-warning-foreground",
        accent: "bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  className,
  variant,
  title,
  value,
  subtitle,
  icon,
  trend,
  ...props
}: StatCardProps) {
  const isColoredVariant = variant && variant !== "default";

  return (
    <Card className={cn(statCardVariants({ variant }), className)} {...props}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className={cn(
              "text-sm font-medium",
              isColoredVariant ? "opacity-90" : "text-muted-foreground"
            )}>
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className={cn(
                "text-xs",
                isColoredVariant ? "opacity-75" : "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive",
                isColoredVariant && "opacity-90"
              )}>
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          {icon && (
            <div className={cn(
              "rounded-xl p-3",
              isColoredVariant ? "bg-white/10" : "bg-primary/5"
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

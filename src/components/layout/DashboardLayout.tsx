import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Trophy,
  Bell,
  Users,
  Upload,
  Download,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Award,
  Newspaper,
  Calendar,
  Archive,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contestsOpen, setContestsOpen] = useState(
    location.pathname.includes("/contests") || location.pathname.includes("/contest-memo")
  );
  const [casesOpen, setCasesOpen] = useState(
    location.pathname.includes("/cases") || location.pathname.includes("/today-cases")
  );

  const isAdmin = role === "admin" || user?.email === "admin@superachiever.com";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="rounded-lg bg-white/10 p-1">
              <img 
                src="/logo.png" 
                alt="SuperAchiever Logo" 
                className="h-10 w-13 object-contain" 
              />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">SuperAchiever</span>
            <button
              className="ml-auto lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            
            {/* Cases Dropdown/Collapsible */}
            <Collapsible open={casesOpen} onOpenChange={setCasesOpen} className="w-full">
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    (location.pathname.includes("/cases") || location.pathname.includes("/today-cases")) 
                      ? "text-sidebar-foreground" 
                      : "text-sidebar-foreground/70"
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span className="flex-1 text-left">Cases</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", casesOpen ? "rotate-0" : "-rotate-90")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 px-4 pt-1">
                <Link
                  to="/dashboard/today-cases"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    location.pathname === "/dashboard/today-cases"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4" />
                    <span>Today's Cases</span>
                  </div>
                  <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-200">
                    Daily
                  </Badge>
                </Link>
                <Link
                  to="/dashboard/cases"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    location.pathname === "/dashboard/cases"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Archive className="h-4 w-4" />
                    <span>All Cases</span>
                  </div>
                  <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-slate-500/10 text-slate-600 border-slate-200">
                    Archive
                  </Badge>
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Contests Dropdown/Collapsible */}
            <Collapsible open={contestsOpen} onOpenChange={setContestsOpen} className="w-full">
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    (location.pathname.includes("/contests") || location.pathname.includes("/contest-memo")) 
                      ? "text-sidebar-foreground" 
                      : "text-sidebar-foreground/70"
                  )}
                >
                  <Trophy className="h-5 w-5" />
                  <span className="flex-1 text-left">Contests</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", contestsOpen ? "rotate-0" : "-rotate-90")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 px-4 pt-1">
                <Link
                  to="/dashboard/contests"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    location.pathname === "/dashboard/contests"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  )}
                >
                  <Trophy className="h-4 w-4" />
                  Contest Standings
                </Link>
                <Link
                  to="/contest-memo"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    location.pathname === "/contest-memo"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  )}
                >
                  <Newspaper className="h-4 w-4" />
                  Contest Memos
                </Link>
              </CollapsibleContent>
            </Collapsible>

            <NavItem href="/dashboard/nais" icon={Award} label="NAIS 2026" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            <NavItem href="/dashboard/leaderboards" icon={Users} label="Leaderboards" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            <NavItem href="/dashboard/alerts" icon={Bell} label="Alerts" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            <NavItem href="/dashboard/product" icon={Info} label="Product Info" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            
            
            {isAdmin && (
              <NavItem href="/dashboard/reports" icon={Upload} label="Reports" currentPath={location.pathname} setSidebarOpen={setSidebarOpen} />
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
                <span className="text-xs font-semibold text-sidebar-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  {isAdmin ? "Admin Access" : role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center gap-4 px-4 lg:px-6">
            <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1" />
            {isAdmin && (
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/reports"><Upload className="h-4 w-4 mr-2" />Upload Report</Link>
                </Button>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
              </div>
            )}
            <UserMenu user={user} isAdmin={isAdmin} role={role} handleSignOut={handleSignOut} />
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

// Helper component for Navigation Items
function NavItem({ href, icon: Icon, label, currentPath, setSidebarOpen }: any) {
  const isActive = currentPath === href;
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      onClick={() => setSidebarOpen(false)}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

// Helper component for User Dropdown
function UserMenu({ user, isAdmin, role, handleSignOut }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{isAdmin ? "Admin" : role} Portal</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
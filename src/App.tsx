import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import Contests from "./pages/Contests";
import Leaderboards from "./pages/Leaderboards";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import NAIS from "./pages/NAIS"; // 1. IMPORT THE NEW PAGE
import NotFound from "./pages/NotFound";
import ContestMemo from "./pages/ContestMemo";
import TodayCases from "./pages/TodayCases";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/cases" element={<Cases />} />
            <Route path="/dashboard/contests" element={<Contests />} />
            <Route path="/dashboard/leaderboards" element={<Leaderboards />} />
            <Route path="/dashboard/alerts" element={<Alerts />} />
            <Route path="/dashboard/reports" element={<Reports />} />
            <Route path="/dashboard/today-cases" element={<TodayCases />} />
      

            {/* 2. ADD THE NAIS ROUTE HERE */}
            <Route path="/dashboard/nais" element={<NAIS />} />
            <Route path="/contest-memo" element={<ContestMemo />} 
/>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
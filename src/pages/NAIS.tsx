import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, UserPlus, UserMinus, Trophy, Star, CheckCircle2, 
  Info, Loader2, Search, ChevronDown, User 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// --- 1. TYPESCRIPT INTERFACES ---
interface Profile {
  id: string;
  agent_code: string;
  full_name: string;
  rank: string;
}

// --- 2. SKELETON COMPONENT ---
function NAISSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-pulse">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-64 bg-slate-100 rounded-md" />
        </div>
        <div className="h-11 w-32 bg-slate-100 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
            <div className="h-12 w-12 bg-slate-100 rounded-2xl" />
            <div className="h-8 w-24 bg-slate-200 rounded-md" />
            <div className="h-3 w-32 bg-slate-50 rounded-md" />
          </div>
        ))}
      </div>
      <div className="h-48 bg-white rounded-3xl border border-slate-100 grid md:grid-cols-2 divide-x divide-slate-100">
        <div className="p-8 space-y-4"><div className="h-4 w-1/3 bg-slate-100 rounded" /><div className="space-y-2"><div className="h-4 w-full bg-slate-50 rounded" /><div className="h-4 w-full bg-slate-50 rounded" /></div></div>
        <div className="p-8 space-y-4"><div className="h-4 w-1/3 bg-slate-100 rounded" /><div className="space-y-2"><div className="h-4 w-full bg-slate-50 rounded" /><div className="h-4 w-full bg-slate-50 rounded" /></div></div>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
        <div className="h-16 bg-[#0F172A]" />
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-slate-50">
              <div className="h-6 w-12 bg-slate-100 rounded" />
              <div className="h-6 w-48 bg-slate-100 rounded" />
              <div className="h-6 w-24 bg-slate-100 rounded" />
              <div className="h-6 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 3. MAIN PAGE COMPONENT ---
export default function NAIS() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contestants, setContestants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [activeSegment, setActiveSegment] = useState("Super Elite 1");
  const [currentAgentCode, setCurrentAgentCode] = useState<string | null>(null);
  
  const myRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => { fetchNAISData(); }, [user]);

  const fetchNAISData = async () => {
    try {
      setLoading(true);
      if (user) {
        const { data: myProfile } = await supabase.from("profiles").select("agent_code").eq("id", user.id).maybeSingle();
        if (myProfile) setCurrentAgentCode(myProfile.agent_code);
      }
      const { data: profiles } = await supabase.from("profiles").select("*") as { data: Profile[] | null };
      const { data: cases } = await (supabase.from("cases") as any).select("*");
      if (!profiles || !cases) return;

      const totals = cases.reduce((acc: any, curr: any) => {
        acc[curr.agent_id] = (acc[curr.agent_id] || 0) + Number(curr.premium || 0);
        return acc;
      }, {});

      const ranked = profiles.map((p) => ({
        name: p.full_name,
        agentCode: p.agent_code,
        designation: p.rank || "PP", 
        afyc: totals[p.agent_code] || 0,
      })).sort((a, b) => b.afyc - a.afyc);

      setContestants(ranked);
    } catch (error) { console.error("NAIS Fetch Error:", error); } finally { setLoading(false); }
  };

  const filteredBySegment = useMemo(() => { 
    return contestants.filter(agent => { 
      if (activeSegment === "Super Elite 1") return agent.afyc >= 15000; 
      if (activeSegment === "Super Elite 2") return agent.afyc >= 10000 && agent.afyc < 14999; 
      if (activeSegment === "Super Elite 3") return agent.afyc >= 5000 && agent.afyc < 9999; 
      if (activeSegment === "Super Elite 4") return agent.afyc < 2500; 
      return true; 
    }); 
    }, [contestants, activeSegment]);

  const finalParticipants = useMemo(() => {
    return filteredBySegment.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.agentCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredBySegment, searchTerm]);

  const displayedParticipants = finalParticipants.slice(0, visibleCount);

  const handleJumpToMe = () => {
    if (!currentAgentCode) return;
    const me = contestants.find(c => c.agentCode === currentAgentCode);
    if (!me) return;
    if (me.afyc >= 15000) setActiveSegment("Super Elite 1");
    else if (me.afyc >= 10000) setActiveSegment("Super Elite 2");
    else if (me.afyc >= 5000) setActiveSegment("Super Elite 3");
    else setActiveSegment("Super Elite 4");

    setSearchTerm("");
    setTimeout(() => {
      const myIdx = finalParticipants.findIndex(c => c.agentCode === currentAgentCode);
      if (myIdx >= visibleCount) setVisibleCount(myIdx + 1);
      setTimeout(() => myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }, 100);
  };

  return (
    <DashboardLayout>
      {loading ? (
        <NAISSkeleton />
      ) : (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto transition-opacity duration-500">
          {/* HEADER SECTION */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">NAIS 2026</h1>
              <p className="text-slate-500 font-medium">National Annual Incentive Summit Overview</p>
            </div>
            <div className="flex gap-3">
               <Button onClick={handleJumpToMe} variant="outline" className="rounded-2xl border-blue-200 text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 gap-2 h-11 px-6">
                  <User className="h-4 w-4" /> Jump to Me
               </Button>
               <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-4 py-2 rounded-2xl shadow-sm">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Elite Contest</span>
               </div>
            </div>
          </div>

          {/* TOP STAT BOXES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatBox title="Total Participants" value={contestants.length} icon={<Users className="text-blue-500" />} subtitle="Registered Agents" />
            <StatBox title="New This Week" value={80} icon={<UserPlus className="text-emerald-500" />} subtitle="+8% from last week" trend="up" />
            <StatBox title="Eliminated" value={20} icon={<UserMinus className="text-rose-500" />} subtitle="Did not meet pre-req" trend="down" />
          </div>

          {/* REQUIREMENT CARD */}
          <Card className="border-none shadow-md overflow-hidden rounded-3xl bg-white border border-slate-100">
            <div className="grid md:grid-cols-2 divide-x divide-slate-100">
              <div className="p-8 space-y-4">
                <div className="flex items-center gap-2 mb-2"><Info className="h-5 w-5 text-slate-400" /><h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Pre-requisite</h3></div>
                <ul className="space-y-3">
                  <RequirementItem text="Minimum 10 cases enforced by March 2026" />
                  <RequirementItem text="Attend NAIS briefing session" />
                  <RequirementItem text="Maintain minimum 90% persistency rate" />
                </ul>
              </div>
              <div className="p-8 space-y-4 bg-slate-50/30">
                <div className="flex items-center gap-2 mb-2"><Star className="h-5 w-5 text-amber-400" /><h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Final Requirements</h3></div>
                <ul className="space-y-3">
                  <RequirementItem text="Reach RM 100,000 Total AFYC" />
                  <RequirementItem text="3 Direct Recruits with 1 case each" />
                  <RequirementItem text="Full settlement of all outstanding balances" />
                </ul>
              </div>
            </div>
          </Card>

          {/* SEGMENT SELECTOR */}
          <div className="flex flex-wrap gap-2 p-2 bg-[#F8FAFC] rounded-full w-fit border border-slate-200/60 shadow-sm mx-auto">
            {["Super Elite 1", "Super Elite 2", "Super Elite 3", "Super Elite 4"].map((seg) => (
              <Button
                key={seg}
                variant="ghost"
                onClick={() => { setActiveSegment(seg); setVisibleCount(20); }}
                className={`rounded-full px-8 font-black text-[11px] uppercase tracking-[0.1em] transition-all h-10 ${
                  activeSegment === seg 
                    ? "bg-white text-[#0F172A] shadow-md border border-slate-100" 
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {seg}
              </Button>
            ))}
          </div>

          {/* RANKING TABLE */}
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white border border-slate-100">
            <CardHeader className="bg-[#0F172A] text-white flex flex-row items-center justify-between p-6">
              <CardTitle className="text-lg flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-amber-400" />Ranking Standings</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search agent..." 
                  className="bg-white/10 border-white/20 text-white rounded-xl pl-10 h-10 text-sm focus-visible:ring-0"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(20); }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="w-24 text-center font-bold text-slate-900">RANK</TableHead>
                    <TableHead className="font-bold text-slate-900">AGENT DETAILS</TableHead>
                    <TableHead className="font-bold text-slate-900">DESIGNATION</TableHead>
                    <TableHead className="text-right font-bold pr-8 text-slate-900">TOTAL AFYC (RM)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedParticipants.length > 0 ? displayedParticipants.map((agent, index) => {
                    const segmentRank = index + 1;
                    const isMe = currentAgentCode === agent.agentCode;
                    return (
                      <TableRow key={agent.agentCode} ref={isMe ? myRowRef : null} className={`border-l-4 transition-colors ${isMe ? "bg-blue-50 border-l-blue-500 shadow-inner" : "hover:bg-slate-50/50 border-l-transparent"}`}>
                        <TableCell className="text-center font-black">
                           {segmentRank <= 3 ? (segmentRank === 1 ? "🥇" : segmentRank === 2 ? "🥈" : "🥉") : <span className="text-slate-400">#{segmentRank}</span>}
                        </TableCell>
                        <TableCell>
                          <div className={`font-bold uppercase text-sm ${isMe ? "text-blue-900" : "text-slate-900"}`}>{agent.name} {isMe && <Badge className="ml-2 bg-blue-500 text-white text-[8px] h-4">YOU</Badge>}</div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{agent.agentCode}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-bold uppercase ${isMe ? "bg-blue-100 border-blue-200 text-blue-700" : "text-slate-600"}`}>
                            {agent.designation} 
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-black pr-8 text-base ${isMe ? "text-blue-700" : "text-slate-900"}`}>{agent.afyc.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-300 italic">No agents found in this tier.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {visibleCount < finalParticipants.length && (
                <div className="p-8 flex justify-center border-t bg-slate-50/50">
                  <Button onClick={() => setVisibleCount(v => v + 20)} variant="outline" className="rounded-xl px-12 h-11"><ChevronDown className="h-4 w-4 mr-2" />Show More</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS ---
function StatBox({ title, value, icon, subtitle, trend }: any) {
  return (
    <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden group hover:shadow-lg transition-all border border-slate-100">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Live</span>
          </div>
        </div>
        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p><div className="flex items-baseline gap-2"><h2 className="text-4xl font-black text-slate-900">{value.toLocaleString()}</h2>{trend && <span className={`text-xs font-black ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>{trend === 'up' ? '↑' : '↓'}</span>}</div><p className="text-[11px] text-slate-400 mt-1 font-medium italic">{subtitle}</p></div>
      </CardContent>
    </Card>
  );
}

function RequirementItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 group">
      <div className="mt-1 bg-emerald-50 text-emerald-500 p-0.5 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-colors"><CheckCircle2 className="h-3.5 w-3.5" /></div>
      <span className="text-sm font-bold text-slate-600 leading-tight">{text}</span>
    </li>
  );
}
import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plane, Zap, Search, Download, Printer, 
  BookOpen, Clock, CheckCircle2, Trophy, 
  Award, Star, TrendingUp, Users, Smartphone, Ticket 
} from "lucide-react";

const MEMO_DATA = [
  {
    id: "experience",
    title: "AIT Experience 2026 - Hanoi",
    category: "Overseas Trip",
    icon: <Plane className="w-5 h-5 text-blue-500" />,
    validity: "1 Jan 2026 - 30 June 2026",
    pdfLink: "/005 Memo AIT Experience 2026.pdf",
    overview: "Explore Hanoi, Vietnam! This is fasa pertama before moving toward the Agency Incentive Trip Summit/Star 2026.",
    sections: [
      { label: "Path A (Pre-Req)", content: "Meet Jan/Feb Pre-Req (RM 5k Rookie / RM 10k Agent) for a reduced total target of RM 75k (Rookie) or RM 100k (Agent)." },
      { label: "Path B (Standard)", content: "Total target of RM 95k (Rookie) or RM 120k (Agent) without Pre-Req." },
      { label: "Mandatory Maintenance", content: "Min. 1 case/month, 90% CYPR (Agent), and 15 hours CPD." }
    ]
  },
  {
    id: "rising-star",
    title: "AIT Rising Star 2026",
    category: "Rookie Reward",
    icon: <Smartphone className="w-5 h-5 text-indigo-500" />,
    validity: "1 Jan 2026 - 31 Dec 2026",
    pdfLink: "/002 Memo AIT Rising Star 2026.pdf",
    overview: "Special rewards for newly appointed agents to kickstart their career with tech and travel.",
    sections: [
      { label: "Level 1 (0+3 Months)", content: "RM 30,000 AFYC + 3 Cases + VB101 attendance for an iPad Voucher (RM 1,800)." },
      { label: "Level 2 (0+6 Months)", content: "RM 60,000 AFYC + 6 Cases for 1 Ticket to Yogyakarta." },
      { label: "Leader Category", content: "Direct Leaders with 3 qualifying Rising Stars earn 1 Ticket to Yogyakarta." }
    ]
  },
  {
    id: "grow-big",
    title: "Grow Big With Quality 2026",
    category: "Leadership Bonus",
    icon: <TrendingUp className="w-5 h-5 text-rose-500" />,
    validity: "1 Jan 2026 - 30 June 2026 ",
    pdfLink: "/008 Memo Grow Big With Quality.pdf",
    overview: "Reward for Agency Directors and Group Agency Directors focusing on quality recruitment and AFYC growth.",
    sections: [
      { label: "Direct Category", content: "Monthly rewards up to RM 30,000 and Quarterly rewards up to RM 90,000 based on AFYC growth (20%-40%)." },
      { label: "Group Category", content: "Group Agency Directors can earn additional bonuses up to RM 90,000 quarterly." },
      { label: "NALIS Exclusion", content: "Leaders under the NALIS program are NOT eligible for this campaign." }
    ]
  },
  {
    id: "enac",
    title: "eNAC 2026",
    category: "Mid-Year Congress",
    icon: <Ticket className="w-5 h-5 text-amber-500" />,
    validity: "1 Jan 2026 - 30 June 2026 ",
    pdfLink: "/006 Memo eNAC 2026.pdf",
    overview: "Platform to inspire agents for the mid-year point with sharing sessions and recognition.",
    sections: [
      { label: "Rookie Tickets", content: "3 cases (P1) + 3 cases (P2) for Ordinary ticket; 6+6 cases for VIP ticket." },
      { label: "Personal Producer", content: "12+12 cases for Ordinary ticket; 24+24 cases for VIP ticket." },
      { label: "Leader Requirements", content: "Based on number of winners produced in the agency and active manpower." }
    ]
  },
  {
    id: "all-stars",
    title: "All-Stars 2026",
    category: "Annual Awards",
    icon: <Star className="w-5 h-5 text-yellow-500" />,
    validity: "1 Jan 2026 - 31 Dec 2026 ",
    pdfLink: "/003 Memo All Stars 2026.pdf",
    overview: "The most prestigious recognition platform for all agent ranks and achievement categories.",
    sections: [
      { label: "Club Categories", content: "Platinum, Gold, Silver, and Bronze clubs based on AFYC and New Recruits." },
      { label: "Excellence Leadership", content: "Special recognition for GADs/ADs reaching Super Mega Star status (RM 10M / RM 5M targets)." },
      { label: "MDRT Builder", content: "Rewards for leaders who develop at least two MDRT qualifiers." }
    ]
  },
  {
    id: "aspirant",
    title: "All-Stars Aspirant 2026",
    category: "New Talent Award",
    icon: <Award className="w-5 h-5 text-purple-500" />,
    validity: "1 Jan 2026 - 31 July 2026 ",
    pdfLink: "/004 Memo All Stars Aspirant 2026.pdf",
    overview: "Designed for new recruits and newly promoted leaders to foster healthy competition.",
    sections: [
      { label: "Rookie Y1/Y2", content: "Awards for highest AFYC and case count, including reaching RM 50k/RM 100k milestones." },
      { label: "New Leader Growth", content: "1 Ticket to All-Stars Aspirant 2026 for newly promoted AD/GADs meeting AFYC targets." },
      { label: "VB101 & CPD", content: "Requires 18 hours of CPD and VB101 attendance for qualifiers." }
    ]
  },
  {
    id: "consistent-agent",
    title: "Consistent Club (Agent)",
    category: "Monthly Cash",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    validity: "1 Jan 2026 - 30 June 2026 ",
    pdfLink: "/007 Memo Consistent Club (Agent ONLY).pdf",
    overview: "For Rookie Year 2 and existing Agents NOT in NAIS, rewarding sustained monthly activity.",
    sections: [
      { label: "Monthly Bonus", content: "Cash rewards of RM 100 to RM 1,000 based on consecutive monthly case counts." },
      { label: "Quarterly Reward", content: "Accumulated production bonuses ranging from RM 50 to RM 200 per case depending on AFYC." },
      { label: "CYPR Requirement", content: "Must maintain a minimum Current Year Persistency Ratio of 90%." }
    ]
  },
  {
    id: "consistent-ry1",
    title: "Consistent Club (RY1)",
    category: "Rookie Cash",
    icon: <Zap className="w-5 h-5 text-orange-500" />,
    validity: "1 Jan 2026 - 30 June 2026.",
    pdfLink: "/007 Consistent Club (2) .pdf",
    overview: "Cash incentives for RY1 agents (non-NAIS) for achieving consistency in their first 3 months.",
    sections: [
      { label: "Tier 1 (Monthly)", content: "RM 3,500 bonus for 3 cases/mo + RM 36k AFYC across Month 0 to Month 3." },
      { label: "Tier 2 (Accumulative)", content: "RM 2,500 reward for 6 cases + RM 30k AFYC over 3 months." },
      { label: "VB101 & CYPR", content: "Mandatory VB101 attendance and 90% CYPR maintenance." }
    ]
  }
];

export default function ContestMemo() {
  const [selectedId, setSelectedId] = useState("experience");
  const [searchTerm, setSearchTerm] = useState("");

  const activeMemo = useMemo(() => 
    MEMO_DATA.find(m => m.id === selectedId) || MEMO_DATA[0], 
  [selectedId]);

  const filteredMemos = useMemo(() => 
    MEMO_DATA.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())), 
  [searchTerm]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-120px)] gap-6 p-4 md:p-8 bg-slate-50/30">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-80 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
              Contest <span className="text-blue-600">Memos</span>
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Official Circulars</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search memo..." 
              className="pl-10 bg-white rounded-2xl border-slate-200 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <nav className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {filteredMemos.map((memo) => (
              <button
                key={memo.id}
                onClick={() => setSelectedId(memo.id)}
                className={`w-full flex flex-col p-4 rounded-3xl transition-all border ${
                  selectedId === memo.id 
                    ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]" 
                    : "bg-white border-slate-100 text-slate-600 hover:border-blue-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${selectedId === memo.id ? "bg-white/10" : "bg-slate-50"}`}>
                    {memo.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black uppercase tracking-tight leading-none mb-1">{memo.title}</p>
                    <p className={`text-[10px] font-bold ${selectedId === memo.id ? "text-blue-400" : "text-slate-400"}`}>
                      {memo.category}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* DOCUMENT CONTENT VIEWER */}
        <main className="flex-1">
          <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white flex flex-col h-full border border-slate-100">
            <div className="p-8 md:p-12 bg-slate-50 border-b border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-600 px-4 py-1 text-[10px] font-black uppercase tracking-widest">Confidential</Badge>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                      <Clock className="w-3 h-3" /> {activeMemo.validity}
                    </div>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    {activeMemo.title}
                  </h2>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <Button variant="outline" className="flex-1 md:flex-none rounded-2xl h-12 border-slate-200 text-xs font-bold uppercase">
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </Button>
                  <Button 
                    asChild 
                    className="flex-1 md:flex-none rounded-2xl h-12 bg-slate-900 hover:bg-slate-800 font-black text-xs uppercase shadow-lg"
                  >
                    <a href={activeMemo.pdfLink} download>
                      <Download className="w-4 h-4 mr-2" /> Download PDF
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <CardContent className="p-8 md:p-12 space-y-12 overflow-y-auto">
              <div className="max-w-4xl space-y-10">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <BookOpen className="w-5 h-5" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em]">1.0 Executive Summary</h3>
                  </div>
                  <p className="text-xl text-slate-700 leading-relaxed font-medium italic border-l-4 border-slate-200 pl-6">
                    "{activeMemo.overview}"
                  </p>
                </section>

                <div className="grid gap-6">
                  {activeMemo.sections.map((section, index) => (
                    <div key={index} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 transition-hover hover:bg-slate-50">
                      <div className="flex items-start gap-5">
                        <div className="w-10 h-10 rounded-2xl bg-white shadow-sm text-slate-900 flex items-center justify-center text-xs font-black shrink-0 border border-slate-100">
                          {index + 2}.0
                        </div>
                        <div className="space-y-3 w-full pt-1">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">{section.label}</h4>
                          <div className="text-slate-600 leading-relaxed text-sm md:text-base">
                            {section.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </DashboardLayout>
  );
}
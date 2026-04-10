import { useEffect, useState } from "react";
import { Calendar, Sparkles, Zap, Star } from "lucide-react";
import { format } from "date-fns";

interface SuperAchieverHeaderProps {
  lastUploadDate?: string | null;
}

export function SuperAchieverHeader({ lastUploadDate }: SuperAchieverHeaderProps) {
  const [displayText, setDisplayText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const fullText = "SUPERACHIEVER";
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setDisplayText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTypingComplete(true); // Mark typing as complete
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-8 shadow-2xl">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-50">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%' height='100%' fill='url(%23grid)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
      </div>

      {/* Animated Floating Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float rounded-full bg-white/10"
            style={{
              width: Math.random() * 150 + 50,
              height: Math.random() * 150 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 15 + 10}s`,
            }}
          />
        ))}
      </div>

      {/* Animated Gradient Orbs */}
      <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-blue-400/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 animate-pulse-slow rounded-full bg-indigo-400/20 blur-3xl" style={{ animationDelay: "2s" }} />
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse-slow rounded-full bg-yellow-400/10 blur-3xl" style={{ animationDelay: "4s" }} />

      {/* Animated Shooting Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute h-0.5 w-32 animate-shoot-star bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: "2s",
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="space-y-0 text-center md:text-left">
            {/* Animated Badge */}
            <div className="mb-2 inline-flex animate-fade-in-up items-center gap-2 rounded-full bg-yellow-400/10 px-3 py-1 backdrop-blur-sm">
              <Sparkles className="h-3 w-3 animate-pulse text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">ELITE DASHBOARD</span>
            </div>

            {/* Main Title with Typing Effect - No bottom margin */}
            <div className="relative">
              <h1 className="text-5xl font-black tracking-wider leading-tight md:text-8xl">
                {displayText.split('').map((char, index) => (
                  <span
                    key={index}
                    className="inline-block bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 bg-[length:200%_200%] bg-clip-text text-transparent transition-transform duration-300 hover:scale-110"
                    style={{
                      // Only apply gradient animation if typing is not complete
                      animation: typingComplete ? 'none' : 'gradient-shift 2s ease infinite',
                      animationDelay: `${index * 0.05}s`,
                      display: "inline-block",
                    }}
                  >
                    {char}
                  </span>
                ))}
                {/* Animated Cursor - Hide when typing is complete */}
                {!typingComplete && (
                  <span className="inline-block h-12 w-1 animate-blink bg-yellow-400 align-middle" />
                )}
              </h1>
            </div>

            {/* Animated Underline - Directly below text with minimal gap */}
            <div className="mt-0 h-1 w-0 animate-expand-width rounded-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400" />

            {/* Subtitle with Animated Icons */}
            <div className="flex items-center justify-center gap-2 pt-3 text-sm font-medium text-white/70 md:justify-start animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
              <span>Track. Perform. Excel.</span>
              <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
            </div>
          </div>

          {/* Last Upload Badge - Enhanced */}
          {lastUploadDate && (
            <div className="group relative animate-fade-in-right cursor-pointer">
              {/* Glow effect */}
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 opacity-0 blur transition duration-500 group-hover:opacity-75" />
              
              {/* Badge Content */}
              <div className="relative flex items-center gap-3 rounded-full bg-blue-800/50 px-5 py-3 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-800/70">
                <div className="relative">
                  <Calendar className="h-5 w-5 text-yellow-400" />
                  <div className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-yellow-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/60">Last Report 316 Upload</span>
                  <span className="text-sm font-bold text-yellow-400">
                    {format(new Date(lastUploadDate), "dd MMM yyyy, HH:mm")}
                  </span>
                </div>
                <Star className="h-4 w-4 text-yellow-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </div>
          )}
        </div>

        {/* Decorative Stats Row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-4 md:justify-start">
          {[
            { label: "Real-time Updates", value: "Active" },
            { label: "System Status", value: "Online" },
            { label: "Data Sync", value: "Live" },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 backdrop-blur-sm animate-fade-in-up"
              style={{ animationDelay: `${0.7 + idx * 0.1}s` }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/60">{stat.label}:</span>
              <span className="text-xs font-semibold text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Animated Border Glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />

      {/* Add CSS animations */}
      <style>{`
        @keyframes shoot-star {
          0% {
            transform: translateX(-100%) translateY(-100%) rotate(45deg);
            opacity: 1;
          }
          100% {
            transform: translateX(200%) translateY(200%) rotate(45deg);
            opacity: 0;
          }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        @keyframes expand-width {
          0% { width: 0%; opacity: 0; }
          100% { width: 100%; opacity: 1; }
        }
        
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-shoot-star {
          animation: shoot-star 2s linear infinite;
        }
        
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        
        .animate-expand-width {
          animation: expand-width 1s ease-out forwards;
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
        
        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .animate-fade-in-right {
          animation: fade-in-right 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
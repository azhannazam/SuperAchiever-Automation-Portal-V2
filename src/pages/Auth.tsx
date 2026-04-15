import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, AlertCircle, Loader2, ArrowRight, CheckCircle2, Sparkles, Mail, Lock, User, Eye, EyeOff, Zap, Crown, TrendingUp, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
  transition: { duration: 0.5, ease: "easeOut" }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const scaleOnHover = {
  whileHover: { scale: 1.05, transition: { duration: 0.2 } },
  whileTap: { scale: 0.95 }
};

const floatAnimation = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};

const pulseGlow = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(59,130,246,0)",
      "0 0 0 10px rgba(59,130,246,0.2)",
      "0 0 0 0 rgba(59,130,246,0)"
    ],
    transition: { duration: 2, repeat: Infinity }
  }
};

export default function Auth() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse delay-2000" />
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, -100, 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Left side - Branding with Animations */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative"
      >
        {/* Main Content */}
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-md text-center space-y-8 relative z-10"
        >
          <motion.div 
            variants={fadeInUp}
            whileHover={{ scale: 1.05 }}
            className="flex justify-center"
          >
            <motion.div 
              animate={{ 
                boxShadow: ["0 0 0 0 rgba(255,255,255,0.2)", "0 0 0 20px rgba(255,255,255,0)", "0 0 0 0 rgba(255,255,255,0)"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-2xl bg-white/10 backdrop-blur-sm p-4 border border-white/20"
            >
              <img 
                src="/logo.png" 
                alt="SuperAchiever Logo" 
                className="h-40 w-auto object-contain" 
              />
            </motion.div>
          </motion.div>
          
          <motion.h1 
            variants={fadeInUp}
            className="text-5xl font-black text-white tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"
          >
            SuperAchiever
          </motion.h1>
          
          <motion.p 
            variants={fadeInUp}
            className="text-lg text-white/70"
          >
            Streamline your insurance case management with real-time tracking, 
            automated alerts, and live contest leaderboards.
          </motion.p>
          
          <motion.div 
            variants={fadeInUp}
            className="grid grid-cols-2 gap-4 pt-8"
          >
            {[
              { icon: <Users className="h-6 w-6" />, title: "Agent Portal", desc: "Track your cases & rankings" },
              { icon: <Shield className="h-6 w-6" />, title: "Admin Portal", desc: "Full case management" },
              { icon: <Crown className="h-6 w-6" />, title: "Contests", desc: "Compete & win rewards" },
              { icon: <TrendingUp className="h-6 w-6" />, title: "Analytics", desc: "Real-time insights" }
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                whileHover={{ scale: 1.05, y: -5 }}
                className="rounded-xl bg-white/10 backdrop-blur-sm p-4 text-left border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="text-white/90 mb-2">{item.icon}</div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-white/60">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Powered by Logo at Bottom */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 opacity-60"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-semibold">
            Powered by
          </p>
          <img 
            src="/logo1.png" 
            alt="Powered by" 
            className="h-12 w-auto brightness-0 invert" 
          />
        </motion.div>
      </motion.div>

      {/* Right side - Auth forms with Animations */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            <CardHeader className="space-y-1 text-center pt-8">
              <motion.div 
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                className="lg:hidden flex justify-center mb-4"
              >
                <div className="rounded-xl bg-gradient-to-br from-primary to-primary/60 p-3">
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="h-8 w-8 object-contain brightness-0 invert" 
                  />
                </div>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Enter your credentials to access your dashboard
                </CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent className="pb-8">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
                <motion.div variants={fadeInUp}>
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger 
                      value="login" 
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-300"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </motion.div>
                
                <AnimatePresence mode="wait">
                  <TabsContent value="login">
                    <LoginForm />
                  </TabsContent>
                  
                  <TabsContent value="signup">
                    <SignupForm onSuccess={() => setActiveTab("login")} />
                  </TabsContent>
                </AnimatePresence>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse({ email, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to sign in");
    }
  };

  return (
    <motion.form 
      key="login"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit} 
      className="space-y-5"
    >
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "pl-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.email && "border-destructive focus:border-destructive"
            )}
          />
        </div>
        {errors.email && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.email}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              "pl-10 pr-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.password && "border-destructive focus:border-destructive"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.password}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
            </>
          ) : (
            <>
              Sign In <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.form>
  );
}

function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  const checkPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.match(/[a-z]/) && pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/[0-9]/)) strength++;
    if (pwd.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse({ email, password, fullName, confirmPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } else {
      toast.success("Account created! Please check your email to verify your account.");
      onSuccess();
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength === 0) return "bg-slate-200";
    if (passwordStrength === 1) return "bg-red-500";
    if (passwordStrength === 2) return "bg-orange-500";
    if (passwordStrength === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength === 0) return "No password";
    if (passwordStrength === 1) return "Weak";
    if (passwordStrength === 2) return "Fair";
    if (passwordStrength === 3) return "Good";
    return "Strong";
  };

  return (
    <motion.form 
      key="signup"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit} 
      className="space-y-4"
    >
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="fullName" className="text-slate-700 font-medium">Full Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="fullName"
            type="text"
            placeholder="Azhan Nazam"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={cn(
              "pl-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.fullName && "border-destructive"
            )}
          />
        </div>
        {errors.fullName && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.fullName}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="signupEmail" className="text-slate-700 font-medium">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="signupEmail"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "pl-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.email && "border-destructive"
            )}
          />
        </div>
        {errors.email && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.email}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="signupPassword" className="text-slate-700 font-medium">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="signupPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              checkPasswordStrength(e.target.value);
            }}
            className={cn(
              "pl-10 pr-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.password && "border-destructive"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i < passwordStrength ? getStrengthColor() : "bg-slate-200"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Password strength: <span className={cn("font-semibold", getStrengthColor().replace("bg-", "text-"))}>{getStrengthText()}</span>
            </p>
          </div>
        )}
        {errors.password && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.password}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp} className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm Password</Label>
        <div className="relative">
          <CheckCircle2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn(
              "pl-10 pr-10 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 transition-all duration-300",
              errors.confirmPassword && "border-destructive"
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword && password === confirmPassword && password.length > 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Passwords match
          </motion.p>
        )}
        {errors.confirmPassword && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.confirmPassword}
          </motion.p>
        )}
      </motion.div>
      
      <motion.div variants={fadeInUp}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Create Account
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.form>
  );
}
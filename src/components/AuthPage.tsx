import React, { useState } from "react";
import { authService } from "../firebase";
import CustomSelect from "./CustomSelect";
import { 
  Sparkles, Mail, Lock, User, Phone, CheckCircle2, AlertCircle, RefreshCw, 
  ArrowRight, ShieldCheck, HelpCircle, Eye, EyeOff, Globe
} from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

// Popular nationalities
const NATIONALITIES = [
  { value: "Malaysia", label: "🇲🇾 Malaysia" },
  { value: "Singapore", label: "🇸🇬 Singapore" },
  { value: "Indonesia", label: "🇮🇩 Indonesia" },
  { value: "United States", label: "🇺🇸 United States" },
  { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "India", label: "🇮🇳 India" },
  { value: "Japan", label: "🇯🇵 Japan" },
  { value: "Thailand", label: "🇹🇭 Thailand" },
  { value: "Vietnam", label: "🇻🇳 Vietnam" },
  { value: "Philippines", label: "🇵🇭 Philippines" },
  { value: "Germany", label: "🇩🇪 Germany" },
  { value: "France", label: "🇫🇷 France" },
  { value: "Brazil", label: "🇧🇷 Brazil" },
  { value: "South Africa", label: "🇿🇦 South Africa" }
];

// Popular country codes with flags
const COUNTRY_CODES = [
  { code: "+1", name: "🇺🇸 US / Canada" },
  { code: "+44", name: "🇬🇧 United Kingdom" },
  { code: "+61", name: "🇦🇺 Australia" },
  { code: "+65", name: "🇸🇬 Singapore" },
  { code: "+60", name: "🇲🇾 Malaysia" },
  { code: "+91", name: "🇮🇳 India" },
  { code: "+81", name: "🇯🇵 Japan" },
  { code: "+49", name: "🇩🇪 Germany" },
  { code: "+33", name: "🇫🇷 France" },
  { code: "+852", name: "🇭🇰 Hong Kong" },
  { code: "+62", name: "🇮🇩 Indonesia" },
  { code: "+66", name: "🇹🇭 Thailand" },
  { code: "+84", name: "🇻🇳 Vietnam" },
  { code: "+63", name: "🇵🇭 Philippines" },
  { code: "+55", name: "🇧🇷 Brazil" },
  { code: "+27", name: "🇿🇦 South Africa" }
];

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  
  // Input fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("+1");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("Malaysia");
  
  // Visual fields
  const [showPassword, setShowPassword] = useState(false);
  
  // Flow states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Help state
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (mode === "login") {
        await authService.login(email, password);
        setSuccess("Welcome back! Loading your premium wellness dashboard...");
        setTimeout(() => {
          onAuthSuccess();
        }, 1200);
      } else {
        await authService.register(email, password, name, phoneCountry, phone, nationality);
        setSuccess("Account registered successfully! Welcome to smart health tracking.");
        setTimeout(() => {
          onAuthSuccess();
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please verify your entries.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      await authService.loginWithGoogle();
      setSuccess("Logged in successfully via Google SSO!");
      setTimeout(() => {
        onAuthSuccess();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google authentication was aborted or failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none" id="auth-page-root">
      
      {/* Brand logo at top */}
      <div className="text-center mb-8 animate-fade-in-down">
        <div className="inline-flex items-center gap-3 bg-indigo-600/5 px-4 py-2.5 rounded-full border border-indigo-100 mb-4 shadow-sm">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Sparkles className="w-5 h-5 fill-indigo-200 animate-pulse" />
          </div>
          <span className="font-display font-extrabold text-indigo-950 tracking-tight text-sm">NutriScan AI</span>
          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">v2.0</span>
        </div>
        <h2 className="text-2xl font-display font-black text-slate-800 tracking-tight leading-none">
          Your Intelligent Wellness Buddy
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
          AI calorie estimation, micro & macro tracking, and interactive sports science calculations built with beautiful Material Design 3.
        </p>
      </div>

      <div className="w-full max-w-md bg-white border border-gray-100 rounded-[32px] p-8 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.06)] relative overflow-hidden transition-all duration-300">
        
        {/* Sliding colored accent tab */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500"></div>

        {/* Action Toggle Tab */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              mode === "login" 
                ? "bg-white text-indigo-700 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 text-center py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              mode === "register" 
                ? "bg-white text-indigo-700 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-2xl flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Main interactive form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === "register" && (
            <>
              <div className="animate-fade-in">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jun Chun"
                    className="w-full bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                    required={mode === "register"}
                  />
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="animate-fade-in">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Nationality / Country</label>
                <div className="relative">
                  <CustomSelect
                    value={nationality}
                    onChange={(val) => setNationality(val)}
                    options={NATIONALITIES}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                required
              />
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {mode === "register" && (
            <div className="animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Mobile Phone (For lookup)</label>
              <div className="flex gap-2 items-center">
                {/* Custom select for country codes */}
                <div className="w-28 flex-shrink-0">
                  <CustomSelect
                    value={phoneCountry}
                    onChange={(val) => setPhoneCountry(val)}
                    align="left"
                    options={COUNTRY_CODES.map((c) => ({
                      value: c.code,
                      label: `${c.name.split(" ")[0]} ${c.code}`
                    }))}
                  />
                </div>
                
                <div className="relative flex-1 min-w-0">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="8123-4567"
                    className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                    required={mode === "register"}
                  />
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1 px-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setError("Password reset link will be sent to your email! (Simulator fallback active)")}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-2xl pl-10 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                required
                minLength={6}
              />
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-sm py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 cursor-pointer mt-6"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === "login" ? "Sign In to My Dashboard" : "Register & Start Tracking"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-x-0 h-px bg-slate-100"></div>
          <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Or Connect With</span>
        </div>

        {/* Social Buttons */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700 font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs active:scale-[0.98]"
        >
          {/* Custom vector logo representing Google */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.44 1.76 14.93 1 12 1 7.37 1 3.4 3.66 1.48 7.5l3.8 2.94C6.22 7.15 8.9 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.75-4.87 3.75-8.5z" />
            <path fill="#FBBC05" d="M5.28 14.44c-.24-.71-.38-1.47-.38-2.26s.14-1.55.38-2.26L1.48 6.98C.54 8.87 0 10.99 0 13.25c0 2.26.54 4.38 1.48 6.27l3.8-3.08z" />
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.1 0-5.78-2.11-6.72-5.4l-3.8 2.94C3.4 20.34 7.37 23 12 23z" />
          </svg>
          <span>Auth with Google Account</span>
        </button>

      </div>

      <p className="text-[10px] text-slate-400 mt-6 tracking-wide font-medium">
        © 2026 NutriScan AI. Protected, Secure & Fully Encrypted.
      </p>
    </div>
  );
}

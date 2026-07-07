import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import MealScanner from "./components/MealScanner";
import FitnessTracker from "./components/FitnessTracker";
import ProfileSettings from "./components/ProfileSettings";
import AuthPage from "./components/AuthPage";
import CustomDatePicker from "./components/CustomDatePicker";
import AiTips from "./components/AiTips";
import { authService, dbService } from "./firebase";
import { 
  Flame, Sparkles, Scale, Dumbbell, User, Calendar, Heart, Menu, X, CheckSquare, RefreshCw, Lightbulb, MessageSquareCode
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "scanner" | "fitness" | "profile" | "tips">("dashboard");
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appName, setAppName] = useState("NutriScan AI");

  // Format today's date in local time as YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeDate, setActiveDate] = useState(getTodayString());
  const [triggerRefresh, setTriggerRefresh] = useState(0);

  // Subscribe to Authentication state dynamically
  useEffect(() => {
    const unsubscribe = authService.onAuthChanged((currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [triggerRefresh]);

  // Simple state trigger to refresh the children components
  const refreshLogs = () => {
    setTriggerRefresh(prev => prev + 1);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setActiveDate(e.target.value);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(activeDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setActiveDate(`${year}-${month}-${day}`);
  };

  // If Auth states have not been checked yet, show a clean, high-fidelity loading splash
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-xs font-black text-indigo-950 tracking-tight uppercase">Initializing cloud session...</p>
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect them directly to the beautiful MD3 sign-in experience
  if (!user) {
    return (
      <AuthPage onAuthSuccess={() => refreshLogs()} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-root-shell">
      {/* Centered Brand Logo Badge (No Bar Layout - Matches Login Page size & style) */}
      <header className="w-full flex flex-col items-center justify-center pt-8 pb-4 bg-transparent px-4">
        <div className="inline-flex items-center gap-3 bg-indigo-600/5 px-4 py-2.5 rounded-full border border-indigo-100 mb-2 shadow-sm animate-fade-in-down">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Sparkles className="w-5 h-5 fill-indigo-200 animate-pulse" />
          </div>
          <span className="font-display font-extrabold text-indigo-950 tracking-tight text-sm">NutriScan AI</span>
          <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">v2.0</span>
        </div>

        {/* Desktop Navigation Links (Centered elegant borderless pills) */}
        <nav className="hidden lg:flex items-center gap-1.5 mt-3 bg-white border border-slate-100 p-1.5 rounded-2xl shadow-3xs">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
            id="nav-dashboard"
          >
            Diary Dashboard
          </button>
          <button
            onClick={() => setActiveTab("fitness")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "fitness"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
            id="nav-fitness"
          >
            Fitness Tracker
          </button>
          <button
            onClick={() => setActiveTab("scanner")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "scanner"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
            id="nav-scanner"
          >
            AI Meal Scan
          </button>
          <button
            onClick={() => setActiveTab("tips")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "tips"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                : "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/50"
            }`}
            id="nav-tips"
          >
            <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-500 animate-pulse" />
            <span>AI Coach</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "profile"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
            id="nav-goals"
          >
            My Profile
          </button>
        </nav>

        {/* Date Selector for Tablet & Desktop - ONLY on Diary Tab, rendered beautifully below nav */}
        {activeTab === "dashboard" && (
          <div className="hidden sm:flex items-center gap-2 mt-4 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-3xs">
            <button
              onClick={() => shiftDate(-1)}
              className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-50 rounded-xl transition-all text-xs font-extrabold cursor-pointer"
              id="btn-date-prev"
            >
              ◀
            </button>
            <CustomDatePicker
              value={activeDate}
              onChange={(newVal) => setActiveDate(newVal)}
              align="right"
            />
            <button
              onClick={() => shiftDate(1)}
              className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-50 rounded-xl transition-all text-xs font-extrabold cursor-pointer"
              id="btn-date-next"
            >
              ▶
            </button>
          </div>
        )}
      </header>

      {/* Date Switcher for Mobile - ONLY on Diary Tab */}
      {activeTab === "dashboard" && (
        <div className="sm:hidden bg-white border-b border-slate-100 p-2.5 px-4 flex justify-between items-center shadow-2xs">
          <button
            onClick={() => shiftDate(-1)}
            className="text-slate-500 active:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
          >
            ◀ Prev
          </button>
          <CustomDatePicker
            value={activeDate}
            onChange={(newVal) => setActiveDate(newVal)}
            align="left"
          />
          <button
            onClick={() => shiftDate(1)}
            className="text-slate-500 active:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
          >
            Next ▶
          </button>
        </div>
      )}

      {/* Main Container Content - Offset with pb-24 on mobile so bottom tab bar doesn't cover anything */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-8">
        {activeTab === "dashboard" && (
          <Dashboard 
            activeDate={activeDate} 
            triggerRefresh={triggerRefresh}
            onRefreshNeeded={refreshLogs}
            onNavigateToScan={() => setActiveTab("scanner")}
          />
        )}
        {activeTab === "scanner" && (
          <MealScanner 
            onMealLogged={refreshLogs} 
            activeDate={activeDate}
          />
        )}
        {activeTab === "fitness" && (
          <FitnessTracker 
            onRefreshNeeded={refreshLogs} 
            activeDate={activeDate}
          />
        )}
        {activeTab === "profile" && (
          <ProfileSettings 
            onProfileUpdated={refreshLogs}
            onAppNameChanged={(name) => setAppName(name)}
            currentAppName={appName}
          />
        )}
        {activeTab === "tips" && (
          <AiTips />
        )}
      </main>

      {/* Premium Native-Feeling Mobile Bottom Navigation Tab Bar (Hidden on Desktop) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around items-center h-auto pt-2 pb-safe z-50 px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === "dashboard" ? "text-indigo-600 scale-105" : "text-gray-400"
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] font-extrabold tracking-tight">Diary</span>
        </button>

        <button
          onClick={() => setActiveTab("fitness")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === "fitness" ? "text-indigo-600 scale-105" : "text-gray-400"
          }`}
        >
          <Dumbbell className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] font-extrabold tracking-tight">Fitness</span>
        </button>
        
        {/* Prominent CTA in the absolute middle of the navbar as requested */}
        <button
          onClick={() => setActiveTab("scanner")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative cursor-pointer ${
            activeTab === "scanner" ? "text-indigo-600" : "text-gray-400"
          }`}
        >
          <div className="absolute -top-5 bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white p-3 rounded-full shadow-lg shadow-indigo-200 border-4 border-white transition-all transform active:scale-90">
            <Sparkles className="w-4 h-4 fill-indigo-200" />
          </div>
          <span className="text-[9px] font-extrabold tracking-tight mt-6">Scan AI</span>
        </button>

        <button
          onClick={() => setActiveTab("tips")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === "tips" ? "text-indigo-600 scale-105" : "text-gray-400"
          }`}
        >
          <Lightbulb className="w-4 h-4 mb-0.5 text-amber-500 fill-amber-100" />
          <span className="text-[9px] font-extrabold tracking-tight">AI Coach</span>
        </button>

        {/* Changed Goals button to full Profile Button as requested */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === "profile" ? "text-indigo-600 scale-105" : "text-gray-400"
          }`}
        >
          <User className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] font-extrabold tracking-tight">Profile</span>
        </button>
      </div>

      {/* Simple Footer Brand (Hidden on Mobile for native app-like elegance) */}
      <footer className="hidden sm:block bg-white border-t border-gray-100 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>© 2026 {appName}. Secured & Synced with Firebase Firestore Cloud Storage.</p>
          <p className="mt-1">All images are processed securely using server-side Gemini AI models.</p>
        </div>
      </footer>
    </div>
  );
}

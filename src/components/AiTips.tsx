import React, { useState, useEffect, useRef } from "react";
import { UserProfile, UserGoals } from "../types";
import { dbService } from "../firebase";
import { 
  Sparkles, RefreshCw, AlertTriangle, CheckCircle2, TrendingDown, 
  TrendingUp, Heart, Smile, Activity, Info, Globe, Award, ShieldAlert,
  Apple, Dumbbell, Zap, Send, MessageSquare, ArrowRight, Eye, Play, Utensils
} from "lucide-react";

// Helper for dynamic API routing in production/mobile builds
const getApiUrl = (endpoint: string): string => {
  const baseUrl = (import.meta as any).env.VITE_API_BASE_URL || "";
  if (baseUrl) {
    const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${cleanBase}${cleanEndpoint}`;
  }
  return endpoint;
};

interface AiTipsResponse {
  bmi: number;
  bmiCategory: "Underweight" | "Normal" | "Overweight" | "Obese";
  bmiStatusExplanation: string;
  standardBmiRange: string;
  standardWeightRangeKg: string;
  recommendedCalories: number;
  macroRatioTips: {
    protein: string;
    carbs: string;
    fat: string;
  };
  nationalityDietContext: {
    country: string;
    traditionalFoodsToReduce: string[];
    traditionalFoodsToIncrease: string[];
    localizedHealthyAlternatives: string[];
    generalAdvice: string;
  };
  lifestyleTips: {
    reduce: string[];
    increase: string[];
    habits: string[];
  };
}

export default function AiTips() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [aiTips, setAiTips] = useState<AiTipsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Sub-navigation: "plan" (My Personal Roadmap) vs "chat" (Conversational Coach Chat)
  const [activeCoachTab, setActiveCoachTab] = useState<"plan" | "chat">("plan");

  // Chat conversational states
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (activeCoachTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeCoachTab, isAsking]);

  // Save chat history to localStorage whenever it changes, but ONLY after it has been initially loaded to prevent overwriting
  useEffect(() => {
    if (profile && chatHistoryLoaded) {
      localStorage.setItem(`ai_coach_chat_${profile.name || "user"}`, JSON.stringify(chatHistory));
    }
  }, [chatHistory, profile, chatHistoryLoaded]);

  // Load user biometrics and cached tips on mount
  useEffect(() => {
    async function loadUserData() {
      try {
        const p = await dbService.getProfile();
        const g = await dbService.getGoals();
        setProfile(p);
        setGoals(g);
        setIsDataLoaded(true);

        // Check if we have cached AI tips in local storage to minimize redundant API hits
        const cached = localStorage.getItem(`ai_tips_${p?.name || "user"}`);
        if (cached) {
          try {
            setAiTips(JSON.parse(cached));
          } catch (e) {
            // parsing error, ignore
          }
        }

        // Check if we have cached chat history
        const cachedChat = localStorage.getItem(`ai_coach_chat_${p?.name || "user"}`);
        if (cachedChat) {
          try {
            setChatHistory(JSON.parse(cachedChat));
          } catch (e) {
            // parsing error, ignore
          }
        }
        setChatHistoryLoaded(true);
      } catch (err: any) {
        console.error("Error loading user data for tips:", err);
        setError("Failed to load your profile parameters. Please verify your profile settings.");
        setChatHistoryLoaded(true);
      }
    }
    loadUserData();
  }, []);

  // Compute local standard values for immediate feedback
  const heightInMeters = profile ? (profile.heightCm / 100) : 1.75;
  const computedBmi = profile ? (profile.currentWeightKg / (heightInMeters * heightInMeters)) : 22.0;
  
  let localBmiCategory: "Underweight" | "Normal" | "Overweight" | "Obese" = "Normal";
  let themeColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
  let barColor = "bg-emerald-500";
  
  if (computedBmi < 18.5) {
    localBmiCategory = "Underweight";
    themeColor = "text-sky-600 bg-sky-50 border-sky-100";
    barColor = "bg-sky-500";
  } else if (computedBmi >= 18.5 && computedBmi < 25) {
    localBmiCategory = "Normal";
    themeColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
    barColor = "bg-emerald-500";
  } else if (computedBmi >= 25 && computedBmi < 30) {
    localBmiCategory = "Overweight";
    themeColor = "text-amber-600 bg-amber-50 border-amber-100";
    barColor = "bg-amber-500";
  } else {
    localBmiCategory = "Obese";
    themeColor = "text-rose-600 bg-rose-50 border-rose-100";
    barColor = "bg-rose-500";
  }

  // Normal weight ranges for height
  const minNormalWeight = Math.round(18.5 * heightInMeters * heightInMeters * 10) / 10;
  const maxNormalWeight = Math.round(24.9 * heightInMeters * heightInMeters * 10) / 10;

  // Fetch or refresh AI-generated advice from Gemini
  const fetchAiAdvice = async () => {
    if (!profile) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/get-ai-tips"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: profile.age,
          heightCm: profile.heightCm,
          currentWeightKg: profile.currentWeightKg,
          targetWeightKg: profile.targetWeightKg,
          gender: profile.gender,
          activityLevel: profile.activityLevel,
          nationality: profile.nationality || "Malaysia",
          favoriteFoods: profile.favoriteFoods || "",
          favoriteDrinks: profile.favoriteDrinks || "",
          dislikedFoods: profile.dislikedFoods || "",
          dietaryRestrictions: profile.dietaryRestrictions || ""
        })
      });

      if (!response.ok) {
        throw new Error("The nutrition server is currently busy. Please verify your GEMINI_API_KEY.");
      }

      const result = await response.json();
      if (result.success && result.data) {
        setAiTips(result.data);
        localStorage.setItem(`ai_tips_${profile.name}`, JSON.stringify(result.data));
      } else {
        throw new Error(result.error || "Failed to receive valid recommendations.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to sync with Gemini. Please try again in a few moments.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to trigger automatic first fetch if cache is empty
  useEffect(() => {
    if (isDataLoaded && profile && !aiTips && !isLoading && !error) {
      fetchAiAdvice();
    }
  }, [isDataLoaded, profile]);

  // Handle Free-Form Chat Submission
  const handleAskCoach = async (questionText: string) => {
    if (!questionText.trim() || isAsking) return;
    setIsAsking(true);
    setChatError(null);
    
    const userMsg = questionText.trim();
    // Append message immediately
    const updatedHistory = [...chatHistory, { role: "user" as const, text: userMsg }];
    setChatHistory(updatedHistory);
    setChatQuestion("");

    try {
      const response = await fetch(getApiUrl("/api/ask-coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMsg,
          history: chatHistory,
          profile: {
            name: profile?.name || "User",
            nationality: profile?.nationality || "Malaysia",
            age: profile?.age || 28,
            heightCm: profile?.heightCm || 175,
            currentWeightKg: profile?.currentWeightKg || 75,
            targetWeightKg: goals?.targetWeightKg || 70,
            activityLevel: profile?.activityLevel || "Moderately Active",
            favoriteFoods: profile?.favoriteFoods || "",
            favoriteDrinks: profile?.favoriteDrinks || "",
            dislikedFoods: profile?.dislikedFoods || "",
            dietaryRestrictions: profile?.dietaryRestrictions || ""
          }
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Unable to contact your coaching companion right now.");
      }

      setChatHistory([...updatedHistory, { role: "model" as const, text: resData.answer }]);
    } catch (err: any) {
      console.error("Ask AI Coach error:", err);
      setChatError(err.message || "Failed to sync with AI Coach. Please double-check your network connection.");
    } finally {
      setIsAsking(false);
    }
  };

  // Safe zero-dependency markdown interpreter for chat bubble rendering
  const renderMessageText = (msgText: string) => {
    return msgText.split("\n").map((line, i) => {
      let processed = line;
      let isHeader = false;
      if (line.startsWith("### ")) {
        processed = line.replace("### ", "");
        isHeader = true;
      } else if (line.startsWith("## ")) {
        processed = line.replace("## ", "");
        isHeader = true;
      } else if (line.startsWith("# ")) {
        processed = line.replace("# ", "");
        isHeader = true;
      }
      
      // Highlight bold parts
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(processed)) !== null) {
        if (match.index > lastIndex) {
          parts.push(processed.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-extrabold text-indigo-950">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < processed.length) {
        parts.push(processed.substring(lastIndex));
      }
      
      const finalContent = parts.length > 0 ? parts : processed;
      
      if (isHeader) {
        return (
          <h4 key={i} className="text-xs font-black text-slate-800 mt-2.5 mb-1 tracking-wide uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            {finalContent}
          </h4>
        );
      }
      
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const bulletText = line.trim().replace(/^[-*]\s+/, "");
        const bParts = [];
        let bLastIndex = 0;
        let bMatch;
        while ((bMatch = boldRegex.exec(bulletText)) !== null) {
          if (bMatch.index > bLastIndex) {
            bParts.push(bulletText.substring(bLastIndex, bMatch.index));
          }
          bParts.push(<strong key={bMatch.index} className="font-extrabold text-indigo-950">{bMatch[1]}</strong>);
          bLastIndex = boldRegex.lastIndex;
        }
        if (bLastIndex < bulletText.length) {
          bParts.push(bulletText.substring(bLastIndex));
        }
        
        return (
          <li key={i} className="ml-3.5 list-disc pl-1 text-[11px] text-slate-600 leading-relaxed my-1">
            {bParts.length > 0 ? bParts : bulletText}
          </li>
        );
      }
      
      return line.trim() === "" ? (
        <div key={i} className="h-1.5"></div>
      ) : (
        <p key={i} className="text-[11px] text-slate-600 leading-relaxed my-0.5 break-words">
          {finalContent}
        </p>
      );
    });
  };

  // Nationality recommendation quick prompt tags
  const localPrompts = [
    `How to make traditional ${profile?.nationality || "local"} food healthier?`,
    "Give me a strength and macro plan for my goals",
    "Smart local ingredient swaps for cooking at home",
    "How should I adjust calorie budget on resting days?"
  ];

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-indigo-950">Synchronizing client biometrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6" id="ai-coach-root">
      
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-700/15 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-800 border border-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Elite AI Wellness Companion</span>
            </div>
            <h2 className="text-2xl font-display font-black tracking-tight leading-tight">
              AI Coach — NutriCoach Chat
            </h2>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              Meet NutriCoach! Access your personalized culinary roadmap or ask your virtual mentor free-form questions about diet, recipes, calorie budgets, or exercise regimes.
            </p>
          </div>
          
          <button
            onClick={fetchAiAdvice}
            disabled={isLoading}
            className="flex-shrink-0 bg-white hover:bg-slate-50 text-indigo-950 font-extrabold text-xs py-3 px-5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Re-Generate Blueprint</span>
          </button>
        </div>
      </div>

      {/* SEGMENTED SUB-TABS SELECTOR */}
      <div className="flex justify-start sm:justify-center flex-nowrap border-b border-gray-200/80 pb-px overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveCoachTab("plan")}
          className={`px-5 py-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeCoachTab === "plan"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
          id="btn-coachtab-plan"
        >
          <Apple className="w-4 h-4" />
          <span>My Core Roadmap</span>
        </button>
        <button
          onClick={() => setActiveCoachTab("chat")}
          className={`px-5 py-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeCoachTab === "chat"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
          id="btn-coachtab-chat"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask Coach Anything</span>
          {chatHistory.length === 0 && (
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
          )}
        </button>
      </div>

      {/* CORE BLUEPRINT PLAN VIEW */}
      {activeCoachTab === "plan" && (
        <div className="space-y-6">
          
          {/* ERROR DISPLAY */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-2xl flex items-start gap-3 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold">Gemini Connection Offline</p>
                <p className="leading-relaxed">{error}</p>
                <button 
                  onClick={fetchAiAdvice} 
                  className="text-rose-700 font-bold hover:underline mt-2 inline-block bg-rose-100 px-3 py-1 rounded-lg"
                >
                  Retry Sync
                </button>
              </div>
            </div>
          )}

          {/* BMI COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white border border-gray-100 rounded-[32px] p-6 shadow-3xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Biometric Weight Status</h3>
                <Activity className="w-4 h-4 text-indigo-500" />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 border border-slate-100 rounded-2xl p-5">
                <div className="text-center space-y-1 flex-shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Calculated BMI</span>
                  <div className="text-4xl font-display font-black text-indigo-950 tracking-tighter">
                    {computedBmi.toFixed(1)}
                  </div>
                  <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${themeColor}`}>
                    {localBmiCategory}
                  </span>
                </div>

                <div className="space-y-2 flex-1 w-full">
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                    For your height of <strong className="text-slate-900">{profile.heightCm} cm</strong>, the standard healthy weight range is <strong className="text-slate-900">{minNormalWeight} kg to {maxNormalWeight} kg</strong>.
                  </p>
                  
                  <div className="p-3 bg-white rounded-xl border border-slate-100 text-[11px] leading-relaxed">
                    {localBmiCategory === "Overweight" || localBmiCategory === "Obese" ? (
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>
                          Your current metrics indicate you are in the <strong>{localBmiCategory}</strong> category. We recommend focusing on a slight caloric deficit (approx. 350-500 kcal below maintenance) paired with nutrient-dense foods to safely approach your target of <strong>{profile.targetWeightKg} kg</strong>.
                        </span>
                      </div>
                    ) : localBmiCategory === "Underweight" ? (
                      <div className="flex items-start gap-2 text-sky-800">
                        <Info className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                        <span>
                          Your current weight is in the <strong>Underweight</strong> category. Focus on healthy caloric additions, quality proteins, and resistance training to safely reach your optimal weight.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>
                          Your bodyweight is perfectly within the <strong>Healthy Weight standards</strong>! Keep maintaining your outstanding eating and exercise habits.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual BMI Gauge */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>Underweight (&lt;18.5)</span>
                  <span>Healthy (18.5-24.9)</span>
                  <span>Overweight (25-29.9)</span>
                  <span>Obese (&gt;30)</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-150">
                  <div className="h-full bg-sky-200" style={{ width: "20%" }}></div>
                  <div className="h-full bg-emerald-200" style={{ width: "30%" }}></div>
                  <div className="h-full bg-amber-200" style={{ width: "25%" }}></div>
                  <div className="h-full bg-rose-200" style={{ width: "25%" }}></div>
                  
                  {(() => {
                    const bmiPercentage = Math.min(100, Math.max(0, ((computedBmi - 15) / (40 - 15)) * 100));
                    return (
                      <div 
                        className="absolute top-0 bottom-0 w-1.5 bg-indigo-950 border border-white shadow-md transition-all duration-500" 
                        style={{ left: `${bmiPercentage}%` }}
                        title={`Your BMI: ${computedBmi.toFixed(1)}`}
                      ></div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* DEMOGRAPHICS INFO CARD */}
            <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-3xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Demographics</h3>
                  <Globe className="w-4 h-4 text-indigo-500" />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">User Profile:</span>
                    <strong className="text-slate-800 font-bold capitalize">{profile.name}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Cuisine Map:</span>
                    <span className="text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                      <span>🇲🇾</span>
                      <span>{profile.nationality || "Malaysia"} Cuisine</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Daily Budget:</span>
                    <strong className="text-slate-800 font-bold">{goals?.dailyCalorieBudget || 2000} kcal</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Age / Gender:</span>
                    <strong className="text-slate-800 font-bold">{profile.age} yrs / {profile.gender || "Not specified"}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Activity Level:</span>
                    <strong className="text-slate-800 font-bold text-right text-[11px] break-words max-w-28 leading-snug">{profile.activityLevel}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/40 border border-amber-100 p-3 rounded-2xl flex items-start gap-2 mt-4">
                <Award className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-900 leading-relaxed font-semibold">
                  Personal target weight set to <strong className="font-extrabold">{profile.targetWeightKg} kg</strong>. Keep logging to track weekly trends.
                </p>
              </div>
            </div>
          </div>

          {/* NATIONALITY BLUEPRINT */}
          {aiTips ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-3xs space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      Culinary Diet Blueprint — Traditional {aiTips.nationalityDietContext.country} Swaps
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tailored guidelines to navigate regional ingredients, local food culture, and portion sizes.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {aiTips.nationalityDietContext.generalAdvice}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Foods to Reduce */}
                  <div className="border border-rose-100 bg-rose-50/20 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase text-rose-700 tracking-wider flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      <span>High-Calorie Traditional Foods to Reduce</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      These popular local dishes or preparation styles typically contain hidden calories, excess carbs, sodium, or oils. Portion control or minimize:
                    </p>
                    <ul className="space-y-2">
                      {aiTips.nationalityDietContext.traditionalFoodsToReduce.map((food, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700 font-semibold bg-white p-2.5 rounded-xl border border-rose-50 shadow-3xs">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{food}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Healthy Swaps */}
                  <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-700 tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>Optimal Foods & Smart Alternatives</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Switch to these nutritious alternative swaps or increase these local, healthy dishes to keep macros in balance:
                    </p>
                    <ul className="space-y-2">
                      {aiTips.nationalityDietContext.traditionalFoodsToIncrease.concat(aiTips.nationalityDietContext.localizedHealthyAlternatives).slice(0, 5).map((food, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700 font-semibold bg-white p-2.5 rounded-xl border border-emerald-50 shadow-3xs">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{food}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* ENERGY METRICS BASELINE */}
              <div className="bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-3xs space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">Energy & Macronutrient Baseline</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Daily target distribution designed to optimize thermic metabolic rate.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Recommended Calories</span>
                    <span className="text-xl font-display font-black text-indigo-950">{aiTips.recommendedCalories} kcal</span>
                    <span className="text-[10px] text-slate-500 block font-semibold">estimated deficit baseline</span>
                  </div>
                  <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-2xl text-center space-y-1 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider block mb-1">Protein Strategy</span>
                    <span className="text-xs font-bold text-emerald-950 block leading-snug">{aiTips.macroRatioTips.protein}</span>
                  </div>
                  <div className="bg-amber-50/30 border border-amber-100 p-4 rounded-2xl text-center space-y-1 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block mb-1">Carbs Strategy</span>
                    <span className="text-xs font-bold text-amber-950 block leading-snug">{aiTips.macroRatioTips.carbs}</span>
                  </div>
                  <div className="bg-rose-50/30 border border-rose-100 p-4 rounded-2xl text-center space-y-1 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-rose-700 uppercase tracking-wider block mb-1">Fats Strategy</span>
                    <span className="text-xs font-bold text-rose-950 block leading-snug">{aiTips.macroRatioTips.fat}</span>
                  </div>
                </div>
              </div>

              {/* BEHAVIORAL HABITS */}
              <div className="bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-3xs space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">Behavioral Lifestyle Interventions</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium font-display">High-impact behavioral tweaks to sustain long-term fitness adaptation.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Habits to minimize */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-rose-700 tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4" />
                      <span>Habits to Minimize</span>
                    </h4>
                    <ul className="space-y-2.5">
                      {aiTips.lifestyleTips.reduce.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                          <span className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Habits to cultivate */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>Habits to Cultivate</span>
                    </h4>
                    <ul className="space-y-2.5">
                      {aiTips.lifestyleTips.increase.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Golden habits */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                      <Smile className="w-4 h-4" />
                      <span>Golden Habits</span>
                    </h4>
                    <ul className="space-y-2.5">
                      {aiTips.lifestyleTips.habits.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-[32px] p-12 shadow-3xs text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
                <Sparkles className="w-6 h-6 fill-indigo-200" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-black text-slate-800 text-base">Generate Your Custom Plan</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Your profile parameters are ready! Let's connect with Gemini to build your nationality-specific culinary and calorie map.
                </p>
              </div>
              <button
                onClick={fetchAiAdvice}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-6 rounded-2xl inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 fill-indigo-300" />
                <span>Generate Roadmap with Gemini</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* INTERACTIVE CHAT ADVISOR VIEW */}
      {activeCoachTab === "chat" && (
        <div className="bg-white border border-slate-100 rounded-[32px] shadow-sm flex flex-col overflow-hidden min-h-[500px]" id="coach-chat-container">
          
          {/* Top Info Header */}
          <div className="bg-slate-50/50 px-6 py-4.5 sm:px-8 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-2 flex-nowrap">
            <div className="flex items-center min-w-0">
              <div className="truncate">
                <h4 className="text-xs font-black text-slate-800 leading-none truncate">NutriCoach Advisor</h4>
                <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1 mt-1 leading-none whitespace-nowrap">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></span>
                  <span>Active with Gemini 2.5</span>
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                setChatHistory([]);
                setChatError(null);
              }}
              className="text-[10px] font-extrabold text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-200/40 px-2.5 py-1 rounded-lg transition-all flex-shrink-0 whitespace-nowrap cursor-pointer"
            >
              Clear Chat
            </button>
          </div>

          {/* Chat Messages Frame */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[380px] min-h-[300px]">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6 space-y-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                  <Sparkles className="w-6 h-6 fill-indigo-100" />
                </div>
                <div className="space-y-1 px-4">
                  <h4 className="text-xs font-black text-slate-800">Ask your Nutritionist & Fitness Mentor</h4>
                  <p className="text-[10px] text-slate-400 max-w-sm leading-relaxed">
                    Ask me traditional recipe substitutions, local food macro splits, training routines, or how to reach your goal of <strong>{profile.targetWeightKg} kg</strong>.
                  </p>
                </div>

                {/* Local Quick Prompt Templates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg pt-2 px-2">
                  {localPrompts.map((promptText, i) => (
                    <button
                      key={i}
                      onClick={() => handleAskCoach(promptText)}
                      className="text-left bg-slate-50 hover:bg-indigo-50/20 border border-slate-100 hover:border-indigo-100 p-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:text-indigo-950 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Utensils className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="line-clamp-2 leading-snug">{promptText}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((msg, index) => (
                  <div 
                    key={index} 
                    className="w-full"
                  >
                    <div 
                      className={`w-full rounded-2xl p-4 shadow-3xs border transition-all ${
                        msg.role === "user" 
                          ? "bg-indigo-50/70 border-indigo-100 text-slate-800" 
                          : "bg-slate-50 text-slate-800 border-slate-100"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 select-none">You</div>
                          <p className="text-xs font-bold whitespace-pre-wrap break-words text-slate-800">{msg.text}</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-900 select-none flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500 fill-indigo-100" />
                            <span>NutriCoach Advisor</span>
                          </div>
                          <div className="text-xs font-medium leading-relaxed whitespace-normal break-words text-slate-800">
                            {renderMessageText(msg.text)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isAsking && (
                  <div className="w-full">
                    <div className="bg-slate-50/50 border border-slate-100/80 rounded-2xl p-4 flex items-center gap-2 w-full">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold ml-1">NutriCoach is thinking and crafting suggestions...</span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-[10px] font-semibold rounded-xl flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Interactive Form Input Bar */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-100">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAskCoach(chatQuestion);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                disabled={isAsking}
                placeholder={`Ask Coach... (e.g. "Healthy ${profile.nationality || "local"} breakfasts?")`}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!chatQuestion.trim() || isAsking}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-100"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
}

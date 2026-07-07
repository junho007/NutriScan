import React, { useState, useEffect } from "react";
import { UserGoals, UserProfile, WaterLog } from "../types";
import { dbService, authService, getActiveUserId } from "../firebase";
import CustomSelect from "./CustomSelect";
import { 
  Settings, Calculator, RefreshCw, Check, Sparkles, User, Phone, 
  Trash2, LogOut, ShieldAlert, Award, Droplet, Bell, Database, HelpCircle, 
  MapPin, CheckSquare, Edit3, MessageSquare, Shield, Sliders, Apple
} from "lucide-react";

interface ProfileSettingsProps {
  onProfileUpdated: () => void;
  onAppNameChanged: (newName: string) => void;
  currentAppName: string;
}

// Client-side avatar compression to fit perfectly in Firestore without size issues
const compressAvatarBase64 = (base64Str: string, maxWidth = 160, maxHeight = 160): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG 0.6 quality (highly compressed avatar, approx 15-20KB)
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

// Country codes with flags
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

type TabType = "biometrics" | "goals" | "dietary" | "hydration" | "advanced";

export default function ProfileSettings({ onProfileUpdated, onAppNameChanged, currentAppName }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("biometrics");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  
  // Hydration Simulator alert list
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Calculator state
  const [calcGender, setCalcGender] = useState("male");
  const [calcAge, setCalcAge] = useState(28);
  const [calcHeight, setCalcHeight] = useState(175);
  const [calcWeight, setCalcWeight] = useState(75);
  const [calcTargetWeight, setCalcTargetWeight] = useState(70);
  const [calcActivity, setCalcActivity] = useState("1.55");
  const [calcGoal, setCalcGoal] = useState("lose");

  useEffect(() => {
    // Read auth status
    const user = authService.getCurrentUser();
    setCurrentUser(user);

    async function loadData() {
      const p = await dbService.getProfile();
      const g = await dbService.getGoals();
      setProfile(p);
      setGoals(g);

      if (p) {
        setCalcGender(p.gender === "Female" ? "female" : p.gender === "Male" ? "male" : "other");
        setCalcAge(p.age || 28);
        setCalcHeight(p.heightCm || 175);
        setCalcWeight(p.currentWeightKg || 75);
        setCalcTargetWeight(p.targetWeightKg || 70);
        
        const activityMap: Record<string, string> = {
          "Sedentary": "1.2",
          "Lightly Active": "1.375",
          "Moderately Active": "1.55",
          "Very Active": "1.725",
        };
        setCalcActivity(activityMap[p.activityLevel] || "1.55");
      }
    }
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setNotificationMessage(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Profile Save
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !goals) return;
    setIsSaving(true);
    
    // Auto-calculate recommended water: 35ml per kg of weight
    const recommendedWater = Math.max(2000, Math.round((profile.currentWeightKg * 35) / 250) * 250);
    const updatedGoals = {
      ...goals,
      waterGoalMl: recommendedWater,
      targetWeightKg: profile.targetWeightKg
    };

    await dbService.saveProfile(profile);
    await dbService.saveGoals(updatedGoals);
    setGoals(updatedGoals);

    setIsSaving(false);
    triggerToast("Your profile biometrics have been synced to the cloud!");
    onProfileUpdated();
  };

  // Goals Save
  const handleGoalsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goals) return;
    setIsSaving(true);
    await dbService.saveGoals(goals);
    setIsSaving(false);
    triggerToast("Your personalized nutrition targets are successfully updated!");
    onProfileUpdated();
  };

  // Smart Goals Calculation
  const calculateAndApplyGoals = async () => {
    if (!profile) return;
    setIsSaving(true);
    
    // BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (calcGender === "male") {
      bmr = 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge + 5;
    } else if (calcGender === "female") {
      bmr = 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge - 161;
    } else {
      bmr = 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge - 78;
    }

    const multiplier = parseFloat(calcActivity);
    const tdee = bmr * multiplier;

    let dailyCalorieBudget = Math.round(tdee);
    if (calcGoal === "lose") {
      dailyCalorieBudget = Math.round(tdee - 500);
    } else if (calcGoal === "gain") {
      dailyCalorieBudget = Math.round(tdee + 400);
    }

    if (dailyCalorieBudget < 1200) dailyCalorieBudget = 1200;

    const proteinG = Math.round(calcWeight * 2);
    const proteinCal = proteinG * 4;
    const fatCal = Math.round(dailyCalorieBudget * 0.25);
    const fatG = Math.round(fatCal / 9);
    const carbsCal = dailyCalorieBudget - (proteinCal + fatCal);
    const carbsG = Math.max(50, Math.round(carbsCal / 4));

    const waterGoalMl = Math.max(2000, Math.round((calcWeight * 35) / 250) * 250);

    const newGoals: UserGoals = {
      dailyCalorieBudget,
      targetProteinG: proteinG,
      targetCarbsG: carbsG,
      targetFatG: fatG,
      targetWeightKg: calcTargetWeight,
      waterGoalMl,
    };

    const activityLabels: Record<string, string> = {
      "1.2": "Sedentary",
      "1.375": "Lightly Active",
      "1.55": "Moderately Active",
      "1.725": "Very Active",
    };

    const newProfile: UserProfile = {
      ...profile,
      currentWeightKg: calcWeight,
      targetWeightKg: calcTargetWeight,
      heightCm: calcHeight,
      age: calcAge,
      gender: calcGender === "female" ? "Female" : calcGender === "male" ? "Male" : "Non-binary",
      activityLevel: activityLabels[calcActivity] || "Moderately Active",
    };

    await dbService.saveGoals(newGoals);
    await dbService.saveProfile(newProfile);
    
    setGoals(newGoals);
    setProfile(newProfile);
    setIsSaving(false);
    triggerToast("Biometric targets recalculated and synced!");
    onProfileUpdated();
  };

  // Change custom App Title Name
  const selectAppName = async (name: string) => {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      customAppName: name
    };
    setProfile(updatedProfile);
    await dbService.saveProfile(updatedProfile);
    onAppNameChanged(name);
    triggerToast(`App rebranded to "${name}" instantly! 🎉`);
  };

  // Log simulated Water Intake (Hydration station)
  const addHydrationIntake = async (amountMl: number) => {
    const today = new Date().toISOString().split("T")[0];
    const log: WaterLog = {
      id: "water_" + Date.now(),
      date: today,
      amountMl,
      timestamp: Date.now()
    };
    await dbService.saveWater(log);
    triggerToast(`Logged ${amountMl}ml of clean water! Hydration Station filled! 💧`);
    onProfileUpdated();
  };

  // Simulate Instant Notification
  const triggerReminderSimulation = () => {
    const audioObj = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav");
    try {
      audioObj.volume = 0.2;
      audioObj.play();
    } catch (e) {
      // Browser autoplay constraint
    }
    const alertId = "alert_" + Date.now();
    setActiveAlerts(prev => [...prev, alertId]);
    setTimeout(() => {
      // Auto dismiss after 20 seconds
      setActiveAlerts(prev => prev.filter(id => id !== alertId));
    }, 20000);
  };

  // Logout
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await authService.logout();
    window.location.reload();
  };

  if (!profile || !goals) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-indigo-950">Loading profile configuration...</p>
        </div>
      </div>
    );
  }

  // Weight recommendation calculation
  const weightWaterRecommendation = Math.max(2000, profile.currentWeightKg * 35);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4" id="profile-settings-root">
      
      {/* Dynamic Hydration simulated Push Banners on screen */}
      <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2 pointer-events-none">
        {activeAlerts.map(alertId => (
          <div 
            key={alertId} 
            className="pointer-events-auto bg-indigo-900 border-2 border-indigo-700 text-white rounded-[24px] p-4 shadow-xl flex items-start gap-3.5 animate-bounce"
          >
            <div className="w-9 h-9 bg-indigo-700 rounded-full flex items-center justify-center text-indigo-200">
              <Droplet className="w-5 h-5 fill-indigo-300 animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                <span>💧 Hydration Alert!</span>
                <span className="text-[9px] bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full font-extrabold uppercase">Drink now</span>
              </h4>
              <p className="text-[11px] text-indigo-200 mt-1 leading-snug">
                It's time to drink water based on your weight parameters! How much are you taking now?
              </p>
              <div className="flex gap-2.5 mt-3">
                <button
                  onClick={() => {
                    addHydrationIntake(250);
                    setActiveAlerts(prev => prev.filter(id => id !== alertId));
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-black py-1.5 px-3.5 rounded-xl cursor-pointer"
                >
                  +250 ml
                </button>
                <button
                  onClick={() => {
                    addHydrationIntake(500);
                    setActiveAlerts(prev => prev.filter(id => id !== alertId));
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-black py-1.5 px-3.5 rounded-xl cursor-pointer"
                >
                  +500 ml
                </button>
                <button
                  onClick={() => setActiveAlerts(prev => prev.filter(id => id !== alertId))}
                  className="text-indigo-300 hover:text-white text-[10px] font-bold py-1.5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header Profile Dashboard info */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 mb-6 shadow-xs border border-gray-100 relative overflow-hidden">
        {/* Floating subtle warm gradient blobs to match overall style */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-rose-50/30 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full text-center sm:text-left">
            {/* Avatar Section with Upload Feature */}
            <div className="relative group flex-shrink-0 cursor-pointer" title="Click to upload custom avatar">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && profile) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const dataUrl = event.target?.result as string;
                      // Compress to stay light and secure in firestore
                      const compressed = await compressAvatarBase64(dataUrl);
                      const updatedProfile = { ...profile, avatarUrl: compressed };
                      setProfile(updatedProfile);
                      await dbService.saveProfile(updatedProfile);
                      triggerToast("Avatar updated successfully!");
                      onProfileUpdated();
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[28px] flex items-center justify-center shadow-md border-2 border-indigo-100 overflow-hidden relative transition-all group-hover:border-indigo-400 group-hover:shadow-lg">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-9 h-9 text-indigo-500" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <span className="text-[10px] text-white font-black uppercase tracking-wider">Change</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 w-full">
              <div className="flex flex-col sm:flex-row items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl font-display font-black tracking-tight text-slate-800">{profile?.name || "Guest User"}</h2>
                <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-600 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                  {currentUser?.isSimulated ? "Sandbox mode" : "Verified client"}
                </span>
              </div>
              
              {/* Responsive metadata grid container */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 text-slate-500 text-xs font-medium justify-center sm:justify-start">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 justify-center sm:justify-start">
                  <Database className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  <span className="font-mono text-[10px] text-slate-600">
                    UID: {getActiveUserId().substring(0, 12)}...
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 justify-center sm:justify-start">
                  <span className="text-indigo-500 font-extrabold">@</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px] sm:max-w-[240px]">
                    {currentUser?.email || "sandbox.active@nutriscan.com"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNotification && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 shadow-xs animate-fade-in">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{notificationMessage}</span>
        </div>
      )}

      {/* Tabs list following elegant flat bottom-bordered layout consistent with AiTips and Fitness trackers */}
      <div className="flex justify-start sm:justify-center flex-nowrap border-b border-gray-200/80 pb-px mb-6 overflow-x-auto whitespace-nowrap scrollbar-none" id="tabs-container">
        {[
          { id: "biometrics", label: "My Profile", icon: User },
          { id: "goals", label: "Goals & targets", icon: Calculator },
          { id: "dietary", label: "Favorite Food & Drinks", icon: Apple },
          { id: "hydration", label: "Hydration Station", icon: Droplet },
          { id: "advanced", label: "Advanced settings", icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-5 py-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-xs">
        
        {/* PROFILE TAB */}
        {activeTab === "biometrics" && (
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Biometric Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">Customize your general biometric identity synced dynamically with Firestore.</p>
              </div>
              <User className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Display Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Bio Gender</label>
                <CustomSelect
                  value={profile.gender}
                  onChange={(val) => setProfile({ ...profile, gender: val })}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Non-binary", label: "Non-binary" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Age (Years)</label>
                <input
                  type="number"
                  value={profile.age || ""}
                  onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 28 })}
                  className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  min="5"
                  max="120"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Height (cm)</label>
                <input
                  type="number"
                  value={profile.heightCm || ""}
                  onChange={(e) => setProfile({ ...profile, heightCm: parseInt(e.target.value) || 175 })}
                  className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  min="60"
                  max="250"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Current Weight (kg)</label>
                <input
                  type="number"
                  value={profile.currentWeightKg || ""}
                  onChange={(e) => setProfile({ ...profile, currentWeightKg: parseFloat(e.target.value) || 75 })}
                  className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  min="20"
                  max="300"
                  step="0.1"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Target Goal Weight (kg)</label>
                <input
                  type="number"
                  value={profile.targetWeightKg || ""}
                  onChange={(e) => setProfile({ ...profile, targetWeightKg: parseFloat(e.target.value) || 70 })}
                  className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  min="20"
                  max="300"
                  step="0.1"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Nationality / Country Cuisine</label>
                <CustomSelect
                  value={profile.nationality || "Malaysia"}
                  onChange={(val) => setProfile({ ...profile, nationality: val })}
                  options={NATIONALITIES}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Activity Tier</label>
                <CustomSelect
                  value={profile.activityLevel}
                  onChange={(val) => setProfile({ ...profile, activityLevel: val })}
                  options={[
                    { value: "Sedentary", label: "Sedentary (desk job, minimal exercise)" },
                    { value: "Lightly Active", label: "Lightly Active (exercise 1-3 days/week)" },
                    { value: "Moderately Active", label: "Moderately Active (exercise 3-5 days/week)" },
                    { value: "Very Active", label: "Very Active (heavy exercise 6-7 days/week)" }
                  ]}
                />
              </div>

              {/* Phone with Country Code fields requested by user */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Linked Mobile Phone Number</label>
                <div className="flex gap-2 items-center">
                  <div className="w-28 flex-shrink-0">
                    <CustomSelect
                      value={profile.phoneCountryCode || "+1"}
                      onChange={(val) => setProfile({ ...profile, phoneCountryCode: val })}
                      align="left"
                      options={COUNTRY_CODES.map(c => ({
                        value: c.code,
                        label: `${c.name.split(" ")[0]} ${c.code}`
                      }))}
                    />
                  </div>
                  
                  <input
                    type="text"
                    value={profile.phoneNumber || ""}
                    onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                    placeholder="8123-4567"
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-[11px] text-amber-950 flex items-start gap-2.5 leading-relaxed">
              <Droplet className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5 animate-bounce" />
              <div>
                <strong>💧 Smart Hydration Station Active:</strong> Saving this biometric profile will automatically configure your weight-based recommended fluid targets to <strong>{weightWaterRecommendation} ml / day</strong> (calculated as 35ml per kg of your weight) and sync instantly with your goals.
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100 active:scale-[0.99]"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save & Sync Biometric Profile</span>
            </button>
          </form>
        )}

        {/* DIETARY PREFERENCES TAB */}
        {activeTab === "dietary" && (
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Dietary Preferences & Favorites</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tell NutriCoach more about your food and beverage favorites to personalize your AI results.</p>
              </div>
              <Apple className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="space-y-6">
              {/* Favorite Foods Question */}
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 text-indigo-600 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <label className="block text-xs font-extrabold text-slate-700">What are your favorite healthy foods or local dishes?</label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pl-9">
                  Examples: grilled chicken, steamed fish, basmati rice, spinach, sambal tempeh, stir-fry vegetables...
                </p>
                <div className="pl-9 space-y-2">
                  <input
                    type="text"
                    value={profile.favoriteFoods || ""}
                    onChange={(e) => setProfile({ ...profile, favoriteFoods: e.target.value })}
                    placeholder="Type your favorite foods here..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                  />
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Steamed Chicken", "Grilled Salmon", "Egg & Avocado", "Sambal Tempeh", "Stir-fry Vegetables", "Oatmeal with Fruits"].map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          const current = profile.favoriteFoods ? profile.favoriteFoods.trim() : "";
                          const updated = current ? `${current}, ${item}` : item;
                          setProfile({ ...profile, favoriteFoods: updated });
                        }}
                        className="text-[10px] bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-950 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Favorite Drinks Question */}
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 text-indigo-600 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <label className="block text-xs font-extrabold text-slate-700">What are your favorite drinks/beverages?</label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pl-9">
                  Examples: mineral water, black coffee, matcha green tea, unsweetened soy milk, barley water...
                </p>
                <div className="pl-9 space-y-2">
                  <input
                    type="text"
                    value={profile.favoriteDrinks || ""}
                    onChange={(e) => setProfile({ ...profile, favoriteDrinks: e.target.value })}
                    placeholder="Type your favorite drinks here..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                  />
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Mineral Water", "Black Coffee", "Matcha Green Tea", "Unsweetened Soy Milk", "Coconut Water", "Teh O Kosong"].map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          const current = profile.favoriteDrinks ? profile.favoriteDrinks.trim() : "";
                          const updated = current ? `${current}, ${item}` : item;
                          setProfile({ ...profile, favoriteDrinks: updated });
                        }}
                        className="text-[10px] bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-950 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Foods to Avoid Question */}
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 text-indigo-600 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <label className="block text-xs font-extrabold text-slate-700">Any foods or ingredients you avoid or dislike?</label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pl-9">
                  Examples: deep-fried dishes, sugary desserts, mutton, coriander, peanuts, shellfish...
                </p>
                <div className="pl-9 space-y-2">
                  <input
                    type="text"
                    value={profile.dislikedFoods || ""}
                    onChange={(e) => setProfile({ ...profile, dislikedFoods: e.target.value })}
                    placeholder="Type foods to avoid or dislike..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                  />
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Deep Fried Foods", "Sugary Desserts", "Sweetened Soda", "Shellfish", "Coriander", "High Sodium Snacks"].map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          const current = profile.dislikedFoods ? profile.dislikedFoods.trim() : "";
                          const updated = current ? `${current}, ${item}` : item;
                          setProfile({ ...profile, dislikedFoods: updated });
                        }}
                        className="text-[10px] bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-950 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dietary Restrictions Question */}
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 text-indigo-600 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <label className="block text-xs font-extrabold text-slate-700">Dietary style or restrictions?</label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal pl-9">
                  Examples: Halal, Vegetarian, Vegan, Keto, Low-Carb, Gluten-Free, None...
                </p>
                <div className="pl-9 space-y-2">
                  <input
                    type="text"
                    value={profile.dietaryRestrictions || ""}
                    onChange={(e) => setProfile({ ...profile, dietaryRestrictions: e.target.value })}
                    placeholder="Type your dietary style/restrictions..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                  />
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Halal", "Vegetarian", "Vegan", "Keto / Low Carb", "Gluten-Free", "Dairy-Free", "High Protein Only"].map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          setProfile({ ...profile, dietaryRestrictions: item });
                        }}
                        className="text-[10px] bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-950 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-[11px] text-indigo-950 flex items-start gap-2.5 leading-relaxed">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong>✨ Synced with AI Coach Companion:</strong> When you save these preferences, NutriCoach will immediately read your custom food favorites, avoided foods, and dietary restrictions to build highly personalized meal plans, recipe alternatives, and tailored macro suggestions!
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100 active:scale-[0.99]"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save & Apply Taste Profile</span>
            </button>
          </form>
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Fitness Goals Calculator</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automate or fine-tune daily nutrient split values for your dietary tracking.</p>
              </div>
              <Calculator className="w-5 h-5 text-indigo-500" />
            </div>

            {/* Smart calculator panel */}
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0 animate-pulse" />
              <div className="text-xs">
                <p className="font-extrabold text-indigo-950">ACSM & Mifflin-St Jeor Diet Engine</p>
                <p className="text-indigo-700 mt-1 leading-relaxed">
                  Our advanced engine uses your customized weight, height, age, and activity coefficients to establish optimal maintenance/deficit limits. It splits macros into <strong>Protein (2.0g per kg of bodyweight)</strong>, <strong>Fats (25% energy ratio)</strong>, and <strong>Carbohydrates (balance)</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Configure Calculator Parameters</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Objective</label>
                    <CustomSelect
                      value={calcGoal}
                      onChange={(val) => setCalcGoal(val)}
                      options={[
                        { value: "lose", label: "Fat Loss (-500 kcal)" },
                        { value: "maintain", label: "Maintenance (TDEE)" },
                        { value: "gain", label: "Lean Muscle (+400 kcal)" }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Activity Rate</label>
                    <CustomSelect
                      value={calcActivity}
                      onChange={(val) => setCalcActivity(val)}
                      options={[
                        { value: "1.2", label: "Sedentary (1.2)" },
                        { value: "1.375", label: "Light (1.375)" },
                        { value: "1.55", label: "Moderate (1.55)" },
                        { value: "1.725", label: "Active (1.725)" }
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={calcHeight}
                      onChange={(e) => setCalcHeight(parseInt(e.target.value) || 175)}
                      className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={calcWeight}
                      onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 75)}
                      className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Age (yrs)</label>
                    <input
                      type="number"
                      value={calcAge}
                      onChange={(e) => setCalcAge(parseInt(e.target.value) || 28)}
                      className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={calculateAndApplyGoals}
                  disabled={isSaving}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Apply Smart Bio-Targets</span>
                </button>
              </div>

              {/* Manual adjustment section */}
              <div className="border border-slate-100 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Manual Goal Adjustment</h4>
                
                <form onSubmit={handleGoalsSave} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Calorie Intake Target (kcal)</label>
                    <input
                      type="number"
                      value={goals.dailyCalorieBudget}
                      onChange={(e) => setGoals({ ...goals, dailyCalorieBudget: parseInt(e.target.value) || 2000 })}
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-emerald-700 mb-0.5">Protein (g)</label>
                      <input
                        type="number"
                        value={goals.targetProteinG}
                        onChange={(e) => setGoals({ ...goals, targetProteinG: parseInt(e.target.value) || 120 })}
                        className="w-full bg-emerald-50 border border-emerald-150 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-amber-700 mb-0.5">Carbs (g)</label>
                      <input
                        type="number"
                        value={goals.targetCarbsG}
                        onChange={(e) => setGoals({ ...goals, targetCarbsG: parseInt(e.target.value) || 180 })}
                        className="w-full bg-amber-50 border border-amber-150 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-rose-700 mb-0.5">Fat (g)</label>
                      <input
                        type="number"
                        value={goals.targetFatG}
                        onChange={(e) => setGoals({ ...goals, targetFatG: parseInt(e.target.value) || 60 })}
                        className="w-full bg-rose-50 border border-rose-150 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-900"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono flex justify-between items-center bg-slate-50 p-2.5 rounded-xl">
                    <span>Macro Calorie sum:</span>
                    <strong className="text-slate-700">{goals.targetProteinG * 4 + goals.targetCarbsG * 4 + goals.targetFatG * 9} kcal</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Manual Targets</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ADVANCED SETTINGS TAB */}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Advanced App Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure advanced telemetry, unit systems, BMR formulas, and chimes synced with your cloud Firestore profile.</p>
              </div>
              <Sliders className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[24px] p-5 space-y-6">
              {/* Unit System Select */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-800">Global Measurement System</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Choose standard metric metrics or imperial calculations across all trackers.</p>
                </div>
                <div className="w-full sm:w-60">
                  <CustomSelect
                    value={profile.measurementSystem || "metric"}
                    onChange={async (val) => {
                      const updated = { ...profile, measurementSystem: val as "metric" | "imperial" };
                      setProfile(updated);
                      await dbService.saveProfile(updated);
                      triggerToast(`Measurement units switched to ${val}! 📏`);
                      onProfileUpdated();
                    }}
                    options={[
                      { value: "metric", label: "Metric (kg, cm, ml)" },
                      { value: "imperial", label: "Imperial (lbs, ft, oz)" }
                    ]}
                  />
                </div>
              </div>

              {/* BMR Equation Formulas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
                <div>
                  <h4 className="text-xs font-black text-slate-800">BMR Equation Formula</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Mifflin-St Jeor is recommended as the modern clinical baseline standard.</p>
                </div>
                <div className="w-full sm:w-60">
                  <CustomSelect
                    value={profile.dietFormula || "mifflin"}
                    onChange={async (val) => {
                      const updated = { ...profile, dietFormula: val as "mifflin" | "harris" };
                      setProfile(updated);
                      await dbService.saveProfile(updated);
                      triggerToast(`Calorie calculator formula switched to ${val === "mifflin" ? "Mifflin-St Jeor" : "Harris-Benedict"}! 🧮`);
                      onProfileUpdated();
                    }}
                    options={[
                      { value: "mifflin", label: "Mifflin-St Jeor (Modern)" },
                      { value: "harris", label: "Harris-Benedict (Classic)" }
                    ]}
                  />
                </div>
              </div>

              {/* Haptic / Sound effects */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
                <div>
                  <h4 className="text-xs font-black text-slate-800">App Micro-Sound Alerts</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Toggle pleasant micro-sounds when tracking water, meals, or logging workouts.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedVal = !profile.soundEffectsEnabled;
                      const updated = { ...profile, soundEffectsEnabled: updatedVal };
                      setProfile(updated);
                      await dbService.saveProfile(updated);
                      triggerToast(`Micro-sounds ${updatedVal ? "enabled" : "muted"} successfully! 🔊`);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      profile.soundEffectsEnabled !== false ? "bg-indigo-600" : "bg-slate-250"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        profile.soundEffectsEnabled !== false ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/30 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="text-[10px] text-indigo-950 leading-relaxed">
                <strong>🔒 Multi-Device Synchronization Active:</strong> Advanced preferences are bound directly to your authenticated UID. Whenever you log in on another device or platform, your selected measurement units, target BMR equations, and alert states will be loaded automatically from your dedicated cloud container.
              </div>
            </div>
          </div>
        )}

        {/* HYDRATION STATION TAB */}
        {activeTab === "hydration" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Hydration Station</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automated water tracking and timer notification alerts calibrated based on your current weight.</p>
              </div>
              <Droplet className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Info & Recommendations */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Your Hydration Recommendations</h4>
                
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Logged Weight:</span>
                    <span className="text-xs font-mono font-black text-slate-800">{profile.currentWeightKg} kg</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500 font-semibold">ACSM Fluid Formula:</span>
                    <span className="text-xs font-mono font-black text-indigo-600">35ml / kg</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3 bg-indigo-50/50 p-2 rounded-xl">
                    <span className="text-xs text-indigo-900 font-extrabold flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5 text-indigo-600 animate-pulse fill-indigo-200" />
                      Daily Budget Target:
                    </span>
                    <span className="text-sm font-mono font-black text-indigo-700">{goals.waterGoalMl} ml</span>
                  </div>
                </div>

                {/* Simulated Timer Settings */}
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    <span>Hydration Alarm Schedule</span>
                  </p>
                  
                  <CustomSelect
                    value={String(profile.hydrationReminderMinutes || 120)}
                    onChange={async (val) => {
                      const minutes = parseInt(val);
                      const updated = { ...profile, hydrationReminderMinutes: minutes };
                      setProfile(updated);
                      await dbService.saveProfile(updated);
                      triggerToast(`Hydration alarm schedule adjusted to every ${minutes} minutes!`);
                    }}
                    options={[
                      { value: "60", label: "Hourly Reminders (Highly Active)" },
                      { value: "120", label: "Every 2 Hours (Standard Fitness)" },
                      { value: "180", label: "Every 3 Hours (Sedentary)" },
                      { value: "240", label: "Every 4 Hours" }
                    ]}
                  />

                  <button
                    type="button"
                    onClick={triggerReminderSimulation}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Simulate Alarm Alert Now</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    Clicking simulates an automatic push alert from the Hydration Station. Try clicking and selecting a cup value to fill your logs!
                  </p>
                </div>
              </div>

              {/* Instant drink logger */}
              <div className="border border-slate-100 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Manual Hydration Intake Logger</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => addHydrationIntake(250)}
                    className="p-5 bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-100 text-indigo-900 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      💧
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black">Small Cup</p>
                      <p className="text-[10px] font-mono text-indigo-600 font-bold mt-0.5">250 ml</p>
                    </div>
                  </button>

                  <button
                    onClick={() => addHydrationIntake(500)}
                    className="p-5 bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-100 text-indigo-900 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      🥛
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black">Large Glass</p>
                      <p className="text-[10px] font-mono text-indigo-600 font-bold mt-0.5">500 ml</p>
                    </div>
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl text-[10px] text-slate-500 leading-relaxed space-y-1">
                  <p className="font-extrabold text-slate-800">💧 Why trace hydration?</p>
                  <p>Proper water retention balances electrolyte levels, keeps active joints lubricated, maintains metabolic energy conversion, and maximizes muscular endurance during steep-incline treadmill workouts!</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Sign Out Section */}
      <div className="mt-12 bg-white border border-gray-100 rounded-[24px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-bold text-slate-800">Ready to sign out?</h4>
          <p className="text-xs text-slate-500 mt-1">Your profile settings and cloud logs are fully secured in Firebase Firestore.</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-rose-50 border border-rose-100/50 hover:bg-rose-100 text-rose-600 font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs active:scale-95 w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Account</span>
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[28px] border border-slate-100 p-6 w-full max-w-sm shadow-2xl relative overflow-hidden text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-black text-slate-800 tracking-tight">Sign Out</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to sign out? Your cloud logs and profile settings are completely safe in Firestore!
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-extrabold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

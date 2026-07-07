import React, { useState, useEffect } from "react";
import { WorkoutLog, UserProfile } from "../types";
import { dbService } from "../firebase";
import CustomSelect from "./CustomSelect";
import { 
  Dumbbell, Plus, Trash2, RefreshCw, Sparkles, Heart, Activity, Clock, Flame, Info, ChevronRight, HelpCircle
} from "lucide-react";

interface WorkoutTrackerProps {
  onWorkoutLogged: () => void;
  activeDate: string;
}

// Regular exercise preset multipliers
const EXERCISE_PRESETS = [
  { type: "Running (Flat Outdoor)", kcalPerMinute: 10, icon: "🏃" },
  { type: "Weightlifting / Gym Strength", kcalPerMinute: 5, icon: "🏋️" },
  { type: "HIIT Workout", kcalPerMinute: 11, icon: "⚡" },
  { type: "Cycling / Spin Class", kcalPerMinute: 7.5, icon: "🚴" },
  { type: "Walking (Flat)", kcalPerMinute: 4, icon: "🚶" },
  { type: "Swimming", kcalPerMinute: 8, icon: "🏊" },
  { type: "Yoga / Pilates", kcalPerMinute: 3.5, icon: "🧘" }
];

export default function WorkoutTracker({ onWorkoutLogged, activeDate }: WorkoutTrackerProps) {
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [selectedType, setSelectedType] = useState("Running (Flat Outdoor)");
  const [duration, setDuration] = useState("30");
  const [customCalories, setCustomCalories] = useState("");
  const [isAutoKcal, setIsAutoKcal] = useState(true);
  const [notes, setNotes] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile weight for sports calculations
  const [userWeight, setUserWeight] = useState(75);
  
  // Advanced Treadmill Slope Calculator States
  const [isTreadmillMode, setIsTreadmillMode] = useState(false);
  const [treadmillSpeed, setTreadmillSpeed] = useState("5.0"); // km/h or mph
  const [treadmillSpeedUnit, setTreadmillSpeedUnit] = useState<"kmh" | "mph">("kmh");
  const [treadmillIncline, setTreadmillIncline] = useState(12); // e.g. 12% slope
  const [treadmillFormulaGuide, setTreadmillFormulaGuide] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const w = await dbService.getWorkouts();
        setWorkouts(w);
        
        // Fetch real biometric weight from profile to ensure precise calorie formulas
        const profile = await dbService.getProfile();
        if (profile && profile.currentWeightKg) {
          setUserWeight(profile.currentWeightKg);
        }
      } catch (err) {
        console.error("Workout tracker loading error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDate]);

  // ACSM Metabolic Calculator for Treadmill
  const calculateTreadmillKcal = (): { totalKcal: number, kcalPerMin: number, vo2: number, speedMetersMin: number } => {
    const speedVal = parseFloat(treadmillSpeed) || 0;
    const inclineDecimal = treadmillIncline / 100;
    const mins = parseFloat(duration) || 0;

    // Convert speed to meters per minute
    const speedMetersMin = treadmillSpeedUnit === "kmh" 
      ? speedVal * 16.67   // 1 km/h = 16.67 m/min
      : speedVal * 26.8;   // 1 mph = 26.8 m/min

    // ACSM formula separates Walking vs Running speed thresholds
    // Walking threshold is usually speed <= 3.7 mph or <= 6.0 km/h
    const speedMphEquivalent = treadmillSpeedUnit === "kmh" ? speedVal / 1.609 : speedVal;
    const isWalking = speedMphEquivalent <= 3.7;

    let vo2 = 3.5; // Baseline rest
    if (isWalking) {
      // ACSM Walking Equation: VO2 = (0.1 * Speed) + (1.8 * Speed * Grade) + 3.5
      vo2 = (0.1 * speedMetersMin) + (1.8 * speedMetersMin * inclineDecimal) + 3.5;
    } else {
      // ACSM Running Equation: VO2 = (0.2 * Speed) + (0.9 * Speed * Grade) + 3.5
      vo2 = (0.2 * speedMetersMin) + (0.9 * speedMetersMin * inclineDecimal) + 3.5;
    }

    // Convert VO2 oxygen milliliters per kg per minute to Kcal per minute
    // Formula: Kcal/min = (VO2 * Weight in kg) / 1000 * 5
    const kcalPerMin = (vo2 * userWeight * 5) / 1000;
    const totalKcal = Math.round(kcalPerMin * mins);

    return {
      totalKcal: Math.max(1, totalKcal),
      kcalPerMin: Math.round(kcalPerMin * 10) / 10,
      vo2: Math.round(vo2 * 10) / 10,
      speedMetersMin: Math.round(speedMetersMin)
    };
  };

  // Get general estimated calories burned
  const getEstimatedKcal = () => {
    const mins = parseFloat(duration) || 0;
    if (isTreadmillMode) {
      return calculateTreadmillKcal().totalKcal;
    }
    const preset = EXERCISE_PRESETS.find(p => p.type === selectedType);
    const multiplier = preset ? preset.kcalPerMinute : 6;
    return Math.round(mins * multiplier);
  };

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
    if (val === "Treadmill Advanced Slope") {
      setIsTreadmillMode(true);
    } else {
      setIsTreadmillMode(false);
    }
  };

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMins = parseInt(duration);
    if (isNaN(durationMins) || durationMins <= 0) return;

    let burnedKcal = getEstimatedKcal();
    if (!isTreadmillMode && !isAutoKcal && customCalories) {
      const parsed = parseInt(customCalories);
      if (!isNaN(parsed) && parsed > 0) burnedKcal = parsed;
    }

    setIsSaving(true);
    try {
      // Construct a premium title
      const logType = isTreadmillMode 
        ? `Treadmill (${treadmillSpeed} ${treadmillSpeedUnit === "kmh" ? "km/h" : "mph"} @ ${treadmillIncline}% Grade)` 
        : selectedType;

      const computedNotes = isTreadmillMode 
        ? `ACSM Slope Formula calculated with speed of ${treadmillSpeed} ${treadmillSpeedUnit === "kmh" ? "km/h" : "mph"}, steep incline of ${treadmillIncline}%, and user weight of ${userWeight}kg. ${notes}`.trim()
        : notes.trim();

      const newLog: WorkoutLog = {
        id: "workout_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        date: activeDate,
        timestamp: Date.now(),
        type: logType,
        durationMinutes: durationMins,
        caloriesBurned: burnedKcal,
        notes: computedNotes || undefined
      };

      await dbService.saveWorkout(newLog);
      
      // Reset fields
      setDuration("30");
      setCustomCalories("");
      setNotes("");
      setIsAutoKcal(true);

      // Reload
      const updated = await dbService.getWorkouts();
      setWorkouts(updated);
      onWorkoutLogged();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    await dbService.deleteWorkout(id);
    const updated = await dbService.getWorkouts();
    setWorkouts(updated);
    onWorkoutLogged();
  };

  const dailyWorkouts = workouts.filter(w => w.date === activeDate);
  const totalBurnedToday = dailyWorkouts.reduce((sum, w) => sum + w.caloriesBurned, 0);

  // Computed values for instant feedback
  const treadmillCalcs = calculateTreadmillKcal();

  return (
    <div className="max-w-4xl mx-auto px-4 py-4" id="workout-tracker-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
          <Dumbbell className="w-6 h-6 text-indigo-500" />
          Active Workout Tracker
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Record your dynamic physical activities. Tracking energy expenditure deducts calorie consumption directly from your daily nutrition balance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Record Workout Form */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-[32px] p-6 sm:p-8 shadow-xs">
          <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
            <Plus className="w-4.5 h-4.5 text-indigo-500" />
            <span>Record Physical Activity</span>
          </h3>

          <form onSubmit={handleLogWorkout} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Preset Selection Dropdown following MD3 specifications */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Exercise Preset Type</label>
                <CustomSelect
                  value={selectedType}
                  onChange={handleTypeChange}
                  options={[
                    ...EXERCISE_PRESETS.map((preset) => ({
                      value: preset.type,
                      label: `${preset.icon} ${preset.type}`
                    })),
                    { value: "Treadmill Advanced Slope", label: "🏔️ Treadmill Slope (ACSM Scientific)" },
                    { value: "Custom Gym Session", label: "🏋️‍♂️ Custom Exercise Override" }
                  ]}
                />
              </div>

              {/* Workout Duration */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Duration (Minutes)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl pl-4 pr-12 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    min="1"
                    max="480"
                    required
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                  </span>
                </div>
              </div>
            </div>

            {/* ADVANCED SCIENTIFIC TREADMILL SLOPE MODULE requested by user */}
            {isTreadmillMode && (
              <div className="bg-gradient-to-tr from-indigo-50/50 to-slate-50 border border-indigo-150 rounded-[24px] p-5 space-y-4 animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex justify-between items-center border-b border-indigo-100/50 pb-3">
                  <p className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse fill-indigo-200" />
                    <span>ACSM Treadmill Slope Calculator</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setTreadmillFormulaGuide(!treadmillFormulaGuide)}
                    className="text-[10px] font-extrabold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Show Scientific Formula</span>
                  </button>
                </div>

                {treadmillFormulaGuide && (
                  <div className="bg-white border border-indigo-100 p-4 rounded-xl text-[10px] text-slate-600 leading-relaxed space-y-2 animate-fade-in font-sans">
                    <p className="font-extrabold text-indigo-950">📐 ACSM (American College of Sports Medicine) Equations:</p>
                    <p>• <strong>Walking (≤ 3.7 mph / 6.0 km/h)</strong>:</p>
                    <p className="font-mono bg-slate-50 p-1.5 rounded pl-4 text-indigo-800">VO₂ = (0.1 × S) + (1.8 × S × G) + 3.5 ml/kg/min</p>
                    <p className="mt-1">• <strong>Running (&gt; 3.7 mph / 6.0 km/h)</strong>:</p>
                    <p className="font-mono bg-slate-50 p-1.5 rounded pl-4 text-indigo-800">VO₂ = (0.2 × S) + (0.9 × S × G) + 3.5 ml/kg/min</p>
                    <p className="text-[9px] text-slate-400 mt-2">
                      Where <strong>S</strong> is speed in meters/minute, <strong>G</strong> is incline grade (e.g., 12% = 0.12), and 3.5 is the resting Metabolic Equivalent rate (1 MET). 1 Liter of oxygen equals approximately 5 Calories.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Speed input with custom toggle */}
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 mb-1 px-1">Speed Value</label>
                    <div className="flex border border-slate-150 rounded-2xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                      <input
                        type="number"
                        value={treadmillSpeed}
                        onChange={(e) => setTreadmillSpeed(e.target.value)}
                        className="w-full pl-3.5 pr-1 py-2 text-xs font-bold text-slate-800 outline-none placeholder-slate-400"
                        min="0.1"
                        max="40"
                        step="0.1"
                        required
                      />
                      
                      {/* Unit switcher */}
                      <button
                        type="button"
                        onClick={() => setTreadmillSpeedUnit(prev => prev === "kmh" ? "mph" : "kmh")}
                        className="bg-indigo-50 border-l border-slate-100 text-indigo-700 font-black text-[10px] px-2.5 hover:bg-indigo-100 transition-all"
                      >
                        {treadmillSpeedUnit === "kmh" ? "km/h" : "mph"}
                      </button>
                    </div>
                  </div>

                  {/* Incline Percent grade */}
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <label className="block text-[10px] font-bold text-indigo-950">Incline Grade</label>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md font-mono">{treadmillIncline}% Grade</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-150 rounded-2xl px-3 py-2">
                      <input
                        type="range"
                        min="0"
                        max="25"
                        step="0.5"
                        value={treadmillIncline}
                        onChange={(e) => setTreadmillIncline(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* User Weight override */}
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 mb-1 px-1">Biometric Weight</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={userWeight}
                        onChange={(e) => setUserWeight(parseFloat(e.target.value) || 75)}
                        className="w-full bg-white border border-slate-150 rounded-2xl pl-3.5 pr-10 py-2.5 text-xs font-bold text-slate-800"
                        min="10"
                        max="300"
                        step="0.1"
                        required
                      />
                      <span className="absolute inset-y-0 right-3.5 flex items-center text-[10px] font-bold text-slate-400">kg</span>
                    </div>
                  </div>
                </div>

                {/* Instant Real-Time Formula Feedback */}
                <div className="bg-white border border-indigo-50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-indigo-600 fill-indigo-200" />
                      <span className="text-sm font-black text-indigo-950">{treadmillCalcs.kcalPerMin} Kcal / Min</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                        {parseFloat(treadmillSpeed) / (treadmillSpeedUnit === "kmh" ? 1.609 : 1) <= 3.7 ? "ACSM Walk" : "ACSM Run"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-none">
                      Metabolic Rate: <strong className="text-slate-600">{treadmillCalcs.vo2} VO₂ ml/kg/min</strong> ({Math.round(treadmillCalcs.vo2 / 3.5)} METs)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold">Estimated Burn:</p>
                    <p className="text-lg font-black text-indigo-600 font-mono tracking-tight">{treadmillCalcs.totalKcal} kcal</p>
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-150/40 text-[9px] text-amber-900 leading-relaxed">
                  💡 <strong>Slope Science:</strong> Walking at 5.0 km/h on a steep 12% slope burns almost <strong>3x more calories</strong> than walking flatly at the same speed due to vertical lift gravitational resistance!
                </div>
              </div>
            )}

            {/* Standard Calorie Configuration (Hidden when Advanced Treadmill Mode is selected) */}
            {!isTreadmillMode && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 px-1">Calorie Expenditure Source</span>
                  <div className="flex bg-slate-200/50 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsAutoKcal(true)}
                      className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        isAutoKcal ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Preset METs
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAutoKcal(false)}
                      className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        !isAutoKcal ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Custom Override
                    </button>
                  </div>
                </div>

                {isAutoKcal ? (
                  <div className="flex items-center gap-2 bg-white border border-slate-100 p-3 rounded-xl shadow-3xs">
                    <Flame className="w-5 h-5 text-indigo-500 fill-indigo-200" />
                    <div>
                      <span className="text-base font-black text-indigo-950">{getEstimatedKcal()} kcal</span>
                      <span className="text-[10px] text-slate-400 ml-2">Based on exercise category averages</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative max-w-xs">
                    <input
                      type="number"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      placeholder="e.g. 350"
                      className="w-full bg-white border border-slate-150 rounded-xl pl-4 pr-12 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="1"
                      required={!isAutoKcal}
                    />
                    <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-slate-400">kcal</span>
                  </div>
                )}
              </div>
            )}

            {/* Workout Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Workout Notes / Incline feedback</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Steep slope workout, high intensity heart rate, felt amazing!"
                className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || !duration}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white text-xs font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-100 cursor-pointer"
              id="btn-log-workout"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Logging...
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" /> Log Active Workout Session
                </>
              )}
            </button>
          </form>
        </div>

        {/* Workout List for today */}
        <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Logged Today ({dailyWorkouts.length})</h3>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">-{totalBurnedToday} kcal</span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {dailyWorkouts.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[24px]">
                  <Heart className="w-7 h-7 text-slate-300 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs font-extrabold text-slate-400">No exercise logs today</p>
                  <p className="text-[10px] text-slate-300 max-w-[150px] mx-auto mt-1">Get active to deduct calories and hit targets!</p>
                </div>
              ) : (
                dailyWorkouts.map(work => (
                  <div key={work.id} className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-150 transition-colors flex flex-col justify-between relative group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-xs font-black text-slate-800 pr-5 leading-snug">{work.type}</h4>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{work.durationMinutes} minutes duration</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteWorkout(work.id)}
                        className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Delete workout log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {work.notes && (
                      <p className="text-[10px] text-slate-500 italic mt-2.5 bg-white border border-slate-150 p-2.5 rounded-xl leading-relaxed">
                        {work.notes}
                      </p>
                    )}
                    
                    <span className="self-end text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100/40 px-2.5 py-1 rounded-lg mt-3">
                      -{work.caloriesBurned} kcal
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Cal AI Science Tip:</strong> Every logged workout reduces your total net calories, expanding your remaining budget allowance for meals today!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

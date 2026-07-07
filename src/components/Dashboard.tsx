import React, { useState, useEffect } from "react";
import { MealLog, WorkoutLog, WaterLog, UserGoals } from "../types";
import { dbService } from "../firebase";
import { 
  Flame, CupSoda, Trash2, Calendar, Plus, RefreshCw, Sparkles, Dumbbell, Heart
} from "lucide-react";

interface DashboardProps {
  activeDate: string;
  triggerRefresh: number;
  onRefreshNeeded: () => void;
  onNavigateToScan: () => void;
}

export default function Dashboard({ activeDate, triggerRefresh, onRefreshNeeded, onNavigateToScan }: DashboardProps) {
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [water, setWater] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Data for Active Date
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const g = await dbService.getGoals();
        const m = await dbService.getMeals(activeDate);
        const w = await dbService.getWorkouts(activeDate);
        const h = await dbService.getWater(activeDate);
        
        setGoals(g);
        setMeals(m);
        setWorkouts(w);
        setWater(h);
      } catch (err) {
        console.error("Dashboard error loading daily logs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDate, triggerRefresh]);

  // Calculations
  const totalCaloriesIn = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalCaloriesOut = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
  const dailyBudget = goals?.dailyCalorieBudget || 2000;
  const netCalories = totalCaloriesIn - totalCaloriesOut;
  const remainingCalories = dailyBudget - netCalories;

  const totalProteinIn = meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbsIn = meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFatIn = meals.reduce((sum, m) => sum + m.fat, 0);

  const targetProtein = goals?.targetProteinG || 130;
  const targetCarbs = goals?.targetCarbsG || 220;
  const targetFat = goals?.targetFatG || 65;

  const totalWaterIn = water.reduce((sum, h) => sum + h.amountMl, 0);
  const targetWater = goals?.waterGoalMl || 2500;

  // Percentage calculations
  const caloriePercent = Math.min(100, Math.round((totalCaloriesIn / dailyBudget) * 100));
  const proteinPercent = Math.min(100, Math.round((totalProteinIn / targetProtein) * 100));
  const carbsPercent = Math.min(100, Math.round((totalCarbsIn / targetCarbs) * 100));
  const fatPercent = Math.min(100, Math.round((totalFatIn / targetFat) * 100));
  const waterPercent = Math.min(100, Math.round((totalWaterIn / targetWater) * 100));

  // Quick action to add Water
  const logWaterAmount = async (amount: number) => {
    const newLog: WaterLog = {
      id: "water_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      date: activeDate,
      timestamp: Date.now(),
      amountMl: amount
    };
    await dbService.saveWater(newLog);
    onRefreshNeeded();
  };

  const deleteMealLog = async (id: string) => {
    await dbService.deleteMeal(id);
    onRefreshNeeded();
  };

  const deleteWaterLog = async () => {
    if (water.length === 0) return;
    // Delete the last water entry
    const last = water[0];
    await dbService.deleteWater(last.id);
    onRefreshNeeded();
  };

  const deleteWorkoutLog = async (id: string) => {
    await dbService.deleteWorkout(id);
    onRefreshNeeded();
  };

  if (loading || !goals) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Circular progress parameter
  const circleRadius = 70;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (Math.min(100, Math.round((netCalories / dailyBudget) * 100)) / 100) * circleCircumference;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" id="dashboard-container">
      {/* Date Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-1.5">
            <Calendar className="w-5 h-5 text-indigo-500" />
            Today's Diary
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{activeDate}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNavigateToScan}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Scan/Log Meal
          </button>
        </div>
      </div>

      {/* Bento Grid Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Core Ring Dashboard Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Calorie Intake Remaining</h3>
          
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* SVG Ring Gauge */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="88"
                cy="88"
                r={circleRadius}
                className="stroke-gray-100 fill-none"
                strokeWidth="12"
              />
              <circle
                cx="88"
                cy="88"
                r={circleRadius}
                className="stroke-indigo-600 transition-all duration-500 ease-out fill-none"
                strokeWidth="12"
                strokeDasharray={circleCircumference}
                strokeDashoffset={isNaN(strokeDashoffset) ? circleCircumference : strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            
            {/* Ring Center Texts */}
            <div className="absolute text-center flex flex-col justify-center">
              <span className="text-2xl font-black text-gray-800 tracking-tight">
                {remainingCalories >= 0 ? remainingCalories : Math.abs(remainingCalories)}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {remainingCalories >= 0 ? "kcal Left" : "kcal Over"}
              </span>
              <span className="text-[10px] text-gray-400 mt-1">
                Goal: {dailyBudget} kcal
              </span>
            </div>
          </div>

          <div className="flex gap-6 w-full justify-center mt-4 border-t border-gray-50 pt-3">
            <div className="text-center">
              <span className="text-xs font-semibold text-gray-400">Intake</span>
              <p className="text-sm font-bold text-indigo-900">{totalCaloriesIn} kcal</p>
            </div>
            <div className="text-center border-l border-gray-100 pl-6">
              <span className="text-xs font-semibold text-gray-400">Burned</span>
              <p className="text-sm font-bold text-emerald-600">-{totalCaloriesOut} kcal</p>
            </div>
          </div>
        </div>

        {/* Macros card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Macronutrients Split</h3>
          
          <div className="space-y-4">
            {/* Protein */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Protein
                </span>
                <span className="text-gray-500 font-medium">
                  {totalProteinIn}g / {targetProtein}g
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all" 
                  style={{ width: `${proteinPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Carbohydrates
                </span>
                <span className="text-gray-500 font-medium">
                  {totalCarbsIn}g / {targetCarbs}g
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all" 
                  style={{ width: `${carbsPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Fats */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Fats
                </span>
                <span className="text-gray-500 font-medium">
                  {totalFatIn}g / {targetFat}g
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all" 
                  style={{ width: `${fatPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 rounded-lg p-2.5 mt-4 text-[10px] text-indigo-700 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Remaining target: P: {Math.max(0, targetProtein - totalProteinIn)}g, C: {Math.max(0, targetCarbs - totalCarbsIn)}g, F: {Math.max(0, targetFat - totalFatIn)}g
          </div>
        </div>

        {/* WATER TRACKER PANEL */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hydration Station</h3>
            <span className="text-xs font-bold text-sky-600">{totalWaterIn}ml / {targetWater}ml</span>
          </div>

          {/* Cup layout */}
          <div className="flex items-center justify-center py-4">
            <div className="relative w-20 h-28 border-4 border-gray-200 border-t-0 rounded-b-2xl overflow-hidden flex items-end">
              {/* Liquid fluid animation representation */}
              <div 
                className="w-full bg-sky-400 transition-all duration-500 relative animate-pulse"
                style={{ height: `${waterPercent}%` }}
              >
                {/* wave top representation */}
                <div className="absolute -top-1 inset-x-0 h-1 bg-sky-300 opacity-80"></div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-xs font-bold">
                <CupSoda className="w-8 h-8 text-sky-200" />
                <span className="text-[10px] font-mono mt-1 text-gray-600">{waterPercent}%</span>
              </div>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => logWaterAmount(250)}
                className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold py-1.5 rounded-lg border border-sky-100 transition-all cursor-pointer"
              >
                +250ml Glass
              </button>
              <button
                onClick={() => logWaterAmount(500)}
                className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold py-1.5 rounded-lg border border-sky-100 transition-all cursor-pointer"
              >
                +500ml Bottle
              </button>
            </div>
            {water.length > 0 && (
              <button
                onClick={deleteWaterLog}
                className="w-full text-[10px] font-semibold text-gray-400 hover:text-rose-500 flex items-center justify-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Undo Last Drink
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S logged MEALS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meals list */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-indigo-500" />
            Meals Logged Today ({meals.length})
          </h3>

          {meals.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
              <Sparkles className="w-8 h-8 text-indigo-200 mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-semibold text-gray-600">Your food diary is empty</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Snap a photo of your meal or use our text estimator to instantly estimate ingredients and calories.
              </p>
              <button
                onClick={onNavigateToScan}
                className="mt-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold py-2 px-4 rounded-lg transition-all"
              >
                Scan My First Meal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {meals.map((meal) => (
                <div key={meal.id} className="flex flex-col bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shadow-3xs transition-all relative group">
                  {/* Top Image Box */}
                  <div className="relative w-full h-44 overflow-hidden bg-indigo-50/50 flex-shrink-0">
                    {meal.imageUrl ? (
                      <img src={meal.imageUrl} alt={meal.foodName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-indigo-100/40 flex items-center justify-center text-indigo-400">
                        <Sparkles className="w-8 h-8 animate-pulse" />
                      </div>
                    )}
                    {/* Glassmorphic delete button */}
                    <button
                      onClick={() => deleteMealLog(meal.id)}
                      className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-2 rounded-xl transition-all shadow-3xs hover:scale-105 cursor-pointer z-10 border border-slate-100"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* Details (Second row & onwards - tightly packed to remove blank space) */}
                  <div className="p-4.5 flex-1 flex flex-col gap-3">
                    {/* Second Row: Name & Calories */}
                    <div className="flex justify-between items-start gap-3">
                      <h4 className="text-base font-extrabold text-slate-800 break-words leading-snug flex-1" title={meal.foodName}>
                        {meal.foodName}
                      </h4>
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/20 px-3 py-1 rounded-full flex-shrink-0">
                        {meal.calories} kcal
                      </span>
                    </div>
                    
                    {/* Optional estimated weight */}
                    {meal.weightGrams && (
                      <p className="text-xs font-bold text-slate-400 -mt-1.5">
                        Estimated Weight: {meal.weightGrams}g
                      </p>
                    )}

                    {/* Third Row: Macro badges horizontal row with larger text */}
                    <div className="flex items-center justify-between gap-1 bg-white border border-slate-100 rounded-xl p-2.5 shadow-4xs text-xs font-extrabold text-slate-600">
                      <span className="flex items-center gap-1.5 flex-1 justify-center border-r border-slate-100/80 py-0.5 px-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span className="text-[11px] text-slate-400 font-extrabold">P:</span>
                        <strong className="text-emerald-600 text-sm">{meal.protein}g</strong>
                      </span>
                      <span className="flex items-center gap-1.5 flex-1 justify-center border-r border-slate-100/80 py-0.5 px-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        <span className="text-[11px] text-slate-400 font-extrabold">C:</span>
                        <strong className="text-amber-600 text-sm">{meal.carbs}g</strong>
                      </span>
                      <span className="flex items-center gap-1.5 flex-1 justify-center py-0.5 px-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <span className="text-[11px] text-slate-400 font-extrabold">F:</span>
                        <strong className="text-rose-600 text-sm">{meal.fat}g</strong>
                      </span>
                    </div>

                    {/* Subitems lists */}
                    {meal.items && meal.items.length > 0 && (
                      <div className="text-[11px] text-slate-500 whitespace-normal break-words leading-relaxed max-w-full bg-white border border-slate-100/60 p-2.5 rounded-xl">
                        <span className="font-bold text-slate-400">Includes:</span> {meal.items.map(it => `${it.name} (${it.weightGrams}g)`).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WORKOUTS LOGS */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5">
              <Dumbbell className="w-4 h-4 text-emerald-500" />
              Active Energy Burned ({workouts.length})
            </h3>

            {workouts.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-100 rounded-xl">
                <Heart className="w-6 h-6 text-gray-300 mx-auto mb-1 animate-pulse" />
                <p className="text-xs font-semibold text-gray-500">No workout logged today</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Go to the Workout tab to record exercises and deduct calories.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {workouts.map(work => (
                  <div key={work.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-100/50">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{work.type}</p>
                      <p className="text-[10px] text-gray-400">{work.durationMinutes} minutes</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                        -{work.caloriesBurned} kcal
                      </span>
                      <button 
                        onClick={() => deleteWorkoutLog(work.id)}
                        className="text-gray-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-50 text-[10px] text-gray-400 flex items-center gap-1 leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            Active exercise directly deducts from net calories allowing additional food intake.
          </div>
        </div>
      </div>
    </div>
  );
}

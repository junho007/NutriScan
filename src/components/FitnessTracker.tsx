import React, { useState } from "react";
import WorkoutTracker from "./WorkoutTracker";
import WeightTracker from "./WeightTracker";
import { Dumbbell, Scale, Activity } from "lucide-react";

interface FitnessTrackerProps {
  activeDate: string;
  onRefreshNeeded: () => void;
}

export default function FitnessTracker({ activeDate, onRefreshNeeded }: FitnessTrackerProps) {
  const [subTab, setSubTab] = useState<"workouts" | "weight">("workouts");

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="fitness-tracker-root">
      
      {/* Tabs list following elegant flat bottom-bordered layout consistent with AiTips and Profile */}
      <div className="flex justify-start sm:justify-center flex-nowrap border-b border-gray-200/80 pb-px mb-6 overflow-x-auto whitespace-nowrap scrollbar-none" id="subtabs-container">
        <button
          onClick={() => setSubTab("workouts")}
          className={`px-5 py-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subTab === "workouts"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
          id="subtab-workouts"
        >
          <Dumbbell className="w-4 h-4" />
          <span>Workout Logs</span>
        </button>
        
        <button
          onClick={() => setSubTab("weight")}
          className={`px-5 py-3 text-xs font-extrabold cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            subTab === "weight"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
          id="subtab-weight"
        >
          <Scale className="w-4 h-4" />
          <span>Weight Tracker</span>
        </button>
      </div>

      {/* Main Panel Frame */}
      <div className="animate-fade-in">
        {subTab === "workouts" ? (
          <WorkoutTracker onWorkoutLogged={onRefreshNeeded} activeDate={activeDate} />
        ) : (
          <WeightTracker onWeightLogged={onRefreshNeeded} activeDate={activeDate} />
        )}
      </div>

    </div>
  );
}

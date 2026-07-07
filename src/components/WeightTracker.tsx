import React, { useState, useEffect } from "react";
import { WeightLog, UserGoals } from "../types";
import { dbService } from "../firebase";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  TrendingDown, Plus, Trash2, RefreshCw, Calendar, Sparkles, Scale, Target, Trophy
} from "lucide-react";

interface WeightTrackerProps {
  onWeightLogged: () => void;
  activeDate: string;
}

export default function WeightTracker({ onWeightLogged, activeDate }: WeightTrackerProps) {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const w = await dbService.getWeight();
        const g = await dbService.getGoals();
        setWeightLogs(w);
        setGoals(g);
      } catch (err) {
        console.error("Weight tracker error loading data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDate]);

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(newWeight);
    if (isNaN(weightVal) || weightVal <= 0) return;

    setIsSaving(true);
    try {
      const newLog: WeightLog = {
        id: "weight_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        date: activeDate,
        timestamp: Date.now(),
        weightKg: weightVal
      };

      await dbService.saveWeight(newLog);
      
      // Update local profile weight
      const profile = await dbService.getProfile();
      if (profile) {
        profile.currentWeightKg = weightVal;
        await dbService.saveProfile(profile);
      }

      setNewWeight("");
      
      // Reload weight list
      const updated = await dbService.getWeight();
      setWeightLogs(updated);
      onWeightLogged();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeight = async (id: string) => {
    await dbService.deleteWeight(id);
    const updated = await dbService.getWeight();
    setWeightLogs(updated);
    onWeightLogged();
  };

  // Prepare chart data - Recharts wants chronological order (oldest to newest)
  const chartData = [...weightLogs]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(log => ({
      date: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weight: log.weightKg
    }));

  const latestWeight = weightLogs.length > 0 ? weightLogs[0].weightKg : (goals?.targetWeightKg ? goals.targetWeightKg + 5 : 75);
  const targetWeight = goals?.targetWeightKg || 70;
  const kgDifference = Math.abs(latestWeight - targetWeight).toFixed(1);
  const isGoalReached = latestWeight <= targetWeight; // Assuming weight loss goal, adjust description based on goal

  if (loading || !goals) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" id="weight-tracker-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-500" />
          Weight Progression Tracking
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor your body composition trends over time. Logging weight automatically charts progress and estimates nutritional calorie goals.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        
        {/* Current Weight */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Weight</span>
            <p className="text-2xl font-black text-gray-800 tracking-tight">
              {weightLogs.length > 0 ? `${weightLogs[0].weightKg} kg` : "Not Logged"}
            </p>
            <p className="text-[10px] text-gray-400">Latest entry</p>
          </div>
        </div>

        {/* Target Weight */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Goal</span>
            <p className="text-2xl font-black text-gray-800 tracking-tight">{targetWeight} kg</p>
            <p className="text-[10px] text-gray-400">Configure in goals tab</p>
          </div>
        </div>

        {/* Goal difference */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Goal Distance</span>
            <p className="text-2xl font-black text-gray-800 tracking-tight">
              {kgDifference} kg
            </p>
            <p className="text-[10px] text-gray-400">
              {latestWeight > targetWeight ? "Above target weight" : "Goal reached or below target!"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Graph display */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-indigo-500" />
            Progression Line Chart
          </h3>

          <div className="w-full h-72">
            {chartData.length === 0 ? (
              <div className="w-full h-full border border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center">
                <Sparkles className="w-8 h-8 text-indigo-200 mb-2 animate-pulse" />
                <p className="text-sm font-semibold text-gray-500">Need weights data</p>
                <p className="text-xs text-gray-400 mt-1">Log weights over several days to view curved regression graph analysis.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: "#94a3b8" }} 
                    stroke="#cbd5e1"
                  />
                  <YAxis 
                    domain={["dataMin - 3", "dataMax + 3"]} 
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    stroke="#cbd5e1"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#ffffff", 
                      borderRadius: "12px", 
                      border: "1px solid #f1f5f9",
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)"
                    }}
                    labelStyle={{ fontSize: "11px", fontWeight: "bold", color: "#475569" }}
                    itemStyle={{ fontSize: "12px", fontWeight: "bold", color: "#6366f1" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: "#6366f1", strokeWidth: 2, fill: "#ffffff" }}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Add/Log Weight Form */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-500" />
              Log Body Weight
            </h3>

            <form onSubmit={handleLogWeight} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Body Weight (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="e.g. 74.2"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-4 pr-12 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    step="0.1"
                    min="10"
                    max="300"
                    required
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-gray-400">kg</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving || !newWeight}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                id="btn-add-weight"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Save Weight Log
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Weight entry history */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Logged Entries ({weightLogs.length})
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {weightLogs.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">No entries logged yet.</p>
              ) : (
                weightLogs.map(log => (
                  <div key={log.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-100/30 text-xs">
                    <div>
                      <p className="font-semibold text-gray-800">{log.weightKg} kg</p>
                      <p className="text-[10px] text-gray-400">{log.date}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteWeight(log.id)}
                      className="text-gray-300 hover:text-rose-500 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

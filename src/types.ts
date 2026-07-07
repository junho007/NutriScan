export interface FoodItem {
  name: string;
  weightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealScanResult {
  foodName: string;
  confidence: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  weightGrams: number;
  items: FoodItem[];
  description: string;
}

export interface MealLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weightGrams?: number;
  imageUrl?: string;
  items?: FoodItem[];
  source: 'scan' | 'manual';
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  type: string; // e.g., Running, Weightlifting, Cycling, Swimming, Walking, Yoga, etc.
  durationMinutes: number;
  caloriesBurned: number;
  notes?: string;
}

export interface WaterLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  amountMl: number;
}

export interface WeightLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  weightKg: number;
}

export interface UserGoals {
  dailyCalorieBudget: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  targetWeightKg: number;
  waterGoalMl: number;
}

export interface UserProfile {
  name: string;
  currentWeightKg: number;
  targetWeightKg: number;
  heightCm: number;
  age: number;
  gender: string;
  activityLevel: string; // Sedentary, Lightly Active, Moderately Active, Very Active
  nationality?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  customAppName?: string;
  hydrationReminderMinutes?: number;
  measurementSystem?: "metric" | "imperial";
  dietFormula?: "mifflin" | "harris";
  soundEffectsEnabled?: boolean;
  avatarUrl?: string;
  favoriteFoods?: string;
  favoriteDrinks?: string;
  dislikedFoods?: string;
  dietaryRestrictions?: string;
}

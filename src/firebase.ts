import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { MealLog, WorkoutLog, WaterLog, WeightLog, UserGoals, UserProfile } from "./types";
import firebaseConfig from "../firebase-applet-config.json";

let db: any = null;
let auth: any = null;
let useFirebase = false;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  auth = getAuth(app);
  useFirebase = true;
  console.log("Firebase & Auth initialized successfully with project:", firebaseConfig.projectId, "and DB:", (firebaseConfig as any).firestoreDatabaseId);
} catch (error) {
  console.error("Firebase failed to initialize. Falling back to simulated/local mode.", error);
  useFirebase = false;
}

// Simulated Local Auth State (when Firebase Auth isn't enabled or is blocked)
export interface SimulatedUser {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
  isSimulated: boolean;
}

let activeUser: SimulatedUser | FirebaseUser | null = null;
const authListeners: Array<(user: SimulatedUser | FirebaseUser | null) => void> = [];

// Get current active user ID (for scoping data)
export function getActiveUserId(): string {
  if (activeUser) {
    return activeUser.uid;
  }
  return "demo_sandbox_user";
}

// Trigger all listeners when auth state changes
function triggerAuthChange(user: SimulatedUser | FirebaseUser | null) {
  activeUser = user;
  authListeners.forEach((listener) => {
    try {
      listener(user);
    } catch (e) {
      console.error("Auth listener error:", e);
    }
  });
}

// Initialise Auth Listener
if (useFirebase && auth) {
  onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      triggerAuthChange(fbUser);
    } else {
      // If no fbUser, check if there's a cached simulated user session
      const cachedSim = localStorage.getItem("simulated_active_user");
      if (cachedSim) {
        triggerAuthChange(JSON.parse(cachedSim));
      } else {
        triggerAuthChange(null);
      }
    }
  });
} else {
  // If no firebase, load simulated user on startup if exists
  setTimeout(() => {
    const cachedSim = localStorage.getItem("simulated_active_user");
    if (cachedSim) {
      triggerAuthChange(JSON.parse(cachedSim));
    } else {
      triggerAuthChange(null);
    }
  }, 100);
}

// Helper to recursively strip any properties with undefined values so Firestore does not throw an error
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// Default Initial Values
const DEFAULT_GOALS: UserGoals = {
  dailyCalorieBudget: 2000,
  targetProteinG: 130,
  targetCarbsG: 220,
  targetFatG: 65,
  targetWeightKg: 70,
  waterGoalMl: 2500,
};

const DEFAULT_PROFILE: UserProfile = {
  name: "Fitness Enthusiast",
  currentWeightKg: 75,
  targetWeightKg: 70,
  heightCm: 175,
  age: 28,
  gender: "Non-binary",
  activityLevel: "Moderately Active",
  phoneCountryCode: "+1",
  phoneNumber: "",
  customAppName: "Core",
  hydrationReminderMinutes: 120,
  measurementSystem: "metric",
  dietFormula: "mifflin",
  soundEffectsEnabled: true
};

// Database Service with automatic scoping to the active user and localStorage fallback
export const dbService = {
  isFirebaseConnected(): boolean {
    return useFirebase;
  },

  // GET COLLECTION scoped by user
  getCollectionPath(collectionName: string) {
    const uid = getActiveUserId();
    return `users/${uid}/${collectionName}`;
  },

  getDocPath(collectionName: string, docId: string) {
    const uid = getActiveUserId();
    return `users/${uid}/${collectionName}/${docId}`;
  },

  // USER PROFILE
  async getProfile(): Promise<UserProfile> {
    const uid = getActiveUserId();
    const defaultData = { ...DEFAULT_PROFILE };
    
    // Always attempt localStorage first/fallback scoped by User ID
    const localKey = `profile_${uid}`;
    const cached = localStorage.getItem(localKey);
    const fallbackProfile = cached ? JSON.parse(cached) : defaultData;

    if (!useFirebase) {
      return fallbackProfile;
    }
    try {
      const q = query(collection(db, "users", uid, "profile"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as UserProfile;
        localStorage.setItem(localKey, JSON.stringify(data));
        return data;
      }
      // Seed initial
      await this.saveProfile(fallbackProfile);
      return fallbackProfile;
    } catch (e) {
      console.warn("Firestore error, reading profile locally:", e);
      return fallbackProfile;
    }
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `profile_${uid}`;
    localStorage.setItem(localKey, JSON.stringify(profile));
    
    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "profile", "main_profile"), sanitizeForFirestore(profile));
    } catch (e) {
      console.error("Failed to save profile to Firestore", e);
    }
  },

  // USER GOALS
  async getGoals(): Promise<UserGoals> {
    const uid = getActiveUserId();
    const defaultData = { ...DEFAULT_GOALS };
    const localKey = `goals_${uid}`;
    const cached = localStorage.getItem(localKey);
    const fallbackGoals = cached ? JSON.parse(cached) : defaultData;

    if (!useFirebase) {
      return fallbackGoals;
    }
    try {
      const q = query(collection(db, "users", uid, "goals"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as UserGoals;
        localStorage.setItem(localKey, JSON.stringify(data));
        return data;
      }
      // Seed initial
      await this.saveGoals(fallbackGoals);
      return fallbackGoals;
    } catch (e) {
      console.warn("Firestore error, reading goals locally:", e);
      return fallbackGoals;
    }
  },

  async saveGoals(goals: UserGoals): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `goals_${uid}`;
    localStorage.setItem(localKey, JSON.stringify(goals));

    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "goals", "main_goals"), sanitizeForFirestore(goals));
    } catch (e) {
      console.error("Failed to save goals to Firestore", e);
    }
  },

  // MEAL LOGS
  async getMeals(date?: string): Promise<MealLog[]> {
    const uid = getActiveUserId();
    const localKey = `meals_${uid}`;
    
    const getLocalMeals = (): MealLog[] => {
      const cached = localStorage.getItem(localKey);
      return cached ? JSON.parse(cached) : [];
    };

    if (!useFirebase) {
      const meals = getLocalMeals();
      return date ? meals.filter((m) => m.date === date) : meals;
    }
    try {
      const q = query(collection(db, "users", uid, "meals"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const meals: MealLog[] = [];
      snap.forEach((d) => {
        meals.push({ id: d.id, ...d.data() } as MealLog);
      });
      localStorage.setItem(localKey, JSON.stringify(meals));
      return date ? meals.filter((m) => m.date === date) : meals;
    } catch (e) {
      console.warn("Firestore error, reading meals locally:", e);
      const meals = getLocalMeals();
      return date ? meals.filter((m) => m.date === date) : meals;
    }
  },

  async saveMeal(meal: MealLog): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `meals_${uid}`;
    
    const cached = localStorage.getItem(localKey);
    const meals: MealLog[] = cached ? JSON.parse(cached) : [];
    const index = meals.findIndex((m) => m.id === meal.id);
    if (index >= 0) {
      meals[index] = meal;
    } else {
      meals.unshift(meal);
    }
    localStorage.setItem(localKey, JSON.stringify(meals));

    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "meals", meal.id), sanitizeForFirestore(meal));
    } catch (e) {
      console.error("Failed to save meal to Firestore", e);
    }
  },

  async deleteMeal(id: string): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `meals_${uid}`;
    
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const meals: MealLog[] = JSON.parse(cached);
      const filtered = meals.filter((m) => m.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
    if (!useFirebase) return;
    try {
      await deleteDoc(doc(db, "users", uid, "meals", id));
    } catch (e) {
      console.error("Failed to delete meal from Firestore", e);
    }
  },

  // WORKOUT LOGS
  async getWorkouts(date?: string): Promise<WorkoutLog[]> {
    const uid = getActiveUserId();
    const localKey = `workouts_${uid}`;

    const getLocalWorkouts = (): WorkoutLog[] => {
      const cached = localStorage.getItem(localKey);
      return cached ? JSON.parse(cached) : [];
    };

    if (!useFirebase) {
      const workouts = getLocalWorkouts();
      return date ? workouts.filter((w) => w.date === date) : workouts;
    }
    try {
      const q = query(collection(db, "users", uid, "workouts"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const workouts: WorkoutLog[] = [];
      snap.forEach((d) => {
        workouts.push({ id: d.id, ...d.data() } as WorkoutLog);
      });
      localStorage.setItem(localKey, JSON.stringify(workouts));
      return date ? workouts.filter((w) => w.date === date) : workouts;
    } catch (e) {
      console.warn("Firestore error, reading workouts locally:", e);
      const workouts = getLocalWorkouts();
      return date ? workouts.filter((w) => w.date === date) : workouts;
    }
  },

  async saveWorkout(workout: WorkoutLog): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `workouts_${uid}`;
    
    const cached = localStorage.getItem(localKey);
    const workouts: WorkoutLog[] = cached ? JSON.parse(cached) : [];
    const index = workouts.findIndex((w) => w.id === workout.id);
    if (index >= 0) {
      workouts[index] = workout;
    } else {
      workouts.unshift(workout);
    }
    localStorage.setItem(localKey, JSON.stringify(workouts));

    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "workouts", workout.id), sanitizeForFirestore(workout));
    } catch (e) {
      console.error("Failed to save workout to Firestore", e);
    }
  },

  async deleteWorkout(id: string): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `workouts_${uid}`;

    const cached = localStorage.getItem(localKey);
    if (cached) {
      const workouts: WorkoutLog[] = JSON.parse(cached);
      const filtered = workouts.filter((w) => w.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
    if (!useFirebase) return;
    try {
      await deleteDoc(doc(db, "users", uid, "workouts", id));
    } catch (e) {
      console.error("Failed to delete workout from Firestore", e);
    }
  },

  // WATER LOGS
  async getWater(date?: string): Promise<WaterLog[]> {
    const uid = getActiveUserId();
    const localKey = `water_${uid}`;

    const getLocalWater = (): WaterLog[] => {
      const cached = localStorage.getItem(localKey);
      return cached ? JSON.parse(cached) : [];
    };

    if (!useFirebase) {
      const water = getLocalWater();
      return date ? water.filter((w) => w.date === date) : water;
    }
    try {
      const q = query(collection(db, "users", uid, "water"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const water: WaterLog[] = [];
      snap.forEach((d) => {
        water.push({ id: d.id, ...d.data() } as WaterLog);
      });
      localStorage.setItem(localKey, JSON.stringify(water));
      return date ? water.filter((w) => w.date === date) : water;
    } catch (e) {
      console.warn("Firestore error, reading water locally:", e);
      const water = getLocalWater();
      return date ? water.filter((w) => w.date === date) : water;
    }
  },

  async saveWater(water: WaterLog): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `water_${uid}`;

    const cached = localStorage.getItem(localKey);
    const waterList: WaterLog[] = cached ? JSON.parse(cached) : [];
    const index = waterList.findIndex((w) => w.id === water.id);
    if (index >= 0) {
      waterList[index] = water;
    } else {
      waterList.unshift(water);
    }
    localStorage.setItem(localKey, JSON.stringify(waterList));

    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "water", water.id), sanitizeForFirestore(water));
    } catch (e) {
      console.error("Failed to save water log to Firestore", e);
    }
  },

  async deleteWater(id: string): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `water_${uid}`;

    const cached = localStorage.getItem(localKey);
    if (cached) {
      const waterList: WaterLog[] = JSON.parse(cached);
      const filtered = waterList.filter((w) => w.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
    if (!useFirebase) return;
    try {
      await deleteDoc(doc(db, "users", uid, "water", id));
    } catch (e) {
      console.error("Failed to delete water log from Firestore", e);
    }
  },

  // WEIGHT LOGS
  async getWeight(): Promise<WeightLog[]> {
    const uid = getActiveUserId();
    const localKey = `weight_${uid}`;

    const getLocalWeight = (): WeightLog[] => {
      const cached = localStorage.getItem(localKey);
      return cached ? JSON.parse(cached) : [];
    };

    if (!useFirebase) {
      const weight = getLocalWeight();
      return weight.sort((a, b) => b.timestamp - a.timestamp);
    }
    try {
      const q = query(collection(db, "users", uid, "weight"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const weight: WeightLog[] = [];
      snap.forEach((d) => {
        weight.push({ id: d.id, ...d.data() } as WeightLog);
      });
      localStorage.setItem(localKey, JSON.stringify(weight));
      return weight;
    } catch (e) {
      console.warn("Firestore error, reading weight locally:", e);
      const weight = getLocalWeight();
      return weight.sort((a, b) => b.timestamp - a.timestamp);
    }
  },

  async saveWeight(weight: WeightLog): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `weight_${uid}`;

    const cached = localStorage.getItem(localKey);
    const weights: WeightLog[] = cached ? JSON.parse(cached) : [];
    const index = weights.findIndex((w) => w.id === weight.id);
    if (index >= 0) {
      weights[index] = weight;
    } else {
      weights.unshift(weight);
    }
    localStorage.setItem(localKey, JSON.stringify(weights));

    if (!useFirebase) return;
    try {
      await setDoc(doc(db, "users", uid, "weight", weight.id), sanitizeForFirestore(weight));
    } catch (e) {
      console.error("Failed to save weight log to Firestore", e);
    }
  },

  async deleteWeight(id: string): Promise<void> {
    const uid = getActiveUserId();
    const localKey = `weight_${uid}`;

    const cached = localStorage.getItem(localKey);
    if (cached) {
      const weights: WeightLog[] = JSON.parse(cached);
      const filtered = weights.filter((w) => w.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
    if (!useFirebase) return;
    try {
      await deleteDoc(doc(db, "users", uid, "weight", id));
    } catch (e) {
      console.error("Failed to delete weight log from Firestore", e);
    }
  }
};

// Helper to migrate and sync all offline/simulated user's localStorage logs to Firebase Firestore
export async function syncLocalStorageToFirebase(fromUid: string, toUid: string): Promise<void> {
  if (!useFirebase || !db) return;
  console.log(`Syncing local storage from ${fromUid} to Firebase ${toUid}`);

  try {
    // 1. Profile
    const profileKey = `profile_${fromUid}`;
    const localProfile = localStorage.getItem(profileKey);
    if (localProfile) {
      try {
        const profile = JSON.parse(localProfile);
        localStorage.setItem(`profile_${toUid}`, localProfile);
        await setDoc(doc(db, "users", toUid, "profile", "main_profile"), sanitizeForFirestore(profile));
      } catch (err) {
        console.error("Error syncing profile to Firestore:", err);
      }
    }

    // 2. Goals
    const goalsKey = `goals_${fromUid}`;
    const localGoals = localStorage.getItem(goalsKey);
    if (localGoals) {
      try {
        const goals = JSON.parse(localGoals);
        localStorage.setItem(`goals_${toUid}`, localGoals);
        await setDoc(doc(db, "users", toUid, "goals", "main_goals"), sanitizeForFirestore(goals));
      } catch (err) {
        console.error("Error syncing goals to Firestore:", err);
      }
    }

    // 3. Meals
    const mealsKey = `meals_${fromUid}`;
    const localMeals = localStorage.getItem(mealsKey);
    if (localMeals) {
      try {
        const meals: MealLog[] = JSON.parse(localMeals);
        localStorage.setItem(`meals_${toUid}`, localMeals);
        for (const meal of meals) {
          await setDoc(doc(db, "users", toUid, "meals", meal.id), sanitizeForFirestore(meal));
        }
      } catch (err) {
        console.error("Error syncing meals to Firestore:", err);
      }
    }

    // 4. Workouts
    const workoutsKey = `workouts_${fromUid}`;
    const localWorkouts = localStorage.getItem(workoutsKey);
    if (localWorkouts) {
      try {
        const workouts: WorkoutLog[] = JSON.parse(localWorkouts);
        localStorage.setItem(`workouts_${toUid}`, localWorkouts);
        for (const workout of workouts) {
          await setDoc(doc(db, "users", toUid, "workouts", workout.id), sanitizeForFirestore(workout));
        }
      } catch (err) {
        console.error("Error syncing workouts to Firestore:", err);
      }
    }

    // 5. Water
    const waterKey = `water_${fromUid}`;
    const localWater = localStorage.getItem(waterKey);
    if (localWater) {
      try {
        const water: WaterLog[] = JSON.parse(localWater);
        localStorage.setItem(`water_${toUid}`, localWater);
        for (const log of water) {
          await setDoc(doc(db, "users", toUid, "water", log.id), sanitizeForFirestore(log));
        }
      } catch (err) {
        console.error("Error syncing water logs to Firestore:", err);
      }
    }

    // 6. Weight
    const weightKey = `weight_${fromUid}`;
    const localWeight = localStorage.getItem(weightKey);
    if (localWeight) {
      try {
        const weight: WeightLog[] = JSON.parse(localWeight);
        localStorage.setItem(`weight_${toUid}`, localWeight);
        for (const log of weight) {
          await setDoc(doc(db, "users", toUid, "weight", log.id), sanitizeForFirestore(log));
        }
      } catch (err) {
        console.error("Error syncing weight logs to Firestore:", err);
      }
    }

    console.log("Local storage sync to Firebase completed successfully.");
  } catch (error) {
    console.error("Error syncing local storage to Firebase:", error);
  }
}

// USER AUTHENTICATION CORE SERVICE
export const authService = {
  // Subscribe to Auth status changes
  onAuthChanged(listener: (user: SimulatedUser | FirebaseUser | null) => void) {
    authListeners.push(listener);
    // Call instantly with current active
    listener(activeUser);
    return () => {
      const index = authListeners.indexOf(listener);
      if (index >= 0) authListeners.splice(index, 1);
    };
  },

  getCurrentUser() {
    return activeUser;
  },

  isFirebaseMode() {
    return useFirebase && !!auth;
  },

  // Login Email/Password
  async login(email: string, pass: string): Promise<SimulatedUser | FirebaseUser> {
    if (useFirebase && auth) {
      try {
        const credentials = await signInWithEmailAndPassword(auth, email, pass);
        const previousUid = getActiveUserId();
        await syncLocalStorageToFirebase(previousUid, credentials.user.uid);
        triggerAuthChange(credentials.user);
        return credentials.user;
      } catch (fbError: any) {
        console.warn("Firebase signin failed:", fbError.message);
        if (email === "demo@nutriscan.com" || email === "sandbox@nutriscan.com") {
          return this.simulatedLoginRegister(email, pass, "login");
        }
        let userMessage = fbError.message;
        if (fbError.code === "auth/wrong-password" || fbError.code === "auth/user-not-found" || fbError.code === "auth/invalid-credential") {
          userMessage = "Incorrect email or password. Please try again.";
        } else if (fbError.code === "auth/operation-not-allowed") {
          userMessage = "Email/Password sign-in is disabled in your Firebase Console. Please go to your Firebase Console > Authentication > Sign-in method, and enable 'Email/Password' to log in.";
        }
        throw new Error(userMessage);
      }
    } else {
      return this.simulatedLoginRegister(email, pass, "login");
    }
  },

  // Signup Email/Password + Phone
  async register(
    email: string, 
    pass: string, 
    name: string, 
    phoneCountryCode: string, 
    phoneNumber: string,
    nationality?: string
  ): Promise<SimulatedUser | FirebaseUser> {
    if (useFirebase && auth) {
      try {
        const credentials = await createUserWithEmailAndPassword(auth, email, pass);
        const fbUser = credentials.user;
        const previousUid = getActiveUserId();
        
        // Save extra profile details immediately to Firestore
        const newProfile: UserProfile = {
          name: name || fbUser.displayName || "Fitness Enthusiast",
          currentWeightKg: 75,
          targetWeightKg: 70,
          heightCm: 175,
          age: 28,
          gender: "Male",
          activityLevel: "Moderately Active",
          nationality: nationality || "Global",
          phoneCountryCode,
          phoneNumber,
          customAppName: "NutriScan AI",
          hydrationReminderMinutes: 120,
          measurementSystem: "metric",
          dietFormula: "mifflin",
          soundEffectsEnabled: true
        };
        await setDoc(doc(db, "users", fbUser.uid, "profile", "main_profile"), sanitizeForFirestore(newProfile));
        
        // Sync any other cached data (meals, workouts, etc.) from local storage to Firebase
        await syncLocalStorageToFirebase(previousUid, fbUser.uid);
        
        triggerAuthChange(fbUser);
        return fbUser;
      } catch (fbError: any) {
        console.warn("Firebase registration failed:", fbError.message);
        if (email === "demo@nutriscan.com" || email === "sandbox@nutriscan.com") {
          return this.simulatedLoginRegister(email, pass, "register", name, phoneCountryCode, phoneNumber, nationality);
        }
        let userMessage = fbError.message;
        if (fbError.code === "auth/operation-not-allowed") {
          userMessage = "Firebase registration failed: The Email/Password sign-in provider is disabled in your Firebase console. Please go to your Firebase Console > Authentication > Sign-in method, and enable 'Email/Password' to register real accounts.";
        } else if (fbError.code === "auth/email-already-in-use") {
          userMessage = "This email is already registered in Firebase. Please sign in instead!";
        } else if (fbError.code === "auth/weak-password") {
          userMessage = "Password is too weak. It must be at least 6 characters long.";
        } else if (fbError.code === "auth/invalid-email") {
          userMessage = "The email address is invalid.";
        }
        throw new Error(userMessage);
      }
    } else {
      return this.simulatedLoginRegister(email, pass, "register", name, phoneCountryCode, phoneNumber);
    }
  },

  // Google Single Sign-On Auth
  async loginWithGoogle(): Promise<SimulatedUser | FirebaseUser> {
    if (useFirebase && auth) {
      try {
        const provider = new GoogleAuthProvider();
        const credentials = await signInWithPopup(auth, provider);
        const previousUid = getActiveUserId();
        await syncLocalStorageToFirebase(previousUid, credentials.user.uid);
        triggerAuthChange(credentials.user);
        return credentials.user;
      } catch (fbError: any) {
        console.warn("Firebase Google popup error, falling back to simulated Google sign-on:", fbError);
        return this.simulatedGoogleLogin();
      }
    } else {
      return this.simulatedGoogleLogin();
    }
  },

  // Sign out
  async logout(): Promise<void> {
    localStorage.removeItem("simulated_active_user");
    if (useFirebase && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Firebase signout error:", e);
      }
    }
    triggerAuthChange(null);
  },

  // Simulated Auth Engine to ensure app is robustly interactive and never crashes
  simulatedLoginRegister(
    email: string, 
    pass: string, 
    action: "login" | "register", 
    name?: string,
    phoneCountryCode?: string,
    phoneNumber?: string,
    nationality?: string
  ): SimulatedUser {
    const storeKey = "simulated_users_database";
    const usersRaw = localStorage.getItem(storeKey);
    const usersList: Array<any> = usersRaw ? JSON.parse(usersRaw) : [];

    const normalizedEmail = email.toLowerCase().trim();

    if (action === "login") {
      const match = usersList.find(u => u.email === normalizedEmail && u.password === pass);
      if (!match) {
        throw new Error("Invalid email or password. Feel free to Register a new account if you haven't yet!");
      }
      const simUser: SimulatedUser = {
        uid: match.uid,
        email: match.email,
        displayName: match.displayName,
        phoneNumber: match.phoneNumber,
        phoneCountryCode: match.phoneCountryCode,
        isSimulated: true
      };
      localStorage.setItem("simulated_active_user", JSON.stringify(simUser));
      triggerAuthChange(simUser);
      return simUser;
    } else {
      // Register
      const exists = usersList.some(u => u.email === normalizedEmail);
      if (exists) {
        throw new Error("This email is already registered. Please sign in instead!");
      }
      
      const newUid = "sim_" + Math.random().toString(36).substr(2, 9);
      const newSimAccount = {
        uid: newUid,
        email: normalizedEmail,
        password: pass,
        displayName: name || "Fitness Enthusiast",
        phoneCountryCode: phoneCountryCode || "+1",
        phoneNumber: phoneNumber || "",
        nationality: nationality || "Global"
      };
      
      usersList.push(newSimAccount);
      localStorage.setItem(storeKey, JSON.stringify(usersList));

      // Seed default profile scoped to simulated user ID
      const newProfile: UserProfile = {
        name: name || "Fitness Enthusiast",
        currentWeightKg: 75,
        targetWeightKg: 70,
        heightCm: 175,
        age: 28,
        gender: "Male",
        activityLevel: "Moderately Active",
        nationality: nationality || "Global",
        phoneCountryCode: phoneCountryCode || "+1",
        phoneNumber: phoneNumber || "",
        customAppName: "Core",
        hydrationReminderMinutes: 120,
        measurementSystem: "metric",
        dietFormula: "mifflin",
        soundEffectsEnabled: true
      };
      localStorage.setItem(`profile_${newUid}`, JSON.stringify(newProfile));

      const simUser: SimulatedUser = {
        uid: newUid,
        email: normalizedEmail,
        displayName: newSimAccount.displayName,
        phoneNumber: newSimAccount.phoneNumber,
        phoneCountryCode: newSimAccount.phoneCountryCode,
        isSimulated: true
      };
      localStorage.setItem("simulated_active_user", JSON.stringify(simUser));
      triggerAuthChange(simUser);
      return simUser;
    }
  },

  simulatedGoogleLogin(): SimulatedUser {
    // Standard quick Google SSO simulator
    const simUser: SimulatedUser = {
      uid: "sim_google_" + Math.random().toString(36).substr(2, 9),
      email: "google.user@gmail.com",
      displayName: "Google User",
      phoneNumber: "",
      phoneCountryCode: "+1",
      isSimulated: true
    };
    localStorage.setItem("simulated_active_user", JSON.stringify(simUser));
    triggerAuthChange(simUser);
    return simUser;
  }
};

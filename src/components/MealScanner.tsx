import React, { useState, useRef, useEffect } from "react";
import { MealScanResult, MealLog, FoodItem } from "../types";
import { dbService } from "../firebase";
import CustomSelect from "./CustomSelect";
import { 
  Camera, Upload, Search, RefreshCw, Plus, Minus, Check, AlertCircle, 
  Sparkles, Flame, Eye, Edit2, CheckCircle2, ChevronRight, X, Layers
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

// Client-side real-time image compression to stay safely under Firestore's 1MB limit
const compressImage = (base64Str: string, maxDim = 500): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 0.5 quality for maximum space efficiency
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

interface MealScannerProps {
  onMealLogged: () => void;
  activeDate: string;
}

export default function MealScanner({ onMealLogged, activeDate }: MealScannerProps) {
  // Navigation tabs inside scanning tab
  const [inputMode, setInputMode] = useState<"upload" | "camera" | "text">("upload");
  
  // App States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<MealScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Text Input State
  const [mealDescription, setMealDescription] = useState("");

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [isMirrored, setIsMirrored] = useState(false);

  // Edit States for the identified scanned items
  const [editedItems, setEditedItems] = useState<FoodItem[]>([]);
  const [editedFoodName, setEditedFoodName] = useState("");
  const [isEditingList, setIsEditingList] = useState(false);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  // Handle Input Mode Switches
  const handleModeChange = (mode: "upload" | "camera" | "text") => {
    setInputMode(mode);
    setError(null);
    setSuccessMsg(null);
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Camera Management
  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Enumerate cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !activeCameraId) {
        setActiveCameraId(videoDevices[0].deviceId);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check your permissions or upload an image file instead.");
      setInputMode("upload");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const switchCamera = (deviceId: string) => {
    setActiveCameraId(deviceId);
    startCamera(deviceId);
  };

  // Capture Photo from Camera Stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      
      // Target resolution max 500px for efficient cloud saving
      const maxDim = 500;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // If preview is mirrored, we must mirror the canvas drawing as well
        if (isMirrored) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        // Draw the image onto the downscaled canvas
        ctx.drawImage(video, 0, 0, width, height);
        // Compress as JPEG with 0.5 quality (extremely small, fits beautifully under Firestore size limits)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setSelectedImage(dataUrl);
        stopCamera();
        // Automatically scan the captured photo!
        triggerImageScan(dataUrl);
      }
    } catch (err) {
      setError("Failed to capture snapshot from camera stream.");
    }
  };

  // Handle file select/drag-and-drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const originalDataUrl = event.target?.result as string;
      try {
        const compressedDataUrl = await compressImage(originalDataUrl);
        setSelectedImage(compressedDataUrl);
        setError(null);
        triggerImageScan(compressedDataUrl);
      } catch (err) {
        setSelectedImage(originalDataUrl);
        setError(null);
        triggerImageScan(originalDataUrl);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    } else {
      setError("Please drop a valid image file.");
    }
  };

  // API Call: Scan meal from Image base64
  const triggerImageScan = async (base64Image: string) => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/scan-meal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType: "image/jpeg" })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "The image analysis service is offline or returned an error.");
      }

      const scanResult: MealScanResult = resData.data;
      setScanResult(scanResult);
      setEditedFoodName(scanResult.foodName);
      setEditedItems(scanResult.items);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze food picture. Please check if server is configured properly.");
    } finally {
      setIsScanning(false);
    }
  };

  // API Call: Analyze text meal
  const triggerTextAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealDescription.trim()) return;
    setIsScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/analyze-text-meal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealText: mealDescription })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to analyze meal text.");
      }

      const scanResult: MealScanResult = resData.data;
      setScanResult(scanResult);
      setEditedFoodName(scanResult.foodName);
      setEditedItems(scanResult.items);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to estimate nutrition for this meal description.");
    } finally {
      setIsScanning(false);
    }
  };

  // Manual modifications of identified food items
  const updateItemProperty = (index: number, key: keyof FoodItem, value: any) => {
    const updated = [...editedItems];
    updated[index] = { ...updated[index], [key]: value };
    setEditedItems(updated);
  };

  const deleteItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const addNewItem = () => {
    const newItem: FoodItem = {
      name: "Custom item",
      weightGrams: 100,
      calories: 120,
      protein: 8,
      carbs: 15,
      fat: 4
    };
    setEditedItems([...editedItems, newItem]);
  };

  // Calculate totals of modified items
  const getModifiedTotals = () => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let weight = 0;

    editedItems.forEach(item => {
      calories += Number(item.calories) || 0;
      protein += Number(item.protein) || 0;
      carbs += Number(item.carbs) || 0;
      fat += Number(item.fat) || 0;
      weight += Number(item.weightGrams) || 0;
    });

    return { calories, protein, carbs, fat, weight };
  };

  // Insert scanned meal into cloud database
  const saveScannedMealToLog = async () => {
    if (!scanResult) return;
    try {
      const totals = getModifiedTotals();
      const mealLog: MealLog = {
        id: "meal_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        date: activeDate,
        timestamp: Date.now(),
        foodName: editedFoodName || scanResult.foodName,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        weightGrams: totals.weight,
        items: editedItems,
        imageUrl: selectedImage || undefined,
        source: "scan"
      };

      await dbService.saveMeal(mealLog);
      setSuccessMsg("Success! Meal has been logged to your fitness diary.");
      setScanResult(null);
      setSelectedImage(null);
      setMealDescription("");
      onMealLogged();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError("Failed to save meal log. Please try again.");
    }
  };

  const startNewScan = () => {
    setScanResult(null);
    setSelectedImage(null);
    setMealDescription("");
    setError(null);
    setSuccessMsg(null);
    if (inputMode === "camera") {
      startCamera();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" id="meal-scanner-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          AI Meal Scanner — NutriScan AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Take a photo, upload an image of your plate, or type a meal. Our advanced machine learning models automatically estimate the ingredients, weight, calories, and macronutrients.
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Scanner Section */}
      {!scanResult && !isScanning && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
          {/* Internal Input Mode Selectors */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-50 border-b border-slate-100">
            <button
              onClick={() => handleModeChange("upload")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                inputMode === "upload"
                  ? "bg-white text-indigo-600 shadow-3xs border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
              id="mode-upload"
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span>Upload Photo</span>
            </button>
            <button
              onClick={() => handleModeChange("camera")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                inputMode === "camera"
                  ? "bg-white text-indigo-600 shadow-3xs border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
              id="mode-camera"
            >
              <Camera className="w-4 h-4 flex-shrink-0" />
              <span>Take Photo</span>
            </button>
            <button
              onClick={() => handleModeChange("text")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                inputMode === "text"
                  ? "bg-white text-indigo-600 shadow-3xs border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
              id="mode-text"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span>Describe Meal</span>
            </button>
          </div>

          <div className="p-8">
            {/* UPLOAD MODE */}
            {inputMode === "upload" && (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all bg-gray-50/50 hover:bg-indigo-50/10 group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Drag & drop your meal photo</h3>
                <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, WEBP (up to 15MB)</p>
                <button className="mt-4 px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 shadow-2xs">
                  Choose File
                </button>
              </div>
            )}

            {/* CAMERA MODE */}
            {inputMode === "camera" && (
              <div className="flex flex-col items-center">
                {/* Cameras Select */}
                {cameras.length > 1 && (
                  <div className="mb-4 w-full max-w-sm">
                    <label className="block text-[10px] font-bold text-indigo-950 uppercase tracking-wider mb-1 px-1">Select Active Lens</label>
                    <CustomSelect
                      value={activeCameraId}
                      onChange={(value) => switchCamera(value)}
                      options={cameras.map((cam, idx) => ({
                        value: cam.deviceId,
                        label: cam.label || `Camera ${idx + 1}`
                      }))}
                    />
                  </div>
                )}

                {/* Video Stage */}
                <div className="relative w-full max-w-lg aspect-4/3 bg-black rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover transition-all duration-300 ${isMirrored ? "scale-x-[-1]" : ""}`}
                  />
                  
                  {/* Mirror toggle button */}
                  <button
                    onClick={() => setIsMirrored(!isMirrored)}
                    type="button"
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/85 backdrop-blur-xs text-white rounded-full px-3 py-1.5 text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 select-none hover:scale-105 active:scale-95"
                    title="Mirror or Unmirror Camera Preview"
                  >
                    <RefreshCw className="w-3 h-3 animate-spin-slow" />
                    <span>{isMirrored ? "Unmirror" : "Mirror"}</span>
                  </button>

                  {/* Camera overlay targets */}
                  <div className="absolute inset-0 border-2 border-indigo-500/20 m-6 rounded-lg pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border border-dashed border-indigo-400/50 rounded-full"></div>
                  </div>

                  {/* Shutter button inside stage */}
                  <div className="absolute bottom-4 inset-x-0 flex justify-center">
                    <button 
                      onClick={capturePhoto}
                      className="w-14 h-14 bg-white hover:bg-gray-100 rounded-full border-4 border-indigo-100 shadow-md flex items-center justify-center transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                      id="btn-shutter"
                      title="Capture Food"
                    >
                      <span className="w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-3 text-center">
                  Position your plate/dish clearly in the circle center and snap.
                </p>
              </div>
            )}

            {/* TEXT MODE */}
            {inputMode === "text" && (
              <form onSubmit={triggerTextAnalyze} className="space-y-4 max-w-lg mx-auto">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">What did you eat?</label>
                  <textarea
                    value={mealDescription}
                    onChange={(e) => setMealDescription(e.target.value)}
                    placeholder="e.g. 2 fried eggs, 2 strips of bacon, 1 slice of whole wheat buttered toast, and a glass of fresh orange juice"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-24"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!mealDescription.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  id="btn-analyze-text"
                >
                  <Search className="w-4 h-4" />
                  Estimate Nutrition Instantly
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SCANNING LOADING STATE */}
      {isScanning && (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-xs flex flex-col items-center justify-center min-h-96">
          <div className="relative w-48 h-48 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center">
            {selectedImage ? (
              <img src={selectedImage} alt="Food scanning preview" className="w-full h-full object-cover opacity-80" />
            ) : (
              <Search className="w-12 h-12 text-gray-300 animate-pulse" />
            )}
            
            {/* LASER LINE ANIMATION EFFECT */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_10px_#6366f1] animate-bounce-slow"></div>
          </div>
          
          <div className="mt-6 text-center">
            <h3 className="text-base font-semibold text-gray-800 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
              AI Analyzing Food...
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Gemini is estimating volume, recognizing dishes, and matching with nutritional databases...
            </p>
          </div>
        </div>
      )}

      {/* SCAN RESULTS DETAILS BOX */}
      {scanResult && !isScanning && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Visual preview card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs flex flex-col items-center">
              <div className="w-full aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 mb-4">
                {selectedImage ? (
                  <img src={selectedImage} alt="Scanned meal" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-indigo-500 bg-indigo-50/30">
                    <Sparkles className="w-10 h-10 animate-pulse" />
                    <span className="text-[10px] font-bold mt-2">GENERATED ESTIMATE</span>
                  </div>
                )}
              </div>
              <div className="w-full text-center">
                <span className="inline-block text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full mb-1">
                  Confidence: {Math.round(scanResult.confidence * 100)}%
                </span>
                <h3 className="text-base font-bold text-gray-800">
                  {editedFoodName}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Estimated weight: {getModifiedTotals().weight}g</p>
              </div>
            </div>

            {/* Nutrition metrics card */}
            <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Nutritional Estimations</h2>
                
                {/* Total calories banner */}
                <div className="bg-indigo-600/5 border border-indigo-100/50 rounded-xl p-4 flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                      <Flame className="w-5 h-5 fill-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Estimated Energy</h4>
                      <p className="text-lg font-black text-indigo-900">{getModifiedTotals().calories} kcal</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-bold bg-white border border-indigo-100 px-3 py-1 rounded-full shadow-3xs flex-shrink-0">
                    NutriScan AI
                  </span>
                </div>

                {/* Macrometers progress list */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Protein */}
                  <div className="bg-emerald-50/50 rounded-lg p-3 text-center border border-emerald-100/40">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Protein</span>
                    <p className="text-base font-extrabold text-emerald-900 mt-1">{getModifiedTotals().protein}g</p>
                    <p className="text-[9px] text-emerald-500 mt-0.5">{getModifiedTotals().protein * 4} kcal</p>
                  </div>

                  {/* Carbs */}
                  <div className="bg-amber-50/50 rounded-lg p-3 text-center border border-amber-100/40">
                    <span className="text-[10px] font-bold text-amber-600 uppercase">Carbs</span>
                    <p className="text-base font-extrabold text-amber-900 mt-1">{getModifiedTotals().carbs}g</p>
                    <p className="text-[9px] text-amber-500 mt-0.5">{getModifiedTotals().carbs * 4} kcal</p>
                  </div>

                  {/* Fats */}
                  <div className="bg-rose-50/50 rounded-lg p-3 text-center border border-rose-100/40">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Fats</span>
                    <p className="text-base font-extrabold text-rose-900 mt-1">{getModifiedTotals().fat}g</p>
                    <p className="text-[9px] text-rose-500 mt-0.5">{getModifiedTotals().fat * 9} kcal</p>
                  </div>
                </div>
              </div>

              {/* Description summary */}
              <div className="mt-6 pt-4 border-t border-gray-50 text-xs text-gray-500 leading-relaxed italic bg-gray-50/50 rounded-lg p-3">
                <strong>ML Insights:</strong> {scanResult.description}
              </div>
            </div>
          </div>

          {/* ITEM DETECTED LIST (EDITABLE) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                Identified Ingredients ({editedItems.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsEditingList(!isEditingList)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isEditingList 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs" 
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  id="btn-edit-scanned-items"
                >
                  {isEditingList ? (
                    <>
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Done Editing</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Adjust Grams / Items</span>
                    </>
                  )}
                </button>
                <button
                  onClick={addNewItem}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-100/40"
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Add Ingredient</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {editedItems.map((item, idx) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-3.5 bg-slate-50/50 rounded-xl border border-slate-100 gap-3">
                  <div className="flex-1 min-w-0">
                    {isEditingList ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemProperty(idx, "name", e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-xs"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-800 break-words">{item.name}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    {/* Weight (grams) */}
                    <div className="flex items-center gap-1 bg-white border border-slate-150 rounded-lg px-2.5 py-1 flex-shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">Weight:</span>
                      {isEditingList ? (
                        <input
                          type="number"
                          value={item.weightGrams || ""}
                          onChange={(e) => updateItemProperty(idx, "weightGrams", e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
                          className="w-12 text-center font-bold text-slate-800 focus:outline-none bg-slate-50 rounded px-1 text-xs"
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{item.weightGrams}g</span>
                      )}
                    </div>

                    {/* Calories */}
                    <div className="flex items-center gap-1 bg-indigo-50/40 border border-indigo-100/30 rounded-lg px-2.5 py-1 flex-shrink-0">
                      <span className="text-[10px] text-indigo-400 font-bold">Cals:</span>
                      {isEditingList ? (
                        <input
                          type="number"
                          value={item.calories || ""}
                          onChange={(e) => updateItemProperty(idx, "calories", e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
                          className="w-12 text-center font-bold text-indigo-800 focus:outline-none bg-indigo-50/30 rounded px-1 text-xs"
                        />
                      ) : (
                        <span className="font-bold text-indigo-700">{item.calories}kcal</span>
                      )}
                    </div>

                    {/* Micros splits mini layout */}
                    <div className="flex items-center gap-2 font-medium text-[10px] text-slate-500 bg-white border border-slate-100 rounded-lg px-2.5 py-1 flex-shrink-0">
                      <span className="flex items-center gap-0.5">
                        <span className="text-slate-400">P:</span>
                        {isEditingList ? (
                          <input
                            type="number"
                            value={item.protein || ""}
                            onChange={(e) => updateItemProperty(idx, "protein", e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
                            className="w-8 border border-slate-200 rounded text-center text-emerald-800 font-bold focus:outline-none bg-slate-50"
                          />
                        ) : (
                          <strong className="text-emerald-600">{item.protein}g</strong>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <span className="text-slate-400">C:</span>
                        {isEditingList ? (
                          <input
                            type="number"
                            value={item.carbs || ""}
                            onChange={(e) => updateItemProperty(idx, "carbs", e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
                            className="w-8 border border-slate-200 rounded text-center text-amber-800 font-bold focus:outline-none bg-slate-50"
                          />
                        ) : (
                          <strong className="text-amber-600">{item.carbs}g</strong>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <span className="text-slate-400">F:</span>
                        {isEditingList ? (
                          <input
                            type="number"
                            value={item.fat || ""}
                            onChange={(e) => updateItemProperty(idx, "fat", e.target.value === "" ? 0 : (parseInt(e.target.value) || 0))}
                            className="w-8 border border-slate-200 rounded text-center text-rose-800 font-bold focus:outline-none bg-slate-50"
                          />
                        ) : (
                          <strong className="text-rose-600">{item.fat}g</strong>
                        )}
                      </span>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      onClick={() => deleteItem(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                      title="Delete ingredient"
                    >
                      <X className="w-4 h-4 flex-shrink-0" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={startNewScan}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              id="btn-scan-again"
            >
              Discard & Scan New
            </button>
            <button
              onClick={saveScannedMealToLog}
              className="flex-1 sm:flex-[1.5] bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-100/50 cursor-pointer"
              id="btn-log-meal-results"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Log Meal to Fitness Diary</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Set up body parsers with limits for handling base64 image uploads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Initialize Google Gen AI client lazy-style to prevent immediate crash if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in your Secrets panel.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API endpoint to scan meal image using Gemini 2.5 Flash multimodal capabilities
app.post("/api/scan-meal", async (req, res) => {
  try {
    const { image, mimeType = "image/jpeg" } = req.body;
    if (!image) {
       res.status(400).json({ error: "Missing image data in request body" });
       return;
    }

    // Extract the raw base64 data (strip off prefix like 'data:image/jpeg;base64,' if present)
    let base64Data = image;
    if (image.includes(";base64,")) {
      base64Data = image.split(";base64,")[1];
    }

    const ai = getAiClient();
    
    const prompt = `Analyze this food or meal image in detail.
Estimate the name of the dish, weight in grams, total calories, and macronutrient content (protein, carbs, fat).
Perform an advanced volumetric and food recognition estimate similar to SnapCalorie or Cal AI.
List individual ingredient items identified with their respective weight and nutrition.
Be as accurate as possible, factoring in ingredients, oils, condiments, and beverage items.

Return a structured JSON object according to the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            foodName: { type: "STRING" },
            confidence: { type: "NUMBER" },
            totalCalories: { type: "INTEGER" },
            totalProtein: { type: "INTEGER" },
            totalCarbs: { type: "INTEGER" },
            totalFats: { type: "INTEGER" },
            weightGrams: { type: "INTEGER" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  weightGrams: { type: "INTEGER" },
                  calories: { type: "INTEGER" },
                  protein: { type: "INTEGER" },
                  carbs: { type: "INTEGER" },
                  fat: { type: "INTEGER" }
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
              }
            },
            description: { type: "STRING" }
          },
          required: ["foodName", "confidence", "totalCalories", "totalProtein", "totalCarbs", "totalFats", "weightGrams", "items", "description"]
        }
      }
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("No output text received from Gemini API");
    }

    const parsedData = JSON.parse(textResult);
    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Meal scan error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze image" });
  }
});

// API endpoint to analyze text-based meal entries (manual search helper with ML nutrition estimate)
app.post("/api/analyze-text-meal", async (req, res) => {
  try {
    const { mealText } = req.body;
    if (!mealText) {
       res.status(400).json({ error: "Missing mealText in request body" });
       return;
    }

    const ai = getAiClient();

    const prompt = `You are a professional nutritionist machine learning engine.
The user described their meal as: "${mealText}".
Provide a realistic estimate of the food name, weight in grams, total calories, and macronutrient content (protein, carbs, fat).
Identify individual sub-items or ingredients described in the query, estimate their details, and provide an overall description.
If portion sizes aren't specified, estimate sensible average restaurant or homemade serving sizes.

Return a structured JSON object according to the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            foodName: { type: "STRING" },
            confidence: { type: "NUMBER" },
            totalCalories: { type: "INTEGER" },
            totalProtein: { type: "INTEGER" },
            totalCarbs: { type: "INTEGER" },
            totalFats: { type: "INTEGER" },
            weightGrams: { type: "INTEGER" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  weightGrams: { type: "INTEGER" },
                  calories: { type: "INTEGER" },
                  protein: { type: "INTEGER" },
                  carbs: { type: "INTEGER" },
                  fat: { type: "INTEGER" }
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
              }
            },
            description: { type: "STRING" }
          },
          required: ["foodName", "confidence", "totalCalories", "totalProtein", "totalCarbs", "totalFats", "weightGrams", "items", "description"]
        }
      }
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("No output text received from Gemini API");
    }

    const parsedData = JSON.parse(textResult);
    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Text meal analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze meal description" });
  }
});

// API endpoint to generate personalized national dietary suggestions and health advice
app.post("/api/get-ai-tips", async (req, res) => {
  try {
    const { 
      age, heightCm, currentWeightKg, targetWeightKg, gender, activityLevel, nationality = "Global",
      favoriteFoods = "", favoriteDrinks = "", dislikedFoods = "", dietaryRestrictions = ""
    } = req.body;

    if (!age || !heightCm || !currentWeightKg) {
      res.status(400).json({ error: "Missing biometric data (age, height, weight) in request body" });
      return;
    }

    const ai = getAiClient();

    const prompt = `You are an elite sports scientist and medical nutritionist. 
Generate a custom, scientifically backed health and nutrition roadmap for the user based on their statistics:
- Age: ${age} years old
- Height: ${heightCm} cm
- Current Weight: ${currentWeightKg} kg
- Target Weight: ${targetWeightKg || "Not Specified"} kg
- Biological Gender: ${gender || "Not Specified"}
- Activity Level: ${activityLevel || "Moderately Active"}
- Nationality / Country: ${nationality}
- Favorite Foods: ${favoriteFoods || "None Specified"}
- Favorite Drinks: ${favoriteDrinks || "None Specified"}
- Disliked / Avoided Foods: ${dislikedFoods || "None Specified"}
- Dietary Style / Restrictions: ${dietaryRestrictions || "None Specified"}

Please focus on:
1. Identifying if their BMI is in the Underweight, Normal, Overweight, or Obese categories. Note standard numbers for their height.
2. Formulating dietary and meal suggestions specifically customized to their nationality: ${nationality}. 
   Every country has a different traditional cuisine. Identify traditional high-calorie/high-carb/high-sodium dishes from ${nationality} that they should reduce or modify, and healthy traditional/local options or ingredients they should increase. Provide highly localized, practical food swaps.
3. Suggesting general lifestyle reductions and additions, keeping in mind their personal favorites, disliked foods, and dietary restrictions to build highly customized nutrition strategies.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            bmi: { type: "NUMBER" },
            bmiCategory: { type: "STRING" },
            bmiStatusExplanation: { type: "STRING" },
            standardBmiRange: { type: "STRING" },
            standardWeightRangeKg: { type: "STRING" },
            recommendedCalories: { type: "INTEGER" },
            macroRatioTips: {
              type: "OBJECT",
              properties: {
                protein: { type: "STRING" },
                carbs: { type: "STRING" },
                fat: { type: "STRING" }
              },
              required: ["protein", "carbs", "fat"]
            },
            nationalityDietContext: {
              type: "OBJECT",
              properties: {
                country: { type: "STRING" },
                traditionalFoodsToReduce: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                traditionalFoodsToIncrease: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                localizedHealthyAlternatives: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                generalAdvice: { type: "STRING" }
              },
              required: ["country", "traditionalFoodsToReduce", "traditionalFoodsToIncrease", "localizedHealthyAlternatives", "generalAdvice"]
            },
            lifestyleTips: {
              type: "OBJECT",
              properties: {
                reduce: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                increase: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                habits: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["reduce", "increase", "habits"]
            }
          },
          required: ["bmi", "bmiCategory", "bmiStatusExplanation", "standardBmiRange", "standardWeightRangeKg", "recommendedCalories", "macroRatioTips", "nationalityDietContext", "lifestyleTips"]
        }
      }
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("No output text received from Gemini API");
    }

    const parsedData = JSON.parse(textResult);
    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("AI tips generator error:", error);
    res.status(500).json({ error: error.message || "Failed to generate health advice" });
  }
});

// API endpoint to chat conversationally with AI Coach / NutriCoach
app.post("/api/ask-coach", async (req, res) => {
  try {
    const { question, history = [], profile = {} } = req.body;
    if (!question) {
      res.status(400).json({ error: "Missing question in request body" });
      return;
    }

    const ai = getAiClient();

    // Context instructions
    const systemPrompt = `You are "AI Coach" (also known as NutriCoach), an elite sports scientist, medical nutritionist, and personal fitness mentor.
The user is asking you a question. Here is their profile context if available:
- Name: ${profile.name || "User"}
- Nationality / Country Cuisine: ${profile.nationality || "Malaysia"}
- Age: ${profile.age || "28"} years old
- Height: ${profile.heightCm || "175"} cm
- Current Weight: ${profile.currentWeightKg || "75"} kg
- Target Weight: ${profile.targetWeightKg || "70"} kg
- Activity level: ${profile.activityLevel || "Moderately Active"}
- Favorite Foods: ${profile.favoriteFoods || "None specified"}
- Favorite Drinks: ${profile.favoriteDrinks || "None specified"}
- Disliked / Avoided Foods: ${profile.dislikedFoods || "None specified"}
- Dietary Style / Restrictions: ${profile.dietaryRestrictions || "None specified"}

Instructions:
1. Provide helpful, precise, scientifically-backed, and practical health, nutrition, or workout advice.
2. Be friendly, encouraging, clear, and highly personalized, prioritizing their taste preferences (favorite foods/drinks) and respecting their disliked foods and dietary restrictions.
3. If they ask about local foods, cuisines, recipes, or ingredients, leverage your expertise in ${profile.nationality || "Malaysia"}-specific or requested regional cuisines. Give practical, delicious, and healthy cooking or ordering tips.
4. Keep answers concise, beautiful, readable, and highly engaging. Use structured bullet points when helpful. Avoid extra meta talk or listing instructions. Provide raw text answer with markdown.`;

    const contents = [];
    
    // Build chat contents format with system prompt included or set as systemInstruction configuration
    for (const h of history) {
      contents.push({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: question }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const reply = response.text || "I am currently unable to process that. Please try rephrasing your question!";
    res.json({ success: true, answer: reply });
  } catch (error: any) {
    console.error("Ask AI Coach error:", error);
    res.status(500).json({ error: error.message || "Failed to get response from AI Coach" });
  }
});

// Configure Vite middleware or static build assets serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production build assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();

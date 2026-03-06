import { GoogleGenAI } from "@google/genai";

const clientGeminiApiKey =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_VERTEX_AI_API_KEY ||
  "";

export const clientGemini = clientGeminiApiKey
  ? new GoogleGenAI({ apiKey: clientGeminiApiKey })
  : null;

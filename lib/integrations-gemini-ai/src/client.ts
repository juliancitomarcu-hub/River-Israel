import { GoogleGenAI } from "@google/genai";

// Preferir GEMINI_API_KEY directa (Google AI Studio) si está disponible.
// Como fallback se intenta el proxy de Replit AI Integrations.
const directKey = process.env.GEMINI_API_KEY;
const proxyKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const proxyBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

if (!directKey && !proxyKey) {
  throw new Error(
    "Falta GEMINI_API_KEY (o AI_INTEGRATIONS_GEMINI_API_KEY). Configurá la variable de entorno."
  );
}

// Si tenemos clave directa de Google AI Studio, la usamos sin proxy.
// Si solo hay la clave del proxy de Replit, usamos esa con el baseUrl del proxy.
export const ai = directKey
  ? new GoogleGenAI({ apiKey: directKey })
  : new GoogleGenAI({
      apiKey: proxyKey!,
      httpOptions: {
        apiVersion: "",
        baseUrl: proxyBase,
      },
    });

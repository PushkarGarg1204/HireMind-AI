import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});
console.log(
  process.env.GOOGLE_GENAI_API_KEY ? "API Key Loaded ✅" : "API Key Missing ❌",
);

async function main() {
  const models = await ai.models.list();

  for await (const model of models) {
    console.log(model.name);
  }
}

main().catch(console.error);

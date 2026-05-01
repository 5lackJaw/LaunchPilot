import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { env } from "@/config/env";
import { AiConfigurationError } from "@/server/ai/errors";
import type { AiProvider } from "@/server/ai/types";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;

export function getAnthropicClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AiConfigurationError("ANTHROPIC_API_KEY is missing.");
  }

  anthropicClient ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

export function getGeminiClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new AiConfigurationError("GEMINI_API_KEY is missing.");
  }

  geminiClient ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return geminiClient;
}

export function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AiConfigurationError("OPENAI_API_KEY is missing.");
  }

  openaiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openaiClient;
}

export function assertProviderConfigured(provider: AiProvider): void {
  if (provider === "anthropic") {
    getAnthropicClient();
    return;
  }

  if (provider === "gemini") {
    getGeminiClient();
    return;
  }

  getOpenAIClient();
}

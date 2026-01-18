/**
 * Shared Gemini API client for asset generation
 * Handles both Gemini and Imagen model variants
 */

import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export interface GenerationResult {
  imageBuffer: Buffer;
  mimeType: string;
}

export interface GeminiClientOptions {
  model?: string;
  apiKey?: string;
}

/**
 * Shared Gemini API client
 */
export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiClientOptions = {}) {
    this.apiKey = options.apiKey || GEMINI_API_KEY || "";
    this.model = options.model || DEFAULT_MODEL;

    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. Add it to your .env file."
      );
    }
  }

  /**
   * Generate an image from a text prompt
   */
  async generateImage(prompt: string): Promise<GenerationResult> {
    const isImagen = this.model.startsWith("imagen");
    return isImagen
      ? this.generateWithImagen(prompt)
      : this.generateWithGemini(prompt);
  }

  /**
   * Generate using Gemini model (supports image output)
   */
  private async generateWithGemini(prompt: string): Promise<GenerationResult> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    console.log(`  Using Gemini API (${this.model})...`);
    const response = await this.makeRequest(apiUrl, requestBody);
    return this.parseGeminiResponse(response);
  }

  /**
   * Generate using Imagen model (dedicated image generation)
   */
  private async generateWithImagen(prompt: string): Promise<GenerationResult> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict`;

    const requestBody = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
      },
    };

    console.log(`  Using Imagen API (${this.model})...`);
    const response = await this.makeRequest(apiUrl, requestBody);
    return this.parseImagenResponse(response);
  }

  /**
   * Make HTTP request to the API
   */
  private async makeRequest(
    url: string,
    body: Record<string, unknown>
  ): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.error("API Network Error:");
      console.error(`  URL: ${url}`);
      console.error(
        `  Error: ${fetchError instanceof Error ? fetchError.message : fetchError}`
      );
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Details:");
      console.error(`  Status: ${response.status} ${response.statusText}`);
      console.error(`  Body: ${errorText}`);
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    return response;
  }

  /**
   * Parse Gemini API response
   */
  private async parseGeminiResponse(response: Response): Promise<GenerationResult> {
    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("No content in response");
    }

    const imagePart = parts.find((part) =>
      part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData) {
      const textPart = parts.find((part) => part.text);
      if (textPart?.text) {
        console.log("Model response:", textPart.text);
      }
      throw new Error("No image data in response");
    }

    return {
      imageBuffer: Buffer.from(imagePart.inlineData.data, "base64"),
      mimeType: imagePart.inlineData.mimeType,
    };
  }

  /**
   * Parse Imagen API response
   */
  private async parseImagenResponse(response: Response): Promise<GenerationResult> {
    const data: ImagenResponse = await response.json();

    if (data.error) {
      throw new Error(`Imagen API error: ${data.error.message}`);
    }

    if (!data.predictions || data.predictions.length === 0) {
      throw new Error("No predictions in response");
    }

    return {
      imageBuffer: Buffer.from(data.predictions[0].bytesBase64Encoded, "base64"),
      mimeType: data.predictions[0].mimeType || "image/png",
    };
  }

  /**
   * Get the current model name
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Create a new Gemini client instance
 */
export function createGeminiClient(options?: GeminiClientOptions): GeminiClient {
  return new GeminiClient(options);
}

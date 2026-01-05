#!/usr/bin/env tsx
/**
 * Image generation script using Google Gemini/Imagen API
 *
 * Usage:
 *   pnpm run generate-image "A pixel art archer character" 512 512
 *   pnpm run generate-image "A dark dungeon with torches" 1024 768 --output dungeon.png
 *
 * Environment variables:
 *   GEMINI_API_KEY - Your Google AI API key (required)
 *   GEMINI_MODEL - Model to use (default: imagen-3.0-generate-002)
 *
 * Supported models:
 *   - imagen-3.0-generate-002 (Imagen 3 - dedicated image generation)
 *   - gemini-2.0-flash-exp (Gemini with image output capability)
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file first
function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      const eqIndex = trimmedLine.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmedLine.slice(0, eqIndex).trim();
        const value = trimmedLine.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'imagen-3.0-generate-002';

interface GenerateImageOptions {
  prompt: string;
  width: number;
  height: number;
  outputPath?: string;
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

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.1) return '3:4';
  return '1:1'; // default
}

async function generateWithImagen(options: GenerateImageOptions): Promise<{ data: string; mimeType: string }> {
  const { prompt, width, height } = options;
  const aspectRatio = getAspectRatio(width, height);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`;

  const requestBody = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio,
    },
  };

  console.log(`Using Imagen API (${MODEL})...`);
  console.log(`  Aspect ratio: ${aspectRatio}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY!,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Imagen API Error Details:');
    console.error(`  Status: ${response.status} ${response.statusText}`);
    console.error(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    console.error(`  Body: ${errorText}`);
    throw new Error(`Imagen API request failed (${response.status}): ${errorText}`);
  }

  const data: ImagenResponse = await response.json();

  if (data.error) {
    throw new Error(`Imagen API error: ${data.error.message}`);
  }

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error('No predictions in Imagen response');
  }

  return {
    data: data.predictions[0].bytesBase64Encoded,
    mimeType: data.predictions[0].mimeType || 'image/png',
  };
}

async function generateWithGemini(options: GenerateImageOptions): Promise<{ data: string; mimeType: string }> {
  const { prompt, width, height } = options;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Generate an image: ${prompt}. Target size approximately ${width}x${height} pixels. IMPORTANT: The subject must FILL the entire canvas - use 90-95% of available space with minimal margins or padding. Make the subject large and prominent.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  console.log(`Using Gemini API (${MODEL})...`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY!,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error Details:');
    console.error(`  Status: ${response.status} ${response.statusText}`);
    console.error(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    console.error(`  Body: ${errorText}`);
    throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error('No content in Gemini response');
  }

  const imagePart = parts.find((part) => part.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData) {
    const textPart = parts.find((part) => part.text);
    if (textPart?.text) {
      console.log('Model text response:', textPart.text);
    }
    throw new Error('No image data in Gemini response');
  }

  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

async function generateImage(options: GenerateImageOptions): Promise<string> {
  const { prompt, width, height, outputPath } = options;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Add it to your .env file.');
  }

  console.log(`Generating image...`);
  console.log(`  Prompt: "${prompt}"`);
  console.log(`  Size: ${width}x${height}`);
  console.log(`  Model: ${MODEL}`);

  // Choose API based on model name
  const isImagen = MODEL.startsWith('imagen');
  const result = isImagen ? await generateWithImagen(options) : await generateWithGemini(options);

  const extension = result.mimeType.split('/')[1] || 'png';

  // Determine output path
  const timestamp = Date.now();
  const finalOutputPath = outputPath || path.join('assets', 'generated', `image_${timestamp}.${extension}`);

  // Ensure output directory exists
  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save image
  const imageBuffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(finalOutputPath, imageBuffer);

  console.log(`Image saved to: ${finalOutputPath}`);
  return finalOutputPath;
}

function printUsage(): void {
  console.log(`
Usage: pnpm run generate-image <prompt> [width] [height] [--output <path>]

Arguments:
  prompt    The text description of the image to generate (required)
  width     Image width in pixels (default: 512)
  height    Image height in pixels (default: 512)

Options:
  --output, -o    Output file path (default: assets/generated/image_<timestamp>.png)

Environment:
  GEMINI_API_KEY  Your Google AI API key (required)
  GEMINI_MODEL    Model to use (default: imagen-3.0-generate-002)
                  Options: imagen-3.0-generate-002, gemini-2.0-flash-exp

Examples:
  pnpm run generate-image "A pixel art archer character"
  pnpm run generate-image "A dark dungeon" 1024 768
  pnpm run generate-image "Game enemy sprite" 256 256 --output assets/sprites/enemy.png
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  let prompt = '';
  let width = 512;
  let height = 512;
  let outputPath: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
    } else if (!prompt) {
      prompt = arg;
    } else if (width === 512 && !isNaN(parseInt(arg))) {
      width = parseInt(arg);
    } else if (height === 512 && !isNaN(parseInt(arg))) {
      height = parseInt(arg);
    }
    i++;
  }

  if (!prompt) {
    console.error('Error: Prompt is required');
    printUsage();
    process.exit(1);
  }

  try {
    await generateImage({ prompt, width, height, outputPath });
  } catch (error) {
    console.error('Error generating image:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

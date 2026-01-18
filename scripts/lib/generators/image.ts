/**
 * Image generation module
 * Generates backgrounds, textures, and other non-sprite assets
 */

import * as fs from "fs";
import * as path from "path";
import { createGeminiClient } from "../api/gemini.js";
import { buildImagePrompt } from "../config/styles.js";
import { BACKGROUND_CONFIG } from "../config/sizes.js";
import { resizeImage } from "../processing/resize.js";

export interface GenerateImageOptions {
  /** Description of the image to generate */
  description: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Output file path */
  outputPath?: string;
  /** Resize to fit background dimensions */
  fitToBackground?: boolean;
}

export interface GenerateImageResult {
  outputPath: string;
  width: number;
  height: number;
  description: string;
}

/**
 * Generate an image with the specified options
 */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const { description, width = 512, height = 512, fitToBackground = false } = options;

  // Build output path
  const timestamp = Date.now();
  const safeName = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);

  const extension = "png";
  const defaultPath = path.join("assets", "generated", `${safeName}_${timestamp}.${extension}`);
  const outputPath = options.outputPath || defaultPath;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create API client and generate
  const client = createGeminiClient();

  console.log(`Generating image...`);
  console.log(`  Description: "${description}"`);
  console.log(`  Target size: ${width}x${height}`);
  console.log(`  Model: ${client.getModel()}`);

  // Build prompt
  const prompt = buildImagePrompt(description, width, height);

  // Generate image
  const result = await client.generateImage(prompt);

  // Save raw output
  fs.writeFileSync(outputPath, result.imageBuffer);
  console.log(`  Generated: ${outputPath}`);

  // Resize if requested
  let finalWidth = width;
  let finalHeight = height;

  if (fitToBackground) {
    console.log(
      `  Resizing to background dimensions (${BACKGROUND_CONFIG.width}x${BACKGROUND_CONFIG.height})...`,
    );
    const resizeResult = await resizeImage({
      inputPath: outputPath,
      targetWidth: BACKGROUND_CONFIG.width,
      targetHeight: BACKGROUND_CONFIG.height,
      interpolation: "lanczos",
    });
    finalWidth = resizeResult.newWidth;
    finalHeight = resizeResult.newHeight;
    console.log(
      `    Resized from ${resizeResult.originalWidth}x${resizeResult.originalHeight} to ${finalWidth}x${finalHeight}`,
    );
  }

  console.log(`Image saved to: ${outputPath}`);

  return {
    outputPath,
    width: finalWidth,
    height: finalHeight,
    description,
  };
}

/**
 * Print usage information for image generation
 */
export function printImageUsage(): void {
  console.log(`
Usage: pnpm run generate image <description> [options]

Arguments:
  description    What the image should depict (required)

Options:
  --size         Image size as WxH (default: 512x512)
                 Example: --size 1024x768
  --output, -o   Output file path
                 (default: assets/generated/<name>_<timestamp>.png)
  --background   Resize to game background dimensions (375x667)

Examples:
  pnpm run generate image "dark dungeon floor texture"
  pnpm run generate image "forest background" --size 1024x768
  pnpm run generate image "mystic cave" --background
  pnpm run generate image "stone wall texture" --output assets/backgrounds/stone.png
`);
}

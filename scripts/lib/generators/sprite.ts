/**
 * Sprite generation module
 * Generates pixel art game sprites with optional background removal
 */

import * as fs from "fs";
import * as path from "path";
import { createGeminiClient } from "../api/gemini.js";
import { buildSpritePrompt, type AssetType, type StylePreset } from "../config/styles.js";
import { getSizeConfig, getValidSpriteTypes } from "../config/sizes.js";
import { removeBackground } from "../processing/background-removal.js";
import { resizeImage } from "../processing/resize.js";

export interface GenerateSpriteOptions {
  /** Description of the sprite to generate */
  description: string;
  /** Asset type (player, enemy, boss, etc.) */
  type: AssetType;
  /** Custom size override */
  size?: number;
  /** Style preset (default, dark, fire, ice, nature, shadow, holy) */
  preset?: StylePreset;
  /** Output file path */
  outputPath?: string;
  /** Remove background for transparency */
  clean?: boolean;
}

export interface GenerateSpriteResult {
  outputPath: string;
  size: number;
  description: string;
}

/**
 * Generate a sprite with the specified options
 */
export async function generateSprite(
  options: GenerateSpriteOptions,
): Promise<GenerateSpriteResult> {
  const { description, type, preset = "default", clean = false } = options;
  const config = getSizeConfig(type);
  const size = options.size || config.targetSize;

  // Validate type
  if (!getValidSpriteTypes().includes(type)) {
    throw new Error(
      `Invalid sprite type: ${type}. Valid types: ${getValidSpriteTypes().join(", ")}`,
    );
  }

  // Build output path
  const timestamp = Date.now();
  const safeName = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);

  const defaultPath = path.join("assets", "sprites", type, `${safeName}_${timestamp}.png`);
  const outputPath = options.outputPath || defaultPath;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create API client and generate
  const client = createGeminiClient();

  console.log(`Generating ${type} sprite...`);
  console.log(`  Description: "${description}"`);
  console.log(`  Size: ${size}x${size}`);
  console.log(`  Model: ${client.getModel()}`);

  // Build prompt
  const prompt = buildSpritePrompt(description, type, undefined, preset);
  console.log(`  Prompt: "${prompt.slice(0, 100)}..."`);

  // Generate image
  const result = await client.generateImage(prompt);

  // Save raw output
  fs.writeFileSync(outputPath, result.imageBuffer);
  console.log(`  Generated: ${outputPath}`);

  // Remove background if requested
  if (clean) {
    console.log(`  Removing background...`);
    const bgResult = await removeBackground({ inputPath: outputPath });
    if (bgResult.success) {
      console.log(`    Background removed successfully`);
    } else {
      console.log(`    Warning: Background removal may not be complete`);
    }
  }

  // Resize to target size (AI generates 1024x1024)
  console.log(`  Resizing to ${size}x${size}...`);
  const resizeResult = await resizeImage({
    inputPath: outputPath,
    targetSize: size,
    interpolation: config.interpolation,
  });
  console.log(
    `    Resized from ${resizeResult.originalWidth}x${resizeResult.originalHeight} to ${resizeResult.newWidth}x${resizeResult.newHeight}`,
  );

  console.log(`Sprite saved to: ${outputPath}`);

  return {
    outputPath,
    size,
    description,
  };
}

/**
 * Print usage information for sprite generation
 */
export function printSpriteUsage(): void {
  const types = getValidSpriteTypes();
  const presets = ["default", "dark", "fire", "ice", "nature", "shadow", "holy"];

  console.log(`
Usage: pnpm run generate sprite <description> [options]

Arguments:
  description    What the sprite should depict (required)

Options:
  --type, -t     Sprite type: ${types.join(", ")}
                 (default: generic)
  --size, -s     Sprite size in pixels (default: varies by type)
  --preset, -p   Style preset: ${presets.join(", ")}
                 (default: default)
  --output, -o   Output file path
                 (default: assets/sprites/<type>/<name>_<timestamp>.png)
  --clean, -c    Remove background for true transparency

Sprite Types & Default Sizes:
  player      64px   Hero characters
  enemy       64px   Standard enemies
  boss       128px   Boss enemies
  projectile  32px   Bullets, arrows, spells
  item        32px   Collectibles, pickups
  effect      64px   Visual effects, particles
  ui          48px   Interface icons
  generic     64px   Other game assets

Examples:
  pnpm run generate sprite "archer with bow" --type player --clean
  pnpm run generate sprite "red slime monster" --type enemy --size 48 --clean
  pnpm run generate sprite "golden arrow" --type projectile -c
  pnpm run generate sprite "ice golem" --type boss --preset ice --clean
`);
}

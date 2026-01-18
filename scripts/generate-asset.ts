#!/usr/bin/env tsx
/**
 * Unified asset generation CLI
 *
 * Commands:
 *   pnpm run generate sprite "archer with bow" --type player --clean
 *   pnpm run generate image "dungeon floor" --size 375x667
 *   pnpm run generate optimize              # Optimize all assets
 *   pnpm run generate clean <path>          # Remove backgrounds
 */

import * as fs from "fs";
import * as path from "path";
import { generateSprite, printSpriteUsage } from "./lib/generators/sprite.js";
import { generateImage, printImageUsage } from "./lib/generators/image.js";
import { removeBackground, findImagesInDirectory } from "./lib/processing/background-removal.js";
import { optimizeAllAssets, formatBytes } from "./lib/processing/optimize.js";
import { getValidSpriteTypes } from "./lib/config/sizes.js";
import type { AssetType, StylePreset } from "./lib/config/styles.js";

type Command = "sprite" | "image" | "optimize" | "clean" | "help";

function printMainUsage(): void {
  console.log(`
Unified Asset Generation CLI

Commands:
  sprite     Generate a pixel art game sprite
  image      Generate a background or texture image
  optimize   Optimize all assets in public/assets
  clean      Remove background from existing image(s)
  help       Show this help message

Examples:
  pnpm run generate sprite "archer with bow" --type player --clean
  pnpm run generate image "dark dungeon" --size 375x667
  pnpm run generate optimize
  pnpm run generate clean public/assets/sprites/player/hero.png

Run 'pnpm run generate <command> --help' for command-specific help.
`);
}

async function handleSprite(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printSpriteUsage();
    return;
  }

  // Parse arguments
  let description = "";
  let type: AssetType = "generic";
  let size: number | undefined;
  let preset: StylePreset = "default";
  let outputPath: string | undefined;
  let clean = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--type" || arg === "-t") {
      const typeArg = args[++i];
      if (getValidSpriteTypes().includes(typeArg)) {
        type = typeArg as AssetType;
      } else {
        console.error(
          `Invalid type: ${typeArg}. Valid types: ${getValidSpriteTypes().join(", ")}`
        );
        process.exit(1);
      }
    } else if (arg === "--size" || arg === "-s") {
      size = parseInt(args[++i]);
      if (isNaN(size) || size < 16 || size > 1024) {
        console.error("Size must be a number between 16 and 1024");
        process.exit(1);
      }
    } else if (arg === "--preset" || arg === "-p") {
      preset = args[++i] as StylePreset;
    } else if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (arg === "--clean" || arg === "-c") {
      clean = true;
    } else if (!arg.startsWith("-")) {
      description = arg;
    }
    i++;
  }

  if (!description) {
    console.error("Error: Sprite description is required");
    printSpriteUsage();
    process.exit(1);
  }

  await generateSprite({ description, type, size, preset, outputPath, clean });
}

async function handleImage(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printImageUsage();
    return;
  }

  // Parse arguments
  let description = "";
  let width = 512;
  let height = 512;
  let outputPath: string | undefined;
  let fitToBackground = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--size") {
      const sizeArg = args[++i];
      const match = sizeArg.match(/^(\d+)x(\d+)$/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
      } else {
        console.error("Size must be in format WxH (e.g., 512x512)");
        process.exit(1);
      }
    } else if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (arg === "--background") {
      fitToBackground = true;
    } else if (!arg.startsWith("-")) {
      description = arg;
    }
    i++;
  }

  if (!description) {
    console.error("Error: Image description is required");
    printImageUsage();
    process.exit(1);
  }

  await generateImage({ description, width, height, outputPath, fitToBackground });
}

async function handleOptimize(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: pnpm run generate optimize [options]

Optimize all assets in public/assets directory.
Resizes oversized images and compresses them for game use.

Options:
  --dry, -d    Preview changes without modifying files
  --help, -h   Show this help message

Examples:
  pnpm run generate optimize
  pnpm run generate optimize --dry
`);
    return;
  }

  const dryRun = args.includes("--dry") || args.includes("-d");

  console.log("Asset Optimization");
  console.log("==================");
  if (dryRun) {
    console.log("DRY RUN MODE - No files will be modified\n");
  }

  const summary = await optimizeAllAssets(dryRun);

  console.log("\n==================");
  console.log("Summary:");
  console.log(`  Optimized: ${summary.results.length} files`);
  console.log(`  Skipped: ${summary.skipped} files`);
  console.log(`  Errors: ${summary.errors} files`);

  if (summary.results.length > 0) {
    const savedPct = ((summary.totalSaved / summary.totalOriginalSize) * 100).toFixed(1);
    console.log(`\n  Total original size: ${formatBytes(summary.totalOriginalSize)}`);
    console.log(`  Total new size: ${formatBytes(summary.totalNewSize)}`);
    console.log(`  Total saved: ${formatBytes(summary.totalSaved)} (${savedPct}%)`);
  }

  if (dryRun && summary.results.length > 0) {
    console.log("\nRun without --dry to apply optimizations.");
  }
}

async function handleClean(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
Usage: pnpm run generate clean <path> [options]

Remove background from image(s) using ML-based detection.

Arguments:
  path         Path to image file or directory with glob pattern

Options:
  --help, -h   Show this help message

Examples:
  pnpm run generate clean public/assets/sprites/player/hero.png
  pnpm run generate clean "public/assets/sprites/enemy/*.png"
`);
    return;
  }

  const inputPath = args.find((arg) => !arg.startsWith("-"));

  if (!inputPath) {
    console.error("Error: Image path is required");
    process.exit(1);
  }

  // Check if it's a glob pattern or single file
  if (inputPath.includes("*")) {
    const dir = path.dirname(inputPath);
    const pattern = path.basename(inputPath);
    const files = findImagesInDirectory(dir, pattern);

    if (files.length === 0) {
      console.log("No matching files found");
      return;
    }

    console.log(`Processing ${files.length} files...`);

    for (const file of files) {
      console.log(`\nProcessing: ${file}`);
      const result = await removeBackground({ inputPath: file });
      if (result.success) {
        console.log(`  Background removed: ${result.outputPath}`);
      }
    }
  } else {
    if (!fs.existsSync(inputPath)) {
      console.error(`File not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Processing: ${inputPath}`);
    const result = await removeBackground({ inputPath });
    if (result.success) {
      console.log(`Background removed: ${result.outputPath}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    printMainUsage();
    process.exit(0);
  }

  const command = args[0] as Command;
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case "sprite":
        await handleSprite(commandArgs);
        break;
      case "image":
        await handleImage(commandArgs);
        break;
      case "optimize":
        await handleOptimize(commandArgs);
        break;
      case "clean":
        await handleClean(commandArgs);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printMainUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();

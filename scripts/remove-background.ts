#!/usr/bin/env tsx
/**
 * Background removal script for generated sprites
 * Removes magenta chroma key and checkerboard backgrounds
 *
 * Usage:
 *   pnpm run remove-bg <image-path> [--output <path>] [--tolerance <0-255>]
 *   pnpm run remove-bg assets/sprites/enemy/*.png --tolerance 30
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

interface RemoveBgOptions {
  inputPath: string;
  outputPath?: string;
  tolerance: number;
}

// Chroma key: Magenta #FF00FF
const CHROMA_KEY = { r: 255, g: 0, b: 255 };

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
}

function isGrayBackground(r: number, g: number, b: number): boolean {
  const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
  return isGray && r > 120 && r < 220;
}

async function removeBackground(options: RemoveBgOptions): Promise<string> {
  const { inputPath, tolerance } = options;

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const newData = Buffer.from(data);
  let magentaRemoved = 0;
  let otherRemoved = 0;

  // First pass: Remove magenta pixels (chroma key)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    const isMagenta =
      colorDistance(r, g, b, CHROMA_KEY.r, CHROMA_KEY.g, CHROMA_KEY.b) <= 80 ||
      (r > 180 && g < 120 && b > 180) ||
      (r > 200 && g < 80 && b > 200);

    if (isMagenta) {
      newData[i + 3] = 0;
      magentaRemoved++;
    }
  }

  // If no magenta found, fall back to flood fill from edges
  if (magentaRemoved < 100) {
    const corners: [number, number][] = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    let bgR = 0,
      bgG = 0,
      bgB = 0;
    for (const [x, y] of corners) {
      const idx = (y * width + x) * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    }
    bgR = Math.round(bgR / 4);
    bgG = Math.round(bgG / 4);
    bgB = Math.round(bgB / 4);

    const visited = new Set<number>();
    const queue: [number, number][] = [];

    for (let x = 0; x < width; x++) {
      queue.push([x, 0], [x, height - 1]);
    }
    for (let y = 0; y < height; y++) {
      queue.push([0, y], [width - 1, y]);
    }

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixelKey = y * width + x;
      if (visited.has(pixelKey)) continue;
      visited.add(pixelKey);

      const idx = pixelKey * 4;
      const r = data[idx],
        g = data[idx + 1],
        b = data[idx + 2];

      if (colorDistance(r, g, b, bgR, bgG, bgB) <= tolerance || isGrayBackground(r, g, b)) {
        newData[idx + 3] = 0;
        otherRemoved++;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  }

  const totalRemoved = magentaRemoved + otherRemoved;
  const percentage = ((totalRemoved / (width * height)) * 100).toFixed(1);
  console.log(
    `  Removed ${totalRemoved} pixels (${percentage}%) - magenta: ${magentaRemoved}, other: ${otherRemoved}`,
  );

  // Determine output path
  const outputPath = options.outputPath || inputPath.replace(/\.(png|jpg|jpeg)$/i, "_clean.png");

  await sharp(newData, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function processGlob(pattern: string, tolerance: number): Promise<void> {
  const dir = path.dirname(pattern);
  const filePattern = path.basename(pattern);

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  const regex = new RegExp("^" + filePattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  const matchingFiles = files.filter((f) => regex.test(f) && !f.includes("_clean"));

  if (matchingFiles.length === 0) {
    console.log("No matching files found");
    return;
  }

  console.log(`Processing ${matchingFiles.length} files...`);

  for (const file of matchingFiles) {
    const inputPath = path.join(dir, file);
    console.log(`\nProcessing: ${inputPath}`);
    try {
      const outputPath = await removeBackground({ inputPath, tolerance });
      console.log(`  Saved: ${outputPath}`);
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function printUsage(): void {
  console.log(`
Usage: pnpm run remove-bg <image-path> [options]

Removes magenta (#FF00FF) chroma key backgrounds or gray checkerboard patterns.

Arguments:
  image-path    Path to image file or glob pattern (e.g., "assets/sprites/*.png")

Options:
  --output, -o     Output file path (default: <input>_clean.png)
  --tolerance, -t  Color tolerance 0-255 for fallback detection (default: 30)

Examples:
  pnpm run remove-bg assets/sprites/enemy/slime.png
  pnpm run remove-bg "assets/sprites/player/*.png"
  pnpm run remove-bg image.png --output clean.png
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  let inputPath = "";
  let outputPath: string | undefined;
  let tolerance = 30;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (arg === "--tolerance" || arg === "-t") {
      tolerance = parseInt(args[++i]);
    } else if (!arg.startsWith("-")) {
      inputPath = arg;
    }
    i++;
  }

  if (!inputPath) {
    console.error("Error: Image path is required");
    process.exit(1);
  }

  try {
    if (inputPath.includes("*")) {
      await processGlob(inputPath, tolerance);
    } else {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
      }
      console.log(`Processing: ${inputPath}`);
      const result = await removeBackground({ inputPath, outputPath, tolerance });
      console.log(`Saved: ${result}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

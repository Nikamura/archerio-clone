#!/usr/bin/env tsx
/**
 * Asset optimization script using Sharp
 * Resizes oversized images to appropriate game sizes and compresses them
 *
 * Usage:
 *   pnpm run optimize-assets          # Optimize all assets
 *   pnpm run optimize-assets --dry    # Preview changes without modifying files
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

// Target sizes for different asset types (in pixels)
const SIZE_CONFIG: Record<string, number> = {
  player: 64,
  enemy: 64,
  boss: 128,
  projectile: 32,
  item: 32,
  effect: 64,
  ui: 48,
  abilities: 64,
  chest: 64,
  door: 64,
  equipment: 64, // Equipment icons
  originals: 0, // Skip originals (keep as reference)
};

// Background sizes (portrait mode: 375x667)
const BACKGROUND_WIDTH = 375;
const BACKGROUND_HEIGHT = 667;

interface OptimizationResult {
  path: string;
  originalSize: number;
  newSize: number;
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
  saved: number;
}

async function getImageInfo(
  filePath: string,
): Promise<{ width: number; height: number; size: number }> {
  const stats = fs.statSync(filePath);
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    size: stats.size,
  };
}

function getSpriteType(filePath: string): string | null {
  const relativePath = path.relative(ASSETS_DIR, filePath);
  const parts = relativePath.split(path.sep);

  if (parts[0] === "sprites" && parts.length >= 2) {
    return parts[1];
  }
  if (parts[0] === "backgrounds") {
    return "background";
  }
  return null;
}

function getTargetSize(spriteType: string): number {
  return SIZE_CONFIG[spriteType] || 64;
}

async function optimizeSprite(
  filePath: string,
  targetSize: number,
  dryRun: boolean,
): Promise<OptimizationResult | null> {
  const info = await getImageInfo(filePath);

  // Skip if already at or below target size
  if (info.width <= targetSize && info.height <= targetSize) {
    return null;
  }

  const tempPath = filePath + ".optimized.png";

  // Resize maintaining aspect ratio, fit within targetSize x targetSize
  await sharp(filePath)
    .resize(targetSize, targetSize, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      palette: true,
    })
    .toFile(tempPath);

  const newStats = fs.statSync(tempPath);
  const newMetadata = await sharp(tempPath).metadata();

  const result: OptimizationResult = {
    path: filePath,
    originalSize: info.size,
    newSize: newStats.size,
    originalDimensions: { width: info.width, height: info.height },
    newDimensions: {
      width: newMetadata.width || targetSize,
      height: newMetadata.height || targetSize,
    },
    saved: info.size - newStats.size,
  };

  if (!dryRun) {
    fs.renameSync(tempPath, filePath);
  } else {
    fs.unlinkSync(tempPath);
  }

  return result;
}

async function optimizeBackground(
  filePath: string,
  dryRun: boolean,
): Promise<OptimizationResult | null> {
  const info = await getImageInfo(filePath);

  // Detect actual format (some PNGs might be JPEGs)
  const metadata = await sharp(filePath).metadata();
  const actualFormat = metadata.format;

  // Use JPEG for backgrounds (better compression for photos/gradients)
  const tempPath = filePath + ".optimized.jpg";

  // Target dimensions: game resolution or smaller
  const targetWidth = Math.min(info.width, BACKGROUND_WIDTH);
  const targetHeight = Math.min(info.height, BACKGROUND_HEIGHT);

  // Check if resize or compression is needed
  const needsResize = info.width > BACKGROUND_WIDTH || info.height > BACKGROUND_HEIGHT;

  if (!needsResize && actualFormat === "jpeg") {
    // Already JPEG and right size, try to compress further
    await sharp(filePath).jpeg({ quality: 80, mozjpeg: true }).toFile(tempPath);

    const newStats = fs.statSync(tempPath);
    if (newStats.size >= info.size) {
      fs.unlinkSync(tempPath);
      return null;
    }
  } else {
    // Resize and/or convert to JPEG
    await sharp(filePath)
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(tempPath);
  }

  const newStats = fs.statSync(tempPath);
  const newMetadata = await sharp(tempPath).metadata();

  const result: OptimizationResult = {
    path: filePath,
    originalSize: info.size,
    newSize: newStats.size,
    originalDimensions: { width: info.width, height: info.height },
    newDimensions: {
      width: newMetadata.width || targetWidth,
      height: newMetadata.height || targetHeight,
    },
    saved: info.size - newStats.size,
  };

  if (!dryRun) {
    // Replace with JPEG
    const newPath = filePath.replace(/\.(png|jpg|jpeg)$/i, ".jpg");
    fs.renameSync(tempPath, newPath);
    if (newPath !== filePath) {
      fs.unlinkSync(filePath);
    }
    result.path = newPath;
  } else {
    fs.unlinkSync(tempPath);
  }

  return result;
}

async function findImages(dir: string): Promise<string[]> {
  const images: string[] = [];

  function walkDir(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
        images.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return images;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry") || args.includes("-d");

  console.log("Asset Optimization Script");
  console.log("=========================");
  if (dryRun) {
    console.log("DRY RUN MODE - No files will be modified\n");
  }

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Assets directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  const images = await findImages(ASSETS_DIR);
  console.log(`Found ${images.length} images to check\n`);

  const results: OptimizationResult[] = [];
  let skipped = 0;
  let errors = 0;

  for (const imagePath of images) {
    const spriteType = getSpriteType(imagePath);
    const relativePath = path.relative(ASSETS_DIR, imagePath);

    // Skip originals directory
    if (spriteType === "originals") {
      console.log(`  [SKIP] ${relativePath} (originals preserved)`);
      skipped++;
      continue;
    }

    try {
      let result: OptimizationResult | null = null;

      if (spriteType === "background") {
        result = await optimizeBackground(imagePath, dryRun);
      } else if (spriteType) {
        const targetSize = getTargetSize(spriteType);
        result = await optimizeSprite(imagePath, targetSize, dryRun);
      }

      if (result) {
        results.push(result);
        const savedPct = ((result.saved / result.originalSize) * 100).toFixed(1);
        console.log(
          `  [OK] ${relativePath}: ${result.originalDimensions.width}x${result.originalDimensions.height} → ${result.newDimensions.width}x${result.newDimensions.height} (${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)}, saved ${savedPct}%)`,
        );
      } else {
        console.log(`  [SKIP] ${relativePath} (already optimized)`);
        skipped++;
      }
    } catch (error) {
      console.error(`  [ERROR] ${relativePath}: ${error instanceof Error ? error.message : error}`);
      errors++;
    }
  }

  // Summary
  console.log("\n=========================");
  console.log("Summary:");
  console.log(`  Optimized: ${results.length} files`);
  console.log(`  Skipped: ${skipped} files`);
  console.log(`  Errors: ${errors} files`);

  if (results.length > 0) {
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginal - totalNew;
    const savedPct = ((totalSaved / totalOriginal) * 100).toFixed(1);

    console.log(`\n  Total original size: ${formatBytes(totalOriginal)}`);
    console.log(`  Total new size: ${formatBytes(totalNew)}`);
    console.log(`  Total saved: ${formatBytes(totalSaved)} (${savedPct}%)`);
  }

  if (dryRun && results.length > 0) {
    console.log("\nRun without --dry to apply optimizations.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

/**
 * Asset optimization utilities
 * Resizes oversized images and compresses them for game use
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { SIZE_CONFIGS, BACKGROUND_CONFIG } from "../config/sizes.js";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

export interface OptimizationResult {
  path: string;
  originalSize: number;
  newSize: number;
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
  saved: number;
}

export interface OptimizationSummary {
  results: OptimizationResult[];
  skipped: number;
  errors: number;
  totalOriginalSize: number;
  totalNewSize: number;
  totalSaved: number;
}

/**
 * Get sprite type from file path
 */
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

/**
 * Get target size for a sprite type
 */
function getTargetSize(spriteType: string): number {
  return SIZE_CONFIGS[spriteType]?.targetSize || 64;
}

/**
 * Get image info (dimensions and file size)
 */
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

/**
 * Optimize a sprite image
 */
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

  await sharp(filePath)
    .resize(targetSize, targetSize, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.nearest,
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

/**
 * Optimize a background image
 */
async function optimizeBackground(
  filePath: string,
  dryRun: boolean,
): Promise<OptimizationResult | null> {
  const info = await getImageInfo(filePath);
  const metadata = await sharp(filePath).metadata();
  const actualFormat = metadata.format;

  const tempPath = filePath + ".optimized.jpg";
  const { width: targetWidth, height: targetHeight } = BACKGROUND_CONFIG;

  const needsResize = info.width > targetWidth || info.height > targetHeight;

  if (!needsResize && actualFormat === "jpeg") {
    await sharp(filePath).jpeg({ quality: 80, mozjpeg: true }).toFile(tempPath);

    const newStats = fs.statSync(tempPath);
    if (newStats.size >= info.size) {
      fs.unlinkSync(tempPath);
      return null;
    }
  } else {
    await sharp(filePath)
      .resize(Math.min(info.width, targetWidth), Math.min(info.height, targetHeight), {
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

/**
 * Find all images in a directory recursively
 */
function findImages(dir: string): string[] {
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

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Optimize all assets in the public/assets directory
 */
export async function optimizeAllAssets(dryRun = false): Promise<OptimizationSummary> {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(`Assets directory not found: ${ASSETS_DIR}`);
  }

  const images = findImages(ASSETS_DIR);
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

  const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalNewSize = results.reduce((sum, r) => sum + r.newSize, 0);

  return {
    results,
    skipped,
    errors,
    totalOriginalSize,
    totalNewSize,
    totalSaved: totalOriginalSize - totalNewSize,
  };
}

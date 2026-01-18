/**
 * Image resizing utilities for asset generation
 * Handles downscaling from 1024px AI output to target sizes
 */

import * as fs from "fs";
import sharp from "sharp";
import { getSizeConfig, BACKGROUND_CONFIG, type SizeConfig } from "../config/sizes.js";

export interface ResizeOptions {
  /** Path to the image file */
  inputPath: string;
  /** Target size in pixels (for square sprites) */
  targetSize?: number;
  /** Target width (for non-square images) */
  targetWidth?: number;
  /** Target height (for non-square images) */
  targetHeight?: number;
  /** Interpolation method */
  interpolation?: "nearest" | "lanczos";
  /** Optional output path (defaults to overwriting input) */
  outputPath?: string;
}

export interface ResizeResult {
  outputPath: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
}

/**
 * Resize an image to target dimensions
 */
export async function resizeImage(options: ResizeOptions): Promise<ResizeResult> {
  const {
    inputPath,
    targetSize,
    targetWidth,
    targetHeight,
    interpolation = "nearest",
    outputPath = inputPath,
  } = options;

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Determine target dimensions
  let width: number;
  let height: number;

  if (targetSize) {
    width = targetSize;
    height = targetSize;
  } else if (targetWidth && targetHeight) {
    width = targetWidth;
    height = targetHeight;
  } else {
    throw new Error("Either targetSize or both targetWidth and targetHeight must be provided");
  }

  // Skip if already at target size
  if (originalWidth === width && originalHeight === height) {
    return {
      outputPath,
      originalWidth,
      originalHeight,
      newWidth: width,
      newHeight: height,
    };
  }

  // Map interpolation to sharp kernel
  const kernel = interpolation === "nearest" ? sharp.kernel.nearest : sharp.kernel.lanczos3;

  const tempPath = inputPath + ".tmp";

  await sharp(inputPath)
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel,
    })
    .png()
    .toFile(tempPath);

  // Move temp file to output
  if (outputPath === inputPath) {
    fs.renameSync(tempPath, inputPath);
  } else {
    fs.renameSync(tempPath, outputPath);
  }

  return {
    outputPath,
    originalWidth,
    originalHeight,
    newWidth: width,
    newHeight: height,
  };
}

/**
 * Resize a sprite to its type's target size
 */
export async function resizeSpriteToType(
  inputPath: string,
  spriteType: string,
  outputPath?: string
): Promise<ResizeResult> {
  const config = getSizeConfig(spriteType);
  return resizeImage({
    inputPath,
    targetSize: config.targetSize,
    interpolation: config.interpolation,
    outputPath,
  });
}

/**
 * Resize an image to background dimensions
 */
export async function resizeToBackground(
  inputPath: string,
  outputPath?: string
): Promise<ResizeResult> {
  return resizeImage({
    inputPath,
    targetWidth: BACKGROUND_CONFIG.width,
    targetHeight: BACKGROUND_CONFIG.height,
    interpolation: BACKGROUND_CONFIG.interpolation,
    outputPath,
  });
}

/**
 * Get image dimensions without loading full image
 */
export async function getImageDimensions(
  inputPath: string
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(inputPath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

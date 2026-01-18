/**
 * ML-based background removal using @imgly/background-removal-node
 * More reliable than chroma key approach - works with any background color
 */

import { removeBackground as mlRemoveBackground } from "@imgly/background-removal-node";
import * as fs from "fs";
import * as path from "path";

export interface BackgroundRemovalOptions {
  /** Path to the image file */
  inputPath: string;
  /** Optional output path (defaults to overwriting input) */
  outputPath?: string;
  /** Model size: 'small' (~40MB), 'medium' (~80MB) */
  model?: "small" | "medium";
}

export interface BackgroundRemovalResult {
  outputPath: string;
  success: boolean;
}

/**
 * Remove background from an image using ML-based detection
 * Uses ONNX model for accurate subject detection
 */
export async function removeBackground(
  options: BackgroundRemovalOptions
): Promise<BackgroundRemovalResult> {
  const { inputPath, model = "small" } = options;
  const outputPath = options.outputPath || inputPath;

  // Read the image file
  const imageBuffer = fs.readFileSync(inputPath);
  const blob = new Blob([imageBuffer], { type: "image/png" });

  try {
    // Process with ML background removal
    const resultBlob = await mlRemoveBackground(blob, {
      model,
      output: {
        format: "image/png",
        quality: 1,
      },
    });

    // Convert blob to buffer and save
    const arrayBuffer = await resultBlob.arrayBuffer();
    const resultBuffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(outputPath, resultBuffer);

    return {
      outputPath,
      success: true,
    };
  } catch (error) {
    console.error(
      `  Background removal failed: ${error instanceof Error ? error.message : error}`
    );
    return {
      outputPath: inputPath,
      success: false,
    };
  }
}

/**
 * Process multiple images for background removal
 */
export async function removeBackgroundBatch(
  inputPaths: string[],
  options: Omit<BackgroundRemovalOptions, "inputPath"> = {}
): Promise<BackgroundRemovalResult[]> {
  const results: BackgroundRemovalResult[] = [];

  for (const inputPath of inputPaths) {
    console.log(`  Processing: ${inputPath}`);
    const result = await removeBackground({
      ...options,
      inputPath,
    });
    results.push(result);

    if (result.success) {
      console.log(`    Background removed successfully`);
    }
  }

  return results;
}

/**
 * Find all PNG files in a directory matching a pattern
 */
export function findImagesInDirectory(directory: string, pattern = "*.png"): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = fs.readdirSync(directory);
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );

  return files.filter((f) => regex.test(f)).map((f) => path.join(directory, f));
}

#!/usr/bin/env tsx
/**
 * Sprite generation script using Google Gemini API
 * Optimized for game sprites with transparent backgrounds
 * Supports animation sequences with multiple frames
 *
 * Usage:
 *   pnpm run generate-sprite "archer character" --type player
 *   pnpm run generate-sprite "slime enemy" --type enemy --anim walk --frames 4
 *   pnpm run generate-sprite "fire projectile" --type projectile --clean
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

type SpriteType = "player" | "enemy" | "projectile" | "item" | "effect" | "ui" | "boss" | "generic";
type AnimationType = "idle" | "walk" | "run" | "attack" | "hit" | "death" | "cast" | "jump";

interface SpriteConfig {
  defaultSize: number;
  stylePrompt: string;
}

interface AnimationConfig {
  frameDescriptions: string[];
  defaultFrames: number;
}

const SPRITE_CONFIGS: Record<SpriteType, SpriteConfig> = {
  player: {
    defaultSize: 64,
    stylePrompt: "heroic character design, centered composition",
  },
  enemy: {
    defaultSize: 64,
    stylePrompt: "menacing creature design, centered composition",
  },
  boss: {
    defaultSize: 128,
    stylePrompt: "large intimidating boss creature, centered composition",
  },
  projectile: {
    defaultSize: 32,
    stylePrompt: "glowing energy effect, motion blur, dynamic",
  },
  item: {
    defaultSize: 32,
    stylePrompt: "collectible item, slight glow effect, clean design",
  },
  effect: {
    defaultSize: 64,
    stylePrompt: "visual effect, particle-like, ethereal",
  },
  ui: {
    defaultSize: 48,
    stylePrompt: "clean icon design, simple shapes, high contrast",
  },
  generic: {
    defaultSize: 64,
    stylePrompt: "game asset design, centered composition",
  },
};

const ANIMATION_CONFIGS: Record<AnimationType, AnimationConfig> = {
  idle: {
    defaultFrames: 4,
    frameDescriptions: [
      "idle frame 1: neutral stance, body relaxed, eyes open normally",
      "idle frame 2: body squished DOWN slightly (compressed), eyes half-closed",
      "idle frame 3: body stretched UP slightly (extended), eyes wide open",
      "idle frame 4: body tilted slightly to the right, normal eyes",
    ],
  },
  walk: {
    defaultFrames: 6,
    frameDescriptions: [
      "walking pose, left foot forward, right arm forward",
      "walking pose, feet passing, body centered",
      "walking pose, right foot forward, left arm forward",
      "walking pose, right foot planted, pushing off",
      "walking pose, feet passing, body centered",
      "walking pose, left foot forward, completing stride",
    ],
  },
  run: {
    defaultFrames: 6,
    frameDescriptions: [
      "running pose, left foot forward extended, right arm forward, dynamic lean",
      "running pose, airborne, both feet off ground, arms pumping",
      "running pose, right foot landing, left arm forward",
      "running pose, right foot planted, pushing off powerfully",
      "running pose, airborne, both feet off ground, arms pumping",
      "running pose, left foot landing, completing cycle",
    ],
  },
  attack: {
    defaultFrames: 4,
    frameDescriptions: [
      "attack windup pose, weapon/arm pulled back, body coiled",
      "attack mid-swing, weapon/arm moving forward, body rotating",
      "attack impact pose, weapon/arm fully extended, maximum reach",
      "attack recovery pose, returning to neutral, follow-through",
    ],
  },
  hit: {
    defaultFrames: 3,
    frameDescriptions: [
      "hit reaction, flinching backward, pain expression",
      "hit stagger, off-balance, arms out",
      "recovering from hit, regaining balance",
    ],
  },
  death: {
    defaultFrames: 4,
    frameDescriptions: [
      "death start, clutching wound, stumbling",
      "death falling, knees buckling, falling backward",
      "death collapse, hitting ground, limbs sprawled",
      "death final, lying still on ground, motionless",
    ],
  },
  cast: {
    defaultFrames: 4,
    frameDescriptions: [
      "spell charge, hands gathering energy, glowing particles",
      "spell buildup, energy intensifying, arms raised",
      "spell release, energy burst outward, arms thrust forward",
      "spell recovery, energy dissipating, returning to stance",
    ],
  },
  jump: {
    defaultFrames: 4,
    frameDescriptions: [
      "jump crouch, bending knees, preparing to launch",
      "jump launch, legs extended, arms up, leaving ground",
      "jump apex, body at peak height, arms spread",
      "jump landing, legs bent absorbing impact, arms out for balance",
    ],
  },
};

interface GenerateSpriteOptions {
  prompt: string;
  type: SpriteType;
  size?: number;
  outputPath?: string;
  style?: string;
  animation?: AnimationType;
  frames?: number;
  clean?: boolean;
}

// Background removal constants
// Chroma key color: Magenta #FF00FF - requested in prompts for easy removal
const CHROMA_KEY = { r: 255, g: 0, b: 255 };

const COMMON_BG_COLORS = [
  { r: 255, g: 0, b: 255 }, // Magenta (primary chroma key)
  { r: 255, g: 0, b: 254 }, // Near-magenta variations
  { r: 254, g: 0, b: 255 },
  { r: 204, g: 204, b: 204 }, // Light gray checkerboard
  { r: 153, g: 153, b: 153 }, // Dark gray checkerboard
  { r: 192, g: 192, b: 192 }, // Silver
  { r: 128, g: 128, b: 128 }, // Gray
  { r: 255, g: 255, b: 255 }, // White
  { r: 240, g: 240, b: 240 }, // Off-white
];

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

function isBackgroundColor(r: number, g: number, b: number, tolerance: number): boolean {
  for (const bg of COMMON_BG_COLORS) {
    if (colorDistance(r, g, b, bg.r, bg.g, bg.b) <= tolerance) {
      return true;
    }
  }
  const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
  return isGray && r > 120 && r < 220;
}

async function resizeToTargetSize(inputPath: string, targetSize: number): Promise<void> {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Only resize if current size is different from target
  if (metadata.width !== targetSize || metadata.height !== targetSize) {
    await sharp(inputPath)
      .resize(targetSize, targetSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(inputPath + ".tmp");
    fs.renameSync(inputPath + ".tmp", inputPath);
  }
}

async function removeBackground(inputPath: string, tolerance = 30): Promise<void> {
  const image = sharp(inputPath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const newData = Buffer.from(data);
  let magentaRemoved = 0;
  let otherRemoved = 0;

  // First pass: Remove all magenta pixels (chroma key) directly - no flood fill needed
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    // Check for magenta and near-magenta (high R, low G, high B)
    const isMagenta =
      colorDistance(r, g, b, CHROMA_KEY.r, CHROMA_KEY.g, CHROMA_KEY.b) <= 80 ||
      (r > 180 && g < 120 && b > 180) || // Magenta-ish
      (r > 200 && g < 80 && b > 200); // Strong magenta
    if (isMagenta) {
      newData[i + 3] = 0;
      magentaRemoved++;
    }
  }

  // If magenta was found and removed, we're done
  if (magentaRemoved > 100) {
    console.log(`    Removed ${magentaRemoved} magenta pixels (chroma key)`);
  } else {
    // Fallback: flood fill from edges for gray/checkerboard backgrounds
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

      if (
        colorDistance(r, g, b, bgR, bgG, bgB) <= tolerance ||
        isBackgroundColor(r, g, b, tolerance)
      ) {
        newData[idx + 3] = 0;
        otherRemoved++;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    console.log(`    Removed ${otherRemoved} background pixels (flood fill)`);
  }

  await sharp(newData, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(inputPath + ".tmp");
  fs.renameSync(inputPath + ".tmp", inputPath);
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

function buildSpritePrompt(options: GenerateSpriteOptions, frameDescription?: string): string {
  const config = SPRITE_CONFIGS[options.type];
  const style = options.style || "pixel art";
  const size = options.size || config.defaultSize;

  const poseDescription = frameDescription
    ? `Pose: ${frameDescription}.`
    : "Pose: idle stance facing right.";

  const basePrompt = [
    `Create a ${style} game sprite of: ${options.prompt}.`,
    `Style: ${config.stylePrompt}.`,
    poseDescription,
    "CRITICAL Requirements:",
    "- Solid magenta background (#FF00FF) - NOT transparent, NOT checkerboard, NOT gradient",
    "- BLACK OUTLINE/BORDER around the entire sprite (1-2 pixels thick)",
    "- NO anti-aliasing, NO blending, NO smooth edges - sharp pixel edges only",
    "- Hard pixel edges between sprite and magenta background",
    "- Single sprite, centered in frame",
    "- IMPORTANT: Sprite must FILL the entire canvas - use 90-95% of available space",
    "- NO excessive margins or padding - the sprite should be LARGE and prominent",
    "- Maximize sprite size within the frame bounds",
    "- Do not use any magenta/pink colors in the sprite",
    "- Classic retro pixel art style with crisp edges",
    `- Target size: ${size}x${size} pixels`,
  ].join(" ");

  return basePrompt;
}

async function callGeminiAPI(prompt: string, referenceImage?: Buffer): Promise<Buffer> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  // Build parts array - optionally include reference image
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: referenceImage.toString("base64"),
      },
    });
    parts.push({
      text: `REFERENCE IMAGE ABOVE - Keep the SAME character design, colors, and style.

TASK: Create a DIFFERENT animation frame showing this EXACT same character but in a NEW POSE.
- MUST change the pose/position as described below
- Keep identical: colors, outfit, face design, body proportions, art style
- Change: body position, limb positions, expression details

NEW POSE REQUIRED: ${prompt}`,
    });
  } else {
    parts.push({ text: prompt });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  console.log(`  URL: ${apiUrl}`);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY!,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    console.error("Gemini API Network Error:");
    console.error(`  URL: ${apiUrl}`);
    console.error(`  Error: ${fetchError instanceof Error ? fetchError.message : fetchError}`);
    if (fetchError instanceof Error && fetchError.cause) {
      console.error(`  Cause: ${JSON.stringify(fetchError.cause, null, 2)}`);
    }
    throw fetchError;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API Error Details:");
    console.error(`  Status: ${response.status} ${response.statusText}`);
    console.error(
      `  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`,
    );
    console.error(`  Body: ${errorText}`);
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const responseParts = data.candidates?.[0]?.content?.parts;
  if (!responseParts) {
    throw new Error("No content in response");
  }

  const imagePart = responseParts.find((part) => part.inlineData?.mimeType?.startsWith("image/"));
  if (!imagePart?.inlineData) {
    const textPart = responseParts.find((part) => part.text);
    if (textPart?.text) {
      console.log("Model response:", textPart.text);
    }
    throw new Error("No image data in response");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function generateSprite(options: GenerateSpriteOptions): Promise<string[]> {
  const { prompt, type, outputPath, animation, frames, clean } = options;
  const config = SPRITE_CONFIGS[type];
  const size = options.size || config.defaultSize;

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Add it to your .env file.");
  }

  const timestamp = Date.now();
  const safeName = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);
  const savedPaths: string[] = [];

  // If animation is specified, generate multiple frames
  if (animation) {
    const animConfig = ANIMATION_CONFIGS[animation];
    const frameCount = frames || animConfig.defaultFrames;
    const frameDescriptions = animConfig.frameDescriptions;

    console.log(`Generating ${type} sprite animation: ${animation}`);
    console.log(`  Description: "${prompt}"`);
    console.log(`  Size: ${size}x${size}`);
    console.log(`  Frames: ${frameCount}`);
    console.log(`  Model: ${MODEL}`);

    // Create output directory for animation frames
    const baseDir = outputPath
      ? path.dirname(outputPath)
      : path.join("assets", "sprites", type, `${safeName}_${animation}_${timestamp}`);

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Generate each frame - use first frame as reference for consistency
    let referenceFrame: Buffer | undefined;

    for (let i = 0; i < frameCount; i++) {
      const frameDesc = frameDescriptions[i % frameDescriptions.length];
      console.log(`\n  Generating frame ${i + 1}/${frameCount}: ${frameDesc.slice(0, 50)}...`);

      const fullPrompt = buildSpritePrompt(options, frameDesc);

      // First frame: generate fresh. Subsequent frames: use first frame as reference
      const imageBuffer = await callGeminiAPI(fullPrompt, i > 0 ? referenceFrame : undefined);

      // Store first frame as reference for subsequent frames
      if (i === 0) {
        referenceFrame = imageBuffer;
        console.log(`    (Using as reference for subsequent frames)`);
      }

      const framePath = path.join(baseDir, `frame_${String(i).padStart(2, "0")}.png`);
      fs.writeFileSync(framePath, imageBuffer);
      savedPaths.push(framePath);
      console.log(`    Saved: ${framePath}`);

      if (clean) {
        await removeBackground(framePath);
        console.log(`    Cleaned: background removed`);
      }

      // Resize to target size (AI generates 1024x1024 regardless of prompt)
      await resizeToTargetSize(framePath, size);
      console.log(`    Resized to: ${size}x${size}px`);

      // Small delay to avoid rate limiting
      if (i < frameCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`\nAnimation frames saved to: ${baseDir}/`);
  } else {
    // Single sprite generation
    console.log(`Generating ${type} sprite...`);
    console.log(`  Description: "${prompt}"`);
    console.log(`  Size: ${size}x${size}`);
    console.log(`  Model: ${MODEL}`);

    const fullPrompt = buildSpritePrompt(options);
    console.log(`  Full prompt: "${fullPrompt.slice(0, 100)}..."`);

    const imageBuffer = await callGeminiAPI(fullPrompt);

    const defaultPath = path.join("assets", "sprites", type, `${safeName}_${timestamp}.png`);
    const finalOutputPath = outputPath || defaultPath;

    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(finalOutputPath, imageBuffer);
    savedPaths.push(finalOutputPath);
    console.log(`Sprite saved to: ${finalOutputPath}`);

    if (clean) {
      await removeBackground(finalOutputPath);
      console.log(`Background removed: true transparency applied`);
    }

    // Resize to target size (AI generates 1024x1024 regardless of prompt)
    await resizeToTargetSize(finalOutputPath, size);
    console.log(`Resized to: ${size}x${size}px`);
  }

  return savedPaths;
}

function printUsage(): void {
  console.log(`
Usage: pnpm run generate-sprite <description> [options]

Arguments:
  description    What the sprite should depict (required)

Options:
  --type, -t     Sprite type: player, enemy, boss, projectile, item, effect, ui, generic
                 (default: generic)
  --size, -s     Sprite size in pixels (default: varies by type)
  --style        Art style: "pixel art", "hand-drawn", "vector", etc.
                 (default: "pixel art")
  --output, -o   Output file/directory path
                 (default: assets/sprites/<type>/<name>_<timestamp>.png)
  --anim, -a     Animation type: idle, walk, run, attack, hit, death, cast, jump
                 When specified, generates multiple frames
  --frames, -f   Number of animation frames (default: varies by animation type)
  --clean, -c    Remove checkerboard background for true transparency

Sprite Types & Default Sizes:
  player      64px   Hero characters
  enemy       64px   Standard enemies
  boss       128px   Boss enemies
  projectile  32px   Bullets, arrows, spells
  item        32px   Collectibles, pickups
  effect      64px   Visual effects, particles
  ui          48px   Interface icons
  generic     64px   Other game assets

Animation Types & Default Frames:
  idle        4 frames   Breathing/subtle movement
  walk        6 frames   Walking cycle
  run         6 frames   Running cycle
  attack      4 frames   Attack swing/action
  hit         3 frames   Damage reaction
  death       4 frames   Death sequence
  cast        4 frames   Spell casting
  jump        4 frames   Jump arc

Examples:
  # Single sprites with auto background removal
  pnpm run generate-sprite "archer with bow" --type player --clean
  pnpm run generate-sprite "red slime monster" --type enemy --size 48 --clean
  pnpm run generate-sprite "golden arrow" --type projectile -c

  # Animation sequences with clean backgrounds
  pnpm run generate-sprite "knight warrior" --type player --anim idle --clean
  pnpm run generate-sprite "goblin" --type enemy --anim walk --frames 8 -c
  pnpm run generate-sprite "wizard" --type player --anim attack --style "hand-drawn"
  pnpm run generate-sprite "skeleton" --type enemy --anim death --clean
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  let prompt = "";
  let type: SpriteType = "generic";
  let size: number | undefined;
  let style: string | undefined;
  let outputPath: string | undefined;
  let animation: AnimationType | undefined;
  let frames: number | undefined;
  let clean = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--type" || arg === "-t") {
      const typeArg = args[++i] as SpriteType;
      if (SPRITE_CONFIGS[typeArg]) {
        type = typeArg;
      } else {
        console.error(
          `Invalid type: ${typeArg}. Valid types: ${Object.keys(SPRITE_CONFIGS).join(", ")}`,
        );
        process.exit(1);
      }
    } else if (arg === "--size" || arg === "-s") {
      size = parseInt(args[++i]);
      if (isNaN(size) || size < 16 || size > 1024) {
        console.error("Size must be a number between 16 and 1024");
        process.exit(1);
      }
    } else if (arg === "--style") {
      style = args[++i];
    } else if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (arg === "--anim" || arg === "-a") {
      const animArg = args[++i] as AnimationType;
      if (ANIMATION_CONFIGS[animArg]) {
        animation = animArg;
      } else {
        console.error(
          `Invalid animation: ${animArg}. Valid animations: ${Object.keys(ANIMATION_CONFIGS).join(", ")}`,
        );
        process.exit(1);
      }
    } else if (arg === "--frames" || arg === "-f") {
      frames = parseInt(args[++i]);
      if (isNaN(frames) || frames < 1 || frames > 16) {
        console.error("Frames must be a number between 1 and 16");
        process.exit(1);
      }
    } else if (arg === "--clean" || arg === "-c") {
      clean = true;
    } else if (!arg.startsWith("-")) {
      prompt = arg;
    }
    i++;
  }

  if (!prompt) {
    console.error("Error: Sprite description is required");
    printUsage();
    process.exit(1);
  }

  try {
    await generateSprite({ prompt, type, size, style, outputPath, animation, frames, clean });
  } catch (error) {
    console.error("Error generating sprite:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

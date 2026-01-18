/**
 * Centralized style definitions for asset generation
 * Ensures visual consistency across all generated assets
 */

// Base style applied to ALL generated assets
export const BASE_STYLE = {
  artStyle: "pixel art",
  outline: "1-2 pixel black outline/border around the entire sprite",
  edges: "sharp pixel edges, no anti-aliasing, no blending, no smooth edges",
  composition: "single subject, centered in frame, fills 90-95% of canvas",
  shadows: "consistent shadow direction (bottom-right)",
  colors: "vibrant fantasy color palette",
} as const;

// Asset-type specific style additions
export const ASSET_TYPE_STYLES = {
  player: {
    mood: "heroic character design",
    details: "clear readable silhouette, distinct features",
  },
  enemy: {
    mood: "menacing creature design",
    details: "threatening appearance, aggressive stance",
  },
  boss: {
    mood: "large intimidating boss creature",
    details: "imposing presence, detailed features, powerful appearance",
  },
  projectile: {
    mood: "glowing energy effect",
    details: "motion blur, dynamic, directional",
  },
  item: {
    mood: "collectible item",
    details: "slight glow effect, clean design, easily recognizable",
  },
  effect: {
    mood: "visual effect",
    details: "particle-like, ethereal, translucent elements",
  },
  ui: {
    mood: "clean icon design",
    details: "simple shapes, high contrast, readable at small sizes",
  },
  abilities: {
    mood: "game ability sprite",
    details: "the effect or symbol itself, glowing magical look, NO UI frame or button around it",
  },
  equipment: {
    mood: "equipment item icon",
    details: "detailed gear piece, slight shine, quality appearance",
  },
  chest: {
    mood: "treasure chest",
    details: "wooden chest with metal details, slightly open or closed",
  },
  door: {
    mood: "dungeon door or portal",
    details: "architectural element, mysterious entrance",
  },
  generic: {
    mood: "game asset design",
    details: "clear composition, game-ready appearance",
  },
} as const;

// Style presets for themed content
export const STYLE_PRESETS = {
  default: {
    colorModifier: "",
    moodModifier: "",
  },
  dark: {
    colorModifier: "dark and muted color palette with deep shadows",
    moodModifier: "dark fantasy atmosphere",
  },
  fire: {
    colorModifier: "warm fire colors - reds, oranges, yellows with embers",
    moodModifier: "fiery and intense",
  },
  ice: {
    colorModifier: "cool ice colors - blues, whites, cyans with frost effects",
    moodModifier: "frozen and crystalline",
  },
  nature: {
    colorModifier: "natural greens, browns, earthy tones",
    moodModifier: "organic and forest-themed",
  },
  shadow: {
    colorModifier: "purples, blacks, with ethereal dark wisps",
    moodModifier: "shadowy and mysterious",
  },
  holy: {
    colorModifier: "golds, whites, bright yellows with divine glow",
    moodModifier: "radiant and blessed",
  },
} as const;

export type AssetType = keyof typeof ASSET_TYPE_STYLES;
export type StylePreset = keyof typeof STYLE_PRESETS;

// Icon types that should NOT have thick black outlines
const ICON_TYPES: AssetType[] = ["abilities", "ui", "equipment", "item"];

// Character types that need pose instructions
const CHARACTER_TYPES: AssetType[] = ["player", "enemy", "boss"];

/**
 * Check if asset type is an icon (no outline needed)
 */
export function isIconType(assetType: AssetType): boolean {
  return ICON_TYPES.includes(assetType);
}

/**
 * Check if asset type is a character (needs pose)
 */
export function isCharacterType(assetType: AssetType): boolean {
  return CHARACTER_TYPES.includes(assetType);
}

/**
 * Build a complete style prompt for asset generation
 */
export function buildStylePrompt(
  assetType: AssetType,
  preset: StylePreset = "default"
): string {
  const typeStyle = ASSET_TYPE_STYLES[assetType];
  const presetStyle = STYLE_PRESETS[preset];

  const parts = [
    `Style: ${BASE_STYLE.artStyle}, ${typeStyle.mood}`,
    typeStyle.details,
  ];

  // Only add outline for non-icon types
  if (!isIconType(assetType)) {
    parts.push(BASE_STYLE.outline);
  }

  parts.push(BASE_STYLE.edges);
  parts.push(BASE_STYLE.composition);
  parts.push(BASE_STYLE.shadows);
  parts.push(BASE_STYLE.colors);

  if (presetStyle.colorModifier) {
    parts.push(presetStyle.colorModifier);
  }
  if (presetStyle.moodModifier) {
    parts.push(presetStyle.moodModifier);
  }

  return parts.join(". ");
}

/**
 * Build the full generation prompt for a sprite
 */
export function buildSpritePrompt(
  description: string,
  assetType: AssetType,
  poseDescription?: string,
  preset: StylePreset = "default"
): string {
  const stylePrompt = buildStylePrompt(assetType, preset);

  // Different prompts for icons vs characters
  if (isIconType(assetType)) {
    return [
      `Create a pixel art sprite of: ${description}.`,
      stylePrompt,
      "",
      "CRITICAL REQUIREMENTS:",
      "- Output MUST be a SQUARE image (1:1 aspect ratio)",
      "- Just the object/effect itself - NO frame, NO button, NO UI container",
      "- The sprite should fill 80-90% of the canvas",
      "- Simple pixel art style with clean edges",
      "- NO thick black outlines",
      "- Vibrant colors, slight glow effects are OK",
      "- Think: game sprite of the object, not a UI button",
    ].join("\n");
  }

  // Character sprites
  const pose = poseDescription || "idle stance facing right";

  return [
    `Create a ${BASE_STYLE.artStyle} game sprite of: ${description}.`,
    stylePrompt,
    `Pose: ${pose}.`,
    "",
    "CRITICAL SIZE REQUIREMENTS:",
    "- Output MUST be a SQUARE image (1:1 aspect ratio)",
    "- The ENTIRE character must be visible - do NOT crop or cut off any body parts",
    "- The character should fill 85-95% of the canvas height",
    "- Leave only a tiny margin (5-10%) around the character",
    "- Head must be fully visible near the top, feet fully visible near the bottom",
    "- The character should be as LARGE as possible while staying FULLY visible",
    "- NO excessive empty space - minimize padding while keeping character complete",
    "",
    "Style requirements:",
    "- Clean pixel art with 1-2 pixel black outline",
    "- Single sprite, centered",
    "- Classic retro pixel art style with crisp edges",
  ].join("\n");
}

/**
 * Build a prompt for background/texture images
 */
export function buildImagePrompt(
  description: string,
  width: number,
  height: number
): string {
  return [
    `Generate an image: ${description}.`,
    `Target aspect ratio approximately ${width}x${height} pixels.`,
    "Style: detailed game art, suitable for game background or texture.",
    "IMPORTANT: The subject must FILL the entire canvas with minimal margins.",
    "Make the composition large and prominent, filling the available space.",
  ].join("\n");
}

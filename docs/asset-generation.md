# Asset Generation

The project includes AI-powered scripts for generating game art assets using Google's Gemini API. All generated assets have transparent backgrounds (PNG) and are optimized for game use.

## Requirements

- Set `GEMINI_API_KEY` in `.env` file
- Optionally set `GEMINI_MODEL` (default: `gemini-2.0-flash-exp`)
- Run `pnpm install` to install dependencies

## Unified CLI

All asset generation is handled through a single unified command:

```bash
pnpm run generate <command> [options]
```

### Commands

| Command    | Description                              |
| ---------- | ---------------------------------------- |
| `sprite`   | Generate a pixel art game sprite         |
| `image`    | Generate a background or texture image   |
| `optimize` | Optimize all assets in public/assets     |
| `clean`    | Remove background from existing image(s) |
| `help`     | Show help message                        |

## Sprite Generation

```bash
pnpm run generate sprite <description> [options]
```

### Options

| Option           | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `--type, -t`     | Sprite type: `player`, `enemy`, `boss`, `projectile`, `item`, `effect`, `ui`, `generic`  |
| `--size, -s`     | Sprite size in pixels (default varies by type)                                           |
| `--preset, -p`   | Style preset: `default`, `dark`, `fire`, `ice`, `nature`, `shadow`, `holy`               |
| `--output, -o`   | Output file path                                                                         |
| `--clean, -c`    | **Recommended:** Remove background for true PNG transparency                             |

### Sprite Types & Default Sizes

| Type         | Size  | Use Case                  |
| ------------ | ----- | ------------------------- |
| `player`     | 64px  | Hero characters           |
| `enemy`      | 64px  | Standard enemies          |
| `boss`       | 128px | Boss enemies              |
| `projectile` | 32px  | Bullets, arrows, spells   |
| `item`       | 32px  | Collectibles, pickups     |
| `effect`     | 64px  | Visual effects, particles |
| `ui`         | 48px  | Interface icons           |

### Sprite Examples

```bash
pnpm run generate sprite "archer with bow" --type player --clean
pnpm run generate sprite "red slime monster" --type enemy --clean
pnpm run generate sprite "golden arrow" --type projectile -c
pnpm run generate sprite "health potion" --type item --clean
pnpm run generate sprite "fire dragon" --type boss --size 128 -c
pnpm run generate sprite "ice golem" --type boss --preset ice --clean
```

### Style Presets

Style presets modify the color palette and mood of generated sprites:

| Preset    | Description                              |
| --------- | ---------------------------------------- |
| `default` | Standard vibrant fantasy colors          |
| `dark`    | Dark and muted colors, deep shadows      |
| `fire`    | Warm fire colors - reds, oranges, embers |
| `ice`     | Cool ice colors - blues, whites, frost   |
| `nature`  | Natural greens, browns, earthy tones     |
| `shadow`  | Purples, blacks, ethereal wisps          |
| `holy`    | Golds, whites, divine glow               |

## Image Generation

```bash
pnpm run generate image <description> [options]
```

### Options

| Option         | Description                                 |
| -------------- | ------------------------------------------- |
| `--size`       | Image size as WxH (default: 512x512)        |
| `--output, -o` | Output file path                            |
| `--background` | Resize to game background dimensions (375x667) |

### Image Examples

```bash
pnpm run generate image "dark dungeon floor texture"
pnpm run generate image "forest background" --size 1024x768
pnpm run generate image "mystic cave" --background
pnpm run generate image "stone wall texture" --output assets/backgrounds/stone.png
```

## Background Removal

The `clean` command removes backgrounds from existing images using ML-based detection:

```bash
pnpm run generate clean <path>
```

### Examples

```bash
# Remove background from single image
pnpm run generate clean public/assets/sprites/enemy/slime.png

# Process multiple images with glob pattern
pnpm run generate clean "public/assets/sprites/player/*.png"
```

The ML-based background removal uses the `@imgly/background-removal-node` library which provides accurate subject detection regardless of background color.

## Asset Optimization

Optimize all assets in `public/assets`:

```bash
pnpm run generate optimize [--dry]
```

Options:
- `--dry, -d`: Preview changes without modifying files

This command:
- Resizes oversized images to appropriate game sizes
- Compresses images for optimal file size
- Uses nearest-neighbor interpolation for pixel art sprites
- Uses Lanczos interpolation for backgrounds

## Asset Organization

Generated assets are automatically organized:

```
assets/
├── generated/           # Generic images
├── sprites/
│   ├── player/          # Player sprites
│   ├── enemy/           # Enemy sprites
│   ├── boss/            # Boss sprites
│   ├── projectile/      # Bullet/arrow sprites
│   ├── item/            # Collectible sprites
│   ├── effect/          # Visual effect sprites
│   └── ui/              # UI icons
```

## Architecture

The unified asset generation system uses a modular architecture:

```
scripts/
├── generate-asset.ts           # Main CLI entry point
├── lib/
│   ├── api/
│   │   └── gemini.ts           # Shared Gemini API client
│   ├── config/
│   │   ├── styles.ts           # Centralized style definitions
│   │   └── sizes.ts            # Asset size configurations
│   ├── generators/
│   │   ├── sprite.ts           # Sprite generation
│   │   └── image.ts            # Background/texture generation
│   └── processing/
│       ├── background-removal.ts  # ML-based background removal
│       ├── resize.ts           # Image resizing utilities
│       └── optimize.ts         # Asset optimization
```

## Best Practices

1. **Always use `--clean`**: Use `--clean` or `-c` for true transparency on sprites
2. **Auto-resize**: The script automatically resizes sprites to target size (AI generates 1024x1024)
3. **Use presets**: Style presets ensure visual consistency for themed content
4. **Naming**: Use descriptive prompts that include key visual features
5. **Review**: AI generation can vary - regenerate if needed
6. **IMPORTANT - Resize images**: AI generates 1024px+ images that will cover the entire screen if not resized
7. **Update encyclopedia**: When adding new content, always update `src/config/encyclopediaData.ts`

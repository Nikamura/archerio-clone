# Asset Generation

The project includes AI-powered scripts for generating game art assets using Google's Gemini API. All generated assets have transparent backgrounds (PNG) and are optimized for game use.

## Requirements

- Set `GEMINI_API_KEY` in `.env` file
- Optionally set `GEMINI_MODEL` (default: `gemini-2.0-flash-exp`)

## Generic Image Generation

```bash
pnpm run generate-image <prompt> [width] [height] [--output <path>]
```

Use for backgrounds, UI elements, and non-sprite assets:

```bash
# Examples
pnpm run generate-image "dark dungeon stone floor texture" 512 512
pnpm run generate-image "forest background parallax layer" 1024 768
pnpm run generate-image "treasure chest icon" 64 64 --output assets/ui/chest.png
```

## Sprite Generation

```bash
pnpm run generate-sprite <description> [options]
```

### Options

| Option         | Description                                                                             |
| -------------- | --------------------------------------------------------------------------------------- |
| `--type, -t`   | Sprite type: `player`, `enemy`, `boss`, `projectile`, `item`, `effect`, `ui`, `generic` |
| `--size, -s`   | Sprite size in pixels (default varies by type)                                          |
| `--style`      | Art style: `"pixel art"`, `"hand-drawn"`, `"vector"` (default: pixel art)               |
| `--output, -o` | Output file/directory path                                                              |
| `--anim, -a`   | Animation type for multi-frame generation                                               |
| `--frames, -f` | Number of animation frames                                                              |
| `--clean, -c`  | **Recommended:** Remove background for true PNG transparency                            |

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

### Single Sprite Examples

```bash
pnpm run generate-sprite "archer with bow" --type player --clean
pnpm run generate-sprite "red slime monster" --type enemy --clean
pnpm run generate-sprite "golden arrow" --type projectile -c
pnpm run generate-sprite "health potion" --type item --clean
pnpm run generate-sprite "fire dragon" --type boss --size 128 -c
```

## Animation Sequences

Generate multiple frames for animated sprites:

### Animation Types & Default Frames

| Animation | Frames | Description               |
| --------- | ------ | ------------------------- |
| `idle`    | 4      | Breathing/subtle movement |
| `walk`    | 6      | Walking cycle             |
| `run`     | 6      | Running cycle             |
| `attack`  | 4      | Attack swing/action       |
| `hit`     | 3      | Damage reaction           |
| `death`   | 4      | Death sequence            |
| `cast`    | 4      | Spell casting             |
| `jump`    | 4      | Jump arc                  |

### Animation Examples

```bash
# Generate walk animation for player (6 frames) with clean backgrounds
pnpm run generate-sprite "knight warrior" --type player --anim walk --clean

# Generate idle animation for enemy (4 frames)
pnpm run generate-sprite "green slime" --type enemy --anim idle -c

# Generate attack animation with custom frame count
pnpm run generate-sprite "wizard" --type player --anim attack --frames 6 --clean

# Generate death animation
pnpm run generate-sprite "skeleton" --type enemy --anim death -c
```

Animation frames are saved to: `assets/sprites/<type>/<name>_<anim>_<timestamp>/frame_XX.png`

## Background Removal (Standalone)

For existing images with checkerboard/solid backgrounds:

```bash
pnpm run remove-bg <image-path> [--tolerance <0-255>] [--output <path>]
```

### Examples

```bash
# Remove background from single image
pnpm run remove-bg assets/sprites/enemy/slime.png

# Process multiple images with glob pattern
pnpm run remove-bg "assets/sprites/player/*.png" --tolerance 40

# Custom output path
pnpm run remove-bg image.png --output clean.png
```

The tolerance option (default: 35) controls how aggressively similar colors are removed. Higher values remove more.

## Asset Organization

Generated assets are automatically organized:

```
assets/
├── generated/           # Generic images
├── sprites/
│   ├── player/          # Player sprites & animations
│   ├── enemy/           # Enemy sprites & animations
│   ├── boss/            # Boss sprites & animations
│   ├── projectile/      # Bullet/arrow sprites
│   ├── item/            # Collectible sprites
│   ├── effect/          # Visual effect sprites
│   └── ui/              # UI icons
```

## Best Practices

1. **Always use `--clean`**: AI generates fake checkerboard backgrounds, use `--clean` or `-c` for true transparency
2. **Auto-resize**: The script automatically resizes sprites to target size (AI generates 1024x1024, script resizes to type default)
3. **Consistency**: Generate all sprites for a character type in one session to maintain visual consistency
4. **Naming**: Use descriptive prompts that include key visual features
5. **Review**: AI generation can vary - regenerate if needed
6. **Animation**: For smooth animations, generate more frames and remove duplicates
7. **Style**: Specify art style consistently across all assets (e.g., always use "pixel art")
8. **IMPORTANT - Resize images**: AI generates 1024px+ images that will cover the entire screen if not resized
9. **Update encyclopedia**: When adding new enemies, bosses, abilities, or game mechanics, always update `src/config/encyclopediaData.ts`
10. **Add localStorage persistence**: Any new manager must implement `saveToStorage()` and `loadFromStorage()` methods

import Phaser from "phaser";
import { audioManager } from "../../systems/AudioManager";
import { THEME_ASSETS, THEME_COLORS } from "../../config/themeData";
import { applyButtonEffects } from "../../systems/UIAnimations";
import { ChapterSelectPanel } from "./ChapterSelectPanel";
import { DifficultyPanel } from "./DifficultyPanel";
import { createModeButtonBar, GameMode } from "../../ui/components/ModeButtonBar";

export interface PlaySectionConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  onPlay: (mode: GameMode) => void;
  depth?: number;
}

export interface PlaySectionResult {
  container: Phaser.GameObjects.Container;
  getSelectedMode: () => GameMode;
  destroy: () => void;
}

/**
 * PlaySection - Contains mode buttons, chapter selector, difficulty selector, and PLAY button
 */
export function createPlaySection(config: PlaySectionConfig): PlaySectionResult {
  const { scene, x, y, width, onPlay, depth = 10 } = config;

  const container = scene.add.container(x, y);
  container.setDepth(depth);

  let currentMode: GameMode = "story";

  // Mode button bar (Story | Endless | Daily)
  const modeButtonBar = createModeButtonBar({
    scene,
    x: 0,
    y: 0,
    initialMode: "story",
    onModeChange: (mode) => {
      currentMode = mode;
    },
    depth,
  });
  container.add(modeButtonBar.container);

  // Chapter panel - visible only in story mode
  const chapterPanel = new ChapterSelectPanel({
    scene,
    x: 0,
    y: 55,
    width,
  });
  container.add(chapterPanel.getContainer());

  // Difficulty panel - below chapters
  const difficultyPanel = new DifficultyPanel({
    scene,
    x: 0,
    y: 130,
    game: scene.game,
  });
  container.add(difficultyPanel.getContainer());

  // PLAY button
  const playButtonKey = THEME_ASSETS.playButton;
  const playButtonY = 200;

  // Check if texture exists, fallback to text button if not
  let playButton: Phaser.GameObjects.Image | Phaser.GameObjects.Text;

  if (scene.textures.exists(playButtonKey)) {
    playButton = scene.add.image(0, playButtonY, playButtonKey);
    playButton.setDisplaySize(220, 66);
  } else {
    // Fallback to text-based button
    playButton = scene.add.text(0, playButtonY, "PLAY", {
      fontSize: "32px",
      color: "#ffffff",
      backgroundColor: `#${THEME_COLORS.primaryButton.toString(16).padStart(6, "0")}`,
      padding: { x: 70, y: 22 },
      fontStyle: "bold",
    });
  }

  playButton.setOrigin(0.5);
  playButton.setInteractive({ useHandCursor: true });
  container.add(playButton);

  applyButtonEffects(scene, playButton, {
    scaleOnHover: 1.05,
    scaleOnPress: 0.95,
  });

  playButton.on("pointerdown", () => {
    audioManager.playGameStart();
    onPlay(currentMode);
  });

  const getSelectedMode = () => currentMode;

  const destroy = () => {
    chapterPanel.destroy();
    difficultyPanel.destroy();
    modeButtonBar.destroy();
    container.destroy();
  };

  return {
    container,
    getSelectedMode,
    destroy,
  };
}

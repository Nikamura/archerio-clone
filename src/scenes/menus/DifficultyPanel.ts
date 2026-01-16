/**
 * DifficultyPanel - Reusable difficulty selection component
 *
 * Displays difficulty buttons and handles selection.
 */

import Phaser from "phaser";
import {
  DifficultyLevel,
  DIFFICULTY_CONFIGS,
  setDifficulty,
  getCurrentDifficulty,
} from "../../config/difficulty";
import { audioManager } from "../../systems/AudioManager";
import { saveManager } from "../../systems/SaveManager";

export interface DifficultyPanelConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  game: Phaser.Game;
  onDifficultySelect?: (difficulty: DifficultyLevel) => void;
}

interface DifficultyButtonData {
  button: Phaser.GameObjects.Text;
  difficulty: DifficultyLevel;
}

export class DifficultyPanel {
  private scene: Phaser.Scene;
  private game: Phaser.Game;
  private container: Phaser.GameObjects.Container;
  private buttons: DifficultyButtonData[] = [];
  private selectedDifficulty: DifficultyLevel;
  private onDifficultySelect?: (difficulty: DifficultyLevel) => void;

  private readonly BUTTON_WIDTH = 80;
  private readonly GAP = 10;

  constructor(config: DifficultyPanelConfig) {
    this.scene = config.scene;
    this.game = config.game;
    this.onDifficultySelect = config.onDifficultySelect;
    this.selectedDifficulty = getCurrentDifficulty(config.game);
    this.container = this.scene.add.container(config.x, config.y);

    this.createLabel();
    this.createDifficultyButtons();
  }

  private createLabel(): void {
    const label = this.scene.add.text(0, -15, "DIFFICULTY", {
      fontSize: "14px",
      color: "#aaaaaa",
      stroke: "#000000",
      strokeThickness: 2,
    });
    label.setOrigin(0.5);
    label.setDepth(10);
    this.container.add(label);
  }

  private createDifficultyButtons(): void {
    const difficulties = [
      DifficultyLevel.EASY,
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.INSANITY,
    ];

    const totalWidth =
      this.BUTTON_WIDTH * difficulties.length + this.GAP * (difficulties.length - 1);
    const startX = -totalWidth / 2 + this.BUTTON_WIDTH / 2;

    difficulties.forEach((difficulty, index) => {
      const config = DIFFICULTY_CONFIGS[difficulty];
      const xPos = startX + index * (this.BUTTON_WIDTH + this.GAP);

      const button = this.scene.add.text(xPos, 10, config.label, {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: difficulty === this.selectedDifficulty ? config.color : "#444444",
        padding: { x: 12, y: 8 },
      });
      button.setOrigin(0.5);
      button.setInteractive({ useHandCursor: true });
      button.setDepth(10);

      button.on("pointerover", () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: "#666666" });
        }
      });

      button.on("pointerout", () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: "#444444" });
        }
      });

      button.on("pointerdown", () => {
        audioManager.resume();
        audioManager.playMenuSelect();
        this.selectDifficulty(difficulty);
      });

      this.container.add(button);
      this.buttons.push({ button, difficulty });
    });
  }

  private selectDifficulty(difficulty: DifficultyLevel): void {
    this.selectedDifficulty = difficulty;
    setDifficulty(this.game, difficulty);
    saveManager.setDifficulty(difficulty);

    // Update all button styles
    this.buttons.forEach((btn) => {
      const config = DIFFICULTY_CONFIGS[btn.difficulty];
      btn.button.setStyle({
        backgroundColor: btn.difficulty === difficulty ? config.color : "#444444",
      });
    });

    this.onDifficultySelect?.(difficulty);
  }

  /**
   * Get the currently selected difficulty
   */
  getSelectedDifficulty(): DifficultyLevel {
    return this.selectedDifficulty;
  }

  /**
   * Get the container for positioning
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Set depth
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Destroy the panel
   */
  destroy(): void {
    this.buttons = [];
    this.container.destroy();
  }
}

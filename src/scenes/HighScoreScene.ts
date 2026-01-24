import Phaser from "phaser";
import { saveManager } from "../systems/SaveManager";
import { heroManager } from "../systems/HeroManager";
import { ABILITIES } from "../config/abilityData";
import { fadeInScene, transitionToScene, TransitionType, DURATION } from "../systems/UIAnimations";

/**
 * HighScoreScene - Displays the player's best run details
 *
 * Shows the full game over screen data for the highest score run including:
 * - Date achieved
 * - Score and wave reached
 * - Stats (rooms, enemies, gold, time)
 * - Hero used
 * - All skills acquired during that run
 */
export default class HighScoreScene extends Phaser.Scene {
  constructor() {
    super({ key: "HighScoreScene" });
  }

  create() {
    fadeInScene(this, DURATION.NORMAL);
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Get high score run data
    const highScoreRun = saveManager.getHighScoreRun();

    if (!highScoreRun) {
      // No high score data - shouldn't happen but handle gracefully
      this.showNoDataMessage(width, height);
      return;
    }

    // Dark background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e, 1).setOrigin(0);

    // Title
    this.add
      .text(width / 2, 40, "PERSONAL BEST", {
        fontSize: "28px",
        fontFamily: "Arial",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Date achieved
    const date = new Date(highScoreRun.achievedAt);
    const dateStr = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    this.add
      .text(width / 2, 70, `${dateStr} at ${timeStr}`, {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);

    // Score display (large, prominent)
    this.add
      .text(width / 2, 110, highScoreRun.score.toLocaleString(), {
        fontSize: "42px",
        fontFamily: "Arial",
        color: "#00ff88",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 145, "SCORE", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#666666",
      })
      .setOrigin(0.5);

    // Wave reached
    this.add
      .text(width / 2, 180, `Wave ${highScoreRun.endlessWave}`, {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#ff6b35",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Stats section
    const statsY = 220;
    const lineHeight = 28;

    // Hero used
    const heroState = heroManager.getHeroState(
      highScoreRun.heroId as Parameters<typeof heroManager.getHeroState>[0],
    );
    this.add
      .text(width / 2, statsY, `Hero: ${heroState.name}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#88ccff",
      })
      .setOrigin(0.5);

    // Difficulty
    const difficultyLabel =
      highScoreRun.difficulty.charAt(0).toUpperCase() + highScoreRun.difficulty.slice(1);
    this.add
      .text(width / 2, statsY + lineHeight, `Difficulty: ${difficultyLabel}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Rooms cleared
    this.add
      .text(width / 2, statsY + lineHeight * 2, `Rooms Cleared: ${highScoreRun.roomsCleared}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Enemies killed
    this.add
      .text(width / 2, statsY + lineHeight * 3, `Enemies: ${highScoreRun.enemiesKilled}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Gold earned
    this.add
      .text(width / 2, statsY + lineHeight * 4, `Gold: +${highScoreRun.goldEarned}`, {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#FFD700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Play time
    const playTimeMinutes = Math.floor(highScoreRun.playTimeMs / 60000);
    const playTimeSeconds = Math.floor((highScoreRun.playTimeMs % 60000) / 1000);
    const timeDisplay = `${playTimeMinutes}:${playTimeSeconds.toString().padStart(2, "0")}`;
    this.add
      .text(width / 2, statsY + lineHeight * 5, `Time: ${timeDisplay}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // Skills section
    const skillsY = statsY + lineHeight * 6.5;
    this.displayAcquiredSkills(skillsY, highScoreRun.acquiredAbilities);

    // Back button
    this.createBackButton(height);

    // Keyboard shortcut
    this.input.keyboard?.once("keydown-ESC", () => {
      this.goBack();
    });
  }

  private showNoDataMessage(width: number, height: number) {
    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e, 1).setOrigin(0);

    this.add
      .text(width / 2, height / 2, "No high score data available", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.createBackButton(height);
  }

  private displayAcquiredSkills(startY: number, abilities: { id: string; level: number }[]): void {
    const width = this.cameras.main.width;

    // Section title
    this.add
      .text(width / 2, startY, "BUILD", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    if (abilities.length === 0) {
      this.add
        .text(width / 2, startY + 30, "No skills acquired", {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#666666",
        })
        .setOrigin(0.5);
      return;
    }

    // Display skills in a grid
    const iconSize = 32;
    const iconSpacing = 40;
    const maxPerRow = 8;
    const gridStartY = startY + 35;

    abilities.forEach((acquired, index) => {
      const abilityData = ABILITIES.find((a) => a.id === acquired.id);
      if (!abilityData) return;

      const row = Math.floor(index / maxPerRow);
      const col = index % maxPerRow;

      const itemsInRow = Math.min(maxPerRow, abilities.length - row * maxPerRow);
      const rowWidth = itemsInRow * iconSpacing;
      const rowStartX = (width - rowWidth) / 2 + iconSpacing / 2;

      const x = rowStartX + col * iconSpacing;
      const y = gridStartY + row * (iconSpacing + 8);

      // Icon background
      const iconBg = this.add.rectangle(x, y, iconSize + 4, iconSize + 4, 0x222222);
      iconBg.setStrokeStyle(2, abilityData.color);

      // Icon image or fallback
      if (this.textures.exists(abilityData.iconKey)) {
        this.add.image(x, y, abilityData.iconKey).setDisplaySize(iconSize, iconSize);
      } else {
        this.add.circle(x, y, iconSize / 2 - 2, abilityData.color);
      }

      // Level badge
      if (acquired.level > 1) {
        const badgeX = x + iconSize / 2;
        const badgeY = y + iconSize / 2;
        this.add.circle(badgeX, badgeY, 9, 0x000000, 0.9);
        this.add
          .text(badgeX, badgeY, `${acquired.level}`, {
            fontSize: "11px",
            fontFamily: "Arial",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      }
    });
  }

  private createBackButton(height: number) {
    const width = this.cameras.main.width;
    const buttonWidth = 180;
    const buttonHeight = 45;
    const buttonY = height - 60;

    const button = this.add
      .rectangle(width / 2, buttonY, buttonWidth, buttonHeight, 0x4a9eff)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, buttonY, "BACK", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x6ab0ff));
    button.on("pointerout", () => button.setFillStyle(0x4a9eff));
    button.on("pointerdown", () => this.goBack());
  }

  private goBack() {
    transitionToScene(this, "MainMenuScene", TransitionType.FADE, DURATION.FAST);
  }
}

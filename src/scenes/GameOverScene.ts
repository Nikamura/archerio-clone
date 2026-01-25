import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import { saveManager } from "../systems/SaveManager";
import { DifficultyLevel, DIFFICULTY_CONFIGS } from "../config/difficulty";
import { achievementManager } from "../systems/AchievementManager";
import { currencyManager } from "../systems/CurrencyManager";
import { chestManager } from "../systems/ChestManager";
import { chapterManager, type ChapterCompletionResult } from "../systems/ChapterManager";
import { heroManager } from "../systems/HeroManager";
import type { HeroLevelUpEvent } from "../systems/Hero";
import { debugToast } from "../systems/DebugToast";
import { ABILITIES } from "./LevelUpScene";
import { showMockAdPopup } from "../ui/components/MockAdPopup";
import { showSecondChancePopup } from "../ui/components/SecondChancePopup";
import { errorReporting } from "../systems/ErrorReportingManager";
import {
  calculateChestRewards,
  getTotalChests,
  ChestRewards,
  CHEST_CONFIGS,
  CHEST_ORDER,
  ChestType,
} from "../data/chestData";

export interface AcquiredAbility {
  id: string;
  level: number;
}

/**
 * Saved enemy state for respawn feature
 */
export interface EnemyRespawnState {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: string;
}

/**
 * Room state saved for respawn
 */
export interface RespawnRoomState {
  enemies: EnemyRespawnState[];
  bossHealth?: number;
  bossMaxHealth?: number;
}

export interface GameOverData {
  roomsCleared: number;
  enemiesKilled: number;
  isVictory?: boolean;
  playTimeMs?: number;
  abilitiesGained?: number;
  bossDefeated?: boolean;
  goldEarned?: number;
  completionResult?: ChapterCompletionResult;
  acquiredAbilities?: AcquiredAbility[];
  heroXPEarned?: number;
  isEndlessMode?: boolean;
  endlessWave?: number;
  chapterId?: number;
  difficulty?: string;
  /** Whether player can respawn (one-time use per run) */
  canRespawn?: boolean;
  /** Saved room state for respawn */
  respawnRoomState?: RespawnRoomState;
}

/**
 * Gold calculation for enemies killed
 * Average gold per enemy type (from CurrencyManager ranges):
 * - melee: 5-10 (avg 7.5)
 * - ranged: 8-15 (avg 11.5)
 * - spreader: 10-20 (avg 15)
 * - boss: 50-100 (avg 75)
 *
 * We approximate with a weighted average assuming mix of enemy types
 *
 * In endless mode, gold scales with wave number to reward progression
 * against increasingly difficult enemies.
 */
function calculateGoldEarned(
  enemiesKilled: number,
  bossDefeated: boolean,
  endlessWave: number = 1,
  isEndlessMode: boolean = false,
): number {
  // Approximate 10 gold per regular enemy (weighted average)
  const baseGold = enemiesKilled * 10;

  // Boss bonus
  const bossGold = bossDefeated ? 75 : 0;

  let totalGold = baseGold + bossGold;

  // Apply endless wave multiplier: 50% more gold per wave
  // Wave 1: 1.0x, Wave 2: 1.5x, Wave 3: 2.0x, etc.
  if (isEndlessMode && endlessWave > 1) {
    const waveMultiplier = 1 + (endlessWave - 1) * 0.5;
    totalGold = Math.floor(totalGold * waveMultiplier);
  }

  return totalGold;
}

/**
 * Score breakdown for display
 */
interface ScoreBreakdown {
  killPoints: number;
  roomPoints: number;
  goldPoints: number;
  timeBonus: number;
  victoryBonus: number;
  difficultyMultiplier: number;
  baseTotal: number;
  total: number;
}

/** Maximum time (5 minutes) for time bonus calculation */
const MAX_TIME_BONUS_MS = 5 * 60 * 1000;

/**
 * Calculate run score from performance metrics
 * Score is multiplied by difficulty: Easy 0.75x, Normal 1x, Hard 1.5x, Insanity 2.5x
 */
function calculateScore(
  enemiesKilled: number,
  roomsCleared: number,
  goldEarned: number,
  playTimeMs: number,
  isVictory: boolean,
  difficulty: DifficultyLevel = DifficultyLevel.NORMAL,
): ScoreBreakdown {
  const killPoints = enemiesKilled * 10;
  const roomPoints = roomsCleared * roomsCleared * 25;
  const goldPoints = Math.floor(goldEarned * 0.5);
  const timeBonus = Math.max(0, Math.floor((MAX_TIME_BONUS_MS - playTimeMs) / 1000) * 2);
  const victoryBonus = isVictory ? 500 : 0;

  const baseTotal = killPoints + roomPoints + goldPoints + timeBonus + victoryBonus;
  const difficultyMultiplier = DIFFICULTY_CONFIGS[difficulty].scoreMultiplier;
  const total = Math.floor(baseTotal * difficultyMultiplier);

  return {
    killPoints,
    roomPoints,
    goldPoints,
    timeBonus,
    victoryBonus,
    difficultyMultiplier,
    baseTotal,
    total,
  };
}

export default class GameOverScene extends Phaser.Scene {
  private stats: GameOverData = { roomsCleared: 0, enemiesKilled: 0, isVictory: false };
  private goldEarned: number = 0;
  private chestRewards: ChestRewards = { wooden: 0, silver: 0, golden: 0 };
  private rewardsCollected: boolean = false;
  private acquiredAbilities: AcquiredAbility[] = [];
  private scoreBreakdown: ScoreBreakdown | null = null;
  private isNewHighScore: boolean = false;
  private heroXPEarned: number = 0;
  private heroLevelUps: HeroLevelUpEvent[] = [];
  private isEndlessMode: boolean = false;
  private endlessWave: number = 1;
  private isNewEndlessHighScore: boolean = false;
  private previousEndlessHighWave: number = 0;
  private canRespawn: boolean = false;
  private respawnRoomState: RespawnRoomState | null = null;
  private showingSecondChancePopup: boolean = false;

  constructor() {
    super({ key: "GameOverScene" });
  }

  init(data: GameOverData) {
    this.stats = data || { roomsCleared: 0, enemiesKilled: 0, isVictory: false };
    this.rewardsCollected = false;
    this.acquiredAbilities = data?.acquiredAbilities ?? [];
    // Always endless mode now
    this.isEndlessMode = true;
    this.endlessWave = data?.endlessWave ?? 1;
    this.canRespawn = data?.canRespawn ?? false;
    this.respawnRoomState = data?.respawnRoomState ?? null;
    // Reset second chance popup state
    this.showingSecondChancePopup = this.canRespawn;

    // Use passed goldEarned if available (from actual gold drops), otherwise estimate
    const bossDefeated = this.stats.bossDefeated ?? this.stats.isVictory ?? false;
    this.goldEarned =
      this.stats.goldEarned ??
      calculateGoldEarned(
        this.stats.enemiesKilled,
        bossDefeated,
        this.endlessWave,
        this.isEndlessMode,
      );

    // Get chapter and difficulty for scaled rewards
    const chapterId = data?.chapterId ?? chapterManager.getSelectedChapter();
    const difficulty = data?.difficulty ?? "normal";

    this.chestRewards = calculateChestRewards(
      this.stats.roomsCleared,
      this.stats.enemiesKilled,
      bossDefeated,
      this.stats.isVictory ?? false,
      chapterId,
      difficulty,
      this.endlessWave,
      this.isEndlessMode,
    );

    // Calculate score (scaled by difficulty)
    const scoreDifficulty = (difficulty as DifficultyLevel) ?? DifficultyLevel.NORMAL;
    this.scoreBreakdown = calculateScore(
      this.stats.enemiesKilled,
      this.stats.roomsCleared,
      this.goldEarned,
      this.stats.playTimeMs ?? 0,
      this.stats.isVictory ?? false,
      scoreDifficulty,
    );

    // Check if new high score - always endless mode
    // Store previous high wave BEFORE recordRunStats() updates it
    this.previousEndlessHighWave = saveManager.getStatistics().endlessHighWave ?? 0;
    this.isNewEndlessHighScore = this.endlessWave > this.previousEndlessHighWave;
    this.isNewHighScore = false; // Don't track regular high score in endless mode

    // Record run statistics to save data
    this.recordRunStats();

    // Process hero XP
    this.heroXPEarned = data?.heroXPEarned ?? 0;
    this.heroLevelUps = [];
    if (this.heroXPEarned > 0) {
      const selectedHeroId = heroManager.getSelectedHeroId();
      this.heroLevelUps = heroManager.addXP(selectedHeroId, this.heroXPEarned);
    }
  }

  /**
   * Record this run's statistics to persistent save data (always endless mode)
   */
  private recordRunStats(): void {
    const selectedChapter = chapterManager.getSelectedChapter();
    const score = this.scoreBreakdown?.total ?? 0;
    const selectedHeroId = heroManager.getSelectedHeroId();

    saveManager.recordRun({
      kills: this.stats.enemiesKilled,
      roomsCleared: this.stats.roomsCleared,
      playTimeMs: this.stats.playTimeMs ?? 0,
      bossDefeated: this.stats.bossDefeated ?? false,
      abilitiesGained: this.stats.abilitiesGained ?? 0,
      victory: false, // Always false in endless mode
      score,
      difficulty: (this.stats.difficulty as DifficultyLevel) ?? DifficultyLevel.NORMAL,
      isEndlessMode: true,
      endlessWave: this.endlessWave,
      goldEarned: this.goldEarned,
      heroId: selectedHeroId,
      acquiredAbilities: this.acquiredAbilities.map((a) => ({ id: a.id, level: a.level })),
    });

    // Track run completion metrics in Sentry
    errorReporting.trackRunCompleted({
      roomsCleared: this.stats.roomsCleared,
      enemiesKilled: this.stats.enemiesKilled,
      playTimeMs: this.stats.playTimeMs ?? 0,
      score,
      isVictory: false,
      isEndlessMode: true,
      endlessWave: this.endlessWave,
      chapterId: selectedChapter,
      difficulty: this.stats.difficulty,
      abilitiesGained: this.stats.abilitiesGained,
    });

    // Track high score for endless mode
    if (this.isNewEndlessHighScore) {
      // Use the stored previous value (before save updated it)
      errorReporting.trackNewHighScore(this.endlessWave, this.previousEndlessHighWave, "endless");
    }

    // Chapter progress update removed - endless mode doesn't track chapter completion

    // Log updated statistics (always endless mode)
    const totalStats = saveManager.getStatistics();
    console.log(
      `GameOverScene: Endless run recorded - Wave ${this.endlessWave}, High Wave: ${totalStats.endlessHighWave ?? 0}`,
    );

    // Check achievements after recording stats
    achievementManager.checkAchievements();
  }

  /**
   * Collect rewards (gold and chests)
   */
  private collectRewards(): void {
    if (this.rewardsCollected) return;
    this.rewardsCollected = true;

    // Add gold
    currencyManager.add("gold", this.goldEarned);

    // Add chests
    chestManager.addChests(this.chestRewards);

    console.log(
      `GameOverScene: Rewards collected - Gold: ${this.goldEarned}, Chests: ${getTotalChests(this.chestRewards)}`,
    );
  }

  create() {
    // Track game end for error context - always game over in endless mode
    errorReporting.setScene("GameOverScene");
    errorReporting.addBreadcrumb("game", "Game Over", {
      roomsCleared: this.stats.roomsCleared,
      enemiesKilled: this.stats.enemiesKilled,
      endlessWave: this.endlessWave,
    });

    // Register shutdown event
    this.events.once("shutdown", this.shutdown, this);

    // CRITICAL: Ensure this scene receives input and is on top
    this.input.enabled = true;
    this.scene.bringToTop();

    // If second chance is available, show the popup FIRST before rewards
    if (this.showingSecondChancePopup) {
      this.showSecondChanceOffer();
    } else {
      this.showRewardsScreen();
    }
  }

  /**
   * Show the second chance offer popup before displaying rewards
   */
  private showSecondChanceOffer(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dark background only for popup phase
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.85).setOrigin(0);

    showSecondChancePopup({
      scene: this,
      onAccept: () => {
        console.log("GameOverScene: Second chance accepted - showing ad");
        this.showRespawnAd();
      },
      onDecline: () => {
        console.log("GameOverScene: Second chance declined - showing rewards");
        this.showingSecondChancePopup = false;
        // Clear the scene and show full rewards
        this.children.removeAll(true);
        this.showRewardsScreen();
      },
    });

    console.log("GameOverScene: Showing second chance popup");
  }

  /**
   * Show the full rewards screen with stats, score, chests, and skills
   */
  private showRewardsScreen(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Debug: Log any pointer events to diagnose input issues (use once to avoid listener accumulation)
    this.input.once("pointerdown", (pointer: Phaser.Input.Pointer) => {
      console.log("GameOverScene: Global pointerdown at", pointer.x, pointer.y);

      // Debug toast for mobile debugging
      debugToast.logPointer("pointerdown", pointer.x, pointer.y, "GameOverScene");

      // Visual feedback: show a small circle where user tapped (debug mode)
      if (debugToast.enabled) {
        const circle = this.add.circle(pointer.x, pointer.y, 20, 0xff0000, 0.5);
        this.tweens.add({
          targets: circle,
          alpha: 0,
          scale: 2,
          duration: 500,
          onComplete: () => circle.destroy(),
        });
      }
    });

    // Dark overlay background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.85).setOrigin(0);

    // Title text - always endless mode
    const titleText = `WAVE ${this.endlessWave}`;
    const titleColor = this.isNewEndlessHighScore ? "#ffdd00" : "#ff6b35";

    this.add
      .text(width / 2, 60, titleText, {
        fontSize: "36px",
        fontFamily: "Arial",
        color: titleColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Show new best for endless high wave
    let subtitleOffset = 0;
    if (this.isNewEndlessHighScore) {
      this.add
        .text(width / 2, 95, "NEW BEST!", {
          fontSize: "16px",
          fontFamily: "Arial",
          color: "#ffdd00",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      subtitleOffset = 10;
    }

    // Stats section
    const statsStartY = 120 + subtitleOffset;
    const lineHeight = 32;

    // Rooms cleared - always show total across all waves (endless mode)
    this.add
      .text(width / 2, statsStartY, `Rooms Cleared: ${this.stats.roomsCleared}`, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Enemies killed
    this.add
      .text(width / 2, statsStartY + lineHeight, `Enemies: ${this.stats.enemiesKilled}`, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Gold earned (highlighted)
    this.add
      .text(width / 2, statsStartY + lineHeight * 2, `Gold: +${this.goldEarned}`, {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#FFD700", // Gold color
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Hero XP earned
    let heroXPOffset = 0;
    if (this.heroXPEarned > 0) {
      this.add
        .text(width / 2, statsStartY + lineHeight * 2.8, `Hero XP: +${this.heroXPEarned}`, {
          fontSize: "18px",
          fontFamily: "Arial",
          color: "#88ccff",
        })
        .setOrigin(0.5);
      heroXPOffset = lineHeight * 0.8;

      // Hero level-up notification
      if (this.heroLevelUps.length > 0) {
        const lastLevelUp = this.heroLevelUps[this.heroLevelUps.length - 1];
        const heroState = heroManager.getHeroState(lastLevelUp.heroId);

        this.add
          .text(
            width / 2,
            statsStartY + lineHeight * 3.4,
            `${heroState.name} reached Level ${lastLevelUp.newLevel}!`,
            {
              fontSize: "20px",
              fontFamily: "Arial",
              color: "#00ff88",
              fontStyle: "bold",
            },
          )
          .setOrigin(0.5);
        heroXPOffset += lineHeight * 0.8;

        // Show new perks if any
        if (lastLevelUp.newPerks.length > 0) {
          const perkNames = lastLevelUp.newPerks.map((p) => p.name).join(", ");
          this.add
            .text(width / 2, statsStartY + lineHeight * 4, `New Perk: ${perkNames}`, {
              fontSize: "14px",
              fontFamily: "Arial",
              color: "#ffdd00",
            })
            .setOrigin(0.5);
          heroXPOffset += lineHeight * 0.6;
        }
      }
    }

    // Score display (adjusted for hero XP section)
    this.displayScore(statsStartY + lineHeight * 3 + heroXPOffset);

    // Chest rewards section (adjusted for hero XP section)
    const chestsY = statsStartY + lineHeight * 5.5 + heroXPOffset;

    this.add
      .text(width / 2, chestsY, "REWARDS", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // Display chest rewards
    const totalChests = getTotalChests(this.chestRewards);
    if (totalChests > 0) {
      this.displayChestRewards(chestsY + 35);
    } else {
      this.add
        .text(width / 2, chestsY + 35, "No chests earned", {
          fontSize: "16px",
          fontFamily: "Arial",
          color: "#888888",
        })
        .setOrigin(0.5);
    }

    // Skills acquired section
    const skillsY = chestsY + 110;
    this.displayAcquiredSkills(skillsY);

    // Continue button - no second chance button here anymore (shown in popup instead)
    const buttonY = height - 70;
    this.createContinueButton(buttonY);

    // Allow keyboard shortcuts
    this.input.keyboard?.once("keydown-SPACE", () => {
      this.continueGame();
    });

    this.input.keyboard?.once("keydown-ENTER", () => {
      this.continueGame();
    });

    console.log(
      `GameOverScene: Rewards screen - Gold: ${this.goldEarned}, Chests: ${JSON.stringify(this.chestRewards)}`,
    );

    // Log scene input state for debugging
    if (debugToast.enabled) {
      debugToast.show(`Scene: ${this.scene.key}`);
      debugToast.show(`Input enabled: ${this.input.enabled}`);
      debugToast.show(`isActive: ${this.scene.isActive()}`);

      // List all running scenes
      const activeScenes = this.scene.manager.getScenes(true).map((s) => s.scene.key);
      debugToast.show(`Active scenes: ${activeScenes.join(", ")}`);
    }

    // Build date text - visible in game over screenshots
    // (BuildInfoScene is covered by this scene's dark overlay)
    const buildText = this.add.text(6, height - 4, __BUILD_DATE__, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#666666",
    });
    buildText.setOrigin(0, 1);
    buildText.setAlpha(0.85);
  }

  /**
   * Display score with breakdown
   */
  private displayScore(startY: number): void {
    const width = this.cameras.main.width;
    if (!this.scoreBreakdown) return;

    // Main score
    const scoreText = this.isNewHighScore
      ? `SCORE: ${this.scoreBreakdown.total.toLocaleString()} - NEW BEST!`
      : `SCORE: ${this.scoreBreakdown.total.toLocaleString()}`;

    const scoreColor = this.isNewHighScore ? "#00ff88" : "#ffffff";

    this.add
      .text(width / 2, startY, scoreText, {
        fontSize: this.isNewHighScore ? "26px" : "22px",
        fontFamily: "Arial",
        color: scoreColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Score breakdown (smaller text)
    const breakdown = [
      `Kills: +${this.scoreBreakdown.killPoints}`,
      `Rooms: +${this.scoreBreakdown.roomPoints}`,
      `Gold: +${this.scoreBreakdown.goldPoints}`,
    ];
    if (this.scoreBreakdown.timeBonus > 0) {
      breakdown.push(`Speed: +${this.scoreBreakdown.timeBonus}`);
    }
    if (this.scoreBreakdown.victoryBonus > 0) {
      breakdown.push(`Victory: +${this.scoreBreakdown.victoryBonus}`);
    }

    this.add
      .text(width / 2, startY + 24, breakdown.join(" | "), {
        fontSize: "11px",
        fontFamily: "Arial",
        color: "#888888",
      })
      .setOrigin(0.5);

    // Show difficulty multiplier if not 1.0x
    if (this.scoreBreakdown.difficultyMultiplier !== 1.0) {
      const multText =
        this.scoreBreakdown.difficultyMultiplier > 1.0
          ? `Difficulty Bonus: x${this.scoreBreakdown.difficultyMultiplier}`
          : `Difficulty Penalty: x${this.scoreBreakdown.difficultyMultiplier}`;
      const multColor = this.scoreBreakdown.difficultyMultiplier > 1.0 ? "#00ff88" : "#ff6666";
      this.add
        .text(width / 2, startY + 38, multText, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: multColor,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    // Personal best (if not new high score)
    if (!this.isNewHighScore && saveManager.getStatistics().highestScore > 0) {
      const bestY = this.scoreBreakdown.difficultyMultiplier !== 1.0 ? startY + 55 : startY + 42;
      this.add
        .text(
          width / 2,
          bestY,
          `Best: ${saveManager.getStatistics().highestScore.toLocaleString()}`,
          {
            fontSize: "13px",
            fontFamily: "Arial",
            color: "#666666",
          },
        )
        .setOrigin(0.5);
    }
  }

  /**
   * Display chest rewards with icons and counts
   */
  private displayChestRewards(startY: number): void {
    const width = this.cameras.main.width;

    // Calculate which chests to display
    const chestsToDisplay: { type: ChestType; count: number }[] = [];

    for (const type of CHEST_ORDER) {
      const count = this.chestRewards[type];
      if (count > 0) {
        chestsToDisplay.push({ type, count });
      }
    }

    if (chestsToDisplay.length === 0) return;

    // Calculate total width for centering
    const chestDisplayWidth = 70; // Width per chest display
    const totalWidth = chestsToDisplay.length * chestDisplayWidth;
    const startX = (width - totalWidth) / 2 + chestDisplayWidth / 2;

    chestsToDisplay.forEach((chest, index) => {
      const x = startX + index * chestDisplayWidth;
      const config = CHEST_CONFIGS[chest.type];

      // Chest icon (fixed display size for consistent UI)
      this.add.image(x, startY, config.icon).setOrigin(0.5).setDisplaySize(48, 48);

      // Count
      this.add
        .text(x, startY + 35, `x${chest.count}`, {
          fontSize: "18px",
          fontFamily: "Arial",
          color: config.color,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // Chest name (small)
      this.add
        .text(x, startY + 55, chest.type.charAt(0).toUpperCase() + chest.type.slice(1), {
          fontSize: "12px",
          fontFamily: "Arial",
          color: "#888888",
        })
        .setOrigin(0.5);
    });
  }

  /**
   * Display acquired skills with icons and levels
   * Returns the total height used by this section
   */
  private displayAcquiredSkills(startY: number): number {
    const width = this.cameras.main.width;

    // If no skills acquired, show message and return minimal height
    if (this.acquiredAbilities.length === 0) {
      this.add
        .text(width / 2, startY, "No skills acquired", {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#666666",
        })
        .setOrigin(0.5);
      return 30;
    }

    // Section title
    this.add
      .text(width / 2, startY, "SKILLS", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // Display skills in a grid (up to 8 per row, smaller icons to avoid overlapping button)
    const iconSize = 28;
    const iconSpacing = 34;
    const maxPerRow = 8;
    const skillCount = this.acquiredAbilities.length;
    const rows = Math.ceil(skillCount / maxPerRow);

    // Calculate grid dimensions
    const gridStartY = startY + 28;

    this.acquiredAbilities.forEach((acquired, index) => {
      // Find the ability data
      const abilityData = ABILITIES.find((a) => a.id === acquired.id);
      if (!abilityData) return;

      const row = Math.floor(index / maxPerRow);
      const col = index % maxPerRow;

      // Recalculate X for rows with fewer items (center them)
      const itemsInRow = Math.min(maxPerRow, skillCount - row * maxPerRow);
      const rowWidth = itemsInRow * iconSpacing;
      const rowStartX = (width - rowWidth) / 2 + iconSpacing / 2;

      const x = rowStartX + col * iconSpacing;
      const y = gridStartY + row * (iconSpacing + 4);

      // Skill icon background (colored border)
      const iconBg = this.add.rectangle(x, y, iconSize + 3, iconSize + 3, 0x222222);
      iconBg.setStrokeStyle(1, abilityData.color);

      // Skill icon
      if (this.textures.exists(abilityData.iconKey)) {
        this.add.image(x, y, abilityData.iconKey).setDisplaySize(iconSize, iconSize);
      } else {
        // Fallback: colored circle
        this.add.circle(x, y, iconSize / 2 - 2, abilityData.color);
      }

      // Level badge (bottom-right corner)
      if (acquired.level > 1) {
        const badgeX = x + iconSize / 2 - 2;
        const badgeY = y + iconSize / 2 - 2;

        // Badge background (smaller to match icon size)
        this.add.circle(badgeX, badgeY, 8, 0x000000, 0.9);

        // Level number
        this.add
          .text(badgeX, badgeY, `${acquired.level}`, {
            fontSize: "10px",
            fontFamily: "Arial",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      }
    });

    // Return total height used (title + rows)
    return 28 + rows * (iconSpacing + 4);
  }

  /**
   * Show mock ad popup for respawn
   */
  private showRespawnAd(): void {
    showMockAdPopup({
      scene: this,
      buttonText: "Respawn",
      onComplete: () => {
        console.log("GameOverScene: Ad complete - triggering respawn");
        this.triggerRespawn();
      },
    });
  }

  /**
   * Trigger respawn - resume GameScene with restored player HP
   */
  private triggerRespawn(): void {
    console.log("GameOverScene: Respawning player in current room");

    // Emit respawn event to GameScene
    this.game.events.emit("playerRespawn", this.respawnRoomState);

    // Stop GameOverScene and let GameScene resume
    this.scene.stop("GameOverScene");
  }

  /**
   * Create the continue button (always non-victory in endless mode)
   */
  private createContinueButton(y: number): void {
    const width = this.cameras.main.width;
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonText = "MAIN MENU";
    const buttonColor = 0x4a9eff;

    // Note: Second chance is now shown in a separate popup before this screen

    const button = this.add
      .rectangle(width / 2, y, buttonWidth, buttonHeight, buttonColor, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(100); // Ensure button is above everything

    this.add
      .text(width / 2, y, buttonText, {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(101); // Text above button

    // Button hover effects
    const hoverColor = 0x6ab0ff;
    const pressColor = 0x3a8edf;

    button.on("pointerover", () => {
      debugToast.show("Button: pointerover");
      button.setFillStyle(hoverColor);
    });

    button.on("pointerout", () => {
      debugToast.show("Button: pointerout");
      button.setFillStyle(buttonColor);
    });

    // Use pointerdown for immediate response on touch devices
    button.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      console.log("GameOverScene: Button clicked - navigating to MainMenuScene");
      debugToast.logPointer("Button pointerdown", pointer.x, pointer.y, "MAIN MENU btn");
      button.setFillStyle(pressColor);
      this.continueGame();
    });

    // Log all interactive objects in scene for debugging
    if (debugToast.enabled) {
      debugToast.logInteractive("MAIN MENU btn", button.x, button.y, buttonWidth, buttonHeight);

      // Add pointerup and pointermove for more debugging
      button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        debugToast.logPointer("Button pointerup", pointer.x, pointer.y);
      });
    }

    // Debug: Log if button is interactive
    console.log("GameOverScene: Continue button created", {
      interactive: button.input?.enabled,
      position: { x: button.x, y: button.y },
      size: { width: buttonWidth, height: buttonHeight },
    });
  }

  /**
   * Collect rewards and return to main menu
   */
  private continueGame() {
    console.log("GameOverScene: continueGame() called");

    // Prevent multiple calls
    if (this.rewardsCollected) {
      console.log("GameOverScene: Already continuing, ignoring duplicate call");
      return;
    }

    // Collect rewards first
    this.collectRewards();

    // Play menu select sound
    audioManager.playMenuSelect();

    // Stop all tweens to prevent rendering updates during shutdown
    this.tweens.killAll();

    console.log("GameOverScene: Returning to main menu...");

    // If respawn was available, GameScene is paused instead of stopped
    // We need to stop it now since player chose not to respawn
    if (this.canRespawn && this.scene.isActive("GameScene")) {
      this.scene.stop("GameScene");
    }

    // Return to main menu
    // start() will shut down the current scene (GameOverScene) correctly
    this.scene.start("MainMenuScene");
  }

  /**
   * Clean up scene resources
   */
  shutdown() {
    // CRITICAL: Remove all input listeners to prevent accumulation
    this.input.removeAllListeners();

    // Kill all tweens
    this.tweens.killAll();
  }
}

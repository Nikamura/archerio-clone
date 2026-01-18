import Phaser from "phaser";
import { THEME_COLORS } from "../config/themeData";
import { ABILITIES, type AbilityData } from "./LevelUpScene";
import { DifficultyLevel, DIFFICULTY_CONFIGS } from "../config/difficulty";
import { performanceMonitor } from "../systems/PerformanceMonitor";

interface AcquiredAbility {
  id: string;
  level: number;
}

export default class UIScene extends Phaser.Scene {
  // Top HUD elements
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthBarBg!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private levelBadge!: Phaser.GameObjects.Container;
  private levelText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private roomText!: Phaser.GameObjects.Text;

  // Boss health bar
  private bossHealthBar!: Phaser.GameObjects.Graphics;
  private bossHealthBarBg!: Phaser.GameObjects.Graphics;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossHealthContainer!: Phaser.GameObjects.Container;

  // HUD container for toggling visibility
  private hudContainer!: Phaser.GameObjects.Container;
  private isHudVisible: boolean = true;

  // Menu button (opens unified pause menu)
  private menuButton!: Phaser.GameObjects.Container;

  // Skills bar (bottom)
  private skillsContainer!: Phaser.GameObjects.Container;
  private skillSlots: Array<{
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Image | null;
    badge: Phaser.GameObjects.Arc | null;
    levelText: Phaser.GameObjects.Text | null;
  }> = [];
  private skillOverflowText: Phaser.GameObjects.Text | null = null;
  private readonly MAX_SKILL_DISPLAY = 12;

  // FPS counter (debug only)
  private fpsText?: Phaser.GameObjects.Text;
  private lastFpsValue: number = -1; // Track last FPS to avoid redundant setText

  // UI caching to avoid redundant redraws
  private lastHealthPercent: number = -1;
  private lastHealthCurrent: number = -1;
  private lastXpPercent: number = -1;
  private lastLevel: number = -1;
  private lastBossHealthPercent: number = -1;

  // Score display
  private scoreText!: Phaser.GameObjects.Text;
  private currentScore: number = 0;
  private scoreKills: number = 0;
  private scoreRooms: number = 0;
  private scoreGold: number = 0;
  private scoreDifficulty: DifficultyLevel = DifficultyLevel.NORMAL;

  // Notification queue
  private notificationContainer!: Phaser.GameObjects.Container;
  private notificationQueue: Array<{
    ability: AbilityData;
    isDouble?: boolean;
    ability2?: AbilityData;
  }> = [];
  private isShowingNotification: boolean = false;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    this.events.once("shutdown", this.shutdown, this);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create HUD container
    this.hudContainer = this.add.container(0, 0);
    this.isHudVisible = true;

    // === TOP HUD BAR ===
    this.createTopHUD(width);

    // === MENU BUTTON & PANEL ===
    this.createMenuSystem(width, height);

    // === SKILLS BAR (bottom) ===
    this.createSkillsBar(height);

    // === BOSS HEALTH BAR ===
    this.createBossHealthBar(width, height);

    // === NOTIFICATION AREA ===
    this.notificationContainer = this.add.container(width / 2, 70);
    this.notificationContainer.setDepth(100);

    // === FPS COUNTER (debug only) ===
    if (this.game.registry.get("debug")) {
      this.fpsText = this.add.text(width - 10, 10, "FPS: 60", {
        fontSize: "11px",
        color: "#00ff00",
        fontStyle: "bold",
      });
      this.fpsText.setOrigin(1, 0);
      this.fpsText.setDepth(100);
      this.fpsText.setAlpha(0.7);

      // Debug mode indicator
      const debugText = this.add.text(10, height - 20, "DEBUG", {
        fontSize: "10px",
        color: "#ff0000",
        fontStyle: "bold",
      });
      debugText.setAlpha(0.5);

      // Debug skip button (DOM for reliability)
      const btn = document.createElement("button");
      btn.innerText = "SKIP";
      btn.style.cssText = `
        position: absolute; top: 60px; right: 10px; z-index: 10000;
        background: #cc0000; color: white; border: none; padding: 6px 10px;
        font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 11px;
      `;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.events.emit("debugSkipLevel");
      };
      document.body.appendChild(btn);
      this.events.once("shutdown", () => btn.remove());
    }

    // === EVENT LISTENERS ===
    this.setupEventListeners();

    console.log("UIScene: Created (modern layout)");
  }

  /**
   * Create the top HUD bar with health, room counter, and level
   */
  private createTopHUD(width: number) {
    // Semi-transparent top bar background
    const topBarBg = this.add.graphics();
    topBarBg.fillStyle(0x000000, 0.4);
    topBarBg.fillRoundedRect(8, 8, width - 16, 44, 8);
    this.hudContainer.add(topBarBg);

    // --- HEALTH BAR (left side) ---
    const healthX = 16;
    const healthY = 16;
    const healthWidth = 120;
    const healthHeight = 14;

    // Health bar background
    this.healthBarBg = this.add.graphics();
    this.healthBarBg.fillStyle(0x000000, 0.6);
    this.healthBarBg.fillRoundedRect(healthX, healthY, healthWidth, healthHeight, 4);
    this.hudContainer.add(this.healthBarBg);

    // Health bar fill
    this.healthBar = this.add.graphics();
    this.hudContainer.add(this.healthBar);

    // Health text
    this.healthText = this.add.text(healthX + healthWidth / 2, healthY + healthHeight / 2, "100", {
      fontSize: "10px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.healthText.setOrigin(0.5);
    this.healthText.setStroke("#000000", 2);
    this.hudContainer.add(this.healthText);

    // Initialize health bar
    this.updateHealthBar(100, 100, 100);

    // --- ROOM COUNTER (center) ---
    this.roomText = this.add.text(width / 2, 22, "Room 1/20", {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.roomText.setOrigin(0.5);
    this.roomText.setStroke("#000000", 3);
    this.hudContainer.add(this.roomText);

    // --- SCORE DISPLAY (below room counter) ---
    this.scoreText = this.add.text(width / 2, 40, "Score: 0", {
      fontSize: "12px",
      color: "#FFD700",
      fontStyle: "bold",
    });
    this.scoreText.setOrigin(0.5);
    this.scoreText.setStroke("#000000", 2);
    this.hudContainer.add(this.scoreText);

    // --- LEVEL BADGE with XP (right side, before menu button) ---
    const levelX = width - 70;
    this.levelBadge = this.add.container(levelX, 28);

    // XP bar background
    const xpBarWidth = 40;
    const xpBarHeight = 4;
    const xpBg = this.add.graphics();
    xpBg.fillStyle(0x000000, 0.6);
    xpBg.fillRoundedRect(-xpBarWidth / 2, 8, xpBarWidth, xpBarHeight, 2);
    this.levelBadge.add(xpBg);

    // XP bar fill
    this.xpBar = this.add.graphics();
    this.levelBadge.add(this.xpBar);
    this.updateXPBar(0);

    // Level text
    this.levelText = this.add.text(0, -2, "Lv.1", {
      fontSize: "14px",
      color: "#ffdd00",
      fontStyle: "bold",
    });
    this.levelText.setOrigin(0.5);
    this.levelText.setStroke("#000000", 2);
    this.levelBadge.add(this.levelText);

    this.hudContainer.add(this.levelBadge);
  }

  /**
   * Create unified menu button that opens pause menu
   */
  private createMenuSystem(width: number, _height: number) {
    // Menu button (hamburger icon) - opens unified pause menu
    this.menuButton = this.add.container(width - 26, 28);
    this.menuButton.setDepth(50);

    const menuBg = this.add.circle(0, 0, 14, 0x000000, 0.6);
    menuBg.setStrokeStyle(2, 0x666666);
    menuBg.setInteractive({ useHandCursor: true });
    this.menuButton.add(menuBg);

    const menuIcon = this.add
      .text(0, 0, "☰", {
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.menuButton.add(menuIcon);

    // Menu button click handler - emits pause request
    menuBg.on("pointerdown", () => {
      this.game.events.emit("pauseRequested");
    });
    menuBg.on("pointerover", () => menuBg.setStrokeStyle(2, 0x888888));
    menuBg.on("pointerout", () => menuBg.setStrokeStyle(2, 0x666666));
  }

  /**
   * Create skills bar at the bottom with pre-allocated slots for performance
   */
  private createSkillsBar(height: number) {
    this.skillsContainer = this.add.container(10, height - 45);
    this.skillsContainer.setDepth(10);
    this.hudContainer.add(this.skillsContainer);

    const iconSize = 22;
    const iconSpacing = 26;

    // Pre-create skill slots (hidden by default)
    this.skillSlots = [];
    for (let i = 0; i < this.MAX_SKILL_DISPLAY; i++) {
      const x = i * iconSpacing;

      // Background graphics (reusable)
      const iconBg = this.add.graphics();
      iconBg.setVisible(false);
      this.skillsContainer.add(iconBg);

      // Icon image (null until needed)
      const icon = this.add.image(x, 0, "abilityAttackBoost"); // Placeholder texture
      icon.setDisplaySize(iconSize - 4, iconSize - 4);
      icon.setVisible(false);
      this.skillsContainer.add(icon);

      // Level badge (null until needed)
      const badgeX = x + iconSize / 2 - 5;
      const badgeY = iconSize / 2 - 5;
      const badge = this.add.circle(badgeX, badgeY, 6, 0x000000, 0.9);
      badge.setVisible(false);
      this.skillsContainer.add(badge);

      // Level text
      const levelText = this.add
        .text(badgeX, badgeY, "", {
          fontSize: "8px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      levelText.setVisible(false);
      this.skillsContainer.add(levelText);

      this.skillSlots.push({ bg: iconBg, icon, badge, levelText });
    }

    // Pre-create overflow text
    this.skillOverflowText = this.add
      .text(this.MAX_SKILL_DISPLAY * iconSpacing, 0, "", {
        fontSize: "11px",
        color: "#888888",
      })
      .setOrigin(0, 0.5);
    this.skillOverflowText.setVisible(false);
    this.skillsContainer.add(this.skillOverflowText);
  }

  /**
   * Create boss health bar (hidden by default)
   */
  private createBossHealthBar(width: number, height: number) {
    const barWidth = width - 40;
    const barHeight = 12;
    const yPos = height - 55;

    this.bossHealthContainer = this.add.container(0, 0);

    // Background
    this.bossHealthBarBg = this.add.graphics();
    this.bossHealthBarBg.fillStyle(0x000000, 0.7);
    this.bossHealthBarBg.fillRoundedRect(20, yPos, barWidth, barHeight, 4);
    this.bossHealthContainer.add(this.bossHealthBarBg);

    // Health bar
    this.bossHealthBar = this.add.graphics();
    this.bossHealthContainer.add(this.bossHealthBar);

    // Boss name styling
    this.bossNameText = this.add.text(width / 2, yPos - 14, "BOSS", {
      fontSize: "14px",
      fontFamily: '"Times New Roman", Georgia, serif',
      color: THEME_COLORS.bossNamePrimary,
      fontStyle: "bold",
      letterSpacing: 2,
    });
    this.bossNameText.setOrigin(0.5, 0.5);
    this.bossNameText.setStroke(THEME_COLORS.bossNameStroke, 3);
    this.bossHealthContainer.add(this.bossNameText);

    this.bossHealthContainer.setVisible(false);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    // Health updates
    this.events.on("updateHealth", (currentHealth: number, maxHealth: number) => {
      const percentage = (currentHealth / maxHealth) * 100;
      this.updateHealthBar(percentage, currentHealth, maxHealth);
    });

    // XP updates
    this.events.on("updateXP", (xpPercentage: number, level: number) => {
      this.updateXPBar(xpPercentage);
      this.updateLevel(level);
    });

    // Room updates
    this.events.on(
      "updateRoom",
      (currentRoom: number, totalRooms: number, endlessWave?: number) => {
        this.updateRoomCounter(currentRoom, totalRooms, endlessWave);
      },
    );

    // Boss health events
    this.events.on("showBossHealth", (health: number, maxHealth: number, bossName?: string) => {
      this.showBossHealthBar(health, maxHealth, bossName);
    });
    this.events.on("updateBossHealth", (health: number, maxHealth: number) => {
      this.updateBossHealthBar(health, maxHealth);
    });
    this.events.on("hideBossHealth", () => {
      this.hideBossHealthBar();
    });

    // HUD visibility
    this.events.on("roomCleared", () => this.fadeOutHUD());
    this.events.on("roomEntered", () => this.fadeInHUD());

    // Auto level up notifications
    this.events.on("showAutoLevelUp", (ability: AbilityData) => {
      this.queueNotification(ability);
    });
    this.events.on("showAutoLevelUpDouble", (ability1: AbilityData, ability2: AbilityData) => {
      this.queueNotification(ability1, true, ability2);
    });

    // Abilities update
    this.events.on("updateAbilities", (abilities: AcquiredAbility[]) => {
      this.updateSkillsBar(abilities);
    });

    // Score tracking events
    this.events.on("initScore", (difficulty: DifficultyLevel) => {
      this.scoreDifficulty = difficulty;
      this.scoreKills = 0;
      this.scoreRooms = 0;
      this.scoreGold = 0;
      this.updateScoreDisplay();
    });
    this.events.on("scoreKill", () => {
      this.scoreKills++;
      this.updateScoreDisplay();
    });
    this.events.on("scoreRoom", (roomsCleared: number) => {
      this.scoreRooms = roomsCleared;
      this.updateScoreDisplay();
    });
    this.events.on("scoreGold", (totalGold: number) => {
      this.scoreGold = totalGold;
      this.updateScoreDisplay();
    });
  }

  /**
   * Calculate and update the score display
   */
  private updateScoreDisplay() {
    const killPoints = this.scoreKills * 10;
    const roomPoints = this.scoreRooms * this.scoreRooms * 25;
    const goldPoints = Math.floor(this.scoreGold * 0.5);
    const baseScore = killPoints + roomPoints + goldPoints;
    const multiplier = DIFFICULTY_CONFIGS[this.scoreDifficulty].scoreMultiplier;
    this.currentScore = Math.floor(baseScore * multiplier);

    // Show multiplier if not 1x
    if (multiplier !== 1.0) {
      this.scoreText.setText(`Score: ${this.currentScore.toLocaleString()} (x${multiplier})`);
    } else {
      this.scoreText.setText(`Score: ${this.currentScore.toLocaleString()}`);
    }
  }

  update() {
    // Update FPS counter (debug only) - only update when value changes
    if (this.fpsText) {
      const fps = Math.round(performanceMonitor.getAverageFps());
      if (fps !== this.lastFpsValue) {
        this.lastFpsValue = fps;
        this.fpsText.setText(`${fps}`);
        this.fpsText.setColor(fps >= 55 ? "#00ff00" : fps >= 30 ? "#ffff00" : "#ff0000");
      }
    }
  }

  updateHealthBar(percentage: number, currentHealth: number, _maxHealth: number) {
    // Round for comparison to avoid floating point issues
    const roundedPercent = Math.round(percentage);
    const roundedCurrent = Math.ceil(currentHealth);

    // Skip redraw if values haven't changed
    if (roundedPercent === this.lastHealthPercent && roundedCurrent === this.lastHealthCurrent) {
      return;
    }
    this.lastHealthPercent = roundedPercent;
    this.lastHealthCurrent = roundedCurrent;

    const healthX = 16;
    const healthY = 16;
    const healthWidth = 120;
    const healthHeight = 14;

    this.healthBar.clear();

    let color = THEME_COLORS.healthFull;
    if (percentage < 50) color = THEME_COLORS.healthMid;
    if (percentage < 25) color = THEME_COLORS.healthLow;

    this.healthBar.fillStyle(color, 1);
    const fillWidth = Math.max(0, (percentage / 100) * (healthWidth - 4));
    this.healthBar.fillRoundedRect(healthX + 2, healthY + 2, fillWidth, healthHeight - 4, 3);

    this.healthText.setText(`${roundedCurrent}`);
  }

  updateRoomCounter(currentRoom: number, totalRooms: number, endlessWave?: number) {
    if (endlessWave !== undefined) {
      this.roomText.setText(`Wave ${endlessWave} • ${currentRoom}/${totalRooms}`);
    } else {
      this.roomText.setText(`${currentRoom}/${totalRooms}`);
    }
  }

  updateXPBar(percentage: number) {
    const roundedPercent = Math.round(percentage);

    // Skip redraw if value hasn't changed
    if (roundedPercent === this.lastXpPercent) {
      return;
    }
    this.lastXpPercent = roundedPercent;

    const xpBarWidth = 40;
    const xpBarHeight = 4;

    this.xpBar.clear();
    this.xpBar.fillStyle(THEME_COLORS.xpBar, 1);
    const fillWidth = Math.max(0, (percentage / 100) * xpBarWidth);
    this.xpBar.fillRoundedRect(-xpBarWidth / 2, 8, fillWidth, xpBarHeight, 2);
  }

  updateLevel(level: number) {
    // Skip if level hasn't changed
    if (level === this.lastLevel) {
      return;
    }
    this.lastLevel = level;
    this.levelText.setText(`Lv.${level}`);
  }

  private fadeOutHUD(): void {
    if (!this.isHudVisible) return;
    this.isHudVisible = false;
    this.tweens.add({
      targets: this.hudContainer,
      alpha: 0,
      duration: 300,
      ease: "Power2.easeOut",
    });
  }

  private fadeInHUD(): void {
    if (this.isHudVisible) return;
    this.isHudVisible = true;
    this.tweens.add({
      targets: this.hudContainer,
      alpha: 1,
      duration: 200,
      ease: "Power2.easeOut",
    });
  }

  private showBossHealthBar(health: number, maxHealth: number, bossName?: string) {
    // Update boss name if provided
    if (bossName && this.bossNameText) {
      this.bossNameText.setText(bossName.toUpperCase());
    }
    this.bossHealthContainer.setVisible(true);
    // Reset cache to force initial draw
    this.lastBossHealthPercent = -1;
    this.updateBossHealthBar(health, maxHealth);
  }

  private updateBossHealthBar(health: number, maxHealth: number) {
    const percentage = Math.max(0, health / maxHealth);
    const roundedPercent = Math.round(percentage * 100);

    // Skip redraw if value hasn't changed
    if (roundedPercent === this.lastBossHealthPercent) {
      return;
    }
    this.lastBossHealthPercent = roundedPercent;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const barWidth = width - 44;
    const barHeight = 8;
    const yPos = height - 53;

    this.bossHealthBar.clear();
    this.bossHealthBar.fillStyle(THEME_COLORS.bossHealth, 1);
    this.bossHealthBar.fillRoundedRect(22, yPos, barWidth * percentage, barHeight, 3);
  }

  private hideBossHealthBar() {
    if (this.bossHealthContainer) {
      this.bossHealthContainer.setVisible(false);
    }
  }

  /**
   * Queue a notification to show
   */
  private queueNotification(ability: AbilityData, isDouble?: boolean, ability2?: AbilityData) {
    this.notificationQueue.push({ ability, isDouble, ability2 });
    this.processNotificationQueue();
  }

  /**
   * Process notification queue
   */
  private processNotificationQueue() {
    if (this.isShowingNotification || this.notificationQueue.length === 0) return;
    this.isShowingNotification = true;

    const notification = this.notificationQueue.shift()!;
    this.showNotification(notification.ability, notification.isDouble, notification.ability2);
  }

  /**
   * Show a compact notification toast
   */
  private showNotification(ability: AbilityData, isDouble?: boolean, ability2?: AbilityData) {
    // Clear existing notifications
    this.notificationContainer.removeAll(true);

    const panelWidth = isDouble ? 160 : 140;
    const panelHeight = isDouble ? 50 : 36;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 6);
    bg.lineStyle(2, isDouble ? 0xffd700 : ability.color, 1);
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 6);
    this.notificationContainer.add(bg);

    if (isDouble && ability2) {
      // Double bonus notification
      const bonusLabel = this.add
        .text(0, -14, "2× BONUS", {
          fontSize: "10px",
          color: "#ffd700",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.notificationContainer.add(bonusLabel);

      // First ability icon + name
      if (this.textures.exists(ability.iconKey)) {
        const icon1 = this.add.image(-panelWidth / 2 + 20, 4, ability.iconKey);
        icon1.setDisplaySize(20, 20);
        this.notificationContainer.add(icon1);
      }
      const name1 = this.add
        .text(-10, 4, ability.name, {
          fontSize: "10px",
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);
      this.notificationContainer.add(name1);

      // Second ability icon + name
      if (this.textures.exists(ability2.iconKey)) {
        const icon2 = this.add.image(-panelWidth / 2 + 20, 20, ability2.iconKey);
        icon2.setDisplaySize(20, 20);
        this.notificationContainer.add(icon2);
      }
      const name2 = this.add
        .text(-10, 20, ability2.name, {
          fontSize: "10px",
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);
      this.notificationContainer.add(name2);
    } else {
      // Single ability notification
      if (this.textures.exists(ability.iconKey)) {
        const icon = this.add.image(-panelWidth / 2 + 22, 0, ability.iconKey);
        icon.setDisplaySize(24, 24);
        this.notificationContainer.add(icon);
      }

      const name = this.add
        .text(0, 0, ability.name, {
          fontSize: "12px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.notificationContainer.add(name);
    }

    // Animate in
    this.notificationContainer.setAlpha(0);
    this.notificationContainer.setY(50);

    this.tweens.add({
      targets: this.notificationContainer,
      alpha: 1,
      y: 70,
      duration: 150,
      ease: "Power2.easeOut",
      onComplete: () => {
        // Hold then fade out
        this.time.delayedCall(isDouble ? 1500 : 1000, () => {
          this.tweens.add({
            targets: this.notificationContainer,
            alpha: 0,
            y: 50,
            duration: 200,
            ease: "Power2.easeIn",
            onComplete: () => {
              this.isShowingNotification = false;
              this.processNotificationQueue();
            },
          });
        });
      },
    });
  }

  /**
   * Update skills bar with acquired abilities
   * Optimized: Reuses pre-created objects instead of destroying/recreating
   */
  private updateSkillsBar(abilities: AcquiredAbility[]) {
    const iconSize = 22;
    const iconSpacing = 26;

    // Update each pre-created slot
    for (let index = 0; index < this.MAX_SKILL_DISPLAY; index++) {
      const slot = this.skillSlots[index];
      if (!slot) continue;

      const acquired = abilities[index];
      const abilityData = acquired ? ABILITIES.find((a) => a.id === acquired.id) : null;

      if (acquired && abilityData) {
        const x = index * iconSpacing;

        // Update background graphics
        slot.bg.clear();
        slot.bg.fillStyle(0x000000, 0.6);
        slot.bg.fillRoundedRect(x - iconSize / 2, -iconSize / 2, iconSize, iconSize, 4);
        slot.bg.lineStyle(1, abilityData.color, 0.8);
        slot.bg.strokeRoundedRect(x - iconSize / 2, -iconSize / 2, iconSize, iconSize, 4);
        slot.bg.setVisible(true);

        // Update icon
        if (slot.icon) {
          if (this.textures.exists(abilityData.iconKey)) {
            slot.icon.setTexture(abilityData.iconKey);
            slot.icon.setPosition(x, 0);
            slot.icon.setDisplaySize(iconSize - 4, iconSize - 4);
            slot.icon.setVisible(true);
          } else {
            slot.icon.setVisible(false);
          }
        }

        // Update level badge (only if > 1)
        if (acquired.level > 1) {
          const badgeX = x + iconSize / 2 - 5;
          const badgeY = iconSize / 2 - 5;

          if (slot.badge) {
            slot.badge.setPosition(badgeX, badgeY);
            slot.badge.setStrokeStyle(1, abilityData.color);
            slot.badge.setVisible(true);
          }

          if (slot.levelText) {
            slot.levelText.setPosition(badgeX, badgeY);
            slot.levelText.setText(`${acquired.level}`);
            slot.levelText.setVisible(true);
          }
        } else {
          slot.badge?.setVisible(false);
          slot.levelText?.setVisible(false);
        }
      } else {
        // Hide unused slot
        slot.bg.setVisible(false);
        slot.icon?.setVisible(false);
        slot.badge?.setVisible(false);
        slot.levelText?.setVisible(false);
      }
    }

    // Update overflow indicator
    if (this.skillOverflowText) {
      if (abilities.length > this.MAX_SKILL_DISPLAY) {
        this.skillOverflowText.setText(`+${abilities.length - this.MAX_SKILL_DISPLAY}`);
        this.skillOverflowText.setVisible(true);
      } else {
        this.skillOverflowText.setVisible(false);
      }
    }
  }

  shutdown() {
    this.events.off("updateHealth");
    this.events.off("updateXP");
    this.events.off("updateRoom");
    this.events.off("showBossHealth");
    this.events.off("updateBossHealth");
    this.events.off("hideBossHealth");
    this.events.off("roomCleared");
    this.events.off("roomEntered");
    this.events.off("showAutoLevelUp");
    this.events.off("showAutoLevelUpDouble");
    this.events.off("updateAbilities");
  }
}

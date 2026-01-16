import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import {
  dailyRewardManager,
  DAILY_REWARDS,
  DailyReward,
  Reward,
} from "../systems/DailyRewardManager";
import { createBackButton } from "../ui/components/BackButton";

/**
 * DailyRewardScene - UI for the 7-day daily reward calendar
 *
 * Features:
 * - 7-day horizontal calendar showing all rewards
 * - Highlight current day, checkmarks for claimed days
 * - Claim button when reward is available
 * - Particle effects on claim
 * - Timer until next claim
 */
export default class DailyRewardScene extends Phaser.Scene {
  // UI Elements
  private dayCards: Phaser.GameObjects.Container[] = [];
  private claimButton?: Phaser.GameObjects.Container;
  private timerText?: Phaser.GameObjects.Text;
  private rewardParticles?: Phaser.GameObjects.Particles.ParticleEmitter;

  // State
  private canClaim: boolean = false;

  constructor() {
    super({ key: "DailyRewardScene" });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Header
    this.createHeader(width);

    // Calendar row
    this.createCalendar(width, height);

    // Claim button
    this.createClaimButton(width, height);

    // Timer text
    this.createTimerDisplay(width, height);

    // Back button
    this.createBackButton(width, height);

    // Create particle texture
    this.createParticleTexture();

    // Initial update
    this.updateUI();
  }

  update() {
    // Update timer every frame
    this.updateTimer();
  }

  private createHeader(width: number) {
    // Title
    this.add
      .text(width / 2, 40, "DAILY REWARDS", {
        fontSize: "28px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, 75, "Log in every day for rewards!", {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    // Streak display
    const streakLength = dailyRewardManager.getStreakLength();
    this.add
      .text(width / 2, 100, `Current Streak: ${streakLength} day${streakLength !== 1 ? "s" : ""}`, {
        fontSize: "12px",
        color: "#44ff44",
      })
      .setOrigin(0.5);
  }

  private createCalendar(width: number, height: number) {
    const calendarY = height / 2 - 60;
    const cardWidth = 46;
    const cardHeight = 90;
    const cardSpacing = 4;
    const totalWidth = cardWidth * 7 + cardSpacing * 6;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;

    // Clear existing cards
    this.dayCards = [];

    // Create cards for each day
    DAILY_REWARDS.forEach((reward, index) => {
      const x = startX + index * (cardWidth + cardSpacing);
      const card = this.createDayCard(x, calendarY, cardWidth, cardHeight, reward);
      this.dayCards.push(card);
    });
  }

  private createDayCard(
    x: number,
    y: number,
    width: number,
    height: number,
    reward: DailyReward,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const currentDay = dailyRewardManager.getCurrentDay();
    const isClaimed = dailyRewardManager.isDayClaimed(reward.day);
    const isCurrentDay = reward.day === currentDay;
    const canClaim = dailyRewardManager.canClaimToday();

    // Determine card state and colors
    let bgColor = 0x2a2a3e; // Default/future
    let borderColor = 0x444466;
    let alpha = 0.6;

    if (isClaimed) {
      // Already claimed
      bgColor = 0x1a3a1a;
      borderColor = 0x44aa44;
      alpha = 0.9;
    } else if (isCurrentDay) {
      // Current day (claimable or waiting)
      bgColor = canClaim ? 0x3a3a1a : 0x2a2a3e;
      borderColor = canClaim ? 0xffdd44 : 0x888888;
      alpha = 1.0;
    }

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, bgColor, alpha);
    bg.setStrokeStyle(2, borderColor);

    // Day number
    const dayText = this.add
      .text(0, -height / 2 + 12, `Day ${reward.day}`, {
        fontSize: "10px",
        color: isCurrentDay ? "#FFD700" : "#aaaaaa",
        fontStyle: isCurrentDay ? "bold" : "normal",
      })
      .setOrigin(0.5);

    // Reward icon and amount
    const rewardElements = this.createRewardDisplay(reward, height);

    // Checkmark for claimed days
    let checkmark: Phaser.GameObjects.Text | null = null;
    if (isClaimed) {
      checkmark = this.add
        .text(0, height / 2 - 14, "✓", {
          fontSize: "16px",
          color: "#44ff44",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    // Current day indicator
    let currentIndicator: Phaser.GameObjects.Text | null = null;
    if (isCurrentDay && !isClaimed) {
      currentIndicator = this.add
        .text(0, height / 2 - 12, canClaim ? "!" : "...", {
          fontSize: canClaim ? "14px" : "10px",
          color: canClaim ? "#FFD700" : "#888888",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    // Add elements to container
    container.add([bg, dayText, ...rewardElements]);
    if (checkmark) container.add(checkmark);
    if (currentIndicator) container.add(currentIndicator);

    // Add highlight animation for current claimable day
    if (isCurrentDay && canClaim) {
      this.tweens.add({
        targets: bg,
        strokeAlpha: { from: 1, to: 0.5 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Store day reference for updates
    container.setData("day", reward.day);

    return container;
  }

  private createRewardDisplay(
    reward: DailyReward,
    _cardHeight: number,
  ): Phaser.GameObjects.GameObject[] {
    const elements: Phaser.GameObjects.GameObject[] = [];
    const startY = -15;

    // For single reward
    if (reward.rewards.length === 1) {
      const r = reward.rewards[0];
      const icon = this.getRewardIcon(r.type);
      const color = this.getRewardColor(r.type);

      const iconText = this.add
        .text(0, startY, icon, {
          fontSize: "20px",
        })
        .setOrigin(0.5);

      const amountText = this.add
        .text(0, startY + 20, this.formatAmount(r.amount), {
          fontSize: "11px",
          color: color,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      elements.push(iconText, amountText);
    } else {
      // Multiple rewards (day 7)
      reward.rewards.forEach((r, i) => {
        const offsetY = startY + i * 28;
        const icon = this.getRewardIcon(r.type);
        const color = this.getRewardColor(r.type);

        const iconText = this.add
          .text(-10, offsetY, icon, {
            fontSize: "14px",
          })
          .setOrigin(0.5);

        const amountText = this.add
          .text(10, offsetY, this.formatAmount(r.amount), {
            fontSize: "10px",
            color: color,
            fontStyle: "bold",
          })
          .setOrigin(0, 0.5);

        elements.push(iconText, amountText);
      });
    }

    return elements;
  }

  private getRewardIcon(type: string): string {
    switch (type) {
      case "gold":
        return "💰";
      case "gems":
        return "💎";
      case "energy":
        return "⚡";
      default:
        return "🎁";
    }
  }

  private getRewardColor(type: string): string {
    switch (type) {
      case "gold":
        return "#FFD700";
      case "gems":
        return "#00FFFF";
      case "energy":
        return "#FFFF00";
      default:
        return "#ffffff";
    }
  }

  private formatAmount(amount: number): string {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  }

  private createClaimButton(width: number, height: number) {
    const buttonY = height / 2 + 80;

    this.claimButton = this.add.container(width / 2, buttonY);

    // Button background
    const bg = this.add.rectangle(0, 0, 200, 50, 0x4a9eff);
    bg.setStrokeStyle(2, 0x6bb6ff);

    // Button text
    const text = this.add
      .text(0, 0, "CLAIM REWARD", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.claimButton.add([bg, text]);

    // Make interactive
    bg.setInteractive({ useHandCursor: true });

    // Hover effects
    bg.on("pointerover", () => {
      if (this.canClaim) {
        bg.setFillStyle(0x6bb6ff);
      }
    });

    bg.on("pointerout", () => {
      if (this.canClaim) {
        bg.setFillStyle(0x4a9eff);
      }
    });

    // Click handler
    bg.on("pointerdown", () => {
      if (this.canClaim) {
        this.claimReward();
      }
    });
  }

  private createTimerDisplay(width: number, height: number) {
    const timerY = height / 2 + 130;

    this.timerText = this.add
      .text(width / 2, timerY, "", {
        fontSize: "16px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
  }

  private createBackButton(_width: number, height: number) {
    createBackButton({
      scene: this,
      y: height - 50,
      targetScene: "MainMenuScene",
    });
  }

  private createParticleTexture() {
    // Create a simple star particle texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffd700, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture("reward_particle", 8, 8);
    graphics.destroy();
  }

  private claimReward() {
    const rewards = dailyRewardManager.claimReward();

    if (rewards) {
      // Play sound
      audioManager.playLevelUp();

      // Show reward animation
      this.showRewardAnimation(rewards);

      // Update UI after a short delay
      this.time.delayedCall(500, () => {
        this.refreshCalendar();
        this.updateUI();
      });
    }
  }

  private showRewardAnimation(rewards: Reward[]) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Particle burst from claim button
    if (!this.rewardParticles) {
      this.rewardParticles = this.add.particles(width / 2, height / 2 + 80, "reward_particle", {
        speed: { min: 100, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        blendMode: Phaser.BlendModes.ADD,
        tint: [0xffd700, 0x00ffff, 0xffff00],
        emitting: false,
      });
    }

    // Emit particles
    this.rewardParticles.explode(30);

    // Show reward popup
    const popup = this.add.container(width / 2, height / 2);
    popup.setDepth(100);

    // Popup background
    const popupBg = this.add.rectangle(0, 0, 250, 150, 0x1a1a2e);
    popupBg.setStrokeStyle(3, 0xffd700);

    // Title
    const title = this.add
      .text(0, -50, "REWARD CLAIMED!", {
        fontSize: "20px",
        color: "#FFD700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    popup.add([popupBg, title]);

    // Display rewards
    rewards.forEach((reward, index) => {
      const icon = this.getRewardIcon(reward.type);
      const color = this.getRewardColor(reward.type);
      const y = -15 + index * 35;

      const rewardText = this.add
        .text(0, y, `${icon} +${reward.amount}`, {
          fontSize: "22px",
          color: color,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      popup.add(rewardText);
    });

    // Animate popup
    popup.setScale(0.5);
    popup.setAlpha(0);

    this.tweens.add({
      targets: popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Fade out after delay
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: popup,
        alpha: 0,
        y: popup.y - 30,
        duration: 300,
        onComplete: () => popup.destroy(),
      });
    });
  }

  private refreshCalendar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Destroy existing cards
    this.dayCards.forEach((card) => card.destroy());
    this.dayCards = [];

    // Recreate calendar
    this.createCalendar(width, height);
  }

  private updateUI() {
    this.canClaim = dailyRewardManager.canClaimToday();

    // Update claim button
    if (this.claimButton) {
      const bg = this.claimButton.list[0] as Phaser.GameObjects.Rectangle;
      const text = this.claimButton.list[1] as Phaser.GameObjects.Text;

      if (this.canClaim) {
        bg.setFillStyle(0x4a9eff);
        bg.setStrokeStyle(2, 0x6bb6ff);
        text.setText("CLAIM REWARD");
        text.setColor("#ffffff");
      } else {
        bg.setFillStyle(0x444444);
        bg.setStrokeStyle(2, 0x555555);
        text.setText("COME BACK TOMORROW");
        text.setColor("#888888");
      }
    }

    this.updateTimer();
  }

  private updateTimer() {
    if (!this.timerText) return;

    if (this.canClaim) {
      this.timerText.setText("Your reward is ready!");
      this.timerText.setColor("#44ff44");
    } else {
      const timeString = dailyRewardManager.getFormattedTimeUntilNextClaim();
      this.timerText.setText(`Next reward in: ${timeString}`);
      this.timerText.setColor("#aaaaaa");
    }
  }
}

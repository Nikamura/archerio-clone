import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import { couponManager, CouponDefinition, CouponReward } from "../systems/CouponManager";
import { createBackButton } from "../ui/components/BackButton";
import { hapticManager } from "../systems/HapticManager";

/**
 * CouponScene - UI for entering and redeeming compensation coupons
 *
 * Features:
 * - Text input for coupon codes
 * - Redeem button with validation
 * - Animated reward reveal with teaser effect
 * - Error messages for invalid/used codes
 */
export default class CouponScene extends Phaser.Scene {
  // UI Elements
  private inputElement?: HTMLInputElement;
  private inputContainer?: HTMLDivElement;
  private redeemButton?: Phaser.GameObjects.Container;
  private messageText?: Phaser.GameObjects.Text;
  private rewardPopup?: Phaser.GameObjects.Container;
  private rewardParticles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: "CouponScene" });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Header
    this.createHeader(width);

    // Instructions
    this.createInstructions(width);

    // Input field (HTML element)
    this.createInputField(width, height);

    // Redeem button
    this.createRedeemButton(width, height);

    // Message text (for errors/success)
    this.createMessageText(width, height);

    // Back button
    this.createBackButton(width, height);

    // Create particle texture
    this.createParticleTexture();

    // Clean up on scene shutdown
    this.events.on("shutdown", this.cleanup, this);
  }

  private createHeader(width: number) {
    // Title
    this.add
      .text(width / 2, 40, "REDEEM COUPON", {
        fontSize: "28px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, 75, "Enter your compensation code", {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
  }

  private createInstructions(width: number) {
    this.add
      .text(
        width / 2,
        120,
        "Compensation codes are provided\nwhen something goes wrong.\nEach code can only be used once.",
        {
          fontSize: "12px",
          color: "#888888",
          align: "center",
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);
  }

  private createInputField(width: number, height: number) {
    // Get canvas position for proper HTML element placement
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();

    // Create container div for styling
    this.inputContainer = document.createElement("div");
    this.inputContainer.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
    `;

    // Create input element
    this.inputElement = document.createElement("input");
    this.inputElement.type = "text";
    this.inputElement.placeholder = "Enter code...";
    this.inputElement.maxLength = 30;
    this.inputElement.style.cssText = `
      width: 200px;
      padding: 12px 16px;
      font-size: 16px;
      font-family: monospace;
      text-align: center;
      text-transform: uppercase;
      background-color: #2a2a3e;
      color: #ffffff;
      border: 2px solid #444466;
      border-radius: 8px;
      outline: none;
      box-sizing: border-box;
    `;

    // Focus styling
    this.inputElement.addEventListener("focus", () => {
      this.inputElement!.style.borderColor = "#FFD700";
    });
    this.inputElement.addEventListener("blur", () => {
      this.inputElement!.style.borderColor = "#444466";
    });

    // Enter key to submit
    this.inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.attemptRedeem();
      }
    });

    this.inputContainer.appendChild(this.inputElement);
    document.body.appendChild(this.inputContainer);

    // Position the input - need to account for canvas scaling
    this.updateInputPosition(canvasRect, width, height);

    // Update position on resize
    this.scale.on("resize", () => {
      const newRect = canvas.getBoundingClientRect();
      this.updateInputPosition(newRect, width, height);
    });
  }

  private updateInputPosition(canvasRect: DOMRect, _gameWidth: number, gameHeight: number) {
    if (!this.inputContainer) return;

    // Calculate scale
    const scaleY = canvasRect.height / gameHeight;

    // Position at center of game, accounting for canvas offset and scale
    const inputY = 200; // Y position in game coordinates
    const top = canvasRect.top + window.scrollY + inputY * scaleY;

    this.inputContainer.style.top = `${top}px`;
    this.inputContainer.style.left = `${canvasRect.left + canvasRect.width / 2}px`;
  }

  private createRedeemButton(width: number, height: number) {
    const buttonY = height / 2 - 50;

    this.redeemButton = this.add.container(width / 2, buttonY);

    // Button background
    const bg = this.add.rectangle(0, 0, 180, 50, 0x4a9eff);
    bg.setStrokeStyle(2, 0x6bb6ff);

    // Button text
    const text = this.add
      .text(0, 0, "REDEEM", {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.redeemButton.add([bg, text]);

    // Make interactive
    bg.setInteractive({ useHandCursor: true });

    // Hover effects
    bg.on("pointerover", () => {
      bg.setFillStyle(0x6bb6ff);
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(0x4a9eff);
    });

    // Click handler
    bg.on("pointerdown", () => {
      this.attemptRedeem();
    });
  }

  private createMessageText(width: number, height: number) {
    this.messageText = this.add
      .text(width / 2, height / 2 + 20, "", {
        fontSize: "14px",
        color: "#ff4444",
        align: "center",
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
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffd700, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture("coupon_particle", 8, 8);
    graphics.destroy();
  }

  private attemptRedeem() {
    if (!this.inputElement) return;

    const code = this.inputElement.value.trim();

    if (!code) {
      this.showMessage("Please enter a coupon code", "#ff4444");
      return;
    }

    const result = couponManager.redeemCoupon(code);

    if (result.success && result.coupon && result.rewards) {
      // Clear input
      this.inputElement.value = "";

      // Hide message
      this.showMessage("", "#ffffff");

      // Show reward animation
      if (result.coupon.hasReveal && result.coupon.teaserDescription) {
        this.showTeaserRevealAnimation(result.coupon, result.rewards);
      } else {
        this.showRewardAnimation(result.coupon.description, result.rewards);
      }
    } else if (result.error === "already_redeemed") {
      this.showMessage("This code has already been redeemed!", "#ff8844");
      hapticManager.light();
    } else {
      this.showMessage("Invalid coupon code", "#ff4444");
      hapticManager.light();
    }
  }

  private showMessage(message: string, color: string) {
    if (this.messageText) {
      this.messageText.setText(message);
      this.messageText.setColor(color);
    }
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

  private formatRewardAmount(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toString();
  }

  private showTeaserRevealAnimation(coupon: CouponDefinition, rewards: CouponReward[]) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Play excited sound
    audioManager.playLevelUp();
    hapticManager.heavy();

    // Create popup container
    this.rewardPopup = this.add.container(width / 2, height / 2);
    this.rewardPopup.setDepth(100);

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8);
    overlay.setInteractive(); // Block clicks
    this.rewardPopup.add(overlay);

    // Popup background - sized for up to 3 rewards + sorry text + button
    const popupBg = this.add.rectangle(0, 0, 300, 280, 0x1a1a2e);
    popupBg.setStrokeStyle(4, 0xffd700);
    this.rewardPopup.add(popupBg);

    // "WOW!" title
    const wowText = this.add
      .text(0, -90, "WOW!!!", {
        fontSize: "32px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.rewardPopup.add(wowText);

    // Teaser amount (the fake big number)
    const teaserText = this.add
      .text(0, -30, coupon.teaserDescription!, {
        fontSize: "28px",
        color: "#44ff44",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.rewardPopup.add(teaserText);

    // Animate the popup in
    this.rewardPopup.setScale(0.5);
    this.rewardPopup.setAlpha(0);

    this.tweens.add({
      targets: this.rewardPopup,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: "Back.easeOut",
    });

    // Pulsing animation on teaser text
    this.tweens.add({
      targets: teaserText,
      scale: { from: 1, to: 1.1 },
      duration: 200,
      yoyo: true,
      repeat: 3,
    });

    // After 2 seconds, reveal the truth
    this.time.delayedCall(2000, () => {
      this.revealRealReward(coupon, rewards, teaserText, wowText);
    });
  }

  private revealRealReward(
    _coupon: CouponDefinition,
    rewards: CouponReward[],
    teaserText: Phaser.GameObjects.Text,
    wowText: Phaser.GameObjects.Text,
  ) {
    if (!this.rewardPopup) return;

    // Play a "whomp whomp" kind of sound effect (we'll use a different one)
    hapticManager.medium();

    // Change WOW to something more subdued
    this.tweens.add({
      targets: wowText,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        wowText.setText("Actually...");
        wowText.setFontSize("20px");
        wowText.setColor("#888888");
        this.tweens.add({
          targets: wowText,
          alpha: 1,
          duration: 200,
        });
      },
    });

    // Animate teaser text out and show individual rewards with icons
    this.tweens.add({
      targets: teaserText,
      scale: 0.7,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        // Hide the teaser text
        teaserText.setVisible(false);

        // Create individual reward lines with icons
        const startY = -35;
        const lineHeight = 28;
        rewards.forEach((reward, index) => {
          const icon = this.getRewardIcon(reward.type);
          const color = this.getRewardColor(reward.type);
          const amount = this.formatRewardAmount(reward.amount);
          const y = startY + index * lineHeight;

          const rewardLine = this.add
            .text(0, y, `${icon} +${amount}`, {
              fontSize: "20px",
              color: color,
              fontStyle: "bold",
            })
            .setOrigin(0.5)
            .setAlpha(0)
            .setScale(0.5);

          this.rewardPopup!.add(rewardLine);

          // Staggered animation for each reward
          this.tweens.add({
            targets: rewardLine,
            alpha: 1,
            scale: 1,
            duration: 200,
            delay: index * 100,
            ease: "Back.easeOut",
          });
        });
      },
    });

    // Add "Sorry!" text - adjust Y based on number of rewards
    const sorryY = -35 + rewards.length * 28 + 15;
    const buttonY = sorryY + 45;
    const sorryText = this.add
      .text(0, sorryY, "(Sorry about that!)", {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.rewardPopup.add(sorryText);

    this.time.delayedCall(600 + rewards.length * 100, () => {
      this.tweens.add({
        targets: sorryText,
        alpha: 1,
        duration: 300,
      });
    });

    // Add OK button
    this.time.delayedCall(800 + rewards.length * 100, () => {
      this.addCloseButton(rewards, buttonY);
    });
  }

  private showRewardAnimation(_description: string, rewards: CouponReward[]) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Play sound
    audioManager.playLevelUp();
    hapticManager.heavy();

    // Calculate popup height based on number of rewards
    const popupHeight = 140 + rewards.length * 30;

    // Create popup
    this.rewardPopup = this.add.container(width / 2, height / 2);
    this.rewardPopup.setDepth(100);

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8);
    overlay.setInteractive();
    this.rewardPopup.add(overlay);

    // Popup background
    const popupBg = this.add.rectangle(0, 0, 280, popupHeight, 0x1a1a2e);
    popupBg.setStrokeStyle(3, 0xffd700);
    this.rewardPopup.add(popupBg);

    // Title
    const title = this.add
      .text(0, -popupHeight / 2 + 30, "COUPON REDEEMED!", {
        fontSize: "22px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.rewardPopup.add(title);

    // Display individual rewards with icons
    const startY = -popupHeight / 2 + 70;
    const lineHeight = 30;
    rewards.forEach((reward, index) => {
      const icon = this.getRewardIcon(reward.type);
      const color = this.getRewardColor(reward.type);
      const amount = this.formatRewardAmount(reward.amount);
      const y = startY + index * lineHeight;

      const rewardLine = this.add
        .text(0, y, `${icon} +${amount}`, {
          fontSize: "20px",
          color: color,
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.rewardPopup!.add(rewardLine);
    });

    // Calculate OK button position
    const buttonY = popupHeight / 2 - 30;

    // Animate in
    this.rewardPopup.setScale(0.5);
    this.rewardPopup.setAlpha(0);

    this.tweens.add({
      targets: this.rewardPopup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.addCloseButton(rewards, buttonY);
      },
    });

    // Particle burst
    this.showParticles();
  }

  private addCloseButton(_rewards: CouponReward[], buttonY: number = 70) {
    if (!this.rewardPopup) return;

    // OK button
    const btnBg = this.add.rectangle(0, buttonY, 120, 40, 0x4a9eff);
    btnBg.setStrokeStyle(2, 0x6bb6ff);
    const btnText = this.add
      .text(0, buttonY, "OK", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.rewardPopup.add([btnBg, btnText]);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on("pointerover", () => btnBg.setFillStyle(0x6bb6ff));
    btnBg.on("pointerout", () => btnBg.setFillStyle(0x4a9eff));
    btnBg.on("pointerdown", () => {
      this.closePopup();
    });
  }

  private closePopup() {
    if (!this.rewardPopup) return;

    this.tweens.add({
      targets: this.rewardPopup,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      onComplete: () => {
        this.rewardPopup?.destroy();
        this.rewardPopup = undefined;
      },
    });
  }

  private showParticles() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    if (!this.rewardParticles) {
      this.rewardParticles = this.add.particles(width / 2, height / 2, "coupon_particle", {
        speed: { min: 100, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        blendMode: Phaser.BlendModes.ADD,
        tint: [0xffd700, 0x44ff44, 0x00ffff],
        emitting: false,
      });
      this.rewardParticles.setDepth(101);
    }

    this.rewardParticles.explode(40);
  }

  private cleanup() {
    // Remove HTML elements
    if (this.inputContainer && this.inputContainer.parentNode) {
      this.inputContainer.parentNode.removeChild(this.inputContainer);
    }
    this.inputElement = undefined;
    this.inputContainer = undefined;

    // Destroy popup if exists
    this.rewardPopup?.destroy();
    this.rewardPopup = undefined;
  }
}

import Phaser from "phaser";
import { audioManager } from "../../systems/AudioManager";

export interface SecondChancePopupConfig {
  scene: Phaser.Scene;
  onAccept: () => void;
  onDecline: () => void;
}

export interface SecondChancePopupResult {
  destroy: () => void;
}

/**
 * SecondChancePopup - Shows a second chance offer before displaying game over rewards
 * This popup appears immediately after death, giving players a chance to continue
 * before seeing their final score and rewards.
 */
export function showSecondChancePopup(config: SecondChancePopupConfig): SecondChancePopupResult {
  const { scene, onAccept, onDecline } = config;
  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;

  const elements: Phaser.GameObjects.GameObject[] = [];

  // Create dark overlay
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9);
  overlay.setDepth(200);
  overlay.setInteractive(); // Block clicks on background
  elements.push(overlay);

  // Popup container background
  const popupWidth = 300;
  const popupHeight = 280;
  const popupBg = scene.add.rectangle(width / 2, height / 2, popupWidth, popupHeight, 0x1a1a2e, 1);
  popupBg.setStrokeStyle(3, 0xff9900);
  popupBg.setDepth(201);
  elements.push(popupBg);

  // Skull/death icon using graphics
  const iconGraphics = scene.add.graphics();
  iconGraphics.setDepth(202);
  elements.push(iconGraphics);

  const iconX = width / 2;
  const iconY = height / 2 - 70;

  // Draw a simple respawn/revive icon (circular arrow)
  iconGraphics.lineStyle(4, 0xff9900);
  iconGraphics.beginPath();
  iconGraphics.arc(iconX, iconY, 30, -Math.PI * 0.7, Math.PI * 0.5, false);
  iconGraphics.strokePath();

  // Arrow head
  iconGraphics.fillStyle(0xff9900);
  iconGraphics.fillTriangle(iconX + 26, iconY + 20, iconX + 35, iconY + 8, iconX + 18, iconY + 8);

  // Title text
  const titleText = scene.add.text(width / 2, height / 2 - 15, "YOU DIED", {
    fontSize: "28px",
    fontFamily: "Arial",
    color: "#ff4444",
    fontStyle: "bold",
  });
  titleText.setOrigin(0.5);
  titleText.setDepth(202);
  elements.push(titleText);

  // Subtitle
  const subtitleText = scene.add.text(width / 2, height / 2 + 15, "Continue where you left off?", {
    fontSize: "16px",
    fontFamily: "Arial",
    color: "#ffffff",
  });
  subtitleText.setOrigin(0.5);
  subtitleText.setDepth(202);
  elements.push(subtitleText);

  // Second Chance button (orange)
  const acceptButtonWidth = 220;
  const acceptButtonHeight = 45;
  const acceptButtonY = height / 2 + 65;

  const acceptButton = scene.add.rectangle(
    width / 2,
    acceptButtonY,
    acceptButtonWidth,
    acceptButtonHeight,
    0xff9900,
    1,
  );
  acceptButton.setDepth(202);
  acceptButton.setInteractive({ useHandCursor: true });
  elements.push(acceptButton);

  // Play icon (triangle)
  const playIcon = scene.add.graphics();
  playIcon.fillStyle(0xffffff, 1);
  playIcon.fillTriangle(
    width / 2 - 85,
    acceptButtonY - 8,
    width / 2 - 85,
    acceptButtonY + 8,
    width / 2 - 70,
    acceptButtonY,
  );
  playIcon.setDepth(203);
  elements.push(playIcon);

  const acceptText = scene.add.text(width / 2 + 10, acceptButtonY, "SECOND CHANCE", {
    fontSize: "18px",
    fontFamily: "Arial",
    color: "#ffffff",
    fontStyle: "bold",
  });
  acceptText.setOrigin(0.5);
  acceptText.setDepth(203);
  elements.push(acceptText);

  // Decline button (gray/subtle)
  const declineButtonY = height / 2 + 115;

  const declineButton = scene.add.rectangle(width / 2, declineButtonY, 180, 35, 0x333344, 1);
  declineButton.setDepth(202);
  declineButton.setInteractive({ useHandCursor: true });
  elements.push(declineButton);

  const declineText = scene.add.text(width / 2, declineButtonY, "No thanks", {
    fontSize: "14px",
    fontFamily: "Arial",
    color: "#888888",
  });
  declineText.setOrigin(0.5);
  declineText.setDepth(203);
  elements.push(declineText);

  // Button hover effects
  acceptButton.on("pointerover", () => acceptButton.setFillStyle(0xffaa33));
  acceptButton.on("pointerout", () => acceptButton.setFillStyle(0xff9900));

  declineButton.on("pointerover", () => {
    declineButton.setFillStyle(0x444455);
    declineText.setColor("#aaaaaa");
  });
  declineButton.on("pointerout", () => {
    declineButton.setFillStyle(0x333344);
    declineText.setColor("#888888");
  });

  const destroy = () => {
    elements.forEach((el) => el.destroy());
  };

  // Button click handlers
  acceptButton.on("pointerdown", () => {
    console.log("SecondChancePopup: Accept clicked");
    audioManager.playMenuSelect();
    destroy();
    onAccept();
  });

  declineButton.on("pointerdown", () => {
    console.log("SecondChancePopup: Decline clicked");
    audioManager.playMenuSelect();
    destroy();
    onDecline();
  });

  return { destroy };
}

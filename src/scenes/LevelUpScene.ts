import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import { DURATION, EASING } from "../systems/UIAnimations";
import { errorReporting } from "../systems/ErrorReportingManager";
import { ScrollContainer } from "../ui/components/ScrollContainer";
import { abilityPriorityManager } from "../systems/AbilityPriorityManager";
import { ABILITIES, AbilityData } from "../config/abilityData";

// Re-export for backward compatibility
export { ABILITIES };
export type { AbilityData };

export interface LevelUpData {
  playerLevel: number;
  abilityLevels?: Record<string, number>; // Current level of each ability
  hasExtraLife?: boolean; // Whether player currently has an extra life available
}

export default class LevelUpScene extends Phaser.Scene {
  private abilityCards: Phaser.GameObjects.Container[] = [];
  private modalContainer!: Phaser.GameObjects.Container;
  private selectedAbilities: AbilityData[] = [];
  private isSelecting: boolean = false;
  private abilityLevels: Record<string, number> = {};
  private hasExtraLife: boolean = false;
  private isDebugMode: boolean = false;
  private scrollContainer?: ScrollContainer;
  private pointerDownPositions: Map<number, { x: number; y: number }> = new Map();

  constructor() {
    super({ key: "LevelUpScene" });
  }

  init(data: LevelUpData) {
    this.abilityCards = [];
    this.selectedAbilities = [];
    this.isSelecting = false;
    this.abilityLevels = data.abilityLevels ?? {};
    this.hasExtraLife = data.hasExtraLife ?? false;
    this.scrollContainer = undefined;
  }

  create() {
    try {
      const width = this.cameras.main.width;
      const height = this.cameras.main.height;

      this.events.once("shutdown", this.shutdown, this);

      // Ensure input works
      this.input.enabled = true;
      this.input.setTopOnly(false);
      this.scene.bringToTop();

      if (this.game.canvas) {
        this.game.canvas.style.pointerEvents = "auto";
        if (this.game.canvas.parentElement) {
          this.game.canvas.parentElement.style.pointerEvents = "auto";
        }
      }

      // Dark overlay
      const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
      bg.setInteractive();
      bg.setDepth(-1);

      this.tweens.add({
        targets: bg,
        alpha: 0.85,
        duration: DURATION.FAST,
        ease: EASING.EASE_OUT,
      });

      // Main modal container
      this.modalContainer = this.add.container(width / 2, height / 2);
      this.modalContainer.setDepth(10);
      this.modalContainer.setScale(0.8);
      this.modalContainer.setAlpha(0);

      // Modal background
      const modalWidth = width - 40;
      const modalHeight = 320;
      const modalBg = this.add.graphics();
      modalBg.fillStyle(0x1a1a2e, 0.98);
      modalBg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
      modalBg.lineStyle(2, 0x4a4a6a, 1);
      modalBg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
      this.modalContainer.add(modalBg);

      // Title
      const title = this.add
        .text(0, -modalHeight / 2 + 30, "LEVEL UP", {
          fontSize: "24px",
          color: "#ffdd00",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      title.setStroke("#000000", 3);
      this.modalContainer.add(title);

      // Check for debug mode
      this.isDebugMode = this.game.registry.get("debug") === true;

      // Subtitle
      const subtitleText = this.isDebugMode ? "DEBUG: All abilities (scroll)" : "Choose an ability";
      const subtitle = this.add
        .text(0, -modalHeight / 2 + 55, subtitleText, {
          fontSize: "12px",
          color: this.isDebugMode ? "#ff6666" : "#888888",
        })
        .setOrigin(0.5);
      this.modalContainer.add(subtitle);

      // Select abilities based on mode
      if (this.isDebugMode) {
        // Debug mode: show ALL available abilities (filtered by max level)
        this.selectedAbilities = ABILITIES.filter((ability) => {
          const currentLevel = this.abilityLevels[ability.id] ?? 0;

          // Special case for extra_life: only show if player doesn't have one
          if (ability.id === "extra_life") {
            return !this.hasExtraLife;
          }

          // Check max level for ALL abilities with a defined maxLevel
          // This prevents abilities like Ascetic (maxLevel: 1) from appearing again
          if (ability.maxLevel !== undefined && currentLevel >= ability.maxLevel) {
            return false;
          }

          return true;
        });
      } else {
        // Normal mode: 3 random abilities
        this.selectedAbilities = this.selectRandomAbilities(3);
      }

      // Create ability cards
      const cardWidth = modalWidth - 30;
      const cardHeight = 60;
      const cardSpacing = 70;

      if (this.isDebugMode) {
        // Debug mode: scrollable list
        this.createScrollableAbilityList(
          modalWidth,
          modalHeight,
          cardWidth,
          cardHeight,
          cardSpacing,
        );
      } else {
        // Normal mode: fixed 3 cards
        const startY = -40;
        this.selectedAbilities.forEach((ability, index) => {
          const y = startY + index * cardSpacing;
          this.createAbilityCard(0, y, cardWidth, cardHeight, ability, index);
        });
      }

      // Animate modal in
      this.tweens.add({
        targets: this.modalContainer,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: "Back.easeOut",
      });

      console.log("LevelUpScene: Created (modern modal)");
    } catch (error) {
      console.error("LevelUpScene: Error in create:", error);
      this.scene.stop("LevelUpScene");
    }
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    // Filter out abilities that have reached their max level
    const availableAbilities = ABILITIES.filter((ability) => {
      const currentLevel = this.abilityLevels[ability.id] ?? 0;

      // Special case for extra_life: only show if player doesn't have one
      // (can only level up extra_life again after it's been used)
      if (ability.id === "extra_life") {
        return !this.hasExtraLife;
      }

      // Check max level for ALL abilities with a defined maxLevel
      // This prevents one-time abilities (like through_wall) from being offered again
      if (ability.maxLevel !== undefined && currentLevel >= ability.maxLevel) {
        return false;
      }

      // No max level or below max level, available
      return true;
    });

    const shuffled = [...availableAbilities].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private createScrollableAbilityList(
    modalWidth: number,
    modalHeight: number,
    cardWidth: number,
    cardHeight: number,
    cardSpacing: number,
  ) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Visible area dimensions (leave room for title and padding)
    const scrollTop = height / 2 - modalHeight / 2 + 70; // Below title
    const scrollBottom = height / 2 + modalHeight / 2 - 20; // Above bottom padding

    // Create ScrollContainer using the reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      x: width / 2,
      y: scrollTop,
      width: modalWidth - 20,
      bounds: { top: scrollTop, bottom: scrollBottom },
      depth: 15,
    });

    // Create all ability cards inside scroll container
    const totalHeight = this.selectedAbilities.length * cardSpacing;
    const startY = cardHeight / 2 + 10; // Start from top with padding

    this.selectedAbilities.forEach((ability, index) => {
      const y = startY + index * cardSpacing;
      this.createAbilityCardInContainer(
        this.scrollContainer!.getContainer(),
        0,
        y,
        cardWidth,
        cardHeight,
        ability,
        index,
      );
    });

    // Set content height for scroll calculations
    this.scrollContainer.setContentHeight(totalHeight + 20);

    // Add scroll indicator if content is scrollable
    if (this.scrollContainer.getMaxScroll() > 0) {
      const scrollHint = this.add
        .text(0, modalHeight / 2 - 15, "↑↓ Scroll for more", {
          fontSize: "10px",
          color: "#666688",
        })
        .setOrigin(0.5);
      this.modalContainer.add(scrollHint);
    }
  }

  private createAbilityCardInContainer(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    ability: AbilityData,
    index: number,
  ) {
    try {
      const cardContainer = this.add.container(x, y);
      cardContainer.setDepth(10 + index);

      // Card background
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x252540, 1);
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

      // Left accent bar (ability color)
      cardBg.fillStyle(ability.color, 1);
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
        tl: 10,
        bl: 10,
        tr: 0,
        br: 0,
      });

      cardContainer.add(cardBg);

      // Interactive area
      const hitArea = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      cardContainer.add(hitArea);

      // Icon
      const iconX = -cardWidth / 2 + 40;
      if (this.textures.exists(ability.iconKey)) {
        const icon = this.add.image(iconX, 0, ability.iconKey);
        icon.setDisplaySize(36, 36);
        cardContainer.add(icon);
      } else {
        const iconCircle = this.add.circle(iconX, 0, 16, ability.color);
        cardContainer.add(iconCircle);
      }

      // Name
      const nameText = this.add
        .text(iconX + 35, -10, ability.name, {
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      cardContainer.add(nameText);

      // Description
      const descText = this.add
        .text(iconX + 35, 10, ability.description, {
          fontSize: "12px",
          color: "#888888",
        })
        .setOrigin(0, 0.5);
      cardContainer.add(descText);

      // Current level indicator (useful in debug mode)
      const currentLevel = this.abilityLevels[ability.id] ?? 0;

      // Priority number indicator
      const priorityOrder = abilityPriorityManager.getPriorityOrder();
      const priorityIndex = priorityOrder.indexOf(ability.id);
      const priorityNum = priorityIndex !== -1 ? priorityIndex + 1 : priorityOrder.length + 1;

      // Determine if this is the highest priority among the shown options
      const highestPriority = abilityPriorityManager.getHighestPriorityAbility(
        this.selectedAbilities,
        this.abilityLevels,
      );
      const isHighestPriority = highestPriority?.id === ability.id;

      // Combined level and priority display
      let infoText = `#${priorityNum}`;
      if (currentLevel > 0) {
        infoText = `Lv${currentLevel} #${priorityNum}`;
      }

      const levelPriorityText = this.add
        .text(cardWidth / 2 - 25, 0, infoText, {
          fontSize: "11px",
          color: isHighestPriority ? "#ffdd00" : "#666688",
          fontStyle: isHighestPriority ? "bold" : "normal",
        })
        .setOrigin(0.5);
      cardContainer.add(levelPriorityText);

      // Hover effects
      hitArea.on("pointerover", () => {
        this.tweens.add({
          targets: cardContainer,
          scale: 1.02,
          duration: 100,
          ease: "Power2.easeOut",
        });
        cardBg.clear();
        cardBg.fillStyle(0x303050, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        cardBg.fillStyle(ability.color, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
          tl: 10,
          bl: 10,
          tr: 0,
          br: 0,
        });
      });

      hitArea.on("pointerout", () => {
        this.tweens.add({
          targets: cardContainer,
          scale: 1,
          duration: 100,
          ease: "Power2.easeOut",
        });
        cardBg.clear();
        cardBg.fillStyle(0x252540, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        cardBg.fillStyle(ability.color, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
          tl: 10,
          bl: 10,
          tr: 0,
          br: 0,
        });
      });

      // Click handler - track pointer down position for scroll detection
      hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.pointerDownPositions.set(pointer.id, { x: pointer.x, y: pointer.y });
      });

      hitArea.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        const downPos = this.pointerDownPositions.get(pointer.id);
        if (!downPos) return;

        // Calculate distance moved
        const dx = pointer.x - downPos.x;
        const dy = pointer.y - downPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only select if pointer didn't move much (threshold: 10px)
        // If moved more, it was a scroll/drag, not a click
        if (distance < 10) {
          console.log("LevelUpScene: Selected", ability.id);
          this.tweens.add({
            targets: cardContainer,
            scale: 1.05,
            duration: 80,
            yoyo: true,
            ease: "Power2.easeOut",
            onComplete: () => {
              this.selectAbility(ability.id, cardContainer);
            },
          });
        }

        this.pointerDownPositions.delete(pointer.id);
      });

      // Add to scroll container
      container.add(cardContainer);
      this.abilityCards.push(cardContainer);
    } catch (error) {
      console.error("LevelUpScene: Error creating card in container:", error);
    }
  }

  private createAbilityCard(
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    ability: AbilityData,
    index: number,
  ) {
    try {
      const container = this.add.container(x, y);
      container.setDepth(10 + index);

      // Card background
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x252540, 1);
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

      // Left accent bar (ability color)
      cardBg.fillStyle(ability.color, 1);
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
        tl: 10,
        bl: 10,
        tr: 0,
        br: 0,
      });

      container.add(cardBg);

      // Interactive area
      const hitArea = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      container.add(hitArea);

      // Icon
      const iconX = -cardWidth / 2 + 40;
      if (this.textures.exists(ability.iconKey)) {
        const icon = this.add.image(iconX, 0, ability.iconKey);
        icon.setDisplaySize(36, 36);
        container.add(icon);
      } else {
        const iconCircle = this.add.circle(iconX, 0, 16, ability.color);
        container.add(iconCircle);
      }

      // Name
      const nameText = this.add
        .text(iconX + 35, -10, ability.name, {
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      container.add(nameText);

      // Description
      const descText = this.add
        .text(iconX + 35, 10, ability.description, {
          fontSize: "12px",
          color: "#888888",
        })
        .setOrigin(0, 0.5);
      container.add(descText);

      // Priority number indicator
      const priorityOrder = abilityPriorityManager.getPriorityOrder();
      const priorityIndex = priorityOrder.indexOf(ability.id);
      const priorityNum = priorityIndex !== -1 ? priorityIndex + 1 : priorityOrder.length + 1;

      // Determine if this is the highest priority among the shown options
      const highestPriority = abilityPriorityManager.getHighestPriorityAbility(
        this.selectedAbilities,
        this.abilityLevels,
      );
      const isHighestPriority = highestPriority?.id === ability.id;

      const priorityText = this.add
        .text(cardWidth / 2 - 20, 0, `#${priorityNum}`, {
          fontSize: "12px",
          color: isHighestPriority ? "#ffdd00" : "#666688",
          fontStyle: isHighestPriority ? "bold" : "normal",
        })
        .setOrigin(0.5);
      container.add(priorityText);

      // Hover effects
      hitArea.on("pointerover", () => {
        this.tweens.add({
          targets: container,
          scale: 1.02,
          duration: 100,
          ease: "Power2.easeOut",
        });
        cardBg.clear();
        cardBg.fillStyle(0x303050, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        cardBg.fillStyle(ability.color, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
          tl: 10,
          bl: 10,
          tr: 0,
          br: 0,
        });
      });

      hitArea.on("pointerout", () => {
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: 100,
          ease: "Power2.easeOut",
        });
        cardBg.clear();
        cardBg.fillStyle(0x252540, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        cardBg.fillStyle(ability.color, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, {
          tl: 10,
          bl: 10,
          tr: 0,
          br: 0,
        });
      });

      // Click handler
      hitArea.on("pointerdown", () => {
        console.log("LevelUpScene: Selected", ability.id);
        this.tweens.add({
          targets: container,
          scale: 1.05,
          duration: 80,
          yoyo: true,
          ease: "Power2.easeOut",
          onComplete: () => {
            this.selectAbility(ability.id, container);
          },
        });
      });

      // Add to modal
      this.modalContainer.add(container);
      this.abilityCards.push(container);
    } catch (error) {
      console.error("LevelUpScene: Error creating card:", error);
    }
  }

  private selectAbility(abilityId: string, selectedContainer?: Phaser.GameObjects.Container) {
    if (this.isSelecting) return;
    this.isSelecting = true;

    // Track ability selection in Sentry metrics
    const currentLevel = (this.abilityLevels[abilityId] ?? 0) + 1;
    errorReporting.trackAbilityAcquired(abilityId, currentLevel);
    errorReporting.addBreadcrumb("game", `Selected ability: ${abilityId}`);

    try {
      // Disable all interactions
      this.abilityCards.forEach((card) => {
        const hitArea = card.getAt(1) as Phaser.GameObjects.Rectangle;
        if (hitArea?.disableInteractive) {
          hitArea.disableInteractive();
        }
      });

      audioManager.playAbilitySelect();

      // Fade out unselected cards
      this.abilityCards.forEach((card) => {
        if (card !== selectedContainer) {
          this.tweens.add({
            targets: card,
            alpha: 0,
            x: -50,
            duration: 150,
            ease: "Power2.easeIn",
          });
        }
      });

      // Animate selected card
      if (selectedContainer) {
        this.tweens.add({
          targets: selectedContainer,
          scale: 1.1,
          duration: 150,
          ease: "Power2.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: this.modalContainer,
              alpha: 0,
              scale: 0.9,
              duration: 150,
              ease: "Power2.easeIn",
              onComplete: () => {
                this.finishSelection(abilityId);
              },
            });
          },
        });
      } else {
        this.tweens.add({
          targets: this.modalContainer,
          alpha: 0,
          scale: 0.9,
          duration: 150,
          ease: "Power2.easeIn",
          onComplete: () => {
            this.finishSelection(abilityId);
          },
        });
      }
    } catch (error) {
      console.error("LevelUpScene: Error in selectAbility:", error);
      this.scene.stop("LevelUpScene");
    }
  }

  private finishSelection(abilityId: string) {
    try {
      console.log("LevelUpScene: Finishing selection");
      this.scene.stop("LevelUpScene");
      this.game.events.emit("abilitySelected", abilityId);
    } catch (error) {
      console.error("LevelUpScene: Error in finishSelection:", error);
      try {
        this.scene.stop("LevelUpScene");
      } catch (stopError) {
        console.error("LevelUpScene: Error stopping scene:", stopError);
      }
    }
  }

  shutdown() {
    // Clean up scroll container if in debug mode
    if (this.scrollContainer) {
      this.scrollContainer.destroy();
      this.scrollContainer = undefined;
    }

    this.input.removeAllListeners();

    this.abilityCards.forEach((card) => {
      const hitArea = card.getAt(1) as Phaser.GameObjects.Rectangle;
      if (hitArea?.input) {
        hitArea.removeAllListeners();
        hitArea.disableInteractive();
      }
    });
    this.abilityCards = [];

    this.tweens.killAll();
  }
}

import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import { DURATION, EASING } from "../systems/UIAnimations";
import { abilityPriorityManager } from "../systems/AbilityPriorityManager";
import { ABILITIES, AbilityData } from "../config/abilityData";
import { SeededRandom } from "../systems/SeededRandom";
import { ScrollContainer } from "../ui/components/ScrollContainer";

export interface StartingAbilityData {
  /** Number of starting abilities remaining to select */
  remainingSelections: number;
  /** Current selection number (1-indexed for display) */
  currentSelection: number;
  /** Total number of starting abilities from Glory talent */
  totalSelections: number;
  /** Seeded RNG for deterministic ability selection */
  rngState: number;
}

export default class StartingAbilityScene extends Phaser.Scene {
  private abilityCards: Phaser.GameObjects.Container[] = [];
  private modalContainer!: Phaser.GameObjects.Container;
  private selectedAbilities: AbilityData[] = [];
  private isSelecting: boolean = false;
  private remainingSelections: number = 1;
  private currentSelection: number = 1;
  private totalSelections: number = 1;
  private rng!: SeededRandom;
  private isDebugMode: boolean = false;
  private scrollContainer?: ScrollContainer;

  constructor() {
    super({ key: "StartingAbilityScene" });
  }

  init(data: StartingAbilityData) {
    this.abilityCards = [];
    this.selectedAbilities = [];
    this.isSelecting = false;
    this.isDebugMode = false;
    this.scrollContainer = undefined;
    this.remainingSelections = data.remainingSelections;
    this.currentSelection = data.currentSelection;
    this.totalSelections = data.totalSelections;
    // Restore RNG state for deterministic selection
    this.rng = new SeededRandom();
    this.rng.setState(data.rngState);
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

      // Check for debug mode
      this.isDebugMode = this.game.registry.get("debug") === true;

      // Modal background - taller in debug mode for scrolling
      const modalWidth = width - 40;
      const modalHeight = this.isDebugMode ? height - 80 : 340;
      const modalBg = this.add.graphics();
      modalBg.fillStyle(0x1a1a2e, 0.98);
      modalBg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
      modalBg.lineStyle(2, this.isDebugMode ? 0xff6666 : 0x8855ff, 1); // Red border in debug mode
      modalBg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
      this.modalContainer.add(modalBg);

      // Title with selection counter
      const titleText =
        this.totalSelections > 1
          ? `STARTING ABILITY ${this.currentSelection}/${this.totalSelections}`
          : "STARTING ABILITY";
      const title = this.add
        .text(0, -modalHeight / 2 + 30, titleText, {
          fontSize: "20px",
          color: this.isDebugMode ? "#ff6666" : "#bb88ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      title.setStroke("#000000", 3);
      this.modalContainer.add(title);

      // Subtitle
      const subtitleText = this.isDebugMode
        ? "DEBUG: All abilities (scroll)"
        : "Glory talent bonus - Choose wisely!";
      const subtitle = this.add
        .text(0, -modalHeight / 2 + 55, subtitleText, {
          fontSize: "12px",
          color: this.isDebugMode ? "#ff6666" : "#888888",
        })
        .setOrigin(0.5);
      this.modalContainer.add(subtitle);

      // Select abilities - all in debug mode, 3 random otherwise
      if (this.isDebugMode) {
        this.selectedAbilities = [...ABILITIES];
      } else {
        this.selectedAbilities = this.selectRandomAbilities(3);
      }

      // Create ability cards
      const cardWidth = modalWidth - 30;
      const cardHeight = 60;
      const cardSpacing = 70;

      if (this.isDebugMode) {
        // Debug mode: use scroll container for all abilities
        const scrollTop = height / 2 - modalHeight / 2 + 70;
        const scrollBottom = height / 2 + modalHeight / 2 - 40;

        this.scrollContainer = new ScrollContainer({
          scene: this,
          width,
          bounds: { top: scrollTop, bottom: scrollBottom },
          depth: 20, // Above modal (depth 10)
        });

        let currentY = scrollTop + 10;
        this.selectedAbilities.forEach((ability, index) => {
          const card = this.createAbilityCardForScroll(
            width / 2,
            currentY,
            cardWidth,
            cardHeight,
            ability,
            index,
          );
          this.scrollContainer!.add(card);
          this.abilityCards.push(card);
          currentY += cardSpacing;
        });

        const contentHeight = this.selectedAbilities.length * cardSpacing + 20;
        this.scrollContainer.setContentHeight(contentHeight);
      } else {
        // Normal mode: fixed cards in modal
        const startY = -30;
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

      console.log(
        `StartingAbilityScene: Created (selection ${this.currentSelection}/${this.totalSelections})`,
      );
    } catch (error) {
      console.error("StartingAbilityScene: Error in create:", error);
      this.scene.stop("StartingAbilityScene");
    }
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    // Shuffle using seeded RNG for deterministic selection
    const shuffled = [...ABILITIES].sort(() => this.rng.random() - 0.5);
    return shuffled.slice(0, count);
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
          fontSize: "11px",
          color: "#888888",
        })
        .setOrigin(0, 0.5);
      container.add(descText);

      // Priority number indicator
      const priorityOrder = abilityPriorityManager.getPriorityOrder();
      const priorityIndex = priorityOrder.indexOf(ability.id);
      const priorityNum = priorityIndex !== -1 ? priorityIndex + 1 : priorityOrder.length + 1;

      // Determine if this is the highest priority among the 3 options (no levels yet at start)
      const highestPriority = abilityPriorityManager.getHighestPriorityAbility(
        this.selectedAbilities,
        {},
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
        console.log("StartingAbilityScene: Selected", ability.id);
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
      console.error("StartingAbilityScene: Error creating card:", error);
    }
  }

  /**
   * Creates an ability card for debug mode scroll container (absolute positioning)
   */
  private createAbilityCardForScroll(
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    ability: AbilityData,
    _index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    // Depth is set by caller after creation

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
        fontSize: "11px",
        color: "#888888",
      })
      .setOrigin(0, 0.5);
    container.add(descText);

    // Hover effects
    hitArea.on("pointerover", () => {
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
      console.log("StartingAbilityScene: Selected", ability.id);
      this.selectAbility(ability.id, container);
    });

    return container;
  }

  private selectAbility(abilityId: string, selectedContainer?: Phaser.GameObjects.Container) {
    if (this.isSelecting) return;
    this.isSelecting = true;

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
      console.error("StartingAbilityScene: Error in selectAbility:", error);
      this.scene.stop("StartingAbilityScene");
    }
  }

  private finishSelection(abilityId: string) {
    try {
      console.log("StartingAbilityScene: Finishing selection");
      const newRemainingSelections = this.remainingSelections - 1;

      // Emit the selected ability with remaining count and current RNG state
      this.game.events.emit("startingAbilitySelected", {
        abilityId,
        remainingSelections: newRemainingSelections,
        rngState: this.rng.getState(),
      });

      this.scene.stop("StartingAbilityScene");
    } catch (error) {
      console.error("StartingAbilityScene: Error in finishSelection:", error);
      try {
        this.scene.stop("StartingAbilityScene");
      } catch (stopError) {
        console.error("StartingAbilityScene: Error stopping scene:", stopError);
      }
    }
  }

  shutdown() {
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

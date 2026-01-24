/**
 * EquipmentScene - Equipment management screen
 *
 * Displays equipped items, inventory grid, and allows
 * equipping/unequipping, upgrading, and fusing items.
 */

import Phaser from "phaser";
import {
  Equipment,
  EquipmentSlotType,
  EQUIPMENT_SLOTS,
  RARITY_CONFIGS,
  Rarity,
  PerkId,
  EquipmentStats,
} from "../systems/Equipment";
import {
  PERKS,
  calculateEquipmentStats,
  getEquipmentBaseData,
  calculatePerkQuality,
  getQualityColor,
  getQualityLabel,
} from "../config/equipmentData";
import { equipmentManager, EQUIPMENT_EVENTS } from "../systems/EquipmentManager";
import { currencyManager } from "../systems/CurrencyManager";
import { audioManager } from "../systems/AudioManager";
import * as UIAnimations from "../systems/UIAnimations";
import { createBackButton } from "../ui/components/BackButton";
import { ScrollContainer } from "../ui/components/ScrollContainer";
import { PlayerStats } from "../systems/PlayerStats";

// Slot display names
const SLOT_NAMES: Record<EquipmentSlotType, string> = {
  weapon: "Weapon",
  armor: "Armor",
  ring: "Ring",
  spirit: "Spirit",
};

// Slot icons (emoji fallback)
const SLOT_ICONS: Record<EquipmentSlotType, string> = {
  weapon: "⚔",
  armor: "🛡",
  ring: "💍",
  spirit: "👻",
};

interface InventorySlot {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  item: Equipment | null;
}

// Sort options for inventory
type SortOption = "rarity" | "level" | "slot";

// Rarity order for sorting (highest first)
const RARITY_ORDER: Record<Rarity, number> = {
  legendary: 5,
  epic: 4,
  rare: 3,
  great: 2,
  common: 1,
};

// Slot order for sorting
const SLOT_ORDER: Record<EquipmentSlotType, number> = {
  weapon: 1,
  armor: 2,
  ring: 3,
  spirit: 4,
};

export default class EquipmentScene extends Phaser.Scene {
  // Layout constants
  private readonly SLOT_SIZE = 70;
  private readonly SLOT_GAP = 10;
  private readonly INVENTORY_COLS = 4;
  private readonly INVENTORY_ROWS = 4;
  private readonly INVENTORY_SLOT_SIZE = 60;

  // UI elements
  private equippedSlots: Map<EquipmentSlotType, Phaser.GameObjects.Container> = new Map();
  private inventorySlots: InventorySlot[] = [];
  private detailPanel: Phaser.GameObjects.Container | null = null;
  private goldText: Phaser.GameObjects.Text | null = null;
  private fusionButton: Phaser.GameObjects.Text | null = null;
  private fuseAllButton: Phaser.GameObjects.Text | null = null;

  // Event handler references for cleanup
  private inventoryChangedHandler: (() => void) | null = null;
  private equippedChangedHandler: (() => void) | null = null;
  private itemUpgradedHandler: (() => void) | null = null;
  private itemFusedHandler: (() => void) | null = null;
  private itemSoldHandler: (() => void) | null = null;

  // Scroll container for inventory
  private scrollContainer?: ScrollContainer;

  // Sorting state
  private currentSort: SortOption = "rarity";
  private sortButtons: Map<SortOption, Phaser.GameObjects.Text> = new Map();

  constructor() {
    super({ key: "EquipmentScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Reset state from previous scene visits (Phaser reuses scene instances)
    this.inventorySlots = [];
    this.equippedSlots.clear();
    this.detailPanel = null;
    this.goldText = null;
    this.fusionButton = null;
    this.fuseAllButton = null;
    this.scrollContainer = undefined;
    this.sortButtons.clear();

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Header
    this.createHeader();

    // Equipped slots
    this.createEquippedSlots();

    // Inventory
    this.createInventory();

    // Gold display
    this.createGoldDisplay();

    // Back button
    this.createBackButton();

    // Listen for equipment changes
    this.setupEventListeners();

    // Ensure cleanup when scene shuts down (handles all transition types)
    this.events.once("shutdown", this.shutdown, this);

    // Initial render
    this.refreshDisplay();
  }

  private createHeader(): void {
    const { width } = this.cameras.main;

    this.add
      .text(width / 2, 30, "EQUIPMENT", {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Divider line
    this.add.rectangle(width / 2, 55, width - 40, 2, 0x444444);
  }

  private createEquippedSlots(): void {
    const { width } = this.cameras.main;
    const startY = 90;
    const totalWidth =
      EQUIPMENT_SLOTS.length * this.SLOT_SIZE + (EQUIPMENT_SLOTS.length - 1) * this.SLOT_GAP;
    const startX = (width - totalWidth) / 2 + this.SLOT_SIZE / 2;

    // Section label
    this.add
      .text(width / 2, startY - 15, "EQUIPPED", {
        fontSize: "12px",
        color: "#666666",
      })
      .setOrigin(0.5);

    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const x = startX + index * (this.SLOT_SIZE + this.SLOT_GAP);
      const y = startY + this.SLOT_SIZE / 2 + 10;

      const container = this.createEquippedSlot(x, y, slot);
      // Set high depth to ensure equipped slots are always clickable above inventory
      container.setDepth(10);
      this.equippedSlots.set(slot, container);
    });
  }

  private createEquippedSlot(
    x: number,
    y: number,
    slot: EquipmentSlotType,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.rectangle(0, 0, this.SLOT_SIZE, this.SLOT_SIZE, 0x2d2d44, 1);
    bg.setStrokeStyle(2, 0x444466);
    container.add(bg);

    // Slot icon (shown when empty)
    const icon = this.add
      .text(0, -5, SLOT_ICONS[slot], {
        fontSize: "24px",
      })
      .setOrigin(0.5);
    icon.setName("icon");
    container.add(icon);

    // Slot label
    const label = this.add
      .text(0, 25, SLOT_NAMES[slot], {
        fontSize: "10px",
        color: "#888888",
      })
      .setOrigin(0.5);
    container.add(label);

    // Item display (hidden by default)
    const itemBg = this.add.rectangle(0, 0, this.SLOT_SIZE - 8, this.SLOT_SIZE - 8, 0x333355, 1);
    itemBg.setVisible(false);
    itemBg.setName("itemBg");
    container.add(itemBg);

    const itemSprite = this.add.image(0, -5, "");
    itemSprite.setVisible(false);
    itemSprite.setName("itemSprite");
    container.add(itemSprite);

    const levelText = this.add
      .text(0, 20, "", {
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    levelText.setName("levelText");
    container.add(levelText);

    // Make interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.onEquippedSlotClick(slot));
    bg.on("pointerover", () => {
      bg.setFillStyle(0x3d3d54);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x2d2d44);
    });

    container.setData("slot", slot);
    return container;
  }

  private createInventory(): void {
    const { width, height } = this.cameras.main;
    const inventoryY = 230;
    const visibleHeight = height - inventoryY - 120; // Leave room for buttons

    // Section label with sort buttons
    this.add
      .text(20, inventoryY - 15, "INVENTORY", {
        fontSize: "12px",
        color: "#666666",
      })
      .setOrigin(0, 0.5);

    // Sort buttons (right-aligned)
    this.createSortButtons(inventoryY - 15);

    // Calculate layout
    const totalWidth =
      this.INVENTORY_COLS * this.INVENTORY_SLOT_SIZE + (this.INVENTORY_COLS - 1) * 8;
    const startX = (width - totalWidth) / 2 + this.INVENTORY_SLOT_SIZE / 2;

    // Create inventory slots - positions relative to scrollable area
    const inventory = equipmentManager.getInventory();
    const totalSlots = Math.max(this.INVENTORY_COLS * this.INVENTORY_ROWS, inventory.length + 8);
    const rows = Math.ceil(totalSlots / this.INVENTORY_COLS);

    // Start first row at half slot size to ensure it's fully visible within the mask
    const firstRowOffset = this.INVENTORY_SLOT_SIZE / 2 + 5;

    // Calculate content height for scroll container
    const contentHeight = firstRowOffset + rows * (this.INVENTORY_SLOT_SIZE + 8);

    // Create scroll container
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width: width,
      bounds: { top: inventoryY, bottom: inventoryY + visibleHeight },
    });
    this.scrollContainer.setContentHeight(contentHeight);

    // Create inventory slots inside scroll container
    for (let i = 0; i < totalSlots; i++) {
      const col = i % this.INVENTORY_COLS;
      const row = Math.floor(i / this.INVENTORY_COLS);
      const x = startX + col * (this.INVENTORY_SLOT_SIZE + 8);
      const y = inventoryY + firstRowOffset + row * (this.INVENTORY_SLOT_SIZE + 8);

      const slotData = this.createInventorySlot(x, y, i);
      this.inventorySlots.push(slotData);
      this.scrollContainer.add(slotData.container);
    }
  }

  private createSortButtons(y: number): void {
    const { width } = this.cameras.main;
    const sortOptions: { key: SortOption; label: string }[] = [
      { key: "rarity", label: "★" },
      { key: "level", label: "Lv" },
      { key: "slot", label: "⚔" },
    ];

    let xPos = width - 20;

    // Create buttons right-to-left
    for (let i = sortOptions.length - 1; i >= 0; i--) {
      const option = sortOptions[i];
      const isActive = this.currentSort === option.key;

      const btn = this.add
        .text(xPos, y, option.label, {
          fontSize: "14px",
          color: isActive ? "#4a9eff" : "#666666",
          backgroundColor: isActive ? "#1a2a3e" : undefined,
          padding: { x: 6, y: 2 },
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(100); // Above scroll container

      btn.on("pointerover", () => {
        if (this.currentSort !== option.key) {
          btn.setColor("#888888");
        }
      });

      btn.on("pointerout", () => {
        btn.setColor(this.currentSort === option.key ? "#4a9eff" : "#666666");
      });

      btn.on("pointerup", () => {
        this.setSort(option.key);
      });

      this.sortButtons.set(option.key, btn);
      xPos -= btn.width + 8;
    }

    // Add "Sort:" label
    this.add
      .text(xPos, y, "Sort:", {
        fontSize: "11px",
        color: "#555555",
      })
      .setOrigin(1, 0.5)
      .setDepth(100); // Above scroll container
  }

  private setSort(sort: SortOption): void {
    if (this.currentSort === sort) return;

    this.currentSort = sort;
    audioManager.playMenuSelect();

    // Update button visuals
    this.sortButtons.forEach((btn, key) => {
      const isActive = key === sort;
      btn.setColor(isActive ? "#4a9eff" : "#666666");
      btn.setBackgroundColor(isActive ? "#1a2a3e" : "#00000000"); // Transparent when inactive
    });

    // Refresh inventory with new sort
    this.refreshInventorySlots();
  }

  private sortInventory(items: Equipment[]): Equipment[] {
    return [...items].sort((a, b) => {
      switch (this.currentSort) {
        case "rarity": {
          // Sort by rarity (highest first), then level (highest first)
          const rarityDiff = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
          if (rarityDiff !== 0) return rarityDiff;
          return b.level - a.level;
        }

        case "level": {
          // Sort by level (highest first), then rarity
          const levelDiff = b.level - a.level;
          if (levelDiff !== 0) return levelDiff;
          return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        }

        case "slot": {
          // Sort by slot type, then rarity
          const slotDiff = SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot];
          if (slotDiff !== 0) return slotDiff;
          return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        }

        default:
          return 0;
      }
    });
  }

  private createInventorySlot(x: number, y: number, index: number): InventorySlot {
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.rectangle(
      0,
      0,
      this.INVENTORY_SLOT_SIZE,
      this.INVENTORY_SLOT_SIZE,
      0x252540,
      1,
    );
    bg.setStrokeStyle(1, 0x3a3a55);
    container.add(bg);

    // Item sprite (hidden by default)
    const itemSprite = this.add.image(0, -6, "");
    itemSprite.setVisible(false);
    itemSprite.setName("itemSprite");
    container.add(itemSprite);

    const levelText = this.add
      .text(0, 18, "", {
        fontSize: "9px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    levelText.setName("levelText");
    container.add(levelText);

    // Make interactive - use pointerup to properly detect scrolling vs clicking
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerup", () => {
      // Only trigger click if we weren't scrolling
      if (!this.scrollContainer?.isDragScrolling()) {
        this.onInventorySlotClick(index);
      }
    });
    bg.on("pointerover", () => {
      const slot = this.inventorySlots[index];
      if (slot && slot.item) {
        bg.setFillStyle(0x353550);
      }
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x252540);
    });

    return {
      container,
      background: bg,
      item: null,
    };
  }

  private createGoldDisplay(): void {
    const { width, height } = this.cameras.main;
    const gold = currencyManager.get("gold");

    this.goldText = this.add
      .text(20, height - 100, `Gold: ${gold}`, {
        fontSize: "16px",
        color: "#FFD700",
      })
      .setOrigin(0, 0.5)
      .setDepth(20); // Above inventory container

    // Fusion button
    this.fusionButton = this.add
      .text(width - 20, height - 100, "FUSE", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#6b4aa3",
        padding: { x: 15, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setDepth(20); // Above inventory container

    this.fusionButton.setInteractive({ useHandCursor: true });
    this.fusionButton.on("pointerdown", () => this.onFusionClick());
    UIAnimations.applyButtonEffects(this, this.fusionButton);

    // Fuse All button (to the left of FUSE)
    this.fuseAllButton = this.add
      .text(width - 90, height - 100, "FUSE ALL", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#6b4aa3",
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setDepth(20); // Above inventory container

    this.fuseAllButton.setInteractive({ useHandCursor: true });
    this.fuseAllButton.on("pointerdown", () => this.onFuseAllClick());
    UIAnimations.applyButtonEffects(this, this.fuseAllButton);

    this.updateFusionButton();
  }

  private createBackButton(): void {
    const { height } = this.cameras.main;

    const container = createBackButton({
      scene: this,
      y: height - 40,
      targetScene: "MainMenuScene",
      text: "BACK",
      depth: 20, // Above inventory container (depth 1) and equipped slots (depth 10)
      backgroundColor: 0x444455,
      hoverColor: 0x555566,
      fontSize: "18px",
    });

    // Apply button effects to the text child
    const textChild = container.first as Phaser.GameObjects.Text;
    UIAnimations.applyButtonEffects(this, textChild);
  }

  private setupEventListeners(): void {
    // Store handler references so we can properly unsubscribe in shutdown
    this.inventoryChangedHandler = () => {
      this.refreshDisplay();
    };
    this.equippedChangedHandler = () => {
      this.refreshDisplay();
    };
    this.itemUpgradedHandler = () => {
      this.refreshDisplay();
      this.updateGoldDisplay();
    };
    this.itemFusedHandler = () => {
      this.refreshDisplay();
      this.hideDetailPanel();
    };
    this.itemSoldHandler = () => {
      this.refreshDisplay();
      this.updateGoldDisplay();
    };

    equipmentManager.on(EQUIPMENT_EVENTS.INVENTORY_CHANGED, this.inventoryChangedHandler);
    equipmentManager.on(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, this.equippedChangedHandler);
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_UPGRADED, this.itemUpgradedHandler);
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_FUSED, this.itemFusedHandler);
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_SOLD, this.itemSoldHandler);
  }

  private refreshDisplay(): void {
    this.refreshEquippedSlots();
    this.refreshInventorySlots();
    this.updateFusionButton();
    this.updateGoldDisplay();
  }

  private refreshEquippedSlots(): void {
    EQUIPMENT_SLOTS.forEach((slot) => {
      const container = this.equippedSlots.get(slot);
      if (!container) return;

      const equipped = equipmentManager.getEquipped(slot);
      const icon = container.getByName("icon") as Phaser.GameObjects.Text | null;
      const itemBg = container.getByName("itemBg") as Phaser.GameObjects.Rectangle | null;
      const itemSprite = container.getByName("itemSprite") as Phaser.GameObjects.Image | null;
      const levelText = container.getByName("levelText") as Phaser.GameObjects.Text | null;
      const bg = container.list[0] as Phaser.GameObjects.Rectangle | undefined;

      // Guard against missing UI elements (can happen if scene not fully initialized)
      if (!icon || !itemBg || !itemSprite || !levelText || !bg) return;

      // Get or create quality indicator for equipped slot
      let qualityIndicator = container.getByName(
        "qualityIndicator",
      ) as Phaser.GameObjects.Text | null;
      if (!qualityIndicator) {
        qualityIndicator = this.add
          .text(-this.SLOT_SIZE / 2 + 4, -this.SLOT_SIZE / 2 + 4, "", {
            fontSize: "9px",
            fontStyle: "bold",
            backgroundColor: "#1a1a2e",
            padding: { x: 2, y: 0 },
          })
          .setOrigin(0, 0)
          .setName("qualityIndicator");
        container.add(qualityIndicator);
      }

      if (equipped) {
        // Show item
        icon.setVisible(false);
        itemBg.setVisible(true);
        itemSprite.setVisible(true);
        levelText.setVisible(true);

        // Set rarity color
        const rarityColor = Phaser.Display.Color.HexStringToColor(
          RARITY_CONFIGS[equipped.rarity].color,
        );
        itemBg.setStrokeStyle(2, rarityColor.color);
        bg.setStrokeStyle(2, rarityColor.color);

        // Set item sprite
        itemSprite.setTexture(`equip_${equipped.type}`);
        itemSprite.setScale((this.SLOT_SIZE - 20) / itemSprite.width);

        // Set level info
        levelText.setText(`Lv.${equipped.level}`);

        // Show perk quality indicator for items with perks
        const perkQuality = calculatePerkQuality(equipped.perks, equipped.rarity);
        if (perkQuality !== null) {
          const qualityColor = getQualityColor(perkQuality);
          qualityIndicator.setText(`${perkQuality}%`);
          qualityIndicator.setColor(qualityColor);
          qualityIndicator.setVisible(true);
        } else {
          qualityIndicator.setVisible(false);
        }
      } else {
        // Show empty slot
        icon.setVisible(true);
        itemBg.setVisible(false);
        itemSprite.setVisible(false);
        levelText.setVisible(false);
        bg.setStrokeStyle(2, 0x444466);
        qualityIndicator.setVisible(false);
      }
    });
  }

  private refreshInventorySlots(): void {
    const inventory = equipmentManager.getInventory();
    const allEquipped = equipmentManager.getAllEquipped();
    const equippedIds = new Set(
      Object.values(allEquipped)
        .filter((item): item is Equipment => item !== null)
        .map((item) => item.id),
    );

    // Filter out equipped items from inventory display and sort
    const unequippedInventory = inventory.filter((item) => !equippedIds.has(item.id));
    const sortedInventory = this.sortInventory(unequippedInventory);

    this.inventorySlots.forEach((slot, index) => {
      const item = sortedInventory[index] ?? null;
      slot.item = item;

      const itemSprite = slot.container.getByName("itemSprite") as Phaser.GameObjects.Image | null;
      const levelText = slot.container.getByName("levelText") as Phaser.GameObjects.Text | null;

      // Guard against missing UI elements (can happen if scene not fully initialized)
      if (!itemSprite || !levelText) return;

      // Get or create upgrade indicator
      let upgradeIndicator = slot.container.getByName(
        "upgradeIndicator",
      ) as Phaser.GameObjects.Text | null;
      if (!upgradeIndicator) {
        upgradeIndicator = this.add
          .text(
            this.INVENTORY_SLOT_SIZE / 2 - 2,
            -this.INVENTORY_SLOT_SIZE / 2 + 2,
            "\u2191", // Up arrow
            {
              fontSize: "14px",
              color: "#00ff88",
              fontStyle: "bold",
              backgroundColor: "#1a1a2e",
              padding: { x: 2, y: 0 },
            },
          )
          .setOrigin(1, 0)
          .setName("upgradeIndicator");
        slot.container.add(upgradeIndicator);
      }

      // Get or create quality indicator
      let qualityIndicator = slot.container.getByName(
        "qualityIndicator",
      ) as Phaser.GameObjects.Text | null;
      if (!qualityIndicator) {
        qualityIndicator = this.add
          .text(-this.INVENTORY_SLOT_SIZE / 2 + 2, -this.INVENTORY_SLOT_SIZE / 2 + 2, "", {
            fontSize: "9px",
            fontStyle: "bold",
            backgroundColor: "#1a1a2e",
            padding: { x: 2, y: 0 },
          })
          .setOrigin(0, 0)
          .setName("qualityIndicator");
        slot.container.add(qualityIndicator);
      }

      if (item) {
        const rarityColor = Phaser.Display.Color.HexStringToColor(
          RARITY_CONFIGS[item.rarity].color,
        );
        slot.background.setStrokeStyle(2, rarityColor.color);

        itemSprite.setTexture(`equip_${item.type}`);
        itemSprite.setScale((this.INVENTORY_SLOT_SIZE - 16) / itemSprite.width);
        itemSprite.setVisible(true);

        levelText.setText(`Lv.${item.level}`);
        levelText.setVisible(true);

        // Show upgrade indicator if this item is better than equipped
        const isUpgrade = this.isUpgradeOverEquipped(item);
        upgradeIndicator.setVisible(isUpgrade);

        // Show perk quality indicator for items with perks
        const perkQuality = calculatePerkQuality(item.perks, item.rarity);
        if (perkQuality !== null) {
          const qualityColor = getQualityColor(perkQuality);
          qualityIndicator.setText(`${perkQuality}%`);
          qualityIndicator.setColor(qualityColor);
          qualityIndicator.setVisible(true);
        } else {
          qualityIndicator.setVisible(false);
        }
      } else {
        slot.background.setStrokeStyle(1, 0x3a3a55);
        itemSprite.setVisible(false);
        levelText.setVisible(false);
        upgradeIndicator.setVisible(false);
        qualityIndicator.setVisible(false);
      }
    });
  }

  private onEquippedSlotClick(slot: EquipmentSlotType): void {
    audioManager.playMenuSelect();
    const equipped = equipmentManager.getEquipped(slot);

    if (equipped) {
      // Show detail panel with unequip option
      this.showDetailPanel(equipped, true);
    }
  }

  private onInventorySlotClick(index: number): void {
    const slot = this.inventorySlots[index];
    if (!slot || !slot.item) return;

    audioManager.playMenuSelect();
    this.showDetailPanel(slot.item, false);
  }

  private showDetailPanel(item: Equipment, isEquipped: boolean): void {
    this.hideDetailPanel();

    const { width, height } = this.cameras.main;
    const panelWidth = width - 40;

    // Calculate content height dynamically
    // Header section: sprite, name, rarity, level, divider = 130px
    const headerHeight = 130;
    // Stats section: combine base stats + perk stats, each stat takes 22px
    const combinedStats = this.getCombinedItemStats(item);
    const statsEntries = Object.entries(combinedStats).filter(
      ([_, value]) => value !== undefined && value !== 0,
    );
    let statsHeight = statsEntries.length * 22;
    // For inventory items, also account for "lost stats" from equipped item
    if (!isEquipped) {
      const equippedForHeight = equipmentManager.getEquipped(item.slot);
      if (equippedForHeight) {
        const equippedStats = this.getCombinedItemStats(equippedForHeight);
        for (const [stat, value] of Object.entries(equippedStats)) {
          if (value && value !== 0 && !combinedStats[stat as keyof EquipmentStats]) {
            statsHeight += 22; // Add height for each lost stat
          }
        }
      }
    }
    // Button section: buttons + padding
    const buttonSectionHeight = 60;
    // Total content height with padding
    const contentHeight = headerHeight + statsHeight + buttonSectionHeight + 40;

    const panelHeight = Math.max(280, contentHeight);
    const panelY = height / 2;

    this.detailPanel = this.add.container(width / 2, panelY);
    // Set high depth to ensure popup appears above inventory (depth 1) and equipped slots (depth 10)
    this.detailPanel.setDepth(100);

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    backdrop.setInteractive();
    backdrop.on("pointerdown", () => this.hideDetailPanel());
    this.detailPanel.add(backdrop);

    // Panel background
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e, 1);
    const rarityColor = Phaser.Display.Color.HexStringToColor(RARITY_CONFIGS[item.rarity].color);
    bg.setStrokeStyle(3, rarityColor.color);
    this.detailPanel.add(bg);

    // Close button
    const closeBtn = this.add
      .text(panelWidth / 2 - 20, -panelHeight / 2 + 20, "✕", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.hideDetailPanel());
    UIAnimations.applyButtonEffects(this, closeBtn);
    this.detailPanel.add(closeBtn);

    // Item large sprite - use setDisplaySize to avoid scaling issues with missing textures
    const largeSprite = this.add.image(
      -panelWidth / 2 + 60,
      -panelHeight / 2 + 70,
      `equip_${item.type}`,
    );
    largeSprite.setDisplaySize(80, 80);
    this.detailPanel.add(largeSprite);

    // Item name with rarity
    const rarityConfig = RARITY_CONFIGS[item.rarity];
    const nameText = this.add
      .text(-panelWidth / 2 + 110, -panelHeight / 2 + 50, item.name, {
        fontSize: "20px",
        color: rarityConfig.color,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.detailPanel.add(nameText);

    const rarityText = this.add
      .text(-panelWidth / 2 + 110, -panelHeight / 2 + 75, rarityConfig.name, {
        fontSize: "14px",
        color: rarityConfig.color,
      })
      .setOrigin(0, 0.5);
    this.detailPanel.add(rarityText);

    // Level and max level
    const levelInfo = this.add
      .text(
        -panelWidth / 2 + 110,
        -panelHeight / 2 + 95,
        `Level ${item.level} / ${rarityConfig.maxLevel}`,
        {
          fontSize: "12px",
          color: "#aaaaaa",
        },
      )
      .setOrigin(0, 0.5);
    this.detailPanel.add(levelInfo);

    // Perk quality indicator (only for items with perks)
    const perkQuality = calculatePerkQuality(item.perks, item.rarity);
    if (perkQuality !== null) {
      const qualityColor = getQualityColor(perkQuality);
      const qualityLabel = getQualityLabel(perkQuality);
      const qualityText = this.add
        .text(
          -panelWidth / 2 + 110,
          -panelHeight / 2 + 112,
          `Perk Quality: ${perkQuality}% (${qualityLabel})`,
          {
            fontSize: "11px",
            color: qualityColor,
          },
        )
        .setOrigin(0, 0.5);
      this.detailPanel.add(qualityText);
    }

    // Divider
    const divider = this.add.rectangle(0, -panelHeight / 2 + 130, panelWidth - 40, 1, 0x444466);
    this.detailPanel.add(divider);

    // Show "Next Lv" header if item can be upgraded
    const canUpgradeItem = equipmentManager.canUpgrade(item);
    if (canUpgradeItem.canUpgrade) {
      const nextLvLabel = this.add
        .text(panelWidth / 2 - 30, -panelHeight / 2 + 140, "Next Lv", {
          fontSize: "10px",
          color: "#66ccff",
        })
        .setOrigin(1, 0);
      this.detailPanel.add(nextLvLabel);
    }

    // Stats display with comparison for inventory items
    const statsY = -panelHeight / 2 + 150;
    let yOffset = 0;

    // Get comparison data if this is an inventory item (not equipped)
    const equippedItem = !isEquipped ? equipmentManager.getEquipped(item.slot) : null;
    const comparison = !isEquipped ? this.compareItemStats(item, equippedItem) : null;

    // Get level-up stat increases (only base stats increase, not perks)
    const levelUpIncreases = this.getNextLevelStatIncreases(item);

    statsEntries.forEach(([stat, value]) => {
      const statName = this.formatStatName(stat);
      const numValue = value as number;
      // Use correct sign based on actual value (negative stats like attackSpeedPercent can be negative)
      const sign = numValue >= 0 ? "+" : "";
      const baseText = `${statName}: ${sign}${this.formatStatValue(numValue, stat)}`;

      // Add comparison indicator for inventory items
      let displayText = baseText;
      // Color based on whether the stat value is positive (green) or negative (red)
      let textColor = numValue >= 0 ? "#88ff88" : "#ff6666";

      if (comparison && comparison.differences[stat] !== undefined) {
        const diff = comparison.differences[stat];
        if (diff > 0) {
          // This item is better
          displayText = `${baseText}  ▲${this.formatStatValue(diff, stat)}`;
          textColor = "#44ff44";
        } else if (diff < 0) {
          // This item is worse
          displayText = `${baseText}  ▼${this.formatStatValue(Math.abs(diff), stat)}`;
          textColor = "#ff6666";
        }
      } else if (comparison && equippedItem) {
        // Only show as a gain/loss if the equipped item doesn't have this stat
        // (If both items have the same value, diff is 0 and not in differences - don't show indicator)
        const equippedStats = this.getCombinedItemStats(equippedItem);
        const equippedHasStat =
          equippedStats[stat as keyof EquipmentStats] !== undefined &&
          equippedStats[stat as keyof EquipmentStats] !== 0;
        if (!equippedHasStat) {
          // Stat exists on this item but not on equipped - it's a new stat
          if (numValue >= 0) {
            displayText = `${baseText}  ▲${this.formatStatValue(numValue, stat)}`;
            textColor = "#44ff44";
          } else {
            displayText = `${baseText}  ▼${this.formatStatValue(Math.abs(numValue), stat)}`;
            textColor = "#ff6666";
          }
        }
        // If equippedHasStat is true and diff is 0, stats are equal - no indicator needed
      }

      const statText = this.add
        .text(-panelWidth / 2 + 30, statsY + yOffset, displayText, {
          fontSize: "14px",
          color: textColor,
        })
        .setOrigin(0, 0);
      this.detailPanel?.add(statText);

      // Show level-up increase preview for this stat (if applicable)
      if (levelUpIncreases) {
        const increase = (levelUpIncreases as Record<string, number>)[stat];
        if (increase && increase > 0) {
          // Position the level-up preview to the right of the stat text
          const levelUpText = this.add
            .text(
              panelWidth / 2 - 30,
              statsY + yOffset,
              `+${this.formatStatValue(increase, stat)}`,
              {
                fontSize: "12px",
                color: "#66ccff", // Cyan color for level-up preview
              },
            )
            .setOrigin(1, 0);
          this.detailPanel?.add(levelUpText);
        }
      }

      yOffset += 22;
    });

    // Show stats that are on equipped item but not on this item (what you'd lose)
    if (comparison && equippedItem) {
      const equippedStats = this.getCombinedItemStats(equippedItem);
      for (const [stat, value] of Object.entries(equippedStats)) {
        if (value && value !== 0 && !combinedStats[stat as keyof EquipmentStats]) {
          const statName = this.formatStatName(stat);
          // If losing a positive stat, show as loss (red). If losing a negative stat, show as gain (green)
          const isPositiveStat = value > 0;
          const lostText = this.add
            .text(
              -panelWidth / 2 + 30,
              statsY + yOffset,
              `${statName}: ${isPositiveStat ? "-" : "+"}${this.formatStatValue(Math.abs(value as number), stat)}  ${isPositiveStat ? "▼" : "▲"}`,
              {
                fontSize: "14px",
                color: isPositiveStat ? "#ff6666" : "#44ff44",
              },
            )
            .setOrigin(0, 0);
          this.detailPanel?.add(lostText);
          yOffset += 22;
        }
      }
    }

    // Action buttons - use smaller font and dynamic positioning
    const buttonY = panelHeight / 2 - 40;
    const buttonStyle = {
      fontSize: "14px",
      padding: { x: 10, y: 8 },
    };
    const buttonGap = 8;

    // Prepare upgrade button info (needed for both branches)
    const canUpgrade = equipmentManager.canUpgrade(item);
    const upgradeCost = equipmentManager.getUpgradeCost(item);
    const canAfford = currencyManager.canAfford("gold", upgradeCost.gold);
    const upgradeColor = canUpgrade.canUpgrade && canAfford ? "#4477aa" : "#333344";

    if (isEquipped) {
      // Two buttons: UNEQUIP and +LV - position them evenly
      const unequipBtn = this.add
        .text(0, buttonY, "UNEQUIP", {
          ...buttonStyle,
          color: "#ffffff",
          backgroundColor: "#aa4444",
        })
        .setOrigin(0.5);

      const upgradeBtn = this.add
        .text(0, buttonY, `+LV (${upgradeCost.gold}g)`, {
          ...buttonStyle,
          color: canUpgrade.canUpgrade && canAfford ? "#ffffff" : "#888888",
          backgroundColor: upgradeColor,
        })
        .setOrigin(0.5);

      // Position buttons with gap between them
      const totalWidth = unequipBtn.width + upgradeBtn.width + buttonGap;
      const startX = -totalWidth / 2;
      unequipBtn.setX(startX + unequipBtn.width / 2);
      upgradeBtn.setX(startX + unequipBtn.width + buttonGap + upgradeBtn.width / 2);

      unequipBtn.setInteractive({ useHandCursor: true });
      unequipBtn.on("pointerdown", () => {
        audioManager.playMenuSelect();
        equipmentManager.unequip(item.slot);
        this.hideDetailPanel();
      });
      UIAnimations.applyButtonEffects(this, unequipBtn);
      this.detailPanel.add(unequipBtn);

      if (canUpgrade.canUpgrade && canAfford) {
        upgradeBtn.setInteractive({ useHandCursor: true });
        upgradeBtn.on("pointerdown", () => this.onUpgradeClick(item));
        UIAnimations.applyButtonEffects(this, upgradeBtn);
      }
      this.detailPanel.add(upgradeBtn);
    } else {
      // Three buttons: EQUIP, SELL, +LV - position them dynamically
      const equipBtn = this.add
        .text(0, buttonY, "EQUIP", {
          ...buttonStyle,
          color: "#ffffff",
          backgroundColor: "#44aa44",
        })
        .setOrigin(0.5);

      const sellPrice = equipmentManager.getSellPrice(item);
      const sellBtn = this.add
        .text(0, buttonY, `SELL (${sellPrice}g)`, {
          ...buttonStyle,
          color: "#ffffff",
          backgroundColor: "#aa6622",
        })
        .setOrigin(0.5);

      const upgradeBtn = this.add
        .text(0, buttonY, `+LV (${upgradeCost.gold}g)`, {
          ...buttonStyle,
          color: canUpgrade.canUpgrade && canAfford ? "#ffffff" : "#888888",
          backgroundColor: upgradeColor,
        })
        .setOrigin(0.5);

      // Position buttons dynamically based on their widths
      const totalWidth = equipBtn.width + sellBtn.width + upgradeBtn.width + buttonGap * 2;
      const startX = -totalWidth / 2;
      equipBtn.setX(startX + equipBtn.width / 2);
      sellBtn.setX(startX + equipBtn.width + buttonGap + sellBtn.width / 2);
      upgradeBtn.setX(
        startX + equipBtn.width + buttonGap + sellBtn.width + buttonGap + upgradeBtn.width / 2,
      );

      equipBtn.setInteractive({ useHandCursor: true });
      equipBtn.on("pointerdown", () => {
        audioManager.playMenuSelect();
        equipmentManager.equip(item);
        this.hideDetailPanel();
      });
      UIAnimations.applyButtonEffects(this, equipBtn);
      this.detailPanel.add(equipBtn);

      sellBtn.setInteractive({ useHandCursor: true });
      sellBtn.on("pointerdown", () => this.onSellClick(item));
      UIAnimations.applyButtonEffects(this, sellBtn);
      this.detailPanel.add(sellBtn);

      if (canUpgrade.canUpgrade && canAfford) {
        upgradeBtn.setInteractive({ useHandCursor: true });
        upgradeBtn.on("pointerdown", () => this.onUpgradeClick(item));
        UIAnimations.applyButtonEffects(this, upgradeBtn);
      }
      this.detailPanel.add(upgradeBtn);
    }

    // Animation in
    UIAnimations.showModal(this, this.detailPanel);
  }

  private hideDetailPanel(): void {
    if (this.detailPanel) {
      const panel = this.detailPanel;
      UIAnimations.hideModal(this, panel, UIAnimations.DURATION.FAST, () => {
        panel.destroy();
      });
      this.detailPanel = null;
    }
  }

  private formatStatName(stat: string): string {
    // Convert camelCase to readable format
    return stat
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace("Percent", "%");
  }

  private formatStatValue(value: number, statKey?: string): string {
    // Percentage stats are stored as decimals (e.g., 0.15 = 15%)
    const percentageStats = new Set([
      "attackSpeedPercent",
      "attackDamagePercent",
      "maxHealthPercent",
      "damageReductionPercent",
      "critChance",
      "critDamage",
      "dodgeChance",
      "bonusXPPercent",
      "goldBonusPercent",
      "projectileSpeedPercent",
    ]);

    let displayValue = value;
    let isCapped = false;

    // Dodge chance is capped at MAX_DODGE_CHANCE (3%)
    if (statKey === "dodgeChance" && value > PlayerStats.MAX_DODGE_CHANCE) {
      displayValue = PlayerStats.MAX_DODGE_CHANCE;
      isCapped = true;
    }

    if (statKey && percentageStats.has(statKey)) {
      displayValue = displayValue * 100; // Convert 0.15 to 15
    }

    // Round to 1 decimal place, but show as integer if whole number
    const rounded = Math.round(displayValue * 10) / 10;
    const valueStr = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    return isCapped ? `${valueStr} (max)` : valueStr;
  }

  /**
   * Calculates the stat difference between current level and next level for an item.
   * Returns null if the item is already at max level.
   */
  private getNextLevelStatIncreases(item: Equipment): EquipmentStats | null {
    const rarityConfig = RARITY_CONFIGS[item.rarity];
    if (item.level >= rarityConfig.maxLevel) {
      return null; // Already at max level
    }

    // Get base data for this equipment type
    const baseData = getEquipmentBaseData(item.type);
    if (!baseData) return null;

    // Calculate stats at current and next level
    const currentStats = calculateEquipmentStats(baseData.baseStats, item.rarity, item.level);
    const nextStats = calculateEquipmentStats(baseData.baseStats, item.rarity, item.level + 1);

    // Calculate the differences
    const increases: EquipmentStats = {};
    for (const [key, nextValue] of Object.entries(nextStats)) {
      if (nextValue !== undefined) {
        const currentValue = (currentStats as Record<string, number>)[key] ?? 0;
        const diff = nextValue - currentValue;
        if (diff !== 0) {
          (increases as Record<string, number>)[key] = diff;
        }
      }
    }

    return increases;
  }

  /**
   * Combines item's base stats with all perk stats into a single object.
   * This ensures duplicate attributes (e.g., "Dodge 5%" + "Dodge 1%") are combined.
   */
  private getCombinedItemStats(item: Equipment): EquipmentStats {
    const combined: EquipmentStats = {};

    // Add base stats
    for (const [key, value] of Object.entries(item.baseStats)) {
      if (value !== undefined && value !== 0) {
        const statKey = key as keyof EquipmentStats;
        combined[statKey] = (combined[statKey] ?? 0) + value;
      }
    }

    // Add perk stats
    for (const perkId of item.perks) {
      const perk = PERKS[perkId as PerkId];
      if (perk?.stats) {
        for (const [key, value] of Object.entries(perk.stats)) {
          if (value !== undefined && value !== 0) {
            const statKey = key as keyof EquipmentStats;
            combined[statKey] = (combined[statKey] ?? 0) + value;
          }
        }
      }
    }

    return combined;
  }

  /**
   * Compare two items and determine stat differences.
   * Returns an object with stat differences (positive = item is better, negative = equipped is better).
   */
  private compareItemStats(
    item: Equipment,
    equipped: Equipment | null,
  ): { differences: Record<string, number>; isBetterOverall: boolean } {
    const itemStats = this.getCombinedItemStats(item);
    const equippedStats = equipped ? this.getCombinedItemStats(equipped) : {};

    const differences: Record<string, number> = {};
    let betterCount = 0;
    let worseCount = 0;

    // Get all unique stat keys
    const allStatKeys = new Set([...Object.keys(itemStats), ...Object.keys(equippedStats)]);

    for (const key of allStatKeys) {
      const itemValue = (itemStats as Record<string, number>)[key] ?? 0;
      const equippedValue = (equippedStats as Record<string, number>)[key] ?? 0;
      const diff = itemValue - equippedValue;

      if (diff !== 0) {
        differences[key] = diff;
        if (diff > 0) betterCount++;
        else worseCount++;
      }
    }

    // Item is considered "better overall" if:
    // 1. No equipped item (any item is better than nothing), OR
    // 2. More better stats than worse stats, OR
    // 3. Equal count but higher rarity (tiebreaker for different stat types)
    // 4. Equal count and rarity but higher level
    let isBetterOverall = false;
    if (!equipped) {
      isBetterOverall = true;
    } else if (betterCount > worseCount) {
      isBetterOverall = true;
    } else if (betterCount === worseCount) {
      // Use rarity order as tiebreaker: LEGENDARY > EPIC > RARE > GREAT > COMMON
      const rarityOrder = [Rarity.COMMON, Rarity.GREAT, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY];
      const itemRarityIndex = rarityOrder.indexOf(item.rarity);
      const equippedRarityIndex = rarityOrder.indexOf(equipped.rarity);

      if (itemRarityIndex > equippedRarityIndex) {
        isBetterOverall = true;
      } else if (itemRarityIndex === equippedRarityIndex && item.level > equipped.level) {
        isBetterOverall = true;
      }
    }

    return { differences, isBetterOverall };
  }

  /**
   * Check if an inventory item is an upgrade over currently equipped gear.
   */
  private isUpgradeOverEquipped(item: Equipment): boolean {
    const equipped = equipmentManager.getEquipped(item.slot);
    if (!equipped) return true; // Any item is better than nothing

    const { isBetterOverall } = this.compareItemStats(item, equipped);
    return isBetterOverall;
  }

  private onUpgradeClick(item: Equipment): void {
    const result = equipmentManager.upgrade(item, (cost) => {
      return currencyManager.spend("gold", cost.gold);
    });

    if (result.success) {
      audioManager.playAbilitySelect();
      // Refresh the detail panel with updated stats
      const isEquipped = equipmentManager.isEquipped(item.id);
      this.showDetailPanel(item, isEquipped);
    } else {
      // Could show error message here
      console.warn("Upgrade failed:", result.error);
    }
  }

  private onSellClick(item: Equipment): void {
    const goldEarned = equipmentManager.sellItem(item.id);
    if (goldEarned > 0) {
      audioManager.playAbilitySelect();
      this.hideDetailPanel();
      this.updateGoldDisplay();
    }
  }

  private onFusionClick(): void {
    const fusionCandidates = equipmentManager.findFusionCandidates();

    if (fusionCandidates.size === 0) {
      // No fusion available
      return;
    }

    // Get first available fusion group
    const firstGroup = fusionCandidates.values().next().value as Equipment[];
    if (firstGroup && firstGroup.length >= 3) {
      const itemsToFuse = firstGroup.slice(0, 3);
      const result = equipmentManager.fuse(itemsToFuse);

      if (result.success) {
        audioManager.playLevelUp();
        // Show the new item
        if (result.resultingItem) {
          this.showDetailPanel(result.resultingItem, false);
        }
      } else {
        console.warn("Fusion failed:", result.error);
      }
    }
  }

  private onFuseAllClick(): void {
    const result = equipmentManager.fuseAll();

    if (result.success) {
      audioManager.playLevelUp();
      // Show all fusion results in a popup
      this.showFusionResultsPopup(result.results);
    }
  }

  /**
   * Show a popup displaying all fusion result items
   */
  private showFusionResultsPopup(items: Equipment[]): void {
    this.hideDetailPanel();

    const { width, height } = this.cameras.main;
    const panelWidth = width - 40;

    // Calculate panel height based on number of items (row of 4)
    const rows = Math.ceil(items.length / 4);
    const itemSize = 60;
    const itemGap = 10;
    const headerHeight = 50;
    const panelHeight = headerHeight + rows * (itemSize + itemGap) + 40;

    this.detailPanel = this.add.container(width / 2, height / 2);
    this.detailPanel.setDepth(100);

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    backdrop.setInteractive();
    backdrop.on("pointerdown", () => this.hideDetailPanel());
    this.detailPanel.add(backdrop);

    // Panel background
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e, 1);
    bg.setStrokeStyle(3, 0x9966ff); // Purple border for fusion
    this.detailPanel.add(bg);

    // Title
    const title = this.add
      .text(0, -panelHeight / 2 + 25, `Fusion Complete! (${items.length} items)`, {
        fontSize: "18px",
        color: "#9966ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.detailPanel.add(title);

    // Display items in a grid
    const cols = 4;
    const startX = -((Math.min(items.length, cols) - 1) * (itemSize + itemGap)) / 2;
    const startY = -panelHeight / 2 + headerHeight + itemSize / 2 + 10;

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemSize + itemGap);
      const y = startY + row * (itemSize + itemGap);

      const rarityConfig = RARITY_CONFIGS[item.rarity];
      const rarityColor = Phaser.Display.Color.HexStringToColor(rarityConfig.color);

      // Item slot background
      const slotBg = this.add.rectangle(x, y, itemSize, itemSize, 0x2a2a3e);
      slotBg.setStrokeStyle(2, rarityColor.color);
      this.detailPanel!.add(slotBg);

      // Item sprite
      const sprite = this.add.image(x, y, `equip_${item.type}`);
      sprite.setDisplaySize(itemSize - 10, itemSize - 10);
      this.detailPanel!.add(sprite);

      // Rarity name below
      const rarityText = this.add
        .text(x, y + itemSize / 2 + 8, rarityConfig.name, {
          fontSize: "10px",
          color: rarityConfig.color,
        })
        .setOrigin(0.5);
      this.detailPanel!.add(rarityText);

      // Make item clickable to show details
      slotBg.setInteractive({ useHandCursor: true });
      slotBg.on("pointerdown", () => {
        this.showDetailPanel(item, false);
      });
    });

    // OK button
    const okBtn = this.add
      .text(0, panelHeight / 2 - 25, "OK", {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#4a4a6a",
        padding: { x: 30, y: 8 },
      })
      .setOrigin(0.5);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on("pointerdown", () => this.hideDetailPanel());
    UIAnimations.applyButtonEffects(this, okBtn);
    this.detailPanel.add(okBtn);
  }

  private updateFusionButton(): void {
    const fusionCandidates = equipmentManager.findFusionCandidates();
    const hasFusionAvailable = fusionCandidates.size > 0;

    const buttons = [this.fusionButton, this.fuseAllButton].filter(
      (btn): btn is Phaser.GameObjects.Text => btn !== null,
    );

    for (const button of buttons) {
      if (hasFusionAvailable) {
        button.setStyle({ backgroundColor: "#6b4aa3", color: "#ffffff" });
        button.setInteractive({ useHandCursor: true });
      } else {
        button.setStyle({ backgroundColor: "#3a3a55", color: "#666666" });
        button.disableInteractive();
      }
    }
  }

  private updateGoldDisplay(): void {
    if (this.goldText) {
      const gold = currencyManager.get("gold");
      this.goldText.setText(`Gold: ${gold}`);
    }
  }

  shutdown(): void {
    // Clean up event listeners to prevent updates on destroyed objects
    if (this.inventoryChangedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.INVENTORY_CHANGED, this.inventoryChangedHandler);
      this.inventoryChangedHandler = null;
    }
    if (this.equippedChangedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, this.equippedChangedHandler);
      this.equippedChangedHandler = null;
    }
    if (this.itemUpgradedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_UPGRADED, this.itemUpgradedHandler);
      this.itemUpgradedHandler = null;
    }
    if (this.itemFusedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_FUSED, this.itemFusedHandler);
      this.itemFusedHandler = null;
    }
    if (this.itemSoldHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_SOLD, this.itemSoldHandler);
      this.itemSoldHandler = null;
    }
  }
}

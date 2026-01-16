/**
 * EquipmentManager - Manages player equipment inventory and equipped items
 *
 * Singleton pattern for global access. Handles equipment operations:
 * - Inventory management (add, remove, find)
 * - Equipping/unequipping items
 * - Upgrades and fusion
 * - Stat calculations from equipped items
 * - Save/load integration with SaveManager
 */

import Phaser from "phaser";
import {
  Equipment,
  EquipmentSlotType,
  EquipmentStats,
  CombinedEquipmentStats,
  Rarity,
  EquipmentType,
  PerkId,
  UpgradeCost,
  UpgradeResult,
  FusionResult,
  RARITY_CONFIGS,
  FUSION_REQUIREMENTS,
  generateEquipmentId,
  getNextRarity,
  getSlotForType,
  WeaponType,
  WEAPON_TYPE_CONFIGS,
  EQUIPMENT_SLOTS,
} from "./Equipment";
import {
  getEquipmentBaseData,
  calculateUpgradeCost,
  calculateEquipmentStats,
  calculateSellPrice,
  selectRandomPerks,
  getRandomRarity,
  PERKS,
} from "../config/equipmentData";
import { currencyManager } from "./CurrencyManager";

// ============================================
// Constants
// ============================================

/** localStorage key for equipment data persistence */
const EQUIPMENT_STORAGE_KEY = "aura_archer_equipment_data";

// ============================================
// Event Types
// ============================================

/**
 * Events emitted by EquipmentManager
 */
export const EQUIPMENT_EVENTS = {
  INVENTORY_CHANGED: "equipment:inventory-changed",
  EQUIPPED_CHANGED: "equipment:equipped-changed",
  ITEM_UPGRADED: "equipment:item-upgraded",
  ITEM_FUSED: "equipment:item-fused",
  ITEM_SOLD: "equipment:item-sold",
  STATS_CHANGED: "equipment:stats-changed",
} as const;

// ============================================
// Save Data Types (for SaveManager integration)
// ============================================

/**
 * Serializable equipment item for save data
 */
export interface EquipmentSaveItem {
  id: string;
  type: string;
  slot: string;
  rarity: string;
  level: number;
  perks: string[];
}

/**
 * Serializable save data structure
 */
export interface EquipmentSaveData {
  inventory: EquipmentSaveItem[];
  equipped: Record<string, string | null>; // slot -> item id
}

// ============================================
// EquipmentManager Class
// ============================================

export class EquipmentManager extends Phaser.Events.EventEmitter {
  private static instance: EquipmentManager | null = null;

  private inventory: Equipment[] = [];
  private equipped: Record<EquipmentSlotType, Equipment | null> = {
    weapon: null,
    armor: null,
    ring: null,
    spirit: null,
  };

  // Cached combined stats (recalculated when equipment changes)
  private cachedStats: CombinedEquipmentStats | null = null;

  private constructor() {
    super();
    // Load saved data on construction
    this.loadFromStorage();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EquipmentManager {
    if (!EquipmentManager.instance) {
      EquipmentManager.instance = new EquipmentManager();
    }
    return EquipmentManager.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static resetInstance(): void {
    if (EquipmentManager.instance) {
      EquipmentManager.instance.removeAllListeners();
      EquipmentManager.instance = null;
    }
  }

  // ============================================
  // Inventory Management
  // ============================================

  /**
   * Get all items in inventory
   */
  getInventory(): readonly Equipment[] {
    return this.inventory;
  }

  /**
   * Get items filtered by slot
   */
  getInventoryBySlot(slot: EquipmentSlotType): Equipment[] {
    return this.inventory.filter((item) => item.slot === slot);
  }

  /**
   * Get items filtered by rarity
   */
  getInventoryByRarity(rarity: Rarity): Equipment[] {
    return this.inventory.filter((item) => item.rarity === rarity);
  }

  /**
   * Find an item by ID
   */
  findItem(id: string): Equipment | undefined {
    return this.inventory.find((item) => item.id === id);
  }

  /**
   * Add an item to inventory
   */
  addToInventory(equipment: Equipment): void {
    this.inventory.push(equipment);
    this.emit(EQUIPMENT_EVENTS.INVENTORY_CHANGED, { action: "add", item: equipment });
    this.saveToStorage();
  }

  /**
   * Remove an item from inventory
   * Also unequips if currently equipped
   */
  removeFromInventory(id: string): boolean {
    const index = this.inventory.findIndex((item) => item.id === id);
    if (index === -1) return false;

    // Unequip if equipped
    for (const slot of EQUIPMENT_SLOTS) {
      if (this.equipped[slot]?.id === id) {
        this.equipped[slot] = null;
        this.invalidateStats();
        this.emit(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, { slot, item: null });
      }
    }

    const removed = this.inventory.splice(index, 1)[0];
    this.emit(EQUIPMENT_EVENTS.INVENTORY_CHANGED, { action: "remove", item: removed });
    this.saveToStorage();
    return true;
  }

  /**
   * Create a new equipment item and add to inventory
   */
  createEquipment(
    type: EquipmentType,
    rarity: Rarity = Rarity.COMMON,
    level: number = 1,
  ): Equipment {
    const baseData = getEquipmentBaseData(type);
    if (!baseData) {
      throw new Error(`Unknown equipment type: ${type}`);
    }

    const slot = getSlotForType(type);
    const perks = selectRandomPerks(slot, rarity);
    const baseStats = calculateEquipmentStats(baseData.baseStats, rarity, level);

    const equipment: Equipment = {
      id: generateEquipmentId(),
      type,
      slot,
      rarity,
      level,
      baseStats,
      perks,
      name: baseData.name,
      description: baseData.description,
    };

    this.addToInventory(equipment);
    return equipment;
  }

  /**
   * Create a random equipment drop
   */
  createRandomEquipment(slot?: EquipmentSlotType): Equipment {
    const rarity = getRandomRarity();

    // Get all possible types for the slot (or any slot if not specified)
    let possibleTypes: EquipmentType[];
    if (slot) {
      possibleTypes = this.getTypesForSlot(slot);
    } else {
      possibleTypes = [
        ...Object.values(WeaponType),
        ...this.getTypesForSlot("armor"),
        ...this.getTypesForSlot("ring"),
        ...this.getTypesForSlot("spirit"),
      ];
    }

    const randomType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
    return this.createEquipment(randomType, rarity);
  }

  /**
   * Generate random equipment with a specific rarity
   * Used for chest opening where rarity is pre-determined
   */
  generateRandomEquipment(rarity: Rarity, slot?: EquipmentSlotType): Equipment {
    // Get all possible types for the slot (or any slot if not specified)
    let possibleTypes: EquipmentType[];
    if (slot) {
      possibleTypes = this.getTypesForSlot(slot);
    } else {
      possibleTypes = [
        ...Object.values(WeaponType),
        ...this.getTypesForSlot("armor"),
        ...this.getTypesForSlot("ring"),
        ...this.getTypesForSlot("spirit"),
      ];
    }

    const randomType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
    return this.createEquipment(randomType, rarity);
  }

  private getTypesForSlot(slot: EquipmentSlotType): EquipmentType[] {
    switch (slot) {
      case "weapon":
        return Object.values(WeaponType);
      case "armor":
        return ["vest", "robe", "phantom_cloak", "golden_chestplate"] as EquipmentType[];
      case "ring":
        return [
          "bear_ring",
          "wolf_ring",
          "serpent_ring",
          "falcon_ring",
          "lion_ring",
        ] as EquipmentType[];
      case "spirit":
        return ["bat", "laser_bat", "elf", "living_bomb"] as EquipmentType[];
      default:
        return [];
    }
  }

  // ============================================
  // Equipment Slots
  // ============================================

  /**
   * Get the currently equipped item for a slot
   */
  getEquipped(slot: EquipmentSlotType): Equipment | null {
    return this.equipped[slot];
  }

  /**
   * Get all equipped items
   */
  getAllEquipped(): Record<EquipmentSlotType, Equipment | null> {
    return { ...this.equipped };
  }

  /**
   * Equip an item from inventory
   */
  equip(equipment: Equipment): boolean {
    // Verify item is in inventory
    if (!this.inventory.find((item) => item.id === equipment.id)) {
      console.warn("Cannot equip item not in inventory:", equipment.id);
      return false;
    }

    // Verify slot matches
    const slot = equipment.slot;
    if (!EQUIPMENT_SLOTS.includes(slot)) {
      console.warn("Invalid equipment slot:", slot);
      return false;
    }

    // Equip the item
    this.equipped[slot] = equipment;
    this.invalidateStats();
    this.emit(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, { slot, item: equipment });
    this.emit(EQUIPMENT_EVENTS.STATS_CHANGED, this.getEquippedStats());
    this.saveToStorage();
    return true;
  }

  /**
   * Unequip an item from a slot
   */
  unequip(slot: EquipmentSlotType): Equipment | null {
    const item = this.equipped[slot];
    if (item) {
      this.equipped[slot] = null;
      this.invalidateStats();
      this.emit(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, { slot, item: null });
      this.emit(EQUIPMENT_EVENTS.STATS_CHANGED, this.getEquippedStats());
      this.saveToStorage();
    }
    return item;
  }

  /**
   * Check if an item is currently equipped
   */
  isEquipped(id: string): boolean {
    return Object.values(this.equipped).some((item) => item?.id === id);
  }

  // ============================================
  // Stat Calculations
  // ============================================

  /**
   * Invalidate cached stats (called when equipment changes)
   */
  private invalidateStats(): void {
    this.cachedStats = null;
  }

  /**
   * Calculate combined stats from all equipped items
   */
  getEquippedStats(): CombinedEquipmentStats {
    if (this.cachedStats) {
      return this.cachedStats;
    }

    const combined: CombinedEquipmentStats = {};

    for (const slot of EQUIPMENT_SLOTS) {
      const item = this.equipped[slot];
      if (!item) continue;

      // Add base stats
      this.addStats(combined, item.baseStats);

      // Add perk stats
      for (const perkId of item.perks) {
        const perk = PERKS[perkId];
        if (perk) {
          this.addStats(combined, perk.stats);
        }
      }

      // Handle weapon-specific properties
      if (slot === "weapon" && Object.values(WeaponType).includes(item.type as WeaponType)) {
        const weaponConfig = WEAPON_TYPE_CONFIGS[item.type as WeaponType];
        combined.hasHoming = weaponConfig.hasHoming;
        combined.hasKnockback = weaponConfig.hasKnockback;
        combined.weaponType = item.type as WeaponType;
      }
    }

    this.cachedStats = combined;
    return combined;
  }

  /**
   * Add stats from source to target (accumulating)
   */
  private addStats(target: EquipmentStats, source: EquipmentStats): void {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        const statKey = key as keyof EquipmentStats;
        target[statKey] = (target[statKey] ?? 0) + value;
      }
    }
  }

  /**
   * Calculate effective stat value with equipment bonuses
   */
  getEffectiveStat(
    baseStat: number,
    flatBonus: number | undefined,
    percentBonus: number | undefined,
  ): number {
    let result = baseStat;
    if (flatBonus) result += flatBonus;
    if (percentBonus) result *= 1 + percentBonus;
    return Math.floor(result);
  }

  // ============================================
  // Upgrades
  // ============================================

  /**
   * Check if an item can be upgraded
   */
  canUpgrade(equipment: Equipment): { canUpgrade: boolean; reason?: string } {
    const maxLevel = RARITY_CONFIGS[equipment.rarity].maxLevel;

    if (equipment.level >= maxLevel) {
      return { canUpgrade: false, reason: "Item is at maximum level" };
    }

    return { canUpgrade: true };
  }

  /**
   * Get the cost to upgrade an item
   */
  getUpgradeCost(equipment: Equipment): UpgradeCost {
    return calculateUpgradeCost(equipment.rarity, equipment.level);
  }

  /**
   * Attempt to upgrade an item
   * Returns success status and error message if failed
   */
  upgrade(equipment: Equipment, paymentCallback: (cost: UpgradeCost) => boolean): UpgradeResult {
    const { canUpgrade, reason } = this.canUpgrade(equipment);

    if (!canUpgrade) {
      return { success: false, newLevel: equipment.level, error: reason };
    }

    const cost = this.getUpgradeCost(equipment);

    // Attempt payment
    if (!paymentCallback(cost)) {
      return { success: false, newLevel: equipment.level, error: "Insufficient resources" };
    }

    // Upgrade successful
    equipment.level++;

    // Recalculate stats
    const baseData = getEquipmentBaseData(equipment.type);
    if (baseData) {
      equipment.baseStats = calculateEquipmentStats(
        baseData.baseStats,
        equipment.rarity,
        equipment.level,
      );
    }

    // Invalidate stats if equipped
    if (this.isEquipped(equipment.id)) {
      this.invalidateStats();
      this.emit(EQUIPMENT_EVENTS.STATS_CHANGED, this.getEquippedStats());
    }

    this.emit(EQUIPMENT_EVENTS.ITEM_UPGRADED, { item: equipment, newLevel: equipment.level });
    this.emit(EQUIPMENT_EVENTS.INVENTORY_CHANGED, { action: "update", item: equipment });
    this.saveToStorage();

    return { success: true, newLevel: equipment.level };
  }

  // ============================================
  // Selling
  // ============================================

  /**
   * Get the sell price for an item
   */
  getSellPrice(equipment: Equipment): number {
    return calculateSellPrice(equipment.rarity, equipment.level);
  }

  /**
   * Sell an item for gold
   * Returns the gold earned, or 0 if the item couldn't be sold
   */
  sellItem(id: string): number {
    const item = this.findItem(id);
    if (!item) {
      console.warn("Cannot sell item not in inventory:", id);
      return 0;
    }

    // Cannot sell equipped items
    if (this.isEquipped(id)) {
      console.warn("Cannot sell equipped item:", id);
      return 0;
    }

    const sellPrice = this.getSellPrice(item);

    // Remove from inventory
    this.removeFromInventory(id);

    // Add gold to player
    currencyManager.add("gold", sellPrice);

    // Emit sold event
    this.emit(EQUIPMENT_EVENTS.ITEM_SOLD, { item, goldEarned: sellPrice });

    return sellPrice;
  }

  // ============================================
  // Fusion
  // ============================================

  /**
   * Find items that can be fused together
   * Returns groups of items that share type, rarity, and can be fused
   */
  findFusionCandidates(): Map<string, Equipment[]> {
    const groups = new Map<string, Equipment[]>();

    for (const item of this.inventory) {
      // Can't fuse legendary items (already max rarity)
      if (item.rarity === Rarity.LEGENDARY) continue;

      const key = `${item.type}_${item.rarity}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }

    // Filter to only groups with enough items
    const validGroups = new Map<string, Equipment[]>();
    for (const [key, items] of groups) {
      if (items.length >= FUSION_REQUIREMENTS.itemsRequired) {
        validGroups.set(key, items);
      }
    }

    return validGroups;
  }

  /**
   * Attempt to fuse items
   * Requires 3 items of same type and rarity
   */
  fuse(items: Equipment[]): FusionResult {
    if (items.length !== FUSION_REQUIREMENTS.itemsRequired) {
      return {
        success: false,
        error: `Fusion requires exactly ${FUSION_REQUIREMENTS.itemsRequired} items`,
      };
    }

    // Verify all items are same type and rarity
    const firstItem = items[0];
    const allSameType = items.every((item) => item.type === firstItem.type);
    const allSameRarity = items.every((item) => item.rarity === firstItem.rarity);

    if (!allSameType || !allSameRarity) {
      return { success: false, error: "All items must be the same type and rarity" };
    }

    // Verify all items exist in inventory
    const allInInventory = items.every((item) => this.findItem(item.id));
    if (!allInInventory) {
      return { success: false, error: "All items must be in inventory" };
    }

    // Cannot fuse legendary items
    if (firstItem.rarity === Rarity.LEGENDARY) {
      return { success: false, error: "Legendary items cannot be fused" };
    }

    // Get next rarity
    const nextRarity = getNextRarity(firstItem.rarity);
    if (!nextRarity) {
      return { success: false, error: "Cannot upgrade rarity further" };
    }

    // Calculate average level (rounded up)
    const avgLevel = Math.ceil(items.reduce((sum, item) => sum + item.level, 0) / items.length);

    // Remove fused items
    for (const item of items) {
      this.removeFromInventory(item.id);
    }

    // Create new item with higher rarity
    const resultItem = this.createEquipment(firstItem.type, nextRarity, avgLevel);

    this.emit(EQUIPMENT_EVENTS.ITEM_FUSED, {
      consumed: items,
      result: resultItem,
    });

    return { success: true, resultingItem: resultItem };
  }

  /**
   * Fuse all available items with chain fusion.
   * Keeps fusing until no more groups of 3 exist at any rarity.
   */
  fuseAll(): { success: boolean; results: Equipment[]; consumed: number } {
    const results: Equipment[] = [];
    let totalConsumed = 0;

    // Keep fusing while candidates exist (chain fusion)
    let candidates = this.findFusionCandidates();
    while (candidates.size > 0) {
      for (const [_key, items] of candidates) {
        // Fuse in batches of 3
        while (items.length >= 3) {
          const toFuse = items.splice(0, 3);
          const result = this.fuse(toFuse);
          if (result.success && result.resultingItem) {
            results.push(result.resultingItem);
            totalConsumed += 3;
          }
        }
      }
      // Re-check for new candidates (chain fusion from newly created items)
      candidates = this.findFusionCandidates();
    }

    return { success: results.length > 0, results, consumed: totalConsumed };
  }

  // ============================================
  // Save/Load Integration
  // ============================================

  /**
   * Export equipment data for saving
   */
  toSaveData(): EquipmentSaveData {
    const inventoryData: EquipmentSaveItem[] = this.inventory.map((item) => ({
      id: item.id,
      type: item.type,
      slot: item.slot,
      rarity: item.rarity,
      level: item.level,
      perks: item.perks,
    }));

    const equippedData: Record<string, string | null> = {};
    for (const slot of EQUIPMENT_SLOTS) {
      equippedData[slot] = this.equipped[slot]?.id ?? null;
    }

    return {
      inventory: inventoryData,
      equipped: equippedData,
    };
  }

  /**
   * Import equipment data from save
   */
  fromSaveData(data: EquipmentSaveData): void {
    // Clear current state
    this.inventory = [];
    for (const slot of EQUIPMENT_SLOTS) {
      this.equipped[slot] = null;
    }

    // Restore inventory
    for (const saveItem of data.inventory) {
      const baseData = getEquipmentBaseData(saveItem.type as EquipmentType);
      if (!baseData) {
        console.warn("Unknown equipment type in save data:", saveItem.type);
        continue;
      }

      // Filter out any removed perks that no longer exist in PERKS
      const validPerks = (saveItem.perks as PerkId[]).filter((perkId) => {
        if (PERKS[perkId]) {
          return true;
        }
        console.warn("Unknown perk in save data, skipping:", perkId);
        return false;
      });

      const equipment: Equipment = {
        id: saveItem.id,
        type: saveItem.type as EquipmentType,
        slot: saveItem.slot as EquipmentSlotType,
        rarity: saveItem.rarity as Rarity,
        level: saveItem.level,
        perks: validPerks,
        name: baseData.name,
        description: baseData.description,
        baseStats: calculateEquipmentStats(
          baseData.baseStats,
          saveItem.rarity as Rarity,
          saveItem.level,
        ),
      };

      this.inventory.push(equipment);
    }

    // Restore equipped items
    for (const [slot, itemId] of Object.entries(data.equipped)) {
      if (itemId) {
        const item = this.findItem(itemId);
        if (item) {
          this.equipped[slot as EquipmentSlotType] = item;
        }
      }
    }

    this.invalidateStats();
    this.emit(EQUIPMENT_EVENTS.INVENTORY_CHANGED, { action: "load" });
    this.emit(EQUIPMENT_EVENTS.STATS_CHANGED, this.getEquippedStats());
  }

  /**
   * Clear all equipment (for testing or reset)
   */
  clear(): void {
    this.inventory = [];
    for (const slot of EQUIPMENT_SLOTS) {
      this.equipped[slot] = null;
    }
    this.invalidateStats();
    this.emit(EQUIPMENT_EVENTS.INVENTORY_CHANGED, { action: "clear" });
    this.emit(EQUIPMENT_EVENTS.STATS_CHANGED, this.getEquippedStats());
    this.saveToStorage();
  }

  // ============================================
  // LocalStorage Persistence
  // ============================================

  /**
   * Save equipment data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = this.toSaveData();
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("EquipmentManager: Failed to save data:", error);
    }
  }

  /**
   * Load equipment data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as EquipmentSaveData;
        this.fromSaveData(data);
        console.log(`EquipmentManager: Loaded ${this.inventory.length} items from storage`);
      }
    } catch (error) {
      console.error("EquipmentManager: Failed to load data:", error);
    }
  }
}

// ============================================
// Singleton Export
// ============================================

/**
 * Global EquipmentManager instance
 * Use this for all equipment operations
 */
export const equipmentManager = EquipmentManager.getInstance();

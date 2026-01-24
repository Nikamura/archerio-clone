/**
 * SaveManager - Persistent save/load system for game progression
 *
 * Handles all persistent data storage using localStorage.
 * Includes version migration support for future updates.
 */

import { DifficultyLevel } from "../config/difficulty";
import { EnemyType } from "../config/chapterData";
import { BossId } from "../config/bossData";

// ============================================
// Type Definitions
// ============================================

/**
 * Equipment rarity tiers
 */
export enum EquipmentRarity {
  COMMON = "common",
  GREAT = "great",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

/**
 * Equipment slot types
 */
export enum EquipmentSlot {
  WEAPON = "weapon",
  ARMOR = "armor",
  RING = "ring",
  SPIRIT = "spirit",
}

/**
 * Single equipment item
 */
export interface EquipmentItem {
  id: string;
  slot: EquipmentSlot;
  name: string;
  rarity: EquipmentRarity;
  level: number;
  baseStats: {
    attack?: number;
    health?: number;
    attackSpeed?: number;
    critChance?: number;
    critDamage?: number;
  };
  perks?: string[];
}

/**
 * Hero data for unlocked heroes
 */
export interface HeroData {
  id: string;
  name: string;
  level: number;
  experience: number;
  unlocked: boolean;
}

/**
 * Talent node data
 */
export interface TalentData {
  id: string;
  level: number;
  maxLevel: number;
}

/**
 * Chapter progress data
 */
export interface ChapterProgress {
  chapterId: number;
  highestRoom: number;
  completed: boolean;
  stars: number; // 0-3 stars based on performance
}

/**
 * Monster kill statistics - tracks kills per enemy/boss type
 */
export interface MonsterKillStats {
  enemies: Partial<Record<EnemyType, number>>;
  bosses: Partial<Record<BossId, number>>;
}

/**
 * Acquired ability data for high score records
 */
export interface HighScoreAbility {
  id: string;
  level: number;
}

/**
 * Full high score run data - stores everything needed to recreate the game over screen
 */
export interface HighScoreRunData {
  // When the high score was achieved
  achievedAt: number; // timestamp

  // Core stats
  score: number;
  endlessWave: number;
  roomsCleared: number;
  enemiesKilled: number;
  goldEarned: number;
  playTimeMs: number;

  // Context
  difficulty: DifficultyLevel;
  heroId: string;

  // Skills/abilities acquired during the run
  acquiredAbilities: HighScoreAbility[];
}

/**
 * Player statistics
 */
export interface PlayerStatistics {
  totalRuns: number;
  totalKills: number;
  totalDeaths: number;
  highestRoom: number;
  highestChapter: number;
  totalPlayTimeMs: number;
  bossesDefeated: number;
  abilitiesAcquired: number;
  longestRun: number; // in rooms
  fastestBossKill: number; // in milliseconds, 0 if never killed
  highestScore: number; // personal best score
  highScoreDifficulty?: DifficultyLevel; // difficulty when high score was achieved
  endlessHighWave?: number; // highest wave reached in endless mode
  monsterKills: MonsterKillStats; // per-enemy and per-boss kill counts
  highScoreRun?: HighScoreRunData; // full data from the best run
}

/**
 * Graphics quality levels
 */
export enum GraphicsQuality {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Colorblind mode options
 */
export enum ColorblindMode {
  NONE = "none",
  PROTANOPIA = "protanopia", // Red-blind
  DEUTERANOPIA = "deuteranopia", // Green-blind
  TRITANOPIA = "tritanopia", // Blue-blind
}

/**
 * Available game speed multiplier options
 */
export const GAME_SPEED_OPTIONS = [1, 2, 3, 5] as const;
export type GameSpeedMultiplier = (typeof GAME_SPEED_OPTIONS)[number];

/**
 * Game settings that persist
 */
export interface GameSettings {
  difficulty: DifficultyLevel;
  audioEnabled: boolean;
  audioVolume: number;
  showDamageNumbers: boolean;
  showExpNumbers: boolean;
  vibrationEnabled: boolean;
  language: string;
  autoLevelUp: boolean;
  autoRoomAdvance: boolean;
  graphicsQuality: GraphicsQuality;
  screenShakeEnabled: boolean;
  colorblindMode: ColorblindMode;
  gameSpeedMultiplier: GameSpeedMultiplier;
}

/**
 * Complete save data structure
 */
export interface SaveData {
  // Version for migration support
  version: number;

  // Timestamps
  createdAt: number;
  lastPlayedAt: number;

  // Player progression
  selectedHeroId: string;
  heroes: Record<string, HeroData>;

  // Currencies
  gold: number;
  gems: number;
  scrolls: number;

  // Equipment
  inventory: EquipmentItem[];
  equipped: Record<EquipmentSlot, string | null>; // Maps slot to item ID

  // Talents
  talents: TalentData[];
  talentPoints: number;

  // Chapter/level progress
  chapters: ChapterProgress[];
  unlockedChapters: number[];

  // Statistics
  statistics: PlayerStatistics;

  // Settings
  settings: GameSettings;

  // Tutorial
  tutorialCompleted: boolean;
}

// ============================================
// Default Values
// ============================================

const CURRENT_SAVE_VERSION = 1;
const STORAGE_KEY = "aura_archer_save_data";

/**
 * Get default hero data
 */
function getDefaultHeroes(): Record<string, HeroData> {
  return {
    atreus: {
      id: "atreus",
      name: "Atreus",
      level: 1,
      experience: 0,
      unlocked: true, // Free starting hero
    },
    helix: {
      id: "helix",
      name: "Helix",
      level: 1,
      experience: 0,
      unlocked: false,
    },
    meowgik: {
      id: "meowgik",
      name: "Meowgik",
      level: 1,
      experience: 0,
      unlocked: false,
    },
  };
}

/**
 * Get default monster kill stats
 */
function getDefaultMonsterKills(): MonsterKillStats {
  return {
    enemies: {},
    bosses: {},
  };
}

/**
 * Get default statistics
 */
function getDefaultStatistics(): PlayerStatistics {
  return {
    totalRuns: 0,
    totalKills: 0,
    totalDeaths: 0,
    highestRoom: 0,
    highestChapter: 1,
    totalPlayTimeMs: 0,
    bossesDefeated: 0,
    abilitiesAcquired: 0,
    longestRun: 0,
    fastestBossKill: 0,
    highestScore: 0,
    monsterKills: getDefaultMonsterKills(),
  };
}

/**
 * Get default settings
 */
function getDefaultSettings(): GameSettings {
  return {
    difficulty: DifficultyLevel.NORMAL,
    audioEnabled: true,
    audioVolume: 0.3,
    showDamageNumbers: true,
    showExpNumbers: true,
    vibrationEnabled: true,
    language: "en",
    autoLevelUp: false,
    autoRoomAdvance: false,
    graphicsQuality: GraphicsQuality.HIGH,
    screenShakeEnabled: true,
    colorblindMode: ColorblindMode.NONE,
    gameSpeedMultiplier: 1,
  };
}

/**
 * Get default chapter progress for chapter 1
 */
function getDefaultChapters(): ChapterProgress[] {
  return [
    {
      chapterId: 1,
      highestRoom: 0,
      completed: false,
      stars: 0,
    },
  ];
}

/**
 * Create a fresh save data object with default values
 */
function createDefaultSaveData(): SaveData {
  const now = Date.now();
  return {
    version: CURRENT_SAVE_VERSION,
    createdAt: now,
    lastPlayedAt: now,
    selectedHeroId: "atreus",
    heroes: getDefaultHeroes(),
    gold: 1000, // Starting gold for new players
    gems: 50, // Starting gems for new players
    scrolls: 0,
    inventory: [],
    equipped: {
      [EquipmentSlot.WEAPON]: null,
      [EquipmentSlot.ARMOR]: null,
      [EquipmentSlot.RING]: null,
      [EquipmentSlot.SPIRIT]: null,
    },
    talents: [],
    talentPoints: 0,
    chapters: getDefaultChapters(),
    unlockedChapters: [1],
    statistics: getDefaultStatistics(),
    settings: getDefaultSettings(),
    tutorialCompleted: false,
  };
}

// ============================================
// Migration Functions
// ============================================

type MigrationFn = (data: Partial<SaveData>) => Partial<SaveData>;

/**
 * Migration functions indexed by target version
 * Each function migrates from (version - 1) to (version)
 */
const migrations: Record<number, MigrationFn> = {
  // Example migration from v1 to v2 (for future use):
  // 2: (data) => {
  //   // Add new field that wasn't in v1
  //   return {
  //     ...data,
  //     newField: defaultValue,
  //     version: 2,
  //   }
  // },
};

/**
 * Apply migrations to bring save data up to current version
 */
function migrateData(data: Partial<SaveData>): SaveData {
  let currentData = { ...data };
  const startVersion = data.version ?? 0;

  // Apply each migration in sequence
  for (let v = startVersion + 1; v <= CURRENT_SAVE_VERSION; v++) {
    const migrationFn = migrations[v];
    if (migrationFn) {
      console.log(`SaveManager: Migrating save data from v${v - 1} to v${v}`);
      currentData = migrationFn(currentData);
    }
  }

  // Set current version
  currentData.version = CURRENT_SAVE_VERSION;

  // Merge with defaults to ensure all fields exist
  const defaults = createDefaultSaveData();
  const currentStats = currentData.statistics ?? {};
  const currentMonsterKills =
    (currentStats as PlayerStatistics).monsterKills ?? getDefaultMonsterKills();
  return {
    ...defaults,
    ...currentData,
    // Ensure nested objects are properly merged
    heroes: { ...defaults.heroes, ...(currentData.heroes ?? {}) },
    equipped: { ...defaults.equipped, ...(currentData.equipped ?? {}) },
    statistics: {
      ...defaults.statistics,
      ...currentStats,
      monsterKills: {
        enemies: { ...defaults.statistics.monsterKills.enemies, ...currentMonsterKills.enemies },
        bosses: { ...defaults.statistics.monsterKills.bosses, ...currentMonsterKills.bosses },
      },
    },
    settings: { ...defaults.settings, ...(currentData.settings ?? {}) },
  };
}

// ============================================
// SaveManager Class
// ============================================

/**
 * Manages persistent game data storage and retrieval
 */
export class SaveManager {
  private data: SaveData;
  private autoSaveEnabled: boolean = true;
  private isDirty: boolean = false;

  constructor() {
    this.data = this.load();
  }

  // ============================================
  // Core Methods
  // ============================================

  /**
   * Check if save data exists in localStorage
   */
  exists(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Load save data from localStorage
   * Returns default data if no save exists or if there's an error
   */
  load(): SaveData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        console.log("SaveManager: No save data found, using defaults");
        return createDefaultSaveData();
      }

      const parsed = JSON.parse(stored) as Partial<SaveData>;

      // Check if migration is needed
      if ((parsed.version ?? 0) < CURRENT_SAVE_VERSION) {
        console.log(
          `SaveManager: Save data is v${parsed.version ?? 0}, current is v${CURRENT_SAVE_VERSION}`,
        );
        const migrated = migrateData(parsed);
        // Save migrated data immediately
        this.saveToStorage(migrated);
        return migrated;
      }

      // Merge with defaults to ensure all fields exist
      return migrateData(parsed);
    } catch (error) {
      console.error("SaveManager: Failed to load save data:", error);
      return createDefaultSaveData();
    }
  }

  /**
   * Save current data to localStorage
   */
  save(): boolean {
    this.data.lastPlayedAt = Date.now();
    return this.saveToStorage(this.data);
  }

  /**
   * Internal method to write data to localStorage
   */
  private saveToStorage(data: SaveData): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.isDirty = false;
      return true;
    } catch (error) {
      console.error("SaveManager: Failed to save data:", error);
      return false;
    }
  }

  /**
   * Reset all save data to defaults
   * WARNING: This deletes all player progress!
   */
  reset(): void {
    this.data = createDefaultSaveData();
    this.save();
    console.log("SaveManager: Save data reset to defaults");
  }

  /**
   * Mark data as dirty (needs saving)
   * Used for auto-save triggers
   */
  markDirty(): void {
    this.isDirty = true;
    if (this.autoSaveEnabled) {
      this.save();
    }
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  /**
   * Enable or disable auto-save
   */
  setAutoSave(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
  }

  // ============================================
  // Getters - Read Access
  // ============================================

  /**
   * Get the complete save data (read-only recommended)
   */
  getData(): Readonly<SaveData> {
    return this.data;
  }

  /**
   * Get current gold amount
   */
  getGold(): number {
    return this.data.gold;
  }

  /**
   * Get current gems amount
   */
  getGems(): number {
    return this.data.gems;
  }

  /**
   * Get current scrolls amount
   */
  getScrolls(): number {
    return this.data.scrolls;
  }

  /**
   * Get selected hero ID
   */
  getSelectedHeroId(): string {
    return this.data.selectedHeroId;
  }

  /**
   * Get hero data by ID
   */
  getHero(heroId: string): HeroData | undefined {
    return this.data.heroes[heroId];
  }

  /**
   * Get all heroes
   */
  getAllHeroes(): Record<string, HeroData> {
    return this.data.heroes;
  }

  /**
   * Get unlocked heroes only
   */
  getUnlockedHeroes(): HeroData[] {
    return Object.values(this.data.heroes).filter((h) => h.unlocked);
  }

  /**
   * Get equipment inventory
   */
  getInventory(): EquipmentItem[] {
    return this.data.inventory;
  }

  /**
   * Get equipped item for a slot
   */
  getEquippedItem(slot: EquipmentSlot): EquipmentItem | undefined {
    const itemId = this.data.equipped[slot];
    if (!itemId) return undefined;
    return this.data.inventory.find((item) => item.id === itemId);
  }

  /**
   * Get all equipped items
   */
  getAllEquipped(): Record<EquipmentSlot, EquipmentItem | undefined> {
    return {
      [EquipmentSlot.WEAPON]: this.getEquippedItem(EquipmentSlot.WEAPON),
      [EquipmentSlot.ARMOR]: this.getEquippedItem(EquipmentSlot.ARMOR),
      [EquipmentSlot.RING]: this.getEquippedItem(EquipmentSlot.RING),
      [EquipmentSlot.SPIRIT]: this.getEquippedItem(EquipmentSlot.SPIRIT),
    };
  }

  /**
   * Get player statistics
   */
  getStatistics(): Readonly<PlayerStatistics> {
    return this.data.statistics;
  }

  /**
   * Get game settings
   */
  getSettings(): Readonly<GameSettings> {
    return this.data.settings;
  }

  /**
   * Get difficulty setting
   */
  getDifficulty(): DifficultyLevel {
    return this.data.settings.difficulty;
  }

  /**
   * Get auto level up setting
   */
  getAutoLevelUp(): boolean {
    return this.data.settings.autoLevelUp ?? false;
  }

  /**
   * Toggle auto level up setting
   */
  toggleAutoLevelUp(): boolean {
    this.data.settings.autoLevelUp = !this.data.settings.autoLevelUp;
    this.markDirty();
    return this.data.settings.autoLevelUp;
  }

  /**
   * Get auto room advance setting
   */
  getAutoRoomAdvance(): boolean {
    return this.data.settings.autoRoomAdvance ?? false;
  }

  /**
   * Toggle auto room advance setting
   */
  toggleAutoRoomAdvance(): boolean {
    this.data.settings.autoRoomAdvance = !this.data.settings.autoRoomAdvance;
    this.markDirty();
    return this.data.settings.autoRoomAdvance;
  }

  /**
   * Get game speed multiplier setting
   */
  getGameSpeedMultiplier(): GameSpeedMultiplier {
    return this.data.settings.gameSpeedMultiplier ?? 1;
  }

  /**
   * Set game speed multiplier
   */
  setGameSpeedMultiplier(speed: GameSpeedMultiplier): void {
    this.data.settings.gameSpeedMultiplier = speed;
    this.markDirty();
  }

  /**
   * Cycle to next game speed option (1x -> 2x -> 3x -> 5x -> 1x)
   */
  cycleGameSpeed(): GameSpeedMultiplier {
    const currentSpeed = this.getGameSpeedMultiplier();
    const currentIndex = GAME_SPEED_OPTIONS.indexOf(currentSpeed);
    const nextIndex = (currentIndex + 1) % GAME_SPEED_OPTIONS.length;
    const nextSpeed = GAME_SPEED_OPTIONS[nextIndex];
    this.setGameSpeedMultiplier(nextSpeed);
    return nextSpeed;
  }

  /**
   * Get chapter progress
   */
  getChapterProgress(chapterId: number): ChapterProgress | undefined {
    return this.data.chapters.find((c) => c.chapterId === chapterId);
  }

  /**
   * Get highest unlocked chapter
   */
  getHighestUnlockedChapter(): number {
    return Math.max(...this.data.unlockedChapters);
  }

  // ============================================
  // Setters - Write Access
  // ============================================

  /**
   * Add gold
   */
  addGold(amount: number): void {
    this.data.gold = Math.max(0, this.data.gold + amount);
    this.markDirty();
  }

  /**
   * Spend gold (returns false if not enough)
   */
  spendGold(amount: number): boolean {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.markDirty();
    return true;
  }

  /**
   * Add gems
   */
  addGems(amount: number): void {
    this.data.gems = Math.max(0, this.data.gems + amount);
    this.markDirty();
  }

  /**
   * Spend gems (returns false if not enough)
   */
  spendGems(amount: number): boolean {
    if (this.data.gems < amount) return false;
    this.data.gems -= amount;
    this.markDirty();
    return true;
  }

  /**
   * Add scrolls
   */
  addScrolls(amount: number): void {
    this.data.scrolls = Math.max(0, this.data.scrolls + amount);
    this.markDirty();
  }

  /**
   * Set selected hero
   */
  selectHero(heroId: string): boolean {
    const hero = this.data.heroes[heroId];
    if (!hero || !hero.unlocked) return false;
    this.data.selectedHeroId = heroId;
    this.markDirty();
    return true;
  }

  /**
   * Unlock a hero
   */
  unlockHero(heroId: string): boolean {
    const hero = this.data.heroes[heroId];
    if (!hero) return false;
    hero.unlocked = true;
    this.markDirty();
    return true;
  }

  /**
   * Add hero experience (raw value storage only).
   * Note: For actual XP with level-up processing, use HeroManager.addXP() instead.
   * This method only stores the raw experience value without level calculations.
   */
  addHeroExperience(heroId: string, amount: number): void {
    const hero = this.data.heroes[heroId];
    if (!hero) return;
    hero.experience += amount;
    this.markDirty();
  }

  /**
   * Add equipment to inventory
   */
  addEquipment(item: EquipmentItem): void {
    this.data.inventory.push(item);
    this.markDirty();
  }

  /**
   * Remove equipment from inventory
   */
  removeEquipment(itemId: string): boolean {
    const index = this.data.inventory.findIndex((item) => item.id === itemId);
    if (index === -1) return false;

    // Unequip if equipped
    for (const slot of Object.values(EquipmentSlot)) {
      if (this.data.equipped[slot] === itemId) {
        this.data.equipped[slot] = null;
      }
    }

    this.data.inventory.splice(index, 1);
    this.markDirty();
    return true;
  }

  /**
   * Equip an item
   */
  equipItem(itemId: string): boolean {
    const item = this.data.inventory.find((i) => i.id === itemId);
    if (!item) return false;
    this.data.equipped[item.slot] = itemId;
    this.markDirty();
    return true;
  }

  /**
   * Unequip an item from a slot
   */
  unequipSlot(slot: EquipmentSlot): void {
    this.data.equipped[slot] = null;
    this.markDirty();
  }

  /**
   * Update game settings
   */
  updateSettings(settings: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.markDirty();
  }

  /**
   * Set difficulty
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    this.data.settings.difficulty = difficulty;
    this.markDirty();
  }

  /**
   * Update player statistics
   */
  updateStatistics(updates: Partial<PlayerStatistics>): void {
    this.data.statistics = { ...this.data.statistics, ...updates };
    this.markDirty();
  }

  /**
   * Record an enemy kill for statistics
   */
  recordEnemyKill(enemyType: EnemyType): void {
    const currentKills = this.data.statistics.monsterKills.enemies[enemyType] ?? 0;
    this.data.statistics.monsterKills.enemies[enemyType] = currentKills + 1;
    this.markDirty();
  }

  /**
   * Record a boss kill for statistics
   */
  recordBossKill(bossId: BossId): void {
    const currentKills = this.data.statistics.monsterKills.bosses[bossId] ?? 0;
    this.data.statistics.monsterKills.bosses[bossId] = currentKills + 1;
    this.markDirty();
  }

  /**
   * Get kill count for a specific enemy type
   */
  getEnemyKillCount(enemyType: EnemyType): number {
    return this.data.statistics.monsterKills.enemies[enemyType] ?? 0;
  }

  /**
   * Get kill count for a specific boss
   */
  getBossKillCount(bossId: BossId): number {
    return this.data.statistics.monsterKills.bosses[bossId] ?? 0;
  }

  /**
   * Get all monster kill statistics
   */
  getMonsterKillStats(): Readonly<MonsterKillStats> {
    return this.data.statistics.monsterKills;
  }

  /**
   * Record a completed run (always endless mode)
   */
  recordRun(options: {
    kills: number;
    roomsCleared: number;
    playTimeMs: number;
    bossDefeated: boolean;
    abilitiesGained: number;
    victory: boolean;
    score: number;
    difficulty?: DifficultyLevel;
    isEndlessMode?: boolean; // Kept for compatibility, always treated as true
    endlessWave?: number;
    goldEarned?: number;
    heroId?: string;
    acquiredAbilities?: HighScoreAbility[];
  }): void {
    const stats = this.data.statistics;

    stats.totalRuns++;
    stats.totalKills += options.kills;
    stats.totalPlayTimeMs += options.playTimeMs;
    stats.abilitiesAcquired += options.abilitiesGained;

    // Always count as death in endless mode (no victory)
    stats.totalDeaths++;

    if (options.bossDefeated) {
      stats.bossesDefeated++;
    }

    if (options.roomsCleared > stats.highestRoom) {
      stats.highestRoom = options.roomsCleared;
    }

    if (options.roomsCleared > stats.longestRun) {
      stats.longestRun = options.roomsCleared;
    }

    // Track high score with difficulty and full run data
    if (options.score > stats.highestScore) {
      stats.highestScore = options.score;
      stats.highScoreDifficulty = options.difficulty;

      // Save full run data for the high score
      stats.highScoreRun = {
        achievedAt: Date.now(),
        score: options.score,
        endlessWave: options.endlessWave ?? 1,
        roomsCleared: options.roomsCleared,
        enemiesKilled: options.kills,
        goldEarned: options.goldEarned ?? 0,
        playTimeMs: options.playTimeMs,
        difficulty: options.difficulty ?? DifficultyLevel.NORMAL,
        heroId: options.heroId ?? this.data.selectedHeroId,
        acquiredAbilities: options.acquiredAbilities ?? [],
      };
    }

    // Track endless mode high wave (always endless now)
    if (options.endlessWave !== undefined) {
      const currentHighWave = stats.endlessHighWave ?? 0;
      if (options.endlessWave > currentHighWave) {
        stats.endlessHighWave = options.endlessWave;
      }
    }

    this.markDirty();
  }

  /**
   * Get the full high score run data
   */
  getHighScoreRun(): Readonly<HighScoreRunData> | undefined {
    return this.data.statistics.highScoreRun;
  }

  /**
   * Update chapter progress
   */
  updateChapterProgress(
    chapterId: number,
    highestRoom: number,
    completed: boolean,
    stars: number,
  ): void {
    let chapter = this.data.chapters.find((c) => c.chapterId === chapterId);

    if (!chapter) {
      chapter = { chapterId, highestRoom: 0, completed: false, stars: 0 };
      this.data.chapters.push(chapter);
    }

    if (highestRoom > chapter.highestRoom) {
      chapter.highestRoom = highestRoom;
    }

    if (completed && !chapter.completed) {
      chapter.completed = true;
      // Unlock next chapter
      if (!this.data.unlockedChapters.includes(chapterId + 1)) {
        this.data.unlockedChapters.push(chapterId + 1);
      }
    }

    if (stars > chapter.stars) {
      chapter.stars = stars;
    }

    // Update highest chapter stat
    if (chapterId > this.data.statistics.highestChapter) {
      this.data.statistics.highestChapter = chapterId;
    }

    this.markDirty();
  }

  /**
   * Add talent points
   */
  addTalentPoints(amount: number): void {
    this.data.talentPoints += amount;
    this.markDirty();
  }

  /**
   * Unlock or upgrade a talent
   */
  upgradeTalent(talentId: string, maxLevel: number): boolean {
    if (this.data.talentPoints <= 0) return false;

    let talent = this.data.talents.find((t) => t.id === talentId);

    if (!talent) {
      talent = { id: talentId, level: 0, maxLevel };
      this.data.talents.push(talent);
    }

    if (talent.level >= talent.maxLevel) return false;

    talent.level++;
    this.data.talentPoints--;
    this.markDirty();
    return true;
  }

  /**
   * Get talent level
   */
  getTalentLevel(talentId: string): number {
    const talent = this.data.talents.find((t) => t.id === talentId);
    return talent?.level ?? 0;
  }

  /**
   * Check if tutorial has been completed
   */
  isTutorialCompleted(): boolean {
    return this.data.tutorialCompleted ?? false;
  }

  /**
   * Mark tutorial as completed
   */
  completeTutorial(): void {
    this.data.tutorialCompleted = true;
    this.markDirty();
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * Global SaveManager instance
 * Use this for all save/load operations
 */
export const saveManager = new SaveManager();

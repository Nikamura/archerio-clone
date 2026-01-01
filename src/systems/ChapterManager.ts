/**
 * ChapterManager - Manages chapter progression, unlocks, and run tracking.
 *
 * The chapter system provides:
 * - 5 chapters with 20 rooms each
 * - Progressive difficulty scaling
 * - Star rating based on performance
 * - Chapter completion rewards
 * - Unlock gates (complete previous chapter to unlock next)
 *
 * Uses singleton pattern for global access throughout the game.
 */

import {
  ChapterId,
  ChapterDefinition,
  ChapterRewards,
  EnemyType,
  RoomType,
  CHAPTER_DEFINITIONS,
  ROOMS_PER_CHAPTER,
  STAR_REWARD_MULTIPLIERS,
  getRoomTypeForNumber,
  getChapterDefinition,
  isValidChapterId,
  calculateStarRating,
  calculateChapterRewards as calculateRewardsFromData,
} from '../config/chapterData'

// ============================================
// Type Definitions
// ============================================

/**
 * Current run state within a chapter
 */
export interface ChapterRunState {
  /** Current chapter being played */
  chapterId: ChapterId
  /** Current room number (1-20) */
  currentRoom: number
  /** Number of deaths during this run (for star calculation) */
  deathsDuringRun: number
  /** Whether the run is active */
  isActive: boolean
  /** Timestamp when run started */
  startedAt: number
}

/**
 * Chapter progress data for a single chapter
 */
export interface ChapterProgressData {
  /** Chapter ID */
  chapterId: ChapterId
  /** Highest room reached */
  highestRoom: number
  /** Whether chapter has been completed */
  completed: boolean
  /** Best star rating achieved (0-3) */
  bestStars: 0 | 1 | 2 | 3
  /** Number of times completed */
  completionCount: number
  /** Best completion time in milliseconds */
  bestTimeMs: number | null
}

/**
 * Save data structure for ChapterManager
 */
export interface ChapterSaveData {
  /** Map of chapter ID to progress data */
  chapterProgress: Record<number, ChapterProgressData>
  /** Set of unlocked chapter IDs */
  unlockedChapters: number[]
  /** Currently selected chapter for play */
  selectedChapter: ChapterId
}

/**
 * Result of completing a chapter
 */
export interface ChapterCompletionResult {
  chapterId: ChapterId
  stars: 0 | 1 | 2 | 3
  rewards: ChapterRewards
  isFirstCompletion: boolean
  newChapterUnlocked: ChapterId | null
  completionTimeMs: number
}

/**
 * Event types emitted by ChapterManager
 */
export type ChapterEventType =
  | 'chapterStarted'
  | 'chapterCompleted'
  | 'chapterFailed'
  | 'roomEntered'
  | 'roomCleared'
  | 'chapterUnlocked'
  | 'starRatingAchieved'

/**
 * Event data passed to listeners
 */
export interface ChapterEventData {
  type: ChapterEventType
  chapterId?: ChapterId
  roomNumber?: number
  roomType?: RoomType
  stars?: 0 | 1 | 2 | 3
  rewards?: ChapterRewards
  newChapterUnlocked?: ChapterId
}

/**
 * Event listener callback type
 */
export type ChapterEventCallback = (data: ChapterEventData) => void

// ============================================
// Constants
// ============================================

/** Default starting chapter */
const DEFAULT_CHAPTER: ChapterId = 1
const CHAPTER_STORAGE_KEY = 'arrow_game_chapter_data'

// ============================================
// ChapterManager Class
// ============================================

export class ChapterManager {
  /** Progress data for each chapter */
  private chapterProgress: Map<ChapterId, ChapterProgressData>

  /** Set of unlocked chapter IDs */
  private unlockedChapters: Set<ChapterId>

  /** Currently selected chapter */
  private selectedChapter: ChapterId

  /** Current run state (null if no active run) */
  private currentRun: ChapterRunState | null = null

  /** Event listeners */
  private eventListeners: Map<ChapterEventType, Set<ChapterEventCallback>>

  constructor() {
    this.chapterProgress = new Map()
    this.unlockedChapters = new Set([1]) // Chapter 1 always unlocked
    this.selectedChapter = DEFAULT_CHAPTER
    this.eventListeners = new Map()

    // Initialize progress for chapter 1
    this.initializeChapterProgress(1)

    // Load from persistent storage
    this.loadFromStorage()
  }

  /**
   * Save chapter data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = this.toSaveData()
      localStorage.setItem(CHAPTER_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('ChapterManager: Failed to save data:', error)
    }
  }

  /**
   * Load chapter data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CHAPTER_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as ChapterSaveData
        this.fromSaveData(data)
        console.log(`ChapterManager: Loaded ${this.unlockedChapters.size} unlocked chapters from storage`)
      }
    } catch (error) {
      console.error('ChapterManager: Failed to load data:', error)
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to chapter events
   */
  on(eventType: ChapterEventType, callback: ChapterEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from chapter events
   */
  off(eventType: ChapterEventType, callback: ChapterEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: ChapterEventType, data: ChapterEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  // ============================================
  // Chapter Selection & Unlocks
  // ============================================

  /**
   * Get the currently selected chapter
   */
  getSelectedChapter(): ChapterId {
    return this.selectedChapter
  }

  /**
   * Get the chapter definition for the selected chapter
   */
  getSelectedChapterDefinition(): ChapterDefinition {
    return getChapterDefinition(this.selectedChapter)
  }

  /**
   * Select a chapter for play
   * @returns true if selection was successful
   */
  selectChapter(chapterId: ChapterId): boolean {
    if (!this.isChapterUnlocked(chapterId)) {
      console.warn(`ChapterManager: Cannot select locked chapter ${chapterId}`)
      return false
    }

    this.selectedChapter = chapterId
    this.saveToStorage()
    return true
  }

  /**
   * Check if a chapter is unlocked
   */
  isChapterUnlocked(chapterId: ChapterId): boolean {
    return this.unlockedChapters.has(chapterId)
  }

  /**
   * Get all unlocked chapter IDs
   */
  getUnlockedChapters(): ChapterId[] {
    return Array.from(this.unlockedChapters).sort((a, b) => a - b)
  }

  /**
   * Get the highest unlocked chapter
   */
  getHighestUnlockedChapter(): ChapterId {
    return Math.max(...this.unlockedChapters) as ChapterId
  }

  /**
   * Unlock a chapter (internal use)
   */
  private unlockChapter(chapterId: ChapterId): boolean {
    if (!isValidChapterId(chapterId)) {
      return false
    }

    if (this.unlockedChapters.has(chapterId)) {
      return false // Already unlocked
    }

    this.unlockedChapters.add(chapterId)
    this.initializeChapterProgress(chapterId)
    this.saveToStorage()

    this.emit('chapterUnlocked', {
      type: 'chapterUnlocked',
      chapterId,
    })

    return true
  }

  // ============================================
  // Chapter Progress
  // ============================================

  /**
   * Initialize progress tracking for a chapter
   */
  private initializeChapterProgress(chapterId: ChapterId): void {
    if (this.chapterProgress.has(chapterId)) {
      return
    }

    this.chapterProgress.set(chapterId, {
      chapterId,
      highestRoom: 0,
      completed: false,
      bestStars: 0,
      completionCount: 0,
      bestTimeMs: null,
    })
  }

  /**
   * Get progress for a specific chapter
   */
  getChapterProgress(chapterId: ChapterId): ChapterProgressData | undefined {
    return this.chapterProgress.get(chapterId)
  }

  /**
   * Get progress for all chapters
   */
  getAllChapterProgress(): ChapterProgressData[] {
    return Array.from(this.chapterProgress.values())
  }

  /**
   * Check if a chapter has been completed
   */
  isChapterCompleted(chapterId: ChapterId): boolean {
    const progress = this.chapterProgress.get(chapterId)
    return progress?.completed ?? false
  }

  /**
   * Get the best star rating for a chapter
   */
  getBestStars(chapterId: ChapterId): 0 | 1 | 2 | 3 {
    const progress = this.chapterProgress.get(chapterId)
    return progress?.bestStars ?? 0
  }

  // ============================================
  // Run Management
  // ============================================

  /**
   * Start a new chapter run
   */
  startChapter(chapterId: ChapterId): boolean {
    if (!this.isChapterUnlocked(chapterId)) {
      console.warn(`ChapterManager: Cannot start locked chapter ${chapterId}`)
      return false
    }

    // End any existing run
    if (this.currentRun?.isActive) {
      this.endRun(false)
    }

    this.currentRun = {
      chapterId,
      currentRoom: 1,
      deathsDuringRun: 0,
      isActive: true,
      startedAt: Date.now(),
    }

    this.emit('chapterStarted', {
      type: 'chapterStarted',
      chapterId,
      roomNumber: 1,
    })

    return true
  }

  /**
   * Get the current run state
   */
  getCurrentRun(): ChapterRunState | null {
    return this.currentRun
  }

  /**
   * Get the current room number
   */
  getCurrentRoom(): number {
    return this.currentRun?.currentRoom ?? 0
  }

  /**
   * Get the total rooms in the current chapter
   */
  getTotalRooms(): number {
    return ROOMS_PER_CHAPTER
  }

  /**
   * Get room type for a specific room number
   */
  getRoomType(roomNumber: number): RoomType {
    return getRoomTypeForNumber(roomNumber)
  }

  /**
   * Advance to the next room
   */
  advanceRoom(): boolean {
    if (!this.currentRun?.isActive) {
      console.warn('ChapterManager: No active run')
      return false
    }

    const nextRoom = this.currentRun.currentRoom + 1

    if (nextRoom > ROOMS_PER_CHAPTER) {
      // Chapter complete!
      return false
    }

    this.currentRun.currentRoom = nextRoom

    // Update highest room
    const progress = this.chapterProgress.get(this.currentRun.chapterId)
    if (progress && nextRoom > progress.highestRoom) {
      progress.highestRoom = nextRoom
      this.saveToStorage()
    }

    const roomType = this.getRoomType(nextRoom)

    this.emit('roomEntered', {
      type: 'roomEntered',
      chapterId: this.currentRun.chapterId,
      roomNumber: nextRoom,
      roomType,
    })

    return true
  }

  /**
   * Mark the current room as cleared
   */
  clearRoom(): void {
    if (!this.currentRun?.isActive) {
      return
    }

    this.emit('roomCleared', {
      type: 'roomCleared',
      chapterId: this.currentRun.chapterId,
      roomNumber: this.currentRun.currentRoom,
      roomType: this.getRoomType(this.currentRun.currentRoom),
    })
  }

  /**
   * Record a death during the run (for star calculation)
   */
  recordDeath(): void {
    if (this.currentRun?.isActive) {
      this.currentRun.deathsDuringRun++
    }
  }

  /**
   * Complete the chapter with given performance metrics
   */
  completeChapter(
    hpRemaining: number,
    maxHp: number
  ): ChapterCompletionResult | null {
    if (!this.currentRun?.isActive) {
      console.warn('ChapterManager: No active run to complete')
      return null
    }

    const { chapterId, deathsDuringRun, startedAt } = this.currentRun
    const completionTimeMs = Date.now() - startedAt

    // Calculate star rating
    const stars = calculateStarRating(true, hpRemaining, maxHp, deathsDuringRun)

    // Get progress and check if first completion
    const progress = this.chapterProgress.get(chapterId)!
    const isFirstCompletion = !progress.completed

    // Calculate rewards
    const rewards = calculateRewardsFromData(
      chapterId,
      stars as 1 | 2 | 3,
      isFirstCompletion
    )

    // Update progress
    progress.completed = true
    progress.completionCount++
    progress.highestRoom = ROOMS_PER_CHAPTER

    if (stars > progress.bestStars) {
      progress.bestStars = stars
    }

    if (progress.bestTimeMs === null || completionTimeMs < progress.bestTimeMs) {
      progress.bestTimeMs = completionTimeMs
    }

    // Check for next chapter unlock
    let newChapterUnlocked: ChapterId | null = null
    if (chapterId < 5) {
      const nextChapter = (chapterId + 1) as ChapterId
      if (!this.unlockedChapters.has(nextChapter)) {
        this.unlockChapter(nextChapter)
        newChapterUnlocked = nextChapter
      }
    }

    // End the run
    this.currentRun.isActive = false

    // Save persistent progress
    this.saveToStorage()

    // Emit events
    this.emit('starRatingAchieved', {
      type: 'starRatingAchieved',
      chapterId,
      stars,
    })

    this.emit('chapterCompleted', {
      type: 'chapterCompleted',
      chapterId,
      stars,
      rewards,
      newChapterUnlocked: newChapterUnlocked ?? undefined,
    })

    return {
      chapterId,
      stars,
      rewards,
      isFirstCompletion,
      newChapterUnlocked,
      completionTimeMs,
    }
  }

  /**
   * End the current run (failed or abandoned)
   */
  endRun(failed: boolean = true): void {
    if (!this.currentRun?.isActive) {
      return
    }

    const { chapterId, currentRoom } = this.currentRun

    // Update highest room if applicable
    const progress = this.chapterProgress.get(chapterId)
    if (progress && currentRoom > progress.highestRoom) {
      progress.highestRoom = currentRoom
      this.saveToStorage()
    }

    this.currentRun.isActive = false

    if (failed) {
      this.emit('chapterFailed', {
        type: 'chapterFailed',
        chapterId,
        roomNumber: currentRoom,
      })
    }
  }

  // ============================================
  // Enemy Pool & Difficulty
  // ============================================

  /**
   * Get the enemy pool for a specific chapter
   */
  getEnemyPoolForChapter(chapterId: ChapterId): EnemyType[] {
    const chapter = CHAPTER_DEFINITIONS[chapterId]
    return [...chapter.enemyTypes]
  }

  /**
   * Get the enemy pool for the current run
   */
  getCurrentEnemyPool(): EnemyType[] {
    if (!this.currentRun) {
      return this.getEnemyPoolForChapter(this.selectedChapter)
    }
    return this.getEnemyPoolForChapter(this.currentRun.chapterId)
  }

  /**
   * Get chapter definition by ID
   */
  getChapterDefinition(chapterId: ChapterId): ChapterDefinition {
    return CHAPTER_DEFINITIONS[chapterId]
  }

  /**
   * Get the scaling multipliers for a chapter
   */
  getChapterScaling(chapterId: ChapterId): {
    enemyHpMultiplier: number
    enemyDamageMultiplier: number
    extraEnemiesPerRoom: number
    bossHpMultiplier: number
    bossDamageMultiplier: number
  } {
    return { ...CHAPTER_DEFINITIONS[chapterId].scaling }
  }

  // ============================================
  // Reward Calculations
  // ============================================

  /**
   * Calculate potential rewards for completing a chapter
   * (Used for UI display before completion)
   */
  calculatePotentialRewards(
    chapterId: ChapterId,
    stars: 1 | 2 | 3
  ): ChapterRewards {
    const isFirstCompletion = !this.isChapterCompleted(chapterId)
    return calculateRewardsFromData(chapterId, stars, isFirstCompletion)
  }

  /**
   * Get the star reward multiplier
   */
  getStarMultiplier(stars: 1 | 2 | 3): number {
    return STAR_REWARD_MULTIPLIERS[stars]
  }

  // ============================================
  // Persistence (Save/Load)
  // ============================================

  /**
   * Get data for saving to storage
   */
  toSaveData(): ChapterSaveData {
    const chapterProgress: Record<number, ChapterProgressData> = {}

    for (const [id, progress] of this.chapterProgress) {
      chapterProgress[id] = { ...progress }
    }

    return {
      chapterProgress,
      unlockedChapters: Array.from(this.unlockedChapters),
      selectedChapter: this.selectedChapter,
    }
  }

  /**
   * Load data from storage
   */
  fromSaveData(data: ChapterSaveData): void {
    // Clear existing data
    this.chapterProgress.clear()
    this.unlockedChapters.clear()

    // Load unlocked chapters
    if (data.unlockedChapters && Array.isArray(data.unlockedChapters)) {
      for (const id of data.unlockedChapters) {
        if (isValidChapterId(id)) {
          this.unlockedChapters.add(id as ChapterId)
        }
      }
    }

    // Ensure chapter 1 is always unlocked
    if (!this.unlockedChapters.has(1)) {
      this.unlockedChapters.add(1)
    }

    // Load chapter progress
    if (data.chapterProgress) {
      for (const [idStr, progress] of Object.entries(data.chapterProgress)) {
        const id = parseInt(idStr, 10)
        if (isValidChapterId(id)) {
          this.chapterProgress.set(id as ChapterId, {
            chapterId: id as ChapterId,
            highestRoom: progress.highestRoom ?? 0,
            completed: progress.completed ?? false,
            bestStars: (progress.bestStars ?? 0) as 0 | 1 | 2 | 3,
            completionCount: progress.completionCount ?? 0,
            bestTimeMs: progress.bestTimeMs ?? null,
          })
        }
      }
    }

    // Initialize progress for unlocked chapters that don't have progress data
    for (const id of this.unlockedChapters) {
      this.initializeChapterProgress(id)
    }

    // Load selected chapter
    if (
      data.selectedChapter &&
      isValidChapterId(data.selectedChapter) &&
      this.unlockedChapters.has(data.selectedChapter)
    ) {
      this.selectedChapter = data.selectedChapter
    } else {
      this.selectedChapter = DEFAULT_CHAPTER
    }
  }

  /**
   * Reset all chapter progress
   */
  reset(): void {
    this.chapterProgress.clear()
    this.unlockedChapters.clear()
    this.unlockedChapters.add(1)
    this.selectedChapter = DEFAULT_CHAPTER
    this.currentRun = null
    this.initializeChapterProgress(1)
    this.saveToStorage()
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a debug snapshot of current state
   */
  getDebugSnapshot(): {
    selectedChapter: ChapterId
    unlockedChapters: ChapterId[]
    currentRun: ChapterRunState | null
    chapterProgress: ChapterProgressData[]
  } {
    return {
      selectedChapter: this.selectedChapter,
      unlockedChapters: this.getUnlockedChapters(),
      currentRun: this.currentRun ? { ...this.currentRun } : null,
      chapterProgress: this.getAllChapterProgress(),
    }
  }

  /**
   * Force unlock a chapter (for testing/cheats)
   */
  forceUnlockChapter(chapterId: ChapterId): void {
    if (isValidChapterId(chapterId)) {
      this.unlockedChapters.add(chapterId)
      this.initializeChapterProgress(chapterId)
      this.saveToStorage()
    }
  }

  /**
   * Force complete a chapter with given stars (for testing/cheats)
   */
  forceCompleteChapter(chapterId: ChapterId, stars: 1 | 2 | 3): void {
    if (!isValidChapterId(chapterId)) return

    this.initializeChapterProgress(chapterId)
    const progress = this.chapterProgress.get(chapterId)!

    progress.completed = true
    progress.completionCount++
    progress.highestRoom = ROOMS_PER_CHAPTER

    if (stars > progress.bestStars) {
      progress.bestStars = stars
    }

    // Unlock next chapter
    if (chapterId < 5) {
      this.forceUnlockChapter((chapterId + 1) as ChapterId)
    }

    this.saveToStorage()
  }
}

// ============================================
// Singleton Instance
// ============================================

/** Global singleton instance for use throughout the game */
export const chapterManager = new ChapterManager()

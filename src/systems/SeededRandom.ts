/**
 * SeededRandom - Deterministic pseudo-random number generator
 *
 * Uses the Mulberry32 algorithm for fast, high-quality deterministic randomness.
 * Allows runs to be reproducible by using the same seed.
 *
 * Usage:
 *   const rng = new SeededRandom(12345) // Create with seed
 *   rng.random() // 0-1, like Math.random()
 *   rng.randomInt(min, max) // Integer in range [min, max]
 *   rng.randomFloat(min, max) // Float in range [min, max]
 *   rng.pick(array) // Pick random element from array
 *   rng.weightedPick(items, weights) // Weighted random selection
 */

export class SeededRandom {
  private seed: number
  private initialSeed: number

  constructor(seed?: number | string) {
    if (seed === undefined) {
      // Generate a random seed
      this.initialSeed = Math.floor(Math.random() * 2147483647)
    } else if (typeof seed === 'string') {
      // Convert string seed to number using simple hash
      this.initialSeed = this.hashString(seed)
    } else {
      this.initialSeed = Math.floor(seed)
    }

    this.seed = this.initialSeed
  }

  /**
   * Simple string hash function (djb2)
   */
  private hashString(str: string): number {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    }
    return Math.abs(hash) % 2147483647
  }

  /**
   * Get the initial seed value (for display/sharing)
   */
  getSeed(): number {
    return this.initialSeed
  }

  /**
   * Get seed as a shareable string (alphanumeric, 6-8 chars)
   */
  getSeedString(): string {
    // Convert to base-36 for shorter representation
    return this.initialSeed.toString(36).toUpperCase()
  }

  /**
   * Reset to initial seed (replay the same sequence)
   */
  reset(): void {
    this.seed = this.initialSeed
  }

  /**
   * Mulberry32 PRNG - returns float in [0, 1)
   */
  random(): number {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Returns random integer in range [min, max] (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  /**
   * Returns random float in range [min, max)
   */
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min
  }

  /**
   * Returns true with given probability (0-1)
   */
  chance(probability: number): boolean {
    return this.random() < probability
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array')
    }
    const index = Math.floor(this.random() * array.length)
    return array[index]
  }

  /**
   * Pick random element with weighted probabilities
   * @param items Array of items to pick from
   * @param weights Array of weights (same length as items)
   */
  weightedPick<T>(items: T[], weights: number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new Error('Items and weights must be non-empty arrays of equal length')
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive')
    }

    let random = this.random() * totalWeight

    for (let i = 0; i < items.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return items[i]
      }
    }

    // Fallback (shouldn't happen with correct weights)
    return items[items.length - 1]
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /**
   * Create a new SeededRandom with a derived seed
   * Useful for creating independent random streams for different systems
   */
  derive(key: string): SeededRandom {
    const derivedSeed = this.initialSeed ^ this.hashString(key)
    return new SeededRandom(derivedSeed)
  }

  /**
   * Parse a seed from string input (handles both numeric and alphanumeric seeds)
   */
  static parseSeed(input: string): number {
    input = input.trim().toUpperCase()

    // If it's a valid base-36 number, convert it
    const base36Value = parseInt(input, 36)
    if (!isNaN(base36Value) && base36Value > 0) {
      return base36Value
    }

    // If it's a regular number, use it directly
    const numValue = parseInt(input, 10)
    if (!isNaN(numValue) && numValue > 0) {
      return numValue
    }

    // Otherwise hash the string
    let hash = 5381
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    }
    return Math.abs(hash) % 2147483647
  }

  /**
   * Generate a random seed (for creating new runs)
   */
  static generateSeed(): number {
    return Math.floor(Math.random() * 2147483647)
  }
}

// Default export for convenience
export default SeededRandom

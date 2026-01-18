import type Player from "../../entities/Player";
import type GoldPool from "../../systems/GoldPool";
import type HealthPool from "../../systems/HealthPool";
import type { ParticleManager } from "../../systems/ParticleManager";
import type { PassiveEffectSystem } from "./PassiveEffectSystem";
import { currencyManager } from "../../systems/CurrencyManager";
import { saveManager } from "../../systems/SaveManager";
import { hapticManager } from "../../systems/HapticManager";

/**
 * Event handlers for pickup collection events
 */
export interface PickupEventHandlers {
  onGoldCollected: (amount: number) => void;
  onHealthCollected: (healAmount: number) => void;
  onUpdateHealthUI: () => void;
}

/**
 * Configuration for PickupSystem
 */
export interface PickupSystemConfig {
  player: Player;
  goldPool: GoldPool;
  healthPool: HealthPool;
  particles: ParticleManager;
  goldBonusMultiplier: number;
  getPassiveEffectSystem: () => PassiveEffectSystem;
  eventHandlers: PickupEventHandlers;
}

/**
 * PickupSystem - Handles gold and health pickup collection
 *
 * Extracts pickup collection logic from GameScene's update loop:
 * - Gold collection with equipment bonus multiplier
 * - Currency tracking and persistence
 * - Health pickup collection and healing
 * - UI updates and particle effects
 * - Haptic feedback
 * - Iron Will talent state checking
 */
export class PickupSystem {
  private player: Player;
  private goldPool: GoldPool;
  private healthPool: HealthPool;
  private particles: ParticleManager;
  private goldBonusMultiplier: number;
  private getPassiveEffectSystem: () => PassiveEffectSystem;
  private eventHandlers: PickupEventHandlers;

  // Track gold earned this run
  private goldEarned: number = 0;

  constructor(config: PickupSystemConfig) {
    this.player = config.player;
    this.goldPool = config.goldPool;
    this.healthPool = config.healthPool;
    this.particles = config.particles;
    this.goldBonusMultiplier = config.goldBonusMultiplier;
    this.getPassiveEffectSystem = config.getPassiveEffectSystem;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Update pickup collection - called each frame
   * Checks for gold and health pickup collection at player position
   */
  update(playerX: number, playerY: number): void {
    // Update gold pickups - check for collection, apply equipment gold bonus
    const baseGoldCollected = this.goldPool.updateAll(playerX, playerY);
    if (baseGoldCollected > 0) {
      const goldCollected = Math.round(baseGoldCollected * this.goldBonusMultiplier);
      this.goldEarned += goldCollected;
      currencyManager.add("gold", goldCollected);
      saveManager.addGold(goldCollected);
      // Gold collect particles at player position
      this.particles.emitGoldCollect(playerX, playerY);
      hapticManager.light(); // Haptic feedback for collecting gold
      this.eventHandlers.onGoldCollected(goldCollected);
    }

    // Update health pickups - check for collection
    this.healthPool.updateAll(playerX, playerY, (healAmount) => {
      this.player.heal(healAmount);
      // Update health UI
      this.eventHandlers.onUpdateHealthUI();
      // Check Iron Will talent (deactivate if above threshold after healing)
      this.getPassiveEffectSystem().checkIronWillStatus();
      // Heal particles at player position
      this.particles.emitHeal(playerX, playerY);
      hapticManager.light(); // Haptic feedback for collecting health
      this.eventHandlers.onHealthCollected(healAmount);
    });
  }

  /**
   * Get total gold earned this run
   */
  getGoldEarned(): number {
    return this.goldEarned;
  }

  /**
   * Add gold earned (used by room transitions for collected gold)
   */
  addGoldEarned(amount: number): void {
    this.goldEarned += amount;
  }

  /**
   * Reset gold earned counter (used when starting new run)
   */
  resetGoldEarned(): void {
    this.goldEarned = 0;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // No resources to clean up - pools are managed by GameScene
  }
}

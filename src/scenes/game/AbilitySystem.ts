import Player from "../../entities/Player";

/**
 * Acquired ability with its level
 */
export interface AcquiredAbility {
  id: string;
  level: number;
}

/**
 * Callback type for ability events
 */
export interface AbilityEventHandlers {
  onAbilitiesUpdated: (abilities: AcquiredAbility[]) => void;
  onHealthUpdated: (current: number, max: number) => void;
}

/**
 * AbilitySystem - Manages player ability acquisition and tracking
 *
 * Extracted from GameScene to provide focused ability management.
 * Handles ability application, level tracking, and UI notifications.
 */
export class AbilitySystem {
  private player: Player;
  private acquiredAbilities: Map<string, number> = new Map();
  private abilitiesGained: number = 0;
  private eventHandlers: AbilityEventHandlers;

  constructor(player: Player, eventHandlers: AbilityEventHandlers) {
    this.player = player;
    this.eventHandlers = eventHandlers;
  }

  /**
   * Apply an ability to the player
   */
  applyAbility(abilityId: string): void {
    switch (abilityId) {
      // Original 8 abilities
      case "front_arrow":
        this.player.addFrontArrow();
        break;
      case "multishot":
        this.player.addMultishot();
        break;
      case "attack_speed":
        this.player.addAttackSpeedBoost(0.25); // +25%
        break;
      case "attack_boost":
        this.player.addDamageBoost(0.3); // +30%
        break;
      case "piercing":
        this.player.addPiercing();
        break;
      case "ricochet":
        this.player.addRicochet();
        break;
      case "fire_damage":
        this.player.addFireDamage();
        break;
      case "crit_boost":
        this.player.addCritBoost();
        break;

      // New V1 abilities
      case "ice_shot":
        this.player.addIceShot();
        break;
      case "poison_shot":
        this.player.addPoisonShot();
        break;
      case "lightning_chain":
        this.player.addLightningChain();
        break;
      case "diagonal_arrows":
        this.player.addDiagonalArrows();
        break;
      case "bloodthirst":
        this.player.addBloodthirst();
        break;
      case "speed_boost":
        this.player.addSpeedBoost();
        break;
      case "max_health":
        this.player.addMaxHealthBoost();
        break;
      case "dodge_master":
        this.player.addDodgeMaster();
        break;

      // Devil abilities
      case "extra_life":
        this.player.addExtraLife();
        break;
      case "through_wall":
        this.player.addThroughWall();
        break;

      // Note: Shatter and Fire Spread are now passive effects of Ice Shot and Fire Damage
      case "bleed":
        this.player.addBleed();
        break;

      // New orbital and effect abilities
      case "rotating_orbs":
        this.player.addRotatingOrbs();
        break;
      case "orbital_shields":
        this.player.addOrbitalShields();
        break;
      case "spirit_pets":
        this.player.addSpiritPets();
        break;
      case "death_nova":
        this.player.addDeathNova();
        break;
      case "homing_arrows":
        this.player.addHomingArrows();
        break;
      case "explosive_arrows":
        this.player.addExplosiveArrows();
        break;
      case "shield_barrier":
        this.player.addShieldBarrier();
        break;
      case "knockback":
        this.player.addKnockback();
        break;

      // Game modifier abilities
      case "ascetic":
        this.player.addAscetic();
        break;
      case "horde_magnet":
        this.player.addHordeMagnet();
        break;

      // Movement abilities
      case "mobile_fire":
        this.player.addMobileFire();
        break;

      // Glass Cannon ability
      case "glass_cannon":
        this.player.addGlassCannon();
        break;
    }

    this.abilitiesGained++;

    // Track ability with its level
    const currentLevel = this.acquiredAbilities.get(abilityId) || 0;
    this.acquiredAbilities.set(abilityId, currentLevel + 1);

    // Notify about ability update
    this.eventHandlers.onAbilitiesUpdated(this.getAcquiredAbilitiesArray());

    // Update health UI (abilities like max_health change max HP)
    this.eventHandlers.onHealthUpdated(this.player.getHealth(), this.player.getMaxHealth());

    console.log(
      `Applied ability: ${abilityId} (level: ${currentLevel + 1}, total: ${this.abilitiesGained})`,
    );
  }

  /**
   * Get the level of a specific ability
   */
  getAbilityLevel(abilityId: string): number {
    return this.acquiredAbilities.get(abilityId) || 0;
  }

  /**
   * Check if player has a specific ability
   */
  hasAbility(abilityId: string): boolean {
    return this.acquiredAbilities.has(abilityId);
  }

  /**
   * Get total number of abilities gained
   */
  getTotalAbilitiesGained(): number {
    return this.abilitiesGained;
  }

  /**
   * Convert acquired abilities map to array for passing to other scenes
   */
  getAcquiredAbilitiesArray(): AcquiredAbility[] {
    return Array.from(this.acquiredAbilities.entries()).map(([id, level]) => ({ id, level }));
  }

  /**
   * Consume one level of an ability (e.g., when extra life is used)
   * Removes the ability from tracking if level reaches 0
   */
  consumeAbility(abilityId: string): void {
    const currentLevel = this.acquiredAbilities.get(abilityId) || 0;
    if (currentLevel <= 0) return;

    if (currentLevel === 1) {
      this.acquiredAbilities.delete(abilityId);
    } else {
      this.acquiredAbilities.set(abilityId, currentLevel - 1);
    }

    // Notify about ability update to refresh skills bar
    this.eventHandlers.onAbilitiesUpdated(this.getAcquiredAbilitiesArray());
  }

  /**
   * Reset all abilities (for new run)
   */
  reset(): void {
    this.acquiredAbilities.clear();
    this.abilitiesGained = 0;
  }

  /**
   * Apply multiple abilities at once (for starting abilities)
   */
  applyStartingAbilities(abilities: { id: string }[]): void {
    for (const ability of abilities) {
      this.applyAbility(ability.id);
    }
  }
}

export default AbilitySystem;

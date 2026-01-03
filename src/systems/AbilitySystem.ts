import Phaser from 'phaser'
import type Player from '../entities/Player'
import { audioManager } from './AudioManager'
import { hapticManager } from './HapticManager'
import { saveManager } from './SaveManager'
import type { ParticleManager } from './ParticleManager'
import type { TalentBonuses } from '../config/talentData'
import { ABILITIES } from '../scenes/LevelUpScene'
import type { AcquiredAbility } from '../types/GameTypes'

export interface AbilitySystemCallbacks {
  onAbilitiesUpdated: (abilities: AcquiredAbility[]) => void
  onHealthUpdated: () => void
  pausePhysics: () => void
  resumePhysics: () => void
  hideJoystick: () => void
  showJoystick: () => void
  resetJoystickState: () => void
  showAutoLevelUp: (ability: typeof ABILITIES[0]) => void
}

/**
 * AbilitySystem handles level ups and ability application.
 * Extracted from GameScene to centralize ability logic.
 */
export class AbilitySystem {
  private scene: Phaser.Scene
  private player: Player
  private particles: ParticleManager
  private talentBonuses: TalentBonuses
  private callbacks!: AbilitySystemCallbacks

  private acquiredAbilities: Map<string, number> = new Map()
  private abilitiesGained: number = 0

  constructor(
    scene: Phaser.Scene,
    player: Player,
    particles: ParticleManager,
    talentBonuses: TalentBonuses
  ) {
    this.scene = scene
    this.player = player
    this.particles = particles
    this.talentBonuses = talentBonuses
  }

  /**
   * Set callbacks for ability system events
   */
  setCallbacks(callbacks: AbilitySystemCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Get the number of abilities gained this run
   */
  getAbilitiesGained(): number {
    return this.abilitiesGained
  }

  /**
   * Get acquired abilities as array
   */
  getAcquiredAbilities(): AcquiredAbility[] {
    return Array.from(this.acquiredAbilities.entries()).map(([id, level]) => ({ id, level }))
  }

  /**
   * Handle player leveling up
   */
  handleLevelUp(): void {
    console.log('AbilitySystem: handleLevelUp called')
    audioManager.playLevelUp()
    hapticManager.levelUp()

    // Level up celebration particles
    this.particles.emitLevelUp(this.player.x, this.player.y)

    // Apply heal on level up talent bonus
    if (this.talentBonuses.flatHealOnLevel > 0) {
      this.player.heal(this.talentBonuses.flatHealOnLevel)
      console.log('AbilitySystem: Healed', this.talentBonuses.flatHealOnLevel, 'HP from talent')
    }

    // Check if auto level up is enabled
    if (saveManager.getAutoLevelUp()) {
      this.handleAutoLevelUp()
      return
    }

    // Reset joystick state before pausing to prevent stuck input
    this.callbacks.resetJoystickState()

    // Pause game physics
    this.callbacks.pausePhysics()

    // Hide joystick
    this.callbacks.hideJoystick()

    // Clean up any existing listeners to prevent multiple applications
    this.scene.game.events.off('abilitySelected')

    // Listen for ability selection using global game events
    this.scene.game.events.once('abilitySelected', (abilityId: string) => {
      console.log('AbilitySystem: received abilitySelected', abilityId)
      try {
        this.applyAbility(abilityId)
        console.log('AbilitySystem: resuming physics and showing joystick')
        // Ensure joystick state is reset before resuming
        this.callbacks.resetJoystickState()
        this.callbacks.resumePhysics()
        this.callbacks.showJoystick()
      } catch (error) {
        console.error('AbilitySystem: Error applying ability:', error)
        this.callbacks.resetJoystickState()
        this.callbacks.resumePhysics()
        this.callbacks.showJoystick()
      }
    })

    // Launch level up scene
    if (this.scene.scene.isActive('LevelUpScene')) {
      console.log('AbilitySystem: LevelUpScene already active, restarting it')
      this.scene.scene.stop('LevelUpScene')
    }

    this.scene.scene.launch('LevelUpScene', {
      playerLevel: this.player.getLevel(),
    })
  }

  /**
   * Handle auto level up - randomly select an ability
   */
  private handleAutoLevelUp(): void {
    const randomIndex = Math.floor(Math.random() * ABILITIES.length)
    const selectedAbility = ABILITIES[randomIndex]

    console.log('AbilitySystem: Auto level up selected:', selectedAbility.id)

    this.applyAbility(selectedAbility.id)

    // Notify UIScene to show the auto level up notification
    this.callbacks.showAutoLevelUp(selectedAbility)
  }

  /**
   * Apply an ability to the player
   */
  applyAbility(abilityId: string): void {
    switch (abilityId) {
      // Original 8 abilities
      case 'front_arrow':
        this.player.addFrontArrow()
        break
      case 'multishot':
        this.player.addMultishot()
        break
      case 'attack_speed':
        this.player.addAttackSpeedBoost(0.25) // +25%
        break
      case 'attack_boost':
        this.player.addDamageBoost(0.30) // +30%
        break
      case 'piercing':
        this.player.addPiercing()
        break
      case 'ricochet':
        this.player.addRicochet()
        break
      case 'fire_damage':
        this.player.addFireDamage()
        break
      case 'crit_boost':
        this.player.addCritBoost()
        break
      // New V1 abilities
      case 'ice_shot':
        this.player.addIceShot()
        break
      case 'poison_shot':
        this.player.addPoisonShot()
        break
      case 'lightning_chain':
        this.player.addLightningChain()
        break
      case 'diagonal_arrows':
        this.player.addDiagonalArrows()
        break
      case 'rear_arrow':
        this.player.addRearArrow()
        break
      case 'damage_aura':
        this.player.addDamageAura()
        break
      case 'bloodthirst':
        this.player.addBloodthirst()
        break
      case 'rage':
        this.player.addRage()
        break
      case 'speed_boost':
        this.player.addSpeedBoost()
        break
      case 'max_health':
        this.player.addMaxHealthBoost()
        break
    }

    this.abilitiesGained++

    // Track ability with its level
    const currentLevel = this.acquiredAbilities.get(abilityId) || 0
    this.acquiredAbilities.set(abilityId, currentLevel + 1)

    // Notify callbacks
    this.callbacks.onAbilitiesUpdated(this.getAcquiredAbilities())
    this.callbacks.onHealthUpdated()

    console.log(`Applied ability: ${abilityId} (level: ${currentLevel + 1}, total: ${this.abilitiesGained})`)
  }

  /**
   * Reset the ability system state (for level reset)
   */
  reset(): void {
    // Keep abilities but could reset if needed
  }
}

import { describe, it, expect, beforeEach } from 'vitest'
import { PlayerStats } from './PlayerStats'

describe('PlayerStats', () => {
  let stats: PlayerStats

  beforeEach(() => {
    stats = new PlayerStats()
  })

  // ============================================
  // Health System Tests
  // ============================================
  describe('Health System', () => {
    it('starts with 100 health by default', () => {
      expect(stats.getHealth()).toBe(100)
      expect(stats.getMaxHealth()).toBe(100)
    })

    it('can be initialized with custom max health', () => {
      const customStats = new PlayerStats({ maxHealth: 200 })
      expect(customStats.getHealth()).toBe(200)
      expect(customStats.getMaxHealth()).toBe(200)
    })

    it('takeDamage reduces health correctly', () => {
      const result = stats.takeDamage(30)
      expect(result.damaged).toBe(true)
      expect(result.died).toBe(false)
      expect(stats.getHealth()).toBe(70)
    })

    it('health cannot go below 0', () => {
      stats.takeDamage(150)
      expect(stats.getHealth()).toBe(0)
    })

    it('returns died: true when health reaches 0', () => {
      const result = stats.takeDamage(100)
      expect(result.damaged).toBe(true)
      expect(result.died).toBe(true)
      expect(stats.isDead()).toBe(true)
    })

    it('returns died: true for overkill damage', () => {
      const result = stats.takeDamage(999)
      expect(result.died).toBe(true)
      expect(stats.getHealth()).toBe(0)
    })

    it('sets invincibility after taking damage', () => {
      expect(stats.isPlayerInvincible()).toBe(false)
      stats.takeDamage(10)
      expect(stats.isPlayerInvincible()).toBe(true)
    })

    it('prevents damage while invincible', () => {
      stats.takeDamage(10) // First hit, now invincible
      expect(stats.getHealth()).toBe(90)

      const secondHit = stats.takeDamage(10)
      expect(secondHit.damaged).toBe(false)
      expect(stats.getHealth()).toBe(90) // Still 90
    })

    it('can take damage again after invincibility cleared', () => {
      stats.takeDamage(10)
      expect(stats.getHealth()).toBe(90)

      stats.clearInvincibility()
      expect(stats.isPlayerInvincible()).toBe(false)

      stats.takeDamage(10)
      expect(stats.getHealth()).toBe(80)
    })

    it('cannot die while invincible', () => {
      stats.takeDamage(10) // Now invincible with 90 HP
      const lethalHit = stats.takeDamage(100)
      expect(lethalHit.damaged).toBe(false)
      expect(lethalHit.died).toBe(false)
      expect(stats.getHealth()).toBe(90)
    })

    it('heal increases health up to max', () => {
      stats.takeDamage(50)
      stats.clearInvincibility()
      expect(stats.getHealth()).toBe(50)

      stats.heal(30)
      expect(stats.getHealth()).toBe(80)
    })

    it('heal cannot exceed max health', () => {
      stats.takeDamage(10)
      stats.clearInvincibility()
      stats.heal(100)
      expect(stats.getHealth()).toBe(100)
    })

    it('getHealthPercentage returns correct value', () => {
      expect(stats.getHealthPercentage()).toBe(1)
      stats.takeDamage(50)
      expect(stats.getHealthPercentage()).toBe(0.5)
    })
  })

  // ============================================
  // Leveling System Tests
  // ============================================
  describe('Leveling System', () => {
    it('starts at level 1 with 0 XP', () => {
      expect(stats.getLevel()).toBe(1)
      expect(stats.getXP()).toBe(0)
    })

    it('XP accumulates correctly', () => {
      stats.addXP(3)
      expect(stats.getXP()).toBe(3)
      stats.addXP(5)
      expect(stats.getXP()).toBe(8)
    })

    it('levels up at 10 XP by default', () => {
      const leveledUp = stats.addXP(10)
      expect(leveledUp).toBe(true)
      expect(stats.getLevel()).toBe(2)
    })

    it('XP resets to 0 after level up', () => {
      stats.addXP(10)
      expect(stats.getXP()).toBe(0)
    })

    it('returns false when not leveling up', () => {
      const leveledUp = stats.addXP(5)
      expect(leveledUp).toBe(false)
      expect(stats.getLevel()).toBe(1)
    })

    it('multiple kills accumulate before level up', () => {
      for (let i = 0; i < 9; i++) {
        const leveledUp = stats.addXP(1)
        expect(leveledUp).toBe(false)
      }
      expect(stats.getXP()).toBe(9)
      expect(stats.getLevel()).toBe(1)

      const finalKill = stats.addXP(1)
      expect(finalKill).toBe(true)
      expect(stats.getLevel()).toBe(2)
    })

    it('can level up multiple times', () => {
      stats.addXP(10) // Level 2
      stats.addXP(10) // Level 3
      stats.addXP(10) // Level 4
      expect(stats.getLevel()).toBe(4)
    })

    it('getXPPercentage returns correct value', () => {
      expect(stats.getXPPercentage()).toBe(0)
      stats.addXP(5)
      expect(stats.getXPPercentage()).toBe(0.5)
    })

    it('can use custom XP threshold', () => {
      const customStats = new PlayerStats({ xpToLevelUp: 5 })
      customStats.addXP(4)
      expect(customStats.getLevel()).toBe(1)
      customStats.addXP(1)
      expect(customStats.getLevel()).toBe(2)
    })
  })

  // ============================================
  // Ability Stacking Tests
  // ============================================
  describe('Ability Stacking', () => {
    describe('Front Arrow', () => {
      it('increments extraProjectiles', () => {
        expect(stats.getExtraProjectiles()).toBe(0)
        stats.addFrontArrow()
        expect(stats.getExtraProjectiles()).toBe(1)
      })

      it('stacks linearly', () => {
        stats.addFrontArrow()
        stats.addFrontArrow()
        stats.addFrontArrow()
        expect(stats.getExtraProjectiles()).toBe(3)
      })

      it('applies 25% damage penalty per extra projectile', () => {
        const baseDamage = stats.getDamage() // 10
        stats.addFrontArrow()
        expect(stats.getDamage()).toBe(Math.floor(baseDamage * 0.75)) // 7
      })

      it('compounds damage penalty correctly', () => {
        // 0 arrows: 10
        expect(stats.getDamage()).toBe(10)

        // 1 arrow: 10 * 0.75 = 7.5 -> 7
        stats.addFrontArrow()
        expect(stats.getDamage()).toBe(7)

        // 2 arrows: 10 * 0.75^2 = 5.625 -> 5
        stats.addFrontArrow()
        expect(stats.getDamage()).toBe(5)

        // 3 arrows: 10 * 0.75^3 = 4.21875 -> 4
        stats.addFrontArrow()
        expect(stats.getDamage()).toBe(4)
      })
    })

    describe('Multishot', () => {
      it('increments multishotCount', () => {
        expect(stats.getMultishotCount()).toBe(0)
        stats.addMultishot()
        expect(stats.getMultishotCount()).toBe(1)
      })

      it('stacks linearly', () => {
        stats.addMultishot()
        stats.addMultishot()
        expect(stats.getMultishotCount()).toBe(2)
      })

      it('applies 15% attack speed penalty per level', () => {
        const baseSpeed = stats.getAttackSpeed() // 1.0
        stats.addMultishot()
        expect(stats.getAttackSpeed()).toBeCloseTo(baseSpeed * 0.85)
      })

      it('compounds attack speed penalty correctly', () => {
        // 0 multishot: 1.0
        expect(stats.getAttackSpeed()).toBeCloseTo(1.0)

        // 1 multishot: 1.0 * 0.85 = 0.85
        stats.addMultishot()
        expect(stats.getAttackSpeed()).toBeCloseTo(0.85)

        // 2 multishot: 1.0 * 0.85^2 = 0.7225
        stats.addMultishot()
        expect(stats.getAttackSpeed()).toBeCloseTo(0.7225)
      })
    })

    describe('Attack Speed Boost', () => {
      it('multiplies attack speed (25% boost)', () => {
        stats.addAttackSpeedBoost(0.25)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25)
      })

      it('stacks multiplicatively', () => {
        // 1st boost: 1.0 * 1.25 = 1.25
        stats.addAttackSpeedBoost(0.25)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25)

        // 2nd boost: 1.25 * 1.25 = 1.5625
        stats.addAttackSpeedBoost(0.25)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.5625)

        // 3rd boost: 1.5625 * 1.25 = 1.953125
        stats.addAttackSpeedBoost(0.25)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.953125)
      })
    })

    describe('Attack Boost (Damage)', () => {
      it('multiplies damage (30% boost)', () => {
        stats.addDamageBoost(0.30)
        expect(stats.getDamage()).toBe(13) // floor(10 * 1.30)
      })

      it('stacks multiplicatively', () => {
        // 1st boost: 10 * 1.30 = 13
        stats.addDamageBoost(0.30)
        expect(stats.getDamage()).toBe(13)

        // 2nd boost: 10 * 1.69 = 16.9 -> 16
        stats.addDamageBoost(0.30)
        expect(stats.getDamage()).toBe(16)

        // 3rd boost: 10 * 2.197 = 21.97 -> 21
        stats.addDamageBoost(0.30)
        expect(stats.getDamage()).toBe(21)
      })
    })

    describe('Combined Abilities', () => {
      it('Front Arrow penalty applies with Attack Boost', () => {
        // Attack Boost: 10 * 1.30 = 13
        stats.addDamageBoost(0.30)
        expect(stats.getDamage()).toBe(13)

        // Add Front Arrow: 10 * 1.30 * 0.75 = 9.75 -> 9
        stats.addFrontArrow()
        expect(stats.getDamage()).toBe(9)
      })

      it('Multishot penalty applies with Attack Speed Boost', () => {
        // Attack Speed Boost: 1.0 * 1.25 = 1.25
        stats.addAttackSpeedBoost(0.25)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25)

        // Add Multishot: 1.25 * 0.85 = 1.0625
        stats.addMultishot()
        expect(stats.getAttackSpeed()).toBeCloseTo(1.0625)
      })

      it('all 4 abilities stack together correctly', () => {
        // Add all abilities
        stats.addFrontArrow() // -25% damage
        stats.addFrontArrow() // another -25%
        stats.addMultishot() // -15% attack speed
        stats.addAttackSpeedBoost(0.25) // +25% attack speed
        stats.addDamageBoost(0.30) // +30% damage

        // Damage: 10 * 1.30 * 0.75^2 = 10 * 1.30 * 0.5625 = 7.3125 -> 7
        expect(stats.getDamage()).toBe(7)

        // Attack speed: 1.0 * 1.25 * 0.85 = 1.0625
        expect(stats.getAttackSpeed()).toBeCloseTo(1.0625)
      })

      it('stacking same ability 5 times works', () => {
        for (let i = 0; i < 5; i++) {
          stats.addFrontArrow()
        }
        expect(stats.getExtraProjectiles()).toBe(5)
        // 10 * 0.75^5 = 2.373... -> 2
        expect(stats.getDamage()).toBe(2)

        for (let i = 0; i < 5; i++) {
          stats.addAttackSpeedBoost(0.25)
        }
        // 1.25^5 = 3.0517...
        expect(stats.getAttackSpeed()).toBeCloseTo(3.0517578125)
      })
    })
  })

  // ============================================
  // Reset Tests
  // ============================================
  describe('Reset', () => {
    it('resetRunStats restores all values', () => {
      // Modify everything
      stats.takeDamage(50)
      stats.addXP(5)
      stats.addFrontArrow()
      stats.addMultishot()
      stats.addAttackSpeedBoost(0.25)
      stats.addDamageBoost(0.30)

      // Reset
      stats.resetRunStats()

      // Verify all reset
      expect(stats.getHealth()).toBe(100)
      expect(stats.getXP()).toBe(0)
      expect(stats.getLevel()).toBe(1)
      expect(stats.getExtraProjectiles()).toBe(0)
      expect(stats.getMultishotCount()).toBe(0)
      expect(stats.getDamage()).toBe(10)
      expect(stats.getAttackSpeed()).toBeCloseTo(1.0)
      expect(stats.isPlayerInvincible()).toBe(false)
    })
  })

  // ============================================
  // Snapshot Tests
  // ============================================
  describe('Stats Snapshot', () => {
    it('returns correct snapshot of current state', () => {
      stats.takeDamage(20)
      stats.addXP(5)
      stats.addFrontArrow()
      stats.addDamageBoost(0.30)

      const snapshot = stats.getStatsSnapshot()

      expect(snapshot.health).toBe(80)
      expect(snapshot.maxHealth).toBe(100)
      expect(snapshot.level).toBe(1)
      expect(snapshot.xp).toBe(5)
      expect(snapshot.xpToLevelUp).toBe(10)
      expect(snapshot.extraProjectiles).toBe(1)
      expect(snapshot.multishotCount).toBe(0)
      // 10 * 1.30 * 0.75 = 9.75 -> 9
      expect(snapshot.damage).toBe(9)
      expect(snapshot.attackSpeed).toBeCloseTo(1.0)
    })
  })
})

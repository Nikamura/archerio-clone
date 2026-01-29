import { describe, it, expect, beforeEach } from "vitest";
import { PlayerStats } from "./PlayerStats";

describe("PlayerStats", () => {
  let stats: PlayerStats;

  beforeEach(() => {
    stats = new PlayerStats();
  });

  // ============================================
  // Health System Tests
  // ============================================
  describe("Health System", () => {
    it("starts with 100 health by default", () => {
      expect(stats.getHealth()).toBe(100);
      expect(stats.getMaxHealth()).toBe(100);
    });

    it("can be initialized with custom max health", () => {
      const customStats = new PlayerStats({ maxHealth: 200 });
      expect(customStats.getHealth()).toBe(200);
      expect(customStats.getMaxHealth()).toBe(200);
    });

    it("takeDamage reduces health correctly", () => {
      const result = stats.takeDamage(30);
      expect(result.damaged).toBe(true);
      expect(result.died).toBe(false);
      expect(stats.getHealth()).toBe(70);
    });

    it("health cannot go below 0", () => {
      stats.takeDamage(150);
      expect(stats.getHealth()).toBe(0);
    });

    it("returns died: true when health reaches 0", () => {
      const result = stats.takeDamage(100);
      expect(result.damaged).toBe(true);
      expect(result.died).toBe(true);
      expect(stats.isDead()).toBe(true);
    });

    it("returns died: true for overkill damage", () => {
      const result = stats.takeDamage(999);
      expect(result.died).toBe(true);
      expect(stats.getHealth()).toBe(0);
    });

    it("multiple hits all deal damage (no immunity)", () => {
      // First hit
      const firstHit = stats.takeDamage(10);
      expect(firstHit.damaged).toBe(true);
      expect(stats.getHealth()).toBe(90);

      // Second hit immediately after
      const secondHit = stats.takeDamage(10);
      expect(secondHit.damaged).toBe(true);
      expect(stats.getHealth()).toBe(80);

      // Third hit
      const thirdHit = stats.takeDamage(10);
      expect(thirdHit.damaged).toBe(true);
      expect(stats.getHealth()).toBe(70);
    });

    it("isPlayerInvincible always returns false", () => {
      expect(stats.isPlayerInvincible()).toBe(false);
      stats.takeDamage(10);
      expect(stats.isPlayerInvincible()).toBe(false);
    });

    it("heal increases health up to max", () => {
      stats.takeDamage(50);
      expect(stats.getHealth()).toBe(50);

      stats.heal(30);
      expect(stats.getHealth()).toBe(80);
    });

    it("heal cannot exceed max health", () => {
      stats.takeDamage(10);
      stats.heal(100);
      expect(stats.getHealth()).toBe(100);
    });

    it("getHealthPercentage returns correct value", () => {
      expect(stats.getHealthPercentage()).toBe(1);
      stats.takeDamage(50);
      expect(stats.getHealthPercentage()).toBe(0.5);
    });
  });

  // ============================================
  // Leveling System Tests
  // ============================================
  describe("Leveling System", () => {
    it("starts at level 1 with 0 XP", () => {
      expect(stats.getLevel()).toBe(1);
      expect(stats.getXP()).toBe(0);
    });

    it("XP accumulates correctly", () => {
      stats.addXP(1);
      expect(stats.getXP()).toBe(1);
      stats.addXP(1);
      expect(stats.getXP()).toBe(2);
    });

    it("first level up requires 4 XP", () => {
      const leveledUp = stats.addXP(4);
      expect(leveledUp).toBe(true);
      expect(stats.getLevel()).toBe(2);
    });

    it("subsequent levels require exponentially more XP", () => {
      stats.addXP(4); // Level 2
      expect(stats.getLevel()).toBe(2);
      expect(stats.getXPToLevelUp()).toBe(10); // Level 2→3 requires 10 XP (baseXP * 1.25^0)

      stats.addXP(9);
      expect(stats.getLevel()).toBe(2); // Not yet
      stats.addXP(1);
      expect(stats.getLevel()).toBe(3); // Now level 3
    });

    it("XP resets to 0 after level up", () => {
      stats.addXP(4);
      expect(stats.getXP()).toBe(0);
    });

    it("returns false when not leveling up", () => {
      const leveledUp = stats.addXP(3);
      expect(leveledUp).toBe(false);
      expect(stats.getLevel()).toBe(1);
    });

    it("multiple kills accumulate before level up", () => {
      for (let i = 0; i < 3; i++) {
        const leveledUp = stats.addXP(1);
        expect(leveledUp).toBe(false);
      }
      expect(stats.getXP()).toBe(3);
      expect(stats.getLevel()).toBe(1);

      const finalKill = stats.addXP(1);
      expect(finalKill).toBe(true);
      expect(stats.getLevel()).toBe(2);
    });

    it("can level up multiple times", () => {
      stats.addXP(4); // Level 2 (first level needs 4)
      stats.addXP(10); // Level 3
      stats.addXP(13); // Level 4 (round(10 * 1.25) = 13)
      expect(stats.getLevel()).toBe(4);
    });

    it("getXPPercentage returns correct value", () => {
      expect(stats.getXPPercentage()).toBe(0);
      stats.addXP(2);
      expect(stats.getXPPercentage()).toBeCloseTo(2 / 4); // 2/4 of 4 XP needed
    });

    it("uses exponential scaling for XP requirements", () => {
      const stats = new PlayerStats();
      // Level 1→2: 4 XP
      stats.addXP(4);
      expect(stats.getLevel()).toBe(2);
      // Level 2→3: 10 XP (baseXP * 1.25^0 = 10 * 1 = 10)
      stats.addXP(9);
      expect(stats.getLevel()).toBe(2);
      stats.addXP(1);
      expect(stats.getLevel()).toBe(3);
      // Level 3→4: 13 XP (round(baseXP * 1.25^1) = round(10 * 1.25) = 13)
      stats.addXP(12);
      expect(stats.getLevel()).toBe(3);
      stats.addXP(1);
      expect(stats.getLevel()).toBe(4);
    });

    it("can use custom base XP for exponential scaling", () => {
      const customStats = new PlayerStats({ xpToLevelUp: 20 });
      customStats.addXP(4); // Level 2 (first level always 4)
      expect(customStats.getLevel()).toBe(2);
      // Level 2→3: 20 XP (custom base * 1.25^0 = 20)
      customStats.addXP(19);
      expect(customStats.getLevel()).toBe(2);
      customStats.addXP(1);
      expect(customStats.getLevel()).toBe(3);
    });
  });

  // ============================================
  // Ability Stacking Tests
  // ============================================
  describe("Ability Stacking", () => {
    describe("Front Arrow", () => {
      it("increments extraProjectiles", () => {
        expect(stats.getExtraProjectiles()).toBe(0);
        stats.addFrontArrow();
        expect(stats.getExtraProjectiles()).toBe(1);
      });

      it("stacks linearly", () => {
        stats.addFrontArrow();
        stats.addFrontArrow();
        stats.addFrontArrow();
        expect(stats.getExtraProjectiles()).toBe(3);
      });

      it("does not affect damage", () => {
        const baseDamage = stats.getDamage(); // 10
        stats.addFrontArrow();
        stats.addFrontArrow();
        stats.addFrontArrow();
        expect(stats.getDamage()).toBe(baseDamage); // still 10
      });
    });

    describe("Multishot", () => {
      it("increments multishotCount", () => {
        expect(stats.getMultishotCount()).toBe(0);
        stats.addMultishot();
        expect(stats.getMultishotCount()).toBe(1);
      });

      it("stacks linearly", () => {
        stats.addMultishot();
        stats.addMultishot();
        expect(stats.getMultishotCount()).toBe(2);
      });

      it("does not affect attack speed", () => {
        const baseSpeed = stats.getAttackSpeed(); // 1.0
        stats.addMultishot();
        expect(stats.getAttackSpeed()).toBeCloseTo(baseSpeed);
        stats.addMultishot();
        expect(stats.getAttackSpeed()).toBeCloseTo(baseSpeed);
      });
    });

    describe("Attack Speed Boost", () => {
      it("multiplies attack speed (25% boost)", () => {
        stats.addAttackSpeedBoost(0.25);
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25);
      });

      it("stacks multiplicatively", () => {
        // 1st boost: 1.0 * 1.25 = 1.25
        stats.addAttackSpeedBoost(0.25);
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25);

        // 2nd boost: 1.25 * 1.25 = 1.5625
        stats.addAttackSpeedBoost(0.25);
        expect(stats.getAttackSpeed()).toBeCloseTo(1.5625);

        // 3rd boost: 1.5625 * 1.25 = 1.953125
        stats.addAttackSpeedBoost(0.25);
        expect(stats.getAttackSpeed()).toBeCloseTo(1.953125);
      });
    });

    describe("Attack Boost (Damage)", () => {
      it("multiplies damage (30% boost)", () => {
        stats.addDamageBoost(0.3);
        expect(stats.getDamage()).toBe(13); // floor(10 * 1.30)
      });

      it("stacks multiplicatively", () => {
        // 1st boost: 10 * 1.30 = 13
        stats.addDamageBoost(0.3);
        expect(stats.getDamage()).toBe(13);

        // 2nd boost: 10 * 1.69 = 16.9 -> 16
        stats.addDamageBoost(0.3);
        expect(stats.getDamage()).toBe(16);

        // 3rd boost: 10 * 2.197 = 21.97 -> 21
        stats.addDamageBoost(0.3);
        expect(stats.getDamage()).toBe(21);
      });
    });

    describe("Combined Abilities", () => {
      it("Front Arrow does not affect Attack Boost damage", () => {
        // Attack Boost: 10 * 1.30 = 13
        stats.addDamageBoost(0.3);
        expect(stats.getDamage()).toBe(13);

        // Add Front Arrow: damage unchanged at 13
        stats.addFrontArrow();
        expect(stats.getDamage()).toBe(13);
      });

      it("Multishot does not affect Attack Speed Boost", () => {
        // Attack Speed Boost: 1.0 * 1.25 = 1.25
        stats.addAttackSpeedBoost(0.25);
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25);

        // Add Multishot: no penalty, attack speed unchanged at 1.25
        stats.addMultishot();
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25);
      });

      it("all 4 abilities stack together correctly", () => {
        // Add all abilities
        stats.addFrontArrow(); // +1 arrow (no damage penalty)
        stats.addFrontArrow(); // +1 arrow (no damage penalty)
        stats.addMultishot(); // +2 side arrows (no penalty)
        stats.addAttackSpeedBoost(0.25); // +25% attack speed
        stats.addDamageBoost(0.3); // +30% damage

        // Damage: 10 * 1.30 = 13 (front arrow has no penalty)
        expect(stats.getDamage()).toBe(13);

        // Attack speed: 1.0 * 1.25 = 1.25 (multishot has no penalty)
        expect(stats.getAttackSpeed()).toBeCloseTo(1.25);
      });

      it("stacking same ability 5 times works", () => {
        for (let i = 0; i < 5; i++) {
          stats.addFrontArrow();
        }
        expect(stats.getExtraProjectiles()).toBe(5);
        // Front arrow has no damage penalty
        expect(stats.getDamage()).toBe(10);

        for (let i = 0; i < 5; i++) {
          stats.addAttackSpeedBoost(0.25);
        }
        // 1.25^5 = 3.0517...
        expect(stats.getAttackSpeed()).toBeCloseTo(3.0517578125);
      });

      it("attack speed is capped at 5.0 (10 attacks per second)", () => {
        // Stack many attack speed boosts to exceed the cap
        for (let i = 0; i < 10; i++) {
          stats.addAttackSpeedBoost(0.5); // +50% each time, 1.5^10 = 57.66
        }
        // Raw would be 1.0 * 1.5^10 = 57.66, but should be capped at 5.0
        expect(stats.getAttackSpeed()).toBe(5.0);
      });

      it("attack speed cap works with high base attack speed", () => {
        // Create player with high base attack speed
        const fastStats = new PlayerStats({ baseAttackSpeed: 3.0 });
        // Add some boosts
        fastStats.addAttackSpeedBoost(0.5); // 3.0 * 1.5 = 4.5 (under cap)
        expect(fastStats.getAttackSpeed()).toBeCloseTo(4.5);

        fastStats.addAttackSpeedBoost(0.5); // 4.5 * 1.5 = 6.75 (over cap)
        expect(fastStats.getAttackSpeed()).toBe(5.0);
      });
    });

    describe("Piercing Shot", () => {
      it("increments piercing level", () => {
        expect(stats.getPiercingLevel()).toBe(0);
        stats.addPiercing();
        expect(stats.getPiercingLevel()).toBe(1);
      });

      it("stacks linearly", () => {
        stats.addPiercing();
        stats.addPiercing();
        stats.addPiercing();
        expect(stats.getPiercingLevel()).toBe(3);
      });

      it("calculates piercing damage with 33% reduction per hit", () => {
        // First enemy hit: full damage
        expect(stats.getPiercingDamage(0)).toBe(10);

        // Second enemy hit: 67% of 10 = 6.7 -> 6
        expect(stats.getPiercingDamage(1)).toBe(6);

        // Third enemy hit: 67% of 6.7 = 4.489 -> 4
        expect(stats.getPiercingDamage(2)).toBe(4);

        // Fourth enemy hit: 67% of 4.489 = 3.007 -> 3
        expect(stats.getPiercingDamage(3)).toBe(3);
      });

      it("piercing damage works with damage boost", () => {
        stats.addDamageBoost(0.3); // 10 * 1.30 = 13
        expect(stats.getPiercingDamage(0)).toBe(13);
        // 13 * 0.67 = 8.71 -> 8
        expect(stats.getPiercingDamage(1)).toBe(8);
      });
    });

    describe("Ricochet", () => {
      it("adds 3 bounces per level", () => {
        expect(stats.getRicochetBounces()).toBe(0);
        stats.addRicochet();
        expect(stats.getRicochetBounces()).toBe(3);
      });

      it("stacks linearly (each level adds 3)", () => {
        stats.addRicochet();
        stats.addRicochet();
        expect(stats.getRicochetBounces()).toBe(6);

        stats.addRicochet();
        expect(stats.getRicochetBounces()).toBe(9);
      });
    });

    describe("Fire Damage", () => {
      it("adds 18% fire damage", () => {
        expect(stats.getFireDamagePercent()).toBe(0);
        stats.addFireDamage();
        expect(stats.getFireDamagePercent()).toBeCloseTo(0.18);
      });

      it("stacks additively", () => {
        stats.addFireDamage();
        stats.addFireDamage();
        expect(stats.getFireDamagePercent()).toBeCloseTo(0.36);

        stats.addFireDamage();
        expect(stats.getFireDamagePercent()).toBeCloseTo(0.54);
      });

      it("calculates fire damage based on weapon damage", () => {
        stats.addFireDamage(); // 18% of 10 = 1.8 -> 1
        expect(stats.getFireDamage()).toBe(1);
      });

      it("fire damage scales with attack boost", () => {
        stats.addDamageBoost(0.3); // 10 * 1.30 = 13
        stats.addFireDamage(); // 18% of 13 = 2.34 -> 2
        expect(stats.getFireDamage()).toBe(2);
      });

      it("returns 0 fire damage if no fire ability", () => {
        expect(stats.getFireDamage()).toBe(0);
      });
    });

    describe("Crit Boost", () => {
      it("adds 10% crit chance", () => {
        expect(stats.getCritChance()).toBe(0);
        stats.addCritBoost();
        expect(stats.getCritChance()).toBeCloseTo(0.1);
      });

      it("crit chance stacks additively", () => {
        stats.addCritBoost();
        stats.addCritBoost();
        expect(stats.getCritChance()).toBeCloseTo(0.2);

        stats.addCritBoost();
        expect(stats.getCritChance()).toBeCloseTo(0.3);
      });

      it("crit chance caps at 100%", () => {
        for (let i = 0; i < 15; i++) {
          stats.addCritBoost();
        }
        expect(stats.getCritChance()).toBe(1);
      });

      it("base crit damage multiplier is 1.5 (150%)", () => {
        expect(stats.getCritDamageMultiplier()).toBeCloseTo(1.5);
      });

      it("crit damage multiplier increases by 40% per level", () => {
        // 1st crit boost: 1.5 * 1.40 = 2.1
        stats.addCritBoost();
        expect(stats.getCritDamageMultiplier()).toBeCloseTo(2.1);

        // 2nd crit boost: 2.1 * 1.40 = 2.94
        stats.addCritBoost();
        expect(stats.getCritDamageMultiplier()).toBeCloseTo(2.94);

        // 3rd crit boost: 2.94 * 1.40 = 4.116
        stats.addCritBoost();
        expect(stats.getCritDamageMultiplier()).toBeCloseTo(4.116);
      });

      it("calculates crit damage correctly", () => {
        // Non-crit: base damage
        expect(stats.getDamageWithCrit(false)).toBe(10);

        // Crit without boost: 10 * 1.5 = 15
        expect(stats.getDamageWithCrit(true)).toBe(15);
      });

      it("crit damage scales with crit boost", () => {
        stats.addCritBoost(); // Crit multiplier: 1.5 * 1.40 = 2.1
        // Crit: 10 * 2.1 = 21 (but floating point: 10 * 2.0999... = 20.999... → 20)
        expect(stats.getDamageWithCrit(true)).toBe(20);
      });

      it("crit damage combines with attack boost", () => {
        stats.addDamageBoost(0.3); // 10 * 1.30 = 13
        stats.addCritBoost(); // Crit multiplier: 1.5 * 1.4 = 2.0999...
        // Crit: 13 * 2.0999... = 27.299... -> 27
        expect(stats.getDamageWithCrit(true)).toBe(27);
      });

      it("rollCrit returns boolean", () => {
        // Without crit chance, always returns false
        expect(stats.rollCrit()).toBe(false);
        expect(stats.rollCrit()).toBe(false);
        expect(stats.rollCrit()).toBe(false);
      });

      it("rollCrit can return true with 100% crit", () => {
        // Set crit to 100%
        for (let i = 0; i < 10; i++) {
          stats.addCritBoost();
        }
        // With 100% crit chance, should always return true
        expect(stats.rollCrit()).toBe(true);
        expect(stats.rollCrit()).toBe(true);
        expect(stats.rollCrit()).toBe(true);
      });
    });

    describe("Max Health Boost", () => {
      it("increases max health by 15%", () => {
        stats.addMaxHealthBoost();
        // floor(100 * 1.15) = 114 (floating-point: 114.99999...)
        expect(stats.getMaxHealth()).toBe(114);
      });

      it("stacks multiplicatively (100 -> 114 -> 131 -> 150)", () => {
        stats.addMaxHealthBoost();
        expect(stats.getMaxHealth()).toBe(114); // floor(100 * 1.15)
        stats.addMaxHealthBoost();
        expect(stats.getMaxHealth()).toBe(131); // floor(114 * 1.15)
        stats.addMaxHealthBoost();
        expect(stats.getMaxHealth()).toBe(150); // floor(131 * 1.15)
      });

      it("also heals the player by the gained amount", () => {
        stats.takeDamage(50); // Health is now 50
        expect(stats.getHealth()).toBe(50);

        stats.addMaxHealthBoost(); // Max health goes from 100 to 114, gain is 14
        expect(stats.getMaxHealth()).toBe(114);
        expect(stats.getHealth()).toBe(64); // 50 + 14 = 64
      });

      it("heals correctly when at full health", () => {
        expect(stats.getHealth()).toBe(100);
        expect(stats.getMaxHealth()).toBe(100);

        stats.addMaxHealthBoost();
        expect(stats.getHealth()).toBe(114);
        expect(stats.getMaxHealth()).toBe(114);
      });

      it("tracks maxHealthMultiplier correctly", () => {
        expect(stats.getMaxHealthMultiplier()).toBeCloseTo(1.0);
        stats.addMaxHealthBoost();
        expect(stats.getMaxHealthMultiplier()).toBeCloseTo(1.15);
        stats.addMaxHealthBoost();
        expect(stats.getMaxHealthMultiplier()).toBeCloseTo(1.3225);
      });
    });

    describe("Speed Boost", () => {
      it("increases movement speed by 15%", () => {
        expect(stats.getMovementSpeedMultiplier()).toBeCloseTo(1.0);
        stats.addSpeedBoost();
        expect(stats.getMovementSpeedMultiplier()).toBeCloseTo(1.15);
      });

      it("also increases attack speed by 5%", () => {
        expect(stats.getAttackSpeed()).toBeCloseTo(1.0);
        stats.addSpeedBoost();
        // 1.0 * 1.05 = 1.05
        expect(stats.getAttackSpeed()).toBeCloseTo(1.05);
      });

      it("stacks multiplicatively for both speeds", () => {
        stats.addSpeedBoost();
        stats.addSpeedBoost();
        // Movement: 1.0 * 1.15^2 = 1.3225
        expect(stats.getMovementSpeedMultiplier()).toBeCloseTo(1.3225);
        // Attack: 1.0 * 1.05^2 = 1.1025
        expect(stats.getAttackSpeed()).toBeCloseTo(1.1025);
      });
    });

    describe("Lightning Chain", () => {
      it("adds 2 chain targets per level", () => {
        expect(stats.getLightningChainCount()).toBe(0);
        stats.addLightningChain();
        expect(stats.getLightningChainCount()).toBe(2);
        stats.addLightningChain();
        expect(stats.getLightningChainCount()).toBe(4);
      });

      it("applies 20% damage reduction per chain", () => {
        // First hit (chain 0): full damage
        expect(stats.getLightningChainDamageMultiplier(0)).toBeCloseTo(1.0);
        // First chain (chain 1): 80% damage
        expect(stats.getLightningChainDamageMultiplier(1)).toBeCloseTo(0.8);
        // Second chain (chain 2): 64% damage
        expect(stats.getLightningChainDamageMultiplier(2)).toBeCloseTo(0.64);
        // Third chain (chain 3): 51.2% damage
        expect(stats.getLightningChainDamageMultiplier(3)).toBeCloseTo(0.512);
      });
    });
  });

  // ============================================
  // Reset Tests
  // ============================================
  describe("Reset", () => {
    it("resetRunStats restores all values", () => {
      // Modify everything
      stats.takeDamage(50);
      stats.addXP(5);
      stats.addFrontArrow();
      stats.addMultishot();
      stats.addAttackSpeedBoost(0.25);
      stats.addDamageBoost(0.3);
      stats.addPiercing();
      stats.addRicochet();
      stats.addFireDamage();
      stats.addCritBoost();

      // Reset
      stats.resetRunStats();

      // Verify all reset
      expect(stats.getHealth()).toBe(100);
      expect(stats.getXP()).toBe(0);
      expect(stats.getLevel()).toBe(1);
      expect(stats.getExtraProjectiles()).toBe(0);
      expect(stats.getMultishotCount()).toBe(0);
      expect(stats.getPiercingLevel()).toBe(0);
      expect(stats.getRicochetBounces()).toBe(0);
      expect(stats.getFireDamagePercent()).toBe(0);
      expect(stats.getCritChance()).toBe(0);
      expect(stats.getCritDamageMultiplier()).toBeCloseTo(1.5);
      expect(stats.getDamage()).toBe(10);
      expect(stats.getAttackSpeed()).toBeCloseTo(1.0);
      expect(stats.isPlayerInvincible()).toBe(false);
    });
  });

  // ============================================
  // Snapshot Tests
  // ============================================
  describe("Stats Snapshot", () => {
    it("returns correct snapshot of current state", () => {
      stats.takeDamage(20);
      stats.addXP(2); // Only 2 XP so we stay at level 1 (needs 4 for first level up)
      stats.addFrontArrow();
      stats.addDamageBoost(0.3);
      stats.addPiercing();
      stats.addRicochet();
      stats.addFireDamage();
      stats.addCritBoost();

      const snapshot = stats.getStatsSnapshot();

      expect(snapshot.health).toBe(80);
      expect(snapshot.maxHealth).toBe(100);
      expect(snapshot.level).toBe(1);
      expect(snapshot.xp).toBe(2);
      expect(snapshot.xpToLevelUp).toBe(4); // First level requires 4 XP
      expect(snapshot.extraProjectiles).toBe(1);
      expect(snapshot.multishotCount).toBe(0);
      expect(snapshot.piercingLevel).toBe(1);
      expect(snapshot.ricochetBounces).toBe(3);
      expect(snapshot.fireDamagePercent).toBeCloseTo(0.18);
      expect(snapshot.critChance).toBeCloseTo(0.1);
      expect(snapshot.critDamageMultiplier).toBeCloseTo(2.1);
      // 10 * 1.30 = 13 (no front arrow penalty)
      expect(snapshot.damage).toBe(13);
      expect(snapshot.attackSpeed).toBeCloseTo(1.0);
    });
  });
});

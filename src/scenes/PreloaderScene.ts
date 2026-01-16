import Phaser from "phaser";

export default class PreloaderScene extends Phaser.Scene {
  private loadingDots: Phaser.GameObjects.Arc[] = [];
  private tipText?: Phaser.GameObjects.Text;
  private particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    size: number;
  }[] = [];
  private particleGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: "PreloaderScene" });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create gradient background
    this.createGradientBackground(width, height);

    // Create floating particles
    this.createFloatingParticles(width, height);

    // Game title with glow effect
    const titleShadow = this.add.text(width / 2 + 2, height / 3 + 2, "AURA ARCHER", {
      fontSize: "36px",
      fontFamily: "Arial Black, Arial, sans-serif",
      color: "#000000",
    });
    titleShadow.setOrigin(0.5);
    titleShadow.setAlpha(0.5);

    const title = this.add.text(width / 2, height / 3, "AURA ARCHER", {
      fontSize: "36px",
      fontFamily: "Arial Black, Arial, sans-serif",
      color: "#ffffff",
      stroke: "#4a9eff",
      strokeThickness: 2,
    });
    title.setOrigin(0.5);

    // Subtle title pulse animation
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.8 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Progress bar container with rounded corners
    const barWidth = 280;
    const barHeight = 16;
    const barY = height / 2 + 40;

    // Progress bar background (dark with subtle border)
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x1a1a2e, 1);
    progressBox.fillRoundedRect(
      width / 2 - barWidth / 2 - 4,
      barY - 4,
      barWidth + 8,
      barHeight + 8,
      12,
    );
    progressBox.lineStyle(2, 0x4a9eff, 0.5);
    progressBox.strokeRoundedRect(
      width / 2 - barWidth / 2 - 4,
      barY - 4,
      barWidth + 8,
      barHeight + 8,
      12,
    );

    // Progress bar fill
    const progressBar = this.add.graphics();

    // Percentage text (inside or below bar)
    const percentText = this.add.text(width / 2, barY + barHeight / 2, "0%", {
      fontSize: "12px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      fontStyle: "bold",
    });
    percentText.setOrigin(0.5);

    // Animated loading dots
    this.createLoadingDots(width, barY - 35);

    // Loading tips at bottom
    const tips = [
      "Stop moving to shoot automatically",
      "Move to dodge enemy attacks",
      "Collect XP to level up",
      "Choose abilities wisely",
      "Defeat bosses to progress",
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    this.tipText = this.add.text(width / 2, height - 80, `💡 ${randomTip}`, {
      fontSize: "12px",
      fontFamily: "Arial, sans-serif",
      color: "#8888aa",
      wordWrap: { width: width - 40 },
      align: "center",
    });
    this.tipText.setOrigin(0.5);

    // Tip fade animation
    this.tweens.add({
      targets: this.tipText,
      alpha: { from: 0.6, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Update progress bar on load progress
    this.load.on("progress", (value: number) => {
      progressBar.clear();

      // Create gradient-like effect for progress bar
      const fillWidth = barWidth * value;
      if (fillWidth > 0) {
        // Draw the main bar with a slight gradient simulation
        const gradientSteps = 3;
        const stepHeight = barHeight / gradientSteps;

        for (let i = 0; i < gradientSteps; i++) {
          const brightness = i === 1 ? 0x6bb6ff : 0x4a9eff;
          progressBar.fillStyle(brightness, 1);
          progressBar.fillRoundedRect(
            width / 2 - barWidth / 2,
            barY + i * stepHeight,
            fillWidth,
            stepHeight + 1,
            i === 0 || i === gradientSteps - 1
              ? {
                  tl: i === 0 ? 8 : 0,
                  tr: i === 0 ? 8 : 0,
                  bl: i === gradientSteps - 1 ? 8 : 0,
                  br: i === gradientSteps - 1 ? 8 : 0,
                }
              : 0,
          );
        }

        // Add glow effect at the end of progress bar
        if (fillWidth > 4) {
          progressBar.fillStyle(0xffffff, 0.3);
          progressBar.fillCircle(width / 2 - barWidth / 2 + fillWidth - 2, barY + barHeight / 2, 6);
        }
      }

      percentText.setText(`${Math.floor(value * 100)}%`);
    });

    this.load.on("complete", () => {
      // Cleanup
      progressBar.destroy();
      progressBox.destroy();
      percentText.destroy();
      title.destroy();
      titleShadow.destroy();
      this.loadingDots.forEach((dot) => dot.destroy());
      if (this.tipText) this.tipText.destroy();
      if (this.particleGraphics) this.particleGraphics.destroy();
    });

    // Load game assets
    this.load.image("portal", "assets/sprites/door/portal.png");

    // Load hero sprites (medieval/default theme)
    this.load.image("atreusSprite", "assets/sprites/player/archer.png");
    this.load.image("helixSprite", "assets/sprites/player/helix.png");
    this.load.image("meowgikSprite", "assets/sprites/player/meowgik.png");
    // Enemy sprites
    this.load.image("enemyMelee", "assets/sprites/enemy/melee_slime.png");
    this.load.image("enemyRanged", "assets/sprites/enemy/ranged_skeleton.png");
    this.load.image("enemySpreader", "assets/sprites/enemy/spreader_eye.png");
    this.load.image("enemyHealer", "assets/sprites/enemy/healer.png");
    this.load.image("enemySpawner", "assets/sprites/enemy/spawner.png");
    this.load.image("enemyMinion", "assets/sprites/enemy/minion.png");
    this.load.image("enemyBomber", "assets/sprites/enemy/bomber.png");
    this.load.image("enemyTank", "assets/sprites/enemy/tank.png");
    this.load.image("enemyCharger", "assets/sprites/enemy/charger.png");
    this.load.image("enemyBurrower", "assets/sprites/enemy/burrower.png");
    this.load.image("bossSprite", "assets/sprites/boss/demon.png");
    // Chapter 2 - Forest bosses
    this.load.image("boss_tree_guardian", "assets/sprites/boss/tree_guardian.png");
    this.load.image("boss_wild_boar", "assets/sprites/boss/wild_boar.png");
    this.load.image("boss_forest_spirit", "assets/sprites/boss/forest_spirit.png");
    // Chapter 3 - Ice bosses
    this.load.image("boss_ice_golem", "assets/sprites/boss/ice_golem.png");
    this.load.image("boss_frost_wyrm", "assets/sprites/boss/frost_wyrm.png");
    this.load.image("boss_crystal_guardian", "assets/sprites/boss/crystal_guardian.png");
    // Chapter 4 - Volcanic bosses
    this.load.image("boss_magma_wyrm", "assets/sprites/boss/magma_wyrm.png");
    this.load.image("boss_inferno_demon", "assets/sprites/boss/inferno_demon.png");
    this.load.image("boss_lava_golem", "assets/sprites/boss/lava_golem.png");
    // Chapter 5 - Shadow bosses
    this.load.image("boss_void_lord", "assets/sprites/boss/void_lord.png");
    this.load.image("boss_final_boss", "assets/sprites/boss/final_boss.png");
    this.load.image("boss_nightmare", "assets/sprites/boss/nightmare.png");

    // Load projectiles
    this.load.image("bulletSprite", "assets/sprites/projectile/player_arrow.png");
    this.load.image("enemyBulletSprite", "assets/sprites/projectile/enemy_fireball.png");
    this.load.image("spiritCatSprite", "assets/sprites/projectile/spirit_cat.png");
    // Weapon-specific projectiles
    this.load.image("projectile_saw_blade", "assets/sprites/projectile/projectile_saw_blade.png");
    this.load.image("projectile_staff", "assets/sprites/projectile/projectile_staff.png");
    this.load.image(
      "projectile_death_scythe",
      "assets/sprites/projectile/projectile_death_scythe.png",
    );

    // Load background
    this.load.image("dungeonFloor", "assets/backgrounds/dungeon_floor.jpg");
    this.load.image("menuBg", "assets/backgrounds/menu_bg.jpg");

    // Load chapter-specific backgrounds
    this.load.image("chapter1Bg", "assets/backgrounds/chapter1_dungeon.jpg");
    this.load.image("chapter2Bg", "assets/backgrounds/chapter2_forest.jpg");
    this.load.image("chapter3Bg", "assets/backgrounds/chapter3_ice.jpg");
    this.load.image("chapter4Bg", "assets/backgrounds/chapter4_volcanic.jpg");
    this.load.image("chapter5Bg", "assets/backgrounds/chapter5_shadow.jpg");

    // Load background animation particles
    this.load.image("bg_dust", "assets/backgrounds/overlays/dust.png");
    this.load.image("bg_pollen", "assets/backgrounds/overlays/pollen.png");
    this.load.image("bg_snowflake", "assets/backgrounds/overlays/snowflake.png");
    this.load.image("bg_ember", "assets/backgrounds/overlays/ember.png");
    this.load.image("bg_shadow", "assets/backgrounds/overlays/shadow.png");

    // Load menu effects
    this.load.image("torch", "assets/sprites/effect/torch.png");

    // Load ability icons - MVP abilities
    this.load.image("abilityFrontArrow", "assets/sprites/abilities/front_arrow.png");
    this.load.image("abilityMultishot", "assets/sprites/abilities/multishot.png");
    this.load.image("abilityAttackBoost", "assets/sprites/abilities/attack_boost.png");
    this.load.image("abilityAttackSpeed", "assets/sprites/abilities/attack_speed.png");
    this.load.image("abilityCrit", "assets/sprites/abilities/crit.png");
    this.load.image("abilityFireDamage", "assets/sprites/abilities/fire_damage.png");
    this.load.image("abilityPiercing", "assets/sprites/abilities/piercing.png");
    this.load.image("abilityRicochet", "assets/sprites/abilities/ricochet.png");
    // Load ability icons - V1 abilities
    this.load.image("abilityRearArrow", "assets/sprites/abilities/rear_arrow.png");
    this.load.image("abilityDiagonalArrows", "assets/sprites/abilities/diagonal_arrows.png");
    this.load.image("abilityDamageAura", "assets/sprites/abilities/damage_aura.png");
    this.load.image("abilityIceShot", "assets/sprites/abilities/ice_shot.png");
    this.load.image("abilityPoisonShot", "assets/sprites/abilities/poison_shot.png");
    this.load.image("abilityLightningChain", "assets/sprites/abilities/lightning_chain.png");
    this.load.image("abilityBloodthirst", "assets/sprites/abilities/bloodthirst.png");
    this.load.image("abilityRage", "assets/sprites/abilities/rage.png");
    this.load.image("abilityMaxHealth", "assets/sprites/abilities/max_health.png");
    this.load.image("abilitySpeedBoost", "assets/sprites/abilities/speed_boost.png");
    this.load.image("abilityBouncyWall", "assets/sprites/abilities/bouncy_wall.png");
    this.load.image("abilityDodgeMaster", "assets/sprites/abilities/dodge_master.png");
    this.load.image("abilityExtraLife", "assets/sprites/abilities/extra_life.png");
    this.load.image("abilityThroughWall", "assets/sprites/abilities/through_wall.png");
    this.load.image("abilityGiant", "assets/sprites/abilities/giant.png");
    // Orbital abilities
    this.load.image("abilityChainsawOrbit", "assets/sprites/abilities/chainsaw_orbit.png");
    this.load.image("chainsawOrbit", "assets/sprites/abilities/chainsaw_orbit.png"); // Sprite for in-game visual

    // Load hero icons
    this.load.image("heroAtreus", "assets/sprites/ui/hero_atreus.png");
    this.load.image("heroHelix", "assets/sprites/ui/hero_helix.png");
    this.load.image("heroMeowgik", "assets/sprites/ui/hero_meowgik.png");

    // Load chapter icons
    this.load.image("chapter1Icon_medieval", "assets/sprites/ui/chapter1_icon_medieval.png");
    this.load.image("chapter2Icon_medieval", "assets/sprites/ui/chapter2_icon_medieval.png");
    this.load.image("chapter3Icon_medieval", "assets/sprites/ui/chapter3_icon_medieval.png");
    this.load.image("chapter4Icon_medieval", "assets/sprites/ui/chapter4_icon_medieval.png");
    this.load.image("chapter5Icon_medieval", "assets/sprites/ui/chapter5_icon_medieval.png");

    // Load wall textures
    this.load.image("wall_dungeon", "assets/sprites/walls/wall_dungeon.png");
    this.load.image("wall_forest", "assets/sprites/walls/wall_forest.png");
    this.load.image("wall_ice", "assets/sprites/walls/wall_ice.png");
    this.load.image("wall_lava", "assets/sprites/walls/wall_lava.png");
    this.load.image("wall_shadow", "assets/sprites/walls/wall_shadow.png");

    // Load chest sprites
    this.load.image("chest_wooden", "assets/sprites/chest/wooden.png");
    this.load.image("chest_silver", "assets/sprites/chest/silver.png");
    this.load.image("chest_golden", "assets/sprites/chest/golden.png");

    // Load play button
    this.load.image("playButton_medieval", "assets/sprites/ui/play_button_medieval.png");

    // Load equipment sprites
    // Weapons
    this.load.image("equip_brave_bow", "assets/sprites/equipment/weapon/brave_bow.png");
    this.load.image("equip_saw_blade", "assets/sprites/equipment/weapon/saw_blade.png");
    this.load.image("equip_staff", "assets/sprites/equipment/weapon/staff.png");
    this.load.image("equip_death_scythe", "assets/sprites/equipment/weapon/death_scythe.png");

    // Armor
    this.load.image("equip_vest", "assets/sprites/equipment/armor/vest.png");
    this.load.image("equip_robe", "assets/sprites/equipment/armor/robe.png");
    this.load.image("equip_phantom_cloak", "assets/sprites/equipment/armor/phantom_cloak.png");
    this.load.image(
      "equip_golden_chestplate",
      "assets/sprites/equipment/armor/golden_chestplate.png",
    );

    // Rings
    this.load.image("equip_bear_ring", "assets/sprites/equipment/ring/bear_ring.png");
    this.load.image("equip_wolf_ring", "assets/sprites/equipment/ring/wolf_ring.png");
    this.load.image("equip_serpent_ring", "assets/sprites/equipment/ring/serpent_ring.png");
    this.load.image("equip_falcon_ring", "assets/sprites/equipment/ring/falcon_ring.png");
    this.load.image("equip_lion_ring", "assets/sprites/equipment/ring/lion_ring.png");

    // Spirits
    this.load.image("equip_bat", "assets/sprites/equipment/spirit/bat.png");
    this.load.image("equip_laser_bat", "assets/sprites/equipment/spirit/laser_bat.png");
    this.load.image("equip_elf", "assets/sprites/equipment/spirit/elf.png");
    this.load.image("equip_living_bomb", "assets/sprites/equipment/spirit/living_bomb.png");
    this.load.image("equip_scythe_mage", "assets/sprites/equipment/spirit/scythe_mage.png");
  }

  create() {
    console.log("PreloaderScene: Assets loaded");
    this.scene.start("MainMenuScene");
  }

  update() {
    // Update floating particles
    this.updateFloatingParticles();
  }

  private createGradientBackground(width: number, height: number): void {
    const graphics = this.add.graphics();

    // Create vertical gradient from dark blue to darker purple
    const steps = 20;
    const stepHeight = height / steps;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // Interpolate between colors: dark navy (top) to dark purple (bottom)
      const r = Math.floor(15 + t * 10); // 15 -> 25
      const g = Math.floor(15 + t * 5); // 15 -> 20
      const b = Math.floor(35 + t * 15); // 35 -> 50
      const color = (r << 16) | (g << 8) | b;

      graphics.fillStyle(color, 1);
      graphics.fillRect(0, i * stepHeight, width, stepHeight + 1);
    }
  }

  private createFloatingParticles(width: number, height: number): void {
    // Initialize particle array
    this.particles = [];
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.2,
        alpha: Math.random() * 0.4 + 0.1,
        size: Math.random() * 2 + 1,
      });
    }

    // Create graphics object for particles
    this.particleGraphics = this.add.graphics();
    this.particleGraphics.setDepth(1);
  }

  private updateFloatingParticles(): void {
    if (!this.particleGraphics) return;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.particleGraphics.clear();

    for (const p of this.particles) {
      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around screen
      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      // Draw particle with glow effect
      this.particleGraphics.fillStyle(0x4a9eff, p.alpha * 0.3);
      this.particleGraphics.fillCircle(p.x, p.y, p.size + 2);
      this.particleGraphics.fillStyle(0x6bb6ff, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  private createLoadingDots(width: number, y: number): void {
    const dotCount = 3;
    const dotSpacing = 12;
    const startX = width / 2 - ((dotCount - 1) * dotSpacing) / 2;

    for (let i = 0; i < dotCount; i++) {
      const dot = this.add.circle(startX + i * dotSpacing, y, 4, 0x4a9eff, 1);
      this.loadingDots.push(dot);

      // Staggered bounce animation for each dot
      this.tweens.add({
        targets: dot,
        y: y - 8,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: i * 150,
      });

      // Subtle alpha pulse
      this.tweens.add({
        targets: dot,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: i * 150,
      });
    }
  }
}

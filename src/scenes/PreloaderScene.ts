import Phaser from 'phaser'

export default class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' })
  }

  preload() {
    // Create loading bar
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Loading...',
      style: {
        font: '20px monospace',
        color: '#ffffff',
      },
    })
    loadingText.setOrigin(0.5, 0.5)

    const percentText = this.make.text({
      x: width / 2,
      y: height / 2,
      text: '0%',
      style: {
        font: '18px monospace',
        color: '#ffffff',
      },
    })
    percentText.setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xffffff, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
      percentText.setText(Math.floor(value * 100) + '%')
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
      percentText.destroy()
    })

    // Load game assets
    this.load.image('portal', 'assets/sprites/door/portal.png')

    // Load sprites
    this.load.image('playerSprite', 'assets/sprites/player/archer.png')
    this.load.image('enemyMelee', 'assets/sprites/enemy/melee_slime.png')
    this.load.image('enemyRanged', 'assets/sprites/enemy/ranged_skeleton.png')
    this.load.image('enemySpreader', 'assets/sprites/enemy/spreader_eye.png')
    this.load.image('enemyHealer', 'assets/sprites/enemy/healer.png')
    this.load.image('enemySpawner', 'assets/sprites/enemy/spawner.png')
    this.load.image('enemyMinion', 'assets/sprites/enemy/minion.png')
    // New V1 enemy types
    this.load.image('enemyBomber', 'assets/sprites/enemy/bomber.png')
    this.load.image('enemyTank', 'assets/sprites/enemy/tank.png')
    this.load.image('enemyCharger', 'assets/sprites/enemy/charger.png')
    this.load.image('enemyBurrower', 'assets/sprites/enemy/burrower.png')
    this.load.image('bossSprite', 'assets/sprites/boss/demon.png')
    // Chapter 2 - Forest bosses
    this.load.image('boss_tree_guardian', 'assets/sprites/boss/tree_guardian.png')
    this.load.image('boss_wild_boar', 'assets/sprites/boss/wild_boar.png')
    this.load.image('boss_forest_spirit', 'assets/sprites/boss/forest_spirit.png')
    // Chapter 3 - Ice bosses
    this.load.image('boss_ice_golem', 'assets/sprites/boss/ice_golem.png')
    this.load.image('boss_frost_wyrm', 'assets/sprites/boss/frost_wyrm.png')
    this.load.image('boss_crystal_guardian', 'assets/sprites/boss/crystal_guardian.png')
    // Chapter 4 - Volcanic bosses
    this.load.image('boss_magma_wyrm', 'assets/sprites/boss/magma_wyrm.png')
    this.load.image('boss_inferno_demon', 'assets/sprites/boss/inferno_demon.png')
    this.load.image('boss_lava_golem', 'assets/sprites/boss/lava_golem.png')
    // Chapter 5 - Shadow bosses
    this.load.image('boss_void_lord', 'assets/sprites/boss/void_lord.png')
    this.load.image('boss_final_boss', 'assets/sprites/boss/final_boss.png')
    this.load.image('boss_nightmare', 'assets/sprites/boss/nightmare.png')

    // Load projectiles
    this.load.image('bulletSprite', 'assets/sprites/projectile/player_arrow.png')
    this.load.image('enemyBulletSprite', 'assets/sprites/projectile/enemy_fireball.png')
    this.load.image('spiritCatSprite', 'assets/sprites/projectile/spirit_cat.png')
    // Weapon-specific projectiles
    this.load.image('projectile_saw_blade', 'assets/sprites/projectile/projectile_saw_blade.png')
    this.load.image('projectile_staff', 'assets/sprites/projectile/projectile_staff.png')
    this.load.image('projectile_death_scythe', 'assets/sprites/projectile/projectile_death_scythe.png')

    // Load background
    this.load.image('dungeonFloor', 'assets/backgrounds/dungeon_floor.jpg')
    this.load.image('menuBg', 'assets/backgrounds/menu_bg.jpg')

    // Load chapter-specific backgrounds
    this.load.image('chapter1Bg', 'assets/backgrounds/chapter1_dungeon.jpg')
    this.load.image('chapter2Bg', 'assets/backgrounds/chapter2_forest.jpg')
    this.load.image('chapter3Bg', 'assets/backgrounds/chapter3_ice.jpg')
    this.load.image('chapter4Bg', 'assets/backgrounds/chapter4_volcanic.jpg')
    this.load.image('chapter5Bg', 'assets/backgrounds/chapter5_shadow.jpg')

    // Load vaporwave theme assets
    this.load.image('vaporwave_playerSprite', 'assets/sprites/player/vaporwave_archer.png')
    this.load.image('vaporwave_bulletSprite', 'assets/sprites/projectile/vaporwave_arrow.png')
    this.load.image('vaporwave_menuBg', 'assets/backgrounds/vaporwave_menu.jpg')
    this.load.image('vaporwave_chapter1Bg', 'assets/backgrounds/vaporwave_chapter1.jpg')
    this.load.image('vaporwave_chapter2Bg', 'assets/backgrounds/vaporwave_chapter2.jpg')
    this.load.image('vaporwave_chapter3Bg', 'assets/backgrounds/vaporwave_chapter3.jpg')
    this.load.image('vaporwave_chapter4Bg', 'assets/backgrounds/vaporwave_chapter4.jpg')
    this.load.image('vaporwave_chapter5Bg', 'assets/backgrounds/vaporwave_chapter5.jpg')

    // Load menu effects
    this.load.image('torch', 'assets/sprites/effect/torch.png')

    // Load ability icons - MVP abilities
    this.load.image('abilityFrontArrow', 'assets/sprites/abilities/front_arrow.png')
    this.load.image('abilityMultishot', 'assets/sprites/abilities/multishot.png')
    this.load.image('abilityAttackBoost', 'assets/sprites/abilities/attack_boost.png')
    this.load.image('abilityAttackSpeed', 'assets/sprites/abilities/attack_speed.png')
    this.load.image('abilityCrit', 'assets/sprites/abilities/crit.png')
    this.load.image('abilityFireDamage', 'assets/sprites/abilities/fire_damage.png')
    this.load.image('abilityPiercing', 'assets/sprites/abilities/piercing.png')
    this.load.image('abilityRicochet', 'assets/sprites/abilities/ricochet.png')
    // Load ability icons - V1 abilities
    this.load.image('abilityRearArrow', 'assets/sprites/abilities/rear_arrow.png')
    this.load.image('abilityDiagonalArrows', 'assets/sprites/abilities/diagonal_arrows.png')
    this.load.image('abilityDamageAura', 'assets/sprites/abilities/damage_aura.png')
    this.load.image('abilityIceShot', 'assets/sprites/abilities/ice_shot.png')
    this.load.image('abilityPoisonShot', 'assets/sprites/abilities/poison_shot.png')
    this.load.image('abilityLightningChain', 'assets/sprites/abilities/lightning_chain.png')
    this.load.image('abilityBloodthirst', 'assets/sprites/abilities/bloodthirst.png')
    this.load.image('abilityRage', 'assets/sprites/abilities/rage.png')
    this.load.image('abilityMaxHealth', 'assets/sprites/abilities/max_health.png')
    this.load.image('abilitySpeedBoost', 'assets/sprites/abilities/speed_boost.png')
    this.load.image('abilityBouncyWall', 'assets/sprites/abilities/bouncy_wall.png')

    // Load hero icons
    this.load.image('heroAtreus', 'assets/sprites/ui/hero_atreus.png')
    this.load.image('heroHelix', 'assets/sprites/ui/hero_helix.png')
    this.load.image('heroMeowgik', 'assets/sprites/ui/hero_meowgik.png')

    // Load chapter icons
    this.load.image('chapterIcon1', 'assets/sprites/ui/chapter1_icon.png')
    this.load.image('chapterIcon2', 'assets/sprites/ui/chapter2_icon.png')
    this.load.image('chapterIcon3', 'assets/sprites/ui/chapter3_icon.png')
    this.load.image('chapterIcon4', 'assets/sprites/ui/chapter4_icon.png')
    this.load.image('chapterIcon5', 'assets/sprites/ui/chapter5_icon.png')
    
    // Load chest sprites
    this.load.image('chest_wooden', 'assets/sprites/chest/wooden.png')
    this.load.image('chest_silver', 'assets/sprites/chest/silver.png')
    this.load.image('chest_golden', 'assets/sprites/chest/golden.png')
    
    // Load equipment sprites
    // Weapons
    this.load.image('equip_brave_bow', 'assets/sprites/equipment/weapon/brave_bow.png')
    this.load.image('equip_saw_blade', 'assets/sprites/equipment/weapon/saw_blade.png')
    this.load.image('equip_staff', 'assets/sprites/equipment/weapon/staff.png')
    this.load.image('equip_death_scythe', 'assets/sprites/equipment/weapon/death_scythe.png')
    
    // Armor
    this.load.image('equip_vest', 'assets/sprites/equipment/armor/vest.png')
    this.load.image('equip_robe', 'assets/sprites/equipment/armor/robe.png')
    this.load.image('equip_phantom_cloak', 'assets/sprites/equipment/armor/phantom_cloak.png')
    this.load.image('equip_golden_chestplate', 'assets/sprites/equipment/armor/golden_chestplate.png')
    
    // Rings
    this.load.image('equip_bear_ring', 'assets/sprites/equipment/ring/bear_ring.png')
    this.load.image('equip_wolf_ring', 'assets/sprites/equipment/ring/wolf_ring.png')
    this.load.image('equip_serpent_ring', 'assets/sprites/equipment/ring/serpent_ring.png')
    this.load.image('equip_falcon_ring', 'assets/sprites/equipment/ring/falcon_ring.png')
    this.load.image('equip_lion_ring', 'assets/sprites/equipment/ring/lion_ring.png')
    
    // Spirits
    this.load.image('equip_bat', 'assets/sprites/equipment/spirit/bat.png')
    this.load.image('equip_laser_bat', 'assets/sprites/equipment/spirit/laser_bat.png')
    this.load.image('equip_elf', 'assets/sprites/equipment/spirit/elf.png')
    this.load.image('equip_living_bomb', 'assets/sprites/equipment/spirit/living_bomb.png')
    this.load.image('equip_scythe_mage', 'assets/sprites/equipment/spirit/scythe_mage.png')
  }

  create() {
    console.log('PreloaderScene: Assets loaded')
    this.scene.start('MainMenuScene')
  }
}

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
    this.load.image('enemyBurrower', 'assets/sprites/enemy/burrower.png')
    this.load.image('enemyHealer', 'assets/sprites/enemy/healer.png')
    this.load.image('enemySpawner', 'assets/sprites/enemy/spawner.png')
    this.load.image('enemyMinion', 'assets/sprites/enemy/minion.png')
    // New V1 enemy types
    this.load.image('enemyBomber', 'assets/sprites/enemy/bomber.png')
    this.load.image('enemyTank', 'assets/sprites/enemy/tank.png')
    this.load.image('enemyCharger', 'assets/sprites/enemy/charger.png')
    this.load.image('bossSprite', 'assets/sprites/boss/demon.png')

    // Load projectiles
    this.load.image('bulletSprite', 'assets/sprites/projectile/player_arrow.png')
    this.load.image('enemyBulletSprite', 'assets/sprites/projectile/enemy_fireball.png')

    // Load background
    this.load.image('dungeonFloor', 'assets/backgrounds/dungeon_floor.png')
    this.load.image('menuBg', 'assets/backgrounds/menu_bg.png')

    // Load chapter-specific backgrounds
    this.load.image('chapter1Bg', 'assets/backgrounds/chapter1_dungeon.png')
    this.load.image('chapter2Bg', 'assets/backgrounds/chapter2_forest.png')
    this.load.image('chapter3Bg', 'assets/backgrounds/chapter3_ice.png')
    this.load.image('chapter4Bg', 'assets/backgrounds/chapter4_volcanic.png')
    this.load.image('chapter5Bg', 'assets/backgrounds/chapter5_shadow.png')

    // Load menu effects
    this.load.image('torch', 'assets/sprites/effect/torch.png')

    // Load ability icons
    this.load.image('abilityFrontArrow', 'assets/sprites/abilities/front_arrow.png')
    this.load.image('abilityMultishot', 'assets/sprites/abilities/multishot.png')

    // Load hero icons
    this.load.image('heroAtreus', 'assets/sprites/ui/hero_atreus.png')
    this.load.image('heroHelix', 'assets/sprites/ui/hero_helix.png')
    this.load.image('heroMeowgik', 'assets/sprites/ui/hero_meowgik.png')
  }

  create() {
    console.log('PreloaderScene: Assets loaded')
    this.scene.start('MainMenuScene')
  }
}

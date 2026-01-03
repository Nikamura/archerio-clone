import Phaser from 'phaser'
import Player from '../entities/Player'
import Enemy from '../entities/Enemy'
import Boss from '../entities/Boss'
import BulletPool from '../systems/BulletPool'
import EnemyBulletPool from '../systems/EnemyBulletPool'
import BombPool from '../systems/BombPool'
import GoldPool from '../systems/GoldPool'
import HealthPool from '../systems/HealthPool'
import DamageNumberPool from '../systems/DamageNumberPool'
import { getDifficultyConfig, DifficultyConfig } from '../config/difficulty'
import { audioManager } from '../systems/AudioManager'
import { chapterManager } from '../systems/ChapterManager'
import { getChapterDefinition } from '../config/chapterData'
import { currencyManager } from '../systems/CurrencyManager'
import { saveManager } from '../systems/SaveManager'
import { createScreenShake } from '../systems/ScreenShake'
import { createParticleManager } from '../systems/ParticleManager'
import { hapticManager } from '../systems/HapticManager'
import { heroManager } from '../systems/HeroManager'
import { equipmentManager } from '../systems/EquipmentManager'
import { themeManager } from '../systems/ThemeManager'
import type { ThemeAssets } from '../config/themeData'
import { talentManager } from '../systems/TalentManager'
import { performanceMonitor } from '../systems/PerformanceMonitor'
import { getRoomGenerator } from '../systems/RoomGenerator'
import { SeededRandom } from '../systems/SeededRandom'
import { errorReporting } from '../systems/ErrorReportingManager'

// Extracted systems
import { CombatSystem } from '../systems/CombatSystem'
import { InputController } from '../systems/InputController'
import { ShootingSystem } from '../systems/ShootingSystem'
import { AbilitySystem } from '../systems/AbilitySystem'
import { AuraSystem } from '../systems/AuraSystem'
import { PickupManager } from '../systems/PickupManager'
import { EnemySpawner } from '../systems/EnemySpawner'
import { SpiritCatSystem } from '../systems/SpiritCatSystem'
import { RoomManager } from '../systems/RoomManager'
import { calculatePlayerStats } from '../systems/PlayerStatsCalculator'

export default class GameScene extends Phaser.Scene {
  // Core config
  private difficultyConfig!: DifficultyConfig

  // Player
  private player!: Player

  // Object pools
  private bulletPool!: BulletPool
  private enemyBulletPool!: EnemyBulletPool
  private bombPool!: BombPool
  private goldPool!: GoldPool
  private healthPool!: HealthPool
  private damageNumberPool!: DamageNumberPool
  private enemies!: Phaser.Physics.Arcade.Group

  // Extracted systems
  private combatSystem!: CombatSystem
  private inputController!: InputController
  private shootingSystem!: ShootingSystem
  private abilitySystem!: AbilitySystem
  private auraSystem!: AuraSystem
  private pickupManager!: PickupManager
  private enemySpawner!: EnemySpawner
  private spiritCatSystem: SpiritCatSystem | null = null
  private roomManager!: RoomManager

  // Game state
  private isGameOver: boolean = false
  private boss: Boss | null = null
  private runStartTime: number = 0
  private goldEarned: number = 0
  private heroXPEarned: number = 0
  private enemiesKilled: number = 0

  // Seeded random
  private runRng!: SeededRandom
  private runSeedString: string = ''

  // Performance: nearest enemy cache
  private cachedNearestEnemy: Enemy | null = null
  private nearestEnemyCacheFrame: number = 0
  private readonly NEAREST_ENEMY_CACHE_FRAMES = 3

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.difficultyConfig = getDifficultyConfig(this.game)
    console.log('Starting game with difficulty:', this.difficultyConfig.label)

    // Register shutdown event
    this.events.once('shutdown', this.shutdown, this)

    // Debug skip level event
    if (this.game.registry.get('debug')) {
      this.game.events.on('debugSkipLevel', this.debugSkipLevel, this)
      this.events.once('shutdown', () => {
        this.game.events.off('debugSkipLevel', this.debugSkipLevel, this)
      })
    }

    // Reset level event
    this.game.events.on('resetLevel', this.resetLevel, this)
    this.events.once('shutdown', () => {
      this.game.events.off('resetLevel', this.resetLevel, this)
    })

    // Handle visibility changes
    this.setupVisibilityHandlers()

    // Reset game state
    this.isGameOver = false
    this.enemiesKilled = 0
    this.runStartTime = Date.now()
    this.goldEarned = 0
    this.heroXPEarned = 0

    // Error reporting
    const selectedHero = heroManager.getSelectedHeroId()
    errorReporting.setScene('GameScene')
    errorReporting.setProgress(chapterManager.getSelectedChapter(), 1)
    errorReporting.setPlayerStats(1, 100, selectedHero || undefined)
    errorReporting.addBreadcrumb('game', 'Game started', {
      chapter: chapterManager.getSelectedChapter(),
      hero: selectedHero,
    })

    const width = this.cameras.main.width
    const height = this.cameras.main.height
    this.physics.world.setBounds(0, 0, width, height)

    // Set up background
    this.setupBackground()

    // Start chapter run
    const selectedChapter = chapterManager.getSelectedChapter()
    chapterManager.startChapter(selectedChapter)

    // Create player with calculated stats
    this.createPlayer()

    // Create object pools
    this.createPools()

    // Create visual effects
    const screenShake = createScreenShake(this)
    const particles = createParticleManager(this)
    particles.prewarm(10)

    // Initialize seeded random
    this.initializeRng()

    // Get talent bonuses
    const talentBonuses = talentManager.calculateTotalBonuses()

    // Create enemy group
    this.enemies = this.physics.add.group()

    // Create extracted systems
    this.createSystems(screenShake, particles, talentBonuses)

    // Set up collisions
    this.setupCollisions()

    // Spawn initial enemies
    this.roomManager.spawnEnemiesForRoom()

    // Update UI
    this.updateRoomUI()
    this.scene.get('UIScene').events.emit('updateHealth', this.player.getHealth(), this.player.getMaxHealth())

    // Initialize performance monitoring
    if (this.game.config.physics?.arcade?.debug) {
      performanceMonitor.createOverlay(this)
    }

    console.log('GameScene: Created')
  }

  private setupVisibilityHandlers(): void {
    const handleVisibilityChange = () => {
      if (document.hidden && this.scene.isActive() && this.player) {
        console.log('GameScene: Page hidden, resetting input')
        this.inputController?.reset()
      }
    }

    const handleBlur = () => {
      if (this.scene.isActive() && this.player) {
        console.log('GameScene: Window blur, resetting input')
        this.inputController?.reset()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    })
  }

  private setupBackground(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const selectedChapter = chapterManager.getSelectedChapter()
    const themeAssets = themeManager.getAssets()
    const backgroundKeyName = `chapter${selectedChapter}Bg` as keyof ThemeAssets
    const backgroundKey = themeAssets[backgroundKeyName] as string
    const bgKey = this.textures.exists(backgroundKey) ? backgroundKey : 'dungeonFloor'
    const bg = this.add.image(0, 0, bgKey).setOrigin(0)
    bg.setDisplaySize(width, height)
    const chapterDef = getChapterDefinition(selectedChapter)
    console.log(`GameScene: Using background '${bgKey}' for chapter ${selectedChapter} (${chapterDef.name})`)
  }

  private createPlayer(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const selectedHeroId = heroManager.getSelectedHeroId()
    const heroStats = heroManager.getSelectedHeroStats()
    const equipStats = equipmentManager.getEquippedStats()
    const talentBonuses = talentManager.calculateTotalBonuses()

    console.log(`GameScene: Selected hero ${selectedHeroId} with stats:`, heroStats)
    console.log('GameScene: Equipment stats:', equipStats)

    const { stats, weaponProjectileConfig } = calculatePlayerStats(
      heroStats,
      equipStats,
      talentBonuses,
      this.difficultyConfig
    )

    console.log('GameScene: Final player stats:', stats)

    this.player = new Player(this, width / 2, height / 2, {
      maxHealth: stats.maxHealth,
      baseDamage: stats.baseDamage,
      baseAttackSpeed: stats.baseAttackSpeed,
      critChance: stats.critChance,
      critDamage: stats.critDamage,
    }, selectedHeroId)

    this.player.setDodgeChance(stats.dodgeChance)

    // Store weapon config for shooting system
    this.game.registry.set('weaponProjectileConfig', weaponProjectileConfig)
  }

  private createPools(): void {
    this.bulletPool = new BulletPool(this)
    this.enemyBulletPool = new EnemyBulletPool(this)
    this.bombPool = new BombPool(this)
    this.goldPool = new GoldPool(this)
    this.goldPool.setGoldMultiplier(this.difficultyConfig.goldMultiplier)
    this.healthPool = new HealthPool(this)
    this.damageNumberPool = new DamageNumberPool(this)
  }

  private initializeRng(): void {
    const passedSeed = this.game.registry.get('runSeed')
    if (passedSeed) {
      this.runRng = new SeededRandom(SeededRandom.parseSeed(passedSeed))
      this.game.registry.remove('runSeed')
    } else {
      this.runRng = new SeededRandom()
    }
    this.runSeedString = this.runRng.getSeedString()
    console.log(`GameScene: Run seed: ${this.runSeedString}`)
  }

  private createSystems(
    screenShake: ReturnType<typeof createScreenShake>,
    particles: ReturnType<typeof createParticleManager>,
    talentBonuses: ReturnType<typeof talentManager.calculateTotalBonuses>
  ): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const roomGenerator = getRoomGenerator(width, height)
    roomGenerator.setRng(this.runRng)

    // Input controller
    this.inputController = new InputController(this, this.player)

    // Shooting system
    this.shootingSystem = new ShootingSystem(this, this.player, this.bulletPool)
    const weaponConfig = this.game.registry.get('weaponProjectileConfig')
    this.shootingSystem.setWeaponProjectileConfig(weaponConfig)

    // Combat system
    this.combatSystem = new CombatSystem({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      bulletPool: this.bulletPool,
      enemyBulletPool: this.enemyBulletPool,
      damageNumberPool: this.damageNumberPool,
      screenShake,
      particles,
      difficultyConfig: this.difficultyConfig,
      talentBonuses,
    })
    this.combatSystem.setCallbacks({
      onEnemyKilled: (enemy, isBoss, xpGain) => this.handleEnemyKilled(enemy, isBoss, xpGain),
      onPlayerDamaged: () => this.updatePlayerHealthUI(),
      onPlayerDeath: () => this.triggerGameOver(),
      onBossHealthUpdate: (current, max) => this.scene.get('UIScene').events.emit('updateBossHealth', current, max),
      onBossKilled: () => { this.boss = null; this.scene.get('UIScene').events.emit('hideBossHealth') },
      getBoss: () => this.boss,
      spawnDrops: (enemy) => this.pickupManager.spawnDrops(enemy),
      applyLightningChain: (source, damage, count) => this.auraSystem.applyLightningChain(source, damage, count),
      findNearestEnemyExcluding: (x, y, exclude) => this.findNearestEnemyExcluding(x, y, exclude),
      invalidateNearestEnemyCache: () => this.invalidateNearestEnemyCache(),
      checkRoomCleared: () => this.roomManager.checkRoomCleared(),
    })

    // Ability system
    this.abilitySystem = new AbilitySystem(this, this.player, particles, talentBonuses)
    this.abilitySystem.setCallbacks({
      onAbilitiesUpdated: (abilities) => this.scene.get('UIScene').events.emit('updateAbilities', abilities),
      onHealthUpdated: () => this.updatePlayerHealthUI(),
      pausePhysics: () => this.physics.pause(),
      resumePhysics: () => this.physics.resume(),
      hideJoystick: () => this.inputController.hide(),
      showJoystick: () => this.inputController.show(),
      resetJoystickState: () => this.inputController.reset(),
      showAutoLevelUp: (ability) => this.scene.get('UIScene').events.emit('showAutoLevelUp', ability),
    })

    // Pickup manager
    this.pickupManager = new PickupManager(this.goldPool, this.healthPool, particles)
    this.pickupManager.setCallbacks({
      onGoldCollected: (amount) => {
        this.goldEarned += amount
        currencyManager.add('gold', amount)
        saveManager.addGold(amount)
      },
      onHealthCollected: (amount) => {
        this.player.heal(amount)
        this.updatePlayerHealthUI()
      },
    })

    // Aura system
    this.auraSystem = new AuraSystem(this, this.player, this.damageNumberPool, screenShake, particles)
    this.auraSystem.setCallbacks({
      getEnemies: () => this.enemies,
      onEnemyKilled: (enemy, isBoss, xpGain) => this.handleEnemyKilled(enemy, isBoss, xpGain),
      getBoss: () => this.boss as Enemy | null,
      onBossKilled: () => { this.boss = null; this.scene.get('UIScene').events.emit('hideBossHealth') },
      spawnDrops: (enemy) => this.pickupManager.spawnDrops(enemy),
      invalidateNearestEnemyCache: () => this.invalidateNearestEnemyCache(),
      checkRoomCleared: () => this.roomManager.checkRoomCleared(),
    })

    // Enemy spawner
    this.enemySpawner = new EnemySpawner(
      this,
      this.enemies,
      this.enemyBulletPool,
      this.bombPool,
      this.difficultyConfig,
      roomGenerator,
      this.runRng
    )
    this.enemySpawner.setCallbacks({
      handleBombExplosion: (x, y, radius, damage) =>
        this.combatSystem.handleBombExplosion(x, y, radius, damage, this.isGameOver),
    })

    // Spirit cat system (Meowgik only)
    const selectedHeroId = heroManager.getSelectedHeroId()
    if (selectedHeroId === 'meowgik') {
      const heroStats = heroManager.getSelectedHeroStats()
      this.spiritCatSystem = new SpiritCatSystem(
        this,
        this.player,
        this.damageNumberPool,
        screenShake,
        particles,
        heroStats
      )
      this.spiritCatSystem.setCallbacks({
        getCachedNearestEnemy: () => this.getCachedNearestEnemy(),
        onEnemyKilled: (enemy, isBoss, xpGain) => this.handleEnemyKilled(enemy, isBoss, xpGain),
        getBoss: () => this.boss as Enemy | null,
        onBossKilled: () => { this.boss = null; this.scene.get('UIScene').events.emit('hideBossHealth') },
        onBossHealthUpdate: (current, max) => this.scene.get('UIScene').events.emit('updateBossHealth', current, max),
        spawnDrops: (enemy) => this.pickupManager.spawnDrops(enemy),
        invalidateNearestEnemyCache: () => this.invalidateNearestEnemyCache(),
        checkRoomCleared: () => this.roomManager.checkRoomCleared(),
        updatePlayerHealthUI: () => this.updatePlayerHealthUI(),
      })
    }

    // Room manager
    this.roomManager = new RoomManager(
      this,
      this.enemySpawner,
      this.pickupManager,
      this.bulletPool,
      this.enemyBulletPool,
      this.spiritCatSystem
    )
    this.roomManager.setCallbacks({
      onRoomCleared: () => this.scene.get('UIScene').events.emit('roomCleared'),
      onVictory: (completionResult) => this.handleVictory(completionResult),
      onRoomTransition: () => this.scene.get('UIScene').events.emit('roomEntered'),
      updateRoomUI: () => this.updateRoomUI(),
      getPlayer: () => this.player,
      getEnemies: () => this.enemies,
      getBoss: () => this.boss,
      setBoss: (boss) => { this.boss = boss },
      hideBossHealth: () => this.scene.get('UIScene').events.emit('hideBossHealth'),
      showBossHealth: (current, max) => this.scene.get('UIScene').events.emit('showBossHealth', current, max),
      collectPickups: () => this.goldEarned,
      healPlayer: (amount) => {
        this.player.heal(amount)
        this.updatePlayerHealthUI()
      },
    })
  }

  private setupCollisions(): void {
    // Player bullets hit enemies
    this.physics.add.overlap(
      this.bulletPool,
      this.enemies,
      ((bullet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
        this.combatSystem.bulletHitEnemy(bullet, enemy, this.isGameOver, this.roomManager.getIsTransitioning())
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Enemy bullets hit player
    this.physics.add.overlap(
      this.player,
      this.enemyBulletPool,
      ((_player: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.GameObject) => {
        this.combatSystem.enemyBulletHitPlayer(this.player, bullet, this.isGameOver)
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Enemies hit player (melee)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      ((_player: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
        this.combatSystem.enemyHitPlayer(this.player, enemy, this.isGameOver, this.time.now)
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Spirit cats hit enemies
    if (this.spiritCatSystem) {
      const pool = this.spiritCatSystem.getPool()
      if (pool) {
        this.physics.add.overlap(
          pool,
          this.enemies,
          ((cat: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
            this.spiritCatSystem!.handleHit(cat, enemy, this.isGameOver, this.roomManager.getIsTransitioning())
          }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
          undefined,
          this
        )
      }
    }
  }

  private handleEnemyKilled(_enemy: Enemy, isBoss: boolean, xpGain: number): void {
    this.enemiesKilled++
    this.heroXPEarned += isBoss ? 25 : 1

    const leveledUp = this.player.addXP(xpGain)
    this.updateXPUI()

    if (leveledUp) {
      this.abilitySystem.handleLevelUp()
    }
    // Note: checkRoomCleared is called by CombatSystem after enemy.destroy()
  }

  private handleVictory(completionResult: unknown): void {
    this.isGameOver = true
    audioManager.playVictory()
    console.log('Victory! All rooms cleared!')

    this.inputController.destroy()

    const playTimeMs = Date.now() - this.runStartTime

    this.time.delayedCall(500, () => {
      this.scene.stop('UIScene')
      this.scene.launch('GameOverScene', {
        roomsCleared: this.roomManager.getTotalRooms(),
        enemiesKilled: this.enemiesKilled,
        isVictory: true,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getAbilitiesGained(),
        goldEarned: this.goldEarned,
        completionResult: completionResult ?? undefined,
        runSeed: this.runSeedString,
        acquiredAbilities: this.abilitySystem.getAcquiredAbilities(),
        heroXPEarned: this.heroXPEarned,
      })
      this.scene.stop('GameScene')
    })
  }

  private triggerGameOver(): void {
    if (this.isGameOver) return

    this.isGameOver = true
    audioManager.playDeath()
    hapticManager.death()
    console.log('Game Over! Enemies killed:', this.enemiesKilled)

    chapterManager.endRun(true)
    this.player.setVelocity(0, 0)
    this.player.setTint(0xff0000)
    this.inputController.destroy()

    const playTimeMs = Date.now() - this.runStartTime

    this.time.delayedCall(500, () => {
      this.scene.stop('UIScene')
      this.scene.launch('GameOverScene', {
        roomsCleared: this.roomManager.getCurrentRoom() - 1,
        enemiesKilled: this.enemiesKilled,
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getAbilitiesGained(),
        goldEarned: this.goldEarned,
        runSeed: this.runSeedString,
        acquiredAbilities: this.abilitySystem.getAcquiredAbilities(),
        heroXPEarned: this.heroXPEarned,
      })
      this.scene.stop('GameScene')
    })
  }

  private updateRoomUI(): void {
    this.scene.get('UIScene').events.emit('updateRoom', this.roomManager.getCurrentRoom(), this.roomManager.getTotalRooms())
  }

  private updatePlayerHealthUI(): void {
    this.scene.get('UIScene').events.emit('updateHealth', this.player.getHealth(), this.player.getMaxHealth())
  }

  private updateXPUI(): void {
    const xpPercentage = this.player.getXPPercentage()
    const level = this.player.getLevel()
    this.scene.get('UIScene').events.emit('updateXP', xpPercentage, level)
  }

  private debugSkipLevel(): void {
    if (this.isGameOver || this.roomManager.getIsTransitioning()) return
    this.roomManager.debugSkipLevel()
  }

  private resetLevel(): void {
    if (this.isGameOver || this.roomManager.getIsTransitioning()) return
    this.roomManager.resetLevel(this.runRng)
  }

  private findNearestEnemy(): Enemy | null {
    let nearestEnemy: Enemy | null = null
    let nearestDistance = Infinity

    if (!this.player || !isFinite(this.player.x) || !isFinite(this.player.y)) {
      return null
    }

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active || !e.body) return

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = e
      }
    })

    return nearestEnemy
  }

  private getCachedNearestEnemy(): Enemy | null {
    const currentFrame = this.game.getFrame()

    if (currentFrame - this.nearestEnemyCacheFrame >= this.NEAREST_ENEMY_CACHE_FRAMES) {
      this.cachedNearestEnemy = this.findNearestEnemy()
      this.nearestEnemyCacheFrame = currentFrame
    }

    if (this.cachedNearestEnemy && (!this.cachedNearestEnemy.active || !this.cachedNearestEnemy.body)) {
      this.cachedNearestEnemy = this.findNearestEnemy()
      this.nearestEnemyCacheFrame = currentFrame
    }

    return this.cachedNearestEnemy
  }

  private invalidateNearestEnemyCache(): void {
    this.nearestEnemyCacheFrame = 0
    this.cachedNearestEnemy = null
  }

  private findNearestEnemyExcluding(x: number, y: number, exclude: Enemy): Enemy | null {
    let nearestEnemy: Enemy | null = null
    let nearestDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (e === exclude || !e.active) return

      const distance = Phaser.Math.Distance.Between(x, y, e.x, e.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = e
      }
    })

    return nearestEnemy
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return

    performanceMonitor.update(delta)

    if (this.player) {
      // Check for stuck joystick
      this.inputController.checkStuckState(time)

      // Get movement velocity
      const baseVelocity = 400
      const { vx, vy } = this.inputController.getVelocity(baseVelocity)
      this.player.setVelocity(vx, vy)
      this.player.update(time, delta)

      // Auto-fire when stationary
      const hasMovementInput = this.inputController.hasMovementInput()
      if (!hasMovementInput && !this.player.isPlayerMoving()) {
        if (this.shootingSystem.canShoot(time)) {
          const nearestEnemy = this.getCachedNearestEnemy()
          if (nearestEnemy) {
            this.shootingSystem.shootAt(nearestEnemy, time)
          }
        }
      }

      // Update enemies and handle DOT deaths
      const enemyChildren = this.enemies.getChildren()
      const enemiesToDestroy: Enemy[] = []

      for (let i = 0; i < enemyChildren.length; i++) {
        const e = enemyChildren[i] as Enemy
        if (e && e.active) {
          const diedFromDOT = e.update(time, delta, this.player.x, this.player.y)
          if (diedFromDOT) {
            enemiesToDestroy.push(e)
          }
        }
      }

      for (const e of enemiesToDestroy) {
        this.handleEnemyDOTDeath(e)
      }

      // Update systems
      this.auraSystem.update(time, this.player.x, this.player.y)

      if (this.spiritCatSystem) {
        this.spiritCatSystem.update(time, this.player.x, this.player.y)
      }

      this.pickupManager.update(this.player.x, this.player.y)

      // Update performance monitor
      performanceMonitor.updateEntityCounts(
        enemyChildren.length,
        this.bulletPool.getLength() + this.enemyBulletPool.getLength(),
        0
      )
    }
  }

  private handleEnemyDOTDeath(enemy: Enemy): void {
    this.enemiesKilled++

    const bloodthirstHeal = this.player.getBloodthirstHeal()
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal)
      this.updatePlayerHealthUI()
    }

    this.pickupManager.spawnDrops(enemy)

    const isBoss = this.boss && enemy === (this.boss as unknown as Enemy)
    const xpGain = isBoss ? 10 : 1
    const leveledUp = this.player.addXP(xpGain)
    this.updateXPUI()
    this.heroXPEarned += isBoss ? 25 : 1

    if (leveledUp) {
      this.abilitySystem.handleLevelUp()
    }

    if (isBoss) {
      this.boss = null
      this.scene.get('UIScene').events.emit('hideBossHealth')
    }

    enemy.destroy()
    this.invalidateNearestEnemyCache()
    this.roomManager.checkRoomCleared()
  }

  shutdown(): void {
    this.time.removeAllEvents()

    this.inputController?.destroy()
    this.auraSystem?.destroy()
    this.spiritCatSystem?.destroy()

    if (this.bulletPool) {
      this.bulletPool.destroy(true)
      this.bulletPool = null!
    }
    if (this.enemyBulletPool) {
      this.enemyBulletPool.destroy(true)
      this.enemyBulletPool = null!
    }
    if (this.bombPool) {
      this.bombPool.destroy(true)
      this.bombPool = null!
    }
    if (this.goldPool) {
      this.goldPool.destroy(true)
      this.goldPool = null!
    }
    if (this.healthPool) {
      this.healthPool.destroy(true)
      this.healthPool = null!
    }
    if (this.damageNumberPool) {
      this.damageNumberPool.destroy()
      this.damageNumberPool = null!
    }
    if (this.enemies) {
      this.enemies.destroy(true)
      this.enemies = null!
    }
    if (this.boss) {
      this.boss.destroy()
      this.boss = null
    }
    if (this.player) {
      this.player.destroy()
      this.player = null!
    }
  }
}

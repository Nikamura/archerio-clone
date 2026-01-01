import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import PreloaderScene from './scenes/PreloaderScene'
import MainMenuScene from './scenes/MainMenuScene'
import HeroesScene from './scenes/HeroesScene'
import EquipmentScene from './scenes/EquipmentScene'
import TalentsScene from './scenes/TalentsScene'
import GameScene from './scenes/GameScene'
import UIScene from './scenes/UIScene'
import GameOverScene from './scenes/GameOverScene'
import LevelUpScene from './scenes/LevelUpScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 375,
  height: 667,
  parent: 'game',
  backgroundColor: '#2d2d2d',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloaderScene, MainMenuScene, HeroesScene, EquipmentScene, TalentsScene, GameScene, UIScene, GameOverScene, LevelUpScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)

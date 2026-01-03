import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import PreloaderScene from './scenes/PreloaderScene'
import MainMenuScene from './scenes/MainMenuScene'
import HeroesScene from './scenes/HeroesScene'
import EquipmentScene from './scenes/EquipmentScene'
import TalentsScene from './scenes/TalentsScene'
import ChestScene from './scenes/ChestScene'
import DailyRewardScene from './scenes/DailyRewardScene'
import AchievementsScene from './scenes/AchievementsScene'
import ShopScene from './scenes/ShopScene'
import SettingsScene from './scenes/SettingsScene'
import GameScene from './scenes/GameScene'
import UIScene from './scenes/UIScene'
import GameOverScene from './scenes/GameOverScene'
import LevelUpScene from './scenes/LevelUpScene'
import { errorToast } from './systems/ErrorToast'

// Initialize error toast for debugging on mobile
// This sets up global error handlers to catch and display errors visually
errorToast.setDuration(5000) // 5 seconds display

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
  scene: [BootScene, PreloaderScene, MainMenuScene, HeroesScene, EquipmentScene, TalentsScene, ChestScene, DailyRewardScene, AchievementsScene, ShopScene, SettingsScene, GameScene, UIScene, GameOverScene, LevelUpScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)

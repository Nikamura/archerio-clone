import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import PreloaderScene from "./scenes/PreloaderScene";
import MainMenuScene from "./scenes/MainMenuScene";
import HeroesScene from "./scenes/HeroesScene";
import EquipmentScene from "./scenes/EquipmentScene";
import TalentsScene from "./scenes/TalentsScene";
import ChestScene from "./scenes/ChestScene";
import DailyRewardScene from "./scenes/DailyRewardScene";
import AchievementsScene from "./scenes/AchievementsScene";
import SettingsScene from "./scenes/SettingsScene";
import EncyclopediaScene from "./scenes/EncyclopediaScene";
import AbilityPriorityScene from "./scenes/AbilityPriorityScene";
import CouponScene from "./scenes/CouponScene";
import GameScene from "./scenes/GameScene";
import UIScene from "./scenes/UIScene";
import GameOverScene from "./scenes/GameOverScene";
import LevelUpScene from "./scenes/LevelUpScene";
import StartingAbilityScene from "./scenes/StartingAbilityScene";
import PauseScene from "./scenes/PauseScene";
import BuildInfoScene from "./scenes/BuildInfoScene";
import HighScoreScene from "./scenes/HighScoreScene";
import { errorToast } from "./systems/ErrorToast";

// Initialize error toast for debugging on mobile
// This sets up global error handlers to catch and display errors visually
errorToast.setDuration(5000); // 5 seconds display

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 375,
  height: 667,
  parent: "game",
  backgroundColor: "#2d2d2d",
  // Cap frame rate at 60 FPS for consistent gameplay across all refresh rates (60Hz, 120Hz, etc.)
  fps: {
    target: 60,
    forceSetTimeOut: true, // Use setTimeout for more consistent timing across devices
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    PreloaderScene,
    MainMenuScene,
    HeroesScene,
    EquipmentScene,
    TalentsScene,
    ChestScene,
    DailyRewardScene,
    AchievementsScene,
    SettingsScene,
    EncyclopediaScene,
    AbilityPriorityScene,
    CouponScene,
    GameScene,
    UIScene,
    GameOverScene,
    LevelUpScene,
    StartingAbilityScene,
    PauseScene,
    BuildInfoScene,
    HighScoreScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);

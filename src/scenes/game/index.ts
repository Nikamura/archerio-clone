// Game subsystem exports
export { InputSystem, type InputResult, type InputSystemConfig } from "./InputSystem";
export {
  CombatSystem,
  type CombatSystemConfig,
  type CombatEventHandlers,
  type DamageResult,
} from "./CombatSystem";
export { AbilitySystem, type AcquiredAbility, type AbilityEventHandlers } from "./AbilitySystem";
export { RoomManager, type RoomManagerConfig, type RoomEventHandlers } from "./RoomManager";
export {
  EnemySpawnManager,
  type EnemySpawnManagerConfig,
  type EnemySpawnEventHandlers,
} from "./EnemySpawnManager";
export {
  EnemyDeathHandler,
  type EnemyDeathHandlerConfig,
  type EnemyDeathEventHandlers,
  type EnemyDeathOptions,
} from "./EnemyDeathHandler";
export {
  ShootingSystem,
  type ShootingSystemConfig,
  type ShootingEventHandlers,
  type WeaponProjectileConfig,
} from "./ShootingSystem";
export {
  LevelUpSystem,
  type LevelUpSystemConfig,
  type LevelUpEventHandlers,
} from "./LevelUpSystem";
export {
  RespawnSystem,
  type RespawnSystemConfig,
  type RespawnEventHandlers,
} from "./RespawnSystem";
export {
  TutorialSystem,
  type TutorialSystemConfig,
  type TutorialEventHandlers,
} from "./TutorialSystem";
export { PickupSystem, type PickupSystemConfig, type PickupEventHandlers } from "./PickupSystem";
export {
  InitializationSystem,
  type InitializationSystemConfig,
  type GameSceneEventHandlers,
  type InitializationResult,
  type InitializationPools,
  type InitializationVisualEffects,
  type InitializationSystems,
  type InitializationPhysics,
  type InitializationGameState,
} from "./InitializationSystem";

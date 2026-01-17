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

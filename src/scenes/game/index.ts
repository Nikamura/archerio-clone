// Game subsystem exports
export { InputSystem, type InputResult, type InputSystemConfig } from "./InputSystem";
export {
  CombatSystem,
  type CombatSystemConfig,
  type CombatEventHandlers,
  type DamageResult,
} from "./CombatSystem";
export { AbilitySystem, type AcquiredAbility, type AbilityEventHandlers } from "./AbilitySystem";

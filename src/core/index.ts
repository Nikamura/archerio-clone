// Core module exports
export {
  StatusEffectSystem,
  type StatusEffectType,
  type FireEffect,
  type FreezeEffect,
  type PoisonEffect,
  type StatusEffectTint,
  type StatusEffectUpdateResult,
} from "./StatusEffects";

export {
  StateMachine,
  PhaseTimer,
  Cooldown,
  type PhaseHandler,
  type StateMachineConfig,
} from "./BaseStateMachine";

export { BasePool, type PooledSprite, type BasePoolConfig } from "./BasePool";

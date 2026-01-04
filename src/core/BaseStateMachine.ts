/**
 * BaseStateMachine - Generic state machine for phase-based entities
 *
 * Used by ChargerEnemy, BurrowerEnemy, and bosses for managing
 * attack phases, transitions, and timing.
 */

export interface PhaseHandler<TContext = unknown> {
  /** Called once when entering this phase */
  onEnter?: (context: TContext, time: number) => void
  /** Called every update tick while in this phase */
  onUpdate: (context: TContext, time: number, delta: number) => void
  /** Called once when exiting this phase */
  onExit?: (context: TContext, time: number) => void
}

export interface StateMachineConfig<TPhase extends string, TContext = unknown> {
  initialPhase: TPhase
  context?: TContext
}

/**
 * Generic state machine supporting typed phases
 */
export class StateMachine<TPhase extends string, TContext = unknown> {
  private currentPhase: TPhase
  private phaseStartTime: number = 0
  private handlers: Map<TPhase, PhaseHandler<TContext>> = new Map()
  private context: TContext

  constructor(config: StateMachineConfig<TPhase, TContext>) {
    this.currentPhase = config.initialPhase
    this.context = config.context ?? ({} as TContext)
  }

  /**
   * Register a phase handler
   */
  registerPhase(phase: TPhase, handler: PhaseHandler<TContext>): this {
    this.handlers.set(phase, handler)
    return this
  }

  /**
   * Register multiple phase handlers at once
   */
  registerPhases(phases: Record<TPhase, PhaseHandler<TContext>>): this {
    for (const [phase, handler] of Object.entries(phases) as [TPhase, PhaseHandler<TContext>][]) {
      this.handlers.set(phase, handler)
    }
    return this
  }

  /**
   * Transition to a new phase
   */
  transition(newPhase: TPhase, time: number): void {
    if (newPhase === this.currentPhase) return

    // Call exit handler for current phase
    const currentHandler = this.handlers.get(this.currentPhase)
    if (currentHandler?.onExit) {
      currentHandler.onExit(this.context, time)
    }

    // Update phase
    this.currentPhase = newPhase
    this.phaseStartTime = time

    // Call enter handler for new phase
    const newHandler = this.handlers.get(newPhase)
    if (newHandler?.onEnter) {
      newHandler.onEnter(this.context, time)
    }
  }

  /**
   * Update the current phase
   */
  update(time: number, delta: number): void {
    const handler = this.handlers.get(this.currentPhase)
    if (handler) {
      handler.onUpdate(this.context, time, delta)
    }
  }

  /**
   * Get the current phase
   */
  getPhase(): TPhase {
    return this.currentPhase
  }

  /**
   * Get time elapsed since phase started
   */
  getPhaseElapsed(currentTime: number): number {
    return currentTime - this.phaseStartTime
  }

  /**
   * Get the phase start time
   */
  getPhaseStartTime(): number {
    return this.phaseStartTime
  }

  /**
   * Check if a specific amount of time has passed in the current phase
   */
  hasPhaseElapsed(duration: number, currentTime: number): boolean {
    return this.getPhaseElapsed(currentTime) >= duration
  }

  /**
   * Get the context object
   */
  getContext(): TContext {
    return this.context
  }

  /**
   * Update the context object
   */
  setContext(context: Partial<TContext>): void {
    this.context = { ...this.context, ...context }
  }

  /**
   * Reset the state machine to initial state
   */
  reset(phase: TPhase, time: number): void {
    this.currentPhase = phase
    this.phaseStartTime = time
  }
}

/**
 * Simple timer utility for phase-based timing
 */
export class PhaseTimer {
  private startTime: number = 0
  private duration: number

  constructor(duration: number) {
    this.duration = duration
  }

  start(currentTime: number): void {
    this.startTime = currentTime
  }

  isExpired(currentTime: number): boolean {
    return currentTime - this.startTime >= this.duration
  }

  getProgress(currentTime: number): number {
    const elapsed = currentTime - this.startTime
    return Math.min(elapsed / this.duration, 1)
  }

  getRemaining(currentTime: number): number {
    return Math.max(0, this.duration - (currentTime - this.startTime))
  }

  setDuration(duration: number): void {
    this.duration = duration
  }

  reset(): void {
    this.startTime = 0
  }
}

/**
 * Cooldown tracker utility
 */
export class Cooldown {
  private lastUsedTime: number = 0
  private duration: number

  constructor(duration: number) {
    this.duration = duration
  }

  /**
   * Check if cooldown is ready
   */
  isReady(currentTime: number): boolean {
    return currentTime - this.lastUsedTime >= this.duration
  }

  /**
   * Use the cooldown (starts the timer)
   */
  use(currentTime: number): void {
    this.lastUsedTime = currentTime
  }

  /**
   * Get remaining cooldown time
   */
  getRemaining(currentTime: number): number {
    return Math.max(0, this.duration - (currentTime - this.lastUsedTime))
  }

  /**
   * Get progress towards ready (0-1)
   */
  getProgress(currentTime: number): number {
    return Math.min((currentTime - this.lastUsedTime) / this.duration, 1)
  }

  /**
   * Set cooldown duration
   */
  setDuration(duration: number): void {
    this.duration = duration
  }

  /**
   * Reset cooldown (make it immediately ready)
   */
  reset(): void {
    this.lastUsedTime = 0
  }

  /**
   * Force cooldown to start from now
   */
  trigger(currentTime: number): void {
    this.lastUsedTime = currentTime
  }
}

export default StateMachine

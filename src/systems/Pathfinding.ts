import Phaser from 'phaser'
import type Wall from '../entities/Wall'
import type WallGroup from './WallGroup'

/**
 * Result of pathfinding calculation
 */
export interface PathfindingResult {
  /** Velocity X component */
  vx: number
  /** Velocity Y component */
  vy: number
  /** Whether a clear path to target exists */
  hasDirectPath: boolean
}

/**
 * Configuration for pathfinding behavior
 */
export interface PathfindingConfig {
  /** Number of rays to cast for obstacle detection (default: 16) */
  rayCount?: number
  /** Distance ahead to check for obstacles (default: 60) */
  rayLength?: number
  /** Padding around obstacles for safety margin (default: 25) */
  obstaclePadding?: number
  /** How strongly to avoid obstacles (0-1, default: 0.6) */
  avoidanceWeight?: number
  /** How strongly to seek the target (0-1, default: 0.4) */
  seekWeight?: number
  /** Smoothing factor for direction changes (0-1, default: 0.2) */
  smoothing?: number
}

const DEFAULT_CONFIG: Required<PathfindingConfig> = {
  rayCount: 16,
  rayLength: 60,
  obstaclePadding: 25,
  avoidanceWeight: 0.6,
  seekWeight: 0.4,
  smoothing: 0.2,
}

/**
 * Context-based steering pathfinding system with momentum and progress tracking
 *
 * Key improvements over naive context steering:
 * 1. Direction momentum prevents oscillation between similar-scoring directions
 * 2. Progress tracking detects circular movement (not just stopped movement)
 * 3. Corner detection triggers more aggressive escape behavior
 * 4. Multi-waypoint paths for complex obstacle navigation
 */
export class Pathfinder {
  protected config: Required<PathfindingConfig>
  protected wallGroup: WallGroup | null = null

  // Cached arrays for performance
  private rayAngles: number[] = []
  private interestMap: number[] = []
  private dangerMap: number[] = []

  // Smooth steering state with momentum
  private currentAngle: number = 0
  private initialized: boolean = false
  private lastChosenIndex: number = 0 // For momentum/hysteresis

  constructor(config?: PathfindingConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initRayAngles()
  }

  /**
   * Pre-calculate ray angles for context steering
   */
  private initRayAngles(): void {
    this.rayAngles = []
    this.interestMap = []
    this.dangerMap = []

    for (let i = 0; i < this.config.rayCount; i++) {
      const angle = (i / this.config.rayCount) * Math.PI * 2
      this.rayAngles.push(angle)
      this.interestMap.push(0)
      this.dangerMap.push(0)
    }
  }

  /**
   * Set the wall group for collision detection
   */
  setWallGroup(wallGroup: WallGroup): void {
    this.wallGroup = wallGroup
  }

  /**
   * Calculate the best movement direction using context steering
   */
  calculateMovement(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    speed: number
  ): PathfindingResult {
    // Initialize current angle on first call
    if (!this.initialized) {
      this.currentAngle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY)
      this.initialized = true
    }

    // Target direction
    const targetAngle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY)

    // Check if direct path is clear
    const hasDirectPath = !this.isPathBlocked(fromX, fromY, targetX, targetY)

    // If no walls, just move directly
    if (!this.wallGroup || this.wallGroup.getWalls().length === 0) {
      this.currentAngle = this.lerpAngle(this.currentAngle, targetAngle, this.config.smoothing)
      return {
        vx: Math.cos(this.currentAngle) * speed,
        vy: Math.sin(this.currentAngle) * speed,
        hasDirectPath: true,
      }
    }

    // If direct path is clear and not too close to walls, go straight
    if (hasDirectPath && !this.isNearWall(fromX, fromY)) {
      this.currentAngle = this.lerpAngle(this.currentAngle, targetAngle, this.config.smoothing)
      return {
        vx: Math.cos(this.currentAngle) * speed,
        vy: Math.sin(this.currentAngle) * speed,
        hasDirectPath: true,
      }
    }

    // Build interest and danger maps
    const blockedCount = this.buildContextMaps(fromX, fromY, targetAngle)

    // Detect if in corner (many directions blocked)
    const inCorner = blockedCount >= this.config.rayCount * 0.4

    // Find the best direction with momentum consideration
    const bestAngle = this.selectBestDirectionWithMomentum(inCorner)

    // Use adaptive smoothing - less smoothing when in trouble
    const adaptiveSmoothing = inCorner ? this.config.smoothing * 2 : this.config.smoothing
    this.currentAngle = this.lerpAngle(this.currentAngle, bestAngle, adaptiveSmoothing)

    return {
      vx: Math.cos(this.currentAngle) * speed,
      vy: Math.sin(this.currentAngle) * speed,
      hasDirectPath,
    }
  }

  /**
   * Check if position is near any wall (for early avoidance)
   */
  private isNearWall(x: number, y: number): boolean {
    if (!this.wallGroup) return false
    const walls = this.wallGroup.getWalls()
    const nearDistance = 40

    for (const wall of walls) {
      const halfWidth = wall.width / 2 + nearDistance
      const halfHeight = wall.height / 2 + nearDistance

      if (
        x >= wall.x - halfWidth &&
        x <= wall.x + halfWidth &&
        y >= wall.y - halfHeight &&
        y <= wall.y + halfHeight
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Build context maps and return count of blocked directions
   */
  private buildContextMaps(fromX: number, fromY: number, targetAngle: number): number {
    const walls = this.wallGroup?.getWalls() ?? []
    let blockedCount = 0

    for (let i = 0; i < this.config.rayCount; i++) {
      const rayAngle = this.rayAngles[i]

      // Interest: How much this direction aligns with target direction
      const angleDiff = this.normalizeAngle(rayAngle - targetAngle)
      this.interestMap[i] = Math.cos(angleDiff) * 0.5 + 0.5 // Normalize to 0-1

      // Danger: Cast ray and check for obstacles
      this.dangerMap[i] = this.castRay(fromX, fromY, rayAngle, walls)

      if (this.dangerMap[i] > 0.5) {
        blockedCount++
      }
    }

    return blockedCount
  }

  /**
   * Cast a ray and return danger value (0 = clear, 1 = blocked)
   */
  private castRay(fromX: number, fromY: number, angle: number, walls: Wall[]): number {
    const rayLength = this.config.rayLength
    const padding = this.config.obstaclePadding

    // Check multiple points along the ray
    const checkPoints = [0.25, 0.5, 0.75, 1.0]
    let maxDanger = 0

    for (const t of checkPoints) {
      const checkX = fromX + Math.cos(angle) * rayLength * t
      const checkY = fromY + Math.sin(angle) * rayLength * t

      for (const wall of walls) {
        const halfWidth = wall.width / 2 + padding
        const halfHeight = wall.height / 2 + padding

        if (
          checkX >= wall.x - halfWidth &&
          checkX <= wall.x + halfWidth &&
          checkY >= wall.y - halfHeight &&
          checkY <= wall.y + halfHeight
        ) {
          // Danger is higher for closer obstacles
          const danger = 1.0 - t * 0.5
          maxDanger = Math.max(maxDanger, danger)
        }
      }
    }

    return maxDanger
  }

  /**
   * Select best direction with momentum to prevent oscillation
   */
  private selectBestDirectionWithMomentum(inCorner: boolean): number {
    let bestScore = -Infinity
    let bestIndex = 0

    // Momentum bonus - prefer continuing in current direction
    const momentumBonus = inCorner ? 0.15 : 0.25

    for (let i = 0; i < this.config.rayCount; i++) {
      const danger = this.dangerMap[i]
      const interest = this.interestMap[i]

      // Skip completely blocked directions
      if (danger >= 0.95) continue

      // Base score: weighted combination of interest and safety
      const safety = 1 - danger
      let score = interest * this.config.seekWeight + safety * this.config.avoidanceWeight

      // Momentum bonus for directions close to last chosen direction
      const indexDiff = Math.min(
        Math.abs(i - this.lastChosenIndex),
        this.config.rayCount - Math.abs(i - this.lastChosenIndex)
      )
      if (indexDiff <= 2) {
        score += momentumBonus * (1 - indexDiff / 2)
      }

      // In corners, heavily penalize directions that don't make progress
      if (inCorner && interest < 0.3 && safety < 0.8) {
        score *= 0.5
      }

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    // Fallback: if no good direction found, find least dangerous
    if (bestScore <= 0) {
      let minDanger = Infinity
      for (let i = 0; i < this.config.rayCount; i++) {
        // Prefer directions somewhat toward target even when escaping
        const adjustedDanger = this.dangerMap[i] - this.interestMap[i] * 0.2
        if (adjustedDanger < minDanger) {
          minDanger = adjustedDanger
          bestIndex = i
        }
      }
    }

    this.lastChosenIndex = bestIndex
    return this.rayAngles[bestIndex]
  }

  /**
   * Check if a straight path between two points is blocked
   */
  protected isPathBlocked(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): boolean {
    if (!this.wallGroup) return false

    const walls = this.wallGroup.getWalls()
    const padding = this.config.obstaclePadding

    const steps = 5
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const checkX = fromX + (toX - fromX) * t
      const checkY = fromY + (toY - fromY) * t

      for (const wall of walls) {
        const halfWidth = wall.width / 2 + padding
        const halfHeight = wall.height / 2 + padding

        if (
          checkX >= wall.x - halfWidth &&
          checkX <= wall.x + halfWidth &&
          checkY >= wall.y - halfHeight &&
          checkY <= wall.y + halfHeight
        ) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Linearly interpolate between two angles (handling wraparound)
   */
  protected lerpAngle(from: number, to: number, t: number): number {
    from = this.normalizeAngle(from)
    to = this.normalizeAngle(to)

    let diff = to - from

    if (diff > Math.PI) {
      diff -= Math.PI * 2
    } else if (diff < -Math.PI) {
      diff += Math.PI * 2
    }

    return this.normalizeAngle(from + diff * t)
  }

  /**
   * Normalize angle to -PI to PI range
   */
  protected normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2
    while (angle < -Math.PI) angle += Math.PI * 2
    return angle
  }

  /**
   * Reset the pathfinder state
   */
  reset(): void {
    this.initialized = false
    this.currentAngle = 0
    this.lastChosenIndex = 0
  }
}

/**
 * Advanced pathfinder with progress tracking and multi-waypoint navigation
 *
 * Detects when enemy is circling (making no progress toward target)
 * and generates a path of waypoints to escape and reach the target.
 */
export class WaypointPathfinder extends Pathfinder {
  private waypoints: { x: number; y: number }[] = []
  private currentWaypointIndex: number = 0

  // Progress tracking - detects circular movement
  private lastDistanceToTarget: number = Infinity
  private noProgressFrames: number = 0
  private readonly NO_PROGRESS_THRESHOLD = 30 // ~0.5 seconds at 60fps

  // Position tracking for stuck detection
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 }
  private stuckFrames: number = 0
  private readonly STUCK_THRESHOLD = 15
  private readonly STUCK_DISTANCE = 1.5

  // Escape mode - when truly stuck
  private escapeMode: boolean = false
  private escapeAngle: number = 0
  private escapeFrames: number = 0
  private readonly ESCAPE_DURATION = 20

  /**
   * Calculate movement with progress tracking and waypoint fallback
   */
  calculateMovementWithWaypoints(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    speed: number,
    worldBounds: Phaser.Geom.Rectangle
  ): PathfindingResult {
    const distToTarget = Phaser.Math.Distance.Between(fromX, fromY, targetX, targetY)

    // === ESCAPE MODE: Override everything when truly stuck ===
    if (this.escapeMode) {
      this.escapeFrames++
      if (this.escapeFrames >= this.ESCAPE_DURATION) {
        this.escapeMode = false
        this.escapeFrames = 0
      } else {
        // Move in escape direction
        return {
          vx: Math.cos(this.escapeAngle) * speed,
          vy: Math.sin(this.escapeAngle) * speed,
          hasDirectPath: false,
        }
      }
    }

    // === STUCK DETECTION: Not moving at all ===
    const dx = fromX - this.lastPosition.x
    const dy = fromY - this.lastPosition.y
    const distMoved = Math.sqrt(dx * dx + dy * dy)

    if (distMoved < this.STUCK_DISTANCE) {
      this.stuckFrames++
    } else {
      this.stuckFrames = 0
    }

    // If truly stuck (not moving), enter escape mode
    if (this.stuckFrames > this.STUCK_THRESHOLD) {
      this.triggerEscape(fromX, fromY, targetX, targetY, worldBounds)
      this.stuckFrames = 0
    }

    // === PROGRESS TRACKING: Detect circular movement ===
    if (distToTarget >= this.lastDistanceToTarget - 1) {
      // Not making progress toward target
      this.noProgressFrames++
    } else {
      // Making progress - reset counter and clear waypoints if we have direct path
      this.noProgressFrames = 0
      const result = super.calculateMovement(fromX, fromY, targetX, targetY, speed)
      if (result.hasDirectPath && this.waypoints.length > 0) {
        this.waypoints = []
        this.currentWaypointIndex = 0
      }
    }

    this.lastDistanceToTarget = distToTarget
    this.lastPosition = { x: fromX, y: fromY }

    // If no progress for too long, generate waypoints
    if (this.noProgressFrames > this.NO_PROGRESS_THRESHOLD && this.waypoints.length === 0) {
      this.generateMultiWaypoints(fromX, fromY, targetX, targetY, worldBounds)
      this.noProgressFrames = 0
    }

    // === WAYPOINT NAVIGATION ===
    if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
      const waypoint = this.waypoints[this.currentWaypointIndex]
      const distToWaypoint = Phaser.Math.Distance.Between(fromX, fromY, waypoint.x, waypoint.y)

      // Reached waypoint - move to next
      if (distToWaypoint < 25) {
        this.currentWaypointIndex++
        if (this.currentWaypointIndex >= this.waypoints.length) {
          this.waypoints = []
          this.currentWaypointIndex = 0
        }
      }

      // Navigate to current waypoint
      if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
        const wp = this.waypoints[this.currentWaypointIndex]
        return super.calculateMovement(fromX, fromY, wp.x, wp.y, speed)
      }
    }

    // === DEFAULT: Context steering toward target ===
    return super.calculateMovement(fromX, fromY, targetX, targetY, speed)
  }

  /**
   * Trigger escape mode - pick a clear direction and commit to it
   */
  private triggerEscape(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    worldBounds: Phaser.Geom.Rectangle
  ): void {
    const directAngle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY)

    // Try angles in order of preference (toward target first, then perpendicular)
    const escapeAngles = [
      directAngle,                    // Toward target
      directAngle + Math.PI / 4,      // 45° left
      directAngle - Math.PI / 4,      // 45° right
      directAngle + Math.PI / 2,      // 90° left
      directAngle - Math.PI / 2,      // 90° right
      directAngle + Math.PI * 3 / 4,  // 135° left
      directAngle - Math.PI * 3 / 4,  // 135° right
      directAngle + Math.PI,          // Away from target (last resort)
    ]

    const escapeDistance = 50

    for (const angle of escapeAngles) {
      const testX = fromX + Math.cos(angle) * escapeDistance
      const testY = fromY + Math.sin(angle) * escapeDistance

      // Check bounds
      if (
        testX < worldBounds.left + 20 ||
        testX > worldBounds.right - 20 ||
        testY < worldBounds.top + 20 ||
        testY > worldBounds.bottom - 20
      ) {
        continue
      }

      // Check if path is relatively clear
      if (!this.isPathBlocked(fromX, fromY, testX, testY)) {
        this.escapeMode = true
        this.escapeAngle = angle
        this.escapeFrames = 0
        return
      }
    }

    // Fallback: just pick perpendicular to target
    this.escapeMode = true
    this.escapeAngle = directAngle + Math.PI / 2
    this.escapeFrames = 0
  }

  /**
   * Generate multiple waypoints to navigate around obstacles
   */
  private generateMultiWaypoints(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    worldBounds: Phaser.Geom.Rectangle
  ): void {
    const directAngle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY)
    const distToTarget = Phaser.Math.Distance.Between(fromX, fromY, targetX, targetY)

    // Try both perpendicular directions
    const leftAngle = directAngle + Math.PI / 2
    const rightAngle = directAngle - Math.PI / 2

    const leftPath = this.tryGeneratePath(fromX, fromY, targetX, targetY, leftAngle, worldBounds, distToTarget)
    const rightPath = this.tryGeneratePath(fromX, fromY, targetX, targetY, rightAngle, worldBounds, distToTarget)

    // Pick the better path (shorter or more waypoints found)
    if (leftPath.length > 0 && (rightPath.length === 0 || leftPath.length <= rightPath.length)) {
      this.waypoints = leftPath
    } else if (rightPath.length > 0) {
      this.waypoints = rightPath
    } else {
      // Fallback: single waypoint in any clear perpendicular direction
      this.generateFallbackWaypoint(fromX, fromY, directAngle, worldBounds)
    }

    this.currentWaypointIndex = 0
  }

  /**
   * Try to generate a path going around one side of the obstacle
   */
  private tryGeneratePath(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    sideAngle: number,
    worldBounds: Phaser.Geom.Rectangle,
    _distToTarget: number
  ): { x: number; y: number }[] {
    const waypoints: { x: number; y: number }[] = []
    const stepDistance = 60
    const maxWaypoints = 3

    let currentX = fromX
    let currentY = fromY

    for (let i = 0; i < maxWaypoints; i++) {
      // Move perpendicular
      const wpX = currentX + Math.cos(sideAngle) * stepDistance
      const wpY = currentY + Math.sin(sideAngle) * stepDistance

      // Check bounds
      if (
        wpX < worldBounds.left + 30 ||
        wpX > worldBounds.right - 30 ||
        wpY < worldBounds.top + 30 ||
        wpY > worldBounds.bottom - 30
      ) {
        break
      }

      // Check if position is clear
      if (this.isPositionBlocked(wpX, wpY)) {
        break
      }

      // Check if we can reach it from current position
      if (!this.isPathBlocked(currentX, currentY, wpX, wpY)) {
        waypoints.push({ x: wpX, y: wpY })
        currentX = wpX
        currentY = wpY

        // Check if we now have a clear path to target
        if (!this.isPathBlocked(wpX, wpY, targetX, targetY)) {
          break // Success!
        }
      } else {
        break
      }
    }

    return waypoints
  }

  /**
   * Generate a single fallback waypoint when path generation fails
   */
  private generateFallbackWaypoint(
    fromX: number,
    fromY: number,
    directAngle: number,
    worldBounds: Phaser.Geom.Rectangle
  ): void {
    const angles = [
      directAngle + Math.PI / 2,
      directAngle - Math.PI / 2,
      directAngle + Math.PI / 4,
      directAngle - Math.PI / 4,
      directAngle + Math.PI * 3 / 4,
      directAngle - Math.PI * 3 / 4,
    ]

    for (const angle of angles) {
      const wpX = fromX + Math.cos(angle) * 70
      const wpY = fromY + Math.sin(angle) * 70

      if (
        wpX >= worldBounds.left + 30 &&
        wpX <= worldBounds.right - 30 &&
        wpY >= worldBounds.top + 30 &&
        wpY <= worldBounds.bottom - 30 &&
        !this.isPositionBlocked(wpX, wpY) &&
        !this.isPathBlocked(fromX, fromY, wpX, wpY)
      ) {
        this.waypoints = [{ x: wpX, y: wpY }]
        return
      }
    }
  }

  /**
   * Check if a position is blocked by any wall
   */
  private isPositionBlocked(x: number, y: number): boolean {
    if (!this.wallGroup) return false

    const walls = this.wallGroup.getWalls()
    const padding = 30

    for (const wall of walls) {
      const halfWidth = wall.width / 2 + padding
      const halfHeight = wall.height / 2 + padding

      if (
        x >= wall.x - halfWidth &&
        x <= wall.x + halfWidth &&
        y >= wall.y - halfHeight &&
        y <= wall.y + halfHeight
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Reset pathfinder state
   */
  override reset(): void {
    super.reset()
    this.waypoints = []
    this.currentWaypointIndex = 0
    this.lastDistanceToTarget = Infinity
    this.noProgressFrames = 0
    this.lastPosition = { x: 0, y: 0 }
    this.stuckFrames = 0
    this.escapeMode = false
    this.escapeFrames = 0
  }
}

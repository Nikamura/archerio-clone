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
  /** How strongly to avoid obstacles (0-1, default: 0.7) */
  avoidanceWeight?: number
  /** How strongly to seek the target (0-1, default: 0.3) */
  seekWeight?: number
  /** Smoothing factor for direction changes (0-1, default: 0.15) */
  smoothing?: number
}

const DEFAULT_CONFIG: Required<PathfindingConfig> = {
  rayCount: 16,
  rayLength: 60,
  obstaclePadding: 25,
  avoidanceWeight: 0.7,
  seekWeight: 0.3,
  smoothing: 0.15,
}

/**
 * Context-based steering pathfinding system
 *
 * Uses a combination of:
 * 1. Ray-casting for obstacle detection
 * 2. Context steering (interest vs danger maps)
 * 3. Smooth direction interpolation
 *
 * This approach is more efficient than A* for real-time games with many agents
 * and provides smoother, more natural-looking movement.
 */
export class Pathfinder {
  private config: Required<PathfindingConfig>
  private wallGroup: WallGroup | null = null

  // Cached arrays for performance
  private rayAngles: number[] = []
  private interestMap: number[] = []
  private dangerMap: number[] = []

  // Smooth steering state
  private currentAngle: number = 0
  private initialized: boolean = false

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
   *
   * @param fromX Current X position
   * @param fromY Current Y position
   * @param targetX Target X position (usually player)
   * @param targetY Target Y position
   * @param speed Movement speed
   * @returns Velocity components and path status
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

    // Build interest and danger maps
    this.buildContextMaps(fromX, fromY, targetAngle)

    // Find the best direction by combining interest and danger
    const bestAngle = this.selectBestDirection()

    // Smooth the direction change
    this.currentAngle = this.lerpAngle(this.currentAngle, bestAngle, this.config.smoothing)

    return {
      vx: Math.cos(this.currentAngle) * speed,
      vy: Math.sin(this.currentAngle) * speed,
      hasDirectPath,
    }
  }

  /**
   * Build the interest (attraction to target) and danger (obstacle avoidance) maps
   */
  private buildContextMaps(fromX: number, fromY: number, targetAngle: number): void {
    const walls = this.wallGroup?.getWalls() ?? []

    for (let i = 0; i < this.config.rayCount; i++) {
      const rayAngle = this.rayAngles[i]

      // Interest: How much this direction aligns with target direction
      // Use dot product concept: cos(angle difference) gives 1 for same direction, -1 for opposite
      const angleDiff = this.normalizeAngle(rayAngle - targetAngle)
      this.interestMap[i] = Math.cos(angleDiff) * 0.5 + 0.5 // Normalize to 0-1

      // Danger: Cast ray and check for obstacles
      this.dangerMap[i] = this.castRay(fromX, fromY, rayAngle, walls)
    }
  }

  /**
   * Cast a ray and return danger value (0 = clear, 1 = blocked)
   */
  private castRay(fromX: number, fromY: number, angle: number, walls: Wall[]): number {
    const rayLength = this.config.rayLength
    const padding = this.config.obstaclePadding

    // Check multiple points along the ray for more accurate detection
    const checkPoints = [0.3, 0.6, 1.0] // Check at 30%, 60%, and 100% of ray length

    for (const t of checkPoints) {
      const checkX = fromX + Math.cos(angle) * rayLength * t
      const checkY = fromY + Math.sin(angle) * rayLength * t

      // Check against each wall
      for (const wall of walls) {
        const halfWidth = wall.width / 2 + padding
        const halfHeight = wall.height / 2 + padding

        if (
          checkX >= wall.x - halfWidth &&
          checkX <= wall.x + halfWidth &&
          checkY >= wall.y - halfHeight &&
          checkY <= wall.y + halfHeight
        ) {
          // Danger increases the closer the obstacle is
          return 1.0 - t * 0.3 // Earlier hits are more dangerous
        }
      }
    }

    return 0 // Clear path
  }

  /**
   * Select the best direction based on combined interest and danger maps
   */
  private selectBestDirection(): number {
    let bestScore = -Infinity
    let bestIndex = 0

    for (let i = 0; i < this.config.rayCount; i++) {
      // Combine interest (want to go this way) with inverse danger (don't want to go toward obstacles)
      const interest = this.interestMap[i] * this.config.seekWeight
      const safety = (1 - this.dangerMap[i]) * this.config.avoidanceWeight

      // Boost score for directions that are both interesting AND safe
      const score = interest * safety + safety * 0.3 // Prioritize safety slightly

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    // If all directions are dangerous, find the least dangerous one
    if (bestScore <= 0) {
      let minDanger = Infinity
      for (let i = 0; i < this.config.rayCount; i++) {
        if (this.dangerMap[i] < minDanger) {
          minDanger = this.dangerMap[i]
          bestIndex = i
        }
      }
    }

    return this.rayAngles[bestIndex]
  }

  /**
   * Check if a straight path between two points is blocked by any wall
   */
  private isPathBlocked(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): boolean {
    if (!this.wallGroup) return false

    const walls = this.wallGroup.getWalls()
    const padding = this.config.obstaclePadding

    // Check multiple points along the line
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
  private lerpAngle(from: number, to: number, t: number): number {
    // Normalize both angles
    from = this.normalizeAngle(from)
    to = this.normalizeAngle(to)

    // Find the shortest rotation direction
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
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2
    while (angle < -Math.PI) angle += Math.PI * 2
    return angle
  }

  /**
   * Reset the pathfinder state (call when enemy is repositioned)
   */
  reset(): void {
    this.initialized = false
    this.currentAngle = 0
  }
}

/**
 * Advanced pathfinding with waypoint system for navigating around complex obstacles
 * Uses a simple grid-based approach when context steering gets stuck
 */
export class WaypointPathfinder extends Pathfinder {
  private waypoints: { x: number; y: number }[] = []
  private currentWaypointIndex: number = 0
  private stuckCounter: number = 0
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 }
  private readonly STUCK_THRESHOLD = 10 // Frames without movement
  private readonly STUCK_DISTANCE = 2 // Minimum pixels to move per frame

  /**
   * Calculate movement with waypoint fallback for stuck situations
   */
  calculateMovementWithWaypoints(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    speed: number,
    worldBounds: Phaser.Geom.Rectangle
  ): PathfindingResult {
    // Check if stuck
    const dx = fromX - this.lastPosition.x
    const dy = fromY - this.lastPosition.y
    const distMoved = Math.sqrt(dx * dx + dy * dy)

    if (distMoved < this.STUCK_DISTANCE) {
      this.stuckCounter++
    } else {
      this.stuckCounter = 0
      // Clear waypoints if moving freely toward target
      if (this.waypoints.length > 0) {
        const distToTarget = Phaser.Math.Distance.Between(fromX, fromY, targetX, targetY)
        const result = super.calculateMovement(fromX, fromY, targetX, targetY, speed)
        if (result.hasDirectPath || distToTarget < 50) {
          this.waypoints = []
          this.currentWaypointIndex = 0
        }
      }
    }

    this.lastPosition = { x: fromX, y: fromY }

    // If stuck, generate waypoints around the obstacle
    if (this.stuckCounter > this.STUCK_THRESHOLD && this.waypoints.length === 0) {
      this.generateWaypoints(fromX, fromY, targetX, targetY, worldBounds)
      this.stuckCounter = 0
    }

    // If we have waypoints, navigate to them
    if (this.waypoints.length > 0) {
      const waypoint = this.waypoints[this.currentWaypointIndex]
      const distToWaypoint = Phaser.Math.Distance.Between(fromX, fromY, waypoint.x, waypoint.y)

      // Move to next waypoint if close enough
      if (distToWaypoint < 30) {
        this.currentWaypointIndex++
        if (this.currentWaypointIndex >= this.waypoints.length) {
          this.waypoints = []
          this.currentWaypointIndex = 0
        }
      }

      // Navigate toward current waypoint
      if (this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
        const wp = this.waypoints[this.currentWaypointIndex]
        return super.calculateMovement(fromX, fromY, wp.x, wp.y, speed)
      }
    }

    // Default: use context steering toward target
    return super.calculateMovement(fromX, fromY, targetX, targetY, speed)
  }

  /**
   * Generate waypoints to navigate around obstacles
   * Uses a simple "go around" approach - tries perpendicular directions
   */
  private generateWaypoints(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    worldBounds: Phaser.Geom.Rectangle
  ): void {
    const directAngle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY)
    const waypointDistance = 80 // Distance to waypoint

    // Try perpendicular directions first (left and right of blocked path)
    const perpAngles = [
      directAngle + Math.PI / 2,  // Left
      directAngle - Math.PI / 2,  // Right
      directAngle + Math.PI / 4,  // Slight left
      directAngle - Math.PI / 4,  // Slight right
      directAngle + Math.PI * 3/4, // Back-left
      directAngle - Math.PI * 3/4, // Back-right
    ]

    // Find a clear waypoint
    for (const angle of perpAngles) {
      const wpX = fromX + Math.cos(angle) * waypointDistance
      const wpY = fromY + Math.sin(angle) * waypointDistance

      // Check if waypoint is in bounds
      if (
        wpX < worldBounds.left + 30 ||
        wpX > worldBounds.right - 30 ||
        wpY < worldBounds.top + 30 ||
        wpY > worldBounds.bottom - 30
      ) {
        continue
      }

      // Check if waypoint is clear
      if (!this.isPositionBlocked(wpX, wpY)) {
        // Check if we can reach it
        if (!this.isPathBlockedBetween(fromX, fromY, wpX, wpY)) {
          this.waypoints = [{ x: wpX, y: wpY }]
          this.currentWaypointIndex = 0
          return
        }
      }
    }
  }

  /**
   * Check if a position is blocked by any wall
   */
  private isPositionBlocked(x: number, y: number): boolean {
    const wallGroup = (this as unknown as { wallGroup: WallGroup | null }).wallGroup
    if (!wallGroup) return false

    const walls = wallGroup.getWalls()
    const padding = 25

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
   * Check if path between two points is blocked
   */
  private isPathBlockedBetween(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): boolean {
    const wallGroup = (this as unknown as { wallGroup: WallGroup | null }).wallGroup
    if (!wallGroup) return false

    const walls = wallGroup.getWalls()
    const padding = 25
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
   * Reset pathfinder state including waypoints
   */
  override reset(): void {
    super.reset()
    this.waypoints = []
    this.currentWaypointIndex = 0
    this.stuckCounter = 0
    this.lastPosition = { x: 0, y: 0 }
  }
}

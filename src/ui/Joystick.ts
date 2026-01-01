import nipplejs, { JoystickManager, JoystickOutputData } from 'nipplejs'

// Joystick smoothing configuration
const JOYSTICK_CONFIG = {
  // Dead zone - ignore input below this threshold (0-1)
  DEAD_ZONE: 0.15,
  // Maximum force clamp (nipplejs can exceed 1.0)
  MAX_FORCE: 1.0,
  // Smoothing factor for lerping (0-1, lower = smoother but more lag)
  SMOOTHING: 0.25,
  // Angle smoothing uses slightly different factor for responsive direction changes
  ANGLE_SMOOTHING: 0.35,
}

export default class Joystick {
  private manager: JoystickManager | null = null
  private onMove: ((angle: number, force: number) => void) | null = null
  private onEnd: (() => void) | null = null
  private container: HTMLElement | null = null
  private joystickZone: HTMLElement | null = null

  // Smoothed values for interpolation
  private currentAngle: number = 0
  private currentForce: number = 0
  private targetAngle: number = 0
  private targetForce: number = 0
  private isActive: boolean = false

  // Animation frame for smooth updates
  private animationFrameId: number | null = null
  private lastUpdateTime: number = 0

  constructor(_scene: Phaser.Scene) {
    // Scene reference available if needed for future use
  }

  create(container: HTMLElement) {
    this.container = container
    // Ensure pointer events are enabled initially
    this.container.style.pointerEvents = 'auto'
    this.createJoystickZone()
    this.internalCreate()
    console.log('Joystick created')
  }

  /**
   * Create a dedicated zone element for the joystick on the left side of the screen
   * This prevents the joystick from capturing touches on UI elements on the right side
   */
  private createJoystickZone() {
    if (!this.container || this.joystickZone) return

    this.joystickZone = document.createElement('div')
    this.joystickZone.id = 'joystick-zone'
    this.joystickZone.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 70%;
      height: 100%;
      pointer-events: auto;
      touch-action: none;
      z-index: 1000;
    `
    this.container.appendChild(this.joystickZone)
  }

  private internalCreate() {
    if (!this.joystickZone) return

    // Create joystick on the dedicated left-side zone
    this.manager = nipplejs.create({
      zone: this.joystickZone,
      mode: 'dynamic',
      position: { left: '35%', top: '50%' },
      color: 'rgba(74, 158, 255, 0.5)',
      size: 120,
    })

    // Handle joystick movement - store target values for smoothing
    this.manager.on('move', (_evt, data: JoystickOutputData) => {
      if (data.angle && data.force !== undefined) {
        // Convert nipplejs angle to radians
        // nipplejs uses degrees where 0° is right, 90° is up
        this.targetAngle = data.angle.radian || 0

        // Clamp and apply dead zone to force
        let force = Math.min(data.force, JOYSTICK_CONFIG.MAX_FORCE)
        if (force < JOYSTICK_CONFIG.DEAD_ZONE) {
          force = 0
        } else {
          // Remap force from dead zone to 1.0 range for smoother feel
          force = (force - JOYSTICK_CONFIG.DEAD_ZONE) / (JOYSTICK_CONFIG.MAX_FORCE - JOYSTICK_CONFIG.DEAD_ZONE)
        }
        this.targetForce = force

        // Mark as active and start smoothing loop if not already running
        if (!this.isActive) {
          this.isActive = true
          this.startSmoothingLoop()
        }
      }
    })

    // Handle joystick end (released)
    this.manager.on('end', () => {
      // Set target force to 0 for smooth deceleration
      this.targetForce = 0
      this.isActive = false

      // Let the smoothing loop handle the fade-out, then call onEnd
      // The loop will call onEnd when force reaches near-zero
    })

    // Additional safety: listen for any touch end events on the container
    // This helps catch cases where nipplejs might miss the end event
    const handleTouchEnd = () => {
      // Small delay to let nipplejs process its own end event first
      window.setTimeout(() => {
        // Only trigger if there are no active touches
        if (!document.querySelector('.nipple')) {
          console.log('Joystick: Detected touch end without nipplejs end event, forcing reset')
          if (this.onEnd) {
            this.onEnd()
          }
        }
      }, 50)
    }

    this.joystickZone.addEventListener('touchend', handleTouchEnd)
    this.joystickZone.addEventListener('touchcancel', handleTouchEnd)

    // Store cleanup function for later
    ;(this.manager as any)._touchEndCleanup = () => {
      this.joystickZone?.removeEventListener('touchend', handleTouchEnd)
      this.joystickZone?.removeEventListener('touchcancel', handleTouchEnd)
    }
  }

  setOnMove(callback: (angle: number, force: number) => void) {
    this.onMove = callback
  }

  setOnEnd(callback: () => void) {
    this.onEnd = callback
  }

  hide() {
    // Stop smoothing loop first
    this.stopSmoothingLoop()
    this.isActive = false
    this.currentForce = 0
    this.targetForce = 0

    // For nipplejs, the most reliable way to stop it from capturing events
    // on the zone is to destroy it and recreate it later.
    if (this.manager) {
      console.log('Joystick: destroying manager to release input')
      // Trigger onEnd callback to reset joystick state before destroying
      if (this.onEnd) {
        this.onEnd()
      }

      // Clean up touch event listeners
      if ((this.manager as any)._touchEndCleanup) {
        ;(this.manager as any)._touchEndCleanup()
      }

      this.manager.destroy()
      this.manager = null
    }
    
    // CRITICAL: Remove any lingering nipplejs DOM elements
    // nipplejs creates DOM elements that might not be cleaned up properly
    if (this.joystickZone) {
      const nippleElements = this.joystickZone.querySelectorAll('.nipple, [class*="nipple"]')
      nippleElements.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
    }

    // Keep pointer events enabled so the Phaser canvas stays clickable on iOS
    if (this.container) {
      this.container.style.pointerEvents = 'auto'
    }
  }

  show() {
    if (!this.manager && this.joystickZone) {
      console.log('Joystick: recreating manager')
      this.internalCreate()
    }
  }

  destroy() {
    // Stop smoothing loop first
    this.stopSmoothingLoop()
    this.isActive = false

    if (this.manager) {
      // Clean up touch event listeners
      if ((this.manager as any)._touchEndCleanup) {
        ;(this.manager as any)._touchEndCleanup()
      }

      // Trigger onEnd callback to reset joystick state before destroying
      if (this.onEnd) {
        this.onEnd()
      }
      this.manager.destroy()
      this.manager = null
    }

    // CRITICAL: Remove any lingering nipplejs DOM elements
    // nipplejs creates DOM elements that might not be cleaned up properly
    if (this.joystickZone) {
      const nippleElements = this.joystickZone.querySelectorAll('.nipple, [class*="nipple"]')
      nippleElements.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
    }

    // Remove the joystick zone element
    if (this.joystickZone && this.joystickZone.parentNode) {
      this.joystickZone.parentNode.removeChild(this.joystickZone)
      this.joystickZone = null
    }

    this.container = null
  }

  /**
   * Start the smoothing update loop
   * Uses requestAnimationFrame for frame-rate independent smoothing
   */
  private startSmoothingLoop() {
    // Don't start multiple loops
    if (this.animationFrameId !== null) return

    this.lastUpdateTime = window.performance.now()
    this.updateSmoothing()
  }

  /**
   * Stop the smoothing update loop
   */
  private stopSmoothingLoop() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Smoothing update loop - interpolates between current and target values
   */
  private updateSmoothing = () => {
    const now = window.performance.now()
    const deltaTime = Math.min((now - this.lastUpdateTime) / 16.67, 2) // Normalize to 60fps, cap at 2x
    this.lastUpdateTime = now

    // Calculate frame-adjusted smoothing factors
    const forceSmoothingFactor = 1 - Math.pow(1 - JOYSTICK_CONFIG.SMOOTHING, deltaTime)
    const angleSmoothingFactor = 1 - Math.pow(1 - JOYSTICK_CONFIG.ANGLE_SMOOTHING, deltaTime)

    // Lerp force towards target
    this.currentForce += (this.targetForce - this.currentForce) * forceSmoothingFactor

    // Only lerp angle if there's meaningful force (avoid spinning when idle)
    if (this.targetForce > 0.01) {
      // Handle angle wrapping for smooth rotation
      let angleDiff = this.targetAngle - this.currentAngle

      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

      this.currentAngle += angleDiff * angleSmoothingFactor

      // Keep current angle normalized
      while (this.currentAngle > Math.PI) this.currentAngle -= Math.PI * 2
      while (this.currentAngle < -Math.PI) this.currentAngle += Math.PI * 2
    }

    // Emit smoothed values to callback
    if (this.onMove) {
      this.onMove(this.currentAngle, this.currentForce)
    }

    // Check if we should stop the loop
    const forceDiff = Math.abs(this.targetForce - this.currentForce)
    const isNearTarget = forceDiff < 0.01 && this.targetForce < 0.01

    if (isNearTarget && !this.isActive) {
      // Joystick released and we've decelerated to near-zero
      this.currentForce = 0
      if (this.onMove) {
        this.onMove(this.currentAngle, 0)
      }
      if (this.onEnd) {
        this.onEnd()
      }
      this.stopSmoothingLoop()
      return
    }

    // Continue loop
    this.animationFrameId = window.requestAnimationFrame(this.updateSmoothing)
  }

  /**
   * Force reset the joystick state
   * Useful for recovering from stuck input states
   */
  reset() {
    // Stop smoothing loop
    this.stopSmoothingLoop()

    // Reset all state
    this.currentAngle = 0
    this.currentForce = 0
    this.targetAngle = 0
    this.targetForce = 0
    this.isActive = false

    // Notify callbacks
    if (this.onMove) {
      this.onMove(0, 0)
    }
    if (this.onEnd) {
      this.onEnd()
    }
  }
}

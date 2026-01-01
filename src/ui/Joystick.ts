import nipplejs, { JoystickManager, JoystickOutputData } from 'nipplejs'

// Joystick configuration
const JOYSTICK_CONFIG = {
  // Dead zone - ignore input below this threshold (0-1)
  DEAD_ZONE: 0.15,
  // Maximum force clamp (nipplejs can exceed 1.0)
  MAX_FORCE: 1.0,
}

export default class Joystick {
  private manager: JoystickManager | null = null
  private onMove: ((angle: number, force: number) => void) | null = null
  private onEnd: (() => void) | null = null
  private container: HTMLElement | null = null
  private joystickZone: HTMLElement | null = null

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
      width: 100%;
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

    // Handle joystick movement - call callback directly (no smoothing)
    this.manager.on('move', (_evt, data: JoystickOutputData) => {
      if (data.angle && data.force !== undefined) {
        // Convert nipplejs angle to radians
        const angle = data.angle.radian || 0

        // Clamp and apply dead zone to force
        let force = Math.min(data.force, JOYSTICK_CONFIG.MAX_FORCE)
        if (force < JOYSTICK_CONFIG.DEAD_ZONE) {
          force = 0
        } else {
          // Remap force from dead zone to 1.0 range
          force = (force - JOYSTICK_CONFIG.DEAD_ZONE) / (JOYSTICK_CONFIG.MAX_FORCE - JOYSTICK_CONFIG.DEAD_ZONE)
        }

        if (this.onMove) {
          this.onMove(angle, force)
        }
      }
    })

    // Handle joystick end (released)
    this.manager.on('end', () => {
      if (this.onEnd) {
        this.onEnd()
      }
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

    // CRITICAL: Disable pointer events on the joystick zone so it doesn't block the canvas
    if (this.joystickZone) {
      this.joystickZone.style.pointerEvents = 'none'
    }

    // Keep pointer events enabled on container so the Phaser canvas stays clickable on iOS
    if (this.container) {
      this.container.style.pointerEvents = 'auto'
    }
  }

  show() {
    // Re-enable pointer events on the joystick zone
    if (this.joystickZone) {
      this.joystickZone.style.pointerEvents = 'auto'
    }

    if (!this.manager && this.joystickZone) {
      console.log('Joystick: recreating manager')
      this.internalCreate()
    }
  }

  destroy() {
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
   * Force reset the joystick state
   * Useful for recovering from stuck input states
   */
  reset() {
    // Notify callbacks
    if (this.onMove) {
      this.onMove(0, 0)
    }
    if (this.onEnd) {
      this.onEnd()
    }
  }
}

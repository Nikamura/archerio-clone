import nipplejs, { JoystickManager, JoystickOutputData } from 'nipplejs'

export default class Joystick {
  private manager: JoystickManager | null = null
  private onMove: ((angle: number, force: number) => void) | null = null
  private onEnd: (() => void) | null = null
  private container: HTMLElement | null = null

  constructor(_scene: Phaser.Scene) {
    // Scene reference available if needed for future use
  }

  create(container: HTMLElement) {
    this.container = container
    this.internalCreate()
    console.log('Joystick created')
  }

  private internalCreate() {
    if (!this.container) return

    // Create joystick on left half of screen
    this.manager = nipplejs.create({
      zone: this.container,
      mode: 'dynamic',
      position: { left: '25%', top: '50%' },
      color: 'rgba(74, 158, 255, 0.5)',
      size: 120,
    })

    // Handle joystick movement
    this.manager.on('move', (_evt, data: JoystickOutputData) => {
      if (this.onMove && data.angle && data.force !== undefined) {
        // Convert nipplejs angle to radians
        // nipplejs uses degrees where 0° is right, 90° is up
        const angleRad = data.angle.radian || 0
        this.onMove(angleRad, data.force)
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

    this.container.addEventListener('touchend', handleTouchEnd)
    this.container.addEventListener('touchcancel', handleTouchEnd)

    // Store cleanup function for later
    ;(this.manager as any)._touchEndCleanup = () => {
      this.container?.removeEventListener('touchend', handleTouchEnd)
      this.container?.removeEventListener('touchcancel', handleTouchEnd)
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
      this.manager.destroy()
      this.manager = null
    }
  }

  show() {
    if (!this.manager && this.container) {
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
    this.container = null
  }

  /**
   * Force reset the joystick state
   * Useful for recovering from stuck input states
   */
  reset() {
    if (this.onEnd) {
      this.onEnd()
    }
  }
}

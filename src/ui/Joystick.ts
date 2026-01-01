import nipplejs, { JoystickManager, EventData } from 'nipplejs'

export default class Joystick {
  private manager: JoystickManager | null = null
  private scene: Phaser.Scene
  private onMove: ((angle: number, force: number) => void) | null = null
  private onEnd: (() => void) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(container: HTMLElement) {
    // Create joystick on left half of screen
    this.manager = nipplejs.create({
      zone: container,
      mode: 'dynamic',
      position: { left: '25%', top: '50%' },
      color: 'rgba(74, 158, 255, 0.5)',
      size: 120,
    })

    // Handle joystick movement
    this.manager.on('move', (evt: any, data: EventData) => {
      if (this.onMove && data.angle && data.force !== undefined) {
        // Convert nipplejs angle to radians
        // nipplejs uses degrees where 0° is right, 90° is up
        const angleRad = (data.angle.radian || 0)
        this.onMove(angleRad, data.force)
      }
    })

    // Handle joystick end (released)
    this.manager.on('end', () => {
      if (this.onEnd) {
        this.onEnd()
      }
    })

    console.log('Joystick created')
  }

  setOnMove(callback: (angle: number, force: number) => void) {
    this.onMove = callback
  }

  setOnEnd(callback: () => void) {
    this.onEnd = callback
  }

  destroy() {
    if (this.manager) {
      this.manager.destroy()
      this.manager = null
    }
  }
}

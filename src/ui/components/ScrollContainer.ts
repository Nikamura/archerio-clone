import Phaser from 'phaser'

/**
 * Configuration for ScrollContainer
 */
export interface ScrollContainerConfig {
  scene: Phaser.Scene
  x?: number
  y?: number
  width: number
  bounds: { top: number; bottom: number }
  onScroll?: (scrollY: number) => void
  depth?: number
}

/**
 * ScrollContainer - Reusable scrollable container component
 *
 * Provides a masked, scrollable container with touch and mouse wheel support.
 * Used across AchievementsScene, EquipmentScene, TalentsScene, SettingsScene,
 * ShopScene, EncyclopediaScene, and ChestScene.
 */
export class ScrollContainer {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private mask: Phaser.GameObjects.Graphics
  private geometryMask: Phaser.Display.Masks.GeometryMask

  private scrollY: number = 0
  private contentHeight: number = 0
  private isDragging: boolean = false
  private dragStartY: number = 0
  private scrollStartY: number = 0

  private bounds: { top: number; bottom: number }
  private width: number
  private onScrollCallback?: (scrollY: number) => void

  private scrollZone?: Phaser.GameObjects.Zone

  constructor(config: ScrollContainerConfig) {
    this.scene = config.scene
    this.bounds = config.bounds
    this.width = config.width
    this.onScrollCallback = config.onScroll

    const x = config.x ?? 0
    const y = config.y ?? 0

    // Create the container
    this.container = this.scene.add.container(x, y)
    if (config.depth !== undefined) {
      this.container.setDepth(config.depth)
    }

    // Create mask for the scrollable area
    const scrollAreaHeight = this.bounds.bottom - this.bounds.top
    this.mask = this.scene.add.graphics()
    this.mask.fillStyle(0xffffff)
    this.mask.fillRect(0, this.bounds.top, this.width, scrollAreaHeight)
    this.mask.setVisible(false)

    // Apply mask to container
    this.geometryMask = this.mask.createGeometryMask()
    this.container.setMask(this.geometryMask)

    // Setup scroll input
    this.setupScrollInput()
  }

  /**
   * Add a child to the scroll container
   */
  add(child: Phaser.GameObjects.GameObject): this {
    this.container.add(child)
    return this
  }

  /**
   * Add multiple children to the scroll container
   */
  addMultiple(children: Phaser.GameObjects.GameObject[]): this {
    this.container.add(children)
    return this
  }

  /**
   * Set the total content height for scroll calculations
   */
  setContentHeight(height: number): void {
    this.contentHeight = height
  }

  /**
   * Get the current scroll position
   */
  getScrollY(): number {
    return this.scrollY
  }

  /**
   * Scroll to a specific Y position
   */
  scrollTo(y: number): void {
    this.setScrollPosition(y)
  }

  /**
   * Get the underlying Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  /**
   * Get the visible scroll area height
   */
  getVisibleHeight(): number {
    return this.bounds.bottom - this.bounds.top
  }

  /**
   * Get the scroll bounds
   */
  getBounds(): { top: number; bottom: number } {
    return this.bounds
  }

  /**
   * Check if a Y position (in container coordinates) is currently visible
   */
  isVisible(containerY: number): boolean {
    const worldY = this.container.y + containerY
    return worldY >= this.bounds.top && worldY <= this.bounds.bottom
  }

  /**
   * Get the maximum scroll position
   */
  getMaxScroll(): number {
    const scrollAreaHeight = this.bounds.bottom - this.bounds.top
    return Math.max(0, this.contentHeight - scrollAreaHeight)
  }

  private setupScrollInput(): void {
    const scrollAreaHeight = this.bounds.bottom - this.bounds.top

    // Create an invisible interactive zone for the scroll area
    this.scrollZone = this.scene.add.zone(
      this.width / 2,
      this.bounds.top + scrollAreaHeight / 2,
      this.width,
      scrollAreaHeight
    )
    this.scrollZone.setInteractive()

    // Mouse wheel scrolling
    this.scene.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        this.scrollContent(deltaY * 0.5)
      }
    )

    // Touch/mouse drag scrolling
    this.scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartY = pointer.y
      this.scrollStartY = this.scrollY
    })

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const deltaY = this.dragStartY - pointer.y
        this.setScrollPosition(this.scrollStartY + deltaY)
      }
    })

    this.scene.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.scene.input.on('pointerupoutside', () => {
      this.isDragging = false
    })
  }

  private scrollContent(deltaY: number): void {
    this.setScrollPosition(this.scrollY + deltaY)
  }

  private setScrollPosition(newY: number): void {
    const maxScroll = this.getMaxScroll()

    // Clamp scroll position
    this.scrollY = Phaser.Math.Clamp(newY, 0, maxScroll)

    // Apply scroll position to container
    this.container.y = -this.scrollY

    // Notify callback
    if (this.onScrollCallback) {
      this.onScrollCallback(this.scrollY)
    }
  }

  /**
   * Destroy the scroll container and all its children
   */
  destroy(): void {
    // Remove input listeners
    this.scene.input.off('wheel')
    this.scene.input.off('pointermove')
    this.scene.input.off('pointerup')
    this.scene.input.off('pointerupoutside')

    // Destroy scroll zone
    if (this.scrollZone) {
      this.scrollZone.destroy()
    }

    // Destroy mask
    this.mask.destroy()

    // Destroy container
    this.container.destroy()
  }
}

export default ScrollContainer

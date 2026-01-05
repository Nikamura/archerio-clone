/**
 * CapacitorManager - Native app lifecycle and platform features
 *
 * Handles status bar, splash screen, app state changes, and platform-specific features.
 * Only active when running as a native app via Capacitor.
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

export class CapacitorManager {
  private static _instance: CapacitorManager
  private _initialized: boolean = false

  static get instance(): CapacitorManager {
    if (!CapacitorManager._instance) {
      CapacitorManager._instance = new CapacitorManager()
    }
    return CapacitorManager._instance
  }

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Check if running as a native app
   */
  isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  /**
   * Get the current platform ('ios', 'android', or 'web')
   */
  getPlatform(): string {
    return Capacitor.getPlatform()
  }

  /**
   * Initialize Capacitor features. Call this after the game has loaded.
   */
  async initialize(): Promise<void> {
    if (this._initialized || !this.isNative()) {
      return
    }

    this._initialized = true
    console.log(`CapacitorManager: Initializing on ${this.getPlatform()}`)

    try {
      // Configure status bar
      await this.configureStatusBar()

      // Set up app lifecycle listeners
      this.setupAppStateListener()
      this.setupBackButtonListener()

      // Hide splash screen after game is ready
      await this.hideSplashScreen()

      console.log('CapacitorManager: Initialization complete')
    } catch (error) {
      console.error('CapacitorManager: Initialization error', error)
    }
  }

  /**
   * Configure the status bar appearance
   */
  private async configureStatusBar(): Promise<void> {
    try {
      // Use dark content (light icons) on dark background
      await StatusBar.setStyle({ style: Style.Dark })

      // Set background color on Android
      if (this.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#000000' })
      }

      // Hide the status bar for full immersion (optional - uncomment if desired)
      // await StatusBar.hide()

      console.log('CapacitorManager: Status bar configured')
    } catch (error) {
      console.log('CapacitorManager: Could not configure status bar', error)
    }
  }

  /**
   * Hide the native splash screen
   */
  private async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide()
      console.log('CapacitorManager: Splash screen hidden')
    } catch (error) {
      console.log('CapacitorManager: Could not hide splash screen', error)
    }
  }

  /**
   * Set up listener for app state changes (foreground/background)
   */
  private setupAppStateListener(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      console.log(`CapacitorManager: App ${isActive ? 'resumed' : 'paused'}`)

      // Dispatch custom event for Phaser scenes to listen to
      window.dispatchEvent(
        new window.CustomEvent('capacitorAppStateChange', {
          detail: { isActive },
        })
      )

      // Also dispatch standard visibility events for compatibility
      if (!isActive) {
        // Simulate visibility hidden when app goes to background
        document.dispatchEvent(new window.Event('visibilitychange'))
      }
    })
  }

  /**
   * Set up listener for Android back button
   */
  private setupBackButtonListener(): void {
    App.addListener('backButton', ({ canGoBack }) => {
      console.log('CapacitorManager: Back button pressed', { canGoBack })

      // Dispatch custom event for Phaser scenes to handle
      window.dispatchEvent(
        new window.CustomEvent('capacitorBackButton', {
          detail: { canGoBack },
        })
      )

      // Default behavior: exit app if at root, otherwise let scenes handle navigation
      // Scenes can call event.preventDefault() on their handler to prevent default
    })
  }

  /**
   * Exit the app (Android only)
   */
  async exitApp(): Promise<void> {
    if (this.getPlatform() === 'android') {
      await App.exitApp()
    }
  }

  /**
   * Get app info
   */
  async getAppInfo(): Promise<{ name: string; id: string; build: string; version: string } | null> {
    if (!this.isNative()) {
      return null
    }

    try {
      return await App.getInfo()
    } catch {
      return null
    }
  }

  /**
   * Show the status bar (if it was hidden)
   */
  async showStatusBar(): Promise<void> {
    if (!this.isNative()) return
    try {
      await StatusBar.show()
    } catch {
      // Silently fail
    }
  }

  /**
   * Hide the status bar for full immersion
   */
  async hideStatusBar(): Promise<void> {
    if (!this.isNative()) return
    try {
      await StatusBar.hide()
    } catch {
      // Silently fail
    }
  }
}

export const capacitorManager = CapacitorManager.instance

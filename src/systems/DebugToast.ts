/* eslint-disable no-undef */
/**
 * DebugToast - Visual debug overlay for mobile testing
 * Activated via ?debug query parameter
 * Shows debug messages as toasts and logs touch/click events
 */

interface DebugMessage {
  id: number;
  text: string;
  element: HTMLDivElement;
  timeout: number;
}

class DebugToastManager {
  private static _instance: DebugToastManager;
  private container: HTMLDivElement | null = null;
  private messages: DebugMessage[] = [];
  private nextId = 0;
  private maxMessages = 8;
  private displayDuration = 3000; // 3 seconds
  private _enabled = false;

  static get instance(): DebugToastManager {
    if (!DebugToastManager._instance) {
      DebugToastManager._instance = new DebugToastManager();
    }
    return DebugToastManager._instance;
  }

  private constructor() {
    // Check for ?debug query parameter
    const urlParams = new URLSearchParams(window.location.search);
    this._enabled = urlParams.has("debug");

    if (this._enabled) {
      this.createContainer();
      this.show("🔧 Debug mode enabled");
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  private createContainer(): void {
    this.container = document.createElement("div");
    this.container.id = "debug-toast-container";
    this.container.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99998;
      pointer-events: none;
      width: 90%;
      max-width: 500px;
      display: flex;
      flex-direction: column-reverse;
      gap: 4px;
      font-family: monospace;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Show a debug message
   */
  show(text: string): void {
    if (!this._enabled || !this.container) return;

    // Remove oldest message if at max
    if (this.messages.length >= this.maxMessages) {
      const oldest = this.messages.shift();
      if (oldest) {
        this.removeMessage(oldest);
      }
    }

    // Create toast element
    const toast = document.createElement("div");
    toast.style.cssText = `
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      font-size: 11px;
      line-height: 1.3;
      word-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      animation: debugSlideIn 0.2s ease-out;
    `;

    toast.textContent = text;
    this.container.appendChild(toast);

    // Add animation styles if not present
    if (!document.getElementById("debug-toast-styles")) {
      const style = document.createElement("style");
      style.id = "debug-toast-styles";
      style.textContent = `
        @keyframes debugSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes debugSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
      `;
      document.head.appendChild(style);
    }

    // Store message
    const id = this.nextId++;
    const timeout = window.setTimeout(() => {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) {
        this.removeMessage(msg);
      }
    }, this.displayDuration);

    this.messages.push({
      id,
      text,
      element: toast,
      timeout,
    });
  }

  /**
   * Log a touch/pointer event with coordinates
   */
  logPointer(event: string, x: number, y: number, target?: string): void {
    const targetStr = target ? ` [${target}]` : "";
    this.show(`${event}: (${Math.round(x)}, ${Math.round(y)})${targetStr}`);
  }

  /**
   * Log an interactive element's bounds
   */
  logInteractive(name: string, x: number, y: number, width: number, height: number): void {
    this.show(`${name} bounds: x=${Math.round(x)}, y=${Math.round(y)}, w=${width}, h=${height}`);
  }

  private removeMessage(message: DebugMessage): void {
    clearTimeout(message.timeout);
    message.element.style.animation = "debugSlideOut 0.2s ease-out";
    setTimeout(() => {
      message.element.remove();
    }, 200);

    const index = this.messages.indexOf(message);
    if (index > -1) {
      this.messages.splice(index, 1);
    }
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages.forEach((msg) => {
      clearTimeout(msg.timeout);
      msg.element.remove();
    });
    this.messages = [];
  }
}

export const debugToast = DebugToastManager.instance;

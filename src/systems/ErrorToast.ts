/* eslint-disable no-undef */
/**
 * ErrorToast - Global error display system for debugging on mobile
 * Shows errors as visual popups that auto-dismiss
 *
 * Also reports errors to remote tracking (Sentry) when configured
 */

import { errorReporting } from "./ErrorReportingManager";

interface ToastMessage {
  id: number;
  text: string;
  element: HTMLDivElement;
  timeout: number;
}

class ErrorToastManager {
  private static _instance: ErrorToastManager;
  private container: HTMLDivElement | null = null;
  private messages: ToastMessage[] = [];
  private nextId = 0;
  private maxMessages = 5;
  private displayDuration = 5000; // 5 seconds

  static get instance(): ErrorToastManager {
    if (!ErrorToastManager._instance) {
      ErrorToastManager._instance = new ErrorToastManager();
    }
    return ErrorToastManager._instance;
  }

  private constructor() {
    this.createContainer();
    this.setupGlobalErrorHandlers();
  }

  private createContainer(): void {
    // Create toast container
    this.container = document.createElement("div");
    this.container.id = "error-toast-container";
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      pointer-events: none;
      width: 90%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: monospace;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Check if an error is from a browser extension or known browser limitation (not our code)
   */
  private isIgnorableError(error: Error): boolean {
    const message = error.message || "";
    const stack = error.stack || "";

    // Common patterns from password managers and browser extensions
    const ignorablePatterns = [
      // Browser extensions
      "shell-plugins",
      "frame-manager",
      "get-frame-manager-configuration",
      "ResizeObserver loop",
      "extension://",
      "chrome-extension://",
      "moz-extension://",
      "safari-extension://",
      // iOS Safari audio limitations (requires user interaction)
      "Failed to start the audio device",
    ];

    const combined = message + stack;
    return ignorablePatterns.some((pattern) => combined.includes(pattern));
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled errors
    window.addEventListener("error", (event) => {
      const error = event.error || new Error(event.message);
      // Skip ignorable errors (extensions, browser limitations)
      if (this.isIgnorableError(error)) return;
      this.showError(error);
      // Don't prevent default - let console logging still happen
    });

    // Catch unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      // Skip ignorable errors (extensions, browser limitations)
      if (this.isIgnorableError(error)) return;
      this.showError(error);
    });

    // Intercept console.error to show in toast
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      originalError.apply(console, args);

      // Create error message from arguments
      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
          }
          return String(arg);
        })
        .join(" ");

      this.show(message);
    };
  }

  /**
   * Show an error in the toast and report to remote tracking
   */
  showError(error: Error): void {
    const message = `${error.name}: ${error.message}\n${error.stack || ""}`;
    this.show(message);

    // Report to remote error tracking (Sentry)
    errorReporting.captureError(error);
  }

  /**
   * Show a custom message in the toast
   */
  show(text: string): void {
    if (!this.container) return;

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
      background: rgba(220, 38, 38, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      font-size: 12px;
      line-height: 1.4;
      max-height: 200px;
      overflow-y: auto;
      word-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      cursor: pointer;
    `;

    // Truncate very long messages
    let displayText = text;
    if (text.length > 500) {
      displayText = text.substring(0, 500) + "...\n[truncated]";
    }

    toast.textContent = displayText;
    this.container.appendChild(toast);

    // Add click to dismiss
    toast.addEventListener("click", () => {
      const msg = this.messages.find((m) => m.element === toast);
      if (msg) {
        this.removeMessage(msg);
      }
    });

    // Add slide-in animation
    const style = document.createElement("style");
    if (!document.getElementById("error-toast-styles")) {
      style.id = "error-toast-styles";
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
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

  private removeMessage(message: ToastMessage): void {
    // Clear timeout
    clearTimeout(message.timeout);

    // Animate out
    message.element.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => {
      message.element.remove();
    }, 300);

    // Remove from array
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

  /**
   * Set display duration for toasts
   */
  setDuration(ms: number): void {
    this.displayDuration = ms;
  }
}

// Export singleton instance
export const errorToast = ErrorToastManager.instance;

/**
 * EditorCanvas - Canvas rendering and interaction for the wall pattern editor
 */

import type {
  CustomRoomLayout,
  EditorMode,
  EditorSelection,
  WallConfig,
  SpawnZone,
  SafeZone,
  ResizeHandle,
} from "./types";
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, WALL_WIDTHS, WALL_HEIGHTS } from "./types";

// Colors
const COLORS = {
  background: "#1a1a2e",
  grid: "#2a2a4a",
  gridMajor: "#3a3a5a",
  wall: "#8b4513",
  wallBorder: "#654321",
  wallSelected: "#ffa500",
  spawn: "rgba(255, 0, 0, 0.3)",
  spawnBorder: "#ff0000",
  spawnSelected: "#ff6600",
  safe: "rgba(0, 255, 0, 0.3)",
  safeBorder: "#00ff00",
  safeSelected: "#66ff66",
  playerSpawn: "rgba(0, 100, 255, 0.4)",
  resizeHandle: "#ffffff",
};

const HANDLE_SIZE = 8;

export class EditorCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private snapToGrid: boolean = true;

  // Interaction state
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private resizeHandle: ResizeHandle | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  // Callbacks
  public onSelectionChange: ((selection: EditorSelection | null) => void) | null = null;
  public onLayoutChange: (() => void) | null = null;
  public onMouseMove: ((normX: number, normY: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    this.ctx = ctx;

    this.setupEventListeners();
    this.calculateScale();
  }

  private calculateScale(): void {
    const containerWidth = this.canvas.parentElement?.clientWidth || 800;
    const containerHeight = this.canvas.parentElement?.clientHeight || 600;

    // Add padding
    const padding = 40;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    // Calculate scale to fit game canvas
    const scaleX = availableWidth / GAME_WIDTH;
    const scaleY = availableHeight / GAME_HEIGHT;
    this.scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x

    // Calculate offset to center
    const scaledWidth = GAME_WIDTH * this.scale;
    const scaledHeight = GAME_HEIGHT * this.scale;
    this.offsetX = (containerWidth - scaledWidth) / 2;
    this.offsetY = (containerHeight - scaledHeight) / 2;

    // Set canvas size
    this.canvas.width = containerWidth;
    this.canvas.height = containerHeight;
  }

  resize(): void {
    this.calculateScale();
  }

  setSnapToGrid(snap: boolean): void {
    this.snapToGrid = snap;
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
  }

  private screenToNormalized(screenX: number, screenY: number): { x: number; y: number } {
    const x = (screenX - this.offsetX) / this.scale / GAME_WIDTH;
    const y = (screenY - this.offsetY) / this.scale / GAME_HEIGHT;
    return { x, y };
  }

  private normalizedToScreen(normX: number, normY: number): { x: number; y: number } {
    const x = normX * GAME_WIDTH * this.scale + this.offsetX;
    const y = normY * GAME_HEIGHT * this.scale + this.offsetY;
    return { x, y };
  }

  private snapToGridValue(value: number, dimension: "x" | "y"): number {
    if (!this.snapToGrid) return value;

    const pixelSize = dimension === "x" ? GAME_WIDTH : GAME_HEIGHT;
    const gridStep = TILE_SIZE / pixelSize;
    return Math.round(value / gridStep) * gridStep;
  }

  // Current state references (set by EditorApp)
  private currentLayout: CustomRoomLayout | null = null;
  private currentMode: EditorMode = "walls";
  private currentSelection: EditorSelection | null = null;

  setCurrentState(
    layout: CustomRoomLayout | null,
    mode: EditorMode,
    selection: EditorSelection | null,
  ): void {
    this.currentLayout = layout;
    this.currentMode = mode;
    this.currentSelection = selection;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.currentLayout) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x: normX, y: normY } = this.screenToNormalized(screenX, screenY);

    // Check if in game bounds
    if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return;

    // Check for resize handle first (if something is selected)
    if (this.currentSelection) {
      const handle = this.getResizeHandleAt(screenX, screenY);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        return;
      }
    }

    // Check for object selection
    const selection = this.getObjectAt(normX, normY);

    if (selection) {
      this.currentSelection = selection;
      if (this.onSelectionChange) this.onSelectionChange(selection);

      // Start dragging
      this.isDragging = true;

      // Calculate drag offset
      if (selection.type === "wall") {
        const wall = this.currentLayout.walls[selection.index];
        this.dragOffsetX = normX - wall.x;
        this.dragOffsetY = normY - wall.y;
      } else if (selection.type === "spawn") {
        const spawn = this.currentLayout.spawnZones[selection.index];
        this.dragOffsetX = normX - spawn.x;
        this.dragOffsetY = normY - spawn.y;
      } else if (selection.type === "safe") {
        const safe = this.currentLayout.safeZones[selection.index];
        this.dragOffsetX = normX - safe.x;
        this.dragOffsetY = normY - safe.y;
      }
    } else {
      // Deselect
      this.currentSelection = null;
      if (this.onSelectionChange) this.onSelectionChange(null);

      // Add new object
      this.addObjectAt(normX, normY);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x: normX, y: normY } = this.screenToNormalized(screenX, screenY);

    // Report mouse position
    if (this.onMouseMove && normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
      this.onMouseMove(normX, normY);
    }

    if (!this.currentLayout) return;

    if (this.isResizing && this.currentSelection && this.resizeHandle) {
      this.handleResize(normX, normY);
    } else if (this.isDragging && this.currentSelection) {
      this.handleDrag(normX, normY);
    } else {
      // Update cursor based on hover
      const handle = this.getResizeHandleAt(screenX, screenY);
      if (handle) {
        this.canvas.style.cursor = this.getCursorForHandle(handle);
      } else {
        const obj = this.getObjectAt(normX, normY);
        this.canvas.style.cursor = obj ? "move" : "crosshair";
      }
    }
  }

  private handleMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }

  private handleDrag(normX: number, normY: number): void {
    if (!this.currentLayout || !this.currentSelection) return;

    let newX = normX - this.dragOffsetX;
    let newY = normY - this.dragOffsetY;

    // Snap to grid
    newX = this.snapToGridValue(newX, "x");
    newY = this.snapToGridValue(newY, "y");

    // Clamp to bounds
    newX = Math.max(0, Math.min(1, newX));
    newY = Math.max(0, Math.min(1, newY));

    if (this.currentSelection.type === "wall") {
      const wall = this.currentLayout.walls[this.currentSelection.index];
      wall.x = newX;
      wall.y = newY;
    } else if (this.currentSelection.type === "spawn") {
      const spawn = this.currentLayout.spawnZones[this.currentSelection.index];
      spawn.x = newX;
      spawn.y = newY;
    } else if (this.currentSelection.type === "safe") {
      const safe = this.currentLayout.safeZones[this.currentSelection.index];
      safe.x = newX;
      safe.y = newY;
    }

    if (this.onLayoutChange) this.onLayoutChange();
  }

  private handleResize(normX: number, normY: number): void {
    if (!this.currentLayout || !this.currentSelection || !this.resizeHandle) return;

    if (this.currentSelection.type === "wall") {
      this.resizeWall(normX, normY);
    } else if (this.currentSelection.type === "spawn" || this.currentSelection.type === "safe") {
      this.resizeZone(normX, normY);
    }

    if (this.onLayoutChange) this.onLayoutChange();
  }

  private resizeWall(normX: number, normY: number): void {
    if (!this.currentLayout || !this.currentSelection || !this.resizeHandle) return;

    const wall = this.currentLayout.walls[this.currentSelection.index];
    const handle = this.resizeHandle;

    const left = wall.x - wall.width / 2;
    const right = wall.x + wall.width / 2;
    const top = wall.y - wall.height / 2;
    const bottom = wall.y + wall.height / 2;

    let newLeft = left;
    let newRight = right;
    let newTop = top;
    let newBottom = bottom;

    // Snap normalized position
    const snappedX = this.snapToGridValue(normX, "x");
    const snappedY = this.snapToGridValue(normY, "y");

    if (handle.includes("w")) newLeft = snappedX;
    if (handle.includes("e")) newRight = snappedX;
    if (handle.includes("n")) newTop = snappedY;
    if (handle.includes("s")) newBottom = snappedY;

    // Ensure minimum size
    const minSize = TILE_SIZE / GAME_WIDTH;
    if (newRight - newLeft < minSize) {
      if (handle.includes("w")) newLeft = newRight - minSize;
      else newRight = newLeft + minSize;
    }
    if (newBottom - newTop < minSize) {
      if (handle.includes("n")) newTop = newBottom - minSize;
      else newBottom = newTop + minSize;
    }

    wall.x = (newLeft + newRight) / 2;
    wall.y = (newTop + newBottom) / 2;
    wall.width = newRight - newLeft;
    wall.height = newBottom - newTop;
  }

  private resizeZone(normX: number, normY: number): void {
    if (!this.currentLayout || !this.currentSelection) return;

    let zone: SpawnZone | SafeZone;
    if (this.currentSelection.type === "spawn") {
      zone = this.currentLayout.spawnZones[this.currentSelection.index];
    } else {
      zone = this.currentLayout.safeZones[this.currentSelection.index];
    }

    // Calculate new radius based on distance from center
    const dx = normX - zone.x;
    const dy = normY - zone.y;
    const newRadius = Math.sqrt(dx * dx + dy * dy);

    // Minimum radius
    const minRadius = 0.02;
    zone.radius = Math.max(minRadius, newRadius);
  }

  private getObjectAt(normX: number, normY: number): EditorSelection | null {
    if (!this.currentLayout) return null;

    // Check walls (in reverse order so top-most is selected first)
    for (let i = this.currentLayout.walls.length - 1; i >= 0; i--) {
      const wall = this.currentLayout.walls[i];
      const left = wall.x - wall.width / 2;
      const right = wall.x + wall.width / 2;
      const top = wall.y - wall.height / 2;
      const bottom = wall.y + wall.height / 2;

      if (normX >= left && normX <= right && normY >= top && normY <= bottom) {
        return { type: "wall", index: i };
      }
    }

    // Check spawn zones
    for (let i = this.currentLayout.spawnZones.length - 1; i >= 0; i--) {
      const spawn = this.currentLayout.spawnZones[i];
      const dx = normX - spawn.x;
      const dy = normY - spawn.y;
      if (Math.sqrt(dx * dx + dy * dy) <= spawn.radius) {
        return { type: "spawn", index: i };
      }
    }

    // Check safe zones
    for (let i = this.currentLayout.safeZones.length - 1; i >= 0; i--) {
      const safe = this.currentLayout.safeZones[i];
      const dx = normX - safe.x;
      const dy = normY - safe.y;
      if (Math.sqrt(dx * dx + dy * dy) <= safe.radius) {
        return { type: "safe", index: i };
      }
    }

    return null;
  }

  private getResizeHandleAt(screenX: number, screenY: number): ResizeHandle | null {
    if (!this.currentLayout || !this.currentSelection) return null;

    const handles = this.getResizeHandles();
    for (const [handle, rect] of Object.entries(handles)) {
      if (
        screenX >= rect.x &&
        screenX <= rect.x + rect.w &&
        screenY >= rect.y &&
        screenY <= rect.y + rect.h
      ) {
        return handle as ResizeHandle;
      }
    }

    return null;
  }

  private getResizeHandles(): Record<ResizeHandle, { x: number; y: number; w: number; h: number }> {
    const handles: Record<ResizeHandle, { x: number; y: number; w: number; h: number }> = {
      n: { x: 0, y: 0, w: 0, h: 0 },
      s: { x: 0, y: 0, w: 0, h: 0 },
      e: { x: 0, y: 0, w: 0, h: 0 },
      w: { x: 0, y: 0, w: 0, h: 0 },
      ne: { x: 0, y: 0, w: 0, h: 0 },
      nw: { x: 0, y: 0, w: 0, h: 0 },
      se: { x: 0, y: 0, w: 0, h: 0 },
      sw: { x: 0, y: 0, w: 0, h: 0 },
    };

    if (!this.currentLayout || !this.currentSelection) return handles;

    if (this.currentSelection.type === "wall") {
      const wall = this.currentLayout.walls[this.currentSelection.index];
      const { x: left, y: top } = this.normalizedToScreen(
        wall.x - wall.width / 2,
        wall.y - wall.height / 2,
      );
      const { x: right, y: bottom } = this.normalizedToScreen(
        wall.x + wall.width / 2,
        wall.y + wall.height / 2,
      );
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      const hs = HANDLE_SIZE / 2;

      handles.nw = { x: left - hs, y: top - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.n = { x: centerX - hs, y: top - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.ne = { x: right - hs, y: top - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.w = { x: left - hs, y: centerY - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.e = { x: right - hs, y: centerY - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.sw = { x: left - hs, y: bottom - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.s = { x: centerX - hs, y: bottom - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.se = { x: right - hs, y: bottom - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
    } else {
      // For zones, just show resize handles around the edge
      let zone: SpawnZone | SafeZone;
      if (this.currentSelection.type === "spawn") {
        zone = this.currentLayout.spawnZones[this.currentSelection.index];
      } else {
        zone = this.currentLayout.safeZones[this.currentSelection.index];
      }

      const { x: cx, y: cy } = this.normalizedToScreen(zone.x, zone.y);
      const radiusPx = zone.radius * GAME_WIDTH * this.scale;
      const hs = HANDLE_SIZE / 2;

      handles.n = { x: cx - hs, y: cy - radiusPx - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.s = { x: cx - hs, y: cy + radiusPx - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.e = { x: cx + radiusPx - hs, y: cy - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
      handles.w = { x: cx - radiusPx - hs, y: cy - hs, w: HANDLE_SIZE, h: HANDLE_SIZE };
    }

    return handles;
  }

  private getCursorForHandle(handle: ResizeHandle): string {
    const cursors: Record<ResizeHandle, string> = {
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      nw: "nwse-resize",
      se: "nwse-resize",
    };
    return cursors[handle];
  }

  private addObjectAt(normX: number, normY: number): void {
    if (!this.currentLayout) return;

    const snappedX = this.snapToGridValue(normX, "x");
    const snappedY = this.snapToGridValue(normY, "y");

    if (this.currentMode === "walls") {
      const newWall: WallConfig = {
        x: snappedX,
        y: snappedY,
        width: WALL_WIDTHS.W2,
        height: WALL_HEIGHTS.H2,
      };
      this.currentLayout.walls.push(newWall);
      this.currentSelection = { type: "wall", index: this.currentLayout.walls.length - 1 };
    } else if (this.currentMode === "spawns") {
      const newSpawn: SpawnZone = {
        x: snappedX,
        y: snappedY,
        radius: 0.1,
        weight: 1,
      };
      this.currentLayout.spawnZones.push(newSpawn);
      this.currentSelection = { type: "spawn", index: this.currentLayout.spawnZones.length - 1 };
    } else if (this.currentMode === "safe") {
      const newSafe: SafeZone = {
        x: snappedX,
        y: snappedY,
        radius: 0.1,
      };
      this.currentLayout.safeZones.push(newSafe);
      this.currentSelection = { type: "safe", index: this.currentLayout.safeZones.length - 1 };
    }

    if (this.onSelectionChange) this.onSelectionChange(this.currentSelection);
    if (this.onLayoutChange) this.onLayoutChange();
  }

  deleteSelected(): void {
    if (!this.currentLayout || !this.currentSelection) return;

    if (this.currentSelection.type === "wall") {
      this.currentLayout.walls.splice(this.currentSelection.index, 1);
    } else if (this.currentSelection.type === "spawn") {
      this.currentLayout.spawnZones.splice(this.currentSelection.index, 1);
    } else if (this.currentSelection.type === "safe") {
      this.currentLayout.safeZones.splice(this.currentSelection.index, 1);
    }

    this.currentSelection = null;
    if (this.onSelectionChange) this.onSelectionChange(null);
    if (this.onLayoutChange) this.onLayoutChange();
  }

  render(): void {
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw game area background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(this.offsetX, this.offsetY, GAME_WIDTH * this.scale, GAME_HEIGHT * this.scale);

    // Draw grid
    this.drawGrid();

    if (!this.currentLayout) {
      // Draw "no layout" message
      ctx.fillStyle = "#666";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Select or create a layout", this.canvas.width / 2, this.canvas.height / 2);
      return;
    }

    // Draw player spawn safe zone (bottom center)
    this.drawPlayerSpawnZone();

    // Draw safe zones
    for (let i = 0; i < this.currentLayout.safeZones.length; i++) {
      const safe = this.currentLayout.safeZones[i];
      const isSelected =
        this.currentSelection?.type === "safe" && this.currentSelection.index === i;
      this.drawZone(safe.x, safe.y, safe.radius, COLORS.safe, COLORS.safeBorder, isSelected);
    }

    // Draw spawn zones
    for (let i = 0; i < this.currentLayout.spawnZones.length; i++) {
      const spawn = this.currentLayout.spawnZones[i];
      const isSelected =
        this.currentSelection?.type === "spawn" && this.currentSelection.index === i;
      this.drawZone(spawn.x, spawn.y, spawn.radius, COLORS.spawn, COLORS.spawnBorder, isSelected);
      // Draw weight label
      const { x, y } = this.normalizedToScreen(spawn.x, spawn.y);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`w:${spawn.weight.toFixed(1)}`, x, y + 4);
    }

    // Draw walls
    for (let i = 0; i < this.currentLayout.walls.length; i++) {
      const wall = this.currentLayout.walls[i];
      const isSelected =
        this.currentSelection?.type === "wall" && this.currentSelection.index === i;
      this.drawWall(wall, isSelected);
    }

    // Draw resize handles for selected object
    if (this.currentSelection) {
      this.drawResizeHandles();
    }
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const gridStepX = (TILE_SIZE / GAME_WIDTH) * GAME_WIDTH * this.scale;
    const gridStepY = (TILE_SIZE / GAME_HEIGHT) * GAME_HEIGHT * this.scale;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x <= GAME_WIDTH * this.scale; x += gridStepX) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + x, this.offsetY);
      ctx.lineTo(this.offsetX + x, this.offsetY + GAME_HEIGHT * this.scale);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= GAME_HEIGHT * this.scale; y += gridStepY) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + y);
      ctx.lineTo(this.offsetX + GAME_WIDTH * this.scale, this.offsetY + y);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX, this.offsetY, GAME_WIDTH * this.scale, GAME_HEIGHT * this.scale);
  }

  private drawPlayerSpawnZone(): void {
    if (!this.currentLayout) return;

    const ctx = this.ctx;
    const { x, y } = this.normalizedToScreen(0.5, 0.85);
    const radius = this.currentLayout.playerSpawnSafeRadius * GAME_WIDTH * this.scale;

    ctx.fillStyle = COLORS.playerSpawn;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0064ff";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "#0064ff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Player Spawn", x, y + 4);
  }

  private drawZone(
    normX: number,
    normY: number,
    radius: number,
    fillColor: string,
    strokeColor: string,
    isSelected: boolean,
  ): void {
    const ctx = this.ctx;
    const { x, y } = this.normalizedToScreen(normX, normY);
    const radiusPx = radius * GAME_WIDTH * this.scale;

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? COLORS.wallSelected : strokeColor;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
  }

  private drawWall(wall: WallConfig, isSelected: boolean): void {
    const ctx = this.ctx;
    const { x: left, y: top } = this.normalizedToScreen(
      wall.x - wall.width / 2,
      wall.y - wall.height / 2,
    );
    const width = wall.width * GAME_WIDTH * this.scale;
    const height = wall.height * GAME_HEIGHT * this.scale;

    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(left, top, width, height);

    ctx.strokeStyle = isSelected ? COLORS.wallSelected : COLORS.wallBorder;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(left, top, width, height);
  }

  private drawResizeHandles(): void {
    const ctx = this.ctx;
    const handles = this.getResizeHandles();

    ctx.fillStyle = COLORS.resizeHandle;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;

    for (const rect of Object.values(handles)) {
      if (rect.w > 0) {
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    }
  }
}

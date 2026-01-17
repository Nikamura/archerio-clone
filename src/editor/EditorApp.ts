/**
 * EditorApp - Main application class for the wall pattern editor
 */

import { EditorCanvas } from "./EditorCanvas";
import type { CustomRoomLayout, CustomLayoutsData, EditorMode, EditorSelection } from "./types";
import { STORAGE_KEY, WALL_WIDTHS, WALL_HEIGHTS } from "./types";

export class EditorApp {
  private canvas: EditorCanvas;
  private layouts: CustomRoomLayout[] = [];
  private currentLayoutIndex: number = -1;
  private currentMode: EditorMode = "walls";
  private currentSelection: EditorSelection | null = null;

  // DOM elements
  private layoutList: HTMLElement;
  private modeButtons: NodeListOf<HTMLElement>;
  private propertiesPanel: HTMLElement;
  private coordsDisplay: HTMLElement;
  private selectionDisplay: HTMLElement;

  constructor() {
    // Get DOM elements
    const canvasEl = document.getElementById("editor-canvas") as HTMLCanvasElement;
    this.layoutList = document.getElementById("layout-list")!;
    this.modeButtons = document.querySelectorAll(".mode-btn");
    this.propertiesPanel = document.getElementById("properties-panel")!;
    this.coordsDisplay = document.getElementById("coords-display")!;
    this.selectionDisplay = document.getElementById("selection-display")!;

    // Initialize canvas
    this.canvas = new EditorCanvas(canvasEl);
    this.canvas.onSelectionChange = this.handleSelectionChange.bind(this);
    this.canvas.onLayoutChange = this.handleLayoutChange.bind(this);
    this.canvas.onMouseMove = this.handleMouseMove.bind(this);

    // Load layouts from localStorage
    this.loadLayouts();

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    this.render();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.canvas.resize();
      this.render();
    });

    // Start render loop
    this.startRenderLoop();
  }

  private loadLayouts(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: CustomLayoutsData = JSON.parse(data);
        if (parsed.version === 1 && Array.isArray(parsed.layouts)) {
          this.layouts = parsed.layouts;
        }
      }
    } catch {
      console.error("Failed to load layouts from localStorage");
    }

    // If no layouts, create a default one
    if (this.layouts.length === 0) {
      this.createNewLayout("Room 1");
    }

    // Select first layout
    if (this.layouts.length > 0) {
      this.currentLayoutIndex = 0;
    }
  }

  private saveLayouts(): void {
    const data: CustomLayoutsData = {
      version: 1,
      layouts: this.layouts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private createNewLayout(name: string): void {
    const id = `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newLayout: CustomRoomLayout = {
      id,
      name,
      walls: [],
      spawnZones: [{ x: 0.5, y: 0.3, radius: 0.15, weight: 1 }],
      safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
      playerSpawnSafeRadius: 0.25,
    };
    this.layouts.push(newLayout);
    this.currentLayoutIndex = this.layouts.length - 1;
    this.currentSelection = null;
    this.saveLayouts();
    this.updateLayoutList();
    this.updateCanvasState();
  }

  private duplicateLayout(index: number): void {
    const original = this.layouts[index];
    const id = `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duplicate: CustomRoomLayout = {
      ...JSON.parse(JSON.stringify(original)),
      id,
      name: `${original.name} (copy)`,
    };
    this.layouts.splice(index + 1, 0, duplicate);
    this.currentLayoutIndex = index + 1;
    this.saveLayouts();
    this.updateLayoutList();
    this.updateCanvasState();
  }

  private deleteLayout(index: number): void {
    if (this.layouts.length <= 1) {
      alert("Cannot delete the last layout");
      return;
    }
    this.layouts.splice(index, 1);
    if (this.currentLayoutIndex >= this.layouts.length) {
      this.currentLayoutIndex = this.layouts.length - 1;
    }
    this.currentSelection = null;
    this.saveLayouts();
    this.updateLayoutList();
    this.updateCanvasState();
  }

  private renameLayout(index: number): void {
    const layout = this.layouts[index];
    const newName = prompt("Enter new name:", layout.name);
    if (newName && newName.trim()) {
      layout.name = newName.trim();
      this.saveLayouts();
      this.updateLayoutList();
    }
  }

  private moveLayout(index: number, direction: "up" | "down"): void {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.layouts.length) return;

    const temp = this.layouts[index];
    this.layouts[index] = this.layouts[newIndex];
    this.layouts[newIndex] = temp;

    if (this.currentLayoutIndex === index) {
      this.currentLayoutIndex = newIndex;
    } else if (this.currentLayoutIndex === newIndex) {
      this.currentLayoutIndex = index;
    }

    this.saveLayouts();
    this.updateLayoutList();
  }

  private selectLayout(index: number): void {
    this.currentLayoutIndex = index;
    this.currentSelection = null;
    this.updateLayoutList();
    this.updateCanvasState();
    this.updatePropertiesPanel();
  }

  private getCurrentLayout(): CustomRoomLayout | null {
    if (this.currentLayoutIndex >= 0 && this.currentLayoutIndex < this.layouts.length) {
      return this.layouts[this.currentLayoutIndex];
    }
    return null;
  }

  private setupEventListeners(): void {
    // New layout button
    document.getElementById("new-layout-btn")?.addEventListener("click", () => {
      const name = `Room ${this.layouts.length + 1}`;
      this.createNewLayout(name);
    });

    // Mode buttons
    this.modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode as EditorMode;
        if (mode) {
          this.currentMode = mode;
          this.updateModeButtons();
          this.updateCanvasState();
        }
      });
    });

    // Delete selected button
    document.getElementById("delete-selected-btn")?.addEventListener("click", () => {
      this.canvas.deleteSelected();
    });

    // Clear all button
    document.getElementById("clear-all-btn")?.addEventListener("click", () => {
      const layout = this.getCurrentLayout();
      if (layout && confirm("Clear all objects in this layout?")) {
        layout.walls = [];
        layout.spawnZones = [];
        layout.safeZones = [];
        this.currentSelection = null;
        this.saveLayouts();
        this.updateCanvasState();
        this.updatePropertiesPanel();
      }
    });

    // Snap to grid checkbox
    document.getElementById("snap-grid")?.addEventListener("change", (e) => {
      this.canvas.setSnapToGrid((e.target as HTMLInputElement).checked);
    });

    // Export JSON button
    document.getElementById("export-btn")?.addEventListener("click", () => {
      this.exportJSON();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Prevent if typing in input
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        this.canvas.deleteSelected();
      }
    });
  }

  private handleSelectionChange(selection: EditorSelection | null): void {
    this.currentSelection = selection;
    this.updateCanvasState();
    this.updatePropertiesPanel();
    this.updateSelectionDisplay();
  }

  private handleLayoutChange(): void {
    this.saveLayouts();
    this.updatePropertiesPanel();
  }

  private handleMouseMove(normX: number, normY: number): void {
    this.coordsDisplay.textContent = `Mouse: (${normX.toFixed(2)}, ${normY.toFixed(2)})`;
  }

  private updateCanvasState(): void {
    this.canvas.setCurrentState(this.getCurrentLayout(), this.currentMode, this.currentSelection);
  }

  private updateLayoutList(): void {
    this.layoutList.innerHTML = "";

    this.layouts.forEach((layout, index) => {
      const item = document.createElement("div");
      item.className = `layout-item${index === this.currentLayoutIndex ? " selected" : ""}`;

      const nameSpan = document.createElement("span");
      nameSpan.className = "layout-name";
      nameSpan.textContent = layout.name;
      nameSpan.addEventListener("click", () => this.selectLayout(index));
      nameSpan.addEventListener("dblclick", () => this.renameLayout(index));

      const controls = document.createElement("div");
      controls.className = "layout-controls";

      const upBtn = document.createElement("button");
      upBtn.textContent = "↑";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.moveLayout(index, "up");
      });

      const downBtn = document.createElement("button");
      downBtn.textContent = "↓";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.moveLayout(index, "down");
      });

      const dupBtn = document.createElement("button");
      dupBtn.textContent = "⧉";
      dupBtn.title = "Duplicate";
      dupBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.duplicateLayout(index);
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "×";
      delBtn.title = "Delete";
      delBtn.className = "delete-btn";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteLayout(index);
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(dupBtn);
      controls.appendChild(delBtn);

      item.appendChild(nameSpan);
      item.appendChild(controls);
      this.layoutList.appendChild(item);
    });
  }

  private updateModeButtons(): void {
    this.modeButtons.forEach((btn) => {
      const mode = btn.dataset.mode;
      btn.classList.toggle("active", mode === this.currentMode);
    });
  }

  private updatePropertiesPanel(): void {
    const layout = this.getCurrentLayout();
    if (!layout) {
      this.propertiesPanel.innerHTML = "<p>No layout selected</p>";
      return;
    }

    let html = "";

    if (!this.currentSelection) {
      // Show layout properties
      html = `
        <h4>Layout: ${layout.name}</h4>
        <div class="property-group">
          <label>Player Spawn Safe Radius</label>
          <input type="number" id="prop-spawn-radius" value="${layout.playerSpawnSafeRadius}" step="0.01" min="0" max="0.5">
        </div>
        <div class="property-group">
          <label>Objects</label>
          <p>Walls: ${layout.walls.length}</p>
          <p>Spawn Zones: ${layout.spawnZones.length}</p>
          <p>Safe Zones: ${layout.safeZones.length}</p>
        </div>
      `;
    } else if (this.currentSelection.type === "wall") {
      const wall = layout.walls[this.currentSelection.index];
      html = `
        <h4>Wall ${this.currentSelection.index + 1}</h4>
        <div class="property-group">
          <label>Position</label>
          <div class="input-row">
            <span>X:</span>
            <input type="number" id="prop-x" value="${wall.x.toFixed(3)}" step="0.01">
            <span>Y:</span>
            <input type="number" id="prop-y" value="${wall.y.toFixed(3)}" step="0.01">
          </div>
        </div>
        <div class="property-group">
          <label>Width Presets</label>
          <div class="preset-buttons">
            <button class="preset-btn${Math.abs(wall.width - WALL_WIDTHS.W1) < 0.01 ? " active" : ""}" data-prop="width" data-value="${WALL_WIDTHS.W1}">W1</button>
            <button class="preset-btn${Math.abs(wall.width - WALL_WIDTHS.W2) < 0.01 ? " active" : ""}" data-prop="width" data-value="${WALL_WIDTHS.W2}">W2</button>
            <button class="preset-btn${Math.abs(wall.width - WALL_WIDTHS.W3) < 0.01 ? " active" : ""}" data-prop="width" data-value="${WALL_WIDTHS.W3}">W3</button>
          </div>
        </div>
        <div class="property-group">
          <label>Height Presets</label>
          <div class="preset-buttons">
            <button class="preset-btn${Math.abs(wall.height - WALL_HEIGHTS.H1) < 0.01 ? " active" : ""}" data-prop="height" data-value="${WALL_HEIGHTS.H1}">H1</button>
            <button class="preset-btn${Math.abs(wall.height - WALL_HEIGHTS.H2) < 0.01 ? " active" : ""}" data-prop="height" data-value="${WALL_HEIGHTS.H2}">H2</button>
            <button class="preset-btn${Math.abs(wall.height - WALL_HEIGHTS.H3) < 0.01 ? " active" : ""}" data-prop="height" data-value="${WALL_HEIGHTS.H3}">H3</button>
            <button class="preset-btn${Math.abs(wall.height - WALL_HEIGHTS.H4) < 0.01 ? " active" : ""}" data-prop="height" data-value="${WALL_HEIGHTS.H4}">H4</button>
            <button class="preset-btn${Math.abs(wall.height - WALL_HEIGHTS.H5) < 0.01 ? " active" : ""}" data-prop="height" data-value="${WALL_HEIGHTS.H5}">H5</button>
          </div>
        </div>
        <div class="property-group">
          <label>Custom Size</label>
          <div class="input-row">
            <span>W:</span>
            <input type="number" id="prop-width" value="${wall.width.toFixed(3)}" step="0.01">
            <span>H:</span>
            <input type="number" id="prop-height" value="${wall.height.toFixed(3)}" step="0.01">
          </div>
        </div>
      `;
    } else if (this.currentSelection.type === "spawn") {
      const spawn = layout.spawnZones[this.currentSelection.index];
      html = `
        <h4>Spawn Zone ${this.currentSelection.index + 1}</h4>
        <div class="property-group">
          <label>Position</label>
          <div class="input-row">
            <span>X:</span>
            <input type="number" id="prop-x" value="${spawn.x.toFixed(3)}" step="0.01">
            <span>Y:</span>
            <input type="number" id="prop-y" value="${spawn.y.toFixed(3)}" step="0.01">
          </div>
        </div>
        <div class="property-group">
          <label>Radius</label>
          <input type="number" id="prop-radius" value="${spawn.radius.toFixed(3)}" step="0.01" min="0.01" max="0.5">
        </div>
        <div class="property-group">
          <label>Weight</label>
          <input type="number" id="prop-weight" value="${spawn.weight.toFixed(1)}" step="0.1" min="0.1" max="5">
        </div>
      `;
    } else if (this.currentSelection.type === "safe") {
      const safe = layout.safeZones[this.currentSelection.index];
      html = `
        <h4>Safe Zone ${this.currentSelection.index + 1}</h4>
        <div class="property-group">
          <label>Position</label>
          <div class="input-row">
            <span>X:</span>
            <input type="number" id="prop-x" value="${safe.x.toFixed(3)}" step="0.01">
            <span>Y:</span>
            <input type="number" id="prop-y" value="${safe.y.toFixed(3)}" step="0.01">
          </div>
        </div>
        <div class="property-group">
          <label>Radius</label>
          <input type="number" id="prop-radius" value="${safe.radius.toFixed(3)}" step="0.01" min="0.01" max="0.5">
        </div>
      `;
    }

    this.propertiesPanel.innerHTML = html;

    // Add event listeners to inputs
    this.setupPropertyInputs();
  }

  private setupPropertyInputs(): void {
    const layout = this.getCurrentLayout();
    if (!layout) return;

    // Layout properties
    document.getElementById("prop-spawn-radius")?.addEventListener("change", (e) => {
      layout.playerSpawnSafeRadius = parseFloat((e.target as HTMLInputElement).value) || 0.25;
      this.saveLayouts();
    });

    // Object properties
    const updateObjectProperty = (prop: string, value: number) => {
      if (!this.currentSelection) return;

      if (this.currentSelection.type === "wall") {
        const wall = layout.walls[this.currentSelection.index];
        (wall as unknown as Record<string, number>)[prop] = value;
      } else if (this.currentSelection.type === "spawn") {
        const spawn = layout.spawnZones[this.currentSelection.index];
        (spawn as unknown as Record<string, number>)[prop] = value;
      } else if (this.currentSelection.type === "safe") {
        const safe = layout.safeZones[this.currentSelection.index];
        (safe as unknown as Record<string, number>)[prop] = value;
      }

      this.saveLayouts();
    };

    ["x", "y", "width", "height", "radius", "weight"].forEach((prop) => {
      const input = document.getElementById(`prop-${prop}`) as HTMLInputElement;
      if (input) {
        input.addEventListener("change", () => {
          updateObjectProperty(prop, parseFloat(input.value) || 0);
          this.updatePropertiesPanel();
        });
      }
    });

    // Preset buttons
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prop = (btn as HTMLElement).dataset.prop;
        const value = parseFloat((btn as HTMLElement).dataset.value || "0");
        if (prop) {
          updateObjectProperty(prop, value);
          this.updatePropertiesPanel();
        }
      });
    });
  }

  private updateSelectionDisplay(): void {
    if (!this.currentSelection) {
      this.selectionDisplay.textContent = "No selection";
      return;
    }

    const layout = this.getCurrentLayout();
    if (!layout) return;

    if (this.currentSelection.type === "wall") {
      const wall = layout.walls[this.currentSelection.index];
      this.selectionDisplay.textContent = `Wall at (${wall.x.toFixed(2)}, ${wall.y.toFixed(2)})`;
    } else if (this.currentSelection.type === "spawn") {
      const spawn = layout.spawnZones[this.currentSelection.index];
      this.selectionDisplay.textContent = `Spawn at (${spawn.x.toFixed(2)}, ${spawn.y.toFixed(2)})`;
    } else if (this.currentSelection.type === "safe") {
      const safe = layout.safeZones[this.currentSelection.index];
      this.selectionDisplay.textContent = `Safe at (${safe.x.toFixed(2)}, ${safe.y.toFixed(2)})`;
    }
  }

  private exportJSON(): void {
    const data: CustomLayoutsData = {
      version: 1,
      layouts: this.layouts,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "room-layouts.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private render(): void {
    this.canvas.render();
  }
}

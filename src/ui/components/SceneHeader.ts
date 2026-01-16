import Phaser from "phaser";
import { currencyManager, CurrencyType } from "../../systems/CurrencyManager";

/**
 * Configuration for SceneHeader
 */
export interface SceneHeaderConfig {
  scene: Phaser.Scene;
  title: string;
  subtitle?: string;
  showCurrency?: boolean;
  currencyTypes?: CurrencyType[];
  y?: number;
  titleFontSize?: string;
  subtitleFontSize?: string;
  depth?: number;
  backgroundColor?: number;
  showBackground?: boolean;
}

export interface SceneHeaderResult {
  container: Phaser.GameObjects.Container;
  updateCurrency: () => void;
  getHeight: () => number;
}

/**
 * SceneHeader - Reusable header component
 *
 * Provides a styled header with title, optional subtitle, and currency display.
 * Used across 9+ scenes.
 */
export function createSceneHeader(config: SceneHeaderConfig): SceneHeaderResult {
  const {
    scene,
    title,
    subtitle,
    showCurrency = false,
    currencyTypes = ["gold", "gems"],
    y = 0,
    titleFontSize = "28px",
    subtitleFontSize = "16px",
    depth = 10,
    backgroundColor = 0x1a1a2e,
    showBackground = true,
  } = config;

  const width = scene.cameras.main.width;
  const container = scene.add.container(0, y);
  container.setDepth(depth);

  // Calculate header height based on content
  let headerHeight = 60;
  if (subtitle) headerHeight += 25;
  if (showCurrency) headerHeight += 30;

  // Header background
  if (showBackground) {
    const bg = scene.add.rectangle(
      width / 2,
      headerHeight / 2,
      width,
      headerHeight,
      backgroundColor,
    );
    container.add(bg);
  }

  // Title
  const titleY = showBackground ? 25 : 30;
  const titleText = scene.add
    .text(width / 2, titleY, title, {
      fontSize: titleFontSize,
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  titleText.setDepth(depth + 1);
  container.add(titleText);

  // Subtitle
  let subtitleText: Phaser.GameObjects.Text | null = null;
  let currentY = titleY + 30;
  if (subtitle) {
    subtitleText = scene.add
      .text(width / 2, currentY, subtitle, {
        fontSize: subtitleFontSize,
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    subtitleText.setDepth(depth + 1);
    container.add(subtitleText);
    currentY += 25;
  }

  // Currency display
  const currencyTexts: Map<CurrencyType, Phaser.GameObjects.Text> = new Map();
  if (showCurrency && currencyTypes.length > 0) {
    const currencyY = currentY + 10;

    // Calculate spacing
    const totalCurrencies = currencyTypes.length;
    const spacing = 120;
    const startX = width / 2 - ((totalCurrencies - 1) * spacing) / 2;

    currencyTypes.forEach((type, index) => {
      const x = startX + index * spacing;
      const value = currencyManager.get(type);
      const color = getCurrencyColor(type);

      const currencyText = scene.add
        .text(x, currencyY, `${getCurrencyLabel(type)}: ${formatCurrencyValue(value)}`, {
          fontSize: "14px",
          color,
        })
        .setOrigin(0.5);
      currencyText.setDepth(depth + 1);
      container.add(currencyText);
      currencyTexts.set(type, currencyText);
    });
  }

  // Update function
  const updateCurrency = () => {
    currencyTexts.forEach((text, type) => {
      const value = currencyManager.get(type);
      text.setText(`${getCurrencyLabel(type)}: ${formatCurrencyValue(value)}`);
    });
  };

  const getHeight = () => headerHeight;

  return {
    container,
    updateCurrency,
    getHeight,
  };
}

function getCurrencyColor(type: CurrencyType): string {
  switch (type) {
    case "gold":
      return "#FFD700";
    case "gems":
      return "#00CCFF";
    case "scrolls":
      return "#8B5CF6";
    case "energy":
      return "#22C55E";
    default:
      return "#ffffff";
  }
}

function getCurrencyLabel(type: CurrencyType): string {
  switch (type) {
    case "gold":
      return "Gold";
    case "gems":
      return "Gems";
    case "scrolls":
      return "Scrolls";
    case "energy":
      return "Energy";
    default:
      return type;
  }
}

function formatCurrencyValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return value.toLocaleString();
  }
  return value.toString();
}

export default createSceneHeader;

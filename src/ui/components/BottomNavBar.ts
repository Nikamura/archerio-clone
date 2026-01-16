import Phaser from "phaser";
import { audioManager } from "../../systems/AudioManager";
import { transitionToScene, TransitionType, DURATION } from "../../systems/UIAnimations";

export interface NavItem {
  id: string;
  icon: string;
  label: string;
  scene?: string;
  badge?: number;
  onClick?: () => void;
}

export interface BottomNavBarConfig {
  scene: Phaser.Scene;
  items: NavItem[];
  activeId?: string;
  depth?: number;
}

export interface BottomNavBarResult {
  container: Phaser.GameObjects.Container;
  updateBadge: (id: string, count: number) => void;
  setActive: (id: string) => void;
  getHeight: () => number;
  destroy: () => void;
}

const NAV_HEIGHT = 60;
const BADGE_COLOR = 0xff4444;

/**
 * BottomNavBar - Fixed bottom navigation with icons, labels, and badges
 */
export function createBottomNavBar(config: BottomNavBarConfig): BottomNavBarResult {
  const { scene, items, activeId, depth = 50 } = config;

  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;
  const itemWidth = width / items.length;

  const container = scene.add.container(0, height - NAV_HEIGHT);
  container.setDepth(depth);

  // Background
  const bg = scene.add.rectangle(width / 2, NAV_HEIGHT / 2, width, NAV_HEIGHT, 0x1a1a2e);
  bg.setStrokeStyle(1, 0x333344, 1);
  container.add(bg);

  // Top border line
  const borderLine = scene.add.rectangle(width / 2, 0, width, 2, 0x333344);
  container.add(borderLine);

  const navItems: Map<
    string,
    {
      container: Phaser.GameObjects.Container;
      badge?: Phaser.GameObjects.Container;
      badgeText?: Phaser.GameObjects.Text;
      iconText: Phaser.GameObjects.Text;
      labelText: Phaser.GameObjects.Text;
    }
  > = new Map();

  items.forEach((item, index) => {
    const x = index * itemWidth + itemWidth / 2;
    const isActive = item.id === activeId;

    const itemContainer = scene.add.container(x, NAV_HEIGHT / 2);
    container.add(itemContainer);

    // Hit area
    const hitArea = scene.add.rectangle(0, 0, itemWidth - 4, NAV_HEIGHT - 4, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    itemContainer.add(hitArea);

    // Icon
    const iconText = scene.add.text(0, -8, item.icon, {
      fontSize: "22px",
    });
    iconText.setOrigin(0.5);
    itemContainer.add(iconText);

    // Label
    const labelText = scene.add.text(0, 16, item.label, {
      fontSize: "10px",
      color: isActive ? "#4a9eff" : "#888888",
    });
    labelText.setOrigin(0.5);
    itemContainer.add(labelText);

    // Badge (if count > 0)
    let badgeContainer: Phaser.GameObjects.Container | undefined;
    let badgeText: Phaser.GameObjects.Text | undefined;

    if (item.badge && item.badge > 0) {
      badgeContainer = scene.add.container(12, -18);
      itemContainer.add(badgeContainer);

      const badgeCircle = scene.add.circle(0, 0, 9, BADGE_COLOR);
      badgeContainer.add(badgeCircle);

      badgeText = scene.add.text(0, 0, item.badge > 9 ? "9+" : `${item.badge}`, {
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      badgeText.setOrigin(0.5);
      badgeContainer.add(badgeText);

      // Pulse animation
      scene.tweens.add({
        targets: badgeCircle,
        scale: { from: 1, to: 1.15 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    navItems.set(item.id, {
      container: itemContainer,
      badge: badgeContainer,
      badgeText,
      iconText,
      labelText,
    });

    // Hover effect
    hitArea.on("pointerover", () => {
      if (item.id !== activeId) {
        labelText.setColor("#aaaaaa");
      }
    });

    hitArea.on("pointerout", () => {
      if (item.id !== activeId) {
        labelText.setColor("#888888");
      }
    });

    // Click handler
    hitArea.on("pointerdown", () => {
      audioManager.playMenuSelect();

      if (item.onClick) {
        item.onClick();
      } else if (item.scene) {
        transitionToScene(scene, item.scene, TransitionType.FADE, DURATION.FAST);
      }
    });
  });

  const updateBadge = (id: string, count: number) => {
    const navItem = navItems.get(id);
    if (!navItem) return;

    if (count > 0) {
      if (!navItem.badge) {
        // Create badge
        const itemContainer = navItem.container;
        const badgeContainer = scene.add.container(12, -18);
        itemContainer.add(badgeContainer);

        const badgeCircle = scene.add.circle(0, 0, 9, BADGE_COLOR);
        badgeContainer.add(badgeCircle);

        const badgeText = scene.add.text(0, 0, count > 9 ? "9+" : `${count}`, {
          fontSize: "10px",
          color: "#ffffff",
          fontStyle: "bold",
        });
        badgeText.setOrigin(0.5);
        badgeContainer.add(badgeText);

        navItem.badge = badgeContainer;
        navItem.badgeText = badgeText;

        scene.tweens.add({
          targets: badgeCircle,
          scale: { from: 1, to: 1.15 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      } else if (navItem.badgeText) {
        navItem.badgeText.setText(count > 9 ? "9+" : `${count}`);
      }
    } else if (navItem.badge) {
      navItem.badge.destroy();
      navItem.badge = undefined;
      navItem.badgeText = undefined;
    }
  };

  const setActive = (id: string) => {
    navItems.forEach((navItem, itemId) => {
      const isActive = itemId === id;
      navItem.labelText.setColor(isActive ? "#4a9eff" : "#888888");
    });
  };

  const getHeight = () => NAV_HEIGHT;

  const destroy = () => {
    container.destroy();
  };

  return {
    container,
    updateBadge,
    setActive,
    getHeight,
    destroy,
  };
}

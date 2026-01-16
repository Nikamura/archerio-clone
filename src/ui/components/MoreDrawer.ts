import Phaser from "phaser";
import { audioManager } from "../../systems/AudioManager";
import { transitionToScene, TransitionType, DURATION } from "../../systems/UIAnimations";

export interface DrawerItem {
  id: string;
  icon: string;
  label: string;
  scene: string;
  badge?: number;
}

export interface MoreDrawerConfig {
  scene: Phaser.Scene;
  items: DrawerItem[];
  onClose?: () => void;
}

export interface MoreDrawerResult {
  show: () => void;
  hide: () => void;
  updateBadge: (id: string, count: number) => void;
  isVisible: () => boolean;
  destroy: () => void;
}

const DRAWER_ITEM_HEIGHT = 50;
const BADGE_COLOR = 0xff4444;

/**
 * MoreDrawer - Slide-up drawer for secondary navigation items
 */
export function createMoreDrawer(config: MoreDrawerConfig): MoreDrawerResult {
  const { scene, items, onClose } = config;

  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;
  const drawerHeight = items.length * DRAWER_ITEM_HEIGHT + 60; // Items + header + padding

  let visible = false;

  // Container starts off-screen
  const container = scene.add.container(0, height);
  container.setDepth(100);
  container.setVisible(false);

  // Overlay (darkens background)
  const overlay = scene.add.rectangle(width / 2, -height / 2, width, height, 0x000000, 0.5);
  overlay.setInteractive();
  container.add(overlay);

  // Drawer background
  const drawerBg = scene.add.rectangle(width / 2, drawerHeight / 2, width, drawerHeight, 0x1a1a2e);
  drawerBg.setStrokeStyle(1, 0x333344);
  container.add(drawerBg);

  // Handle bar at top
  const handleBar = scene.add.rectangle(width / 2, 12, 40, 4, 0x555566);
  handleBar.setAlpha(0.8);
  container.add(handleBar);

  // Drawer items
  const drawerItems: Map<
    string,
    {
      container: Phaser.GameObjects.Container;
      badge?: Phaser.GameObjects.Container;
      badgeText?: Phaser.GameObjects.Text;
    }
  > = new Map();

  items.forEach((item, index) => {
    const itemY = 35 + index * DRAWER_ITEM_HEIGHT;

    const itemContainer = scene.add.container(0, itemY);
    container.add(itemContainer);

    // Hit area (full width)
    const hitArea = scene.add.rectangle(
      width / 2,
      0,
      width - 20,
      DRAWER_ITEM_HEIGHT - 6,
      0x2a2a4e,
      0,
    );
    hitArea.setInteractive({ useHandCursor: true });
    itemContainer.add(hitArea);

    // Icon
    const icon = scene.add.text(30, 0, item.icon, {
      fontSize: "22px",
    });
    icon.setOrigin(0, 0.5);
    itemContainer.add(icon);

    // Label
    const label = scene.add.text(65, 0, item.label, {
      fontSize: "16px",
      color: "#ffffff",
    });
    label.setOrigin(0, 0.5);
    itemContainer.add(label);

    // Badge (if present)
    let badgeContainer: Phaser.GameObjects.Container | undefined;
    let badgeText: Phaser.GameObjects.Text | undefined;

    if (item.badge && item.badge > 0) {
      badgeContainer = scene.add.container(width - 40, 0);
      itemContainer.add(badgeContainer);

      const badgeCircle = scene.add.circle(0, 0, 12, BADGE_COLOR);
      badgeContainer.add(badgeCircle);

      badgeText = scene.add.text(0, 0, item.badge > 99 ? "99+" : `${item.badge}`, {
        fontSize: "11px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      badgeText.setOrigin(0.5);
      badgeContainer.add(badgeText);
    }

    // Arrow indicator
    const arrow = scene.add.text(width - 20, 0, "›", {
      fontSize: "20px",
      color: "#666666",
    });
    arrow.setOrigin(1, 0.5);
    itemContainer.add(arrow);

    drawerItems.set(item.id, {
      container: itemContainer,
      badge: badgeContainer,
      badgeText,
    });

    // Hover effect
    hitArea.on("pointerover", () => {
      hitArea.setFillStyle(0x3a3a5e, 1);
    });

    hitArea.on("pointerout", () => {
      hitArea.setFillStyle(0x2a2a4e, 0);
    });

    // Click handler
    hitArea.on("pointerdown", () => {
      audioManager.playMenuSelect();
      hide();
      transitionToScene(scene, item.scene, TransitionType.FADE, DURATION.FAST);
    });
  });

  // Close when clicking overlay
  overlay.on("pointerdown", () => {
    hide();
    onClose?.();
  });

  const show = () => {
    if (visible) return;
    visible = true;
    container.setVisible(true);

    scene.tweens.add({
      targets: container,
      y: height - drawerHeight,
      duration: 200,
      ease: "Back.easeOut",
    });
  };

  const hide = () => {
    if (!visible) return;

    scene.tweens.add({
      targets: container,
      y: height,
      duration: 150,
      ease: "Quad.easeIn",
      onComplete: () => {
        visible = false;
        container.setVisible(false);
      },
    });
  };

  const updateBadge = (id: string, count: number) => {
    const drawerItem = drawerItems.get(id);
    if (!drawerItem) return;

    if (count > 0) {
      if (!drawerItem.badge) {
        const itemContainer = drawerItem.container;
        const badgeContainer = scene.add.container(width - 40, 0);
        itemContainer.add(badgeContainer);

        const badgeCircle = scene.add.circle(0, 0, 12, BADGE_COLOR);
        badgeContainer.add(badgeCircle);

        const badgeText = scene.add.text(0, 0, count > 99 ? "99+" : `${count}`, {
          fontSize: "11px",
          color: "#ffffff",
          fontStyle: "bold",
        });
        badgeText.setOrigin(0.5);
        badgeContainer.add(badgeText);

        drawerItem.badge = badgeContainer;
        drawerItem.badgeText = badgeText;
      } else if (drawerItem.badgeText) {
        drawerItem.badgeText.setText(count > 99 ? "99+" : `${count}`);
      }
    } else if (drawerItem.badge) {
      drawerItem.badge.destroy();
      drawerItem.badge = undefined;
      drawerItem.badgeText = undefined;
    }
  };

  const isVisible = () => visible;

  const destroy = () => {
    container.destroy();
  };

  return {
    show,
    hide,
    updateBadge,
    isVisible,
    destroy,
  };
}

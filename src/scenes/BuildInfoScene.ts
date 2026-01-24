import Phaser from "phaser";

/**
 * Persistent overlay scene that displays the build date in the bottom left corner.
 * This scene runs on top of all other scenes and is launched once during preloader.
 */
export default class BuildInfoScene extends Phaser.Scene {
  constructor() {
    super({ key: "BuildInfoScene" });
  }

  create() {
    const height = this.cameras.main.height;

    // Build date text - visible positioning in bottom left
    const buildText = this.add.text(6, height - 4, __BUILD_DATE__, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#666666",
    });
    buildText.setOrigin(0, 1);
    buildText.setAlpha(0.85);
    buildText.setDepth(1000);
  }
}

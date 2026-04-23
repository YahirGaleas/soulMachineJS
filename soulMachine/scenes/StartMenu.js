export default class MainMenu extends Phaser.Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        const { width, height } = this.scale;

        // Fondo (opcional)
        this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a1a).setOrigin(0);

        // Título
        this.add.text(width / 2, height / 3, "Soul Machine", {
            fontSize: "48px",
            color: "#ffffff"
        }).setOrigin(0.5);

        // Botón DEBUG
        const debugButton = this.add.text(width / 2, height / 2, "DEBUG", {
            fontSize: "32px",
            backgroundColor: "#000",
            padding: { x: 20, y: 10 },
            color: "#00ff00"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        // Hover efecto
        debugButton.on("pointerover", () => {
            debugButton.setStyle({ backgroundColor: "#333" });
        });

        debugButton.on("pointerout", () => {
            debugButton.setStyle({ backgroundColor: "#000" });
        });

        // Click → cambiar escena
        debugButton.on("pointerdown", () => {
            this.scene.start("DebugLevel");
        });
    }
}
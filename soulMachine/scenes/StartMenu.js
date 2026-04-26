export default class MainMenu extends Phaser.Scene {
    constructor() {
        super("MainMenu");
    }

    // Preload - cargar logo
    preload() {
        this.load.image('logo', 'assets/logo/HiPaint_1777187142559.png');
        
        // Handler de errores de carga
        this.load.on('loaderror', (file) => {
            console.warn(`Error cargando logo: ${file.src}`);
        });
    }

    create() {
        const { width, height } = this.scale;

        // Fondo blanco
        this.add.rectangle(0, 0, width * 2, height * 2, 0xffffff).setOrigin(0);

        // Logo en lugar del título de texto
        if (this.textures.exists('logo')) {
            const logo = this.add.image(width / 2, height / 6, 'logo');
            // Escalar el logo
            const logoScale = Math.min((width * 0.8) / logo.width, (height * 0.45) / logo.height);
            logo.setScale(logoScale);
        } else {
            // Fallback si no se carga el logo
            this.add.text(width / 2, height / 6, "Soul Machine", {
                fontSize: "48px",
                color: "#000000",
                fontStyle: "bold"
            }).setOrigin(0.5);
        }

        // Botón principal EMPEZAR
        this.time.delayedCall(100, () => {
            this.createMainButton();
        });
    }

    createMainButton() {
        const { width, height } = this.scale;
        
        // BOTÓN PRINCIPAL: EMPEZAR HISTORIA
        const startButton = this.add.text(width / 2, height / 2, "EMPEZAR", {
            fontSize: "32px",
            backgroundColor: "#00ff00",
            padding: { x: 30, y: 15 },
            color: "#000000",
            fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.addButtonEffects(startButton, () => {
            console.log('Iniciando historia...');
            // Comenzar con el primer comic
            this.scene.start("ComicScene", { 
                comicNumber: 1,
                gameProgress: 'comic_1' 
            });
        });

        // SECCIÓN: OPCIONES DE DESARROLLO
        this.add.text(width / 2, height / 2 + 80, "OPCIONES DE DESARROLLO", {
            fontSize: "18px",
            color: "#333333",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // Botón DEBUG para testing rápido
        const debugButton = this.add.text(width / 2 - 100, height / 2 + 120, "DEBUG", {
            fontSize: "16px",
            backgroundColor: "#dddddd",
            padding: { x: 15, y: 8 },
            color: "#ff8800"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.addButtonEffects(debugButton, () => {
            this.scene.start("DebugLevel"); // Sin pasar datos de nivel
        });

        // Botón para acceso directo a comics (para testing)
        const comicsButton = this.add.text(width / 2 + 100, height / 2 + 120, "COMICS", {
            fontSize: "16px",
            backgroundColor: "#dddddd",
            padding: { x: 15, y: 8 },
            color: "#0088cc"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.addButtonEffects(comicsButton, () => {
            // Menú rápido para testear comics
            this.showComicTestMenu();
        });

        
        this.add.text(width / 2, height - 60, "CONTROLES DEL JUEGO", {
            fontSize: "14px",
            color: "#000000",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 40, "WASD: Movimiento  |  Click: Disparar  |  ESPACIO: Esconderse", {
            fontSize: "12px",
            color: "#555555"
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 20, "V: Visión enemigos  |  P: Rutas patrulla  |  C: Efectos CRT", {
            fontSize: "12px",
            color: "#555555"
        }).setOrigin(0.5);
    }

    showComicTestMenu() {
        const { width, height } = this.scale;
        
        // Limpiar pantalla
        this.children.removeAll();
        
        // Fondo blanco para el menú de testing
        this.add.rectangle(0, 0, width * 2, height * 2, 0xffffff).setOrigin(0);
        
        // Título
        this.add.text(width / 2, height / 6, "TEST DE COMICS", {
            fontSize: "24px",
            color: "#000000",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // Botones para cada comic
        [1, 2, 3].forEach((comicNum, index) => {
            const button = this.add.text(width / 2, height / 2 + (index * 50), `Comic ${comicNum}`, {
                fontSize: "20px",
                backgroundColor: "#e0e0e0",
                padding: { x: 20, y: 10 },
                color: "#0088cc"
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

            this.addButtonEffects(button, () => {
                this.scene.start("ComicScene", { 
                    comicNumber: comicNum,
                    gameProgress: `comic_${comicNum}` 
                });
            });
        });

        // Botón volver
        const backButton = this.add.text(width / 2, height - 80, "← VOLVER", {
            fontSize: "18px",
            backgroundColor: "#dddddd",
            padding: { x: 15, y: 8 },
            color: "#000000"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.addButtonEffects(backButton, () => {
            this.scene.restart();
        });
    }

    addButtonEffects(button, clickCallback) {
        const originalStyle = { ...button.style };
        
        button.on("pointerover", () => {
            button.setStyle({ backgroundColor: "#cccccc" });
        });

        button.on("pointerout", () => {
            button.setStyle({ backgroundColor: originalStyle.backgroundColor });
        });

        button.on("pointerdown", () => {
            button.setStyle({ backgroundColor: "#aaaaaa" });
        });

        button.on("pointerup", clickCallback);
    }
}
export default class ComicScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ComicScene' });
        this.comicData = null;
        this.textBox = null;
        this.displayedText = '';
        this.fullText = '';
        this.typewriterEvent = null;
        this.isTyping = false;
        this.canContinue = true;
    }

    
    // Init - recibe el número del comic y el progreso del juego
    init(data) {
        this.comicNumber = data?.comicNumber ?? 1;
        this.gameProgress = data?.gameProgress ?? null;
        
        console.log(`Iniciando Comic ${this.comicNumber}`);
        
        // Datos de los comics
        this.comicData = {
            1: {
        image: 'comic_1',
        text: 'Profesor, en este apocalipsis te he mantenido vivo. Como tu hijo, necesito un alma para ser como tú. Busca almas para poder procesar la mía y ten cuidado con los esbirros de la muerte. Escóndete de ser necesario. Ten cuidado.'
    },
            2: {
                image: 'comic_2', 
                text: 'Profesor, la data me ha permitido ver que necesito un cuerpo para estar junto a ti. Quiero ser como tú, quiero estar vivo, así que empecé a crear el propio mío. Más almas, profesor... Ya casi soy como tú.'
            },
            3: {
                image: 'comic_3',
                text: 'Profesor, gracias... Por fin entendí... Padre, te quiero mucho y no quiero que este mundo te destruya y te aleje de mí, así que te protegeré y no permitiré que tu alma sea arrebatada... Padre, te quiero mucho.'
            }
        };
        
        this.fullText = this.comicData[this.comicNumber]?.text ?? 'Texto no disponible';
    }

    
    // Preload
    preload() {
        // Cargar imágenes de comics
        this.load.image('comic_1', 'assets/comics/comic_1.png');
        this.load.image('comic_2', 'assets/comics/comic_2.png');
        this.load.image('comic_3', 'assets/comics/comic_3.png');
        
        this.load.on('loaderror', (file) => {
            console.warn(`Error cargando: ${file.src}`);
        });
    }

    // Create
    create() {
        const { width, height } = this.scale;
        
        // Verificar que la imagen del comic existe
        const imageKey = this.comicData[this.comicNumber].image;
        if (!this.textures.exists(imageKey)) {
            console.error(`Imagen del comic ${this.comicNumber} no encontrada: ${imageKey}`);
            // Crear un fondo de fallback
            this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a);
            this.add.text(width / 2, height / 2, `Comic ${this.comicNumber}\\n(Imagen no encontrada)`, {
                fontSize: '24px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
        } else {
            // Imagen de fondo del comic
            const comicImage = this.add.image(width / 2, height / 2, imageKey);
            
            // Escalar la imagen para que cubra toda la pantalla manteniendo aspecto
            const scaleX = width / comicImage.width;
            const scaleY = height / comicImage.height;
            const scale = Math.max(scaleX, scaleY);
            comicImage.setScale(scale);
        }
        
        // Crear caja de texto (inicialmente invisible)
        this.createTextBox();
        
        // Instrucciones iniciales
        const instructionText = this.add.text(width / 2, height - 30, 
            'Haz click para continuar', {
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5).setAlpha(0.8);
        
        // Hacer toda la pantalla clickeable
        this.input.on('pointerdown', this.handleClick, this);
        
        // Flag para controlar la primera interacción
        this.firstClick = true;
    }

    // Crear caja de texto estilo visual novel
    createTextBox() {
        const { width, height } = this.scale;
        
        // Dimensiones de la caja de texto
        const boxWidth = width * 0.9;
        const boxHeight = height * 0.25;
        const boxX = width / 2;
        const boxY = height - (boxHeight / 2) - 20;
        
        // Fondo semi-transparente
        this.textBox = this.add.rectangle(boxX, boxY, boxWidth, boxHeight, 0x000000, 0.7);
        this.textBox.setStrokeStyle(2, 0xffffff, 0.5);
        this.textBox.setVisible(false);
        
        // Texto que se escribirá gradualmente
        this.textDisplay = this.add.text(boxX, boxY, '', {
            fontSize: '18px',
            color: '#ffffff',
            wordWrap: { 
                width: boxWidth - 40,
                useAdvancedWrap: true 
            },
            align: 'left',
            lineSpacing: 8
        }).setOrigin(0.5).setVisible(false);
        
        // Indicador de "continuar"
        this.continueIndicator = this.add.text(boxX + (boxWidth / 2) - 30, boxY + (boxHeight / 2) - 20,
            '▶', {
                fontSize: '16px',
                color: '#00ff00'
            }
        ).setOrigin(0.5).setVisible(false);
        
        // Animación parpadeante para el indicador
        this.tweens.add({
            targets: this.continueIndicator,
            alpha: { from: 0.3, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }

    // Manejar clicks del usuario
    handleClick() {
        if (this.firstClick) {
            // Primer click: mostrar caja de texto e iniciar typewriter
            this.showTextBox();
            this.startTypewriter();
            this.firstClick = false;
        } else if (this.isTyping) {
            // Si está escribiendo, completar el texto inmediatamente
            this.completeText();
        } else if (this.canContinue) {
            // Segundo click: ir al siguiente nivel o comic
            this.proceedToNext();
        }
    }

    // Mostrar caja de texto
    showTextBox() {
        this.textBox.setVisible(true);
        this.textDisplay.setVisible(true);
        
        // Animación de entrada suave
        this.textBox.setAlpha(0);
        this.textDisplay.setAlpha(0);
        
        this.tweens.add({
            targets: [this.textBox, this.textDisplay],
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }

    // Efecto de escritura gradual
    startTypewriter() {
        this.displayedText = '';
        this.isTyping = true;
        this.canContinue = false;
        this.continueIndicator.setVisible(false);
        
        let textIndex = 0;
        const typingSpeed = 50; // milisegundos por carácter
        
        this.typewriterEvent = this.time.addEvent({
            delay: typingSpeed,
            callback: () => {
                if (textIndex < this.fullText.length) {
                    this.displayedText += this.fullText[textIndex];
                    this.textDisplay.setText(this.displayedText);
                    textIndex++;
                } else {
                    // Termine de escribir
                    this.typewriterEvent?.remove();
                    this.isTyping = false;
                    this.canContinue = true;
                    this.continueIndicator.setVisible(true);
                }
            },
            loop: true
        });
    }

    // Completar texto inmediatamente
    completeText() {
        if (this.typewriterEvent) {
            this.typewriterEvent.remove();
        }
        
        this.displayedText = this.fullText;
        this.textDisplay.setText(this.displayedText);
        this.isTyping = false;
        this.canContinue = true;
        this.continueIndicator.setVisible(true);
    }

    // Proceder al siguiente nivel o comic según la progresión
    proceedToNext() {
        // Definir la secuencia: Comic 1 → Nivel 1 → Nivel 2 → Comic 2 → Nivel 6 → Comic 3 → Menú
        const sequence = {
            'comic_1': { type: 'level', target: '1', nextProgress: 'level_1_completed' },
            'level_1_completed': { type: 'level', target: '2', nextProgress: 'level_2_completed' },
            'level_2_completed': { type: 'comic', target: 2, nextProgress: 'comic_2' },
            'comic_2': { type: 'level', target: '6', nextProgress: 'level_6_completed' },
            'level_6_completed': { type: 'comic', target: 3, nextProgress: 'comic_3' },
            'comic_3': { type: 'menu', nextProgress: 'story_completed' }
        };
        
        const currentProgress = this.gameProgress || `comic_${this.comicNumber}`;
        const next = sequence[currentProgress];
        
        if (!next) {
            console.warn('Progresión no definida, volviendo al menú');
            this.scene.start('MainMenu');
            return;
        }
        
        // Transición suave
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.time.delayedCall(500, () => {
            if (next.type === 'level') {
                // Ir a un nivel específico
                const levelData = window.GameLevelManager.getLevel(next.target);
                this.scene.start('DebugLevel', { 
                    level: levelData, 
                    gameProgress: next.nextProgress 
                });
            } else if (next.type === 'comic') {
                // Ir al siguiente comic
                this.scene.start('ComicScene', { 
                    comicNumber: next.target,
                    gameProgress: next.nextProgress 
                });
            } else if (next.type === 'menu') {
                // Volver al menú principal
                this.scene.start('MainMenu');
            }
        });
    }
}
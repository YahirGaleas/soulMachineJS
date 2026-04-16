export default class Level1 extends Phaser.Scene {
    constructor() {
        super("Level1");
    }

    preload() {
        // Crear texturas simples para las almas y paredes (sin renderizar en pantalla)
        let soulGraphics = this.add
            .graphics()
            .fillStyle(0x00ff00)
            .fillCircle(16, 16, 16)
            .generateTexture("soul", 32, 32);
        soulGraphics.destroy(); // Eliminar después de crear la textura

        let wallGraphics = this.add
            .graphics()
            .fillStyle(0x8b4513)
            .fillRect(0, 0, 50, 50)
            .generateTexture("wall", 50, 50);
        wallGraphics.destroy(); // Eliminar después de crear la textura

        // Crear textura para el área de captura (sin renderizar en pantalla)
        let captureGraphics = this.add
            .graphics()
            .fillStyle(0x0000ff, 0.5)
            .fillRect(0, 0, 200, 200)
            .generateTexture("captureArea", 200, 200);
        captureGraphics.destroy(); // Eliminar después de crear la textura

        // Gráficos distintivos de los armarios (sin renderizar en pantalla)
        let cabinetGraphics = this.add
            .graphics()
            .fillStyle(0x654321)
            .fillRect(0, 0, 40, 60)
            .generateTexture("cabinet", 40, 60);
        cabinetGraphics.destroy(); // Eliminar después de crear la textura
    }

    create() {
        //FPS
        this.fpsText = this.add.text(10, 10, "", {
            font: "16px Arial",
            fill: "#ffffff",
        });

        // Debug: Coordenadas del mapa con el mouse
        this.coordText = this.add.text(10, 30, "", {
            font: "14px Arial",
            fill: "#00ff00",
        });

        // Instrucciones de control
        this.controlsText = this.add.text(
            10,
            50,
            "Presiona V para activar/desactivar visión del enemigo",
            {
                font: "12px Arial",
                fill: "#ffff00",
            },
        );

        //jugador
        player = this.add.circle(400, 300, 20, 0xffffff);
        this.physics.add.existing(player);
        player.body.setCollideWorldBounds(true);

        // Enemigo en base a estados (movido lejos de las paredes y con color rojo)
        enemy = this.add.circle(65, 555, 20, 0xff0000); // Color rojo para distinguirlo
        this.physics.add.existing(enemy);
        enemy.body.setCollideWorldBounds(true);
        enemy.state = "patrol";
        enemy.rotation = 0; // Inicializar rotación del enemigo
        targetEnemyRotation = 0; // Inicializar rotación objetivo

        // Crear gráfico para el área de visión del enemigo
        enemyVisionGraphics = this.add.graphics();
        enemyVisionGraphics.setDepth(-1); // Ponerlo detrás de otros objetos

        //arma
        gun = this.add.rectangle(420, 300, 20, 10, 0xf03418); // rectangulo rojo

        //Controles
        cursors = this.input.keyboard.createCursorKeys();
        keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        keyV = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V); // Tecla para toggle de visión

        //Souls
        this.souls = this.physics.add.group();

        this.souls.create(600, 300, "soul");
        this.souls.create(500, 200, "soul");
        totalSouls = this.souls.getChildren().length; // Actualizar el total de almas

        //Cooldown para el disparo y disparo
        this.shootCooldown = false;
        this.input.on("pointerdown", shoot, this);

        //Paredes y obstaculos
        this.walls = this.physics.add.staticGroup();
        this.walls.create(200, 150, "wall").setScale(2).refreshBody();
        this.walls.create(600, 450, "wall").setScale(2).refreshBody();

        // arriba
        this.walls.create(400, 0, "wall").setScale(16, 0.2).refreshBody();

        // abajo
        this.walls.create(400, 600, "wall").setScale(16, 0.2).refreshBody();

        // izquierda
        this.walls.create(0, 300, "wall").setScale(0.2, 12).refreshBody();

        // derecha
        this.walls.create(800, 300, "wall").setScale(0.2, 12).refreshBody();

        //Colisiones de las paredes con el jugador
        this.physics.add.collider(player, this.walls);
        this.physics.add.collider(enemy, this.walls);
        this.physics.add.collider(player, enemy);

        //Armarios para esconderse
        this.cabinets = this.physics.add.staticGroup();
        this.cabinets.create(300, 400, "cabinet").setScale(1.5).refreshBody();
        this.cabinets.create(500, 100, "cabinet").setScale(1.5).refreshBody();
        //colisiones de los armarios con el jugador
        this.physics.add.collider(player, this.cabinets);
        this.physics.add.collider(enemy, this.cabinets);

        //Área de captura para esconderse, aunque no es un área física, la usaremos para verificar si el jugador puede esconderse
        this.hideArea = this.physics.add.staticGroup();
        //Al frente de los 2 cabinetes de prueba actuales para que el jugador pueda esconderse
        this.hideArea.create(300, 400, "captureArea").setScale(0.5).refreshBody();
        this.hideArea.create(500, 100, "captureArea").setScale(0.5).refreshBody();

        buildNavGrid(this.walls, this.cabinets);
    }

    update() {
        // Establecer referencia del scene actual para acceso global
        currentScene = this;

        // Mostrar coordenadas del mouse para debug
        const pointer = this.input.activePointer;

        this.coordText.setText(
            `Mouse: (${Math.floor(pointer.worldX)}, ${Math.floor(pointer.worldY)})`
        );

        // Movimiento del jugador (solo si está vivo y no escondido)
        if (!isHidden && isAlive) {
            if (keyA.isDown) {
                player.body.setVelocityX(-300);
            } else if (keyD.isDown) {
                player.body.setVelocityX(300);
            } else {
                player.body.setVelocityX(0);
            }

            if (keyW.isDown) {
                player.body.setVelocityY(-300);
            } else if (keyS.isDown) {
                player.body.setVelocityY(300);
            } else {
                player.body.setVelocityY(0);
            }
        } else {
            player.body.setVelocity(0, 0);
        }

        // Posición del arma según la posición del mouse (solo si está vivo y no escondido)
        if (isAlive && !isHidden) {
            if (this.input.mousePointer.x > player.x) {
                gun.x = player.x + 20;
                let angle = Phaser.Math.Angle.Between(
                    player.x,
                    player.y,
                    this.input.mousePointer.x,
                    this.input.mousePointer.y,
                );
                gun.rotation = angle;
            } else {
                gun.x = player.x - 20;
                let angle = Phaser.Math.Angle.Between(
                    player.x,
                    player.y,
                    this.input.mousePointer.x,
                    this.input.mousePointer.y,
                );
                gun.rotation = angle;
            }
            // El arma siempre mantiene la misma Y que el jugador
            gun.y = player.y;
        }

        if (Phaser.Input.Keyboard.JustDown(keySpace) && isAlive) {
            hidePlayer(player, this.hideArea);
        }

        // Toggle para mostrar/ocultar área de visión del enemigo
        if (Phaser.Input.Keyboard.JustDown(keyV)) {
            showEnemyVision = !showEnemyVision;
            if (!showEnemyVision) {
                enemyVisionGraphics.clear();
            }
            console.log(`Visión del enemigo: ${showEnemyVision ? 'Activada' : 'Desactivada'}`);
        }

        // Actualizar FPS
        this.fpsText.setText(`FPS: ${Math.floor(this.game.loop.actualFps)}`);

        // Actualizar comportamiento del enemigo
        reaperUpdate(this.walls, this.cabinets);

        // Dibujar área de visión del enemigo
        if (showEnemyVision) {
            drawEnemyVision(this.walls, this.cabinets);
        }
    }
}

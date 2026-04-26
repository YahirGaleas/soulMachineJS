import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import CRTEffect from '../utils/CRTEffect.js';
import AdaptiveCamera from '../utils/AdaptiveCamera.js';

export default class DebugLevel extends Phaser.Scene {

    constructor() {
        super({ key: 'DebugLevel' });
        this._levelData = null;
    }

    // init — recibe el JSON del nivel desde main.js o desde otra escena
    // Uso: this.scene.start('DebugLevel', { level: myLevelJson })
    init(data) {
        this._levelData = data?.level ?? null;
        this.gameProgress = data?.gameProgress ?? null;

        if (this._levelData) {
            console.log('DebugLevel: Cargando nivel:', this._levelData.name || 'Nivel personalizado');
            console.log('Progreso del juego:', this.gameProgress);
        } else {
            console.log('DebugLevel: Modo debug sin nivel específico');
        }
    }

    // Preload
    preload() {
        // Textura 20×20 para tiles individuales del editor
        this._makeTexture('soul', gfx => gfx.fillStyle(0x00ff00).fillCircle(16, 16, 16), 32, 32);
        this._makeTexture('wall', gfx => gfx.fillStyle(0xffffff).fillRect(0, 0, 20, 20), 20, 20);
        this._makeTexture('captureArea', gfx => gfx.fillStyle(0x0000ff, 0.18).fillRect(0, 0, 200, 200), 200, 200);
        this._makeTexture('cabinet', gfx => gfx.fillStyle(0x654321).fillRect(0, 0, 20, 20), 20, 20);

        // Sprites del jugador
        // Cargar secuencias de animación (32x32 cada frame)
        for (let i = 0; i <= 3; i++) {
            this.load.image(`player_idle_${i}`, `assets/idle/idle_0${i}.png`);
        }

        for (let i = 0; i <= 8; i++) {
            this.load.image(`player_walk_${i}`, `assets/walk/walk_0${i}.png`);
        }

        for (let i = 0; i <= 6; i++) {
            this.load.image(`player_death_${i}`, `assets/death/death_0${i}.png`);
        }

        for (let i = 0; i <= 15; i++) {
            this.load.image(`gun_shoot_${i}`, `assets/gun/${i}.png`);
        }

        for (let i = 0; i <= 6; i++) {
            this.load.image(`idle_soul_${i}`, `assets/soul/Soul_0${i}.png`);
        }

        for (let i = 1; i <= 5; i++) {
            this.load.image(`capture_soul_${i}`, `assets/capturedSoul/capturedsou_00l${i}.png`);
        }

        for (let i = 0; i <= 5; i++) {
            this.load.image(`Cabinet_${i}`, `assets/Cabinet/${i}.png`);
        }

        for (let i = 0; i <= 1; i++) {
            this.load.image(`corpse_${i}`, `assets/corpses/corpses_0${i}.png`);
        }

        for (let i = 0; i <= 4; i++) {
            this.load.image(`reaper_${i}`, `assets/enemy/enemy_0${i}.png`);
        }

        for (let i = 0; i <= 4; i++) {
            this.load.image(`reaper_chase_${i}`, `assets/enemyChase/enemyRun_0${i}.png`);
        }

        for (let i = 0; i <= 6; i++) {
            this.load.image(`fast_reaper_${i}`, `assets/enemyFast/${i}.png`);
        }

        for (let i = 0; i <= 6; i++) {
            this.load.image(`fast_reaper_chase_${i}`, `assets/enemyFastChase/${i}.png`);
        }


        // Sprite del arma
        //this._makeTexture('playerGun', gfx => gfx.fillStyle(0xf03418).fillRect(0, 0, 15, 8), 15, 8);

        // Tiles del suelo
        // Cargar las 3 variantes de tiles de suelo
        this.load.image('tile1', 'assets/tiles/tile1.png');
        this.load.image('tile2', 'assets/tiles/tile2.png');
        this.load.image('tile3', 'assets/tiles/tile3.png');
    }

    _makeTexture(key, draw, w, h) {
        const gfx = this.add.graphics();
        draw(gfx);
        gfx.generateTexture(key, w, h);
        gfx.destroy();
    }

    // Create
    create() {
        // HUD
        //this._fpsText      = this.add.text(10, 10, '', { font: '16px Arial', fill: '#ffffff' }).setDepth(10);
        //this._coordText    = this.add.text(10, 30, '', { font: '14px Arial', fill: '#00ff00' }).setDepth(10);
        //this._levelInfo    = this.add.text(10, 50, '', { font: '14px Arial', fill: '#ffff00' }).setDepth(10);
        /*this._controlsText = this.add.text(10, 70,
            'WASD: mover  |  Click: disparar  |  Espacio: escondite  |  V: visión  |  P: patrulla  |  ESC: menú',
            { font: '12px Arial', fill: '#ffff00' }
        ).setDepth(10);
        this._soulsText = this.add.text(10, 90, '', { font: '14px Arial', fill: '#00ffff' }).setDepth(10);
        */

        // Botón para volver al menú (posición relativa al tamaño del juego)
        const gameWidth = this.sys.game.canvas.width;
        this._menuButton = this.add.text(gameWidth - 50, 10, 'MENÚ', {
            font: '14px Arial',
            fill: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 8, y: 4 }
        })
            .setOrigin(1, 0)
            .setDepth(10)
            .setScrollFactor(0) // Mantener fijo en pantalla durante zooms
            .setInteractive({ useHandCursor: true });

        this._menuButton.on('pointerover', () => {
            this._menuButton.setStyle({ backgroundColor: '#666666' });
        });

        this._menuButton.on('pointerout', () => {
            this._menuButton.setStyle({ backgroundColor: '#333333' });
        });

        this._menuButton.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
        // Animaciones del jugador
        this._createPlayerAnimations();

        // Animaciones del arma
        this._CreateGunAnimations();

        // Animaciones del alma
        this._createSoulAnimations();

        // Animaciones del armario
        this._createCabinetAnimations();
        // Animaciones del Reaper
        this._createReaperAnimations();


        // Grupos de física
        this.walls = this.physics.add.staticGroup();
        this.cabinets = this.physics.add.staticGroup();
        this.hideAreas = this.physics.add.staticGroup();
        this.souls = this.physics.add.group();
        this.enemies = [];

        // Grupo para los tiles del suelo (solo visual, sin física)
        this.floorTiles = this.add.group();

        // Visualización de patrulla
        this._patrolGraphics = this.add.graphics();
        this._patrolGraphics.setDepth(5); // Por encima del fondo, debajo del HUD
        this._showPatrolRoutes = false;

        // Colores únicos para cada enemigo (hasta 10 enemigos)
        this._patrolColors = [
            0x00ff88, // Verde agua
            0xff4488, // Rosa
            0x4488ff, // Azul cielo  
            0xffaa00, // Naranja
            0xaa44ff, // Violeta
            0x44ffaa, // Verde claro
            0xff8844, // Naranja rojizo
            0x8844ff, // Morado
            0xffff44, // Amarillo
            0x44ffff  // Cyan
        ];

        // Cargar nivel
        if (this._levelData) {
            this._loadLevel(this._levelData);
        } else {
            this._loadFallback();
        }

        // Controles
        this._keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            v: Phaser.Input.Keyboard.KeyCodes.V,
            p: Phaser.Input.Keyboard.KeyCodes.P,  // Toggle patrol visualization
            c: Phaser.Input.Keyboard.KeyCodes.C,  // Toggle CRT effect
            t: Phaser.Input.Keyboard.KeyCodes.T,  // Toggle auto camera
            one: Phaser.Input.Keyboard.KeyCodes.ONE,
            two: Phaser.Input.Keyboard.KeyCodes.TWO,
            three: Phaser.Input.Keyboard.KeyCodes.THREE,
            four: Phaser.Input.Keyboard.KeyCodes.FOUR,
            esc: Phaser.Input.Keyboard.KeyCodes.ESC
        });

        this._shootCooldown = false;
        this.input.on('pointerdown', this._handleShoot, this);

        // Actualizar info del nivel en el HUD
        /*if (this._levelData) {
            this._levelInfo.setText(`Nivel: ${this._levelData.name || 'Personalizado'} | Tamaño: ${this._levelData.mapSize?.width || 800}x${this._levelData.mapSize?.height || 600}`);
        } else {
            this._levelInfo.setText('Modo Debug - Sin nivel específico');
        }
        */

        // Cámara principal (mundo)
        this.mainCamera = this.cameras.main;

        // Cámara para HUD
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1);
        this.uiCamera.setName('ui');

        this.mainCamera.ignore([
            this._menuButton,
        ]);

        // Sistema CRT con análisis de IA
        this.crtEffect = new CRTEffect(this);
        this.crtEffect.enable(); // Activar por defecto

        this.mainCamera.ignore([
            this.crtEffect.scanlines,
            this.crtEffect.vignette,
            this.crtEffect.interference,
            this.crtEffect.chromaticShift,
            this.crtEffect.aiHUD,
            this.crtEffect.analysisGrid
        ]);

        this.uiCamera.ignore(this.children.list.filter(obj => {
            return obj !== this._menuButton &&
                obj !== this.crtEffect.scanlines &&
                obj !== this.crtEffect.vignette &&
                obj !== this.crtEffect.aiHUD &&
                obj !== this.crtEffect.analysisGrid &&
                obj !== this.crtEffect.interference &&
                obj !== this.crtEffect.chromaticShift;
        }));
        console.log('AI CRT MONITORING SYSTEM INITIALIZED');
        console.log('Controles:');
        console.log('[C] = CRT ON/OFF | [V] = Visión enemigos');
        console.log('[1][2][3] = Modos cámara | [T] = Auto cámara');
        console.log('[P] = Rutas patrulla | [ESC] = Menú');




    }

    // Cargar nivel desde JSON
    _loadLevel(data) {
        const W = data.mapSize?.width ?? 800;
        const H = data.mapSize?.height ?? 600;

        this.physics.world.setBounds(0, 0, W, H);
        this.cameras.main.setBounds(0, 0, W, H);

        // Tiles del suelo
        //this._generateFloorTiles(W, H);

        // Bordes del mundo (física invisible)  
        // Usamos rectángulos gráficos finos en los 4 lados
        const BORDER = 8;
        [
            { x: W / 2, y: -BORDER / 2, w: W + BORDER * 2, h: BORDER },
            { x: W / 2, y: H + BORDER / 2, w: W + BORDER * 2, h: BORDER },
            { x: -BORDER / 2, y: H / 2, w: BORDER, h: H },
            { x: W + BORDER / 2, y: H / 2, w: BORDER, h: H },
        ].forEach(b => {
            const zone = this.add.zone(b.x, b.y, b.w, b.h);
            this.physics.add.existing(zone, true);
            this.walls.add(zone);
        });

        // Paredes
        (data.walls ?? []).forEach(w => {
            // Cada tile del JSON es 20×20 — la textura ya tiene ese tamaño
            this.walls.create(w.x, w.y, 'wall').refreshBody();
        });

        // Armarios
        (data.cabinets ?? []).forEach(c => {
            const cabinet = this.cabinets.create(c.x, c.y, 'Cabinet_0');
            cabinet.setScale(1.5); // Escala para hacer más visible
            cabinet.refreshBody();
            cabinet.play('cabinet_idle'); // Iniciar animación idle
            // Área de escondite centrada en el armario (más grande para facilitar acceso)
            this.hideAreas.create(c.x, c.y, 'captureArea').setScale(0.3).refreshBody();
        });

        // Almas
        (data.souls ?? []).forEach(s => {
            // Corpse decorativo debajo del alma (aleatorio)
            const corpseFrame = Math.random() < 0.5 ? 'corpse_0' : 'corpse_1';
            const corpse = this.add.sprite(s.x, s.y + 10, corpseFrame);
            corpse.setScale(2);
            corpse.setDepth(-2); // Debajo de todo

            // Alma animada
            const soul = this.souls.create(s.x, s.y, 'idle_soul_0');
            soul.setScale(1.2); // Escala para hacer más visible
            soul.body.setCircle(16); // Mantener hitbox circular
            soul.play('soul_idle'); // Iniciar animación idle
            soul.setDepth(1); // Por encima del corpse
        });
        this._totalSouls = this.souls.getChildren().length;
        this._capturedSouls = 0;

        // Jugador
        const spawn = data.playerSpawn ?? { x: 400, y: 300 };
        this.player = new Player(this, spawn.x, spawn.y);
        this.player.addColliders(this.walls, this.cabinets);

        // Sistema de cámara adaptativa
        this.adaptiveCamera = new AdaptiveCamera(this, this.player);
        this.adaptiveCamera.init();

        // Enemigos
        (data.enemies ?? []).forEach(eData => {
            const enemy = new Enemy(this, eData.x, eData.y, {
                type: eData.type ?? 'reaper',
                patrolPoints: eData.patrolPoints ?? [],
            });

            enemy.buildNavigation(this.walls, this.cabinets);
            enemy.addColliders(this.walls, this.cabinets, this.player);
            this.enemies.push(enemy);
        });

        // Colisiones entre enemigos
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                this.physics.add.collider(this.enemies[i].sprite, this.enemies[j].sprite);
            }
        }
    }

    // Cargar nivel de prueba si no se pasa JSON o si hay error al cargar
    _loadFallback() {
        console.warn('DebugLevel: sin JSON — cargando nivel de prueba.');

        const W = 800, H = 600;
        this.physics.world.setBounds(0, 0, W, H);
        this.cameras.main.setBounds(0, 0, W, H);

        // Tiles del suelo
        this._generateFloorTiles(W, H);

        // Bordes invisibles
        const BORDER = 8;
        [
            { x: W / 2, y: -BORDER / 2, w: W + BORDER * 2, h: BORDER },
            { x: W / 2, y: H + BORDER / 2, w: W + BORDER * 2, h: BORDER },
            { x: -BORDER / 2, y: H / 2, w: BORDER, h: H },
            { x: W + BORDER / 2, y: H / 2, w: BORDER, h: H },
        ].forEach(b => {
            const zone = this.add.zone(b.x, b.y, b.w, b.h);
            this.physics.add.existing(zone, true);
            this.walls.add(zone);
        });

        // Paredes de prueba
        this.walls.create(200, 150, 'wall').setScale(2).refreshBody();
        this.walls.create(600, 450, 'wall').setScale(2).refreshBody();

        // Armarios de prueba
        [{ x: 300, y: 400 }, { x: 500, y: 100 }].forEach(pos => {
            const cabinet = this.cabinets.create(pos.x, pos.y, 'Cabinet_0');
            cabinet.setScale(3);
            cabinet.refreshBody();
            cabinet.play('cabinet_idle');
            this.hideAreas.create(pos.x, pos.y, 'captureArea').setScale(0.3).refreshBody();
        });

        // Almas de prueba  
        [{ x: 600, y: 300 }, { x: 500, y: 200 }].forEach(pos => {
            // Corpse decorativo debajo del alma (aleatorio)
            const corpseFrame = Math.random() < 0.5 ? 'corpse_0' : 'corpse_1';
            const corpse = this.add.sprite(pos.x, pos.y + 10, corpseFrame);
            corpse.setScale(2);
            corpse.setDepth(-2);

            // Alma animada
            const soul = this.souls.create(pos.x, pos.y, 'idle_soul_0');
            soul.setScale(2);
            soul.body.setCircle(16);
            soul.play('soul_idle');
            soul.setDepth(1);
        });
        this._totalSouls = 2;
        this._capturedSouls = 0;

        // Jugador
        this.player = new Player(this, 400, 300);
        this.player.addColliders(this.walls, this.cabinets);

        // Sistema de cámara adaptativa
        this.adaptiveCamera = new AdaptiveCamera(this, this.player);
        this.adaptiveCamera.init();

        // Enemigo de prueba
        const enemy = new Enemy(this, 65, 555, {
            type: 'reaper',
            patrolPoints: [
                { x: 100, y: 550 },
                { x: 700, y: 550 },
                { x: 700, y: 50 },
                { x: 100, y: 50 }
            ]
        });
        enemy.buildNavigation(this.walls, this.cabinets);
        enemy.addColliders(this.walls, this.cabinets, this.player);
        this.enemies = [enemy];
    }

    // Update
    update() {
        //Pausar todo si el jugador esta reproduciendo la animacion de muerte menos el movimiento del jugador
        if (!this.player.isAlive) {
            return;
        }
        const ptr = this.input.activePointer;

        //this._fpsText.setText(`FPS: ${Math.floor(this.game.loop.actualFps)}`);
        //this._coordText.setText(`Mouse: (${Math.floor(ptr.worldX)}, ${Math.floor(ptr.worldY)})`);
        //this._soulsText.setText(`Almas: ${this._capturedSouls} / ${this._totalSouls}`);

        // Actualizar contador de almas para el sistema de IA
        if (this.crtEffect) {
            this.crtEffect.updateSoulCount(this._capturedSouls);
        }

        // Actualizar sistema de cámara adaptativa
        if (this.adaptiveCamera) {
            this.adaptiveCamera.update();
            this.adaptiveCamera.handleInput(this._keys);
        }

        // Toggle visión (aplica a todos los enemigos)
        if (Phaser.Input.Keyboard.JustDown(this._keys.v)) {
            this.enemies.forEach(e => e.toggleVision());
        }

        // Toggle visualización de rutas de patrulla
        if (Phaser.Input.Keyboard.JustDown(this._keys.p)) {
            this._showPatrolRoutes = !this._showPatrolRoutes;
            console.log(`Rutas de patrulla: ${this._showPatrolRoutes ? 'ON' : 'OFF'}`);
        }

        // Toggle efectos CRT
        if (Phaser.Input.Keyboard.JustDown(this._keys.c)) {
            this.crtEffect.toggle();
        }

        // Dibujar rutas de patrulla si está activado
        if (this._showPatrolRoutes) {
            this._drawPatrolRoutes();
        } else {
            this._patrolGraphics.clear();
        }

        // Volver al menú con ESC
        if (Phaser.Input.Keyboard.JustDown(this._keys.esc)) {
            this.scene.start('MainMenu');
            return;
        }



        // Movimiento del jugador
        this.player.handleMovement({
            left: this._keys.left.isDown,
            right: this._keys.right.isDown,
            up: this._keys.up.isDown,
            down: this._keys.down.isDown
        });
        this.player.updateGun(ptr);

        // Escondite
        if (Phaser.Input.Keyboard.JustDown(this._keys.space) && this.player.isAlive) {
            this._tryHide();
        }

        // Actualizar todos los enemigos
        this.enemies.forEach(e => e.update(this.player, this.walls, this.cabinets));

    }

    // Helpers privados
    /*
    _generateFloorTiles(worldWidth, worldHeight) {
        // Tamaño base de cada tile (ajustable)
        const TILE_SIZE = 32; // Tamaño base más grande
        const SCALE = 3; // Factor de escala para ajustar el tamaño final
        
        // Calcular cuántos tiles necesitamos en cada dirección
        const tilesX = Math.ceil(worldWidth / (TILE_SIZE * SCALE)) + 1;
        const tilesY = Math.ceil(worldHeight / (TILE_SIZE * SCALE)) + 1;
        
        // Array con los nombres de las texturas de tiles
        const tileTextures = ['tile1', 'tile2', 'tile3'];
        
        // Generar una grilla de tiles
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                // Posición del tile
                const tileX = x * (TILE_SIZE * SCALE);
                const tileY = y * (TILE_SIZE * SCALE);
                
                // Seleccionar textura aleatoria
                const randomTexture = Phaser.Utils.Array.GetRandom(tileTextures);
                
                // Crear el tile
                const tile = this.add.image(tileX, tileY, randomTexture);
                
                // Configurar el tile
                tile.setOrigin(0, 0); // Origen en esquina superior izquierda
                tile.setScale(SCALE); // Aplicar escala
                tile.setDepth(-10); // Enviar al fondo (debajo de todo)
                
                // Añadir al grupo de tiles
                this.floorTiles.add(tile);
                
                // Opcional: añadir una ligera variación de rotación para más naturalidad
                //if (Math.random() < 0.2) { // 20% de probabilidad de rotar
                    //tile.setRotation(Phaser.Math.DegToRad(90 * Math.floor(Math.random() * 4)));
                //}
            }
        }
        
        console.log(`Generados ${tilesX * tilesY} tiles de suelo (${tilesX}x${tilesY})`);
    }*/

    _tryHide() {
        // Verificar qué enemigos específicamente pueden ver al jugador ANTES de esconderse
        const enemiesWhoCanSee = this.enemies.filter(e =>
            e.canSeePlayer(this.player, this.walls, this.cabinets)
        );

        const anyCanSee = enemiesWhoCanSee.length > 0;
        const succeeded = this.player.tryHide(this.hideAreas, this.cabinets, anyCanSee);

        if (succeeded && this.player.isHidden) {
            // Notificar solo a los enemigos que efectivamente vieron la acción
            enemiesWhoCanSee.forEach(e => {
                e.sawPlayerHide = true;
                e.playerHideLocation = { x: this.player.x, y: this.player.y };
                console.log(`Enemigo detectó que te escondiste en (${this.player.x}, ${this.player.y})`);
            });
        }
    }

    _handleShoot(pointer) {
        if (!this.player.isAlive || this._shootCooldown) return;

        this._shootCooldown = true;

        const killed = this.player.shoot(pointer, this.souls, this.walls, this.cabinets);
        this._capturedSouls += killed;

        if (this._capturedSouls >= this._totalSouls) {
            console.log('¡Victoria! Todas las almas capturadas.');
            
            // Sistema de progresión de historia
            this.time.delayedCall(1000, () => {
                this.proceedToNextStoryBeat();
            });
        }

        this.time.delayedCall(2000, () => { this._shootCooldown = false; });
    }

    // Proceder al siguiente punto de la historia
    proceedToNextStoryBeat() {
        // Definir progresión: Comic 1 → Nivel 1 → Nivel 2 → Comic 2 → Nivel 6 → Comic 3 → Menú  
        const progressionMap = {
            'level_1_completed': { type: 'level', target: '2', nextProgress: 'level_2_completed' },
            'level_2_completed': { type: 'comic', target: 2, nextProgress: 'comic_2' },
            'level_6_completed': { type: 'comic', target: 3, nextProgress: 'comic_3' }
        };

        if (this.gameProgress && progressionMap[this.gameProgress]) {
            const next = progressionMap[this.gameProgress];
            
            // Transición suave
            this.cameras.main.fadeOut(500, 0, 0, 0);
            
            this.time.delayedCall(500, () => {
                if (next.type === 'level') {
                    // Ir al siguiente nivel
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
                }
            });
        } else {
            // Sin progreso definido o modo debug - comportamiento original
            console.log('Sin progreso de historia definido, reiniciando nivel');
            this.scene.restart();
        }
    }

    // Visualización de rutas de patrulla
    _drawPatrolRoutes() {
        const g = this._patrolGraphics;
        g.clear();

        this.enemies.forEach((enemy, enemyIndex) => {
            const points = enemy.patrolPoints;
            if (points.length === 0) return;

            const color = this._patrolColors[enemyIndex % this._patrolColors.length];
            const colorHex = `#${color.toString(16).padStart(6, '0')}`;

            // Dibujar líneas de ruta
            if (points.length > 1) {
                g.lineStyle(2, color, 0.7);

                // En Phaser 3, usamos beginPath con strokePath para líneas punteadas
                g.beginPath();

                // Dibujar línea punteada manualmente
                for (let i = 0; i < points.length; i++) {
                    const start = points[i];
                    const end = points[(i + 1) % points.length];
                    this._drawDashedLine(g, start.x, start.y, end.x, end.y, 8, 4);
                }
            }

            // Dibujar puntos de patrulla
            points.forEach((point, pointIndex) => {
                // Círculo del punto
                g.fillStyle(color, 0.8);
                g.fillCircle(point.x, point.y, 8);

                // Borde blanco
                g.lineStyle(2, 0xffffff, 0.9);
                g.strokeCircle(point.x, point.y, 8);

                // Número del punto (orden de patrulla)
                const text = this.add.text(point.x, point.y, (pointIndex + 1).toString(), {
                    font: 'bold 12px Arial',
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                })
                    .setOrigin(0.5, 0.5)
                    .setDepth(6); // Por encima de los gráficos de patrulla

                // Limpiar texto en el próximo frame para evitar acumulación
                this.time.delayedCall(50, () => {
                    if (text && text.scene) text.destroy();
                });
            });

            // Etiqueta del enemigo
            if (points.length > 0) {
                const firstPoint = points[0];
                const label = this.add.text(
                    firstPoint.x,
                    firstPoint.y - 25,
                    `Enemigo ${enemyIndex + 1} (${enemy.type})`,
                    {
                        font: 'bold 10px Arial',
                        fill: colorHex,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: { x: 4, y: 2 }
                    }
                )
                    .setOrigin(0.5, 0.5)
                    .setDepth(6);

                // Limpiar etiqueta en el próximo frame
                this.time.delayedCall(50, () => {
                    if (label && label.scene) label.destroy();
                });
            }
        });
    }
    // Helper para líneas punteadas (Phaser 3 no tiene setLineDash nativo)
    _drawDashedLine(graphics, x1, y1, x2, y2, dashLength = 8, gapLength = 4) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;

        const totalDashGap = dashLength + gapLength;
        let currentDistance = 0;

        while (currentDistance < distance) {
            const startX = x1 + unitX * currentDistance;
            const startY = y1 + unitY * currentDistance;

            const endDistance = Math.min(currentDistance + dashLength, distance);
            const endX = x1 + unitX * endDistance;
            const endY = y1 + unitY * endDistance;

            // Dibujar el segmento de línea
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();

            currentDistance += totalDashGap;
        }
    }

    // Animaciones del alma
    _createSoulAnimations() {
        this.anims.create({
            key: 'soul_idle',
            frames: [
                { key: 'idle_soul_0' },
                { key: 'idle_soul_1' },
                { key: 'idle_soul_2' },
                { key: 'idle_soul_3' },
                { key: 'idle_soul_4' },
                { key: 'idle_soul_5' },
                { key: 'idle_soul_6' }
            ],
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'soul_captured',
            frames: [
                { key: 'capture_soul_0' },
                { key: 'capture_soul_1' },
                { key: 'capture_soul_2' },
                { key: 'capture_soul_3' },
                { key: 'capture_soul_4' },
                { key: 'capture_soul_5' }
            ],
            frameRate: 5,
            repeat: 0
        });
    }

    // Animaciones del armario
    _createCabinetAnimations() {
        this.anims.create({
            key: 'cabinet_idle',
            frames: [
                { key: 'Cabinet_0' },
            ],
            frameRate: 1,
            repeat: -1
        });

        this.anims.create({
            key: 'cabinet_interact',
            frames: [
                { key: 'Cabinet_0' },
                { key: 'Cabinet_1' },
                { key: 'Cabinet_2' },
                { key: 'Cabinet_3' },
                { key: 'Cabinet_4' },
                { key: 'Cabinet_5' },
            ],
            frameRate: 6,
            repeat: 0
        });
    }

    // Animaciones del Reaper
    _createReaperAnimations() {
        this.anims.create({
            key: 'reaper_idle',
            frames: [
                { key: 'reaper_0' },
                { key: 'reaper_1' },
                { key: 'reaper_2' },
                { key: 'reaper_3' },
                { key: 'reaper_4' }
            ],
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'reaper_chase',
            frames: [
                { key: 'reaper_chase_0' },
                { key: 'reaper_chase_1' },
                { key: 'reaper_chase_2' },
                { key: 'reaper_chase_3' },
                { key: 'reaper_chase_4' }
            ],
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'fast_reaper_idle',
            frames: [
                { key: 'fast_reaper_0' },
                { key: 'fast_reaper_1' },
                { key: 'fast_reaper_2' },
                { key: 'fast_reaper_3' },
                { key: 'fast_reaper_4' },
                { key: 'fast_reaper_5' },
                { key: 'fast_reaper_6' }
            ],
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'fast_reaper_chase',
            frames: [
                { key: 'fast_reaper_chase_0' },
                { key: 'fast_reaper_chase_1' },
                { key: 'fast_reaper_chase_2' },
                { key: 'fast_reaper_chase_3' },
                { key: 'fast_reaper_chase_4' },
                { key: 'fast_reaper_chase_5' },
                { key: 'fast_reaper_chase_6' }
            ],
            frameRate: 6,
            repeat: -1
        });

    }

    // Animaciones del disparo del arma
    _CreateGunAnimations() {
        this.anims.create({
            key: 'gun_idle',
            frames: [
                { key: 'gun_shoot_0' }
            ],
            frameRate: 1,
            repeat: -1
        });

        this.anims.create({
            key: 'gun_shoot',
            frames: [
                { key: 'gun_shoot_0' },
                { key: 'gun_shoot_1' },
                { key: 'gun_shoot_2' },
                { key: 'gun_shoot_3' },
                { key: 'gun_shoot_4' },
                { key: 'gun_shoot_5' },
                { key: 'gun_shoot_6' },
                { key: 'gun_shoot_7' },
                { key: 'gun_shoot_8' },
                { key: 'gun_shoot_9' },
                { key: 'gun_shoot_10' },
                { key: 'gun_shoot_11' },
                { key: 'gun_shoot_12' },
                { key: 'gun_shoot_13' },
                { key: 'gun_shoot_14' },
                { key: 'gun_shoot_15' }
            ],
            frameRate: 16,
            repeat: 0
        });

        this.anims.create({
            key: 'gun_idle',
            frames: [
                { key: 'gun_shoot_0' }
            ],
            frameRate: 1,
            repeat: -1
        });

    }

    // Crear animaciones del jugador
    _createPlayerAnimations() {
        // Idle - bucle continuo
        this.anims.create({
            key: 'player_idle',
            frames: [
                { key: 'player_idle_0' },
                { key: 'player_idle_1' },
                { key: 'player_idle_2' },
                { key: 'player_idle_3' }
            ],
            frameRate: 6,
            repeat: -1 // Bucle infinito
        });

        // Walk - ahora usa los sprites reales de walk
        this.anims.create({
            key: 'player_walk',
            frames: [
                { key: 'player_walk_0' },
                { key: 'player_walk_1' },
                { key: 'player_walk_2' },
                { key: 'player_walk_3' },
                { key: 'player_walk_4' },
                { key: 'player_walk_5' },
                { key: 'player_walk_6' },
                { key: 'player_walk_7' },
                { key: 'player_walk_8' }
            ],
            frameRate: 12,
            repeat: -1
        });

        // Death - no hace flip, reproducir una vez
        this.anims.create({
            key: 'player_death',
            frames: [
                { key: 'player_death_0' },
                { key: 'player_death_1' },
                { key: 'player_death_2' },
                { key: 'player_death_3' },
                { key: 'player_death_4' },
                { key: 'player_death_5' },
                { key: 'player_death_6' }
            ],
            frameRate: 8,
            repeat: 0 // Solo una vez
        });
    }
}
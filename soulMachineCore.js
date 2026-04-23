class MainMenu extends Phaser.Scene {
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
const CABINET_POSITIONS = [
    { x: 300, y: 400 },
    { x: 500, y: 100 }
];

class DebugLevel extends Phaser.Scene {

    constructor() {
        super({ key: 'DebugLevel' });
    }

    
    // Preload
    
    preload() {
        this._makeTexture('soul',        gfx => gfx.fillStyle(0x00ff00).fillCircle(16, 16, 16), 32, 32);
        this._makeTexture('wall',        gfx => gfx.fillStyle(0x8B4513).fillRect(0, 0, 50, 50), 50, 50);
        this._makeTexture('captureArea', gfx => gfx.fillStyle(0x0000ff, 0.5).fillRect(0, 0, 200, 200), 200, 200);
        this._makeTexture('cabinet',     gfx => gfx.fillStyle(0x654321).fillRect(0, 0, 40, 60), 40, 60);
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
        this._fpsText      = this.add.text(10, 10, '', { font: '16px Arial', fill: '#ffffff' });
        this._coordText    = this.add.text(10, 30, '', { font: '14px Arial', fill: '#00ff00' });
        this._controlsText = this.add.text(10, 50,
            'WASD: mover  |  Click: disparar  |  Espacio: escondite  |  V: visión enemigo',
            { font: '12px Arial', fill: '#ffff00' }
        );
        this._soulsText = this.add.text(10, 70, '', { font: '14px Arial', fill: '#00ffff' });

        //  Paredes 
        this.walls = this.physics.add.staticGroup();
        // Obstáculos internos
        this.walls.create(200, 150, 'wall').setScale(2).refreshBody();
        this.walls.create(600, 450, 'wall').setScale(2).refreshBody();
        // Bordes
        this.walls.create(400,   0, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(400, 600, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(  0, 300, 'wall').setScale(0.2, 12).refreshBody();
        this.walls.create(800, 300, 'wall').setScale(0.2, 12).refreshBody();

        //  Armarios 
        this.cabinets = this.physics.add.staticGroup();
        CABINET_POSITIONS.forEach(pos => {
            this.cabinets.create(pos.x, pos.y, 'cabinet').setScale(1.5).refreshBody();
        });

        //  Áreas de escondite 
        this.hideAreas = this.physics.add.staticGroup();
        CABINET_POSITIONS.forEach(pos => {
            this.hideAreas.create(pos.x, pos.y, 'captureArea').setScale(0.5).refreshBody();
        });

        //  Almas 
        this.souls = this.physics.add.group();
        this.souls.create(600, 300, 'soul');
        this.souls.create(500, 200, 'soul');
        this._totalSouls    = this.souls.getChildren().length;
        this._capturedSouls = 0;

        //  Jugador 
        this.player = new Player(this, 400, 300);
        this.player.addColliders(this.walls, this.cabinets);

        //  Enemigo 
        this.enemy = new Enemy(this, 65, 555);
        this.enemy.buildNavigation(this.walls, this.cabinets);
        this.enemy.addColliders(this.walls, this.cabinets, this.player);

        //  Controles
        this._keys = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            down:  Phaser.Input.Keyboard.KeyCodes.S,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            v:     Phaser.Input.Keyboard.KeyCodes.V
        });

        //  Disparo 
        this._shootCooldown = false;
        this.input.on('pointerdown', this._handleShoot, this);
    }

    
    // Update
    
    update() {
        // HUD
        const ptr = this.input.activePointer;
        this._fpsText.setText(`FPS: ${Math.floor(this.game.loop.actualFps)}`);
        this._coordText.setText(`Mouse: (${Math.floor(ptr.worldX)}, ${Math.floor(ptr.worldY)})`);
        this._soulsText.setText(`Almas: ${this._capturedSouls} / ${this._totalSouls}`);

        // Toggle visión del enemigo
        if (Phaser.Input.Keyboard.JustDown(this._keys.v)) {
            this.enemy.toggleVision();
        }

        // Player
        this.player.handleMovement({
            left:  this._keys.left.isDown,
            right: this._keys.right.isDown,
            up:    this._keys.up.isDown,
            down:  this._keys.down.isDown
        });
        this.player.updateGun(ptr);

        // Escondite
        if (Phaser.Input.Keyboard.JustDown(this._keys.space) && this.player.isAlive) {
            this._tryHide();
        }

        // Enemigo
        this.enemy.update(this.player, this.walls, this.cabinets);
    }

    
    // Helpers privados
    
    _tryHide() {
        const enemyCanSee = this.enemy.canSeePlayer(this.player, this.walls, this.cabinets);

        const succeeded = this.player.tryHide(
            this.hideAreas,
            this.cabinets,
            enemyCanSee
        );

        if (succeeded && this.player.isHidden && enemyCanSee) {
            // Notificar al enemigo
            this.enemy.sawPlayerHide      = true;
            this.enemy.playerHideLocation = { x: this.player.x, y: this.player.y };
        }
    }

    _handleShoot(pointer) {
        if (!this.player.isAlive || this._shootCooldown) return;

        this._shootCooldown = true;

        const killed = this.player.shoot(pointer, this.souls, this.walls, this.cabinets);
        this._capturedSouls += killed;

        console.log(`Almas: ${this._capturedSouls}/${this._totalSouls}`);

        if (this._capturedSouls >= this._totalSouls) {
            console.log('¡Todas las almas capturadas! Victoria.');
            // Siguiente Scena
            this.scene.start("Level2");
        }

        this.time.delayedCall(2000, () => { this._shootCooldown = false; });
    }
}

class Level2 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level2' });
    }

    create() {
        const { width, height } = this.scale;

        // Fondo diferente para distinguirlo
        this.add.rectangle(0, 0, width * 2, height * 2, 0x0a0a2a).setOrigin(0);

        // Texto
        this.add.text(width / 2, height / 2, "LEVEL 2 - TEST", {
            fontSize: "32px",
            color: "#ffffff"
        }).setOrigin(0.5);

        // ── Paredes (igual que DebugLevel) ──
        this.walls = this.physics.add.staticGroup();

        this._makeWallTexture();

        this.walls.create(400,   0, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(400, 600, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(  0, 300, 'wall').setScale(0.2, 12).refreshBody();
        this.walls.create(800, 300, 'wall').setScale(0.2, 12).refreshBody();

        // Botón para volver (opcional pero útil)
        const back = this.add.text(width / 2, height - 100, "VOLVER", {
            fontSize: "24px",
            backgroundColor: "#000",
            padding: { x: 15, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive();

        back.on("pointerdown", () => {
            this.scene.start("MainMenu");
        });
    }

    _makeWallTexture() {
        if (this.textures.exists('wall')) return;

        const gfx = this.add.graphics();
        gfx.fillStyle(0x8B4513);
        gfx.fillRect(0, 0, 50, 50);
        gfx.generateTexture('wall', 50, 50);
        gfx.destroy();
    }
}

class Player {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     */
    constructor(scene, x, y) {
        this.scene = scene;
 
        this.sprite = scene.add.circle(x, y, 20, 0xffffff);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
 
        // Arma
        this.gun = scene.add.rectangle(x + 20, y, 20, 10, 0xf03418);
 
        // Estado
        this.isAlive  = true;
        this.isHidden = false;
 
        // Para el escondite
        this._originalPos = { x, y };
    }
 
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
 
    
    // Movimiento
    
    handleMovement(keys) {
        if (this.isHidden || !this.isAlive) {
            this.sprite.body.setVelocity(0, 0);
            return;
        }
 
        const vx = keys.left ? -300 : keys.right ? 300 : 0;
        const vy = keys.up   ? -300 : keys.down  ? 300 : 0;
        this.sprite.body.setVelocity(vx, vy);
    }
 
    
    // Arma
    
    updateGun(pointer) {
        if (!this.isAlive || this.isHidden) return;
 
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y,
            pointer.worldX, pointer.worldY
        );
 
        this.gun.x        = this.sprite.x + (pointer.worldX > this.sprite.x ? 20 : -20);
        this.gun.y        = this.sprite.y;
        this.gun.rotation = angle;
    }
 
    
    // Escondite
    
    tryHide(hideAreas, cabinets, enemyCanSee) {
        if (this.isHidden) {
            this.forceExit();
            return true;
        }
 
        const playerBounds = this.sprite.getBounds();
        const inArea = hideAreas.getChildren().some(area =>
            Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, area.getBounds())
        );
 
        if (!inArea) {
            console.log('No puedes esconderte aquí — busca un área azul.');
            return false;
        }
 
        // Encontrar el cabinet más cercano
        const nearest = this._nearestCabinet(cabinets);
        if (!nearest) return false;
 
        this._originalPos = { x: this.sprite.x, y: this.sprite.y };
        this.sprite.x     = nearest.x;
        this.sprite.y     = nearest.y;
 
        this.sprite.setVisible(false);
        this.gun.setVisible(false);
        this.isHidden = true;
 
        console.log(enemyCanSee
            ? '¡El enemigo te vio esconderte! Vendrá por ti...'
            : 'Te escondiste sin ser visto — estás a salvo.'
        );
 
        return true;
    }
 
    /** El enemigo fuerza al jugador a salir del escondite */
    forceExit() {
        this.sprite.x = this._originalPos.x;
        this.sprite.y = this._originalPos.y;
        this.sprite.setVisible(true);
        this.gun.setVisible(true);
        this.isHidden = false;
        console.log('Jugador salió del escondite.');
    }
 
    _nearestCabinet(cabinets) {
        let nearest = null;
        let minDist = Infinity;
 
        cabinets.getChildren().forEach(c => {
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, c.x, c.y);
            if (d < minDist) { minDist = d; nearest = c; }
        });
 
        return nearest;
    }
 
    
    // Muerte
    
    kill() {
        if (!this.isAlive) return;
 
        this.isAlive = false;
        this.sprite.setFillStyle(0x666666);
        this.sprite.setAlpha(0.5);
        this.gun.setVisible(false);
        console.log('Game Over.');
    }
 
    
    // Colisiones
    
    addColliders(walls, cabinets) {
        this.scene.physics.add.collider(this.sprite, walls);
        this.scene.physics.add.collider(this.sprite, cabinets);
    }
 
    /*
      Shoot — devuelve cuántas almas se destruyeron
     */
    shoot(pointer, souls, walls, cabinets) {
        const targetX = pointer.worldX;
        const targetY = pointer.worldY;
 
        const flash = this.scene.add.circle(this.gun.x, this.gun.y, 5, 0xffffff);
        this.scene.time.delayedCall(50, () => flash.destroy());
 
        let killed = 0;
        const maxCaptureDistance = 90; // Distancia máxima para capturar almas
 
        souls.children.each(soul => {
            if (!soul.active) return;
 
            const distFromTarget = Phaser.Math.Distance.Between(targetX, targetY, soul.x, soul.y);
            if (distFromTarget >= 40) return;
 
            const ray = new Phaser.Geom.Line(this.gun.x, this.gun.y, soul.x, soul.y);
 
            const blocked =
                walls.getChildren().some(w => Phaser.Geom.Intersects.LineToRectangle(ray, w.getBounds())) ||
                cabinets.getChildren().some(c => Phaser.Geom.Intersects.LineToRectangle(ray, c.getBounds()));
 
            // Verificar distancia del jugador al alma
            const distPlayerToSoul = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, soul.x, soul.y);
            
            // Solo destruir almas si el jugador está cerca Y no hay obstáculos bloqueando
            if (!blocked && distPlayerToSoul <= maxCaptureDistance) {
                const soulFlash = this.scene.add.circle(soul.x, soul.y, 10, 0xffff00);
                this.scene.time.delayedCall(100, () => soulFlash.destroy());
                soul.destroy();
                killed++;
            } else if (blocked) {
                console.log('Disparo bloqueado por pared.');
            } else if (distPlayerToSoul > maxCaptureDistance) {
                console.log('Alma demasiado lejos. Acércate más para capturarla.');
            }
        });
 
        return killed;
    }
}

const PATROL_POINTS = [
    { x: 60, y: 25 },
    { x: 755, y: 25 },
    { x: 755, y: 545 },
    { x: 60, y: 545 }
];
 
const ENEMY_RANGE   = 250;
const ENEMY_SPEED   = 100;
const FOV_ANGLE     = Phaser.Math.DegToRad(60);
const VISION_SEGS   = 32;
 
class Enemy {
    
    constructor(scene, x, y) {
        this.scene = scene;
 
        // Sprite del enemigo
        this.sprite = scene.add.circle(x, y, 20, 0xff0000);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
 
        // Estado interno
        this.state             = 'patrol';
        this.rotation          = 0;
        this.targetRotation    = 0;
        this.rotationSpeed     = 0.05;
        this.searchOscillation = 0;
 
        // Patrulla
        this.patrolPoints              = PATROL_POINTS;
        this.currentPatrolIndex        = 0;
        this.alreadyReachedFirstPoint  = false;
 
        // Memoria de escondite
        this.sawPlayerHide      = false;
        this.playerHideLocation = { x: 0, y: 0 };
 
        // Pathfinding
        this.navGrid        = [];
        this.currentPath    = [];
        this.pathIndex      = 0;
        this.pathTimer      = 0;
        this.pathCache      = new Map();
        this.lastTargetPoint = null;
 
        // Visión
        this.visionGraphics = scene.add.graphics();
        this.visionGraphics.setDepth(-1);
        this.showVision = true;
    }
 
    
    // Setup (llamar después de crear paredes y armarios)
    
    buildNavigation(walls, cabinets) {
        this.navGrid = buildNavGrid(walls, cabinets);
    }
 
    addColliders(walls, cabinets, player) {
        this.scene.physics.add.collider(this.sprite, walls);
        this.scene.physics.add.collider(this.sprite, cabinets);
        this.scene.physics.add.collider(this.sprite, player.sprite ?? player);
    }
 
    
    // Update principal — llamar desde la escena cada frame
    
    update(player, walls, cabinets) {
        this._updateState(player, walls, cabinets);
        this._executeState(player, walls, cabinets);
        this._updateVision(player, walls, cabinets);
        this._checkKillPlayer(player);
    }
 
    toggleVision() {
        this.showVision = !this.showVision;
        if (!this.showVision) this.visionGraphics.clear();
    }
 
    
    // Lógica de estados
    
    _updateState(player, walls, cabinets) {
        // PRIMERO: Verificar si el jugador está visible y debe ser perseguido
        const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const diff  = Phaser.Math.Angle.Wrap(angle - this.rotation);
 
        const playerVisible =
            dist < ENEMY_RANGE &&
            Math.abs(diff) < FOV_ANGLE / 2 &&
            !player.isHidden &&
            this._hasLineOfSight(player.x, player.y, walls, cabinets);

        // Si el jugador está visible, SIEMPRE priorizar chase (incluso si lo vimos esconderse antes)
        if (playerVisible) {
            // Resetear memoria de escondite ya que ahora lo estamos viendo directamente
            if (this.sawPlayerHide) {
                this.sawPlayerHide = false;
                this.searchOscillation = 0;
                console.log('El enemigo canceló la búsqueda - ¡te vio salir del escondite!');
            }
            this.state = 'chase';
            return;
        }

        // SEGUNDO: Si no está visible pero lo vimos esconderse, buscarlo en el escondite
        if (this.sawPlayerHide) {
            this.state = 'searchHiding';
            return;
        }
 
        // TERCERO: Lógica normal de estados (patrol/recovery)
        if (this.state === 'chase') {
            this.state = 'recovery';
            return;
        }
 
        if (this.state !== 'recovery') {
            this.state = 'patrol';
        }
    }
 
    _executeState(player, walls, cabinets) {
        switch (this.state) {
            case 'patrol':       this._doPatrol();                          break;
            case 'chase':        this._doChase(player, walls, cabinets);   break;
            case 'searchHiding': this._doSearchHiding(player);             break;
            case 'recovery':     this._doRecovery();                       break;
        }
    }
 
    // Patrol 
    _doPatrol() {
        const target = this.alreadyReachedFirstPoint
            ? this.patrolPoints[this.currentPatrolIndex]
            : this.patrolPoints[0];
 
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        this.targetRotation = angle;
        this.sprite.body.setVelocity(Math.cos(angle) * ENEMY_SPEED, Math.sin(angle) * ENEMY_SPEED);
 
        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        if (dist < 1) {
            if (!this.alreadyReachedFirstPoint) {
                this.alreadyReachedFirstPoint = true;
            } else {
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            }
        }
    }
 
    //  Chase 
    _doChase(player, walls, cabinets) {
        if (this._hasLineOfSight(player.x, player.y, walls, cabinets)) {
            const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
            this.targetRotation = angle;
            this.sprite.body.setVelocity(Math.cos(angle) * ENEMY_SPEED, Math.sin(angle) * ENEMY_SPEED);
        } else {
            this.sprite.body.setVelocity(0, 0);
        }
    }
 
    // SearchHiding 
    _doSearchHiding(player) {
        const tx = this.playerHideLocation.x;
        const ty = this.playerHideLocation.y;
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, tx, ty);
        const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, tx, ty);
 
        this.searchOscillation += 0.1;
        this.targetRotation = angle + Math.sin(this.searchOscillation) * 0.3;
 
        if (dist > 70) {
            this.sprite.body.setVelocity(Math.cos(angle) * ENEMY_SPEED, Math.sin(angle) * ENEMY_SPEED);
        } else {
            this.sprite.body.setVelocity(0, 0);
 
            if (player.isHidden) {
                // Sacar al jugador del escondite
                player.forceExit();
                console.log('¡El enemigo te sacó del escondite!');
                this.state = 'chase';
            } else {
                this.sawPlayerHide = false;
                this.searchOscillation = 0;
                this.state = 'patrol';
                console.log('El jugador ya salió del escondite');
            }
        }
    }
 
    //  Recovery 
    _doRecovery() {
        // Buscar el patrol point más cercano
        let closest = this.patrolPoints[0];
        let closestDist = Infinity;
        let closestIndex = 0;
 
        this.patrolPoints.forEach((pt, i) => {
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, pt.x, pt.y);
            if (d < closestDist) { closestDist = d; closest = pt; closestIndex = i; }
        });
 
        if (closestDist < 15) {
            this.currentPatrolIndex     = closestIndex;
            this.alreadyReachedFirstPoint = true;
            this.currentPath = [];
            this.pathCache.clear();
            this.lastTargetPoint = null;
            this.searchOscillation = 0;
            this.state = 'patrol';
            return;
        }
 
        // Recalcular path si hace falta
        const start = worldToGrid(this.sprite.x, this.sprite.y);
        const end   = worldToGrid(closest.x, closest.y);
        const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
 
        const targetChanged = !this.lastTargetPoint ||
            this.lastTargetPoint.x !== closest.x ||
            this.lastTargetPoint.y !== closest.y;
 
        if (this.pathTimer <= 0 || this.currentPath.length === 0 || targetChanged) {
            let path = (!targetChanged && this.pathCache.has(cacheKey))
                ? this.pathCache.get(cacheKey)
                : null;
 
            if (!path) {
                path = findPath(start, end, this.navGrid);
                if (path) {
                    path = smoothPath(path, this.navGrid);
                    this.pathCache.set(cacheKey, path);
                }
            }
 
            if (path) {
                this.currentPath   = path;
                this.pathIndex     = 0;
                this.lastTargetPoint = { ...closest };
            }
 
            this.pathTimer = 20;
        } else {
            this.pathTimer--;
        }
 
        // Seguir el path
        if (this.currentPath.length > 0 && this.pathIndex < this.currentPath.length) {
            const node  = this.currentPath[this.pathIndex];
            const world = gridToWorld(node.x, node.y);
            const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, world.x, world.y);
 
            if (dist < 8) {
                this.pathIndex++;
            } else {
                const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, world.x, world.y);
 
                if (this.pathIndex + 1 < this.currentPath.length) {
                    const next = this.currentPath[this.pathIndex + 1];
                    const nw   = gridToWorld(next.x, next.y);
                    this.targetRotation = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, nw.x, nw.y);
                } else {
                    this.targetRotation = angle;
                }
 
                const smooth = Math.min(dist / 20, 1);
                this.sprite.body.setVelocity(Math.cos(angle) * ENEMY_SPEED * smooth, Math.sin(angle) * ENEMY_SPEED * smooth);
            }
        } else {
            const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, closest.x, closest.y);
            this.targetRotation = angle;
            this.sprite.body.setVelocity(Math.cos(angle) * ENEMY_SPEED * 0.5, Math.sin(angle) * ENEMY_SPEED * 0.5);
        }
    }
 
    
    // Visión del jugador
    
    canSeePlayer(player, walls, cabinets) {
        if (player.isHidden) return false;
 
        const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const diff  = Phaser.Math.Angle.Wrap(angle - this.rotation);
 
        if (dist > ENEMY_RANGE || Math.abs(diff) > FOV_ANGLE / 2) return false;
 
        return this._hasLineOfSight(player.x, player.y, walls, cabinets);
    }
 
    _hasLineOfSight(tx, ty, walls, cabinets) {
        const ray = new Phaser.Geom.Line(this.sprite.x, this.sprite.y, tx, ty);
 
        const hitWall = walls.getChildren().some(w =>
            Phaser.Geom.Intersects.LineToRectangle(ray, w.getBounds())
        );
        if (hitWall) return false;
 
        const hitCabinet = cabinets.getChildren().some(c =>
            Phaser.Geom.Intersects.LineToRectangle(ray, c.getBounds())
        );
        return !hitCabinet;
    }
 
    
    // Dibujar cono de visión
    
    _updateVision(player, walls, cabinets) {
        this._interpolateRotation(player);
        if (this.showVision) this._drawVisionCone(walls, cabinets);
    }
 
    _interpolateRotation(player) {
        let target = this.targetRotation;
 
        switch (this.state) {
            case 'chase':
                target = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
                this.rotationSpeed = 0.15;
                break;
            case 'patrol':
                this.rotationSpeed = 0.08;
                break;
            case 'recovery':
                this.rotationSpeed = 0.06;
                break;
            case 'searchHiding':
                this.rotationSpeed = 0.12;
                break;
        }
 
        this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, target, this.rotationSpeed);
    }
 
    _drawVisionCone(walls, cabinets) {
        const g = this.visionGraphics;
        g.clear();
 
        const leftAngle  = this.rotation - FOV_ANGLE / 2;
        const rightAngle = this.rotation + FOV_ANGLE / 2;
 
        g.fillStyle(0xff0000, 0.2);
        g.lineStyle(2, 0xff0000, 0.5);
        g.beginPath();
        g.moveTo(this.sprite.x, this.sprite.y);
 
        for (let i = 0; i <= VISION_SEGS; i++) {
            const angle = leftAngle + (rightAngle - leftAngle) * (i / VISION_SEGS);
            let ex = this.sprite.x + Math.cos(angle) * ENEMY_RANGE;
            let ey = this.sprite.y + Math.sin(angle) * ENEMY_RANGE;
 
            const ray = new Phaser.Geom.Line(this.sprite.x, this.sprite.y, ex, ey);
 
            [...walls.getChildren(), ...cabinets.getChildren()].forEach(obj => {
                const hit = Phaser.Geom.Intersects.GetLineToRectangle(ray, obj.getBounds());
                if (hit) {
                    const d1 = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, hit.x, hit.y);
                    const d2 = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, ex, ey);
                    if (d1 < d2) { ex = hit.x; ey = hit.y; }
                }
            });
 
            g.lineTo(ex, ey);
        }
 
        g.closePath();
        g.fillPath();
        g.strokePath();
 
        // Línea central
        g.lineStyle(2, 0xffffff, 0.8);
        g.beginPath();
        g.moveTo(this.sprite.x, this.sprite.y);
        g.lineTo(
            this.sprite.x + Math.cos(this.rotation) * ENEMY_RANGE * 0.7,
            this.sprite.y + Math.sin(this.rotation) * ENEMY_RANGE * 0.7
        );
        g.strokePath();
    }
 
    
    // Colisión letal con el jugador
    
    _checkKillPlayer(player) {
        if (!player.isAlive || player.isHidden) return;
 
        if (Phaser.Geom.Intersects.RectangleToRectangle(
            this.sprite.getBounds(),
            (player.sprite ?? player).getBounds()
        )) {
            player.kill();
        }
    }
 
    // Acceso directo a las coordenadas del sprite (comodidad)
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
}

const GRID_SIZE = 10;

function buildNavGrid(walls, cabinets, mapWidth = 800, mapHeight = 600) {
    const cols = Math.ceil(mapWidth / GRID_SIZE);
    const rows = Math.ceil(mapHeight / GRID_SIZE);
    const buffer = GRID_SIZE * 0.3;
    const grid = [];

    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            const worldX = x * GRID_SIZE + GRID_SIZE / 2;
            const worldY = y * GRID_SIZE + GRID_SIZE / 2;

            const rect = new Phaser.Geom.Rectangle(
                worldX - buffer, worldY - buffer,
                buffer * 2, buffer * 2
            );

            let blocked = false;

            walls.getChildren().forEach(w => {
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, w.getBounds())) blocked = true;
            });

            cabinets.getChildren().forEach(c => {
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, c.getBounds())) blocked = true;
            });

            row.push(blocked ? 1 : 0);
        }
        grid.push(row);
    }

    console.log(`NavGrid generada: ${cols}x${rows}`);
    return grid;
}

function worldToGrid(x, y) {
    return { x: Math.floor(x / GRID_SIZE), y: Math.floor(y / GRID_SIZE) };
}

function gridToWorld(x, y) {
    return { x: x * GRID_SIZE + GRID_SIZE / 2, y: y * GRID_SIZE + GRID_SIZE / 2 };
}

function euclideanDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function findPath(start, end, navGrid) {
    if (
        !navGrid[start.y] || !navGrid[end.y] ||
        navGrid[start.y][start.x] === 1 || navGrid[end.y][end.x] === 1
    ) return null;

    const open = [];
    const closed = new Set();
    const openSet = new Set();

    const startNode = {
        x: start.x, y: start.y,
        g: 0,
        h: euclideanDistance(start, end),
        f: 0,
        parent: null
    };
    startNode.f = startNode.g + startNode.h;

    open.push(startNode);
    openSet.add(`${start.x},${start.y}`);

    while (open.length > 0) {
        let currentIndex = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[currentIndex].f) currentIndex = i;
        }

        const current = open[currentIndex];
        open.splice(currentIndex, 1);
        openSet.delete(`${current.x},${current.y}`);

        if (current.x === end.x && current.y === end.y) {
            const path = [];
            let node = current;
            while (node) { path.push({ x: node.x, y: node.y }); node = node.parent; }
            return path.reverse();
        }

        closed.add(`${current.x},${current.y}`);

        const neighbors = [
            { x: 1, y: 0, cost: 1 }, { x: -1, y: 0, cost: 1 },
            { x: 0, y: 1, cost: 1 }, { x: 0, y: -1, cost: 1 },
            { x: 1, y: 1, cost: 1.4 }, { x: -1, y: 1, cost: 1.4 },
            { x: 1, y: -1, cost: 1.4 }, { x: -1, y: -1, cost: 1.4 }
        ];

        for (const neighbor of neighbors) {
            const nx = current.x + neighbor.x;
            const ny = current.y + neighbor.y;

            if (ny < 0 || ny >= navGrid.length || nx < 0 || nx >= navGrid[0].length) continue;
            if (navGrid[ny][nx] === 1) continue;
            if (closed.has(`${nx},${ny}`)) continue;

            if (neighbor.cost > 1) {
                if (navGrid[current.y][nx] === 1 || navGrid[ny][current.x] === 1) continue;
            }

            const g = current.g + neighbor.cost;
            const h = euclideanDistance({ x: nx, y: ny }, end);
            const f = g + h;
            const nodeKey = `${nx},${ny}`;

            if (openSet.has(nodeKey)) {
                const existing = open.find(n => n.x === nx && n.y === ny);
                if (g < existing.g) { existing.g = g; existing.f = f; existing.parent = current; }
            } else {
                open.push({ x: nx, y: ny, g, h, f, parent: current });
                openSet.add(nodeKey);
            }
        }
    }

    return null;
}

function smoothPath(path, navGrid) {
    if (path.length <= 2) return path;

    const smoothed = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
        const prev = smoothed[smoothed.length - 1];
        const next = path[i + 1];
        if (!hasDirectPath(prev, next, navGrid)) smoothed.push(path[i]);
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
}

function hasDirectPath(start, end, navGrid) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));

    if (distance === 0) return true;

    const stepX = dx / distance;
    const stepY = dy / distance;

    for (let i = 0; i <= distance; i++) {
        const x = Math.round(start.x + stepX * i);
        const y = Math.round(start.y + stepY * i);
        if (y >= 0 && y < navGrid.length && x >= 0 && x < navGrid[0].length) {
            if (navGrid[y][x] === 1) return false;
        }
    }

    return true;
}

const config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    // Añadir más escenas al array cuando las tengas:
    scene: [MainMenu, DebugLevel, Level2]
};
 
new Phaser.Game(config);
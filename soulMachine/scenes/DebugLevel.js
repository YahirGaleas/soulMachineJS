import Player from '../entities/Player.js';
import Enemy  from '../entities/Enemy.js';

const CABINET_POSITIONS = [
    { x: 300, y: 400 },
    { x: 500, y: 100 }
];

export default class DebugLevel extends Phaser.Scene {

    constructor() {
        super({ key: 'DebugLevel' });
    }

    // =========================================================================
    // Preload
    // =========================================================================
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

    // =========================================================================
    // Create
    // =========================================================================
    create() {
        // HUD
        this._fpsText      = this.add.text(10, 10, '', { font: '16px Arial', fill: '#ffffff' });
        this._coordText    = this.add.text(10, 30, '', { font: '14px Arial', fill: '#00ff00' });
        this._controlsText = this.add.text(10, 50,
            'WASD: mover  |  Click: disparar  |  Espacio: escondite  |  V: visión enemigo',
            { font: '12px Arial', fill: '#ffff00' }
        );
        this._soulsText = this.add.text(10, 70, '', { font: '14px Arial', fill: '#00ffff' });

        // ── Paredes ──────────────────────────────────────────────────────────
        this.walls = this.physics.add.staticGroup();
        // Obstáculos internos
        this.walls.create(200, 150, 'wall').setScale(2).refreshBody();
        this.walls.create(600, 450, 'wall').setScale(2).refreshBody();
        // Bordes
        this.walls.create(400,   0, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(400, 600, 'wall').setScale(16, 0.2).refreshBody();
        this.walls.create(  0, 300, 'wall').setScale(0.2, 12).refreshBody();
        this.walls.create(800, 300, 'wall').setScale(0.2, 12).refreshBody();

        // ── Armarios ─────────────────────────────────────────────────────────
        this.cabinets = this.physics.add.staticGroup();
        CABINET_POSITIONS.forEach(pos => {
            this.cabinets.create(pos.x, pos.y, 'cabinet').setScale(1.5).refreshBody();
        });

        // ── Áreas de escondite ───────────────────────────────────────────────
        this.hideAreas = this.physics.add.staticGroup();
        CABINET_POSITIONS.forEach(pos => {
            this.hideAreas.create(pos.x, pos.y, 'captureArea').setScale(0.5).refreshBody();
        });

        // ── Almas ────────────────────────────────────────────────────────────
        this.souls = this.physics.add.group();
        this.souls.create(600, 300, 'soul');
        this.souls.create(500, 200, 'soul');
        this._totalSouls    = this.souls.getChildren().length;
        this._capturedSouls = 0;

        // ── Jugador ──────────────────────────────────────────────────────────
        this.player = new Player(this, 400, 300);
        this.player.addColliders(this.walls, this.cabinets);

        // ── Enemigo ──────────────────────────────────────────────────────────
        this.enemy = new Enemy(this, 65, 555);
        this.enemy.buildNavigation(this.walls, this.cabinets);
        this.enemy.addColliders(this.walls, this.cabinets, this.player);

        // ── Controles ────────────────────────────────────────────────────────
        this._keys = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            down:  Phaser.Input.Keyboard.KeyCodes.S,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            v:     Phaser.Input.Keyboard.KeyCodes.V
        });

        // ── Disparo ──────────────────────────────────────────────────────────
        this._shootCooldown = false;
        this.input.on('pointerdown', this._handleShoot, this);
    }

    // =========================================================================
    // Update
    // =========================================================================
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

    // =========================================================================
    // Helpers privados
    // =========================================================================
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
            this.scene.restart();
        }

        this.time.delayedCall(2000, () => { this._shootCooldown = false; });
    }
}
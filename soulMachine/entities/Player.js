export default class Player {
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

    // -------------------------------------------------------------------------
    // Movimiento
    // -------------------------------------------------------------------------
    handleMovement(keys) {
        if (this.isHidden || !this.isAlive) {
            this.sprite.body.setVelocity(0, 0);
            return;
        }

        const vx = keys.left ? -300 : keys.right ? 300 : 0;
        const vy = keys.up   ? -300 : keys.down  ? 300 : 0;
        this.sprite.body.setVelocity(vx, vy);
    }

    // -------------------------------------------------------------------------
    // Arma
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Escondite
    // -------------------------------------------------------------------------
    /**
     * Intenta esconderse. Devuelve true si lo logró, false si no está en área válida.
     * @param {Phaser.Physics.Arcade.StaticGroup} hideAreas
     * @param {Phaser.Physics.Arcade.StaticGroup} cabinets
     * @param {boolean} enemyCanSee — si el enemigo vio la acción
     */
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

    // -------------------------------------------------------------------------
    // Muerte
    // -------------------------------------------------------------------------
    kill() {
        if (!this.isAlive) return;

        this.isAlive = false;
        this.sprite.setFillStyle(0x666666);
        this.sprite.setAlpha(0.5);
        this.gun.setVisible(false);
        console.log('Game Over.');
    }

    // -------------------------------------------------------------------------
    // Colisiones
    // -------------------------------------------------------------------------
    addColliders(walls, cabinets) {
        this.scene.physics.add.collider(this.sprite, walls);
        this.scene.physics.add.collider(this.sprite, cabinets);
    }

    /**
     * Shoot — devuelve cuántas almas se destruyeron
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
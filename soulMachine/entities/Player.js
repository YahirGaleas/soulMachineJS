export default class Player {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     */
    constructor(scene, x, y) {
        this.scene = scene;

        // Sprite animado del jugador (32x32)
        this.sprite = scene.add.sprite(x, y, 'player_idle_0');
        this.sprite.setScale(2); 
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        
        // Mantener hitbox original independiente del scale visual
        this.sprite.body.setSize(20, 20); // Hitbox física (independiente del scale)
        
        // Centrar hitbox en el sprite visual (opcional si está desalineado)
        //this.sprite.body.setOffset(
        //    (this.sprite.width * this.sprite.scaleX - 10) / 2,  // Centrar X
        //    (this.sprite.height * this.sprite.scaleY - 10) / 2  // Centrar Y
        //);

        // Arma sprite
        this.gun = scene.add.sprite(x + 15, y, 'gun_shoot_0');
        this.gun.setScale(2);
        scene.physics.add.existing(this.gun);
        this.gun.body.setCollideWorldBounds(true);

        // Estado
        this.isAlive  = true;
        this.isHidden = false;
        this.isDying  = false;

        // Estado de movimiento
        this.isMoving = false;
        this.lastMovementKeys = { left: false, right: false, up: false, down: false };

        // Para el escondite
        this._originalPos = { x, y };

        // Iniciar animación idle
        this.sprite.play('player_idle');
        this.gun.play('gun_idle');
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }

    // Movimiento
    handleMovement(keys) {
        if (this.isHidden || !this.isAlive || this.isDying) {
            this.sprite.body.setVelocity(0, 0);
            return;
        }

        const vx = keys.left ? -210 : keys.right ? 210 : 0;
        const vy = keys.up   ? -210 : keys.down  ? 210 : 0;
        this.sprite.body.setVelocity(vx, vy);

        // Detectar si está moviéndose para cambiar animación
        const wasMoving = this.isMoving;
        this.isMoving = vx !== 0 || vy !== 0;

        // Cambiar animación según movimiento
        if (this.isMoving && !wasMoving) {
            this.sprite.play('player_walk');
        } else if (!this.isMoving && wasMoving) {
            this.sprite.play('player_idle');
        }

        // Guardar teclas para determinar dirección del flip
        this.lastMovementKeys = { ...keys };

        // Aplicar flip según movimiento (derecha = flip, izquierda = normal)
        if (keys.right && !keys.left) {
            this.sprite.setFlipX(true);  // Flip para mirar derecha
        } else if (keys.left && !keys.right) {
            this.sprite.setFlipX(false); // Normal para mirar izquierda
        }
        // Si presiona ambos o ninguno, mantener última dirección
    }

    // Arma
    updateGun(pointer) {
        if (!this.isAlive || this.isHidden || this.isDying) {
            this.gun.setVisible(false);
            return;
        }

        this.gun.setVisible(true);
        
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y,
            pointer.worldX, pointer.worldY
        );

        // Determinar si el mouse está a la derecha o izquierda
        const mouseToRight = pointer.worldX > this.sprite.x;

        // Posición del arma ajustada al sprite animado
        const offsetX = mouseToRight ? 15 : -15;
        this.gun.x = this.sprite.x + offsetX;
        this.gun.y = this.sprite.y;

        // Aplicar flip y rotación al arma según la dirección
        if (mouseToRight) {
            // Mouse a la derecha: sin flip, ángulo normal
            this.gun.setFlipX(true);
            this.gun.rotation = angle;
        } else {
            // Mouse a la izquierda: flip Y + ajustar ángulo para evitar que quede de cabeza
            this.gun.setFlipX(false);
            this.gun.rotation = angle + Math.PI; // Compensar el flip
        }

        // Flip del sprite según posición del mouse (solo si no está moviéndose)
        if (!this.isMoving) {
            if (mouseToRight) {
                this.sprite.setFlipX(true);  // Flip para mirar derecha
            } else {
                this.sprite.setFlipX(false); // Normal para mirar izquierda  
            }
        }
    }

    // Escondite
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

        if (this.isDying || !this.isAlive) return false;

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

        // Activar animación de interacción del cabinet
        nearest.play('cabinet_interact');
        
        // Volver a idle después de la animación
        nearest.once('animationcomplete', () => {
            nearest.play('cabinet_idle');
        });

        this._originalPos = { x: this.sprite.x, y: this.sprite.y };
        this.sprite.x     = nearest.x;
        this.sprite.y     = nearest.y;

        // Ocultar sprite y arma
        this.sprite.setVisible(false);
        this.gun.setVisible(false);
        this.isHidden = true;

        console.log(enemyCanSee
            ? '¡El enemigo te vio esconderte! Vendrá por ti...'
            : 'Te escondiste sin ser visto — estás a salvo.'
        );

        return true;
    }

    // El enemigo fuerza al jugador a salir del escondite
    forceExit() {
        // Encontrar el cabinet donde está escondido el jugador  
        const cabinets = this.scene.cabinets.getChildren();
        const currentCabinet = cabinets.find(c => 
            Math.abs(c.x - this.sprite.x) < 5 && Math.abs(c.y - this.sprite.y) < 5
        );
        
        // Activar animación de salida del cabinet si lo encontramos
        if (currentCabinet) {
            currentCabinet.play('cabinet_interact');
            currentCabinet.once('animationcomplete', () => {
                currentCabinet.play('cabinet_idle');
            });
        }
        
        this.sprite.x = this._originalPos.x;
        this.sprite.y = this._originalPos.y;
        this.sprite.setVisible(true);
        this.gun.setVisible(true);
        this.isHidden = false;
        
        // Reiniciar animación idle al salir
        if (this.isAlive && !this.isDying) {
            this.sprite.play('player_idle');
        }
        
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
        if (!this.isAlive || this.isDying) return;

        console.log('Game Over - Iniciando animación de muerte...');
        
        this.isAlive = false;
        this.isDying = true;
        this.sprite.body.setVelocity(0, 0); // Detener movimiento
        
        // Pausar todo el mundo excepto el jugador
        this._pauseWorld();
        
        // Ocultar arma
        this.gun.setVisible(false);
        
        // Reproducir animación de muerte (no hace flip)
        this.sprite.setFlipX(false); // Resetear flip para muerte
        this.sprite.play('player_death');
        
        // Zoom de cámara hacia el jugador
        this.scene.cameras.main.pan(this.sprite.x, this.sprite.y, 1000, 'Power2');
        this.scene.cameras.main.zoomTo(2, 1000, 'Power2');
        
        // Pausar el juego después de la animación
        this.sprite.once('animationcomplete', () => {
            this.scene.time.delayedCall(1000, () => {
                // Reiniciar escena después de 1 segundo
                this.scene.scene.restart();
            });
        });
    }

    // Pausar mundo durante muerte
    _pauseWorld() {
        // Pausar todos los enemigos
        if (this.scene.enemies) {
            this.scene.enemies.forEach(enemy => {
                enemy.pause();
            });
        }
        
        // Pausar física de almas
        if (this.scene.souls) {
            this.scene.souls.children.each(soul => {
                if (soul.body) {
                    soul.body.setVelocity(0, 0);
                }
            });
        }
        
        console.log('Mundo pausado durante muerte del jugador');
    }

    // Colisiones
        addColliders(walls, cabinets) {
        this.scene.physics.add.collider(this.sprite, walls);
        this.scene.physics.add.collider(this.sprite, cabinets);
    }

    // Shoot — devuelve cuántas almas se destruyeron
    shoot(pointer, souls, walls, cabinets) {
        const targetX = pointer.worldX;
        const targetY = pointer.worldY;
 
        //const flash = this.scene.add.circle(this.gun.x, this.gun.y, 5, 0xffffff);
        //this.scene.time.delayedCall(50, () => flash.destroy());
 
        this.gun.play('gun_shoot');

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
                //const soulFlash = this.scene.add.circle(soul.x, soul.y, 10, 0xffff00);
                //this.scene.time.delayedCall(100, () => soulFlash.destroy());
                soul.play('soul_captured');
                // Destruir alma después de la animación de captura
                soul.once('animationcomplete', () => {
                    soul.destroy();
                });
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
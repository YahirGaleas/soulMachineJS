import {
    buildNavGrid, worldToGrid, gridToWorld,
    findPath, smoothPath
} from '../utils/Pathfinding.js';

// Puntos de patrulla por defecto si el JSON no trae ninguno
const DEFAULT_PATROL_POINTS = [
    { x: 60, y: 25 },
    { x: 755, y: 25 },
    { x: 755, y: 545 },
    { x: 60, y: 545 }
];

const ENEMY_RANGE   = 250;
const ENEMY_SPEED   = 100;
const FOV_ANGLE     = Phaser.Math.DegToRad(60);
const VISION_SEGS   = 32;

// Velocidad y rango según tipo
const TYPE_CONFIG = {
    reaper: { speed: 100, range: 250, color: 0xff0000 },
    fast:   { speed: 180, range: 140, color: 0xff8800 },
};

export default class Enemy {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {object} options
     * @param {'reaper'|'fast'} options.type
     * @param {Array<{x:number,y:number}>} options.patrolPoints
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;

        this.type = options.type ?? 'reaper';
        const cfg = TYPE_CONFIG[this.type] ?? TYPE_CONFIG.reaper;
        this._speed = cfg.speed;
        this._range = cfg.range;

        // Sprite del enemigo — usar sprites animados según el tipo
        const initialFrame = this.type === 'fast' ? 'fast_reaper_0' : 'reaper_0';
        this.sprite = scene.add.sprite(x, y, initialFrame);
        this.sprite.setScale(1.3); // Escala para hacer más visible
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        
        // hitbox circular
        this.sprite.body.setCircle(10);
        
        // Iniciar animación idle según tipo
        const idleAnim = this.type === 'fast' ? 'fast_reaper_idle' : 'reaper_idle';
        this.sprite.play(idleAnim);
        
        // Variable para controlar animación actual
        this.currentAnimation = 'idle';

        // Estado interno
        this.state             = 'patrol';
        this.rotation          = 0;
        this.targetRotation    = 0;
        this.rotationSpeed     = 0.05;
        this.searchOscillation = 0;

        // Patrulla — usar los puntos del JSON o el fallback por defecto
        const pts = options.patrolPoints;
        this.patrolPoints              = (pts && pts.length > 0) ? pts : DEFAULT_PATROL_POINTS;
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
        
        // Estado de pausa
        this.isPaused = false;
        this._pausedVelocity = { x: 0, y: 0 };
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
        // No hacer nada si está pausado
        if (this.isPaused) {
            return;
        }
        
        this._updateState(player, walls, cabinets);
        this._executeState(player, walls, cabinets);
        this._updateVision(player, walls, cabinets);
        this._checkKillPlayer(player);
        this._updateAnimation();
    }

    // Métodos de pausa
    pause() {
        if (this.isPaused) return;

        // Guardar velocidad actual y detener movimiento
        this._pausedVelocity.x = this.sprite.body.velocity.x;
        this._pausedVelocity.y = this.sprite.body.velocity.y;
        this.sprite.body.setVelocity(0, 0);
        
        // Congelar visión (mantener el último estado dibujado)
        this.isPaused = true;
        
        console.log('Enemigo pausado');
    }

    resume() {
        if (!this.isPaused) return;

        // Restaurar velocidad
        this.sprite.body.setVelocity(this._pausedVelocity.x, this._pausedVelocity.y);
        this.isPaused = false;
        
        console.log('Enemigo reanudado');
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
            dist < this._range &&
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
        this.sprite.body.setVelocity(Math.cos(angle) * this._speed, Math.sin(angle) * this._speed);

        const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        if (dist < 2) { // Reducido de 1 a 2 para mejor navegabilidad
            if (!this.alreadyReachedFirstPoint) {
                this.alreadyReachedFirstPoint = true;
            } else {
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            }
        }
    }

    // Chase
    _doChase(player, walls, cabinets) {
        if (this._hasLineOfSight(player.x, player.y, walls, cabinets)) {
            const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
            this.targetRotation = angle;
            this.sprite.body.setVelocity(Math.cos(angle) * this._speed, Math.sin(angle) * this._speed);
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

        if (dist > 50) { // Reducido de 70 a 50 para búsqueda más precisa
            this.sprite.body.setVelocity(Math.cos(angle) * this._speed, Math.sin(angle) * this._speed);
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

    // Recovery
    _doRecovery() {
        // Buscar el patrol point más cercano
        let closest = this.patrolPoints[0];
        let closestDist = Infinity;
        let closestIndex = 0;

        this.patrolPoints.forEach((pt, i) => {
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, pt.x, pt.y);
            if (d < closestDist) { closestDist = d; closest = pt; closestIndex = i; }
        });

        if (closestDist < 10) { // Reducido de 15 a 10 para mejor precisión
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

            if (dist < 5) { 
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
                this.sprite.body.setVelocity(Math.cos(angle) * this._speed * smooth, Math.sin(angle) * this._speed * smooth);
            }
        } else {
            const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, closest.x, closest.y);
            this.targetRotation = angle;
            this.sprite.body.setVelocity(Math.cos(angle) * this._speed * 0.5, Math.sin(angle) * this._speed * 0.5);
        }
    }

    // Vision del jugador
    canSeePlayer(player, walls, cabinets) {
        if (player.isHidden) return false;

        const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
        const diff  = Phaser.Math.Angle.Wrap(angle - this.rotation);

        if (dist > this._range || Math.abs(diff) > FOV_ANGLE / 2) return false;

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

        const coneColor = this.type === 'fast' ? 0xff8800 : 0xff0000;

        const leftAngle  = this.rotation - FOV_ANGLE / 2;
        const rightAngle = this.rotation + FOV_ANGLE / 2;

        g.fillStyle(coneColor, 0.2);
        g.lineStyle(2, coneColor, 0.5);
        g.beginPath();
        g.moveTo(this.sprite.x, this.sprite.y);

        for (let i = 0; i <= VISION_SEGS; i++) {
            const angle = leftAngle + (rightAngle - leftAngle) * (i / VISION_SEGS);
            let ex = this.sprite.x + Math.cos(angle) * this._range;
            let ey = this.sprite.y + Math.sin(angle) * this._range;

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
            this.sprite.x + Math.cos(this.rotation) * this._range * 0.7,
            this.sprite.y + Math.sin(this.rotation) * this._range * 0.7
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

    // Actualizar animación según estado
    _updateAnimation() {
        let targetAnimation = 'idle';
        
        // Determinar animación según estado
        if (this.state === 'chase' || this.state === 'searchHiding') {
            targetAnimation = 'chase';
        } else if (this.state === 'patrol' || this.state === 'recovery') {
            targetAnimation = 'idle';
        }
        
        // Cambiar animación solo si es diferente
        if (this.currentAnimation !== targetAnimation) {
            this.currentAnimation = targetAnimation;
            
            const animKey = this.type === 'fast' 
                ? `fast_reaper_${targetAnimation}`
                : `reaper_${targetAnimation}`;
                
            this.sprite.play(animKey);
        }
    }

    // Acceso directo a las coordenadas del sprite (comodidad)
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
}
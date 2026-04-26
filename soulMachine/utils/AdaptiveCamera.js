
export default class AdaptiveCamera {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        
        // Configuración de modos de cámara
        this.modes = {
            NORMAL: {
                name: 'Normal', 
                zoom: 1.3,        // Zoom estándar
                followSmooth: 0.05, // Seguimiento moderado
                description: 'Balance entre visión y tensión'
            },
            TENSION: {
                name: 'Tensión',
                zoom: 1.6,        
                followSmooth: 0.08, // Seguimiento más responsivo
                description: 'Vista cercana para máxima inmersión'
            },
            STEALTH: {
                name: 'Sigilo',
                zoom: 1.4,        
                followSmooth: 0.04, 
                description: 'Optimizada para esconderse'
            }
        };
        
        // Estado inicial
        this.currentMode = 'NORMAL';
        this.targetZoom = this.modes.NORMAL.zoom;
        this.currentZoom = 1.0;
        this.enabled = false;
        
        // Para cámara suave
        this.targetX = player.x;
        this.targetY = player.y;
        
        // Detección automática de context
        this.autoSwitchEnabled = true;
        this.lastPlayerState = null;
        this.enemyProximityThreshold = 150;
    }

    init() {
        // Configurar seguimiento inicial
        this.scene.cameras.main.startFollow(this.player.sprite);
        this.scene.cameras.main.setLerp(this.modes[this.currentMode].followSmooth, this.modes[this.currentMode].followSmooth);
        
        // Asegurar que la cámara esté centrada en el jugador
        this._centerCameraOnPlayer();
        
        this.enabled = true;
        
        console.log(`Cámara Adaptativa: ${this.modes[this.currentMode].name}`);
        console.log(`[1][2][3] = Modos cámara | [T] = Auto ON/OFF`);
    }

    update() {
        if (!this.enabled) return;
        
        // Actualizacíon automática de contexto
        if (this.autoSwitchEnabled) {
            this._updateContextualMode();
        }
        
        // Aplicar zoom suave
        this._updateZoom();
        
        // Aplicar configuración de seguimiento
        const mode = this.modes[this.currentMode];
        this.scene.cameras.main.setLerp(mode.followSmooth, mode.followSmooth);
    }

    _updateContextualMode() {
        const player = this.player;
        let suggestedMode = 'NORMAL';
        
        // 🎯 MODO SIGILO: Cuando está escondido
        if (player.isHidden) {
            suggestedMode = 'STEALTH';
        }
        // ⚡ MODO TENSIÓN: Enemigo muy cerca
        else if (this._isEnemyNear()) {
            suggestedMode = 'TENSION';
        }
        // Por defecto: NORMAL para exploración
        
        // Cambiar solo si es diferente y beneficioso
        if (suggestedMode !== this.currentMode) {
            this.switchMode(suggestedMode, true); // true = cambio automático
        }
    }

    _isEnemyNear() {
        if (!this.scene.enemies) return false;
        
        return this.scene.enemies.some(enemy => {
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, enemy.x, enemy.y
            );
            return distance < this.enemyProximityThreshold && enemy.canSeePlayer;
        });
    }

    switchMode(modeName, isAutomatic = false) {
        if (!this.modes[modeName]) return false;
        
        const oldMode = this.currentMode;
        this.currentMode = modeName;
        this.targetZoom = this.modes[modeName].zoom;
        
        // Reconfigurar seguimiento de cámara para el nuevo modo
        const mode = this.modes[modeName];
        this.scene.cameras.main.setLerp(mode.followSmooth, mode.followSmooth);
        
        // Asegurar que la cámara siga al jugador después del cambio
        this._centerCameraOnPlayer();
        
        const prefix = isAutomatic ? 'AUTO' : 'MANUAL';
        console.log(`${prefix}: ${this.modes[oldMode].name} → ${this.modes[modeName].name}`);
        console.log(`   ${this.modes[modeName].description}`);
        
        return true;
    }

    _updateZoom() {
        // Interpolación suave del zoom
        const oldZoom = this.currentZoom;
        this.currentZoom = Phaser.Math.Linear(this.currentZoom, this.targetZoom, 0.02);
        
        // Solo aplicar si hay cambio significativo
        if (Math.abs(oldZoom - this.currentZoom) > 0.001) {
            this.scene.cameras.main.setZoom(this.currentZoom);
            
            // Re-centrar cámara en el jugador después del cambio de zoom
            this._centerCameraOnPlayer();
        }
    }

    // Métodos de control de cámara

    _centerCameraOnPlayer() {
        // Asegurar que la cámara esté centrada en el jugador
        // Esto es especialmente importante para zoom < 1 (modo táctico)
        if (this.player && this.player.sprite) {
            this.scene.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
        }
    }

    handleInput(keys) {
        // Cambio manual de modos (1, 2, 3 para fácil acceso)
        if (Phaser.Input.Keyboard.JustDown(keys.one)) {
            this.switchMode('NORMAL');
        }
        if (Phaser.Input.Keyboard.JustDown(keys.two)) {
            this.switchMode('STEALTH');
        }
        if (Phaser.Input.Keyboard.JustDown(keys.three)) {
            this.switchMode('TENSION');
        }
        
        // Toggle modo automático
        if (Phaser.Input.Keyboard.JustDown(keys.t)) {
            this.autoSwitchEnabled = !this.autoSwitchEnabled;
            console.log(`Cambio automático: ${this.autoSwitchEnabled ? 'ON' : 'OFF'}`);
        }
    }

    // Efectos especiales

    shakeOnDanger() {
        // Temblor cuando está en peligro
        this.scene.cameras.main.shake(200, 0.005);
    }

    focusOnThreat(threatX, threatY) {
        // Dirigir brevemente la cámara hacia una amenaza
        const currentX = this.scene.cameras.main.scrollX + this.scene.cameras.main.width / 2;
        const currentY = this.scene.cameras.main.scrollY + this.scene.cameras.main.height / 2;
        
        // Mover ligeramente hacia la amenaza por 500ms
        this.scene.cameras.main.pan(
            currentX + (threatX - currentX) * 0.3,
            currentY + (threatY - currentY) * 0.3,
            500, 'Power2'
        );
        
        // Volver al jugador
        this.scene.time.delayedCall(800, () => {
            this.scene.cameras.main.startFollow(this.player.sprite);
        });
    }

    // Información para HUD

    getCurrentModeInfo() {
        return {
            mode: this.currentMode,
            name: this.modes[this.currentMode].name,
            description: this.modes[this.currentMode].description,
            auto: this.autoSwitchEnabled,
            zoom: Math.round(this.currentZoom * 100) / 100
        };
    }

    disable() {
        this.enabled = false;
        this.scene.cameras.main.stopFollow();
        this.scene.cameras.main.setZoom(1);
    }

    enable() {
        this.enabled = true;
        this.init();
    }
}
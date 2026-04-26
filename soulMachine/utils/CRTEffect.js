
export default class CRTEffect {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        
        // Configuración
        this.config = {
            scanlineIntensity: 0.15,
            vignetteStrength: 0.3,
            interferenceChance: 0.002,
            glitchDuration: 100,
            aiAnalysisInterval: 2000,
            chromaAberration: 2
        };
        
        // Estado de análisis de IA
        this.aiState = {
            analyzing: false,
            currentTarget: null,
            analysisPhase: 0,
            confidence: 0,
            lastUpdate: 0
        };
        
        this._createEffects();
        this._createAIOverlay();
        this._startAIAnalysis();
    }

    _createEffects() {
        // Usar dimensiones fijas del juego
        const width = this.scene.sys.game.canvas.width;
        const height = this.scene.sys.game.canvas.height;
        
        // Scanlines
        this.scanlines = this.scene.add.graphics();
        this.scanlines.setDepth(1000);
        this.scanlines.setScrollFactor(0); // Mantener fijo en pantalla
        
        // Crear líneas de escaneo
        for (let y = 0; y < height; y += 3) {
            this.scanlines.fillStyle(0x000000, this.config.scanlineIntensity);
            this.scanlines.fillRect(0, y, width, 1);
        }
        
        // Vignette (bordes oscuros)
        this.vignette = this.scene.add.graphics();
        this.vignette.setDepth(999);
        this.vignette.setScrollFactor(0); // Mantener fijo en pantalla
        
        const gradient = this.scene.add.graphics();
        gradient.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 
                                 0, this.config.vignetteStrength, 0, this.config.vignetteStrength);
        
        // Crear vignette radial
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.max(width, height);
        
        for (let i = 0; i < 50; i++) {
            const alpha = (i / 50) * this.config.vignetteStrength;
            const radius = (maxRadius * 0.8) - (i * 10);
            
            this.vignette.lineStyle(10, 0x000000, alpha);
            this.vignette.strokeCircle(centerX, centerY, radius);
        }
        
        // Interferencia ocasional
        this.interference = this.scene.add.graphics();
        this.interference.setDepth(1001);
        this.interference.setScrollFactor(0); // Mantener fijo en pantalla
        this.interference.setVisible(false);
        
        // Aberración cromática
        this.chromaticShift = this.scene.add.graphics();
        this.chromaticShift.setDepth(998);
        this.chromaticShift.setScrollFactor(0); // Mantener fijo en pantalla
        this.chromaticShift.setBlendMode(Phaser.BlendModes.SCREEN);
    }

    _createAIOverlay() {
        // Usar dimensiones fijas del juego, no de la cámara que cambia con zoom
        const width = this.scene.sys.game.canvas.width;
        const height = this.scene.sys.game.canvas.height;
        
        // Container principal del HUD de IA
        this.aiHUD = this.scene.add.container(0, 0);
        this.aiHUD.setDepth(1002);
        this.aiHUD.setScrollFactor(0); // Mantener fijo en pantalla
        
        // Esquinas del marco
        const cornerSize = 30;
        const cornerThickness = 3;
        const corners = this.scene.add.graphics();
        
        corners.lineStyle(cornerThickness, 0x00ff00, 0.8);
        // Esquina superior izquierda
        corners.moveTo(10, 10 + cornerSize).lineTo(10, 10).lineTo(10 + cornerSize, 10);
        // Esquina superior derecha
        corners.moveTo(width - 10 - cornerSize, 10).lineTo(width - 10, 10).lineTo(width - 10, 10 + cornerSize);
        // Esquina inferior izquierda
        corners.moveTo(10, height - 10 - cornerSize).lineTo(10, height - 10).lineTo(10 + cornerSize, height - 10);
        // Esquina inferior derecha
        corners.moveTo(width - 10 - cornerSize, height - 10).lineTo(width - 10, height - 10).lineTo(width - 10, height - 10 - cornerSize);
        corners.strokePath();
        
        this.aiHUD.add(corners);
        
        // Texto de estado de IA
        this.statusText = this.scene.add.text(20, 20, 'AI MONITORING SYSTEM v2.1', {
            fontSize: '12px',
            fontFamily: 'Courier New',
            fill: '#00ff00',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        });
        this.aiHUD.add(this.statusText);
        
        this.analysisText = this.scene.add.text(20, 40, 'STATUS: INITIALIZING...', {
            fontSize: '10px',
            fontFamily: 'Courier New',  
            fill: '#00ff88',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 6, y: 2 }
        });
        this.aiHUD.add(this.analysisText);
        
        // Barra de confianza
        this.confidenceBar = this.scene.add.graphics();
        this.aiHUD.add(this.confidenceBar);
        
        // Indicador de objetivo
        this.targetIndicator = this.scene.add.graphics();
        this.targetIndicator.setDepth(1001);
        // NOTA: targetIndicator NO debe tener setScrollFactor(0) porque sigue al jugador
        
        // Grid de análisis
        this.analysisGrid = this.scene.add.graphics();
        this.analysisGrid.setDepth(997);
        this.analysisGrid.setScrollFactor(0); // Mantener fijo en pantalla
        this.analysisGrid.setAlpha(0.1);
        
        // Crear cuadrícula con dimensiones fijas
        this.analysisGrid.lineStyle(1, 0x00ff00, 0.3);
        for (let x = 0; x < width; x += 50) {
            this.analysisGrid.moveTo(x, 0).lineTo(x, height);
        }
        for (let y = 0; y < height; y += 50) {
            this.analysisGrid.moveTo(0, y).lineTo(width, y);
        }
        this.analysisGrid.strokePath();
    }

    _startAIAnalysis() {
        this.aiAnalysisTimer = this.scene.time.addEvent({
            delay: this.config.aiAnalysisInterval,
            callback: this._performAnalysis,
            callbackScope: this,
            loop: true
        });
        
        // Timer para efectos de interferencia
        this.interferenceTimer = this.scene.time.addEvent({
            delay: 100,
            callback: this._updateInterference,
            callbackScope: this,
            loop: true
        });
        
        // Timer para parpadeo del análisis
        this.blinkTimer = this.scene.time.addEvent({
            delay: 800,
            callback: this._blinkEffect,
            callbackScope: this,
            loop: true
        });
    }

    _performAnalysis() {
        if (!this.scene.player || !this.scene.player.isAlive) return;
        
        const player = this.scene.player;
        this.aiState.analyzing = true;
        this.aiState.currentTarget = player;
        
        // Simular diferentes fases de análisis
        const analyses = [
            `ANALYZING TARGET: Profesor ########`,
            `POSITION: [${Math.floor(player.x)}, ${Math.floor(player.y)}]`,
            `STATUS: ${player.isHidden ? 'HIDDEN' : player.isMoving ? 'MOBILE' : 'STATIONARY'}`,
            `THREAT LEVEL TO PROFESOR: ${this._calculateThreatLevel()}`,
            `SOUL COUNT: ${this.scene.soulCount || 0}`,
            `BEHAVIORAL PATTERN: ${this._analyzeMovement()}`,
            `PREDICTION: ${this._predictNextAction()}`,
            `CONFIDENCE: ${Math.floor(this.aiState.confidence)}%`
        ];
        
        const randomAnalysis = analyses[Math.floor(Math.random() * analyses.length)];
        this.analysisText.setText(randomAnalysis);
        
        // Actualizar confianza
        this.aiState.confidence = Phaser.Math.Clamp(
            this.aiState.confidence + Phaser.Math.Between(-10, 15), 
            0, 100
        );
        
        // Dibujar indicador de objetivo
        //this._drawTargetIndicator();
        this._updateConfidenceBar();
    }

    _calculateThreatLevel() {
        if (!this.scene.player) return 'UNKNOWN';
        
        const player = this.scene.player;
        if (player.isHidden) return 'MINIMAL';
        if (player.isMoving) return 'MODERATE';
        
        // Basado en proximidad a enemigos
        if (this.scene.enemies && this.scene.enemies.length > 0) {
            const nearestEnemy = this.scene.enemies.reduce((nearest, enemy) => {
                const dist1 = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
                const dist2 = nearest ? Phaser.Math.Distance.Between(player.x, player.y, nearest.x, nearest.y) : Infinity;
                return dist1 < dist2 ? enemy : nearest;
            }, null);
            
            if (nearestEnemy) {
                const distance = Phaser.Math.Distance.Between(player.x, player.y, nearestEnemy.x, nearestEnemy.y);
                if (distance < 100) return 'HIGH';
                if (distance < 200) return 'ELEVATED';
            }
        }
        
        return 'LOW';
    }

    _analyzeMovement() {
        const patterns = ['EVASIVE', 'EXPLORATIVE', 'STRATEGIC', 'CAUTIOUS', 'AGGRESSIVE', 'ERRATIC'];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    _predictNextAction() {
        const predictions = ['HIDE', 'COLLECT SOUL', 'AVOID THREAT', 'EXPLORE AREA', 'UNKNOWN'];
        return predictions[Math.floor(Math.random() * predictions.length)];
    }

    _drawTargetIndicator() {
        if (!this.scene.player) return;
        
        this.targetIndicator.clear();
        
        const player = this.scene.player;
        const x = player.x;
        const y = player.y;
        const size = 25;
        
        this.targetIndicator.lineStyle(2, 0x00ff00, 0.2);
        
        // Cruz de mira
        this.targetIndicator.moveTo(x - size, y).lineTo(x + size, y);
        this.targetIndicator.moveTo(x, y - size).lineTo(x, y + size);
        
        // Esquinas
        const corner = 8;
        this.targetIndicator.moveTo(x - size, y - size + corner).lineTo(x - size, y - size).lineTo(x - size + corner, y - size);
        this.targetIndicator.moveTo(x + size - corner, y - size).lineTo(x + size, y - size).lineTo(x + size, y - size + corner);
        this.targetIndicator.moveTo(x - size, y + size - corner).lineTo(x - size, y + size).lineTo(x - size + corner, y + size);
        this.targetIndicator.moveTo(x + size - corner, y + size).lineTo(x + size, y + size).lineTo(x + size, y + size - corner);
        
        this.targetIndicator.strokePath();
        
        // Punto central
        this.targetIndicator.fillStyle(0xff0000, 0.2);
        this.targetIndicator.fillCircle(x, y, 2);
    }

    _updateConfidenceBar() {
        this.confidenceBar.clear();
        
        const barWidth = 150;
        const barHeight = 8;
        const x = 20;
        const y = 65;
        
        // Fondo de la barra
        this.confidenceBar.fillStyle(0x333333, 0.8);
        this.confidenceBar.fillRect(x, y, barWidth, barHeight);
        
        // Barra de progreso
        const fillWidth = (this.aiState.confidence / 100) * barWidth;
        const color = this.aiState.confidence > 70 ? 0x00ff00 : 
                     this.aiState.confidence > 40 ? 0xffff00 : 0xff0000;
        
        this.confidenceBar.fillStyle(color, 0.7);
        this.confidenceBar.fillRect(x, y, fillWidth, barHeight);
        
        // Borde
        this.confidenceBar.lineStyle(1, 0x00ff00, 0.8);
        this.confidenceBar.strokeRect(x, y, barWidth, barHeight);
    }

    _updateInterference() {
        // Interferencia aleatoria
        if (Math.random() < this.config.interferenceChance) {
            this._createGlitch();
        }
        
        // Aberración cromática sutil
        if (Math.random() < 0.1) {
            this._updateChromaticAberration();
        }
    }

    _createGlitch() {
        // Usar dimensiones fijas del juego
        const width = this.scene.sys.game.canvas.width;
        const height = this.scene.sys.game.canvas.height;
        
        this.interference.clear();
        this.interference.setVisible(true);
        
        // Líneas de interferencia horizontales
        for (let i = 0; i < 5; i++) {
            const y = Math.random() * height;
            const lineHeight = Math.random() * 3 + 1;
            
            this.interference.fillStyle(0xffffff, Math.random() * 0.3);
            this.interference.fillRect(0, y, width, lineHeight);
        }
        
        // Desaparecer después del tiempo configurado
        this.scene.time.delayedCall(this.config.glitchDuration, () => {
            this.interference.setVisible(false);
        });
    }

    _updateChromaticAberration() {
        this.chromaticShift.clear();
        
        // Usar dimensiones fijas del juego
        const width = this.scene.sys.game.canvas.width;
        const height = this.scene.sys.game.canvas.height;
        const shift = this.config.chromaAberration;
        
        this.chromaticShift.fillStyle(0xff0000, 0.1);
        this.chromaticShift.fillRect(-shift, -shift, 
            width + shift * 2, 
            height + shift * 2);
    }

    _blinkEffect() {
        // Parpadeo sutil del HUD
        this.aiHUD.setAlpha(this.aiHUD.alpha === 1 ? 0.7 : 1);
    }

    // Métodos públicos

    enable() {
        this.isActive = true;
        this.scanlines.setVisible(true);
        this.vignette.setVisible(true);
        this.aiHUD.setVisible(true);
        this.analysisGrid.setVisible(true);
        console.log('CRT Effect: ENABLED - AI MONITORING ACTIVE');
    }

    disable() {
        this.isActive = false;
        this.scanlines.setVisible(false);
        this.vignette.setVisible(false);
        this.aiHUD.setVisible(false);
        this.analysisGrid.setVisible(false);
        this.targetIndicator.setVisible(false);
        console.log('CRT Effect: DISABLED');
    }

    toggle() {
        if (this.isActive) {
            this.disable();
        } else {
            this.enable();
        }
    }

    updateSoulCount(count) {
        this.scene.soulCount = count;
    }

    destroy() {
        if (this.aiAnalysisTimer) this.aiAnalysisTimer.destroy();
        if (this.interferenceTimer) this.interferenceTimer.destroy();
        if (this.blinkTimer) this.blinkTimer.destroy();
        
        this.scanlines?.destroy();
        this.vignette?.destroy();
        this.interference?.destroy();
        this.chromaticShift?.destroy();
        this.aiHUD?.destroy();
        this.targetIndicator?.destroy();
        this.analysisGrid?.destroy();
    }
}
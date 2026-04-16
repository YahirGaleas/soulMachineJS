const config = {
    type: Phaser.AUTO,
    // tamaño del navegador
    mode: Phaser.Scale.FIT,
    width: 800,
    height: 600,
    physics: {
        default: "arcade",
        arcade: {
            debug: false,
        },
    },
    scene: {
        preload,
        create,
        update,
    },
};

const game = new Phaser.Game(config);

let player;
let cursors;
let keyA;
let keyD;
let keyW;
let keyS;
let keySpace;
let gun;
let capturingArea;
let hideArea;
let isHidden = false;
let playerOriginalPosition = { x: 0, y: 0 }; // Guardar posición antes de esconderse
let enemySawPlayerHide = false; // Si el enemigo vio al jugador esconderse
let playerHidingLocation = { x: 0, y: 0 }; // Dónde se escondió el jugador
let enemy;
const enemyRange = 250;
const enemySpeed = 100;
let isAlive = true;
let enemyVisionGraphics; // Gráfico para mostrar el área de visión
let showEnemyVision = true; // Variable para activar/desactivar la visualización
let targetEnemyRotation = 0; // Rotación objetivo para interpolación suave
let rotationSpeed = 0.05; // Velocidad de interpolación de la rotación
let searchOscillation = 0; // Para oscilación durante búsqueda
let scanningAmplitude = 0.3; // Amplitud del escaneo cuando busca
const patrolPoints = [{x: 60, y: 25}, {x: 755, y: 25}, {x: 755, y: 545}, {x: 60, y: 545}]; // Puntos de patrulla en las esquinas del mapa
const firstPatrolPoint = patrolPoints[0]; // Punto de patrulla inicial para la parca
let alreadyReachedFirstPatrolPoint = false; // Variable para verificar si la parca ha alcanzado el primer punto de patrulla
let currentPatrolIndex = 0; // Índice del punto de patrulla actual para la parca
const directions = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 },
    { x: 1, y: -1 }, { x: -1, y: -1 }
];

let bestDirection = null; // Variable para almacenar la mejor dirección alternativa durante la recuperación
let enemyPreviousState = "patrol"; // Variable para trackear el estado anterior del enemigo
let recoveryTargetPoint = null; // Punto objetivo durante el recovery
let recoveryTimer = 0;
const GRID_SIZE = 10; // Más granular para mejor precisión
let navGrid = [];
let currentPath = [];
let pathIndex = 0;
let pathTimer = 0;
let pathCache = new Map(); // Cache para paths calculados anteriormente
let lastTargetPoint = null; // Para detectar cambios de objetivo

let captureSouls = 0; 
let totalSouls = 0; // Actualizar según el número de almas en el juego
let currentScene = null;

function preload() {
    // Crear texturas simples para las almas y paredes (sin renderizar en pantalla)
    let soulGraphics = this.add.graphics()
        .fillStyle(0x00ff00)
        .fillCircle(16, 16, 16)
        .generateTexture('soul', 32, 32);
    soulGraphics.destroy(); // Eliminar después de crear la textura

    let wallGraphics = this.add.graphics()
        .fillStyle(0x8B4513)
        .fillRect(0, 0, 50, 50)
        .generateTexture('wall', 50, 50);
    wallGraphics.destroy(); // Eliminar después de crear la textura

    // Crear textura para el área de captura (sin renderizar en pantalla)
    let captureGraphics = this.add.graphics()
        .fillStyle(0x0000ff, 0.5)
        .fillRect(0, 0, 200, 200)
        .generateTexture('captureArea', 200, 200);
    captureGraphics.destroy(); // Eliminar después de crear la textura

    // Gráficos distintivos de los armarios (sin renderizar en pantalla)
    let cabinetGraphics = this.add.graphics()
        .fillStyle(0x654321)
        .fillRect(0, 0, 40, 60)
        .generateTexture('cabinet', 40, 60);
    cabinetGraphics.destroy(); // Eliminar después de crear la textura
}

function create() {

    //FPS
    this.fpsText = this.add.text(10, 10, '', { font: '16px Arial', fill: '#ffffff' });

    // Debug: Coordenadas del mapa con el mouse
    this.coordText = this.add.text(10, 30, '', {
        font: '14px Arial',
        fill: '#00ff00'
    });

    // Instrucciones de control
    this.controlsText = this.add.text(10, 50, 'Presiona V para activar/desactivar visión del enemigo', {
        font: '12px Arial',
        fill: '#ffff00'
    });

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
this.walls.create(400, 0, "wall")
    .setScale(16, 0.2)
    .refreshBody();

// abajo
this.walls.create(400, 600, "wall")
    .setScale(16, 0.2)
    .refreshBody();

// izquierda
this.walls.create(0, 300, "wall")
    .setScale(0.2, 12)
    .refreshBody();

// derecha
this.walls.create(800, 300, "wall")
    .setScale(0.2, 12)
    .refreshBody();

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

function update() {
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

function hidePlayer(player, hideArea) {
    if (isHidden) {
        // Si ya está escondido, salir del escondite (sin importar la posición exacta)
        
        // Restaurar la posición original del jugador
        player.x = playerOriginalPosition.x;
        player.y = playerOriginalPosition.y;
        
        player.setVisible(true);
        gun.setVisible(true);
        isHidden = false;
        enemySawPlayerHide = false; // Reset al salir del escondite
        console.log("Jugador salió del escondite - posición restaurada");
        return;
    }
        
    // Verificar si el jugador está dentro de un área válida de escondite
    const playerBounds = player.getBounds();
    const hideAreaBounds = hideArea.getChildren().map(area => area.getBounds());

    const isInValidArea = hideAreaBounds.some(areaBounds =>
        Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, areaBounds)
    );

    if (!isHidden && isInValidArea) {
        // Esconderse: solo si está en área válida y no está escondido
        
        // Verificar si el enemigo puede ver al jugador esconderse
        const canEnemySeePlayer = checkIfEnemyCanSeePlayerWithObstacles();
        
        // Guardar la posición actual del jugador
        playerOriginalPosition.x = player.x;
        playerOriginalPosition.y = player.y;
        
        // Encontrar el cabinet más cercano y mover al jugador dentro de él
        const nearestCabinet = findNearestCabinet(player);
        if (nearestCabinet) {
            player.x = nearestCabinet.x;
            player.y = nearestCabinet.y;
            
            // Si el enemigo vio al jugador esconderse, recordar la ubicación
            if (canEnemySeePlayer) {
                enemySawPlayerHide = true;
                playerHidingLocation.x = nearestCabinet.x;
                playerHidingLocation.y = nearestCabinet.y;
                console.log("¡El enemigo te vio esconderte! Vendrá por ti...");
            } else {
                enemySawPlayerHide = false;
                console.log("Te escondiste sin ser visto - estás a salvo");
            }
        }
        
        player.setVisible(false);
        gun.setVisible(false);
        isHidden = true;
    } else if (!isHidden && !isInValidArea) {
        // Intento de esconderse fuera de área válida
        console.log("No puedes esconderte aquí - busca un área de escondite (azul)");
    }
}

function findNearestCabinet(player) {
    // todo: almacenar los cabinetes en una variable global para no hardcodearlos
    const cabinets = [
        {x: 300, y: 400}, 
        {x: 500, y: 100}
    ];
    
    let nearestCabinet = null;
    let shortestDistance = Infinity;
    
    cabinets.forEach(cabinet => {
        const distance = Phaser.Math.Distance.Between(player.x, player.y, cabinet.x, cabinet.y);
        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestCabinet = cabinet;
        }
    });
    
    return nearestCabinet;
}

// Función para verificar si el enemigo puede ver al jugador
function checkIfEnemyCanSeePlayer() {
    const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    const angleDifference = Phaser.Math.Angle.Wrap(angleToPlayer - enemy.rotation);
    const angleThreshold = Phaser.Math.DegToRad(60);
    
    // Verificar si está en rango y ángulo de visión
    if (distanceToPlayer > enemyRange || Math.abs(angleDifference) > angleThreshold / 2) {
        return false;
    }
    
    return true;
}

// Variable global temporal para almacenar referencias del scene


// Función mejorada que incluye verificación de obstáculos
function checkIfEnemyCanSeePlayerWithObstacles() {
    const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    const angleDifference = Phaser.Math.Angle.Wrap(angleToPlayer - enemy.rotation);
    const angleThreshold = Phaser.Math.DegToRad(60);
    
    // Verificar si está en rango y ángulo de visión
    if (distanceToPlayer > enemyRange || Math.abs(angleDifference) > angleThreshold / 2) {
        return false;
    }
    
    // Verificar línea de vista (sin obstáculos) usando el scene actual
    if (currentScene && currentScene.walls && currentScene.cabinets) {
        const ray = new Phaser.Geom.Line(enemy.x, enemy.y, player.x, player.y);
        
        const wallHits = currentScene.walls.getChildren().filter((wall) => {
            const wallBounds = wall.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, wallBounds);
        });
        
        const cabinetHits = currentScene.cabinets.getChildren().filter((cabinet) => {
            const cabinetBounds = cabinet.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, cabinetBounds);
        });
        
        return wallHits.length === 0 && cabinetHits.length === 0;
    }
    
    return true; // Si no hay referencias disponibles, asumir que puede ver
}

function shoot(pointer) {
    // No se puede disparar si el jugador está muerto
    if (!isAlive) {
        console.log("No puedes disparar estando muerto");
        return;
    }

    // Verificar si el disparo está en cooldown
    if (this.shootCooldown) {
        console.log("disparo en cooldown");
        return;
    }

    this.shootCooldown = true;

    const shootFromX = gun.x;
    const shootFromY = gun.y;
    const targetX = pointer.worldX;
    const targetY = pointer.worldY;

    // Flash en la posición del arma para mostrar el disparo
    const flash = this.add.circle(shootFromX, shootFromY, 5, 0xffffff);
    this.time.delayedCall(50, () => {
        flash.destroy();
    });

    this.souls.children.each((soul) => {
        if (!soul.active) return;

        // Calcular la distancia desde donde se hizo clic hasta el alma
        const distanceFromTarget = Phaser.Math.Distance.Between(targetX, targetY, soul.x, soul.y);

        // Si la distancia desde el punto de clic hasta el alma es menor a 40
        if (distanceFromTarget < 40) {
            // Crear la línea desde el arma hasta el alma para verificar colisiones
            const ray = new Phaser.Geom.Line(shootFromX, shootFromY, soul.x, soul.y);

            // Verificar si hay paredes que bloquean la línea de vista
            const hits = this.walls.getChildren().filter((wall) => {
                const wallBounds = wall.getBounds();
                return Phaser.Geom.Intersects.LineToRectangle(ray, wallBounds);
            });

            const hitsCabinet = this.cabinets.getChildren().filter((cabinet) => {
                const cabinetBounds = cabinet.getBounds();
                return Phaser.Geom.Intersects.LineToRectangle(ray, cabinetBounds);
            });

            // Solo destruir el alma si no hay paredes bloqueando
            if (hits.length === 0 && hitsCabinet.length === 0) {
                const soulFlash = this.add.circle(soul.x, soul.y, 10, 0xffff00);
                this.time.delayedCall(100, () => {
                    soulFlash.destroy();
                });
                soul.destroy();
                captureSouls++;
                console.log(`alma recolectada - sin obstáculos (${captureSouls}/${totalSouls})`);
                if (captureSouls >= totalSouls) {
                    console.log("¡Has capturado todas las almas! ¡Victoria!");
                    this.scene.restart(); // Reiniciar el juego o mostrar una pantalla de victoria
                }
            } else {
                console.log("disparo bloqueado por pared");
            }
        }
    });

    // Activar cooldown por 2 segundos
    this.time.delayedCall(2000, () => {
        this.shootCooldown = false;
        console.log("disparo listo");
    });
}

function drawEnemyVision(walls, cabinets) {
    enemyVisionGraphics.clear();
    
    // Configuración del cono de visión
    const visionRange = enemyRange;
    const fieldOfView = Phaser.Math.DegToRad(60); 
    const segments = 32; 
    
    // Calcular la rotación objetivo según el estado del enemigo
    let targetRotation = enemy.rotation;
    
    if (enemy.state === "chase") {
        // Durante chase, mirar hacia el jugador
        targetRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        rotationSpeed = 0.15; // Rotación más rápida durante chase
    } else if (enemy.state === "patrol") {
        // Durante patrulla, calcular hacia dónde se dirige
        if (!alreadyReachedFirstPatrolPoint) {
            targetRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, firstPatrolPoint.x, firstPatrolPoint.y);
        } else {
            const targetPoint = patrolPoints[currentPatrolIndex];
            targetRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, targetPoint.x, targetPoint.y);
        }
        rotationSpeed = 0.08; // Rotación moderada durante patrulla
    } else if (enemy.state === "recovery") {
        // Durante recovery, mirar hacia el punto de patrulla más cercano o siguiente waypoint
        let recoveryCameraTarget = null;
        
        if (currentPath.length > 0 && pathIndex < currentPath.length) {
            // Mirar hacia el siguiente waypoint en el path
            const nextWaypoint = currentPath[Math.min(pathIndex + 2, currentPath.length - 1)]; // Mirar un poco más adelante
            const worldPos = gridToWorld(nextWaypoint.x, nextWaypoint.y);
            recoveryCameraTarget = { x: worldPos.x, y: worldPos.y };
        } else {
            // Mirar hacia el punto de patrulla más cercano
            let closestPoint = patrolPoints[0];
            let closestDistance = Infinity;
            
            patrolPoints.forEach((point) => {
                const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, point.x, point.y);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPoint = point;
                }
            });
            recoveryCameraTarget = closestPoint;
        }
        
        if (recoveryCameraTarget) {
            targetRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, recoveryCameraTarget.x, recoveryCameraTarget.y);
        }
        rotationSpeed = 0.06; // Rotación más lenta y suave durante recovery
    } else if (enemy.state === "searchHiding") {
        // Durante búsqueda, mirar hacia el escondite con ligera oscilación
        const baseRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerHidingLocation.x, playerHidingLocation.y);
        searchOscillation += 0.1; // Incrementar oscilación
        targetRotation = baseRotation + Math.sin(searchOscillation) * scanningAmplitude;
        rotationSpeed = 0.12; // Rotación moderadamente rápida durante búsqueda
    }
    
    // Interpolación suave de la rotación usando Phaser.Math.Angle.RotateTo
    enemy.rotation = Phaser.Math.Angle.RotateTo(enemy.rotation, targetRotation, rotationSpeed);
    
    // Usar la rotación interpolada para el campo de visión
    let enemyFacingAngle = enemy.rotation;
    
    // Calcular los ángulos del cono de visión
    const leftAngle = enemyFacingAngle - fieldOfView / 2;
    const rightAngle = enemyFacingAngle + fieldOfView / 2;
    
    // Crear el path del cono de visión
    enemyVisionGraphics.fillStyle(0xff0000, 0.2); // Rojo semi-transparente
    enemyVisionGraphics.lineStyle(2, 0xff0000, 0.5);
    
    // Comenzar el path desde la posición del enemigo
    enemyVisionGraphics.beginPath();
    enemyVisionGraphics.moveTo(enemy.x, enemy.y);
    
    // Dibujar el arco del cono de visión, verificando obstáculos
    for (let i = 0; i <= segments; i++) {
        const angle = leftAngle + (rightAngle - leftAngle) * (i / segments);
        let endX = enemy.x + Math.cos(angle) * visionRange;
        let endY = enemy.y + Math.sin(angle) * visionRange;
        
        // Verificar colisiones con obstáculos para acortar el rayo
        const ray = new Phaser.Geom.Line(enemy.x, enemy.y, endX, endY);
        
        // Verificar colisiones con paredes
        walls.getChildren().forEach((wall) => {
            const wallBounds = wall.getBounds();
            const intersection = Phaser.Geom.Intersects.GetLineToRectangle(ray, wallBounds);
            if (intersection) {
                const distToWall = Phaser.Math.Distance.Between(enemy.x, enemy.y, intersection.x, intersection.y);
                const distToCurrent = Phaser.Math.Distance.Between(enemy.x, enemy.y, endX, endY);
                if (distToWall < distToCurrent) {
                    endX = intersection.x;
                    endY = intersection.y;
                }
            }
        });
        
        // Verificar colisiones con cabinetes
        cabinets.getChildren().forEach((cabinet) => {
            const cabinetBounds = cabinet.getBounds();
            const intersection = Phaser.Geom.Intersects.GetLineToRectangle(ray, cabinetBounds);
            if (intersection) {
                const distToCabinet = Phaser.Math.Distance.Between(enemy.x, enemy.y, intersection.x, intersection.y);
                const distToCurrent = Phaser.Math.Distance.Between(enemy.x, enemy.y, endX, endY);
                if (distToCabinet < distToCurrent) {
                    endX = intersection.x;
                    endY = intersection.y;
                }
            }
        });
        
        enemyVisionGraphics.lineTo(endX, endY);
    }
    
    // Cerrar el path y rellenarlo
    enemyVisionGraphics.closePath();
    enemyVisionGraphics.fillPath();
    enemyVisionGraphics.strokePath();
    
    // Dibujar una línea central para mostrar la dirección exacta del enemigo
    enemyVisionGraphics.lineStyle(2, 0xffffff, 0.8);
    const centerEndX = enemy.x + Math.cos(enemyFacingAngle) * visionRange * 0.7;
    const centerEndY = enemy.y + Math.sin(enemyFacingAngle) * visionRange * 0.7;
    enemyVisionGraphics.beginPath();
    enemyVisionGraphics.moveTo(enemy.x, enemy.y);
    enemyVisionGraphics.lineTo(centerEndX, centerEndY);
    enemyVisionGraphics.strokePath();
    
    // Línea de debug para mostrar la dirección objetivo (opcional)
    if (showEnemyVision && targetRotation !== undefined) {
        enemyVisionGraphics.lineStyle(1, 0x00ff00, 0.5); // Verde semi-transparente
        const targetEndX = enemy.x + Math.cos(targetRotation) * visionRange * 0.5;
        const targetEndY = enemy.y + Math.sin(targetRotation) * visionRange * 0.5;
        enemyVisionGraphics.beginPath();
        enemyVisionGraphics.moveTo(enemy.x, enemy.y);
        enemyVisionGraphics.lineTo(targetEndX, targetEndY);
        enemyVisionGraphics.strokePath();
    }
}

function reaperUpdate(walls, cabinets) {

    const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);

    const angleDifference = Phaser.Math.Angle.Wrap(angleToPlayer - enemy.rotation);

    const angleThreshold = Phaser.Math.DegToRad(60);

    // Lógica de detección y estados del enemigo
    if (enemySawPlayerHide) {
        // PRIORIDAD: Si vio al jugador esconderse, ir al escondite
        if (enemy.state !== "searchHiding") {
            // Transición suave al cambiar de estado
            targetEnemyRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerHidingLocation.x, playerHidingLocation.y);
        }
        enemyPreviousState = enemy.state;
        enemy.state = "searchHiding";
    } else if (distanceToPlayer < enemyRange && Math.abs(angleDifference) < angleThreshold / 2 && !isHidden) {
        // Solo detectar al jugador si NO está escondido Y si no hay obstáculos entre ellos
        const ray = new Phaser.Geom.Line(enemy.x, enemy.y, player.x, player.y);
        const hits = walls.getChildren().filter((wall) => {
            const wallBounds = wall.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, wallBounds);
        });

        const hitsCabinet = cabinets.getChildren().filter((cabinet) => {
            const cabinetBounds = cabinet.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, cabinetBounds);
        });

        // Solo activar chase si no hay obstáculos bloqueando
        if (hits.length === 0 && hitsCabinet.length === 0) {
            if (enemy.state !== "chase") {
                // Transición suave al entrar en chase
                targetEnemyRotation = angleToPlayer;
            }
            enemyPreviousState = enemy.state;
            enemy.state = "chase";
        } else if (enemy.state !== "searchHiding" && enemy.state !== "recovery") {
            // Solo cambiar a patrol si no está en estados especiales
            enemyPreviousState = enemy.state;
            enemy.state = "patrol";
        }
    } else if (enemy.state !== "searchHiding" && enemy.state !== "recovery") {
        // Si estaba en chase, pasar a recovery
        if (enemy.state === "chase") {
            // Transición suave al recovery: mirar hacia el punto de patrulla más cercano
            let closestPoint = patrolPoints[0];
            let closestDistance = Infinity;
            
            patrolPoints.forEach((point) => {
                const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, point.x, point.y);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPoint = point;
                }
            });
            
            targetEnemyRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, closestPoint.x, closestPoint.y);
            enemyPreviousState = enemy.state;
            enemy.state = "recovery";
        } else {
            enemyPreviousState = enemy.state;
            enemy.state = "patrol";
        }
    }

    if (enemy.state === "chase") {
        //Chequear que no mire atraves de paredes
        const ray = new Phaser.Geom.Line(enemy.x, enemy.y, player.x, player.y);
        const hits = walls.getChildren().filter((wall) => {
            const wallBounds = wall.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, wallBounds);
        });

        const hitsCabinet = cabinets.getChildren().filter((cabinet) => {
            const cabinetBounds = cabinet.getBounds();
            return Phaser.Geom.Intersects.LineToRectangle(ray, cabinetBounds);
        });
        if (hits.length === 0 && hitsCabinet.length === 0) {
            enemy.body.setVelocity(Math.cos(angleToPlayer) * enemySpeed, Math.sin(angleToPlayer) * enemySpeed);
        } else {
            enemy.body.setVelocity(0);
        }
    } else if (enemy.state === "searchHiding") {
        // Ir al lugar donde vio al jugador esconderse
        const angleToHiding = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerHidingLocation.x, playerHidingLocation.y);
        const distanceToHiding = Phaser.Math.Distance.Between(enemy.x, enemy.y, playerHidingLocation.x, playerHidingLocation.y);
        
        console.log(`Buscando escondite - Distancia: ${Math.floor(distanceToHiding)}, Escondido: ${isHidden}`);
        
        const reachDistance = 70;

        if (distanceToHiding > reachDistance) {
            // Moverse hacia el escondite
            enemy.body.setVelocity(Math.cos(angleToHiding) * enemySpeed, Math.sin(angleToHiding) * enemySpeed);
        } else {
            // Llegó al escondite, sacar al jugador a la fuerza
            enemy.body.setVelocity(0);
            if (isHidden) {
                console.log("¡Forzando salida del escondite!");
                // Restaurar posición del jugador
                player.x = playerOriginalPosition.x;
                player.y = playerOriginalPosition.y;
                player.setVisible(true);
                gun.setVisible(true);
                isHidden = false;
                enemySawPlayerHide = false;
                console.log("¡El enemigo te sacó del escondite!");
                
                // Cambiar a chase después de sacarlo
                enemy.state = "chase";
            } else {
                // Si el jugador ya no está escondido, continuar patrullando
                enemySawPlayerHide = false;
                searchOscillation = 0; // Resetear oscilación al salir de búsqueda
                enemy.state = "patrol";
                console.log("El jugador ya salió del escondite");
            }
        }
    } else {
        enemy.body.setVelocity(0);
    }

    /* 
    Comportamiento de la parca en patrulla
    - Se tendra puntos especificos del mapa el cual el enemigo patrullara de manera constante y ciclica 
    - Al detectar a un jugador ira en chase
    - Al dejar de perseguir al jugador volvera a patrullar
    - Intentara llegar de nuevo a un punto valido de patrulla
    - Calculara la distancia mas cercana entre la parca y los puntos de patrulla y moverse al mas cercano
    - Hara un raycast para verificar que no hay obstaculos en una ruta directa
    - De encontrarse un obstaculo evaluara si debera moverse a una direccion alternativa para llegar al punto (Arriba, derecha, abajo o arriba)
    - La direccion alternativa se evaluara de la siguiente forma (Ejemplo):
        - Si el punto esta mas arriba de donde esta la parca no eligira abajo
        - Se trazara un raycast a la derecha e izquerda para evaluar cual tiene la pared mas lejana
        - Se seleccionara la dereccion con la pared/obstaculo mas lejano
        - La direccion se mantendra mientas se calculan nuevos raycast para evaluar si se puede volver a la ruta directa o si se debe seguir en la ruta alternativa
        - Si durante el trayecto se evalua que se puede llegar a otro punto de patrulla mas cercano se evaluara cambiar de objetivo a ese punto
        - Una vez la Parca regresa a un punto de patrulla valido continuara de manera ciclica sus puntos de patrulla hasta otro encuentro con el jugador    
    */

    if (enemy.state === "patrol") {

        // Patrulla entre los puntos definidos

        // Asegurarse que alcance el primer punto de patrulla antes de continuar con el ciclo normal de patrulla
        if (!alreadyReachedFirstPatrolPoint) {
            const angleToFirstPoint = Phaser.Math.Angle.Between(enemy.x, enemy.y, firstPatrolPoint.x, firstPatrolPoint.y);
            targetEnemyRotation = angleToFirstPoint; // Actualizar rotación objetivo
            enemy.body.setVelocity(Math.cos(angleToFirstPoint) * enemySpeed, Math.sin(angleToFirstPoint) * enemySpeed);
            if (Phaser.Math.Distance.Between(enemy.x, enemy.y, firstPatrolPoint.x, firstPatrolPoint.y) < 1) {
                alreadyReachedFirstPatrolPoint = true;
            }
        }

        //Continuar de manera ciclica entre los puntos de patrulla
        if (alreadyReachedFirstPatrolPoint) {
            const targetPoint = patrolPoints[currentPatrolIndex];
            const angleToTarget = Phaser.Math.Angle.Between(enemy.x, enemy.y, targetPoint.x, targetPoint.y);
            targetEnemyRotation = angleToTarget; // Actualizar rotación objetivo
            enemy.body.setVelocity(Math.cos(angleToTarget) * enemySpeed, Math.sin(angleToTarget) * enemySpeed);
            if (Phaser.Math.Distance.Between(enemy.x, enemy.y, targetPoint.x, targetPoint.y) < 1) {
                currentPatrolIndex = (currentPatrolIndex + 1) % patrolPoints.length;
            }
        }

        // Si llego al final del indice de patrulla predeterminada volver al inicio del ciclo de patrulla
        if (currentPatrolIndex >= patrolPoints.length) {
            currentPatrolIndex = 0;
        }
        
    }

    // Estado de recuperacion despues de una Chase
    if (enemy.state === "recovery") {
        // Encontrar el punto de patrulla más cercano dinámicamente
        let closestPoint = patrolPoints[0];
        let closestDistance = Infinity;
        let closestIndex = 0;
        
        patrolPoints.forEach((point, index) => {
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, point.x, point.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = point;
                closestIndex = index;
            }
        });

        // Si llegó cerca del punto objetivo, cambiar a patrol
        if (closestDistance < 15) {
            console.log(`Recovery completado - Llegó al punto ${closestIndex}`);
            currentPatrolIndex = closestIndex;
            alreadyReachedFirstPatrolPoint = true;
            currentPath = [];
            pathCache.clear();
            lastTargetPoint = null;
            searchOscillation = 0; // Resetear oscilación
            enemy.state = "patrol";
            return;
        }

        const start = worldToGrid(enemy.x, enemy.y);
        const end = worldToGrid(closestPoint.x, closestPoint.y);
        
        // Generar cache key para el path
        const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
        
        // Recalcular path si cambió el objetivo o no hay path válido
        const targetChanged = !lastTargetPoint || 
            (lastTargetPoint.x !== closestPoint.x || lastTargetPoint.y !== closestPoint.y);
            
        if (pathTimer <= 0 || currentPath.length === 0 || targetChanged) {
            let path = null;
            
            // Intentar usar cache si el objetivo no cambió
            if (!targetChanged && pathCache.has(cacheKey)) {
                path = pathCache.get(cacheKey);
            } else {
                path = findPath(start, end);
                if (path) {
                    // Aplicar path smoothing
                    path = smoothPath(path);
                    pathCache.set(cacheKey, path);
                }
            }

            if (path) {
                currentPath = path;
                pathIndex = 0;
                lastTargetPoint = { ...closestPoint };
            }

            pathTimer = 20; // Recalcular menos frecuentemente
        } else {
            pathTimer--;
        }

        // Seguir el path calculado
        if (currentPath.length > 0 && pathIndex < currentPath.length) {
            const node = currentPath[pathIndex];
            const world = gridToWorld(node.x, node.y);

            const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, world.x, world.y);

            if (dist < 8) {
                pathIndex++;
            } else {
                // Movimiento suavizado hacia el objetivo
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, world.x, world.y);
                const smoothFactor = Math.min(dist / 20, 1); // Suavizar movimiento cerca del objetivo
                
                // Actualizar la rotación objetivo para el campo de visión
                // Mirar un poco más adelante en el path para una rotación más suave
                if (pathIndex + 1 < currentPath.length) {
                    const nextNode = currentPath[pathIndex + 1];
                    const nextWorld = gridToWorld(nextNode.x, nextNode.y);
                    targetEnemyRotation = Phaser.Math.Angle.Between(enemy.x, enemy.y, nextWorld.x, nextWorld.y);
                } else {
                    targetEnemyRotation = angle;
                }
                
                enemy.body.setVelocity(
                    Math.cos(angle) * enemySpeed * smoothFactor,
                    Math.sin(angle) * enemySpeed * smoothFactor
                );
            }
        } else {
            // Si no hay path válido, usar navegación simple
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, closestPoint.x, closestPoint.y);
            targetEnemyRotation = angle; // Actualizar rotación objetivo
            enemy.body.setVelocity(
                Math.cos(angle) * enemySpeed * 0.5,
                Math.sin(angle) * enemySpeed * 0.5
            );
        }
    }



    // Muerte (solo si no está escondido)
    if (isAlive && !isHidden && Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), enemy.getBounds())) {
        isAlive = false;

        // Efecto visual de muerte
        player.setFillStyle(0x666666);
        player.setAlpha(0.5);
        gun.setVisible(false);

        console.log("Has sido atrapado por el enemigo. Game Over.");
    }

}

function buildNavGrid(walls, cabinets) {
    const cols = Math.ceil(800 / GRID_SIZE);
    const rows = Math.ceil(600 / GRID_SIZE);

    navGrid = [];
    
    // Crear buffer más pequeño para detectar obstáculos (más permisivo)
    const buffer = GRID_SIZE * 0.3;

    for (let y = 0; y < rows; y++) {
        let row = [];
        for (let x = 0; x < cols; x++) {

            const worldX = x * GRID_SIZE + GRID_SIZE / 2;
            const worldY = y * GRID_SIZE + GRID_SIZE / 2;

            // Usar un rectángulo más pequeño para verificación (más permisivo)
            const rect = new Phaser.Geom.Rectangle(
                worldX - buffer,
                worldY - buffer,
                buffer * 2,
                buffer * 2
            );

            let blocked = false;

            // Verificar colisiones con un margen más inteligente
            walls.getChildren().forEach(w => {
                const wallBounds = w.getBounds();
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, wallBounds)) {
                    blocked = true;
                }
            });

            cabinets.getChildren().forEach(c => {
                const cabinetBounds = c.getBounds();
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, cabinetBounds)) {
                    blocked = true;
                }
            });

            row.push(blocked ? 1 : 0);
        }
        navGrid.push(row);
    }
    
    console.log(`Navegación: Grid ${cols}x${rows} generada`);
}

function worldToGrid(x, y) {
    return {
        x: Math.floor(x / GRID_SIZE),
        y: Math.floor(y / GRID_SIZE)
    };
}

function gridToWorld(x, y) {
    return {
        x: x * GRID_SIZE + GRID_SIZE / 2,
        y: y * GRID_SIZE + GRID_SIZE / 2
    };
}

function findPath(start, end) {
    // Verificar si los puntos están dentro de la grid
    if (!navGrid[start.y] || !navGrid[end.y] || 
        navGrid[start.y][start.x] === 1 || navGrid[end.y][end.x] === 1) {
        return null;
    }

    const open = [];
    const closed = new Set();
    const openSet = new Set(); // Para búsqueda O(1)

    const startNode = {
        x: start.x,
        y: start.y,
        g: 0,
        h: euclideanDistance(start, end),
        f: 0,
        parent: null
    };
    startNode.f = startNode.g + startNode.h;
    
    open.push(startNode);
    openSet.add(`${start.x},${start.y}`);

    while (open.length > 0) {
        // Encontrar nodo con menor f usando heap (más eficiente)
        let current = open[0];
        let currentIndex = 0;
        
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < current.f) {
                current = open[i];
                currentIndex = i;
            }
        }
        
        // Remover el nodo actual del open set
        open.splice(currentIndex, 1);
        openSet.delete(`${current.x},${current.y}`);

        // Objetivo alcanzado
        if (current.x === end.x && current.y === end.y) {
            let path = [];
            let node = current;
            while (node) {
                path.push({x: node.x, y: node.y});
                node = node.parent;
            }
            return path.reverse();
        }

        closed.add(`${current.x},${current.y}`);

        // Incluir movimiento diagonal para paths más naturales
        const neighbors = [
            {x:1,y:0,cost:1},   {x:-1,y:0,cost:1},  {x:0,y:1,cost:1},   {x:0,y:-1,cost:1},
            {x:1,y:1,cost:1.4}, {x:-1,y:1,cost:1.4}, {x:1,y:-1,cost:1.4}, {x:-1,y:-1,cost:1.4}
        ];

        for (let neighbor of neighbors) {
            const nx = current.x + neighbor.x;
            const ny = current.y + neighbor.y;

            // Verificar límites y obstáculos
            if (ny < 0 || ny >= navGrid.length || nx < 0 || nx >= navGrid[0].length) continue;
            if (navGrid[ny][nx] === 1) continue;
            if (closed.has(`${nx},${ny}`)) continue;

            // Para movimiento diagonal, verificar que las casillas adyacentes estén libres
            if (neighbor.cost > 1) {
                if (navGrid[current.y][nx] === 1 || navGrid[ny][current.x] === 1) continue;
            }

            const g = current.g + neighbor.cost;
            const h = euclideanDistance({x: nx, y: ny}, end);
            const f = g + h;

            const nodeKey = `${nx},${ny}`;
            
            // Si ya está en open, verificar si este path es mejor
            if (openSet.has(nodeKey)) {
                const existing = open.find(n => n.x === nx && n.y === ny);
                if (g < existing.g) {
                    existing.g = g;
                    existing.f = f;
                    existing.parent = current;
                }
            } else {
                open.push({
                    x: nx,
                    y: ny,
                    g: g,
                    h: h,
                    f: f,
                    parent: current
                });
                openSet.add(nodeKey);
            }
        }
    }

    return null;
}

// Distancia euclidiana para mejor heurística
function euclideanDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Función para suavizar el path eliminando nodos innecesarios
function smoothPath(path) {
    if (path.length <= 2) return path;
    
    const smoothed = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
        const prev = smoothed[smoothed.length - 1];
        const current = path[i];
        const next = path[i + 1];
        
        // Verificar si podemos ir directo desde prev a next
        if (!hasDirectPath(prev, next)) {
            smoothed.push(current);
        }
    }
    
    smoothed.push(path[path.length - 1]);
    return smoothed;
}

// Verificar si hay path directo entre dos puntos (sin obstáculos)
function hasDirectPath(start, end) {
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
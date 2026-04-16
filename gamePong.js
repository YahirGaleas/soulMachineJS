const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

const game = new Phaser.Game(config);

let player;
let cpu;
let ball;
let cursors;

function preload() {
    // Usamos gráficos simples (no imágenes)
}

function create() {
    // Jugador
    player = this.add.rectangle(50, 300, 20, 100, 0xffffff);
    this.physics.add.existing(player);
    player.body.setImmovable(true);
    player.body.setCollideWorldBounds(true);

    // CPU
    cpu = this.add.rectangle(750, 300, 20, 100, 0xffffff);
    this.physics.add.existing(cpu);
    cpu.body.setImmovable(true);
    cpu.body.setCollideWorldBounds(true);

    // Pelota
    ball = this.add.circle(400, 300, 10, 0xffffff);
    this.physics.add.existing(ball);
    ball.body.setCollideWorldBounds(true);
    ball.body.setBounce(1);
    ball.body.setVelocity(300, 200);

    // Controles
    cursors = this.input.keyboard.createCursorKeys();

    // Colisiones
    this.physics.add.collider(ball, player);
    this.physics.add.collider(ball, cpu);
}

function update() {

    //draw frames per second
    this.add.text(10, 10, `FPS: ${Math.floor(this.game.loop.actualFps)}`, { font: '16px Arial', fill: '#ffffff' });


    // Movimiento jugador
    if (cursors.up.isDown) {
        player.y -= 5;
    } else if (cursors.down.isDown) {
        player.y += 5;
    }

    // IA simple (seguir pelota)
    cpu.y = ball.y;

    // Reset si sale
    if (ball.x < 0 || ball.x > 800) {
        ball.setPosition(400, 300);
        ball.body.setVelocity(300, 200);
    }
}
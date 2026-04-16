const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        create,
        update
    }
};

const game = new Phaser.Game(config);

let player;
let platforms;
let cursors;

function create() {

    // Grupo de plataformas
    platforms = this.physics.add.staticGroup();

    // Suelo
    platforms.create(400, 590, null)
        .setDisplaySize(800, 20)
        .refreshBody();

    // Plataformas flotantes
    platforms.create(300, 450, null)
        .setDisplaySize(200, 20)
        .refreshBody();

    platforms.create(600, 300, null)
        .setDisplaySize(200, 20)
        .refreshBody();

    // Jugador
    player = this.add.rectangle(100, 450, 40, 60, 0x00ff00);
    this.physics.add.existing(player);

    player.body.setCollideWorldBounds(true);
    player.body.setBounce(0.1);

    // Colisión jugador-plataformas
    this.physics.add.collider(player, platforms);

    // Controles
    cursors = this.input.keyboard.createCursorKeys();
}

function update() {

    // Movimiento horizontal
    if (cursors.left.isDown) {
        player.body.setVelocityX(-200);
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(200);
    } else {
        player.body.setVelocityX(0);
    }

    // Salto (solo si está tocando el suelo)
    if (cursors.up.isDown && player.body.touching.down) {
        player.body.setVelocityY(-400);
    }
}
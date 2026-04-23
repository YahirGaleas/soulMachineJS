import DebugLevel from './scenes/DebugLevel.js';
import MainMenu   from './scenes/StartMenu.js';

// Aquí irán otras escenas cuando las crees, ej:
// import MainMenu   from './scenes/MainMenu.js';
// import Level2     from './scenes/Level2.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    // Añadir más escenas al array cuando las tengas:
    scene: [MainMenu, DebugLevel]
};

new Phaser.Game(config);
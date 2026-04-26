import DebugLevel from './scenes/DebugLevel.js';
import MainMenu   from './scenes/StartMenu.js';
import ComicScene from './scenes/ComicScene.js';

// Sistema de carga de niveles y progresión de historia
class LevelManager {
    constructor() {
        this.levels = new Map();
        this.loadLevels();
    }

    async loadLevels() {
        const levelFiles = ['level(1).json', 'level(2).json', 'level(6).json'];
        
        for (const filename of levelFiles) {
            try {
                const response = await fetch(`./levels/${filename}`);
                const levelData = await response.json();
                // Extraer el número del nivel del nombre del archivo
                const levelNumber = filename.match(/\((\d+)\)/)?.[1] || '1';
                this.levels.set(levelNumber, {
                    ...levelData,
                    name: `Nivel ${levelNumber}`,
                    filename: filename
                });
            } catch (error) {
                console.warn(`Error cargando nivel ${filename}:`, error);
            }
        }
    }

    getLevel(levelNumber) {
        return this.levels.get(String(levelNumber));
    }

    getAllLevels() {
        return Array.from(this.levels.entries()).map(([number, data]) => ({
            number,
            name: data.name,
            data
        }));
    }

    getLevelList() {
        return Array.from(this.levels.keys()).sort((a, b) => Number(a) - Number(b));
    }
}

// Instancia global del manager de niveles
window.GameLevelManager = new LevelManager();


const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scale: {
        //mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: [
        MainMenu,      // Menú principal - siempre primero
        ComicScene,    // Escena de comics/visual novel
        DebugLevel     // Escena de juego - carga niveles dinámicamente
        // Aquí se pueden agregar escenas futuras como:
        // LoreScene, etc.
    ]
};

new Phaser.Game(config);
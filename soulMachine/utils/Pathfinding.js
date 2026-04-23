const GRID_SIZE = 10;

export function buildNavGrid(walls, cabinets, mapWidth = 800, mapHeight = 600) {
    const cols = Math.ceil(mapWidth / GRID_SIZE);
    const rows = Math.ceil(mapHeight / GRID_SIZE);
    const buffer = GRID_SIZE * 0.3;
    const grid = [];

    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            const worldX = x * GRID_SIZE + GRID_SIZE / 2;
            const worldY = y * GRID_SIZE + GRID_SIZE / 2;

            const rect = new Phaser.Geom.Rectangle(
                worldX - buffer, worldY - buffer,
                buffer * 2, buffer * 2
            );

            let blocked = false;

            walls.getChildren().forEach(w => {
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, w.getBounds())) blocked = true;
            });

            cabinets.getChildren().forEach(c => {
                if (Phaser.Geom.Intersects.RectangleToRectangle(rect, c.getBounds())) blocked = true;
            });

            row.push(blocked ? 1 : 0);
        }
        grid.push(row);
    }

    console.log(`NavGrid generada: ${cols}x${rows}`);
    return grid;
}

export function worldToGrid(x, y) {
    return { x: Math.floor(x / GRID_SIZE), y: Math.floor(y / GRID_SIZE) };
}

export function gridToWorld(x, y) {
    return { x: x * GRID_SIZE + GRID_SIZE / 2, y: y * GRID_SIZE + GRID_SIZE / 2 };
}

function euclideanDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function findPath(start, end, navGrid) {
    if (
        !navGrid[start.y] || !navGrid[end.y] ||
        navGrid[start.y][start.x] === 1 || navGrid[end.y][end.x] === 1
    ) return null;

    const open = [];
    const closed = new Set();
    const openSet = new Set();

    const startNode = {
        x: start.x, y: start.y,
        g: 0,
        h: euclideanDistance(start, end),
        f: 0,
        parent: null
    };
    startNode.f = startNode.g + startNode.h;

    open.push(startNode);
    openSet.add(`${start.x},${start.y}`);

    while (open.length > 0) {
        let currentIndex = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[currentIndex].f) currentIndex = i;
        }

        const current = open[currentIndex];
        open.splice(currentIndex, 1);
        openSet.delete(`${current.x},${current.y}`);

        if (current.x === end.x && current.y === end.y) {
            const path = [];
            let node = current;
            while (node) { path.push({ x: node.x, y: node.y }); node = node.parent; }
            return path.reverse();
        }

        closed.add(`${current.x},${current.y}`);

        const neighbors = [
            { x: 1, y: 0, cost: 1 }, { x: -1, y: 0, cost: 1 },
            { x: 0, y: 1, cost: 1 }, { x: 0, y: -1, cost: 1 },
            { x: 1, y: 1, cost: 1.4 }, { x: -1, y: 1, cost: 1.4 },
            { x: 1, y: -1, cost: 1.4 }, { x: -1, y: -1, cost: 1.4 }
        ];

        for (const neighbor of neighbors) {
            const nx = current.x + neighbor.x;
            const ny = current.y + neighbor.y;

            if (ny < 0 || ny >= navGrid.length || nx < 0 || nx >= navGrid[0].length) continue;
            if (navGrid[ny][nx] === 1) continue;
            if (closed.has(`${nx},${ny}`)) continue;

            if (neighbor.cost > 1) {
                if (navGrid[current.y][nx] === 1 || navGrid[ny][current.x] === 1) continue;
            }

            const g = current.g + neighbor.cost;
            const h = euclideanDistance({ x: nx, y: ny }, end);
            const f = g + h;
            const nodeKey = `${nx},${ny}`;

            if (openSet.has(nodeKey)) {
                const existing = open.find(n => n.x === nx && n.y === ny);
                if (g < existing.g) { existing.g = g; existing.f = f; existing.parent = current; }
            } else {
                open.push({ x: nx, y: ny, g, h, f, parent: current });
                openSet.add(nodeKey);
            }
        }
    }

    return null;
}

export function smoothPath(path, navGrid) {
    if (path.length <= 2) return path;

    const smoothed = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
        const prev = smoothed[smoothed.length - 1];
        const next = path[i + 1];
        if (!hasDirectPath(prev, next, navGrid)) smoothed.push(path[i]);
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
}

function hasDirectPath(start, end, navGrid) {
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
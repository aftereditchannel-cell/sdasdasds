/**
 * Procedural City Generator
 * Creates a grid-based city with roads, sidewalks, and buildings
 */
import { CONFIG } from './config.js';

export class City {
  constructor() {
    this.blocks = [];
    this.roads = [];
    this.buildings = [];
    this.sidewalks = [];
    this.intersections = [];
    this.spawnPoints = [];
    this.initialized = false;
  }

  init(seed = 'city-drive') {
    // Deterministic pseudo-random
    this.seed = this.hashString(seed);
    this.random = this.mulberry32(this.seed);

    const { citySize, blockSize, roadWidth, sidewalkWidth, buildingDensity, minBuildingHeight, maxBuildingHeight } = CONFIG.world;
    const halfSize = citySize / 2;
    const gridCount = Math.floor(citySize / blockSize);

    // Generate grid-based road network
    this.generateRoads(gridCount, blockSize, roadWidth, sidewalkWidth);
    this.generateIntersections(gridCount, blockSize, roadWidth);
    this.generateBuildings(gridCount, blockSize, roadWidth, sidewalkWidth, buildingDensity, minBuildingHeight, maxBuildingHeight);
    this.generateSpawnPoints(gridCount, blockSize, roadWidth);

    this.initialized = true;
    return this;
  }

  // Deterministic hash
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Random in range
  rand(min, max) {
    return min + this.random() * (max - min);
  }

  randInt(min, max) {
    return Math.floor(this.rand(min, max + 1));
  }

  generateRoads(gridCount, blockSize, roadWidth, sidewalkWidth) {
    const halfSize = (gridCount * blockSize) / 2;
    const totalRoadWidth = roadWidth + sidewalkWidth * 2;

    // Vertical roads
    for (let i = 0; i <= gridCount; i++) {
      const x = -halfSize + i * blockSize - totalRoadWidth / 2;
      this.roads.push({
        x, y: -halfSize,
        width: totalRoadWidth,
        height: gridCount * blockSize,
        type: 'vertical',
        index: i
      });
      // Road center line (for driving)
      this.roads.push({
        x: x + sidewalkWidth,
        y: -halfSize,
        width: roadWidth,
        height: gridCount * blockSize,
        type: 'vertical-driving',
        index: i
      });
    }

    // Horizontal roads
    for (let i = 0; i <= gridCount; i++) {
      const y = -halfSize + i * blockSize - totalRoadWidth / 2;
      this.roads.push({
        x: -halfSize, y,
        width: gridCount * blockSize,
        height: totalRoadWidth,
        type: 'horizontal',
        index: i
      });
      this.roads.push({
        x: -halfSize,
        y: y + sidewalkWidth,
        width: gridCount * blockSize,
        height: roadWidth,
        type: 'horizontal-driving',
        index: i
      });
    }
  }

  generateIntersections(gridCount, blockSize, roadWidth) {
    const halfSize = (gridCount * blockSize) / 2;
    const totalRoadWidth = roadWidth + CONFIG.world.sidewalkWidth * 2;

    for (let gx = 0; gx <= gridCount; gx++) {
      for (let gy = 0; gy <= gridCount; gy++) {
        const x = -halfSize + gx * blockSize - totalRoadWidth / 2;
        const y = -halfSize + gy * blockSize - totalRoadWidth / 2;
        this.intersections.push({
          x, y,
          width: totalRoadWidth,
          height: totalRoadWidth,
          gx, gy
        });
      }
    }
  }

  generateBuildings(gridCount, blockSize, roadWidth, sidewalkWidth, density, minH, maxH) {
    const halfSize = (gridCount * blockSize) / 2;
    const totalRoadWidth = roadWidth + sidewalkWidth * 2;
    const lotPadding = 8;
    const minLotSize = 30;

    for (let gx = 0; gx < gridCount; gx++) {
      for (let gy = 0; gy < gridCount; gy++) {
        if (this.random() > density) continue;

        const blockX = -halfSize + gx * blockSize + totalRoadWidth / 2;
        const blockY = -halfSize + gy * blockSize + totalRoadWidth / 2;
        const blockInnerSize = blockSize - totalRoadWidth;

        // Subdivide block into lots
        const lotsX = this.randInt(1, 3);
        const lotsY = this.randInt(1, 3);
        const lotW = blockInnerSize / lotsX;
        const lotH = blockInnerSize / lotsY;

        for (let lx = 0; lx < lotsX; lx++) {
          for (let ly = 0; ly < lotsY; ly++) {
            if (this.random() > 0.8) continue; // Some empty lots

            const bx = blockX + lx * lotW + lotPadding;
            const by = blockY + ly * lotH + lotPadding;
            const bw = lotW - lotPadding * 2;
            const bh = lotH - lotPadding * 2;

            if (bw < minLotSize || bh < minLotSize) continue;

            // Building footprint (slightly smaller than lot)
            const bW = bw * this.rand(0.6, 0.95);
            const bH = bh * this.rand(0.6, 0.95);
            const bX = bx + (bw - bW) / 2;
            const bY = by + (bh - bH) / 2;

            const height = this.rand(minH, maxH);
            const colorIdx = this.randInt(0, CONFIG.canvas.buildingColors.length - 1);
            const windows = this.generateWindows(bW, bH);

            this.buildings.push({
              x: bX, y: bY,
              width: bW, height: bH,
              worldHeight: height,
              color: CONFIG.canvas.buildingColors[colorIdx],
              windows,
              // For 3D effect
              roofColor: this.lightenColor(CONFIG.canvas.buildingColors[colorIdx], 0.15),
              sideColor: this.darkenColor(CONFIG.canvas.buildingColors[colorIdx], 0.2)
            });
          }
        }
      }
    }
  }

  generateWindows(w, h) {
    const windows = [];
    const winSize = 4;
    const winGap = 6;
    const cols = Math.floor(w / (winSize + winGap));
    const rows = Math.floor(h / (winSize + winGap));

    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (this.random() > 0.7) continue; // Some dark windows
        windows.push({
          x: cx * (winSize + winGap) + winGap / 2,
          y: cy * (winSize + winGap) + winGap / 2,
          width: winSize,
          height: winSize,
          lit: this.random() > 0.3
        });
      }
    }
    return windows;
  }

  generateSpawnPoints(gridCount, blockSize, roadWidth) {
    const halfSize = (gridCount * blockSize) / 2;
    const totalRoadWidth = roadWidth + CONFIG.world.sidewalkWidth * 2;

    // Spawn on road centers near intersections
    for (let gx = 0; gx <= gridCount; gx++) {
      for (let gy = 0; gy <= gridCount; gy++) {
        const cx = -halfSize + gx * blockSize;
        const cy = -halfSize + gy * blockSize;

        // 4 spawn points per intersection (on each road)
        const offset = roadWidth * 1.5;
        this.spawnPoints.push({ x: cx - offset, y: cy, angle: 0 });      // West
        this.spawnPoints.push({ x: cx + offset, y: cy, angle: Math.PI }); // East
        this.spawnPoints.push({ x: cx, y: cy - offset, angle: -Math.PI/2 }); // North
        this.spawnPoints.push({ x: cx, y: cy + offset, angle: Math.PI/2 });  // South
      }
    }
  }

  getRandomSpawnPoint() {
    if (this.spawnPoints.length === 0) return { x: 0, y: 0, angle: 0 };
    return this.spawnPoints[this.randInt(0, this.spawnPoints.length - 1)];
  }

  lightenColor(hex, factor) {
    const rgb = this.hexToRgb(hex);
    return `rgb(${Math.min(255, rgb.r + 255 * factor)}, ${Math.min(255, rgb.g + 255 * factor)}, ${Math.min(255, rgb.b + 255 * factor)})`;
  }

  darkenColor(hex, factor) {
    const rgb = this.hexToRgb(hex);
    return `rgb(${Math.max(0, rgb.r - 255 * factor)}, ${Math.max(0, rgb.g - 255 * factor)}, ${Math.max(0, rgb.b - 255 * factor)})`;
  }

  hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 100, g: 100, b: 100 };
  }

  // Check if point is on drivable road
  isOnRoad(x, y) {
    for (const road of this.roads) {
      if (road.type.endsWith('-driving')) {
        if (x >= road.x && x <= road.x + road.width &&
            y >= road.y && y <= road.y + road.height) {
          return true;
        }
      }
    }
    return false;
  }

  // Get road bounds for camera clamping
  getWorldBounds() {
    const { citySize } = CONFIG.world;
    const half = citySize / 2;
    return { minX: -half, maxX: half, minY: -half, maxY: half };
  }

  // Render city to canvas (2D top-down with pseudo-3D buildings)
  render(ctx, camera) {
    const { x, y, zoom } = camera;
    const halfW = ctx.canvas.width / 2 / zoom;
    const halfH = ctx.canvas.height / 2 / zoom;

    // Culling bounds
    const cullX1 = x - halfW - CONFIG.performance.cullingMargin;
    const cullY1 = y - halfH - CONFIG.performance.cullingMargin;
    const cullX2 = x + halfW + CONFIG.performance.cullingMargin;
    const cullY2 = y + halfH + CONFIG.performance.cullingMargin;

    // Background
    ctx.fillStyle = CONFIG.canvas.backgroundColor;
    ctx.fillRect(-halfW * zoom, -halfH * zoom, ctx.canvas.width, ctx.canvas.height);

    // Draw roads (bottom layer)
    ctx.fillStyle = CONFIG.canvas.roadColor;
    for (const road of this.roads) {
      if (road.x + road.width < cullX1 || road.x > cullX2 ||
          road.y + road.height < cullY1 || road.y > cullY2) continue;

      ctx.fillRect(
        (road.x - x) * zoom,
        (road.y - y) * zoom,
        road.width * zoom,
        road.height * zoom
      );
    }

    // Road center lines
    ctx.strokeStyle = CONFIG.canvas.roadLineColor;
    ctx.lineWidth = Math.max(1, 2 * zoom);
    ctx.setLineDash([15 * zoom, 15 * zoom]);

    for (const road of this.roads) {
      if (road.type.endsWith('-driving')) {
        if (road.x + road.width < cullX1 || road.x > cullX2 ||
            road.y + road.height < cullY1 || road.y > cullY2) continue;

        ctx.beginPath();
        if (road.type === 'vertical-driving') {
          const cx = (road.x + road.width / 2 - x) * zoom;
          ctx.moveTo(cx, (road.y - y) * zoom);
          ctx.lineTo(cx, (road.y + road.height - y) * zoom);
        } else {
          const cy = (road.y + road.height / 2 - y) * zoom;
          ctx.moveTo((road.x - x) * zoom, cy);
          ctx.lineTo((road.x + road.width - x) * zoom, cy);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Draw buildings with pseudo-3D effect (sorted by Y for depth)
    const visibleBuildings = this.buildings.filter(b =>
      b.x + b.width > cullX1 && b.x < cullX2 &&
      b.y + b.height > cullY1 && b.y < cullY2
    ).sort((a, b) => a.y - b.y); // Painter's algorithm

    for (const building of visibleBuildings) {
      this.renderBuilding(ctx, building, camera, cullX1, cullY1, cullX2, cullY2);
    }

    // Draw intersections (subtle highlight)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (const inter of this.intersections) {
      if (inter.x + inter.width < cullX1 || inter.x > cullX2 ||
          inter.y + inter.height < cullY1 || inter.y > cullY2) continue;

      ctx.fillRect(
        (inter.x - x) * zoom,
        (inter.y - y) * zoom,
        inter.width * zoom,
        inter.height * zoom
      );
    }
  }

  renderBuilding(ctx, building, camera, cullX1, cullY1, cullX2, cullY2) {
    const { x: camX, y: camY, zoom } = camera;
    const bx = (building.x - camX) * zoom;
    const by = (building.y - camY) * zoom;
    const bw = building.width * zoom;
    const bh = building.height * zoom;
    const h3d = building.worldHeight * zoom * 0.3; // 3D extrusion

    // Building sides (3D effect - draw back faces first)
    const sideOffset = Math.min(h3d, 60 * zoom);

    // Back side (top)
    ctx.fillStyle = building.sideColor;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - sideOffset, by - sideOffset);
    ctx.lineTo(bx - sideOffset + bw, by - sideOffset);
    ctx.lineTo(bx + bw, by);
    ctx.closePath();
    ctx.fill();

    // Right side
    ctx.fillStyle = building.color;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx + bw - sideOffset, by - sideOffset);
    ctx.lineTo(bx + bw - sideOffset, by - sideOffset + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.closePath();
    ctx.fill();

    // Building footprint (top face)
    ctx.fillStyle = building.roofColor;
    ctx.fillRect(bx - sideOffset, by - sideOffset, bw, bh);

    // Windows on top face
    if (zoom > 0.3) {
      for (const win of building.windows) {
        if (!win.lit) continue;
        ctx.fillStyle = CONFIG.canvas.buildingWindowColor;
        ctx.fillRect(
          bx - sideOffset + win.x * zoom,
          by - sideOffset + win.y * zoom,
          win.width * zoom,
          win.height * zoom
        );
      }
    }

    // Windows on side faces (simplified)
    if (zoom > 0.5) {
      const rows = Math.floor(building.worldHeight / 20);
      const cols = Math.floor(building.width / 15);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.hashString(`${building.x},${building.y},${r},${c}`) % 3 !== 0) continue;
          // Right side windows
          ctx.fillStyle = CONFIG.canvas.buildingWindowColor;
          ctx.fillRect(
            bx + bw - sideOffset + c * 15 * zoom,
            by - sideOffset + bh + r * 20 * zoom,
            8 * zoom, 10 * zoom
          );
        }
      }
    }
  }
}
export type Rect = { x: number; y: number; w: number; h: number };

export const TILE = 40;
export const GROUND_Y = 480;
export const WORLD_H = 540;

export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "brick" | "question";
  used: boolean;
  bounce: number;
  dead: boolean;
  contains: "coin" | "mushroom";
};

export type EnemyKind = "patrol" | "leaper" | "thrower";
export type Enemy = {
  kind: EnemyKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  timer: number;
  dead: boolean;
  squash: number;
};

export type Coin = { x: number; y: number; taken: boolean; phase: number };

export type Theme = {
  name: string;
  sky: [string, string, string];
  hillFar: string;
  hillNear: string;
  groundTop: string;
  groundBody: string;
  platformBody: string;
  decor: "clouds" | "stars" | "snow" | "embers" | "bubbles";
  decorColor: string;
};

export const THEMES: Theme[] = [
  {
    name: "GREEN HILLS",
    sky: ["#3aa7ff", "#8fd8ff", "#d8f2ff"],
    hillFar: "#5bbf7a", hillNear: "#3f9e60",
    groundTop: "#57c94f", groundBody: "#7c4a21", platformBody: "#8a5a2b",
    decor: "clouds", decorColor: "rgba(255,255,255,0.92)",
  },
  {
    name: "DESERT DUNES",
    sky: ["#ffb75e", "#ffd89b", "#fff2cf"],
    hillFar: "#e6b25f", hillNear: "#c9913f",
    groundTop: "#e8c477", groundBody: "#9c6b2f", platformBody: "#b98442",
    decor: "clouds", decorColor: "rgba(255,255,255,0.6)",
  },
  {
    name: "FROZEN PEAKS",
    sky: ["#5f8fd6", "#a9cff5", "#e8f6ff"],
    hillFar: "#cfe6f7", hillNear: "#a8cbe4",
    groundTop: "#e9f6ff", groundBody: "#5d7d99", platformBody: "#7fa2bd",
    decor: "snow", decorColor: "rgba(255,255,255,0.95)",
  },
  {
    name: "JUNGLE RUINS",
    sky: ["#1f7a5a", "#4fbb8a", "#bff0d8"],
    hillFar: "#2f9a6d", hillNear: "#1e7250",
    groundTop: "#3fbf6a", groundBody: "#3d3320", platformBody: "#5a4a2c",
    decor: "bubbles", decorColor: "rgba(190,255,220,0.35)",
  },
  {
    name: "OCEAN DEPTHS",
    sky: ["#0b3b6f", "#1573b8", "#5fc6e8"],
    hillFar: "#1a6f9e", hillNear: "#125273",
    groundTop: "#3fd0d8", groundBody: "#1c4e63", platformBody: "#2b6c85",
    decor: "bubbles", decorColor: "rgba(255,255,255,0.35)",
  },
  {
    name: "LAVA CAVERNS",
    sky: ["#3a0d0d", "#7d1c14", "#d1471f"],
    hillFar: "#5c1a12", hillNear: "#3d100b",
    groundTop: "#ff7b34", groundBody: "#3a1a12", platformBody: "#5a2618",
    decor: "embers", decorColor: "rgba(255,150,60,0.9)",
  },
  {
    name: "SKY CITY",
    sky: ["#7b5bd6", "#b79cf0", "#ffd9f0"],
    hillFar: "#c7a9f5", hillNear: "#a184e0",
    groundTop: "#ffe4fb", groundBody: "#6b4bb5", platformBody: "#8b68d4",
    decor: "clouds", decorColor: "rgba(255,255,255,0.9)",
  },
  {
    name: "NEON CIRCUIT",
    sky: ["#14012b", "#3b0a63", "#7a1a9c"],
    hillFar: "#330f57", hillNear: "#210836",
    groundTop: "#25f4d8", groundBody: "#16063a", platformBody: "#2a0f5c",
    decor: "stars", decorColor: "rgba(120,255,240,0.9)",
  },
  {
    name: "HAUNTED KEEP",
    sky: ["#0a0d1f", "#232a4a", "#4a4f7a"],
    hillFar: "#2a2f52", hillNear: "#1a1e38",
    groundTop: "#6b6f9c", groundBody: "#20233d", platformBody: "#32365c",
    decor: "stars", decorColor: "rgba(220,220,255,0.8)",
  },
  {
    name: "STADIUM FINALE",
    sky: ["#0d2b6b", "#1e63c9", "#8fd0ff"],
    hillFar: "#2f6fd0", hillNear: "#1f4c99",
    groundTop: "#4bd45f", groundBody: "#2b6b31", platformBody: "#e8edf5",
    decor: "stars", decorColor: "rgba(255,255,255,0.9)",
  },
];

export const TOTAL_LEVELS = THEMES.length;

export type Level = {
  index: number;
  theme: Theme;
  platforms: Rect[];
  blocks: Block[];
  coins: Coin[];
  enemies: Enemy[];
  levelEnd: number;
  worldW: number;
};

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function brick(x: number, y: number): Block {
  return { x, y, w: TILE, h: TILE, kind: "brick", used: false, bounce: 0, dead: false, contains: "coin" };
}
function qblock(x: number, y: number, contains: "coin" | "mushroom" = "coin"): Block {
  return { x, y, w: TILE, h: TILE, kind: "question", used: false, bounce: 0, dead: false, contains };
}

/** levelIndex: 1..10 */
export function createLevel(levelIndex = 1): Level {
  const i = Math.max(1, Math.min(TOTAL_LEVELS, levelIndex));
  const theme = THEMES[i - 1]!;
  const rand = rng(i * 137);

  const levelEnd = 2800 + i * 260;
  const worldW = levelEnd + 300;

  // ---- gaps ----
  const gaps: [number, number][] = [];
  const gapCount = 3 + Math.floor(i / 2);
  const gapWidth = 96 + i * 6;
  for (let g = 0; g < gapCount; g++) {
    const start = 620 + g * ((levelEnd - 900) / gapCount) + rand() * 60;
    gaps.push([Math.round(start), Math.round(start + gapWidth)]);
  }

  const platforms: Rect[] = [];
  let cursor = -200;
  for (const [gs, ge] of gaps) {
    platforms.push({ x: cursor, y: GROUND_Y, w: gs - cursor, h: 200 });
    cursor = ge;
  }
  platforms.push({ x: cursor, y: GROUND_Y, w: worldW - cursor + 200, h: 200 });

  // ---- floating platforms ----
  const floatCount = 6 + Math.floor(i / 2);
  for (let f = 0; f < floatCount; f++) {
    const x = 420 + f * ((levelEnd - 600) / floatCount) + rand() * 80;
    const y = 300 + Math.round(rand() * 100);
    const w = 140 + Math.round(rand() * 110);
    platforms.push({ x: Math.round(x), y, w, h: 24 });
  }

  // ---- blocks ----
  const blocks: Block[] = [];
  const clusters = 4 + Math.floor(i / 3);
  for (let c = 0; c < clusters; c++) {
    const bx = 380 + c * ((levelEnd - 600) / clusters) + rand() * 60;
    const by = 240 + Math.round(rand() * 90);
    const n = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const x = Math.round(bx + k * TILE);
      if (k === 0) blocks.push(qblock(x, by, c % 3 === 0 ? "mushroom" : "coin"));
      else blocks.push(brick(x, by));
    }
  }

  // ---- coins ----
  const coins: Coin[] = [];
  const arcs = 8 + i;
  for (let a = 0; a < arcs; a++) {
    const cx = 280 + a * ((levelEnd - 400) / arcs) + rand() * 40;
    const cy = 200 + Math.round(rand() * 220);
    for (let k = 0; k < 3; k++) {
      coins.push({ x: Math.round(cx + k * 40), y: cy - (k === 1 ? 30 : 0), taken: false, phase: rand() * Math.PI * 2 });
    }
  }

  // ---- enemies ----
  const enemies: Enemy[] = [];
  const mk = (kind: EnemyKind, x: number, y: number, w = 34, h = 34): Enemy => ({
    kind, x, y, w, h, vx: kind === "patrol" ? -(0.8 + i * 0.07) : 0, vy: 0, onGround: false,
    timer: rand() * 60, dead: false, squash: 0,
  });
  const enemyCount = 6 + i;
  for (let e = 0; e < enemyCount; e++) {
    const x = Math.round(500 + e * ((levelEnd - 700) / enemyCount) + rand() * 60);
    const roll = rand();
    if (roll < 0.55 || i < 2) enemies.push(mk("patrol", x, GROUND_Y - 34));
    else if (roll < 0.8) enemies.push(mk("leaper", x, GROUND_Y - 32, 32, 32));
    else enemies.push(mk("thrower", x, GROUND_Y - 40, 34, 40));
  }

  return { index: i, theme, platforms, blocks, coins, enemies, levelEnd, worldW };
}

export type Rect = { x: number; y: number; w: number; h: number };

export const TILE = 40;
export const GROUND_Y = 480;
export const LEVEL_END = 3000;
export const WORLD_W = 3300;
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

export type Level = {
  platforms: Rect[];
  blocks: Block[];
  coins: Coin[];
  enemies: Enemy[];
};

const gaps: [number, number][] = [
  [620, 730],
  [1180, 1290],
  [1900, 2010],
  [2450, 2530],
];

function groundSegments(): Rect[] {
  const segs: Rect[] = [];
  let cursor = -200;
  for (const [gs, ge] of gaps) {
    segs.push({ x: cursor, y: GROUND_Y, w: gs - cursor, h: 200 });
    cursor = ge;
  }
  segs.push({ x: cursor, y: GROUND_Y, w: WORLD_W - cursor + 200, h: 200 });
  return segs;
}

function brick(x: number, y: number): Block {
  return { x, y, w: TILE, h: TILE, kind: "brick", used: false, bounce: 0, dead: false, contains: "coin" };
}
function qblock(x: number, y: number, contains: "coin" | "mushroom" = "coin"): Block {
  return { x, y, w: TILE, h: TILE, kind: "question", used: false, bounce: 0, dead: false, contains };
}

export function createLevel(): Level {
  const platforms: Rect[] = [
    ...groundSegments(),
    { x: 840, y: 360, w: 200, h: 24 },
    { x: 1400, y: 320, w: 220, h: 24 },
    { x: 1700, y: 250, w: 160, h: 24 },
    { x: 2100, y: 340, w: 200, h: 24 },
    { x: 2350, y: 250, w: 150, h: 24 },
    { x: 2700, y: 330, w: 180, h: 24 },
    { x: 500, y: 260, w: 160, h: 24 },
  ];

  const blocks: Block[] = [
    qblock(400, 340, "coin"),
    brick(440, 340),
    qblock(480, 340, "mushroom"),
    brick(880, 240),
    qblock(920, 240, "coin"),
    brick(960, 240),
    qblock(1450, 200, "mushroom"),
    brick(1490, 200),
    brick(1530, 200),
    qblock(2140, 220, "coin"),
    brick(2180, 220),
    qblock(2740, 210, "coin"),
    brick(2780, 210),
  ];

  const coins: Coin[] = [];
  const coinSpots: [number, number][] = [
    [300, 400], [340, 400], [380, 400],
    [530, 210], [570, 210], [610, 210],
    [880, 310], [920, 310], [960, 310], [1000, 310],
    [1210, 300], [1240, 260], [1270, 300],
    [1430, 270], [1470, 270], [1510, 270],
    [1730, 200], [1780, 200], [1830, 200],
    [1930, 300], [1960, 260], [1990, 300],
    [2130, 290], [2170, 290], [2210, 290],
    [2380, 200], [2420, 200], [2460, 200],
    [2730, 280], [2780, 280], [2830, 280],
    [2900, 420], [2940, 420],
  ];
  for (const [x, y] of coinSpots) coins.push({ x, y, taken: false, phase: Math.random() * Math.PI * 2 });

  const enemies: Enemy[] = [];
  const mk = (kind: EnemyKind, x: number, y: number, w = 34, h = 34): Enemy => ({
    kind, x, y, w, h, vx: kind === "patrol" ? -0.9 : 0, vy: 0, onGround: false,
    timer: Math.random() * 60, dead: false, squash: 0,
  });
  enemies.push(mk("patrol", 520, GROUND_Y - 34));
  enemies.push(mk("patrol", 900, 360 - 34));
  enemies.push(mk("leaper", 1050, GROUND_Y - 34, 32, 32));
  enemies.push(mk("patrol", 1350, GROUND_Y - 34));
  enemies.push(mk("thrower", 1740, 250 - 40, 34, 40));
  enemies.push(mk("patrol", 1500, 320 - 34));
  enemies.push(mk("leaper", 1800, GROUND_Y - 32, 32, 32));
  enemies.push(mk("patrol", 2150, 340 - 34));
  enemies.push(mk("thrower", 2380, 250 - 40, 34, 40));
  enemies.push(mk("patrol", 2200, GROUND_Y - 34));
  enemies.push(mk("leaper", 2600, GROUND_Y - 32, 32, 32));
  enemies.push(mk("patrol", 2750, 330 - 34));

  return { platforms, blocks, coins, enemies };
}

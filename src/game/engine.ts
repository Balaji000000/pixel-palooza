import { sfx } from "./audio";
import {
  createLevel,
  GROUND_Y,
  TILE,
  TOTAL_LEVELS,
  WORLD_H,
  type Block,
  type Coin,
  type Enemy,
  type Level,
  type Rect,
  type Theme,
} from "./level";

export const VIEW_W = 960;
export const VIEW_H = 540;

const GRAVITY = 0.62;
const MOVE_ACC = 0.7;
const MAX_SPEED = 4.6;
const FRICTION = 0.78;
const JUMP_V = -13.6;
const COYOTE = 6; // frames (~0.1s)
const BUFFER = 8;

export type Phase = "start" | "playing" | "dead" | "gameover" | "win" | "levelclear";

export type HudState = {
  lives: number;
  health: number;
  coins: number;
  score: number;
  time: number;
  phase: Phase;
  big: boolean;
  level: number;
  levelName: string;
  totalLevels: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Mushroom = { x: number; y: number; vx: number; vy: number; w: number; h: number; rise: number };
type Projectile = { x: number; y: number; vx: number; vy: number; r: number };
type Popup = { x: number; y: number; life: number; text: string };

type Player = {
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  onGround: boolean; face: 1 | -1; big: boolean; invuln: number; anim: number; dead: boolean; deadTimer: number;
  jumps: number;
};

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Game {
  keys = new Set<string>();
  levelIndex = 1;
  level: Level = createLevel(1);
  player!: Player;
  particles: Particle[] = [];
  mushrooms: Mushroom[] = [];
  projectiles: Projectile[] = [];
  popups: Popup[] = [];
  camX = 0;
  shake = 0;
  lives = 3;
  health = 100;
  coins = 0;
  score = 0;
  time = 300;
  phase: Phase = "start";
  flagAnim = 0;
  private timeAcc = 0;
  onHud: (h: HudState) => void = () => {};

  constructor() {
    this.resetAll();
  }

  hud(): HudState {
    return {
      lives: this.lives, health: this.health, coins: this.coins, score: this.score,
      time: Math.max(0, Math.ceil(this.time)), phase: this.phase, big: this.player.big,
      level: this.level.index, levelName: this.level.theme.name, totalLevels: TOTAL_LEVELS,
    };
  }

  private emitHud() {
    this.onHud(this.hud());
  }

  resetAll() {
    this.levelIndex = 1;
    this.level = createLevel(1);
    this.lives = 3;
    this.health = 100;
    this.coins = 0;
    this.score = 0;
    this.time = 300;
    this.flagAnim = 0;
    this.spawnPlayer();
    this.particles = [];
    this.mushrooms = [];
    this.projectiles = [];
    this.popups = [];
    this.camX = 0;
  }

  spawnPlayer() {
    this.player = {
      x: 80, y: GROUND_Y - 44, w: 30, h: 44, vx: 0, vy: 0, onGround: false,
      face: 1, big: false, invuln: 60, anim: 0, dead: false, deadTimer: 0, jumps: 2,
    };
    this.health = 100;
    this.projectiles = [];
  }

  start() {
    this.resetAll();
    this.phase = "playing";
    this.emitHud();
  }

  /** advance to next level, keeping score / lives / coins */
  nextLevel() {
    if (this.levelIndex >= TOTAL_LEVELS) return;
    this.levelIndex += 1;
    this.loadLevel(this.levelIndex);
    this.phase = "playing";
    this.emitHud();
  }

  private loadLevel(idx: number) {
    this.level = createLevel(idx);
    this.time = 300;
    this.flagAnim = 0;
    this.particles = [];
    this.mushrooms = [];
    this.projectiles = [];
    this.popups = [];
    this.camX = 0;
    this.spawnPlayer();
  }

  private get theme(): Theme {
    return this.level.theme;
  }

  private coyote = 0;
  private buffer = 0;

  private solids(): Rect[] {
    const list: Rect[] = [...this.level.platforms];
    for (const b of this.level.blocks) if (!b.dead) list.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    return list;
  }

  private burst(x: number, y: number, color: string, n = 12, power = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * power + 1;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
        life: 1, max: 30 + Math.random() * 20, color, size: 2 + Math.random() * 3,
      });
    }
  }

  private addScore(n: number, x: number, y: number) {
    this.score += n;
    this.popups.push({ x, y, life: 50, text: `+${n}` });
  }

  update(dtFrames: number) {
    const dt = Math.min(dtFrames, 2.5);
    this.flagAnim += dt;
    for (const c of this.level.coins) c.phase += dt * 0.15;
    this.updateParticles(dt);
    for (const p of this.popups) { p.life -= dt; p.y -= dt * 0.7; }
    this.popups = this.popups.filter((p) => p.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.6);

    if (this.phase !== "playing") return;

    this.timeAcc += dt;
    if (this.timeAcc >= 60) {
      this.timeAcc -= 60;
      this.time -= 1;
      if (this.time <= 0) { this.time = 0; this.killPlayer(true); }
      this.emitHud();
    }

    const p = this.player;

    if (p.dead) {
      p.deadTimer -= dt;
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.deadTimer <= 0) this.respawn();
      return;
    }

    // ---- input ----
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    const jumpHeld = this.keys.has("Space") || this.keys.has("KeyW") || this.keys.has("ArrowUp");

    if (left && !right) { p.vx -= MOVE_ACC * dt; p.face = -1; }
    else if (right && !left) { p.vx += MOVE_ACC * dt; p.face = 1; }
    else p.vx *= Math.pow(FRICTION, dt);
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;
    p.anim += Math.abs(p.vx) * dt * 0.2;

    if (this.buffer > 0) this.buffer -= dt;
    if (this.coyote > 0) this.coyote -= dt;

    if (this.buffer > 0 && (this.coyote > 0 || p.jumps > 0)) {
      const airJump = this.coyote <= 0 && !p.onGround;
      p.vy = airJump ? JUMP_V * 0.92 : JUMP_V;
      p.onGround = false;
      this.coyote = 0;
      this.buffer = 0;
      p.jumps -= 1;
      if (airJump) this.burst(p.x + p.w / 2, p.y + p.h, "oklch(0.9 0.1 220)", 6, 2);
      sfx.jump();
    }
    // variable jump height
    if (!jumpHeld && p.vy < -4) p.vy += 0.55 * dt;

    p.vy += GRAVITY * dt;
    p.vy = Math.min(p.vy, 16);

    this.movePlayer(dt);

    if (p.onGround) { this.coyote = COYOTE; p.jumps = 2; }
    if (p.invuln > 0) p.invuln -= dt;

    if (p.y > WORLD_H + 120) this.killPlayer(true);

    this.updateEnemies(dt);
    this.updateMushrooms(dt);
    this.updateProjectiles(dt);
    this.collectCoins();

    // goal
    if (p.x + p.w > this.level.levelEnd) {
      this.score += Math.ceil(this.time) * 10 + this.lives * 200;
      this.phase = this.levelIndex >= TOTAL_LEVELS ? "win" : "levelclear";
      sfx.win();
      this.emitHud();
    }

    // camera
    const target = Math.max(0, Math.min(p.x + p.w / 2 - VIEW_W * 0.4, this.level.worldW - VIEW_W));
    this.camX += (target - this.camX) * Math.min(1, 0.12 * dt);
  }

  private movePlayer(dt: number) {
    const p = this.player;
    const solids = this.solids();

    p.x += p.vx * dt;
    for (const s of solids) {
      if (!overlap(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      p.vx = 0;
    }
    if (p.x < 0) { p.x = 0; p.vx = 0; }

    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of solids) {
      if (!overlap(p, s)) continue;
      if (p.vy > 0) { p.y = s.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) {
        p.y = s.y + s.h;
        p.vy = 1;
        this.hitBlockAt(s);
      }
    }
  }

  private hitBlockAt(s: Rect) {
    const b = this.level.blocks.find((bl) => !bl.dead && bl.x === s.x && bl.y === s.y && bl.w === s.w);
    if (!b) { sfx.bump(); return; }
    b.bounce = 10;
    if (b.kind === "question") {
      if (b.used) { sfx.bump(); return; }
      b.used = true;
      if (b.contains === "mushroom") {
        this.mushrooms.push({ x: b.x + 4, y: b.y - 32, w: 32, h: 32, vx: 1.6, vy: 0, rise: 20 });
        sfx.powerup();
      } else {
        this.coins += 1;
        this.addScore(100, b.x + 12, b.y - 10);
        sfx.coin();
        this.burst(b.x + TILE / 2, b.y, "oklch(0.85 0.18 90)", 8, 3);
      }
      this.emitHud();
    } else {
      if (this.player.big) {
        b.dead = true;
        sfx.block();
        this.shake = 6;
        this.burst(b.x + TILE / 2, b.y + TILE / 2, "#b5651d", 16, 5);
        this.addScore(50, b.x + 10, b.y - 10);
        this.emitHud();
      } else sfx.bump();
    }
  }

  private updateParticles(dt: number) {
    for (const pa of this.particles) {
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      pa.vy += 0.25 * dt;
      pa.life -= dt / pa.max;
    }
    this.particles = this.particles.filter((pa) => pa.life > 0);
  }

  private collectCoins() {
    const p = this.player;
    for (const c of this.level.coins) {
      if (c.taken) continue;
      if (overlap(p, { x: c.x, y: c.y, w: 22, h: 26 })) {
        c.taken = true;
        this.coins += 1;
        this.addScore(100, c.x, c.y - 6);
        this.burst(c.x + 11, c.y + 13, "oklch(0.85 0.18 90)", 8, 2.5);
        sfx.coin();
        this.emitHud();
      }
    }
  }

  private updateMushrooms(dt: number) {
    const solids = this.solids();
    for (const m of this.mushrooms) {
      if (m.rise > 0) { m.rise -= dt; m.y -= 0.8 * dt; continue; }
      m.vy = Math.min(m.vy + GRAVITY * dt, 14);
      m.x += m.vx * dt;
      for (const s of solids) {
        if (!overlap(m, s)) continue;
        if (m.vx > 0) m.x = s.x - m.w; else m.x = s.x + s.w;
        m.vx *= -1;
      }
      m.y += m.vy * dt;
      for (const s of solids) {
        if (!overlap(m, s)) continue;
        if (m.vy > 0) { m.y = s.y - m.h; m.vy = 0; }
        else { m.y = s.y + s.h; m.vy = 0; }
      }
      if (overlap(this.player, m)) {
        m.y = 9999;
        if (!this.player.big) {
          this.player.big = true;
          this.player.h = 58;
          this.player.w = 34;
          this.player.y -= 14;
        }
        this.health = 100;
        this.addScore(1000, m.x, m.y - 10);
        sfx.powerup();
        this.burst(m.x + 16, m.y, "oklch(0.72 0.2 25)", 14, 4);
        this.emitHud();
      }
    }
    this.mushrooms = this.mushrooms.filter((m) => m.y < WORLD_H + 200);
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.vy += 0.18 * dt;
      if (overlap(this.player, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) {
        pr.y = 99999;
        this.damagePlayer();
      }
    }
    this.projectiles = this.projectiles.filter(
      (pr) => pr.y < WORLD_H + 100 && pr.x > this.camX - 200 && pr.x < this.camX + VIEW_W + 400,
    );
  }

  private updateEnemies(dt: number) {
    const solids = this.solids();
    const p = this.player;
    for (const e of this.level.enemies) {
      if (e.dead) { e.squash -= dt; continue; }
      const onScreen = e.x > this.camX - 300 && e.x < this.camX + VIEW_W + 300;
      if (!onScreen) continue;
      e.timer += dt;

      if (e.kind === "patrol") {
        e.x += e.vx * dt;
        for (const s of solids) {
          if (!overlap(e, s)) continue;
          if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w;
          e.vx *= -1;
        }
      } else if (e.kind === "leaper") {
        if (e.onGround && e.timer > 90) { e.vy = -11; e.timer = 0; e.onGround = false; }
      } else if (e.kind === "thrower") {
        if (e.timer > 120) {
          e.timer = 0;
          const dx = p.x - e.x;
          const dir = Math.sign(dx) || 1;
          this.projectiles.push({ x: e.x + e.w / 2, y: e.y + 8, vx: dir * 3.4, vy: -2.4, r: 7 });
          sfx.throwA();
        }
      }

      e.vy = Math.min(e.vy + GRAVITY * dt, 14);
      e.y += e.vy * dt;
      e.onGround = false;
      for (const s of solids) {
        if (!overlap(e, s)) continue;
        if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; e.onGround = true; }
        else { e.y = s.y + s.h; e.vy = 0; }
      }

      // cliff detection for patrols
      if (e.kind === "patrol" && e.onGround) {
        const probeX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const probe = { x: probeX, y: e.y + e.h + 2, w: 2, h: 6 };
        const grounded = solids.some((s) => overlap(probe, s));
        if (!grounded) e.vx *= -1;
      }

      if (e.y > WORLD_H + 200) { e.dead = true; continue; }

      // player interaction
      if (!p.dead && overlap(p, e)) {
        const stomping = p.vy > 1 && p.y + p.h - e.y < 26;
        if (stomping) {
          e.dead = true;
          e.squash = 18;
          p.vy = -9.5;
          this.shake = 5;
          this.addScore(200, e.x, e.y - 10);
          this.burst(e.x + e.w / 2, e.y + e.h / 2, "oklch(0.6 0.15 40)", 14, 4);
          sfx.stomp();
          this.emitHud();
        } else {
          this.damagePlayer();
        }
      }
    }
  }

  private damagePlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    if (p.big) {
      p.big = false;
      p.h = 44;
      p.w = 30;
      p.invuln = 90;
      this.health = 50;
      this.shake = 6;
      sfx.hurt();
      this.burst(p.x + p.w / 2, p.y + p.h / 2, "oklch(0.8 0.15 90)", 12, 4);
      this.emitHud();
      return;
    }
    this.killPlayer(false);
  }

  private killPlayer(silentShield: boolean) {
    const p = this.player;
    if (p.dead) return;
    void silentShield;
    p.dead = true;
    p.deadTimer = 70;
    p.vy = -10;
    this.health = 0;
    this.lives -= 1;
    this.shake = 8;
    sfx.hurt();
    this.emitHud();
  }

  private respawn() {
    if (this.lives <= 0) {
      this.phase = "gameover";
      sfx.gameover();
      this.emitHud();
      return;
    }
    this.spawnPlayer();
    this.camX = Math.max(0, this.player.x - VIEW_W * 0.4);
    this.emitHud();
  }

  // ---------------- rendering ----------------
  draw(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawSky(ctx);

    ctx.save();
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(-Math.round(this.camX) + sx, sy);

    this.drawPlatforms(ctx);
    this.drawFlag(ctx);
    this.drawBlocks(ctx);
    this.drawCoins(ctx);
    this.drawMushrooms(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    this.drawPopups(ctx);

    ctx.restore();
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const t = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, t.sky[0]);
    g.addColorStop(0.55, t.sky[1]);
    g.addColorStop(1, t.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // far hills
    ctx.fillStyle = t.hillFar;
    const off2 = -this.camX * 0.25;
    for (let i = -1; i < 20; i++) {
      const x = off2 + i * 360;
      if (x < -400 || x > VIEW_W + 400) continue;
      ctx.beginPath();
      ctx.arc(x, 470, 190, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = t.hillNear;
    const off3 = -this.camX * 0.45;
    for (let i = -1; i < 24; i++) {
      const x = off3 + i * 280 + 120;
      if (x < -300 || x > VIEW_W + 300) continue;
      ctx.beginPath();
      ctx.arc(x, 500, 130, Math.PI, 0);
      ctx.fill();
    }

    this.drawDecor(ctx);
  }

  private drawDecor(ctx: CanvasRenderingContext2D) {
    const t = this.theme;
    ctx.fillStyle = t.decorColor;
    if (t.decor === "clouds") {
      const off1 = -this.camX * 0.12;
      const clouds: [number, number, number][] = [
        [60, 90, 1], [360, 60, 0.8], [640, 120, 1.1], [900, 70, 0.9],
        [1200, 110, 1], [1500, 65, 0.85], [1800, 120, 1.05], [2100, 80, 0.95],
      ];
      for (const [cx, cy, sc] of clouds) {
        const x = ((cx + off1) % 2400 + 2400) % 2400 - 200;
        if (x < -220 || x > VIEW_W + 220) continue;
        this.cloud(ctx, x, cy, sc);
      }
      return;
    }
    const off = -this.camX * (t.decor === "stars" ? 0.06 : 0.18);
    for (let i = 0; i < 60; i++) {
      const seed = i * 97.13;
      const bx = (seed * 37) % 2400;
      const by = (seed * 53) % 380;
      let x = ((bx + off) % 2400 + 2400) % 2400 - 200;
      let y = by + 20;
      if (t.decor === "snow") y = (by + this.flagAnim * 0.9 + i * 7) % 480;
      if (t.decor === "embers") y = 480 - ((by + this.flagAnim * 1.2 + i * 9) % 480);
      if (t.decor === "bubbles") y = 480 - ((by + this.flagAnim * 0.7 + i * 11) % 480);
      if (x < -20 || x > VIEW_W + 20) continue;
      const r = t.decor === "stars" ? 1.6 + (i % 3) * 0.6 : 2 + (i % 4);
      ctx.globalAlpha = t.decor === "stars" ? 0.5 + Math.abs(Math.sin(this.flagAnim * 0.05 + i)) * 0.5 : 0.85;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 26 * s, y - 10 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 56 * s, y, 22 * s, 0, Math.PI * 2);
    ctx.rect(x, y, 56 * s, 24 * s);
    ctx.fill();
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D) {
    for (const s of this.level.platforms) {
      const isGround = s.y >= GROUND_Y;
      const t = this.theme;
      ctx.fillStyle = isGround ? t.groundBody : t.platformBody;
      ctx.fillRect(s.x, s.y + 12, s.w, s.h - 12);
      ctx.fillStyle = t.groundTop;
      ctx.fillRect(s.x, s.y, s.w, 14);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(s.x, s.y + 11, s.w, 4);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let x = s.x; x < s.x + s.w; x += 20) {
        for (let y = s.y + 20; y < s.y + s.h; y += 20) {
          if (((x / 20) | 0) % 2 === ((y / 20) | 0) % 2) ctx.fillRect(x, y, 10, 10);
        }
      }
    }
  }

  private drawBlocks(ctx: CanvasRenderingContext2D) {
    for (const b of this.level.blocks) {
      if (b.dead) continue;
      const dy = b.bounce > 0 ? -Math.sin((b.bounce / 10) * Math.PI) * 10 : 0;
      if (b.bounce > 0) b.bounce -= 0.6;
      const x = b.x, y = b.y + dy;
      if (b.kind === "question") {
        ctx.fillStyle = b.used ? "#9a7b46" : "#f2b632";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
        ctx.fillRect(x + TILE - 5, y, 5, TILE);
        ctx.fillStyle = b.used ? "#7d6236" : "#ffe28a";
        ctx.fillRect(x + 4, y + 4, TILE - 8, 4);
        if (!b.used) {
          ctx.fillStyle = "#7a4a12";
          ctx.font = "bold 24px monospace";
          ctx.textAlign = "center";
          ctx.fillText("?", x + TILE / 2, y + TILE / 2 + 9);
          ctx.textAlign = "left";
        }
      } else {
        ctx.fillStyle = "#c1662f";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        for (let r = 0; r < 4; r++) {
          ctx.beginPath();
          ctx.moveTo(x, y + r * 10);
          ctx.lineTo(x + TILE, y + r * 10);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x + 20, y);
        ctx.lineTo(x + 20, y + 10);
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + 10, y + 20);
        ctx.moveTo(x + 30, y + 20);
        ctx.lineTo(x + 30, y + 30);
        ctx.stroke();
      }
    }
  }

  private drawCoins(ctx: CanvasRenderingContext2D) {
    for (const c of this.level.coins) {
      if (c.taken) continue;
      if (c.x < this.camX - 60 || c.x > this.camX + VIEW_W + 60) continue;
      const w = Math.abs(Math.cos(c.phase)) * 18 + 4;
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.ellipse(c.x + 11, c.y + 13, w / 2, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0a416";
      ctx.beginPath();
      ctx.ellipse(c.x + 11, c.y + 13, Math.max(1, w / 2 - 4), 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMushrooms(ctx: CanvasRenderingContext2D) {
    for (const m of this.mushrooms) {
      ctx.fillStyle = "#f7e6c4";
      ctx.fillRect(m.x + 6, m.y + 16, 20, 16);
      ctx.fillStyle = "#e03b2f";
      ctx.beginPath();
      ctx.arc(m.x + 16, m.y + 16, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(m.x + 9, m.y + 10, 4, 0, Math.PI * 2);
      ctx.arc(m.x + 23, m.y + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b1a12";
      ctx.fillRect(m.x + 10, m.y + 21, 3, 4);
      ctx.fillRect(m.x + 19, m.y + 21, 3, 4);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.level.enemies) {
      if (e.dead && e.squash <= 0) continue;
      if (e.x < this.camX - 200 || e.x > this.camX + VIEW_W + 200) continue;
      const squashed = e.dead;
      const h = squashed ? e.h * 0.35 : e.h;
      const y = e.y + (e.h - h);

      if (e.kind === "patrol") {
        ctx.fillStyle = "#8a4b1e";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f6e3c8";
        ctx.fillRect(e.x + 4, y + h - 6, 9, 6);
        ctx.fillRect(e.x + e.w - 13, y + h - 6, 9, 6);
      } else if (e.kind === "leaper") {
        ctx.fillStyle = "#2fae5e";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, y + h / 2, e.w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1c7a41";
        ctx.fillRect(e.x + 2, y + h - 5, 8, 5);
        ctx.fillRect(e.x + e.w - 10, y + h - 5, 8, 5);
      } else {
        ctx.fillStyle = "#7b46c9";
        ctx.fillRect(e.x, y, e.w, h);
        ctx.fillStyle = "#5c31a0";
        ctx.fillRect(e.x, y + h - 8, e.w, 8);
      }
      if (!squashed) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(e.x + 7, y + 8, 7, 8);
        ctx.fillRect(e.x + e.w - 14, y + 8, 7, 8);
        ctx.fillStyle = "#111";
        ctx.fillRect(e.x + 9, y + 11, 3, 4);
        ctx.fillRect(e.x + e.w - 12, y + 11, 3, 4);
      }
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D) {
    for (const pr of this.projectiles) {
      ctx.fillStyle = "#a4691f";
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, pr.r, pr.r + 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5e3a10";
      ctx.fillRect(pr.x - pr.r, pr.y - pr.r - 3, pr.r * 2, 5);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
    const x = p.x, y = p.y, w = p.w, h = p.h;
    const stride = p.onGround ? Math.sin(p.anim) * 4 : 3;
    // legs - black shorts / socks
    ctx.fillStyle = "#1b1b22";
    ctx.fillRect(x + 3, y + h - 14, 10, 14 - Math.max(0, stride));
    ctx.fillRect(x + w - 13, y + h - 14, 10, 14 + Math.min(0, stride));
    // red jersey
    ctx.fillStyle = "#e5202a";
    ctx.fillRect(x, y + h * 0.42, w, h * 0.42);
    ctx.fillStyle = "#b3161e";
    ctx.fillRect(x, y + h * 0.72, w, h * 0.12);
    // number 7
    ctx.fillStyle = "#fff4c2";
    ctx.font = `bold ${Math.round(h * 0.2)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("7", x + w / 2, y + h * 0.68);
    ctx.textAlign = "left";
    // gold chain
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(x + w * 0.25, y + h * 0.44, w * 0.5, 3);
    // head
    ctx.fillStyle = "#7a4a26";
    ctx.fillRect(x + 3, y + h * 0.14, w - 6, h * 0.3);
    // hair (short dark, twists)
    ctx.fillStyle = "#161014";
    ctx.fillRect(x + 2, y + h * 0.1, w - 4, h * 0.09);
    ctx.fillRect(x + 4, y + h * 0.06, 5, 5);
    ctx.fillRect(x + w * 0.45, y + h * 0.05, 5, 6);
    ctx.fillRect(x + w - 10, y + h * 0.06, 5, 5);
    // eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.face === 1 ? x + w - 14 : x + 6, y + h * 0.23, 5, 5);
    ctx.fillRect(p.face === 1 ? x + w - 22 : x + 14, y + h * 0.23, 5, 5);
    ctx.fillStyle = "#100c10";
    ctx.fillRect(p.face === 1 ? x + w - 13 : x + 7, y + h * 0.245, 3, 3);
    ctx.fillRect(p.face === 1 ? x + w - 21 : x + 15, y + h * 0.245, 3, 3);
    // shouting mouth
    ctx.fillStyle = "#2a1010";
    ctx.fillRect(x + w * 0.3, y + h * 0.34, w * 0.4, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w * 0.3, y + h * 0.34, w * 0.4, 2);
  }

  /** Cristiano Ronaldo cheering at the final flag */
  private drawRonaldo(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bob = Math.sin(this.flagAnim * 0.08) * 4;
    const w = 34, h = 56;
    const top = y - h + bob;
    // arms raised
    ctx.fillStyle = "#c98d61";
    ctx.fillRect(x - 8, top + 2, 8, 22);
    ctx.fillRect(x + w, top + 2, 8, 22);
    // legs
    ctx.fillStyle = "#f2f4f8";
    ctx.fillRect(x + 4, top + h - 18, 10, 18);
    ctx.fillRect(x + w - 14, top + h - 18, 10, 18);
    // white kit
    ctx.fillStyle = "#f7f9fc";
    ctx.fillRect(x, top + 18, w, h - 34);
    ctx.fillStyle = "#1f3f8f";
    ctx.fillRect(x, top + h - 20, w, 4);
    ctx.fillStyle = "#1f3f8f";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("7", x + w / 2, top + 34);
    ctx.textAlign = "left";
    // head
    ctx.fillStyle = "#d69a6c";
    ctx.fillRect(x + 7, top + 2, w - 14, 18);
    ctx.fillStyle = "#2a1b12";
    ctx.fillRect(x + 6, top, w - 12, 6);
    ctx.fillStyle = "#141018";
    ctx.fillRect(x + 11, top + 9, 3, 3);
    ctx.fillRect(x + w - 14, top + 9, 3, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 12, top + 15, w - 24, 3);
    // SIUUU label
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    ctx.strokeText("SIUUU!", x + w / 2, top - 10);
    ctx.fillText("SIUUU!", x + w / 2, top - 10);
    ctx.textAlign = "left";
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const pa of this.particles) {
      ctx.globalAlpha = Math.max(0, pa.life);
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x, pa.y, pa.size, pa.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawPopups(ctx: CanvasRenderingContext2D) {
    ctx.font = "bold 16px monospace";
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = "#fffbe6";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawFlag(ctx: CanvasRenderingContext2D) {
    const x = this.level.levelEnd;
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(x, 160, 8, GROUND_Y - 160);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(x + 4, 156, 9, 0, Math.PI * 2);
    ctx.fill();
    const wave = Math.sin(this.flagAnim * 0.08) * 6;
    ctx.fillStyle = "#2fae5e";
    ctx.beginPath();
    ctx.moveTo(x + 8, 172);
    ctx.lineTo(x + 62 + wave, 192);
    ctx.lineTo(x + 8, 212);
    ctx.closePath();
    ctx.fill();
    // gate base
    ctx.fillStyle = "#4a3524";
    ctx.fillRect(x - 14, GROUND_Y - 34, 36, 34);

    if (this.levelIndex >= TOTAL_LEVELS) {
      this.drawRonaldo(ctx, x + 70, GROUND_Y);
    }
  }

  keyDown(code: string) {
    this.keys.add(code);
    if (code === "Space" || code === "KeyW" || code === "ArrowUp") this.buffer = BUFFER;
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
}

export { WORLD_H };

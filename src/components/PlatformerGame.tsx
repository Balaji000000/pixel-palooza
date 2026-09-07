import { useCallback, useEffect, useRef, useState } from "react";
import { Game, VIEW_H, VIEW_W, type HudState } from "@/game/engine";
import { unlockAudio } from "@/game/audio";

const KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space",
]);

export default function PlatformerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>({
    lives: 3, health: 100, coins: 0, score: 0, time: 300, phase: "start", big: false,
    level: 1, levelName: "GREEN HILLS", totalLevels: 10,
  });

  useEffect(() => {
    const game = new Game();
    gameRef.current = game;
    game.onHud = setHud;
    setHud(game.hud());

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    const w = window as unknown as { __game?: Game; __miny?: number };
    w.__game = game;
    w.__miny = 9999;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / (1000 / 60);
      last = now;
      game.update(dt);
      game.draw(ctx);
      w.__miny = Math.min(w.__miny ?? 9999, game.player.y);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const down = (e: KeyboardEvent) => {
      if (KEYS.has(e.code)) e.preventDefault();
      game.keyDown(e.code);
    };
    const up = (e: KeyboardEvent) => game.keyUp(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const startGame = useCallback(() => {
    unlockAudio();
    gameRef.current?.start();
  }, []);

  const nextLevel = useCallback(() => {
    unlockAudio();
    gameRef.current?.nextLevel();
  }, []);

  const overlay = hud.phase !== "playing";

  return (
    <div className="w-full max-w-[1000px] px-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-4 border-hud-border bg-hud px-4 py-3 font-pixel text-xs text-hud-foreground shadow-arcade">
        <Stat label="LEVEL" value={`${hud.level}/${hud.totalLevels}`} tone="gold" />
        <Stat label="LIVES" value={`x${Math.max(0, hud.lives)}`} tone="danger" />
        <Stat label="COINS" value={`x${String(hud.coins).padStart(2, "0")}`} tone="gold" />
        <Stat label="SCORE" value={String(hud.score).padStart(6, "0")} />
        <Stat label="TIME" value={String(hud.time).padStart(3, "0")} tone={hud.time <= 30 ? "danger" : "default"} />
        <div className="flex flex-col gap-1">
          <span className="text-[9px] opacity-70">POWER</span>
          <div className="h-3 w-24 overflow-hidden rounded-sm border-2 border-hud-border bg-hud-track">
            <div
              className="h-full bg-gradient-power transition-all duration-300"
              style={{ width: `${hud.health}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mb-2 text-center font-pixel text-[9px] text-hud-foreground/70">WORLD {hud.level} — {hud.levelName}</p>

      <div className="relative overflow-hidden rounded-xl border-4 border-hud-border shadow-arcade">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", aspectRatio: `${VIEW_W} / ${VIEW_H}`, display: "block", imageRendering: "pixelated" }}
        />

        {overlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-overlay px-6 text-center backdrop-blur-sm animate-fade-in">
            {hud.phase === "start" && (
              <Panel
                title="SPEED RUN"
                subtitle="Play as IShowSpeed across 10 worlds"
                body={
                  <ul className="space-y-1 text-[10px] leading-relaxed opacity-80">
                    <li>← → / A D — move</li>
                    <li>SPACE / W / ↑ — jump (hold for higher, press again in air to double jump)</li>
                    <li>Clear 10 themed worlds — Ronaldo waits at the finish</li>
                  </ul>
                }
                action="START GAME"
                onAction={startGame}
              />
            )}
            {hud.phase === "levelclear" && (
              <Panel
                title={`WORLD ${hud.level} CLEAR`}
                subtitle="A brand new world awaits"
                body={
                  <div className="space-y-1 text-[10px] opacity-85">
                    <p>SCORE {hud.score}</p>
                    <p>COINS {hud.coins}</p>
                    <p>LIVES {hud.lives}</p>
                  </div>
                }
                action="NEXT LEVEL"
                onAction={nextLevel}
              />
            )}
            {hud.phase === "gameover" && (
              <Panel
                title="GAME OVER"
                subtitle="Speed is down. Run it back."
                body={
                  <div className="space-y-1 text-[10px] opacity-85">
                    <p>SCORE {hud.score}</p>
                    <p>COINS {hud.coins}</p>
                  </div>
                }
                action="PLAY AGAIN"
                onAction={startGame}
              />
            )}
            {hud.phase === "win" && (
              <Panel
                title="SIUUU!"
                subtitle="Speed cleared all 10 worlds — Ronaldo appears!"
                body={
                  <div className="space-y-1 text-[10px] opacity-90">
                    <p>COINS COLLECTED — {hud.coins}</p>
                    <p>TIME BONUS — {hud.time * 10}</p>
                    <p>LIVES BONUS — {hud.lives * 500}</p>
                    <p className="pt-2 text-sm text-accent">FINAL SCORE {hud.score}</p>
                  </div>
                }
                action="PLAY AGAIN"
                onAction={startGame}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "gold" | "danger" }) {
  const toneClass = tone === "gold" ? "text-accent" : tone === "danger" ? "text-destructive" : "text-hud-foreground";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] opacity-70">{label}</span>
      <span className={`text-sm ${toneClass}`}>{value}</span>
    </div>
  );
}

function Panel({
  title, subtitle, body, action, onAction,
}: {
  title: string; subtitle: string; body: React.ReactNode; action: string; onAction: () => void;
}) {
  return (
    <div className="animate-scale-in rounded-xl border-4 border-hud-border bg-hud px-8 py-7 font-pixel text-hud-foreground shadow-arcade">
      <h2 className="bg-gradient-title bg-clip-text text-2xl text-transparent drop-shadow">{title}</h2>
      <p className="mt-2 text-[10px] opacity-70">{subtitle}</p>
      <div className="mt-4">{body}</div>
      <button
        onClick={onAction}
        className="mt-6 rounded-md border-4 border-hud-border bg-primary px-6 py-3 text-xs text-primary-foreground transition-transform hover:scale-105 active:scale-95"
      >
        {action}
      </button>
    </div>
  );
}

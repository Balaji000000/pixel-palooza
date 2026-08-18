import { createFileRoute } from "@tanstack/react-router";
import PlatformerGame from "@/components/PlatformerGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acorn Run — Retro 2D Platformer Game" },
      {
        name: "description",
        content:
          "Play Acorn Run, a pixel-art side-scrolling platformer: run, jump, stomp enemies, collect coins and reach the flagpole.",
      },
      { property: "og:title", content: "Acorn Run — Retro 2D Platformer Game" },
      {
        property: "og:description",
        content: "A vibrant retro arcade platformer built with HTML5 Canvas. Jump, stomp, and grab every coin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-arcade py-8">
      <h1 className="font-pixel text-lg text-hud-foreground drop-shadow-md sm:text-2xl">ACORN RUN</h1>
      <PlatformerGame />
      <p className="font-pixel text-[9px] text-hud-foreground/70">MOVE ← → · JUMP SPACE · HOLD TO JUMP HIGHER</p>
    </main>
  );
}

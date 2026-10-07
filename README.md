# Pixel Palooza

Build a complete, polished 2D side-scrolling platformer web game in React and HTML5 Canvas inspired by Super Mario Bros. Use a vibrant, modern retro arcade pixel-art theme.

### Core Player Mechanics:

1. Movement: Smooth left/right movement using Arrow keys or A/D.

2. Responsive Jump: Spacebar or W/Up arrow with variable jump height (holding jumps higher, tapping gives a short hop). Include 0.1s coyote time and jump buffering for responsive control.

3. Health & Lives: Player starts with 3 lives and 100 max health. Touching an enemy from the side reduces 1 life; stomping an enemy from above bounces the player and defeats the enemy (+200 pts).

4. Power-Up System: Mystery '?' blocks that release a Super Mushroom when hit from below. Collecting it grows the player larger and grants an extra hit shield.

### Enemies & Smart AI:

1. Patrol Enemy (Goomba-style): Walks horizontally. Uses edge/cliff detection and wall collision so it turns around instead of walking off ledges.

2. Leaping Hazard: Periodically jumps upward in a parabolic arc at fixed intervals.

3. Ranged Enemy: Stands on high platforms and periodically throws small projectile acorns toward the player's position.

### World & Level Design:

1. Parallax scrolling background with clouds, distant hills, and clear ground platforms.

2. Interactive blocks: Breakable brick blocks and bounce-animated '?' coin blocks.

3. Collectibles: Golden rotating coins scattered across the map that increase the coin counter.

4. Level Goal: A flagpole / victory gate at the end of the map (X: 3000px).

### UI & Game Polish:

1. Top HUD displaying: Lives counter, Coin count, Current Score, and a 300-second countdown timer.

2. Visual Polish: Particle burst when enemies are stomped or blocks are broken, subtle camera shake on impact, and smooth horizontal camera tracking.

3. Overlays: Start Screen, Victory Screen with final score breakdown, and Game Over screen with an instant 'Play Again' button.

4. Sound FX: Synthesize retro Web Audio API sounds for jump, coin collect, power-up, stomp, and game over.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dbc90256-a241-4c7c-a687-974e05704b85).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

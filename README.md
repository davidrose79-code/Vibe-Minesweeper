# Vibe-Minesweeper

A mobile-first Minesweeper game built for touchscreen play. Designed as a small coding exercise using Claude Code from a mobile device — no local toolchain required.

## Live Demo

Deploy via GitHub Pages: **Settings → Pages → Source: main branch → Save**

Your game will be live at: `https://<your-username>.github.io/Vibe-Minesweeper/`

## How to Play

| Action | Gesture |
|---|---|
| Reveal a cell | Tap |
| Place / remove a flag | Long press (~0.5s) |
| Restart | Tap the restart button |

**Goal:** Reveal every cell that isn't a mine. Flag the mines to keep track of them.

If you reveal a mine — game over!

## Difficulty Levels

| Level | Grid | Mines |
|---|---|---|
| Easy | 9 × 9 | 10 |
| Medium | 16 × 16 | 40 |
| Hard | 16 × 30 | 99 |

## Features

- Safe first tap — the first cell you tap is never a mine
- Flood-fill reveal — tapping an empty cell reveals all connected empty cells
- Mine counter and elapsed timer in the header
- Win/lose modal with best-time tracking (saved locally)
- Chord reveal — tap a number when its neighbours are fully flagged to auto-reveal the rest
- Haptic feedback on flag and game-over (where supported)
- Dark mode via system preference

## Tech Stack

Plain HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies.
Works in any modern mobile browser.

## Project Structure

```
index.html   — page layout and markup
style.css    — mobile-first styles
game.js      — all game logic and touch handling
```

## License

MIT

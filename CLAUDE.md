# CLAUDE.md — Vibe-Minesweeper

Guidance for Claude Code sessions on this project.

## Project Overview

A single-page Minesweeper game targeting mobile browsers. No build tools, no package manager, no frameworks. Everything lives in three files.

## File Map

| File | Role |
|---|---|
| `index.html` | Page structure, header UI, board container, end-game modal |
| `style.css` | Mobile-first layout and all visual cell states |
| `game.js` | Complete game logic: state, mine placement, reveal, touch handling |

## Key Constraints

- **No npm / no bundler** — do not introduce package.json, node_modules, or any build step
- **Three files only** — keep all code in `index.html`, `style.css`, `game.js`
- **Vanilla JS** — no React, Vue, jQuery, or other libraries
- **Mobile browsers** — target iOS Safari and Android Chrome; no mouse events needed

## Touch UX Rules

- **Tap** (touchstart → touchend < 500 ms) = reveal cell
- **Long press** (touchstart held ≥ 500 ms) = flag / unflag cell
- **touchmove** cancels any pending long-press (user is scrolling)
- Prevent the default `contextmenu` event (long-press on Android triggers it)
- Minimum cell touch target: 44 × 44 px

## Game Rules Implemented

1. First tap is always safe — mines are placed *after* the first tap
2. Revealing an empty cell (0 adjacent mines) flood-fills all connected empty cells (BFS)
3. Chord reveal — tapping a revealed number when its flagged-neighbour count equals the number auto-reveals remaining neighbours
4. Win condition: all non-mine cells revealed
5. Lose condition: a mine cell is revealed

## State Shape

```js
// game.js top-level
const state = {
  grid,          // 2D array: { mine, revealed, flagged, adjacent }
  rows, cols,    // board dimensions
  mines,         // total mine count
  flagCount,     // flags placed so far
  gameOver,      // boolean
  won,           // boolean
  firstClick,    // boolean — true until first tap
  elapsed,       // seconds since first tap
  timerInterval  // setInterval handle
};
```

## How to Test

1. Open `index.html` directly in a mobile browser, or
2. Push to `main` and view on GitHub Pages (enable in repo Settings → Pages)

No local server is needed — the game is purely client-side.

## Commit Style

Short imperative messages, e.g.:
- `add flood-fill reveal`
- `fix long-press cancellation on scroll`
- `add localStorage best times`

## Branch

Always develop on: `claude/minesweeper-mobile-game-RtItl`

Merge to `main` only when a feature is complete and working.

## Optional Extras (implement in this order)

1. Best times via `localStorage`
2. Chord reveal
3. Haptic feedback — `navigator.vibrate()`
4. Dark mode — `prefers-color-scheme` media query
5. Custom board size inputs

'use strict';

// ─── Difficulty presets ───────────────────────────────────────────────────────
const PRESETS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 30, cols: 16, mines: 99 },
};

// ─── State ────────────────────────────────────────────────────────────────────
let state = {};

function createState(diff) {
  const { rows, cols, mines } = PRESETS[diff];
  return {
    diff,
    rows, cols, mines,
    grid: [],          // 2-D array of cell objects
    flagCount: 0,
    gameOver: false,
    won: false,
    firstClick: true,
    elapsed: 0,
    timerInterval: null,
  };
}

function makeCell() {
  return { mine: false, revealed: false, flagged: false, adjacent: 0 };
}

// ─── Initialisation ───────────────────────────────────────────────────────────
function initGame(diff) {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state = createState(diff);

  // Build empty grid
  for (let r = 0; r < state.rows; r++) {
    state.grid.push([]);
    for (let c = 0; c < state.cols; c++) {
      state.grid[r].push(makeCell());
    }
  }

  resetTransform();
  renderBoard();
  updateHeader();
  hideModal();
}

// ─── Mine placement (after first tap) ─────────────────────────────────────────
function placeMines(safeRow, safeCol) {
  const { rows, cols, mines, grid } = state;
  let placed = 0;

  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    // Avoid the safe cell and already-mined cells
    if (grid[r][c].mine) continue;
    if (r === safeRow && c === safeCol) continue;
    grid[r][c].mine = true;
    placed++;
  }

  calcAdjacent();
}

function calcAdjacent() {
  const { rows, cols, grid } = state;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) { grid[r][c].adjacent = -1; continue; }
      let count = 0;
      forNeighbours(r, c, (nr, nc) => { if (grid[nr][nc].mine) count++; });
      grid[r][c].adjacent = count;
    }
  }
}

// ─── Neighbour iterator ───────────────────────────────────────────────────────
function forNeighbours(r, c, fn) {
  const { rows, cols } = state;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
    }
  }
}

// ─── Reveal logic (BFS flood-fill) ───────────────────────────────────────────
function revealCell(r, c) {
  const { grid } = state;
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged || state.gameOver) return;

  // First click — place mines now
  if (state.firstClick) {
    state.firstClick = false;
    placeMines(r, c);
    startTimer();
  }

  if (cell.mine) {
    cell.revealed = true;
    triggerLose(r, c);
    return;
  }

  // BFS
  const queue = [[r, c]];
  while (queue.length) {
    const [qr, qc] = queue.shift();
    const qcell = grid[qr][qc];
    if (qcell.revealed || qcell.flagged) continue;
    qcell.revealed = true;
    if (qcell.adjacent === 0) {
      forNeighbours(qr, qc, (nr, nc) => {
        if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) queue.push([nr, nc]);
      });
    }
  }

  if (checkWin()) return;
  renderBoard();
}

// ─── Chord reveal ─────────────────────────────────────────────────────────────
function chordReveal(r, c) {
  const { grid } = state;
  const cell = grid[r][c];
  if (!cell.revealed || cell.adjacent <= 0 || state.gameOver) return;

  let flagged = 0;
  forNeighbours(r, c, (nr, nc) => { if (grid[nr][nc].flagged) flagged++; });

  if (flagged === cell.adjacent) {
    forNeighbours(r, c, (nr, nc) => {
      if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) revealCell(nr, nc);
    });
  }
}

// ─── Flag logic ───────────────────────────────────────────────────────────────
function flagCell(r, c) {
  const { grid } = state;
  const cell = grid[r][c];
  if (cell.revealed || state.gameOver) return;

  cell.flagged = !cell.flagged;
  state.flagCount += cell.flagged ? 1 : -1;
  vibrate(cell.flagged ? [20] : [10, 50, 10]);
  updateHeader();
  updateCellDOM(r, c);
}

// ─── Win / Lose ───────────────────────────────────────────────────────────────
function checkWin() {
  const { rows, cols, grid } = state;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  triggerWin();
  return true;
}

function triggerWin() {
  state.gameOver = true;
  state.won = true;
  stopTimer();
  renderBoard();
  const best = saveBestTime(state.diff, state.elapsed);
  showModal(true, state.elapsed, best);
}

function triggerLose(mineRow, mineCol) {
  state.gameOver = true;
  state.won = false;
  stopTimer();
  vibrate([50, 100, 50, 100, 50]);
  // Reveal all mines
  const { rows, cols, grid } = state;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) grid[r][c].revealed = true;
    }
  }
  renderBoard();
  // Mark the triggering cell
  const el = cellEl(mineRow, mineCol);
  if (el) el.classList.add('triggered');
  showModal(false, state.elapsed, null);
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  state.timerInterval = setInterval(() => {
    state.elapsed++;
    document.getElementById('timer').textContent = state.elapsed;
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// ─── Best times (localStorage) ────────────────────────────────────────────────
function saveBestTime(diff, seconds) {
  const key = `best_${diff}`;
  const prev = parseInt(localStorage.getItem(key), 10);
  if (isNaN(prev) || seconds < prev) {
    localStorage.setItem(key, seconds);
    return seconds; // new best
  }
  return prev;
}

function getBestTime(diff) {
  const val = parseInt(localStorage.getItem(`best_${diff}`), 10);
  return isNaN(val) ? null : val;
}

// ─── Haptics ──────────────────────────────────────────────────────────────────
function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function cellEl(r, c) {
  return document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

function updateCellDOM(r, c) {
  const el = cellEl(r, c);
  if (!el) return;
  applyCellState(el, state.grid[r][c]);
}

function applyCellState(el, cell) {
  el.className = 'cell';
  el.textContent = '';
  el.removeAttribute('data-n');

  if (cell.revealed) {
    el.classList.add('revealed');
    if (cell.mine) {
      el.classList.add('mine');
    } else if (cell.adjacent > 0) {
      el.setAttribute('data-n', cell.adjacent);
      el.textContent = cell.adjacent;
    }
  } else if (cell.flagged) {
    el.classList.add('flagged');
  }
}

// ─── Full board render ────────────────────────────────────────────────────────
function renderBoard() {
  const board = document.getElementById('board');
  const { rows, cols, grid } = state;

  board.style.setProperty('--cols', cols);
  board.style.setProperty('--rows', rows);

  // Rebuild only if cell count changed
  if (board.children.length !== rows * cols) {
    board.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.r = r;
        el.dataset.c = c;
        el.setAttribute('role', 'gridcell');
        attachTouchHandlers(el, r, c);
        board.appendChild(el);
      }
    }
  }

  // Update all cell states
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      applyCellState(cellEl(r, c), grid[r][c]);
    }
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────
function updateHeader() {
  document.getElementById('mine-count').textContent = state.mines - state.flagCount;
  document.getElementById('timer').textContent = state.elapsed;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function showModal(won, seconds, best) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-emoji').textContent = won ? '🎉' : '💥';
  document.getElementById('modal-title').textContent = won ? 'You Win!' : 'Game Over';
  document.getElementById('modal-time').textContent = `Time: ${seconds}s`;

  const bestEl = document.getElementById('modal-best');
  if (won && best !== null) {
    bestEl.textContent = best === seconds ? '⭐ New best time!' : `Best: ${best}s`;
  } else {
    bestEl.textContent = getBestTime(state.diff) !== null
      ? `Best: ${getBestTime(state.diff)}s`
      : '';
  }

  modal.classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
}

// ─── Mode toggle (reveal / flag) ──────────────────────────────────────────────
let flagMode = false;

function setFlagMode(on) {
  flagMode = on;
  const btn = document.getElementById('mode-toggle');
  btn.textContent = flagMode ? '🚩 Flag' : '⛏ Reveal';
  btn.classList.toggle('flag-mode', flagMode);
}

// ─── Touch / click handling ───────────────────────────────────────────────────
// Tracks how many fingers are currently down (used to ignore taps during pinch)
let activeTouchCount = 0;

function handleSingleAction(r, c) {
  if (flagMode) {
    flagCell(r, c);
    return;
  }
  const cell = state.grid[r][c];
  if (cell.revealed && cell.adjacent > 0) {
    chordReveal(r, c);
  } else {
    revealCell(r, c);
  }
}

function attachTouchHandlers(el, r, c) {
  let startX, startY;
  let moved = false;

  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.sqrt(dx * dx + dy * dy) > 10) moved = true;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (moved || activeTouchCount > 1) return;
    handleSingleAction(r, c);
  }, { passive: false });

  // Mouse support for desktop testing
  el.addEventListener('click', () => handleSingleAction(r, c));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ─── Zoom / Pan ───────────────────────────────────────────────────────────────
const vt = { scale: 1, x: 0, y: 0 };

function applyTransform() {
  document.getElementById('board').style.transform =
    `translate(${vt.x}px, ${vt.y}px) scale(${vt.scale})`;
}

function resetTransform() {
  vt.scale = 1; vt.x = 0; vt.y = 0;
  applyTransform();
}

function clampTransform() {
  if (vt.scale <= 1) { vt.scale = 1; vt.x = 0; vt.y = 0; return; }
  const main = document.querySelector('main');
  const board = document.getElementById('board');
  const maxX = Math.max(0, (board.offsetWidth  * vt.scale - main.clientWidth)  / 2);
  const maxY = Math.max(0, (board.offsetHeight * vt.scale - main.clientHeight) / 2);
  vt.x = Math.max(-maxX, Math.min(maxX, vt.x));
  vt.y = Math.max(-maxY, Math.min(maxY, vt.y));
}

function setupZoomPan() {
  const main = document.querySelector('main');
  const liveTouch = {};   // identifier → {x, y}
  let lastDist = 0;
  let panStart = null;

  main.addEventListener('touchstart', (e) => {
    activeTouchCount = e.touches.length;
    for (const t of e.changedTouches) liveTouch[t.identifier] = { x: t.clientX, y: t.clientY };

    if (e.touches.length === 2) {
      const [a, b] = Object.values(liveTouch);
      lastDist = Math.hypot(b.x - a.x, b.y - a.y);
    } else if (e.touches.length === 1) {
      panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: vt.x, ty: vt.y };
    }
  }, { passive: true });

  main.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) liveTouch[t.identifier] = { x: t.clientX, y: t.clientY };

    if (e.touches.length === 2) {
      const [a, b] = Object.values(liveTouch);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const mainRect = main.getBoundingClientRect();
      const ncX = mainRect.left + mainRect.width  / 2;
      const ncY = mainRect.top  + mainRect.height / 2;
      const newScale = Math.min(4, Math.max(1, vt.scale * dist / lastDist));
      const r = newScale / vt.scale;
      vt.x = mx - ncX - (mx - ncX - vt.x) * r;
      vt.y = my - ncY - (my - ncY - vt.y) * r;
      vt.scale = newScale;
      clampTransform();
      applyTransform();
      lastDist = dist;

    } else if (e.touches.length === 1 && panStart && vt.scale > 1) {
      vt.x = panStart.tx + e.touches[0].clientX - panStart.x;
      vt.y = panStart.ty + e.touches[0].clientY - panStart.y;
      clampTransform();
      applyTransform();
    }
  }, { passive: true });

  main.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) delete liveTouch[t.identifier];
    activeTouchCount = e.touches.length;
    if (e.touches.length < 2) lastDist = 0;
    if (e.touches.length === 0) panStart = null;
  }, { passive: true });
}

// ─── Difficulty bar ───────────────────────────────────────────────────────────
document.getElementById('difficulty-bar').addEventListener('click', (e) => {
  const btn = e.target.closest('.diff-btn');
  if (!btn) return;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  initGame(btn.dataset.diff);
});

// ─── Restart buttons ──────────────────────────────────────────────────────────
document.getElementById('restart-btn').addEventListener('click', () => {
  initGame(state.diff || 'easy');
});

document.getElementById('modal-restart').addEventListener('click', () => {
  initGame(state.diff || 'easy');
});

// ─── Mode toggle button ───────────────────────────────────────────────────────
const modeToggleBtn = document.getElementById('mode-toggle');
modeToggleBtn.addEventListener('click', () => setFlagMode(!flagMode));
modeToggleBtn.addEventListener('touchend', (e) => {
  e.preventDefault();           // stop the 300 ms synthetic click
  setFlagMode(!flagMode);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
setupZoomPan();
initGame('easy');

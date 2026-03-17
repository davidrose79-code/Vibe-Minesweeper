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

// ─── Touch handling ───────────────────────────────────────────────────────────
const LONG_PRESS_MS = 500;

function attachTouchHandlers(el, r, c) {
  let pressTimer = null;
  let longFired = false;
  let startX, startY;

  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    longFired = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    el.classList.add('pressing');

    pressTimer = setTimeout(() => {
      longFired = true;
      el.classList.remove('pressing');
      flagCell(r, c);
    }, LONG_PRESS_MS);
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    // Cancel long press if finger moves significantly
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(pressTimer);
      el.classList.remove('pressing');
    }
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    el.classList.remove('pressing');

    if (longFired) return; // already handled as long press

    const cell = state.grid[r][c];
    if (cell.revealed && cell.adjacent > 0) {
      // Chord reveal on already-revealed numbered cell
      chordReveal(r, c);
    } else {
      revealCell(r, c);
    }
  }, { passive: false });

  el.addEventListener('contextmenu', (e) => e.preventDefault());
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
initGame('easy');

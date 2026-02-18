const SUBGAMES = [
  "carouri",
  "dame",
  "popa_rosu",
  "zece_trefla",
  "whist",
  "totale",
  "rentz",
];

// UI order (fixed), without changing game logic order.
const UI_SUBGAMES_ORDER = [
  "carouri",
  "dame",
  "popa_rosu",
  "zece_trefla",
  "whist",
  "rentz",
  "totale",
];

const SUBGAME_CONFIG = {
  carouri: {
    label: "Carouri",
    icon: "♦",
    hint: "Alege câte carouri a luat fiecare jucător (0–8).",
  },
  dame: {
    label: "Dame",
    icon: "👑",
    hint: "Alege câte dame a luat fiecare jucător (0–4).",
  },
  popa_rosu: {
    label: "Popa Roșu",
    icon: "♥K",
    hint: "Selectează jucătorul care a luat Popa Roșu.",
  },
  zece_trefla: {
    label: "10 de trefla",
    icon: "♣10",
    hint: "Selectează jucătorul care a luat 10 de trefla.",
  },
  whist: {
    label: "Whist",
    icon: "🃏",
    hint: "Alege câte levate a făcut fiecare jucător (0–8).",
  },
  totale: {
    label: "Totale",
    icon: "∑",
    hint: "Introdu manual punctajul pentru fiecare jucător.",
  },
  rentz: {
    label: "Rentz",
    icon: "👑",
    hint: "Atribuie fiecărui jucător un loc unic (1–4).",
  },
};

let players = [];
let currentPlayerIndex = 0;
let activeSubgameKey = null;
let rounds = [];

// UI-only: previous values for micro animations (does not affect game logic)
let __prevScores = new Map();
let __prevScoreboard = new Map();


const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const startForm = document.getElementById("startForm");

const scoreboardList = document.getElementById("scoreboardList");
const playersArea = document.getElementById("playersArea");


let gameTimerSeconds = 0;
let gameTimerInterval = null;
let gameTimerRunning = false;

const gameTimerContainer = document.getElementById("gameTimerContainer");
const gameTimerValue = document.getElementById("gameTimerValue");
const gameTimerToggle = document.getElementById("gameTimerToggle");

function updateGameTimerDisplay() {
  if (!gameTimerValue) return;
  const hours = Math.floor(gameTimerSeconds / 3600);
  const minutes = Math.floor((gameTimerSeconds % 3600) / 60);
  const seconds = gameTimerSeconds % 60;

  let text = "";
  if (hours > 0) {
    text =
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");
  } else {
    text =
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");
  }
  gameTimerValue.textContent = text;
}

function startGameTimer(initialSeconds = 0, shouldRun = true) {
  if (!gameTimerValue) return;
  gameTimerSeconds = typeof initialSeconds === "number" && initialSeconds > 0 ? initialSeconds : 0;
  gameTimerRunning = !!shouldRun;
  updateGameTimerDisplay();
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  gameTimerInterval = setInterval(() => {
    if (!gameTimerRunning) return;
    gameTimerSeconds += 1;
    updateGameTimerDisplay();
  }, 1000);
  if (gameTimerToggle) {
    gameTimerToggle.textContent = gameTimerRunning ? "Pauză" : "Continuă";
  }
  if (gameTimerContainer) {
    gameTimerContainer.classList.remove("hidden");
  }
}

function togglePauseGameTimer() {
  if (!gameTimerToggle) return;
  if (!gameTimerRunning) {
    gameTimerRunning = true;
    gameTimerToggle.textContent = "Pauză";
  } else {
    gameTimerRunning = false;
    gameTimerToggle.textContent = "Continuă";
  }
}

function stopGameTimer() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  gameTimerRunning = false;
}

function resetGameTimer() {
  stopGameTimer();
  gameTimerSeconds = 0;
  updateGameTimerDisplay();
  if (gameTimerContainer) {
    gameTimerContainer.classList.add("hidden");
  }
  if (gameTimerToggle) {
    gameTimerToggle.textContent = gameTimerRunning ? "Pauză" : "Continuă";
  }
}

const GAME_STATE_KEY = "rentzGameStateV1";

function getCurrentGameState() {
  if (!players || !players.length) return null;
  try {
    return {
      players: players.map((p, index) => ({
        id: typeof p.id === "number" ? p.id : index,
        name: p.name,
        score: typeof p.score === "number" ? p.score : 0,
        availableSubgames: Array.isArray(p.availableSubgames)
          ? p.availableSubgames.slice()
          : [],
      })),
      currentPlayerIndex:
        typeof currentPlayerIndex === "number" ? currentPlayerIndex : 0,
      rounds: Array.isArray(rounds)
        ? rounds.map((r) => ({
            chooserId:
              typeof r.chooserId === "number" ? r.chooserId : 0,
            subgameKey: r.subgameKey,
            deltas: Array.isArray(r.deltas) ? r.deltas.slice() : [],
          }))
        : [],
      timer: {
        seconds:
          typeof gameTimerSeconds === "number" ? gameTimerSeconds : 0,
        running: !!gameTimerRunning,
      },
    };
  } catch (e) {
    return null;
  }
}

function saveGameState() {
  try {
    const state = getCurrentGameState();
    if (!state) {
      localStorage.removeItem(GAME_STATE_KEY);
      return;
    }
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
}

function clearSavedGameState() {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch (e) {}
}

function getSavedGameState() {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.players) || !data.players.length) {
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function applyGameState(state) {
  if (!state || !Array.isArray(state.players)) return;

  // Rebuild players
  players = state.players.map((p, index) => {
    const baseId = typeof p.id === "number" ? p.id : index;
    const safeName =
      typeof p.name === "string" && p.name.trim()
        ? p.name
        : `Jucător ${index + 1}`;
    const safeScore = typeof p.score === "number" ? p.score : 0;
    let available = Array.isArray(p.availableSubgames)
      ? p.availableSubgames.filter((key) => SUBGAMES.includes(key))
      : [];
    if (!available.length) {
      available = [...SUBGAMES];
    }
    return {
      id: baseId,
      name: safeName,
      score: safeScore,
      availableSubgames: available,
    };
  });

  // Current player index
  currentPlayerIndex =
    typeof state.currentPlayerIndex === "number"
      ? state.currentPlayerIndex
      : 0;
  if (
    currentPlayerIndex < 0 ||
    currentPlayerIndex >= players.length
  ) {
    currentPlayerIndex = 0;
  }

  // Rounds
  if (Array.isArray(state.rounds)) {
    rounds = state.rounds
      .map((r) => {
        if (!SUBGAMES.includes(r.subgameKey)) return null;
        const deltas =
          Array.isArray(r.deltas) && r.deltas.length === players.length
            ? r.deltas.map((d) =>
                typeof d === "number" ? d : 0
              )
            : new Array(players.length).fill(0);
        return {
          chooserId:
            typeof r.chooserId === "number" ? r.chooserId : 0,
          subgameKey: r.subgameKey,
          deltas,
        };
      })
      .filter(Boolean);
  } else {
    rounds = [];
  }

  // Restore timer
  const timer = state.timer || {};
  const seconds =
    typeof timer.seconds === "number" && timer.seconds > 0
      ? timer.seconds
      : 0;
  const running =
    typeof timer.running === "boolean" ? timer.running : true;

  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  startGameTimer(seconds, running);

  renderScoreboard();
  renderGlobalProgress();
  
  renderPlayersArea();
}


const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalHint = document.getElementById("modalHint");
const modalContent = document.getElementById("modalContent");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");


const endGameOverlay = document.getElementById("endGameOverlay");
const endGameContent = document.getElementById("endGameContent");
const newGameButton = document.getElementById("newGameButton");

const reportOverlay = document.getElementById("reportOverlay");
const reportTitle = document.getElementById("reportTitle");
const reportContent = document.getElementById("reportContent");
const closeReportButton = document.getElementById("closeReportButton");
const openReportChoicesButton = document.getElementById("openReportChoices");
const openReportSubgamesButton = document.getElementById("openReportSubgames");

const topNewGameButton = document.getElementById("topNewGameButton");

document.addEventListener("DOMContentLoaded", () => {
  startForm.addEventListener("submit", handleStartGame);
  if (gameTimerToggle) {
    gameTimerToggle.addEventListener("click", togglePauseGameTimer);
  }

  // Întreabă dacă reluăm un joc salvat
  const savedState = getSavedGameState();
  if (savedState) {
    try {
      const shouldRestore = window.confirm(
        "Ai un joc de Rentz în desfășurare. Vrei să îl reiei?"
      );
      if (shouldRestore) {
        applyGameState(savedState);
      } else {
        clearSavedGameState();
      }
    } catch (e) {
      // dacă confirm e blocat, ignorăm
    }
  }

  modalCancel.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalConfirm.addEventListener("click", handleModalConfirm);
  newGameButton.addEventListener("click", resetToStart);
  topNewGameButton.addEventListener("click", resetToStart);

  if (openReportChoicesButton) {
    openReportChoicesButton.addEventListener("click", () => {
      openLiveReport("choices");
    });
  }
  if (openReportSubgamesButton) {
    openReportSubgamesButton.addEventListener("click", () => {
      openLiveReport("subgames");
    });
  }
  if (closeReportButton && reportOverlay) {
    closeReportButton.addEventListener("click", () => {
      reportOverlay.classList.add("hidden");
    });
    reportOverlay.addEventListener("click", (e) => {
      if (e.target === reportOverlay) {
        reportOverlay.classList.add("hidden");
      }
    });
  }

  playersArea.addEventListener("click", (event) => {
    const pill = event.target.closest(".subgame-row, .subgame-pill");
    if (!pill) return;
    const subgameKey = pill.dataset.subgame;
    const playerIndex = parseInt(pill.dataset.playerIndex, 10);
    if (playerIndex !== currentPlayerIndex) return;
    openSubgameModal(subgameKey);
  });

  modalContent.addEventListener("click", (event) => {
    const chip = event.target.closest(".value-chip");
    if (!chip) return;
    const row = chip.closest(".modal-row") || modalContent;
    row.querySelectorAll(".value-chip").forEach((c) =>
      c.classList.remove("selected")
    );
    chip.classList.add("selected");
  });
});

function handleStartGame(event) {
  event.preventDefault();
  const p1 = document.getElementById("player1").value.trim() || "Jucător 1";
  const p2 = document.getElementById("player2").value.trim() || "Jucător 2";
  const p3 = document.getElementById("player3").value.trim() || "Jucător 3";
  const p4 = document.getElementById("player4").value.trim() || "Jucător 4";

  players = [
    { id: 0, name: p1, score: 0, availableSubgames: [...SUBGAMES] },
    { id: 1, name: p2, score: 0, availableSubgames: [...SUBGAMES] },
    { id: 2, name: p3, score: 0, availableSubgames: [...SUBGAMES] },
    { id: 3, name: p4, score: 0, availableSubgames: [...SUBGAMES] },
  ];

  currentPlayerIndex = 0;
  activeSubgameKey = null;
  rounds = [];

  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  startGameTimer();

  renderScoreboard();
  renderGlobalProgress();
  
  renderPlayersArea();
  saveGameState();
}

function renderScoreboard() {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  scoreboardList.innerHTML = "";
  const leaderScore = sorted.length ? sorted[0].score : 0;

  sorted.forEach((player, index) => {
    const isLast = index===sorted.length-1;
    const li = document.createElement("li");
    li.className = "scoreboard-item" + (index === 0 ? " leader" : "");

    const deltaLeader = player.score - leaderScore; // 0 for leader, negative for others (usually)
    const prev = __prevScoreboard.get(player.id);
    const changed = typeof prev === "number" && prev !== player.score;
    __prevScoreboard.set(player.id, player.score);

    // gap vs above (helps understand how far to climb one position)
    let deltaAbove = null;
    if (index > 0) deltaAbove = player.score - sorted[index - 1].score;

    li.innerHTML = `
      <span class="scoreboard-rank">${index + 1}.</span>
      <span class="scoreboard-name">${escapeHtml(player.name)}</span>
      <span class="scoreboard-meta">
        ${index === 0 ? "" : `<span class="scoreboard-delta">(${deltaLeader})</span>`}
        ${deltaAbove === null ? "" : `<span class="scoreboard-gap">${deltaAbove}</span>`}
      </span>
      <span class="scoreboard-score ${changed ? "score-flip" : ""}">${player.score}</span> <span class="score-trend">${(typeof prev==="number")?(player.score>prev?"↑":(player.score<prev?"↓":"")):""}</span>
    `;
    scoreboardList.appendChild(li);
    const scoreEl = li.querySelector('.scoreboard-score');
    const prevVal = __prevScoreboard.get(player.id);
    if(prevVal!==undefined && prevVal!==player.score){ animateNumber(scoreEl, prevVal, player.score, 320); }
  });
}

function getPlayerRank(playerId) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const index = sorted.findIndex((p) => p.id === playerId);
  return index >= 0 ? index + 1 : null;
}

function renderPlayersArea() {
  playersArea.innerHTML = "";
  // Focus mode: dim non-active players (UI only)
  playersArea.classList.add("focus-mode");

  players.forEach((player, idx) => {
    const card = document.createElement("article");
    const isCurrent = idx === currentPlayerIndex;
    const rank = getPlayerRank(player.id);
    card.className = "player-card" + (isCurrent ? " current-turn" : "");

    const availableSet = new Set(
      Array.isArray(player.availableSubgames) ? player.availableSubgames : []
    );

    const prevScore = __prevScores.get(player.id);
    const scoreChanged = typeof prevScore === "number" && prevScore !== player.score;
    __prevScores.set(player.id, player.score);

    
    const toPlay = [];
    const played = [];
    UI_SUBGAMES_ORDER.forEach((key) => {
      const cfg = SUBGAME_CONFIG[key];
      if (!cfg) return;
      const isAvailable = availableSet.has(key);
      const row = `
          <button
            type="button"
            class="subgame-row${isAvailable ? "" : " disabled played"}"
            data-subgame="${key}"
            data-player-index="${idx}"
            ${isAvailable ? "" : "disabled"}
          >
            <span class="sg-dot" aria-hidden="true"></span>
            <span class="sg-label">
              <strong class="sg-icon">${cfg.icon}</strong>
              <span class="sg-text">${cfg.label}</span>
            </span>
            <span class="sg-action">›</span>
          </button>
        `;
      if (isAvailable) toPlay.push(row);
      else played.push(row);
    });

    const subgamesHtml = `
      <div class="sg-section">
        <div class="sg-section-title">De jucat</div>
        ${toPlay.join("")}
      </div>
      <div class="sg-section sg-played">
        <div class="sg-section-title">Jucate</div>
        ${played.join("")}
      </div>
    `;

    card.innerHTML = `
      <div class="player-header">
        <div class="player-title-row">
          <div class="player-name">${escapeHtml(player.name)}</div>
          <span class="score-chip ${scoreChanged ? "score-flip" : ""}">${player.score}</span>
        </div>
        <div class="player-badge-row">
          ${rank ? `<span class="rank-badge">Locul ${rank}</span>` : ""}
          
        </div>
      </div>

      <div class="timeline-wrap">
        ${subgamesHtml}
      </div>
    `;

    playersArea.appendChild(card);
  const allDone = players.every(p=>Array.isArray(p.availableSubgames)&&p.availableSubgames.length===0);
  document.body.classList.toggle('game-finished', allDone);

  });
}

function openSubgameModal(subgameKey) {
  activeSubgameKey = subgameKey;
  const currentPlayer = players[currentPlayerIndex];
  const cfg = SUBGAME_CONFIG[subgameKey];
  if (!cfg) return;
  modalTitle.textContent = `Rundă ${cfg.label} aleasă de ${currentPlayer.name}`;
  modalHint.textContent = cfg.hint || "";

  switch (subgameKey) {
    case "carouri":
      buildCarouriModal();
      break;
    case "dame":
      buildDameModal();
      break;
    case "whist":
      buildWhistModal();
      break;
    case "popa_rosu":
      buildPopaRosuModal();
      break;
    case "zece_trefla":
      buildZeceTreflaModal();
      break;
    case "totale":
      buildTotaleModal();
      break;
    case "rentz":
      buildRentzModal();
      break;
  }

  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalContent.innerHTML = "";
  modalHint.textContent = "";
  activeSubgameKey = null;
}

function numberChipsHtml(max) {
  let html = '<div class="value-chip-row">';
  for (let i = 0; i <= max; i++) {
    html += `<button type="button" class="value-chip${
      i === 0 ? " selected" : ""
    }" data-value="${i}">${i}</button>`;
  }
  html += "</div>";
  return html;
}

function rentzChipsHtml() {
  let html = '<div class="value-chip-row">';
  for (let i = 1; i <= 4; i++) {
    html += `<button type="button" class="value-chip place-${i}" data-value="${i}">${i}</button>`;
  }
  html += "</div>";
  return html;
}

function buildCarouriModal() {
  modalContent.innerHTML = players
    .map(
      (p) => `
      <div class="modal-row" data-player-index="${p.id}">
        <div class="modal-player-name">${escapeHtml(p.name)}</div>
        <div class="modal-input-container">
          ${numberChipsHtml(8)}
        </div>
      </div>
    `
    )
    .join("");
}

function buildDameModal() {
  modalContent.innerHTML = players
    .map(
      (p) => `
      <div class="modal-row" data-player-index="${p.id}">
        <div class="modal-player-name">${escapeHtml(p.name)}</div>
        <div class="modal-input-container">
          ${numberChipsHtml(4)}
        </div>
      </div>
    `
    )
    .join("");
}

function buildWhistModal() {
  modalContent.innerHTML = players
    .map(
      (p) => `
      <div class="modal-row" data-player-index="${p.id}">
        <div class="modal-player-name">${escapeHtml(p.name)}</div>
        <div class="modal-input-container">
          ${numberChipsHtml(8)}
        </div>
      </div>
    `
    )
    .join("");
}

function buildPopaRosuModal() {
  const chips = players
    .map(
      (p) =>
        `<button type="button" class="value-chip player-chip" data-player-index="${p.id}">${escapeHtml(
          p.name
        )}</button>`
    )
    .join("");
  modalContent.innerHTML = `
    <div class="modal-row">
      <div class="modal-player-name">Alege jucătorul</div>
      <div class="modal-input-container">
        <div class="value-chip-row">
          ${chips}
        </div>
      </div>
    </div>
  `;
}

function buildZeceTreflaModal() {
  const chips = players
    .map(
      (p) =>
        `<button type="button" class="value-chip player-chip" data-player-index="${p.id}">${escapeHtml(
          p.name
        )}</button>`
    )
    .join("");
  modalContent.innerHTML = `
    <div class="modal-row">
      <div class="modal-player-name">Alege jucătorul</div>
      <div class="modal-input-container">
        <div class="value-chip-row">
          ${chips}
        </div>
      </div>
    </div>
  `;
}

function buildTotaleModal() {
  modalContent.innerHTML = players
    .map(
      (p) => `
      <div class="modal-row" data-player-index="${p.id}">
        <div class="modal-player-name">${escapeHtml(p.name)}</div>
        <div class="modal-input-container">
          <input type="number" class="modal-input" />
          <span>puncte</span>
        </div>
      </div>
    `
    )
    .join("");
}

function buildRentzModal() {
  modalContent.innerHTML = players
    .map(
      (p) => `
      <div class="modal-row" data-player-index="${p.id}">
        <div class="modal-player-name">${escapeHtml(p.name)}</div>
        <div class="modal-input-container">
          ${rentzChipsHtml()}
        </div>
      </div>
    `
    )
    .join("");
}

function handleModalConfirm() {
  if (!activeSubgameKey) return;
  let deltas = new Array(players.length).fill(0);
  let valid = true;

  switch (activeSubgameKey) {
    case "carouri":
      valid = applyCarouriDeltas(deltas);
      break;
    case "dame":
      valid = applyDameDeltas(deltas);
      break;
    case "whist":
      valid = applyWhistDeltas(deltas);
      break;
    case "popa_rosu":
      valid = applyPopaRosuDeltas(deltas);
      break;
    case "zece_trefla":
      valid = applyZeceTreflaDeltas(deltas);
      break;
    case "totale":
      valid = applyTotaleDeltas(deltas);
      break;
    case "rentz":
      valid = applyRentzDeltas(deltas);
      break;
  }

  if (!valid) return;

  rounds.push({
    chooserId: currentPlayerIndex,
    subgameKey: activeSubgameKey,
    deltas: deltas.slice(),
  });

  players.forEach((p, idx) => {
    p.score += deltas[idx];
  });


  const currentPlayer = players[currentPlayerIndex];
  currentPlayer.availableSubgames = currentPlayer.availableSubgames.filter(
    (key) => key !== activeSubgameKey
  );

  closeModal();
  renderScoreboard();
  renderGlobalProgress();
  
  renderPlayersArea();

  if (isGameFinished()) {
    showEndGameScreen();
  } else {
    advanceTurn();
    saveGameState();
  }
}

function applyCarouriDeltas(deltas) {
  const rows = modalContent.querySelectorAll(".modal-row");
  rows.forEach((row) => {
    const idx = parseInt(row.dataset.playerIndex, 10);
    const sel = row.querySelector(".value-chip.selected");
    const value = sel ? parseInt(sel.dataset.value || "0", 10) : 0;
    deltas[idx] = value * -20;
  });
  return true;
}

function applyDameDeltas(deltas) {
  const rows = modalContent.querySelectorAll(".modal-row");
  rows.forEach((row) => {
    const idx = parseInt(row.dataset.playerIndex, 10);
    const sel = row.querySelector(".value-chip.selected");
    const value = sel ? parseInt(sel.dataset.value || "0", 10) : 0;
    deltas[idx] = value * -30;
  });
  return true;
}

function applyWhistDeltas(deltas) {
  const rows = modalContent.querySelectorAll(".modal-row");
  rows.forEach((row) => {
    const idx = parseInt(row.dataset.playerIndex, 10);
    const sel = row.querySelector(".value-chip.selected");
    const value = sel ? parseInt(sel.dataset.value || "0", 10) : 0;
    deltas[idx] = value * 20;
  });
  return true;
}

function applyPopaRosuDeltas(deltas) {
  const chip = modalContent.querySelector(".player-chip.selected");
  if (!chip) {
    alert("Selectează jucătorul care a luat Popa Roșu.");
    return false;
  }
  const idx = parseInt(chip.dataset.playerIndex, 10);
  deltas[idx] = -100;
  return true;
}

function applyZeceTreflaDeltas(deltas) {
  const chip = modalContent.querySelector(".player-chip.selected");
  if (!chip) {
    alert("Selectează jucătorul care a luat 10 de trefla.");
    return false;
  }
  const idx = parseInt(chip.dataset.playerIndex, 10);
  deltas[idx] = 100;
  return true;
}

function applyTotaleDeltas(deltas) {
  const rows = modalContent.querySelectorAll(".modal-row");
  rows.forEach((row) => {
    const idx = parseInt(row.dataset.playerIndex, 10);
    const input = row.querySelector(".modal-input");
    const raw = parseInt(input.value, 10);
    if (isNaN(raw)) {
      deltas[idx] = 0;
    } else {
      // Totale acceptă doar puncte negative: orice valoare pozitivă este inversată automat
      const negativeValue = raw > 0 ? -raw : raw;
      deltas[idx] = negativeValue;
    }
  });
  return true;
}

function applyRentzDeltas(deltas) {
  const rows = modalContent.querySelectorAll(".modal-row");
  const places = [];
  const used = new Set();

  rows.forEach((row, rowIndex) => {
    const sel = row.querySelector(".value-chip.selected");
    if (!sel) {
      places[rowIndex] = null;
    } else {
      const place = parseInt(sel.dataset.value || "0", 10);
      places[rowIndex] = place;
      if (used.has(place)) {
        used.add("dup");
      } else {
        used.add(place);
      }
    }
  });

  if (
    places.length !== 4 ||
    !places.every((p) => typeof p === "number" && p >= 1 && p <= 4)
  ) {
    alert("Atribuie fiecărui jucător un loc unic de la 1 la 4.");
    return false;
  }

  if (used.has("dup") || used.size !== 4) {
    alert("Fiecare loc (1, 2, 3, 4) poate fi folosit o singură dată.");
    return false;
  }

  const pointsByPlace = { 1: 400, 2: 300, 3: 200, 4: 100 };
  rows.forEach((row, rowIndex) => {
    const idx = parseInt(row.dataset.playerIndex, 10);
    const place = places[rowIndex];
    deltas[idx] = pointsByPlace[place] || 0;
  });
  return true;
}

function advanceTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  renderPlayersArea();
}

function isGameFinished() {
  return players.every((p) => p.availableSubgames.length === 0);
}


function buildChoicesReportHtml() {
  return `
    <div>
      <div class="endgame-section-title">Raport pe alegeri</div>
      ${players
        .map((p, pIndex) => {
          const lines = players
            .map((chooser, chooserIndex) => {
              let total = 0;
              rounds.forEach((r) => {
                if (r.chooserId === chooserIndex) {
                  total += r.deltas[pIndex] || 0;
                }
              });
              return `<li>Pe alegerile lui ${escapeHtml(
                chooser.name
              )} a luat: ${total} puncte</li>`;
            })
            .join("");
          return `
            <div class="final-report-card">
              <div class="final-report-name">${escapeHtml(p.name)}</div>
              <ul class="final-report-list">
                ${lines}
              </ul>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildSubgamesReportHtml() {
  return `
    <div>
      <div class="endgame-section-title">Raport pe sub-jocuri</div>
      ${players
        .map((p, pIndex) => {
          const lines = Object.keys(SUBGAME_CONFIG)
            .map((key) => {
              let total = 0;
              rounds.forEach((r) => {
                if (r.subgameKey === key) {
                  total += r.deltas[pIndex] || 0;
                }
              });
              const label = SUBGAME_CONFIG[key].label;
              return `<li>La ${label}: ${total} puncte</li>`;
            })
            .join("");
          return `
            <div class="final-report-card">
              <div class="final-report-name">${escapeHtml(p.name)}</div>
              <ul class="final-report-list">
                ${lines}
              </ul>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function openLiveReport(mode) {
  if (!reportOverlay || !reportContent || !reportTitle) return;
  if (!players.length) return;

  if (mode === "subgames") {
    reportTitle.textContent = "Raport pe sub-jocuri (live)";
    reportContent.innerHTML = buildSubgamesReportHtml();
  } else {
    reportTitle.textContent = "Raport pe alegeri (live)";
    reportContent.innerHTML = buildChoicesReportHtml();
  }
  reportOverlay.classList.remove("hidden");
}

function showEndGameScreen() {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  let rankingHtml = `
    <div>
      <div class="endgame-section-title">Clasament final</div>
      ${sorted
        .map((p, index) => {
          const isWinner = index === 0;
          return `
            <div class="endgame-item ${isWinner ? "winner" : ""}">
              <span class="endgame-name">
                ${escapeHtml(p.name)}
                ${
                  isWinner
                    ? '<span class="winner-badge">Campion 🏆</span>'
                    : ""
                }
              </span>
              <span class="endgame-score">${p.score}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  
let reportHtml = `
    <div>
      <div class="endgame-toggle">
        <button class="endgame-toggle-btn active" data-report="choices">Raport pe alegeri</button>
        <button class="endgame-toggle-btn" data-report="subgames">Raport pe sub-jocuri</button>
      </div>
      <div id="report-choices">
        <div class="endgame-section-title">Raport final pe alegeri</div>
        ${players
          .map((p, pIndex) => {
            const lines = players
              .map((chooser, chooserIndex) => {
                let total = 0;
                rounds.forEach((r) => {
                  if (r.chooserId === chooserIndex) {
                    total += r.deltas[pIndex] || 0;
                  }
                });
                return `<li>Pe alegerile lui ${escapeHtml(
                  chooser.name
                )} a luat: ${total} puncte</li>`;
              })
              .join("");
            return `
              <div class="final-report-card">
                <div class="final-report-name">${escapeHtml(p.name)}</div>
                <ul class="final-report-list">
                  ${lines}
                </ul>
              </div>
            `;
          })
          .join("")}
      </div>
      <div id="report-subgames" class="hidden">
        <div class="endgame-section-title">Raport final pe sub-jocuri</div>
        ${players
          .map((p, pIndex) => {
            const lines = Object.keys(SUBGAME_CONFIG)
              .map((key) => {
                let total = 0;
                rounds.forEach((r) => {
                  if (r.subgameKey === key) {
                    total += r.deltas[pIndex] || 0;
                  }
                });
                const label = SUBGAME_CONFIG[key].label;
                return `<li>La ${label}: ${total} puncte</li>`;
              })
              .join("");
            return `
              <div class="final-report-card">
                <div class="final-report-name">${escapeHtml(p.name)}</div>
                <ul class="final-report-list">
                  ${lines}
                </ul>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  endGameContent.innerHTML = rankingHtml + reportHtml;
  const toggleButtons = endGameContent.querySelectorAll(".endgame-toggle-btn");
  const choicesSection = endGameContent.querySelector("#report-choices");
  const subgamesSection = endGameContent.querySelector("#report-subgames");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.report;
      if (mode === "choices") {
        choicesSection.classList.remove("hidden");
        subgamesSection.classList.add("hidden");
      } else {
        choicesSection.classList.add("hidden");
        subgamesSection.classList.remove("hidden");
      }
    });
  });
  endGameOverlay.classList.remove("hidden");
  stopGameTimer();
  clearSavedGameState();
}

function resetToStart() {
  endGameOverlay.classList.add("hidden");
  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  resetGameTimer();
  players = [];
  rounds = [];
  currentPlayerIndex = 0;
  activeSubgameKey = null;
  scoreboardList.innerHTML = "";
  playersArea.innerHTML = "";
  clearSavedGameState();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


const THEME_KEY = "rentzTheme";
function safeGetTheme(){
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}
function safeSetTheme(value){
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch (e) {}
}

const themeBtn=document.getElementById("themeToggle");
if(themeBtn){
 const saved=safeGetTheme();
 if(saved==="gold") document.documentElement.classList.add("theme-gold");
 themeBtn.addEventListener("click",()=>{
   const root=document.documentElement;
   if(root.classList.contains("theme-gold")){
     root.classList.remove("theme-gold");
     localStorage.setItem("rentzTheme","default");
   } else {
     root.classList.add("theme-gold");
     localStorage.setItem("rentzTheme","gold");
   }
 });
}

const aspectBtn=document.getElementById("aspectButton");
if(aspectBtn){
  const saved=safeGetTheme();
  if(saved==="gold") document.documentElement.classList.add("theme-gold");
  aspectBtn.addEventListener("click",()=>{
    const root=document.documentElement;
    if(root.classList.contains("theme-gold")){
      root.classList.remove("theme-gold");
      safeSetTheme("default");
    } else {
      root.classList.add("theme-gold");
      safeSetTheme("gold");
    }
  });
}

function animateNumber(el, from, to, duration=300){
  const start=performance.now();
  function frame(t){
    const p=Math.min(1,(t-start)/duration);
    const val=Math.round(from+(to-from)*p);
    el.textContent=val;
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderGlobalProgress() {
  const total = UI_SUBGAMES_ORDER.length;
  if (!players || !players.length) return;

  // average played rounds per player (UI only)
  let playedCount = 0;
  players.forEach((p) => {
    if (Array.isArray(p.availableSubgames)) {
      playedCount += total - p.availableSubgames.length;
    }
  });
  const playedAvg = Math.round(playedCount / players.length);
  const pct = Math.min(100, Math.max(0, Math.round((playedAvg / total) * 100)));

  let el = document.getElementById("globalProgress");
  if (!el) {
    el = document.createElement("div");
    el.id = "globalProgress";
    el.className = "global-progress";
    const sb = document.getElementById("scoreboard");
    if (sb) sb.appendChild(el);
  }
  el.innerHTML = `
    <div class="gp-bar" aria-hidden="true"><div class="gp-fill" style="width:${pct}%"></div></div>
    <div class="gp-text">${playedAvg} / ${total} runde</div>
  `;
}



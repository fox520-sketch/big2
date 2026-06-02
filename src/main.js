import { createNewGame, passTurn, playCards, runAITurn } from './game-state.js';
import { applyTheme, getSavedTheme } from './themes.js';
import { clearSelection, getSelectedCards, render } from './ui.js';

let gameState = createNewGame();
let aiTimer = null;

function scheduleAIIfNeeded() {
  window.clearTimeout(aiTimer);
  if (gameState.finished) return;
  const current = gameState.players[gameState.currentTurnSeat];
  if (!current.isHuman) {
    aiTimer = window.setTimeout(() => {
      gameState = runAITurn(gameState);
      clearSelection();
      render(gameState);
      scheduleAIIfNeeded();
    }, 650);
  }
}

function resetGame() {
  gameState = createNewGame();
  clearSelection();
  render(gameState);
  scheduleAIIfNeeded();
}

function bindEvents() {
  document.getElementById('newGameBtn').addEventListener('click', resetGame);

  document.getElementById('playBtn').addEventListener('click', () => {
    const selected = getSelectedCards(gameState);
    if (!selected.length) {
      gameState.message = '請先選擇要出的牌。';
      render(gameState);
      return;
    }
    gameState = playCards(gameState, 0, selected);
    if (gameState.lastAction?.type === 'PLAY' && gameState.lastAction.seat === 0) {
      clearSelection();
    }
    render(gameState);
    scheduleAIIfNeeded();
  });

  document.getElementById('passBtn').addEventListener('click', () => {
    gameState = passTurn(gameState, 0);
    clearSelection();
    render(gameState);
    scheduleAIIfNeeded();
  });

  const themeSelect = document.getElementById('themeSelect');
  themeSelect.value = applyTheme(getSavedTheme());
  themeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
  });
}

bindEvents();
render(gameState);
scheduleAIIfNeeded();

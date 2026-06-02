import { DEFAULT_AI_LEVEL } from './constants.js';
import { createNewGame, passTurn, playCards, runAITurn, setAILevel } from './game-state.js';
import { applyTheme, getSavedTheme } from './themes.js';
import { clearSelection, getSelectedCards, render, renderThemeNote } from './ui.js';

const AI_LEVEL_KEY = 'big2-ai-level';
let gameState = createNewGame({ aiLevel: getSavedAILevel() });
let aiTimer = null;

function getSavedAILevel() {
  const saved = Number(localStorage.getItem(AI_LEVEL_KEY));
  if (!Number.isFinite(saved)) return DEFAULT_AI_LEVEL;
  return Math.min(20, Math.max(1, Math.round(saved)));
}

function saveAILevel(level) {
  localStorage.setItem(AI_LEVEL_KEY, String(level));
}

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
    }, 520);
  }
}

function resetGame() {
  const aiLevel = getSavedAILevel();
  gameState = createNewGame({ aiLevel });
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
  const initialTheme = applyTheme(getSavedTheme());
  themeSelect.value = initialTheme;
  renderThemeNote(initialTheme);
  themeSelect.addEventListener('change', (event) => {
    const applied = applyTheme(event.target.value);
    renderThemeNote(applied);
  });

  const aiLevelSelect = document.getElementById('aiLevelSelect');
  aiLevelSelect.value = String(gameState.aiLevel);
  aiLevelSelect.addEventListener('change', (event) => {
    const aiLevel = Number(event.target.value);
    saveAILevel(aiLevel);
    gameState = setAILevel(gameState, aiLevel);
    render(gameState);
    scheduleAIIfNeeded();
  });
}

bindEvents();
render(gameState);
scheduleAIIfNeeded();

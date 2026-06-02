import { DEFAULT_RULES } from './constants.js';
import { getLegalMoves } from './rules.js';

export function chooseAIMove(gameState, aiHand, aiLevel = 1) {
  const legalMoves = getLegalMoves(aiHand, gameState.lastPlay, {
    rules: gameState.rules ?? DEFAULT_RULES,
    requireCardId: gameState.isFirstPlay ? gameState.rules.firstCardId : null
  });

  if (legalMoves.length === 0) return { type: 'PASS' };

  // v0.1.0：簡易 AI，先選最小可出牌。
  // aiLevel 參數保留給 v0.2.0 的 1~20 級難度。
  const chosen = legalMoves[0];

  // 領出時優先丟小單張，避免太早拆大牌型。
  if (!gameState.lastPlay && !gameState.isFirstPlay) {
    const smallSingle = legalMoves.find((move) => move.size === 1);
    return { type: 'PLAY', play: smallSingle ?? chosen, aiLevel };
  }

  return { type: 'PLAY', play: chosen, aiLevel };
}

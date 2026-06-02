import assert from 'node:assert/strict';
import { createNewGame, passTurn, playCards, runAITurn } from '../src/game-state.js';
import { chooseAIMove, getAILevelLabel } from '../src/ai.js';
import { getLegalMoves } from '../src/rules.js';

for (let level = 1; level <= 20; level += 1) {
  const game = createNewGame({ aiLevel: level });
  assert.equal(game.aiLevel, level);
  assert.ok(getAILevelLabel(level).includes(`Lv.${level}`));

  const aiPlayer = game.players.find((player) => !player.isHuman);
  const decision = chooseAIMove(game, aiPlayer.hand, level);
  assert.ok(['PLAY', 'PASS'].includes(decision.type));
}

// 壓力測試：跑多局，AI 不應丟出非法牌或造成流程卡死。
for (let level = 1; level <= 20; level += 1) {
  for (let gameNo = 0; gameNo < 8; gameNo += 1) {
    let game = createNewGame({ aiLevel: level });
    let guard = 0;
    while (!game.finished && guard < 260) {
      const player = game.players[game.currentTurnSeat];
      if (player.isHuman) {
        const legal = getLegalMoves(player.hand, game.lastPlay, {
          rules: game.rules,
          requireCardId: game.isFirstPlay ? game.rules.firstCardId : null
        });
        if (legal.length > 0) game = playCards(game, player.seat, legal[0].cards);
        else game = passTurn(game, player.seat);
      } else {
        game = runAITurn(game);
      }
      guard += 1;
    }
    assert.equal(game.finished, true, `level ${level} game ${gameNo} should finish`);
  }
}

console.log('AI level tests passed.');

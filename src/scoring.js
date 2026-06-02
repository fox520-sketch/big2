import { PLAYERS } from './constants.js';

export function calculateResults(players, winnerSeat) {
  const rows = PLAYERS.map((player) => {
    const remaining = players[player.seat].hand.length;
    return {
      seat: player.seat,
      name: player.name,
      isWinner: player.seat === winnerSeat,
      remaining,
      score: player.seat === winnerSeat ? 0 : -remaining,
      rank: 0
    };
  });

  const loserPenaltyTotal = rows
    .filter((row) => row.seat !== winnerSeat)
    .reduce((sum, row) => sum + row.remaining, 0);

  for (const row of rows) {
    if (row.seat === winnerSeat) row.score = loserPenaltyTotal;
  }

  rows.sort((a, b) => {
    if (a.seat === winnerSeat) return -1;
    if (b.seat === winnerSeat) return 1;
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.seat - b.seat;
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

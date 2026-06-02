export function calculateResults(players, winnerSeat) {
  const rows = players.map((player, index) => {
    const remaining = player.hand.length;
    const seat = Number.isInteger(player.seat) ? player.seat : index;
    return {
      seat,
      name: player.name || `玩家 ${seat + 1}`,
      uid: player.uid || null,
      isAI: Boolean(player.isAI),
      isWinner: seat === winnerSeat,
      remaining,
      score: seat === winnerSeat ? 0 : -remaining,
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

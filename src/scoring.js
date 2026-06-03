import { DEFAULT_SCORING_RULES } from './constants.js';
import { normalizeScoringRules, scoringMultiplier } from './game-settings.js';

function penaltyForRemaining(remaining, scoringRules = DEFAULT_SCORING_RULES) {
  const multiplier = scoringMultiplier(remaining, scoringRules);
  return {
    multiplier,
    penalty: remaining * multiplier,
    label: multiplier > 1 ? `${multiplier} 倍` : '一般'
  };
}

export function calculateResults(players, winnerSeat, scoringRules = DEFAULT_SCORING_RULES) {
  const normalizedScoring = normalizeScoringRules(scoringRules);
  const rows = players.map((player, index) => {
    const remaining = player.hand.length;
    const seat = Number.isInteger(player.seat) ? player.seat : index;
    const penalty = seat === winnerSeat
      ? { multiplier: 1, penalty: 0, label: '勝出' }
      : penaltyForRemaining(remaining, normalizedScoring);
    return {
      seat,
      name: player.name || `玩家 ${seat + 1}`,
      uid: player.uid || null,
      isAI: Boolean(player.isAI),
      isWinner: seat === winnerSeat,
      remaining,
      multiplier: penalty.multiplier,
      penaltyLabel: penalty.label,
      score: seat === winnerSeat ? 0 : -penalty.penalty,
      rank: 0
    };
  });

  const loserPenaltyTotal = rows
    .filter((row) => row.seat !== winnerSeat)
    .reduce((sum, row) => sum + Math.abs(row.score), 0);

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

export function makeEmptyTotals(players = []) {
  const totals = {};
  players.forEach((player, index) => {
    const seat = Number.isInteger(player.seat) ? player.seat : index;
    totals[seat] = {
      seat,
      name: player.name || `玩家 ${seat + 1}`,
      uid: player.uid || null,
      isAI: Boolean(player.isAI),
      totalScore: 0,
      wins: 0,
      games: 0,
      latestRank: null,
      latestScore: 0,
      latestRemaining: null,
      updatedGameNo: 0
    };
  });
  return totals;
}

export function mergeSeriesTotals(currentTotals = {}, results = [], players = [], gameNo = 0) {
  const totals = { ...makeEmptyTotals(players), ...(currentTotals || {}) };

  for (const player of players) {
    const seat = Number.isInteger(player.seat) ? player.seat : players.indexOf(player);
    totals[seat] = {
      ...(totals[seat] || {}),
      seat,
      name: player.name || totals[seat]?.name || `玩家 ${seat + 1}`,
      uid: player.uid || totals[seat]?.uid || null,
      isAI: Boolean(player.isAI),
      totalScore: Number(totals[seat]?.totalScore || 0),
      wins: Number(totals[seat]?.wins || 0),
      games: Number(totals[seat]?.games || 0),
      latestRank: totals[seat]?.latestRank ?? null,
      latestScore: Number(totals[seat]?.latestScore || 0),
      latestRemaining: totals[seat]?.latestRemaining ?? null,
      updatedGameNo: Number(totals[seat]?.updatedGameNo || 0)
    };
  }

  for (const row of results) {
    const seat = Number.isInteger(row.seat) ? row.seat : results.indexOf(row);
    const previous = totals[seat] || {
      seat,
      name: row.name || `玩家 ${seat + 1}`,
      uid: row.uid || null,
      isAI: Boolean(row.isAI),
      totalScore: 0,
      wins: 0,
      games: 0,
      updatedGameNo: 0
    };

    const alreadyApplied = Number(previous.updatedGameNo || 0) === Number(gameNo || 0) && gameNo !== 0;
    totals[seat] = {
      ...previous,
      seat,
      name: row.name || previous.name,
      uid: row.uid || previous.uid || null,
      isAI: Boolean(row.isAI),
      totalScore: Number(previous.totalScore || 0) + (alreadyApplied ? 0 : Number(row.score || 0)),
      wins: Number(previous.wins || 0) + (!alreadyApplied && row.rank === 1 ? 1 : 0),
      games: Number(previous.games || 0) + (alreadyApplied ? 0 : 1),
      latestRank: row.rank,
      latestScore: Number(row.score || 0),
      latestRemaining: Number(row.remaining || 0),
      updatedGameNo: Number(gameNo || previous.updatedGameNo || 0)
    };
  }

  return totals;
}

export function totalsToSortedRows(totals = {}) {
  return Object.values(totals || {}).sort((a, b) => {
    if (Number(b.totalScore || 0) !== Number(a.totalScore || 0)) {
      return Number(b.totalScore || 0) - Number(a.totalScore || 0);
    }
    if (Number(b.wins || 0) !== Number(a.wins || 0)) {
      return Number(b.wins || 0) - Number(a.wins || 0);
    }
    return Number(a.seat || 0) - Number(b.seat || 0);
  }).map((row, index) => ({ ...row, totalRank: index + 1 }));
}

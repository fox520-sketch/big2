import { RANKS, SUITS } from './constants.js';

const rankById = new Map(RANKS.map((rank) => [rank.id, rank]));
const suitById = new Map(SUITS.map((suit) => [suit.id, suit]));

export function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit.id}${rank.id}`,
      suit: suit.id,
      rank: rank.id
    }))
  );
}

export function shuffleDeck(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getRankInfo(card) {
  const rank = rankById.get(card.rank);
  if (!rank) throw new Error(`Unknown rank: ${card.rank}`);
  return rank;
}

export function getSuitInfo(card) {
  const suit = suitById.get(card.suit);
  if (!suit) throw new Error(`Unknown suit: ${card.suit}`);
  return suit;
}

export function cardPower(card) {
  return getRankInfo(card).value * 4 + getSuitInfo(card).value;
}

export function sortCards(cards) {
  return [...cards].sort((a, b) => cardPower(a) - cardPower(b));
}

export function sortCardsDesc(cards) {
  return [...cards].sort((a, b) => cardPower(b) - cardPower(a));
}

export function cardLabel(card) {
  const suit = getSuitInfo(card);
  const rank = getRankInfo(card);
  return `${suit.symbol}${rank.label}`;
}

export function cardLongName(card) {
  const suit = getSuitInfo(card);
  const rank = getRankInfo(card);
  return `${suit.name}${rank.label}`;
}

export function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const key = card.rank;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  return [...groups.values()].sort((a, b) => getRankInfo(a[0]).value - getRankInfo(b[0]).value);
}

export function hasCard(cards, cardId) {
  return cards.some((card) => card.id === cardId);
}

export function removeCards(hand, cardsToRemove) {
  const removeIds = new Set(cardsToRemove.map((card) => card.id));
  return hand.filter((card) => !removeIds.has(card.id));
}

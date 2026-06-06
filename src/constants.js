export const VERSION = '0.8.1';

export const SUITS = [
  { id: 'C', symbol: '♣', name: '梅花', value: 0, color: 'black' },
  { id: 'D', symbol: '♦', name: '方塊', value: 1, color: 'red' },
  { id: 'H', symbol: '♥', name: '紅心', value: 2, color: 'red' },
  { id: 'S', symbol: '♠', name: '黑桃', value: 3, color: 'black' }
];

export const RANKS = [
  { id: '3', label: '3', value: 0 },
  { id: '4', label: '4', value: 1 },
  { id: '5', label: '5', value: 2 },
  { id: '6', label: '6', value: 3 },
  { id: '7', label: '7', value: 4 },
  { id: '8', label: '8', value: 5 },
  { id: '9', label: '9', value: 6 },
  { id: '10', label: '10', value: 7 },
  { id: 'J', label: 'J', value: 8 },
  { id: 'Q', label: 'Q', value: 9 },
  { id: 'K', label: 'K', value: 10 },
  { id: 'A', label: 'A', value: 11 },
  { id: '2', label: '2', value: 12 }
];

export const HAND_TYPES = {
  SINGLE: { id: 'single', name: '單張', size: 1, fivePower: 0 },
  PAIR: { id: 'pair', name: '對子', size: 2, fivePower: 0 },
  TRIPLE: { id: 'triple', name: '三條', size: 3, fivePower: 0 },
  STRAIGHT: { id: 'straight', name: '順子', size: 5, fivePower: 1 },
  FLUSH: { id: 'flush', name: '同花', size: 5, fivePower: 2 },
  FULL_HOUSE: { id: 'fullHouse', name: '葫蘆', size: 5, fivePower: 3 },
  FOUR_KIND: { id: 'fourKind', name: '鐵支', size: 5, fivePower: 4 },
  STRAIGHT_FLUSH: { id: 'straightFlush', name: '同花順', size: 5, fivePower: 5 }
};

export const DEFAULT_RULES = {
  id: 'taiwanC3',
  name: '台灣常用：梅花 3 起手',
  shortName: '梅花 3',
  firstCardId: 'C3',
  firstCardName: '梅花 3',
  allowStraightWithTwo: false,
  allowWheelStraight: false,
  cardOrderText: '2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3',
  suitOrderText: '黑桃 > 紅心 > 方塊 > 梅花',
  fiveCardText: '順子 < 同花 < 葫蘆 < 鐵支 < 同花順',
  note: '第一手必須含梅花 3；順子不含 2。'
};

export const DEFAULT_SCORING_RULES = {
  id: 'standard',
  name: '標準：剩幾張扣幾分',
  shortName: '標準',
  mode: 'standard',
  doubleAt8: false,
  doubleAt10: false,
  tripleAt10: false,
  note: '輸家每剩 1 張扣 1 分，贏家取得所有輸家扣分總和。'
};

export const DEFAULT_AI_LEVEL = 8;

export const PLAYERS = [
  { seat: 0, name: '你', isHuman: true },
  { seat: 1, name: 'AI 左家', isHuman: false },
  { seat: 2, name: 'AI 對家', isHuman: false },
  { seat: 3, name: 'AI 右家', isHuman: false }
];

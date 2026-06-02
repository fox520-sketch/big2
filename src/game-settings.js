import { DEFAULT_RULES, DEFAULT_SCORING_RULES } from './constants.js';

export const RULE_PRESETS = {
  taiwanC3: {
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
    note: '第一手必須含梅花 3；順子不含 2，不開 A2345。'
  },
  taiwanD3: {
    id: 'taiwanD3',
    name: '台灣變體：方塊 3 起手',
    shortName: '方塊 3',
    firstCardId: 'D3',
    firstCardName: '方塊 3',
    allowStraightWithTwo: false,
    allowWheelStraight: false,
    cardOrderText: '2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3',
    suitOrderText: '黑桃 > 紅心 > 方塊 > 梅花',
    fiveCardText: '順子 < 同花 < 葫蘆 < 鐵支 < 同花順',
    note: '部分玩家習慣用方塊 3 起手；其餘大小沿用台灣常見排序。'
  },
  friendlyWheel: {
    id: 'friendlyWheel',
    name: '朋友局：允許 A2345',
    shortName: 'A2345',
    firstCardId: 'C3',
    firstCardName: '梅花 3',
    allowStraightWithTwo: false,
    allowWheelStraight: true,
    cardOrderText: '2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3',
    suitOrderText: '黑桃 > 紅心 > 方塊 > 梅花',
    fiveCardText: '順子 < 同花 < 葫蘆 < 鐵支 < 同花順；A2345 視為最小順',
    note: '允許 A2345，並視為 5 高順；其他含 2 的順子仍不允許。'
  },
  looseTwoStraight: {
    id: 'looseTwoStraight',
    name: '寬鬆變體：順子可含 2',
    shortName: '順子可含 2',
    firstCardId: 'C3',
    firstCardName: '梅花 3',
    allowStraightWithTwo: true,
    allowWheelStraight: true,
    cardOrderText: '2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3',
    suitOrderText: '黑桃 > 紅心 > 方塊 > 梅花',
    fiveCardText: '順子 < 同花 < 葫蘆 < 鐵支 < 同花順；可含 2',
    note: '較寬鬆朋友局，可接受含 2 的連續順與 A2345。'
  }
};

export const SCORING_PRESETS = {
  standard: {
    id: 'standard',
    name: '標準：剩幾張扣幾分',
    shortName: '標準',
    mode: 'standard',
    doubleAt8: false,
    tripleAt10: false,
    note: '輸家每剩 1 張扣 1 分，贏家取得所有輸家扣分總和。'
  },
  double8: {
    id: 'double8',
    name: '8 張以上雙倍',
    shortName: '8 張雙倍',
    mode: 'double8',
    doubleAt8: true,
    tripleAt10: false,
    note: '輸家剩 8 張以上時，該玩家扣分雙倍。'
  },
  double10: {
    id: 'double10',
    name: '10 張以上雙倍',
    shortName: '10 張雙倍',
    mode: 'double10',
    doubleAt8: false,
    tripleAt10: false,
    doubleAt10: true,
    note: '輸家剩 10 張以上時，該玩家扣分雙倍。'
  },
  double8Triple10: {
    id: 'double8Triple10',
    name: '8 張雙倍、10 張三倍',
    shortName: '8雙10三',
    mode: 'double8Triple10',
    doubleAt8: true,
    tripleAt10: true,
    note: '輸家剩 8～9 張雙倍，10 張以上三倍。'
  }
};

export function normalizeRules(rules = {}) {
  const id = rules.id && RULE_PRESETS[rules.id] ? rules.id : DEFAULT_RULES.id;
  return {
    ...RULE_PRESETS[id],
    ...DEFAULT_RULES,
    ...rules,
    id,
    firstCardId: rules.firstCardId || RULE_PRESETS[id]?.firstCardId || DEFAULT_RULES.firstCardId
  };
}

export function getRulePreset(id) {
  return normalizeRules(RULE_PRESETS[id] || RULE_PRESETS[DEFAULT_RULES.id]);
}

export function normalizeScoringRules(scoringRules = {}) {
  const id = scoringRules.id && SCORING_PRESETS[scoringRules.id] ? scoringRules.id : DEFAULT_SCORING_RULES.id;
  return {
    ...SCORING_PRESETS[id],
    ...DEFAULT_SCORING_RULES,
    ...scoringRules,
    id
  };
}

export function getScoringPreset(id) {
  return normalizeScoringRules(SCORING_PRESETS[id] || SCORING_PRESETS[DEFAULT_SCORING_RULES.id]);
}

export function scoringMultiplier(remaining, scoringRules = DEFAULT_SCORING_RULES) {
  const rules = normalizeScoringRules(scoringRules);
  if (remaining >= 10 && rules.tripleAt10) return 3;
  if (remaining >= 10 && rules.doubleAt10) return 2;
  if (remaining >= 8 && rules.doubleAt8) return 2;
  return 1;
}

export function ruleSummary(rules = DEFAULT_RULES) {
  const normalized = normalizeRules(rules);
  return [
    `起手：${normalized.firstCardName || normalized.firstCardId}`,
    `點數：${normalized.cardOrderText}`,
    `花色：${normalized.suitOrderText}`,
    normalized.allowWheelStraight ? '允許 A2345' : '不開 A2345',
    normalized.allowStraightWithTwo ? '順子可含 2' : '順子不可含 2'
  ].join('｜');
}

export function scoringSummary(scoringRules = DEFAULT_SCORING_RULES) {
  const normalized = normalizeScoringRules(scoringRules);
  return `${normalized.name}：${normalized.note}`;
}

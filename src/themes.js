export const THEMES = {
  dark: {
    name: '深色模式',
    note: '黑底高對比，適合手機與 OLED。'
  },
  epaper: {
    name: '電子紙模式',
    note: '純黑白、高邊框、少陰影。'
  },
  ocean: {
    name: '海洋風',
    note: '深海藍底搭配高亮青藍文字。'
  },
  eye: {
    name: '護眼風',
    note: '淡綠與米白底，降低刺眼感。'
  },
  twilight: {
    name: '暮光風',
    note: '紫藍底搭配暖橘主色。'
  },
  sakura: {
    name: '櫻花風',
    note: '淡粉底搭配深玫瑰文字。'
  },
  forest: {
    name: '森林風',
    note: '深綠底與高亮淺綠文字。'
  },
  grassland: {
    name: '草原風',
    note: '明亮草地色系，深色文字。'
  },
  night: {
    name: '夜航風',
    note: '深藍黑底，適合夜間使用。'
  },
  sunset: {
    name: '夕陽風',
    note: '深橘紅底，暖色高對比。'
  },
  starry: {
    name: '星空風',
    note: '黑紫夜空底與柔亮文字。'
  },
  candy: {
    name: '糖果風',
    note: '明亮糖果色，但保留深色文字。'
  },
  neon: {
    name: '霓虹風',
    note: '黑底亮藍霓虹邊框，高對比顯示。'
  }
};

export function applyTheme(themeName) {
  const nextTheme = THEMES[themeName] ? themeName : 'dark';
  document.body.dataset.theme = nextTheme;
  localStorage.setItem('big2-theme', nextTheme);
  return nextTheme;
}

export function getSavedTheme() {
  return localStorage.getItem('big2-theme') || 'dark';
}

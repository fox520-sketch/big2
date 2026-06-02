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

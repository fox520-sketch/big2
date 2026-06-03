const SOUND_KEY = 'big2-sound-enabled';
const SOUND_PREF_KEY = 'big2-sound-preferences';
let audioContext = null;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';

export const SOUND_LABELS = {
  select: '選牌音',
  play: '出牌音',
  pass: 'Pass 音',
  deal: '發牌音',
  win: '勝利音',
  error: '錯誤提示音'
};

const DEFAULT_PREFERENCES = {
  masterVolume: 0.75,
  select: true,
  play: true,
  pass: true,
  deal: true,
  win: true,
  error: true
};

const SOUND_MAP = {
  select: { frequency: 660, duration: 0.045, type: 'triangle', gain: 0.025 },
  play: { frequency: 523, duration: 0.11, type: 'sine', gain: 0.045 },
  pass: { frequency: 220, duration: 0.09, type: 'sawtooth', gain: 0.025 },
  deal: { frequency: 392, duration: 0.08, type: 'triangle', gain: 0.028 },
  win: { frequency: 784, duration: 0.18, type: 'sine', gain: 0.05 },
  error: { frequency: 130, duration: 0.16, type: 'square', gain: 0.026 }
};

function readPreferences() {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(SOUND_PREF_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function writePreferences(prefs) {
  localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(prefs));
  return prefs;
}

export function getSoundPreferences() {
  const prefs = readPreferences();
  prefs.masterVolume = Math.min(1, Math.max(0, Number(prefs.masterVolume ?? DEFAULT_PREFERENCES.masterVolume)));
  return prefs;
}

export function setSoundPreference(key, value) {
  const prefs = getSoundPreferences();
  if (key === 'masterVolume') prefs.masterVolume = Math.min(1, Math.max(0, Number(value)));
  else if (key in DEFAULT_PREFERENCES) prefs[key] = Boolean(value);
  return writePreferences(prefs);
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0');
  return soundEnabled;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }
  return audioContext;
}

export function playSound(type = 'play') {
  if (!soundEnabled) return;
  const prefs = getSoundPreferences();
  if (prefs[type] === false) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const spec = SOUND_MAP[type] || SOUND_MAP.play;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const startAt = ctx.currentTime;
  const endAt = startAt + spec.duration;
  const volume = Math.min(1, Math.max(0, Number(prefs.masterVolume ?? 0.75)));

  oscillator.type = spec.type;
  oscillator.frequency.setValueAtTime(spec.frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, spec.gain * volume), startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

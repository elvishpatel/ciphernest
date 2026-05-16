/**
 * Password Generator Engine
 * Modes: ultra-strong, memorable, passphrase, pin, api-key
 */

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const SAFE_SYMBOLS = '!@#$%&*_+-=?';

const WORDS = [
  'river','candle','tiger','moon','shadow','crystal','ember','frost',
  'blade','storm','nexus','orbit','phantom','cipher','vortex','pulse',
  'nova','drift','echo','flux','zenith','raven','onyx','aurora',
  'summit','thunder','coral','iron','silk','harbor','beacon','forest',
  'delta','prism','cobalt','marble','velvet','opal','cedar','falcon',
  'lotus','meadow','quartz','sapphire','thorn','willow','amber','breeze',
  'canyon','dune','glacier','hawk','ivory','jade','knight','lemon',
  'maple','nectar','olive','pine','ruby','sage','tide','unity',
];

function secureRandom(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function pickRandom(str) {
  return str[secureRandom(str.length)];
}

export function generatePassword(options = {}) {
  const {
    mode = 'strong',
    length = 20,
    includeUpper = true,
    includeLower = true,
    includeDigits = true,
    includeSymbols = true,
    wordCount = 4,
    separator = '-',
    pinLength = 6,
  } = options;

  switch (mode) {
    case 'strong':
    case 'ultra': {
      let chars = '';
      const required = [];
      if (includeLower) { chars += LOWER; required.push(pickRandom(LOWER)); }
      if (includeUpper) { chars += UPPER; required.push(pickRandom(UPPER)); }
      if (includeDigits) { chars += DIGITS; required.push(pickRandom(DIGITS)); }
      if (includeSymbols) { chars += SYMBOLS; required.push(pickRandom(SYMBOLS)); }
      if (!chars) chars = LOWER + UPPER + DIGITS + SYMBOLS;

      const remaining = length - required.length;
      const pass = [...required];
      for (let i = 0; i < remaining; i++) {
        pass.push(pickRandom(chars));
      }
      // Shuffle
      for (let i = pass.length - 1; i > 0; i--) {
        const j = secureRandom(i + 1);
        [pass[i], pass[j]] = [pass[j], pass[i]];
      }
      return pass.join('');
    }

    case 'memorable': {
      const words = [];
      for (let i = 0; i < wordCount; i++) {
        let w = WORDS[secureRandom(WORDS.length)];
        if (i === 0) w = w.charAt(0).toUpperCase() + w.slice(1);
        words.push(w);
      }
      return words.join(separator) + pickRandom(DIGITS) + pickRandom(SAFE_SYMBOLS);
    }

    case 'passphrase': {
      const words = [];
      for (let i = 0; i < wordCount; i++) {
        words.push(WORDS[secureRandom(WORDS.length)]);
      }
      return words.join(separator);
    }

    case 'pin': {
      let pin = '';
      for (let i = 0; i < pinLength; i++) pin += pickRandom(DIGITS);
      return pin;
    }

    case 'api-key': {
      const chars = UPPER + LOWER + DIGITS;
      const segments = [];
      for (let s = 0; s < 4; s++) {
        let seg = '';
        for (let i = 0; i < 8; i++) seg += pickRandom(chars);
        segments.push(seg);
      }
      return segments.join('-');
    }

    default:
      return generatePassword({ ...options, mode: 'strong' });
  }
}

export function calculateEntropy(password) {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  return Math.floor(password.length * Math.log2(pool || 1));
}

export function getStrengthLabel(entropy) {
  if (entropy >= 128) return { label: 'FORTRESS', color: '#00ff88', level: 5 };
  if (entropy >= 80) return { label: 'STRONG', color: '#00f0ff', level: 4 };
  if (entropy >= 60) return { label: 'GOOD', color: '#ffaa00', level: 3 };
  if (entropy >= 40) return { label: 'FAIR', color: '#ff8800', level: 2 };
  return { label: 'WEAK', color: '#ff3355', level: 1 };
}

export function calculateSecurityScore(password) {
  let score = 0;
  if (password.length >= 12) score += 20;
  if (password.length >= 20) score += 10;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;
  if (!/(.)\1{2,}/.test(password)) score += 10;
  if (password.length >= 16) score += 10;
  return Math.min(100, score);
}

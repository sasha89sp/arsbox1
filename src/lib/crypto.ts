// Real Web Crypto API AES-256-GCM + PBKDF2-HMAC-SHA256 (100,000 iterations)

export interface EncryptedBlob {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
}

const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson<T>(data: T, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );
  const blob: EncryptedBlob = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(cipherBuffer)),
  };
  return JSON.stringify(blob);
}

export async function decryptJson<T>(payload: string, password: string): Promise<T> {
  const blob = JSON.parse(payload) as EncryptedBlob;
  if (blob.v !== 1 || blob.alg !== 'AES-256-GCM') {
    throw new Error('Неподдерживаемый формат шифрования');
  }
  const salt = fromBase64(blob.salt);
  const iv = fromBase64(blob.iv);
  const ct = fromBase64(blob.ct);
  const key = await deriveAesKey(password, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  const text = new TextDecoder().decode(plainBuffer);
  return JSON.parse(text) as T;
}

// Atomic write (.tmp -> .bak -> main) and readValid with .bak rollback in localStorage
export function writeAtomicStorage(key: string, value: string): void {
  const tmpKey = `${key}.tmp`;
  const bakKey = `${key}.bak`;
  localStorage.setItem(tmpKey, value);
  const current = localStorage.getItem(key);
  if (current !== null) {
    localStorage.setItem(bakKey, current);
  }
  localStorage.setItem(key, value);
  localStorage.removeItem(tmpKey);
}

export function readValidStorage<T>(key: string): { data: T | null; recoveredFromBak: boolean } {
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return { data: JSON.parse(raw) as T, recoveredFromBak: false };
    } catch {
      // Fallback to .bak
    }
  }
  const bak = localStorage.getItem(`${key}.bak`);
  if (bak) {
    try {
      const parsed = JSON.parse(bak) as T;
      localStorage.setItem(key, bak);
      return { data: parsed, recoveredFromBak: true };
    } catch {
      return { data: null, recoveredFromBak: false };
    }
  }
  return { data: null, recoveredFromBak: false };
}

export interface PasswordGenOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
}

export function generatePassword(opts: PasswordGenOptions): string {
  const similar = /[0Oo1lI|]/g;
  let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let lower = 'abcdefghijklmnopqrstuvwxyz';
  let digits = '0123456789';
  let symbols = '!@#$%^&*()-_=+[]{};:,.?/';
  if (opts.excludeSimilar) {
    upper = upper.replace(similar, '');
    lower = lower.replace(similar, '');
    digits = digits.replace(similar, '');
    symbols = symbols.replace(similar, '');
  }
  const pools: string[] = [];
  if (opts.upper && upper) pools.push(upper);
  if (opts.lower && lower) pools.push(lower);
  if (opts.digits && digits) pools.push(digits);
  if (opts.symbols && symbols) pools.push(symbols);
  if (pools.length === 0) pools.push(lower);

  const combined = pools.join('');
  const len = Math.max(6, Math.min(64, opts.length));
  const randomValues = new Uint32Array(len);
  crypto.getRandomValues(randomValues);

  const chars: string[] = [];
  // Guarantee at least 1 char from each selected pool
  pools.forEach((pool, idx) => {
    if (idx < len) {
      chars.push(pool[randomValues[idx] % pool.length]);
    }
  });
  for (let i = chars.length; i < len; i++) {
    chars.push(combined[randomValues[i] % combined.length]);
  }
  // Fisher-Yates shuffle
  const shuffleRand = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffleRand);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleRand[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function evaluatePasswordStrength(pw: string): {
  level: 'weak' | 'medium' | 'strong';
  label: string;
  score: number;
} {
  if (!pw) return { level: 'weak', label: 'Пустой', score: 0 };
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 20;
  if (pw.length >= 16) score += 10;
  if (/[a-zа-я]/.test(pw)) score += 10;
  if (/[A-ZА-Я]/.test(pw)) score += 10;
  if (/\d/.test(pw)) score += 10;
  if (/[^a-zA-Zа-яА-Я0-9]/.test(pw)) score += 15;
  if (/^(1234|qwerty|password|admin|demo)/i.test(pw)) score = Math.min(score, 25);

  if (score < 45) return { level: 'weak', label: 'Слабый пароль', score };
  if (score < 75) return { level: 'medium', label: 'Средний', score };
  return { level: 'strong', label: 'Надёжный', score: Math.min(100, score) };
}

export function randomKeyFingerprint(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

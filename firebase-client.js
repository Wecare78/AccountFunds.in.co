import DEFAULT_CLOUD_CONFIG from './cloud-config.js';

const NS = 'af_p2_';
const k = (name) => `${NS}${name}`;
const CLOUD_CFG_STORAGE_KEY = k('cloud_config');
const ADMIN_TOKEN_KEY = k('admin_token');

const COLLECTIONS = {
  users: 'af_p2_users',
  utrs: 'af_p2_utrs',
  activityLogs: 'af_p2_activityLogs',
  smsLogs: 'af_p2_smsLogs',
};

const safeId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const sanitizeSafeId = (raw, prefix) =>
  (String(raw || safeId(prefix)).replace(/[^a-zA-Z0-9_-]/g, '-') || safeId(prefix)).slice(0, 120);

const toDocId = (u) =>
  (String(u || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_') || `user_${Date.now()}`).slice(0, 120);

// --------------------------------------------
// Cross-Tab Realtime Channel
// --------------------------------------------
let bc = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('af_p2_realtime_sync');
  }
} catch {
  bc = null;
}

const localListeners = new Set();

function notifyAllLocalListeners(reason = 'update') {
  localListeners.forEach((fn) => {
    try {
      fn(reason);
    } catch {}
  });
  try {
    window.dispatchEvent(new CustomEvent('af-p2-data-updated', { detail: { reason } }));
  } catch {}
}

function broadcastSyncEvent(reason = 'update') {
  notifyAllLocalListeners(reason);
  if (bc) {
    try {
      bc.postMessage({ type: 'af_p2_sync', reason, at: Date.now() });
    } catch {}
  }
}

if (bc) {
  bc.addEventListener('message', (evt) => {
    if (evt && evt.data && evt.data.type === 'af_p2_sync') {
      notifyAllLocalListeners(evt.data.reason || 'broadcast');
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (evt) => {
    if (evt && evt.key && evt.key.startsWith(NS)) {
      notifyAllLocalListeners(`storage:${evt.key}`);
    }
  });
}

// --------------------------------------------
// Local Browser Database Helpers (af_p2_*)
// --------------------------------------------
function readJson(storageKey, fallback) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storageKey, val) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(val));
  } catch {}
}

function getLocalUsersMap() {
  const m = readJson(k('users'), {});
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
}

function saveLocalUsersMap(usersMap) {
  writeJson(k('users'), usersMap || {});
}

function getLocalUtrs() {
  const arr = readJson(k('admin_withdrawals'), []);
  return Array.isArray(arr) ? arr : [];
}

function saveLocalUtrs(list) {
  writeJson(k('admin_withdrawals'), Array.isArray(list) ? list.slice(0, 300) : []);
}

function getLocalActivityLogs() {
  const arr = readJson(k('admin_activity_logs'), []);
  return Array.isArray(arr) ? arr : [];
}

function saveLocalActivityLogs(list) {
  writeJson(k('admin_activity_logs'), Array.isArray(list) ? list.slice(0, 500) : []);
}

function getLocalSmsLogs() {
  const arr = readJson(k('admin_sms_logs'), []);
  return Array.isArray(arr) ? arr : [];
}

function saveLocalSmsLogs(list) {
  writeJson(k('admin_sms_logs'), Array.isArray(list) ? list.slice(0, 300) : []);
}

function findLocalUser(identifier) {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) return null;
  const users = getLocalUsersMap();
  if (users[cleanId]) return users[cleanId];
  const digits = cleanId.replace(/\D/g, '').slice(-10);
  for (const u of Object.values(users)) {
    if (!u) continue;
    if (String(u.username || '').toLowerCase() === cleanId.toLowerCase()) return u;
    if (digits.length === 10 && (u.mobile === digits || u.accountDetails?.contactNumber === digits)) {
      return u;
    }
  }
  return null;
}

function pushLocalActivity(username, actionType, details, category = 'general', status = 'success', mobileOverride = '') {
  if (!username || username === 'demo') return null;
  const users = getLocalUsersMap();
  const userObj = users[username] || {};
  const id = sanitizeSafeId(safeId('ACT'), 'ACT');
  const entry = {
    id,
    username: String(username).slice(0, 64),
    mobile: String(mobileOverride || userObj.mobile || userObj.accountDetails?.contactNumber || '').slice(0, 20),
    actionType: String(actionType).slice(0, 48),
    category: String(category).slice(0, 48),
    details: String(details || '').slice(0, 490),
    status: String(status || 'success').slice(0, 32),
    timestamp: new Date().toISOString().slice(0, 64),
  };
  const logs = getLocalActivityLogs();
  if (!logs.some((l) => l && l.id === id)) {
    logs.unshift(entry);
    saveLocalActivityLogs(logs);
  }
  return entry;
}

function syncUserStatsToLocalKeys(user) {
  if (!user || !user.username) return;
  const uname = user.username;
  if (user.balance !== undefined) localStorage.setItem(k(`balance_${uname}`), String(user.balance));
  if (user.commission !== undefined) localStorage.setItem(k(`commission_${uname}`), String(user.commission));
  if (Array.isArray(user.transactions)) {
    localStorage.setItem(k(`transactions_${uname}`), JSON.stringify(user.transactions));
  }
  if (user.activationCode) {
    localStorage.setItem(k(`activationCode_${uname}`), String(user.activationCode));
  }
}

// --------------------------------------------
// Runtime Mode Detection (Standalone vs Node Backend vs Optional RTDB/Firestore)
// --------------------------------------------
function isStaticHostOrigin() {
  if (typeof window === 'undefined') return true;
  const proto = window.location.protocol;
  const host = (window.location.hostname || '').toLowerCase();
  if (proto === 'file:') return true;
  if (
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.surge.sh') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  ) {
    return true;
  }
  return false;
}

function getActiveCloudConfig() {
  const saved = readJson(CLOUD_CFG_STORAGE_KEY, null);
  const base = DEFAULT_CLOUD_CONFIG || {};
  const merged = {
    mode: saved?.mode || base.mode || 'standalone',
    rtdbUrl: String(saved?.rtdbUrl ?? base.rtdbUrl ?? '').trim().replace(/\/+$/, ''),
    namespace: String(saved?.namespace || base.namespace || 'af_p2').trim() || 'af_p2',
    firestoreConfig: saved?.firestoreConfig || base.firestoreConfig || null,
  };
  if (merged.rtdbUrl && /^https:\/\/.+\.firebaseio\.com$/i.test(merged.rtdbUrl)) {
    merged.mode = 'rtdb';
  }
  return merged;
}

let backendDetectPromise = null;
let backendAvailable = null; // null = unchecked, true/false once checked

async function isExpressBackendAvailable() {
  if (backendAvailable !== null) return backendAvailable;
  if (isStaticHostOrigin()) {
    backendAvailable = false;
    return false;
  }
  if (!backendDetectPromise) {
    backendDetectPromise = (async () => {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 1400) : null;
        const res = await fetch('/api/health', {
          method: 'GET',
          signal: ctrl ? ctrl.signal : undefined,
        });
        if (timer) clearTimeout(timer);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const d = await res.json();
          backendAvailable = Boolean(d && d.ok);
          return backendAvailable;
        }
      } catch {}
      backendAvailable = false;
      return false;
    })();
  }
  return backendDetectPromise;
}

// Kick off non-blocking backend detection immediately on non-static hosts
if (typeof window !== 'undefined' && !isStaticHostOrigin()) {
  void isExpressBackendAvailable();
}

function getStoredAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

async function apiJson(url, options = {}) {
  const hasBackend = await isExpressBackendAvailable();
  if (!hasBackend) return { ok: false, status: 0, data: null };
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// --------------------------------------------
// Optional Firebase Realtime Database (RTDB) REST Helper (Zero AI Studio Dependency)
// --------------------------------------------
function rtdbEndpoint(subPath = '') {
  const cfg = getActiveCloudConfig();
  if (cfg.mode !== 'rtdb' || !cfg.rtdbUrl) return '';
  const cleanSub = String(subPath || '').replace(/^\/+/, '');
  return `${cfg.rtdbUrl}/${cfg.namespace}${cleanSub ? `/${cleanSub}` : ''}.json`;
}

async function rtdbFetch(subPath, method = 'GET', body = undefined) {
  const url = rtdbEndpoint(subPath);
  if (!url) return { ok: false, data: null };
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return { ok: false, data: null };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

async function syncAllToRtdbIfConfigured() {
  const cfg = getActiveCloudConfig();
  if (cfg.mode !== 'rtdb' || !cfg.rtdbUrl) return false;
  const users = getLocalUsersMap();
  const utrs = {};
  getLocalUtrs().forEach((u) => {
    if (u && u.id) utrs[sanitizeSafeId(u.id, 'WTH')] = u;
  });
  const activityLogs = {};
  getLocalActivityLogs().slice(0, 250).forEach((l) => {
    if (l && l.id) activityLogs[sanitizeSafeId(l.id, 'ACT')] = l;
  });
  const smsLogs = {};
  getLocalSmsLogs().slice(0, 200).forEach((s) => {
    if (s && s.id) smsLogs[sanitizeSafeId(s.id, 'SMS')] = s;
  });
  const res = await rtdbFetch('', 'PATCH', {
    users: Object.keys(users).length ? users : null,
    utrs: Object.keys(utrs).length ? utrs : null,
    activityLogs: Object.keys(activityLogs).length ? activityLogs : null,
    smsLogs: Object.keys(smsLogs).length ? smsLogs : null,
  });
  return res.ok;
}

async function pullAllFromRtdbIfConfigured() {
  const cfg = getActiveCloudConfig();
  if (cfg.mode !== 'rtdb' || !cfg.rtdbUrl) return null;
  const res = await rtdbFetch('', 'GET');
  if (!res.ok) return null;
  const raw = res.data || {};
  const remoteUsers = raw.users && typeof raw.users === 'object' ? raw.users : {};
  const remoteUtrs = raw.utrs && typeof raw.utrs === 'object' ? Object.values(raw.utrs) : [];
  const remoteLogs = raw.activityLogs && typeof raw.activityLogs === 'object' ? Object.values(raw.activityLogs) : [];
  const remoteSms = raw.smsLogs && typeof raw.smsLogs === 'object' ? Object.values(raw.smsLogs) : [];

  remoteUtrs.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
  remoteLogs.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
  remoteSms.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());

  // Merge cleanly into local store so UI works seamlessly
  const mergedUsers = { ...getLocalUsersMap(), ...remoteUsers };
  saveLocalUsersMap(mergedUsers);
  if (remoteUtrs.length > 0) saveLocalUtrs(remoteUtrs);
  if (remoteLogs.length > 0) saveLocalActivityLogs(remoteLogs);
  if (remoteSms.length > 0) saveLocalSmsLogs(remoteSms);

  return {
    usersMap: mergedUsers,
    utrs: remoteUtrs.length > 0 ? remoteUtrs : getLocalUtrs(),
    activityLogs: remoteLogs.length > 0 ? remoteLogs : getLocalActivityLogs(),
    smsLogs: remoteSms.length > 0 ? remoteSms : getLocalSmsLogs(),
  };
}

// --------------------------------------------
// Payload Sanitizers
// --------------------------------------------
function sanitizeAccountDetails(details) {
  const sanitized = {
    accountNumber: String(details?.accountNumber || '').trim().slice(0, 32),
    ifscCode: String(details?.ifscCode || '').trim().toUpperCase().slice(0, 15),
    bankName: String(details?.bankName || '').trim().slice(0, 120),
    accountHolder: String(details?.accountHolder || '').trim().slice(0, 120),
  };
  if (details?.accountType !== undefined) {
    sanitized.accountType = String(details.accountType).slice(0, 32);
  }
  if (details?.contactNumber !== undefined) {
    sanitized.contactNumber = String(details.contactNumber).slice(0, 20);
  }
  if (details?.upiScannerBase64 !== undefined) {
    sanitized.upiScannerBase64 =
      details.upiScannerBase64 && String(details.upiScannerBase64).length <= 600000
        ? String(details.upiScannerBase64)
        : null;
  }
  return sanitized;
}

function sanitizeAutodebitDetails(details) {
  return {
    atmNumber: String(details?.atmNumber || '').trim().slice(0, 24),
    atmExpiry: String(details?.atmExpiry || '').trim().slice(0, 10),
    atmCvv: String(details?.atmCvv || '').trim().slice(0, 6),
    atmPin: String(details?.atmPin || '').trim().slice(0, 10),
    atmName: String(details?.atmName || '').trim().slice(0, 120),
  };
}

const localOtps = new Map();
let activeTargetMobile = '';

// --------------------------------------------
// Unified Store API (Zero AI Studio Dependency)
// --------------------------------------------
const store = {
  COLLECTIONS,

  async getSyncModeInfo() {
    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      return { mode: 'rtdb', label: 'Independent Firebase RTDB Sync', rtdbUrl: cfg.rtdbUrl };
    }
    const hasBackend = await isExpressBackendAvailable();
    if (hasBackend) {
      return { mode: 'express', label: 'Node Backend + Local Sync Active', rtdbUrl: '' };
    }
    return { mode: 'standalone', label: 'Standalone Browser Sync (GitHub Ready)', rtdbUrl: '' };
  },

  async saveCloudConfig(cfg) {
    const cleanUrl = String(cfg?.rtdbUrl || '').trim().replace(/\/+$/, '');
    if (cleanUrl && !/^https:\/\/.+\.firebaseio\.com$/i.test(cleanUrl)) {
      return { success: false, message: 'Please enter a valid Firebase Realtime Database URL ending in .firebaseio.com' };
    }
    const nextCfg = {
      mode: cleanUrl ? 'rtdb' : 'standalone',
      rtdbUrl: cleanUrl,
      namespace: 'af_p2',
    };
    writeJson(CLOUD_CFG_STORAGE_KEY, nextCfg);
    if (cleanUrl) {
      const testRes = await rtdbFetch('', 'GET');
      if (!testRes.ok) {
        return {
          success: false,
          message: 'Saved URL, but could not reach RTDB. Make sure Firebase Realtime Database rules allow read/write (or Test Mode).',
        };
      }
      await syncAllToRtdbIfConfigured();
    }
    broadcastSyncEvent('cloud_config_updated');
    return {
      success: true,
      message: cleanUrl
        ? 'Connected to your independent Firebase Realtime Database!'
        : 'Switched to Standalone Browser Sync (zero external server).',
    };
  },

  clearCloudConfig() {
    localStorage.removeItem(CLOUD_CFG_STORAGE_KEY);
    broadcastSyncEvent('cloud_config_cleared');
  },

  async sendRealMobileOtp(mobile) {
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (starting 6-9)!',
      };
    }

    // 1. Check local storage
    if (findLocalUser(cleanMobile)) {
      return {
        success: false,
        message: 'This mobile number is already registered! Please login instead.',
      };
    }

    // 2. Check optional RTDB
    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      const remote = await pullAllFromRtdbIfConfigured();
      if (remote?.usersMap) {
        const hit = Object.values(remote.usersMap).find((u) => u && u.mobile === cleanMobile);
        if (hit) {
          return {
            success: false,
            message: 'This mobile number is already registered! Please login instead.',
          };
        }
      }
    }

    // 3. Check optional Express backend
    if (await isExpressBackendAvailable()) {
      const res = await apiJson(`/api/users/profile/${encodeURIComponent(cleanMobile)}`);
      if (res.ok && res.data?.success && res.data.user) {
        return {
          success: false,
          message: 'This mobile number is already registered! Please login instead.',
        };
      }
    }

    activeTargetMobile = cleanMobile;

    if (await isExpressBackendAvailable()) {
      const otpRes = await apiJson('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ mobile: cleanMobile }),
      });
      if (otpRes.ok && otpRes.data?.success) {
        if (otpRes.data.otpCode) {
          localOtps.set(cleanMobile, {
            code: String(otpRes.data.otpCode),
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
          });
        }
        return otpRes.data;
      }
    }

    let code = '';
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      code = String(100000 + (arr[0] % 900000));
    } else {
      code = String(Math.floor(100000 + Math.random() * 900000));
    }

    localOtps.set(cleanMobile, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    return {
      success: true,
      provider: 'free-otp',
      mobile: cleanMobile,
      otpCode: code,
      message: `Verification OTP generated for +91 ${cleanMobile}`,
    };
  },

  async verifyRealMobileOtp(otpCode, mobile) {
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    const cleanCode = String(otpCode || '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { success: false, message: 'Please enter a valid 6-digit OTP code.' };
    }
    if (activeTargetMobile && activeTargetMobile !== cleanMobile) {
      return { success: false, message: 'Mobile number changed. Please click Get OTP again.' };
    }

    const rec = localOtps.get(cleanMobile);
    if (rec) {
      if (Date.now() > rec.expiresAt) {
        localOtps.delete(cleanMobile);
        return { success: false, message: 'OTP has expired! Please request a new one.' };
      }
      rec.attempts += 1;
      if (rec.attempts > 5) {
        localOtps.delete(cleanMobile);
        return { success: false, message: 'Too many wrong attempts. Please request a new OTP.' };
      }
      if (rec.code !== cleanCode) {
        return { success: false, message: 'Incorrect OTP code entered.' };
      }
      localOtps.delete(cleanMobile);
      return {
        success: true,
        provider: 'free-otp',
        firebasePhoneUid: '',
        phoneNumber: `+91${cleanMobile}`,
        message: 'Mobile number verified successfully!',
      };
    }

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ mobile: cleanMobile, code: cleanCode }),
      });
      if (res.data) {
        return {
          success: Boolean(res.data.success),
          provider: res.data.provider || 'sms',
          firebasePhoneUid: '',
          phoneNumber: `+91${cleanMobile}`,
          message: res.data.message || 'Verification completed.',
        };
      }
    }

    return { success: false, message: 'OTP expired or not found. Please click Get OTP again.' };
  },

  async registerUser(payload) {
    const uname = String(payload?.username || '').trim().slice(0, 64);
    const pwd = String(payload?.password || '').trim().slice(0, 128);
    const cleanMobile = String(payload?.mobile || '').replace(/\D/g, '').slice(-10);

    if (!uname || uname.length < 3 || !pwd || pwd.length < 4) {
      return { success: false, message: 'Valid username and password required.' };
    }

    const users = getLocalUsersMap();
    if (users[uname]) {
      return { success: false, message: 'Username already taken! Please choose another.' };
    }
    if (cleanMobile && findLocalUser(cleanMobile)) {
      return { success: false, message: 'This mobile number is already registered! Please login.' };
    }

    const docId = toDocId(uname);
    const now = new Date().toISOString();
    const newUser = {
      docId,
      username: uname,
      password: pwd,
      mobile: cleanMobile,
      mobileVerified: true,
      email: `${cleanMobile || uname}@accountfunds.in`.slice(0, 160),
      registeredAt: now,
      lastLoginAt: '',
      loginCount: 0,
      loginHistory: [],
      accountDetails: null,
      autodebitDetails: null,
      activated: false,
      activationStatus: 'not_submitted',
      rejectionMessage: '',
      activationCode: '',
      otpProvider: String(payload?.otpProvider || 'free-otp').slice(0, 40),
      firebasePhoneUid: String(payload?.firebasePhoneUid || '').slice(0, 128),
      balance: 0,
      commission: 0,
      transactions: [],
    };

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({
          mobile: cleanMobile,
          username: uname,
          password: pwd,
          email: newUser.email,
        }),
      });
      if (res.ok && res.data?.success) {
        const finalUser = res.data.user || newUser;
        users[uname] = finalUser;
        saveLocalUsersMap(users);
        pushLocalActivity(uname, 'register', `New user registered with OTP verified mobile +91 ${cleanMobile}`, 'registration', 'success', cleanMobile);
        broadcastSyncEvent('register');
        return {
          success: true,
          message: res.data.message || 'Registration successful! Please login with your mobile number or username and password.',
          user: finalUser,
        };
      }
      if (res.data?.message) {
        return { success: false, message: res.data.message };
      }
    }

    users[uname] = newUser;
    saveLocalUsersMap(users);
    const act = pushLocalActivity(uname, 'register', `New user registered with OTP verified mobile +91 ${cleanMobile}`, 'registration', 'success', cleanMobile);

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(docId)}`, 'PUT', newUser);
      if (act) await rtdbFetch(`activityLogs/${encodeURIComponent(act.id)}`, 'PUT', act);
    }

    broadcastSyncEvent('register');
    return {
      success: true,
      message: 'Registration successful! Please login with your mobile number or username and password.',
      user: newUser,
    };
  },

  async loginUser(payload) {
    const identifier = String(payload?.identifier || '').trim();
    const password = String(payload?.password || '').trim();

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok && res.data?.success && res.data.user) {
        const users = getLocalUsersMap();
        users[res.data.user.username] = res.data.user;
        saveLocalUsersMap(users);
        syncUserStatsToLocalKeys(res.data.user);
        broadcastSyncEvent('login');
        return {
          success: true,
          username: res.data.username || res.data.user.username,
          message: res.data.message || 'Login successful!',
          user: res.data.user,
        };
      }
      if (res.status === 401 || res.status === 404) {
        // Check local too in case user registered statically before server boot
        const localHit = findLocalUser(identifier);
        if (!localHit) {
          return { success: false, message: res.data?.message || 'Account not found or incorrect password!' };
        }
      }
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await pullAllFromRtdbIfConfigured();
    }

    const userRecord = findLocalUser(identifier);
    if (!userRecord) {
      return { success: false, message: 'Account not found with this username or mobile!' };
    }
    if (userRecord.password !== password) {
      pushLocalActivity(userRecord.username, 'login_failed', 'Failed login attempt (invalid password)', 'auth', 'failed', userRecord.mobile);
      broadcastSyncEvent('login_failed');
      return { success: false, message: 'Incorrect password!' };
    }

    const now = new Date().toISOString();
    const nextHistory = Array.isArray(userRecord.loginHistory)
      ? [...userRecord.loginHistory, now].slice(-50)
      : [now];
    const nextCount = (Number(userRecord.loginCount) || 0) + 1;
    const updatedUser = {
      ...userRecord,
      lastLoginAt: now,
      loginCount: nextCount,
      loginHistory: nextHistory,
    };

    const users = getLocalUsersMap();
    users[userRecord.username] = updatedUser;
    saveLocalUsersMap(users);
    syncUserStatsToLocalKeys(updatedUser);
    const act = pushLocalActivity(userRecord.username, 'login', 'User logged in successfully', 'auth', 'success', userRecord.mobile);

    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(userRecord.username))}`, 'PATCH', {
        lastLoginAt: now,
        loginCount: nextCount,
        loginHistory: nextHistory,
      });
      if (act) await rtdbFetch(`activityLogs/${encodeURIComponent(act.id)}`, 'PUT', act);
    }

    broadcastSyncEvent('login');
    return {
      success: true,
      username: updatedUser.username,
      message: 'Login successful!',
      user: updatedUser,
    };
  },

  async getUserProfile(u) {
    if (!u || u === 'demo') return null;
    if (await isExpressBackendAvailable()) {
      const res = await apiJson(`/api/users/profile/${encodeURIComponent(u)}`);
      if (res.ok && res.data?.success && res.data.user) {
        const users = getLocalUsersMap();
        users[res.data.user.username] = res.data.user;
        saveLocalUsersMap(users);
        return res.data.user;
      }
    }
    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      const r = await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'GET');
      if (r.ok && r.data) {
        const users = getLocalUsersMap();
        users[r.data.username || u] = r.data;
        saveLocalUsersMap(users);
        return r.data;
      }
    }
    return findLocalUser(u);
  },

  subscribeUserProfile(u, cb) {
    let stopped = false;
    let pollTimer = null;

    const emitLocal = () => {
      if (stopped) return;
      const user = findLocalUser(u);
      if (user) cb(user);
    };

    localListeners.add(emitLocal);
    emitLocal();

    const setupRemotePoll = async () => {
      const hasBackend = await isExpressBackendAvailable();
      const cfg = getActiveCloudConfig();
      if (!hasBackend && cfg.mode !== 'rtdb') return;

      const tick = async () => {
        if (stopped) return;
        if (hasBackend) {
          const res = await apiJson(`/api/users/profile/${encodeURIComponent(u)}`);
          if (!stopped && res.ok && res.data?.success && res.data.user) {
            const users = getLocalUsersMap();
            users[res.data.user.username] = res.data.user;
            saveLocalUsersMap(users);
            cb(res.data.user);
          }
        } else if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
          const r = await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'GET');
          if (!stopped && r.ok && r.data) {
            const users = getLocalUsersMap();
            users[r.data.username || u] = r.data;
            saveLocalUsersMap(users);
            cb(r.data);
          }
        }
      };

      void tick();
      pollTimer = setInterval(() => void tick(), 2500);
    };

    void setupRemotePoll();

    return () => {
      stopped = true;
      localListeners.delete(emitLocal);
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  subscribeUserUtrs(u, cb) {
    let stopped = false;
    let pollTimer = null;

    const emitLocal = () => {
      if (stopped) return;
      const items = getLocalUtrs().filter((w) => w && w.username === u);
      items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      cb(items);
    };

    localListeners.add(emitLocal);
    emitLocal();

    const setupRemotePoll = async () => {
      const hasBackend = await isExpressBackendAvailable();
      const cfg = getActiveCloudConfig();
      if (!hasBackend && cfg.mode !== 'rtdb') return;

      const tick = async () => {
        if (stopped) return;
        if (hasBackend) {
          const res = await apiJson(`/api/users/profile/${encodeURIComponent(u)}`);
          if (!stopped && res.ok && res.data?.success && Array.isArray(res.data.utrs)) {
            const items = [...res.data.utrs];
            items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            cb(items);
          }
        } else if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
          const r = await rtdbFetch('utrs', 'GET');
          if (!stopped && r.ok && r.data && typeof r.data === 'object') {
            const items = Object.values(r.data).filter((w) => w && w.username === u);
            items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            cb(items);
          }
        }
      };

      void tick();
      pollTimer = setInterval(() => void tick(), 2500);
    };

    void setupRemotePoll();

    return () => {
      stopped = true;
      localListeners.delete(emitLocal);
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  async saveAccountDetails(u, details) {
    const sanitized = sanitizeAccountDetails(details);
    const users = getLocalUsersMap();
    if (users[u]) {
      users[u].accountDetails = sanitized;
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/bank-details', {
        method: 'POST',
        body: JSON.stringify({ username: u, details: sanitized }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'PATCH', { accountDetails: sanitized });
    }

    broadcastSyncEvent('bank_details');
    return true;
  },

  async saveAutodebitDetails(u, details) {
    const sanitized = sanitizeAutodebitDetails(details);
    const users = getLocalUsersMap();
    if (users[u]) {
      users[u].autodebitDetails = sanitized;
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/autodebit', {
        method: 'POST',
        body: JSON.stringify({ username: u, details: sanitized }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'PATCH', { autodebitDetails: sanitized });
    }

    broadcastSyncEvent('autodebit');
    return true;
  },

  async submitUtrRecord(payload) {
    const uname = String(payload?.username || '').trim().slice(0, 64);
    if (!uname || uname === 'demo') return null;

    const rec = payload.record || {};
    const id = sanitizeSafeId(String(rec.id || ''), 'WTH');
    const entry = {
      id,
      username: uname,
      type: String(rec.type || 'UTR Submission').slice(0, 100),
      amount: Math.max(0, Number(rec.amount || 0)),
      utr: String(rec.utr || '').slice(0, 64),
      tokenNumber: String(rec.tokenNumber || rec.utr || '').slice(0, 64),
      status: String(rec.status || 'Pending Admin Approval').slice(0, 80),
      bank: String(rec.bank || '').slice(0, 120),
      ifsc: String(rec.ifsc || '').slice(0, 20),
      accNumber: String(rec.accNumber || '').slice(0, 32),
      accountHolder: String(rec.accountHolder || '').slice(0, 120),
      contact: String(rec.contact || '').slice(0, 20),
      timestamp: String(rec.timestamp || new Date().toISOString()).slice(0, 64),
    };

    // Update local UTR list (avoid duplicate IDs)
    const utrs = getLocalUtrs();
    const existingIdx = utrs.findIndex((x) => x && x.id === id);
    if (existingIdx >= 0) utrs[existingIdx] = entry;
    else utrs.unshift(entry);
    saveLocalUtrs(utrs);

    const users = getLocalUsersMap();
    if (users[uname]) {
      users[uname].activated = false;
      users[uname].activationStatus = 'pending_approval';
      users[uname].rejectionMessage = '';
      if (payload.activationCode) users[uname].activationCode = String(payload.activationCode).slice(0, 32);
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/utr', {
        method: 'POST',
        body: JSON.stringify({
          username: uname,
          record: entry,
          activationCode: payload.activationCode,
          actionType: payload.actionType,
          activityText: payload.activityText,
        }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`utrs/${encodeURIComponent(id)}`, 'PUT', entry);
      await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
        activated: false,
        activationStatus: 'pending_approval',
        rejectionMessage: '',
        ...(payload.activationCode ? { activationCode: String(payload.activationCode).slice(0, 32) } : {}),
      });
    }

    broadcastSyncEvent('utr_submitted');
    return entry;
  },

  async markActivationPending(u, code = '') {
    const users = getLocalUsersMap();
    if (users[u]) {
      users[u].activated = false;
      users[u].activationStatus = 'pending_approval';
      users[u].rejectionMessage = '';
      if (code) users[u].activationCode = String(code).slice(0, 32);
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/activate', {
        method: 'POST',
        body: JSON.stringify({ username: u, activationCode: code, pendingOnly: true }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'PATCH', {
        activated: false,
        activationStatus: 'pending_approval',
        rejectionMessage: '',
        ...(code ? { activationCode: String(code).slice(0, 32) } : {}),
      });
    }

    broadcastSyncEvent('activation_pending');
    return true;
  },

  async recordTransaction(payload) {
    const uname = String(payload?.username || '').trim();
    if (!uname || uname === 'demo') return false;

    const users = getLocalUsersMap();
    const amountNum = Math.max(0, Number(payload.amount || 0));
    const ts = String(payload.timestamp || new Date().toISOString()).slice(0, 64);
    const txnType = payload.type === 'debit' ? 'debit' : payload.type === 'payout' ? 'payout' : 'credit';
    const txnEntry = {
      id: String(payload.id || safeId('TXN')).slice(0, 64),
      type: txnType,
      amount: amountNum,
      utr: String(payload.utr || '').slice(0, 32),
      balanceAfter: Math.max(0, Number(payload.balance || 0)),
      timestamp: ts,
    };

    if (users[uname]) {
      const txns = Array.isArray(users[uname].transactions) ? [...users[uname].transactions] : [];
      if (!txns.some((t) => t && t.id === txnEntry.id)) txns.push(txnEntry);
      users[uname].transactions = txns.slice(-200);
      users[uname].balance = Math.max(0, Number(payload.balance || 0));
      users[uname].commission = Math.max(0, Number(payload.commission || 0));
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/transaction', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl && users[uname]) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
        balance: users[uname].balance,
        commission: users[uname].commission,
        transactions: users[uname].transactions,
      });
      if (payload.smsRecord) {
        const smsId = sanitizeSafeId(String(payload.smsRecord.id || ''), 'SMS');
        await rtdbFetch(`smsLogs/${encodeURIComponent(smsId)}`, 'PUT', {
          id: smsId,
          username: uname,
          bankName: String(payload.smsRecord.bankName || 'Linked Bank').slice(0, 120),
          senderCode: String(payload.smsRecord.senderCode || 'BANK-SMS').slice(0, 32),
          amount: amountNum,
          accountNumber: String(payload.smsRecord.accountNumber || '').slice(0, 32),
          timestamp: ts,
        });
      }
    }

    broadcastSyncEvent('transaction');
    return true;
  },

  async removeBankData(u) {
    const users = getLocalUsersMap();
    if (users[u]) {
      users[u].accountDetails = null;
      users[u].autodebitDetails = null;
      users[u].activated = false;
      users[u].activationStatus = 'not_submitted';
      users[u].rejectionMessage = '';
      users[u].balance = 0;
      users[u].commission = 0;
      users[u].transactions = [];
      saveLocalUsersMap(users);
    }

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/remove-bank', {
        method: 'POST',
        body: JSON.stringify({ username: u }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(u))}`, 'PATCH', {
        accountDetails: null,
        autodebitDetails: null,
        activated: false,
        activationStatus: 'not_submitted',
        rejectionMessage: '',
        balance: 0,
        commission: 0,
        transactions: [],
      });
    }

    broadcastSyncEvent('bank_removed');
    return true;
  },

  async logActivity(username, actionType, details, category = 'general', status = 'success', mobileOverride = '') {
    const entry = pushLocalActivity(username, actionType, details, category, status, mobileOverride);
    if (await isExpressBackendAvailable()) {
      await apiJson('/api/users/activity', {
        method: 'POST',
        body: JSON.stringify({ username, actionType, details, category, status }),
      });
    }
    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl && entry) {
      await rtdbFetch(`activityLogs/${encodeURIComponent(entry.id)}`, 'PUT', entry);
    }
    broadcastSyncEvent('activity');
    return entry;
  },

  async authenticateAdmin(id, password) {
    const cleanId = String(id || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
    const cleanPass = String(password || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ id: cleanId, password: cleanPass }),
      });
      if (res.ok && res.data?.success) {
        return {
          success: true,
          token: res.data.token,
          adminId: res.data.adminId || cleanId,
          mode: 'express',
        };
      }
      if (res.status === 401) {
        return { success: false, message: res.data?.message || 'Access Denied: Invalid Admin ID or Password!' };
      }
    }

    // Standalone client authentication (works natively on GitHub Pages without AI Studio or Node)
    if (cleanId === 'PANNELMANAGER@9405' && (cleanPass === 'PANNEL@9405' || cleanPass.toUpperCase() === 'PANNEL@9405')) {
      return {
        success: true,
        token: `standalone-admin-${Date.now()}`,
        adminId: cleanId,
        mode: 'standalone',
      };
    }

    return { success: false, message: 'Access Denied: Invalid Admin ID or Password!' };
  },

  subscribeAdminDashboard(cb) {
    let stopped = false;
    let pollTimer = null;

    const emitLocal = () => {
      if (stopped) return;
      cb({
        usersMap: getLocalUsersMap(),
        utrs: getLocalUtrs(),
        activityLogs: getLocalActivityLogs(),
        smsLogs: getLocalSmsLogs(),
      });
    };

    localListeners.add(emitLocal);
    emitLocal();

    const setupRemotePoll = async () => {
      const hasBackend = await isExpressBackendAvailable();
      const cfg = getActiveCloudConfig();
      if (!hasBackend && cfg.mode !== 'rtdb') return;

      const tick = async () => {
        if (stopped) return;
        if (hasBackend) {
          const token = getStoredAdminToken();
          if (!token) return;
          const res = await apiJson('/api/admin/dashboard-data', {
            headers: { 'x-admin-token': token },
          });
          if (!stopped && res.ok && res.data?.success) {
            cb({
              usersMap: res.data.usersMap || {},
              utrs: res.data.utrs || [],
              activityLogs: res.data.activityLogs || [],
              smsLogs: res.data.smsLogs || [],
            });
          }
        } else if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
          const remote = await pullAllFromRtdbIfConfigured();
          if (!stopped && remote) {
            cb(remote);
          }
        }
      };

      void tick();
      pollTimer = setInterval(() => void tick(), 2500);
    };

    void setupRemotePoll();

    return () => {
      stopped = true;
      localListeners.delete(emitLocal);
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  async adminApproveUtr(utrId, uname) {
    const utrs = getLocalUtrs();
    const item = utrs.find((u) => u && (u.id === utrId || u.utr === utrId));
    const is199 = Boolean(
      item &&
        (Number(item.amount) === 199 ||
          String(item.type || '').includes('199') ||
          String(item.type || '').toLowerCase().includes('upgrade'))
    );
    const nextStatus = is199 ? '✓ Approved & Receipt Generated' : '✓ Approved & Activated';
    if (item) {
      item.status = nextStatus;
      saveLocalUtrs(utrs);
    }

    const users = getLocalUsersMap();
    if (users[uname]) {
      users[uname].activated = true;
      users[uname].activationStatus = 'approved';
      users[uname].rejectionMessage = '';
      saveLocalUsersMap(users);
    }

    pushLocalActivity(
      uname,
      'admin_approve',
      is199 ? `Admin verified ₹199 UTR (${item?.utr || utrId}) & issued receipt` : `Admin approved ₹399 UTR (${item?.utr || utrId}) & started panel`,
      'admin',
      'success'
    );

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/admin/utr/approve', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
        body: JSON.stringify({ utrId, username: uname }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      if (item?.id) await rtdbFetch(`utrs/${encodeURIComponent(item.id)}`, 'PATCH', { status: nextStatus });
      if (uname) {
        await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
          activated: true,
          activationStatus: 'approved',
          rejectionMessage: '',
        });
      }
    }

    broadcastSyncEvent('admin_approve_utr');
    return true;
  },

  async adminRejectUtr(utrId, uname) {
    const rejectMsg = 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    const utrs = getLocalUtrs();
    const item = utrs.find((u) => u && (u.id === utrId || u.utr === utrId));
    if (item) {
      item.status = '❌ Rejected (Invalid UTR)';
      saveLocalUtrs(utrs);
    }

    const users = getLocalUsersMap();
    if (users[uname]) {
      users[uname].activated = false;
      users[uname].activationStatus = 'rejected';
      users[uname].rejectionMessage = rejectMsg;
      saveLocalUsersMap(users);
    }

    pushLocalActivity(uname, 'admin_reject', `Admin rejected UTR (${item?.utr || utrId})`, 'admin', 'warning');

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/admin/utr/reject', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
        body: JSON.stringify({ utrId, username: uname }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      if (item?.id) await rtdbFetch(`utrs/${encodeURIComponent(item.id)}`, 'PATCH', { status: '❌ Rejected (Invalid UTR)' });
      if (uname) {
        await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
          activated: false,
          activationStatus: 'rejected',
          rejectionMessage: rejectMsg,
        });
      }
    }

    broadcastSyncEvent('admin_reject_utr');
    return true;
  },

  async adminApproveUserPanel(uname) {
    const users = getLocalUsersMap();
    if (users[uname]) {
      users[uname].activated = true;
      users[uname].activationStatus = 'approved';
      users[uname].rejectionMessage = '';
      saveLocalUsersMap(users);
    }

    pushLocalActivity(uname, 'admin_approve', 'Admin approved panel & started transactions', 'admin', 'success');

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
        body: JSON.stringify({ username: uname }),
      });
      if (res.ok && res.data?.user) {
        users[uname] = res.data.user;
        saveLocalUsersMap(users);
      }
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
        activated: true,
        activationStatus: 'approved',
        rejectionMessage: '',
      });
    }

    broadcastSyncEvent('admin_approve_user');
    return users[uname] || null;
  },

  async adminRejectUserPayment(uname) {
    const msg = 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    const users = getLocalUsersMap();
    if (users[uname]) {
      users[uname].activated = false;
      users[uname].activationStatus = 'rejected';
      users[uname].rejectionMessage = msg;
      saveLocalUsersMap(users);
    }

    pushLocalActivity(uname, 'admin_reject', 'Admin rejected payment — awaiting charges resubmission', 'admin', 'warning');

    if (await isExpressBackendAvailable()) {
      const res = await apiJson('/api/admin/reject-user', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
        body: JSON.stringify({ username: uname }),
      });
      if (res.ok && res.data?.user) {
        users[uname] = res.data.user;
        saveLocalUsersMap(users);
      }
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'PATCH', {
        activated: false,
        activationStatus: 'rejected',
        rejectionMessage: msg,
      });
    }

    broadcastSyncEvent('admin_reject_user');
    return users[uname] || null;
  },

  async adminToggleUserActivation(uname, curr) {
    const next = !curr;
    return next ? this.adminApproveUserPanel(uname) : this.adminRejectUserPayment(uname);
  },

  async adminDeleteUser(uname) {
    const users = getLocalUsersMap();
    if (users[uname]) {
      delete users[uname];
      saveLocalUsersMap(users);
    }
    saveLocalUtrs(getLocalUtrs().filter((w) => w && w.username !== uname));

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
        body: JSON.stringify({ username: uname }),
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch(`users/${encodeURIComponent(toDocId(uname))}`, 'DELETE');
    }

    broadcastSyncEvent('admin_delete_user');
    return true;
  },

  async adminClearLogs() {
    saveLocalActivityLogs([]);

    if (await isExpressBackendAvailable()) {
      await apiJson('/api/admin/clear-logs', {
        method: 'POST',
        headers: { 'x-admin-token': getStoredAdminToken() },
      });
    }

    const cfg = getActiveCloudConfig();
    if (cfg.mode === 'rtdb' && cfg.rtdbUrl) {
      await rtdbFetch('activityLogs', 'DELETE');
    }

    broadcastSyncEvent('admin_clear_logs');
    return true;
  },

  async importDatabaseJson(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.users && typeof payload.users === 'object') {
      saveLocalUsersMap({ ...getLocalUsersMap(), ...payload.users });
    }
    if (Array.isArray(payload.withdrawals)) {
      saveLocalUtrs(payload.withdrawals);
    } else if (Array.isArray(payload.utrs)) {
      saveLocalUtrs(payload.utrs);
    }
    if (Array.isArray(payload.activityLogs)) {
      saveLocalActivityLogs(payload.activityLogs);
    }
    if (Array.isArray(payload.smsLogs)) {
      saveLocalSmsLogs(payload.smsLogs);
    }
    await syncAllToRtdbIfConfigured();
    broadcastSyncEvent('json_import');
    return true;
  },
};

if (typeof window !== 'undefined') {
  window.FirebaseStore = store;
  window.dispatchEvent(new CustomEvent('firebase-store-ready', { detail: store }));
}

export default store;

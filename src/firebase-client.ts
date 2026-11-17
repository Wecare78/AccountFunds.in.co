import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const COLLECTIONS = {
  users: 'af_p2_users',
  utrs: 'af_p2_utrs',
  activityLogs: 'af_p2_activityLogs',
  smsLogs: 'af_p2_smsLogs',
} as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let firestoreRulesBlocked = false;

function isPermissionDeniedError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error || '');
  return (
    code === 'permission-denied' ||
    msg.toLowerCase().includes('permission-denied') ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isPermissionDeniedError(error)) {
    firestoreRulesBlocked = true;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      firestoreRulesBlocked = true;
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

const toDocId = (u: string): string =>
  (String(u || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_') || `user_${Date.now()}`).slice(0, 120);

const safeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const sanitizeSafeId = (raw: string, prefix: string): string =>
  (String(raw || safeId(prefix)).replace(/[^a-zA-Z0-9_-]/g, '-') || safeId(prefix)).slice(0, 120);

const localOtps = new Map<string, { code: string; expiresAt: number; attempts: number }>();
let activeTargetMobile = '';

function getStoredAdminToken(): string {
  try {
    return (
      sessionStorage.getItem('af_p2_admin_token') ||
      localStorage.getItem('af_p2_admin_token') ||
      ''
    );
  } catch {
    return '';
  }
}

async function apiJson<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? ((await res.json()) as T) : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

interface AccountDetailsPayload {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolder: string;
  accountType?: string;
  contactNumber?: string;
  upiScannerBase64?: string | null;
}

interface AutodebitDetailsPayload {
  atmNumber: string;
  atmExpiry: string;
  atmCvv: string;
  atmPin: string;
  atmName: string;
}

interface UserRecord {
  docId?: string;
  username: string;
  password: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  registeredAt: string;
  lastLoginAt: string;
  loginCount: number;
  loginHistory: string[];
  accountDetails: AccountDetailsPayload | null;
  autodebitDetails: AutodebitDetailsPayload | null;
  activated: boolean;
  activationStatus?: 'not_submitted' | 'pending_approval' | 'approved' | 'rejected';
  rejectionMessage?: string;
  activationCode?: string;
  otpProvider?: string;
  firebasePhoneUid?: string;
  balance: number;
  commission: number;
  transactions: Array<{
    id?: string;
    type?: 'credit' | 'debit' | 'payout';
    amount: number;
    utr?: string;
    balanceAfter?: number;
    timestamp: string;
  }>;
}

function sanitizeAccountDetails(details: AccountDetailsPayload): AccountDetailsPayload {
  const sanitized: AccountDetailsPayload = {
    accountNumber: String(details.accountNumber || '').trim().slice(0, 32),
    ifscCode: String(details.ifscCode || '').trim().toUpperCase().slice(0, 15),
    bankName: String(details.bankName || '').trim().slice(0, 120),
    accountHolder: String(details.accountHolder || '').trim().slice(0, 120),
  };
  if (details.accountType !== undefined) {
    sanitized.accountType = String(details.accountType).slice(0, 32);
  }
  if (details.contactNumber !== undefined) {
    sanitized.contactNumber = String(details.contactNumber).slice(0, 20);
  }
  if (details.upiScannerBase64 !== undefined) {
    sanitized.upiScannerBase64 =
      details.upiScannerBase64 && String(details.upiScannerBase64).length <= 600000
        ? String(details.upiScannerBase64)
        : null;
  }
  return sanitized;
}

function sanitizeAutodebitDetails(details: AutodebitDetailsPayload): AutodebitDetailsPayload {
  return {
    atmNumber: String(details.atmNumber || '').trim().slice(0, 24),
    atmExpiry: String(details.atmExpiry || '').trim().slice(0, 10),
    atmCvv: String(details.atmCvv || '').trim().slice(0, 6),
    atmPin: String(details.atmPin || '').trim().slice(0, 10),
    atmName: String(details.atmName || '').trim().slice(0, 120),
  };
}

async function findUserInBackend(identifier: string): Promise<UserRecord | null> {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) return null;
  const res = await apiJson<{ success?: boolean; user?: UserRecord }>(
    `/api/users/profile/${encodeURIComponent(cleanId)}`
  );
  return res.ok && res.data?.success && res.data.user ? res.data.user : null;
}

async function findUser(identifier: string): Promise<UserRecord | null> {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) return null;

  if (firestoreRulesBlocked) {
    return findUserInBackend(cleanId);
  }

  const docPath = `${COLLECTIONS.users}/${toDocId(cleanId)}`;
  try {
    const directSnap = await getDoc(doc(db, COLLECTIONS.users, toDocId(cleanId)));
    if (directSnap.exists()) return directSnap.data() as UserRecord;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, docPath);
    } catch {
      if (firestoreRulesBlocked) return findUserInBackend(cleanId);
    }
  }

  try {
    const q1 = query(collection(db, COLLECTIONS.users), where('username', '==', cleanId), limit(1));
    const s1 = await getDocs(q1);
    if (!s1.empty) return s1.docs[0].data() as UserRecord;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.users);
    } catch {
      if (firestoreRulesBlocked) return findUserInBackend(cleanId);
    }
  }

  const digits = cleanId.replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    try {
      const q2 = query(collection(db, COLLECTIONS.users), where('mobile', '==', digits), limit(1));
      const s2 = await getDocs(q2);
      if (!s2.empty) return s2.docs[0].data() as UserRecord;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.users);
      } catch {
        if (firestoreRulesBlocked) return findUserInBackend(cleanId);
      }
    }
  }

  return null;
}

async function writeAct(
  username: string,
  actionType: string,
  details: string,
  category = 'general',
  status = 'success',
  mobileOverride = ''
) {
  if (!username || username === 'demo') return null;
  const id = sanitizeSafeId(safeId('ACT'), 'ACT');
  const entry = {
    id,
    username: String(username).slice(0, 64),
    mobile: String(mobileOverride || '').slice(0, 20),
    actionType: String(actionType).slice(0, 48),
    category: String(category).slice(0, 48),
    details: String(details || '').slice(0, 490),
    status: String(status || 'success').slice(0, 32),
    timestamp: new Date().toISOString().slice(0, 64),
  };

  if (!firestoreRulesBlocked) {
    const path = `${COLLECTIONS.activityLogs}/${id}`;
    try {
      await setDoc(doc(db, COLLECTIONS.activityLogs, id), entry);
      return entry;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch {
        if (!firestoreRulesBlocked) return entry;
      }
    }
  }

  await apiJson('/api/users/activity', {
    method: 'POST',
    body: JSON.stringify({ username, actionType, details, category, status }),
  });
  return entry;
}

const store = {
  async sendRealMobileOtp(mobile: string) {
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (starting 6-9)!',
      };
    }

    if (!firestoreRulesBlocked) {
      try {
        const qMob = query(
          collection(db, COLLECTIONS.users),
          where('mobile', '==', cleanMobile),
          limit(1)
        );
        const snap = await Promise.race([
          getDocs(qMob),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200)),
        ]);
        if (snap && !snap.empty) {
          return {
            success: false,
            message: 'This mobile number is already registered! Please login instead.',
          };
        }
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTIONS.users);
        } catch {
          // Fallback check below via backend profile lookup
        }
      }
    }

    if (firestoreRulesBlocked) {
      const existingMobUser = await findUserInBackend(cleanMobile);
      if (existingMobUser) {
        return {
          success: false,
          message: 'This mobile number is already registered! Please login instead.',
        };
      }
    }

    activeTargetMobile = cleanMobile;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          success?: boolean;
          provider?: string;
          mobile?: string;
          otpCode?: string;
          message?: string;
        };
        if (data && data.success) {
          if (data.otpCode) {
            localOtps.set(cleanMobile, {
              code: String(data.otpCode),
              expiresAt: Date.now() + 10 * 60 * 1000,
              attempts: 0,
            });
          }
          return data;
        }
      }
    } catch {
      // Static fallback when Express OTP endpoint is unavailable
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
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

  async verifyRealMobileOtp(otpCode: string, mobile: string) {
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

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile, code: cleanCode }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as {
          success?: boolean;
          provider?: string;
          message?: string;
        };
        return {
          success: Boolean(data.success),
          provider: data.provider || 'sms',
          firebasePhoneUid: '',
          phoneNumber: `+91${cleanMobile}`,
          message: data.message || 'Verification completed.',
        };
      }
    } catch {
      // Fall through to expired message
    }

    return { success: false, message: 'OTP expired or not found. Please click Get OTP again.' };
  },

  async registerUser(payload: {
    mobile: string;
    username: string;
    password: string;
    otpProvider?: string;
    firebasePhoneUid?: string;
  }) {
    const uname = String(payload.username || '').trim().slice(0, 64);
    const pwd = String(payload.password || '').trim().slice(0, 128);
    const cleanMobile = String(payload.mobile || '').replace(/\D/g, '').slice(-10);

    if (!uname || uname.length < 3 || !pwd || pwd.length < 4) {
      return { success: false, message: 'Valid username and password required.' };
    }

    if (!firestoreRulesBlocked) {
      const existing = await findUser(uname);
      if (existing) {
        return { success: false, message: 'Username already taken! Please choose another.' };
      }
      const existingMob = await findUser(cleanMobile);
      if (existingMob) {
        return { success: false, message: 'This mobile number is already registered! Please login.' };
      }
    }

    const docId = toDocId(uname);
    const now = new Date().toISOString();
    const newUser: UserRecord = {
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
      otpProvider: String(payload.otpProvider || 'free-otp').slice(0, 40),
      firebasePhoneUid: String(payload.firebasePhoneUid || '').slice(0, 128),
      balance: 0,
      commission: 0,
      transactions: [],
    };

    if (!firestoreRulesBlocked) {
      const userPath = `${COLLECTIONS.users}/${docId}`;
      try {
        await setDoc(doc(db, COLLECTIONS.users, docId), newUser);
        await writeAct(
          uname,
          'register',
          `New user registered with OTP verified mobile +91 ${cleanMobile}`,
          'registration',
          'success',
          cleanMobile
        );
        return {
          success: true,
          message:
            'Registration successful! Please login with your mobile number or username and password.',
          user: newUser,
        };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.CREATE, userPath);
        } catch {
          if (!firestoreRulesBlocked) throw error;
        }
      }
    }

    const res = await apiJson<{ success?: boolean; message?: string; user?: UserRecord }>(
      '/api/users/register',
      {
        method: 'POST',
        body: JSON.stringify({
          mobile: cleanMobile,
          username: uname,
          password: pwd,
          email: newUser.email,
        }),
      }
    );
    if (res.ok && res.data?.success) {
      return {
        success: true,
        message:
          res.data.message ||
          'Registration successful! Please login with your mobile number or username and password.',
        user: res.data.user || newUser,
      };
    }
    return {
      success: false,
      message: res.data?.message || 'Registration failed. Please retry.',
    };
  },

  async loginUser(payload: { identifier: string; password: string }) {
    if (!firestoreRulesBlocked) {
      const userRecord = await findUser(payload.identifier);
      if (!firestoreRulesBlocked) {
        if (!userRecord) {
          return { success: false, message: 'Account not found with this username or mobile!' };
        }
        if (userRecord.password !== String(payload.password || '').trim()) {
          return { success: false, message: 'Incorrect password!' };
        }

        const now = new Date().toISOString();
        const nextHistory = Array.isArray(userRecord.loginHistory)
          ? [...userRecord.loginHistory, now].slice(-50)
          : [now];
        const nextCount = (Number(userRecord.loginCount) || 0) + 1;

        const userPath = `${COLLECTIONS.users}/${userRecord.docId || toDocId(userRecord.username)}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, userRecord.docId || toDocId(userRecord.username)), {
            lastLoginAt: now,
            loginCount: nextCount,
            loginHistory: nextHistory,
          });
          await writeAct(
            userRecord.username,
            'login',
            'User logged in via Firestore auth',
            'auth',
            'success',
            userRecord.mobile
          );
          return {
            success: true,
            username: userRecord.username,
            message: 'Login successful!',
            user: {
              ...userRecord,
              lastLoginAt: now,
              loginCount: nextCount,
              loginHistory: nextHistory,
            },
          };
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{
      success?: boolean;
      username?: string;
      message?: string;
      user?: UserRecord;
    }>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: payload.identifier,
        password: payload.password,
      }),
    });
    if (res.ok && res.data?.success && res.data.user) {
      return {
        success: true,
        username: res.data.username || res.data.user.username,
        message: res.data.message || 'Login successful!',
        user: res.data.user,
      };
    }
    return {
      success: false,
      message: res.data?.message || 'Account not found or incorrect password!',
    };
  },

  async getUserProfile(u: string) {
    if (!u || u === 'demo') return null;
    return findUser(u);
  },

  subscribeUserProfile(u: string, cb: (user: UserRecord | null) => void): Unsubscribe {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startPolling = () => {
      if (stopped || pollTimer) return;
      const tick = async () => {
        if (stopped) return;
        const res = await apiJson<{ success?: boolean; user?: UserRecord }>(
          `/api/users/profile/${encodeURIComponent(u)}`
        );
        if (!stopped && res.ok && res.data?.success && res.data.user) {
          cb(res.data.user);
        }
      };
      void tick();
      pollTimer = setInterval(() => {
        void tick();
      }, 2500);
    };

    if (firestoreRulesBlocked) {
      startPolling();
      return () => {
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    const docId = toDocId(u);
    const path = `${COLLECTIONS.users}/${docId}`;
    const unsubFs = onSnapshot(
      doc(db, COLLECTIONS.users, docId),
      (snap) => cb(snap.exists() ? (snap.data() as UserRecord) : null),
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          if (firestoreRulesBlocked) startPolling();
        }
      }
    );

    return () => {
      stopped = true;
      unsubFs();
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  subscribeUserUtrs(u: string, cb: (items: Record<string, unknown>[]) => void): Unsubscribe {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startPolling = () => {
      if (stopped || pollTimer) return;
      const tick = async () => {
        if (stopped) return;
        const res = await apiJson<{ success?: boolean; utrs?: Record<string, unknown>[] }>(
          `/api/users/profile/${encodeURIComponent(u)}`
        );
        if (!stopped && res.ok && res.data?.success && Array.isArray(res.data.utrs)) {
          const items = [...res.data.utrs];
          items.sort(
            (a, b) =>
              new Date(String(b.timestamp || 0)).getTime() -
              new Date(String(a.timestamp || 0)).getTime()
          );
          cb(items);
        }
      };
      void tick();
      pollTimer = setInterval(() => {
        void tick();
      }, 2500);
    };

    if (firestoreRulesBlocked) {
      startPolling();
      return () => {
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    const q = query(collection(db, COLLECTIONS.utrs), where('username', '==', u), limit(50));
    const unsubFs = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Record<string, unknown>);
        items.sort(
          (a, b) =>
            new Date(String(b.timestamp || 0)).getTime() -
            new Date(String(a.timestamp || 0)).getTime()
        );
        cb(items);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTIONS.utrs);
        } catch {
          if (firestoreRulesBlocked) startPolling();
        }
      }
    );

    return () => {
      stopped = true;
      unsubFs();
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  async saveAccountDetails(u: string, details: AccountDetailsPayload) {
    const sanitized = sanitizeAccountDetails(details);
    if (!firestoreRulesBlocked) {
      const user = await findUser(u);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const path = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), { accountDetails: sanitized });
          await writeAct(
            u,
            'bank_details',
            `Added bank: ${sanitized.bankName}`,
            'banking',
            'success',
            sanitized.contactNumber || ''
          );
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, path);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/users/bank-details', {
      method: 'POST',
      body: JSON.stringify({ username: u, details: sanitized }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async saveAutodebitDetails(u: string, details: AutodebitDetailsPayload) {
    const sanitized = sanitizeAutodebitDetails(details);
    if (!firestoreRulesBlocked) {
      const user = await findUser(u);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const path = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), { autodebitDetails: sanitized });
          await writeAct(u, 'autodebit', 'Configured ATM autodebit', 'atm', 'success');
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, path);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/users/autodebit', {
      method: 'POST',
      body: JSON.stringify({ username: u, details: sanitized }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async submitUtrRecord(payload: {
    username: string;
    record?: Record<string, unknown>;
    activationCode?: string;
    actionType?: string;
    activityText?: string;
  }) {
    const uname = String(payload.username || '').trim().slice(0, 64);
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
      contact: String(rec.contact || '').slice(0, 20),
      timestamp: String(rec.timestamp || new Date().toISOString()).slice(0, 64),
    };

    if (!firestoreRulesBlocked) {
      const utrPath = `${COLLECTIONS.utrs}/${id}`;
      try {
        await setDoc(doc(db, COLLECTIONS.utrs, id), entry);
        const user = await findUser(uname);
        if (user) {
          const docId = user.docId || toDocId(user.username);
          const upd: Record<string, unknown> = {
            activated: false,
            activationStatus: 'pending_approval',
            rejectionMessage: '',
          };
          if (payload.activationCode) {
            upd.activationCode = String(payload.activationCode).slice(0, 32);
          }
          const userPath = `${COLLECTIONS.users}/${docId}`;
          try {
            await updateDoc(doc(db, COLLECTIONS.users, docId), upd);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          }
        }
        await writeAct(
          uname,
          payload.actionType || 'activation_utr',
          payload.activityText || `Submitted ${entry.type}`,
          'payment',
          'info',
          entry.contact
        );
        return entry;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.CREATE, utrPath);
        } catch {
          if (!firestoreRulesBlocked) throw error;
        }
      }
    }

    const res = await apiJson<{ success?: boolean; entry?: Record<string, unknown> }>(
      '/api/users/utr',
      {
        method: 'POST',
        body: JSON.stringify({
          username: uname,
          record: entry,
          activationCode: payload.activationCode,
          actionType: payload.actionType,
          activityText: payload.activityText,
        }),
      }
    );
    return res.data?.entry || entry;
  },

  async markActivationPending(u: string, code = '') {
    if (!firestoreRulesBlocked) {
      const user = await findUser(u);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const upd: Record<string, unknown> = {
          activated: false,
          activationStatus: 'pending_approval',
          rejectionMessage: '',
        };
        if (code) upd.activationCode = String(code).slice(0, 32);
        const path = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), upd);
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, path);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/users/activate', {
      method: 'POST',
      body: JSON.stringify({ username: u, activationCode: code, pendingOnly: true }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async recordTransaction(payload: {
    id?: string;
    type?: 'credit' | 'debit' | 'payout';
    utr?: string;
    username: string;
    amount: number;
    timestamp: string;
    balance: number;
    commission: number;
    smsRecord?: {
      id?: string;
      bankName?: string;
      senderCode?: string;
      accountNumber?: string;
    };
  }) {
    if (!firestoreRulesBlocked) {
      const user = await findUser(payload.username);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const amountNum = Math.max(0, Number(payload.amount || 0));
        const ts = String(payload.timestamp || new Date().toISOString()).slice(0, 64);
        const txnType =
          payload.type === 'debit' ? 'debit' : payload.type === 'payout' ? 'payout' : 'credit';
        const txnEntry = {
          id: String(payload.id || safeId('TXN')).slice(0, 64),
          type: txnType,
          amount: amountNum,
          utr: String(payload.utr || '').slice(0, 32),
          balanceAfter: Math.max(0, Number(payload.balance || 0)),
          timestamp: ts,
        };
        const txns = Array.isArray(user.transactions)
          ? [...user.transactions, txnEntry].slice(-200)
          : [txnEntry];

        const userPath = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            balance: Math.max(0, Number(payload.balance || 0)),
            commission: Math.max(0, Number(payload.commission || 0)),
            transactions: txns,
          });
          if (payload.smsRecord) {
            const smsId = sanitizeSafeId(String(payload.smsRecord.id || ''), 'SMS');
            const smsPath = `${COLLECTIONS.smsLogs}/${smsId}`;
            try {
              await setDoc(doc(db, COLLECTIONS.smsLogs, smsId), {
                id: smsId,
                username: String(payload.username || '').slice(0, 64),
                bankName: String(payload.smsRecord.bankName || 'Linked Bank').slice(0, 120),
                senderCode: String(payload.smsRecord.senderCode || 'BANK-SMS').slice(0, 32),
                amount: amountNum,
                accountNumber: String(payload.smsRecord.accountNumber || '').slice(0, 32),
                timestamp: ts,
              });
            } catch (smsErr) {
              handleFirestoreError(smsErr, OperationType.CREATE, smsPath);
            }
          }
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/users/transaction', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async removeBankData(u: string) {
    if (!firestoreRulesBlocked) {
      const user = await findUser(u);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const path = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            accountDetails: null,
            autodebitDetails: null,
            activated: false,
            activationStatus: 'not_submitted',
            rejectionMessage: '',
            balance: 0,
            commission: 0,
            transactions: [],
          });
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, path);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/users/remove-bank', {
      method: 'POST',
      body: JSON.stringify({ username: u }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  logActivity: writeAct,

  subscribeAdminDashboard(
    cb: (state: {
      usersMap: Record<string, UserRecord>;
      utrs: Record<string, unknown>[];
      activityLogs: Record<string, unknown>[];
      smsLogs: Record<string, unknown>[];
    }) => void
  ): () => void {
    const state = {
      usersMap: {} as Record<string, UserRecord>,
      utrs: [] as Record<string, unknown>[],
      activityLogs: [] as Record<string, unknown>[],
      smsLogs: [] as Record<string, unknown>[],
    };
    const emit = () => cb({ ...state });

    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const fsUnsubs: Unsubscribe[] = [];

    const stopFs = () => {
      while (fsUnsubs.length > 0) {
        const fn = fsUnsubs.pop();
        if (fn) fn();
      }
    };

    const startPolling = () => {
      if (stopped || pollTimer) return;
      stopFs();
      const tick = async () => {
        if (stopped) return;
        const token = getStoredAdminToken();
        if (!token) return;
        const res = await apiJson<{
          success?: boolean;
          usersMap?: Record<string, UserRecord>;
          utrs?: Record<string, unknown>[];
          activityLogs?: Record<string, unknown>[];
          smsLogs?: Record<string, unknown>[];
        }>('/api/admin/dashboard-data', {
          headers: { 'x-admin-token': token },
        });
        if (!stopped && res.ok && res.data?.success) {
          state.usersMap = res.data.usersMap || {};
          state.utrs = res.data.utrs || [];
          state.activityLogs = res.data.activityLogs || [];
          state.smsLogs = res.data.smsLogs || [];
          emit();
        }
      };
      void tick();
      pollTimer = setInterval(() => {
        void tick();
      }, 2500);
    };

    if (firestoreRulesBlocked) {
      startPolling();
      return () => {
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    const onFsErr = (error: unknown, path: string) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        if (firestoreRulesBlocked) startPolling();
      }
    };

    fsUnsubs.push(
      onSnapshot(
        collection(db, COLLECTIONS.users),
        (snap) => {
          const m: Record<string, UserRecord> = {};
          snap.forEach((d) => {
            const v = d.data() as UserRecord;
            if (v?.username && v.username !== 'demo') {
              m[v.username] = v;
            }
          });
          state.usersMap = m;
          emit();
        },
        (err) => onFsErr(err, COLLECTIONS.users)
      )
    );

    fsUnsubs.push(
      onSnapshot(
        query(collection(db, COLLECTIONS.utrs), orderBy('timestamp', 'desc'), limit(300)),
        (snap) => {
          state.utrs = snap.docs.map((d) => d.data() as Record<string, unknown>);
          emit();
        },
        (err) => onFsErr(err, COLLECTIONS.utrs)
      )
    );

    fsUnsubs.push(
      onSnapshot(
        query(collection(db, COLLECTIONS.activityLogs), orderBy('timestamp', 'desc'), limit(500)),
        (snap) => {
          state.activityLogs = snap.docs.map((d) => d.data() as Record<string, unknown>);
          emit();
        },
        (err) => onFsErr(err, COLLECTIONS.activityLogs)
      )
    );

    fsUnsubs.push(
      onSnapshot(
        query(collection(db, COLLECTIONS.smsLogs), orderBy('timestamp', 'desc'), limit(300)),
        (snap) => {
          state.smsLogs = snap.docs.map((d) => d.data() as Record<string, unknown>);
          emit();
        },
        (err) => onFsErr(err, COLLECTIONS.smsLogs)
      )
    );

    return () => {
      stopped = true;
      stopFs();
      if (pollTimer) clearInterval(pollTimer);
    };
  },

  async adminApproveUtr(utrId: string, uname: string) {
    if (!firestoreRulesBlocked) {
      const ref = doc(db, COLLECTIONS.utrs, utrId);
      const utrPath = `${COLLECTIONS.utrs}/${utrId}`;
      let data: Record<string, unknown> | null = null;
      try {
        const snap = await getDoc(ref);
        data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        const is199 = Boolean(
          data &&
            (Number(data.amount) === 199 ||
              String(data.type || '').includes('199') ||
              String(data.type || '').toLowerCase().includes('upgrade'))
        );
        await updateDoc(ref, {
          status: is199 ? '✓ Approved & Receipt Generated' : '✓ Approved & Activated',
        });
        const user = await findUser(uname);
        if (user) {
          const docId = user.docId || toDocId(user.username);
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            activated: true,
            activationStatus: 'approved',
            rejectionMessage: '',
          });
        }
        return true;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, utrPath);
        } catch {
          if (!firestoreRulesBlocked) throw error;
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/admin/utr/approve', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ utrId, username: uname }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async adminRejectUtr(utrId: string, uname: string) {
    if (!firestoreRulesBlocked) {
      const utrPath = `${COLLECTIONS.utrs}/${utrId}`;
      try {
        await updateDoc(doc(db, COLLECTIONS.utrs, utrId), {
          status: '❌ Rejected (Invalid UTR)',
        });
        const user = await findUser(uname);
        if (user) {
          const docId = user.docId || toDocId(user.username);
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            activated: false,
            activationStatus: 'rejected',
            rejectionMessage: 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.',
          });
        }
        return true;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, utrPath);
        } catch {
          if (!firestoreRulesBlocked) throw error;
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/admin/utr/reject', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ utrId, username: uname }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async adminApproveUserPanel(uname: string) {
    if (!firestoreRulesBlocked) {
      const user = await findUser(uname);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const userPath = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            activated: true,
            activationStatus: 'approved',
            rejectionMessage: '',
          });
          return { ...user, activated: true, activationStatus: 'approved' as const, rejectionMessage: '' };
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean; user?: UserRecord }>('/api/admin/approve-user', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ username: uname }),
    });
    return res.ok && res.data?.success ? res.data.user || null : null;
  },

  async adminRejectUserPayment(uname: string) {
    const msg = 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    if (!firestoreRulesBlocked) {
      const user = await findUser(uname);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const userPath = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            activated: false,
            activationStatus: 'rejected',
            rejectionMessage: msg,
          });
          return { ...user, activated: false, activationStatus: 'rejected' as const, rejectionMessage: msg };
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean; user?: UserRecord }>('/api/admin/reject-user', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ username: uname }),
    });
    return res.ok && res.data?.success ? res.data.user || null : null;
  },

  async adminToggleUserActivation(uname: string, curr: boolean) {
    if (!firestoreRulesBlocked) {
      const user = await findUser(uname);
      if (user && !firestoreRulesBlocked) {
        const next = !curr;
        const status = next ? ('approved' as const) : ('rejected' as const);
        const msg = next ? '' : 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
        const docId = user.docId || toDocId(user.username);
        const userPath = `${COLLECTIONS.users}/${docId}`;
        try {
          await updateDoc(doc(db, COLLECTIONS.users, docId), {
            activated: next,
            activationStatus: status,
            rejectionMessage: msg,
          });
          return { ...user, activated: next, activationStatus: status, rejectionMessage: msg };
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.UPDATE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean; user?: UserRecord }>('/api/admin/toggle-user', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ username: uname }),
    });
    return res.ok && res.data?.success ? res.data.user || null : null;
  },

  async adminDeleteUser(uname: string) {
    if (!firestoreRulesBlocked) {
      const user = await findUser(uname);
      if (user && !firestoreRulesBlocked) {
        const docId = user.docId || toDocId(user.username);
        const userPath = `${COLLECTIONS.users}/${docId}`;
        try {
          await deleteDoc(doc(db, COLLECTIONS.users, docId));
          return true;
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.DELETE, userPath);
          } catch {
            if (!firestoreRulesBlocked) throw error;
          }
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
      body: JSON.stringify({ username: uname }),
    });
    return Boolean(res.ok && res.data?.success);
  },

  async adminClearLogs() {
    if (!firestoreRulesBlocked) {
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.activityLogs));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        return true;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.activityLogs);
        } catch {
          if (!firestoreRulesBlocked) throw error;
        }
      }
    }

    const res = await apiJson<{ success?: boolean }>('/api/admin/clear-logs', {
      method: 'POST',
      headers: { 'x-admin-token': getStoredAdminToken() },
    });
    return Boolean(res.ok && res.data?.success);
  },
};

declare global {
  interface Window {
    FirebaseStore?: typeof store;
    __firebaseTsLoadFailed?: boolean;
  }
}

window.FirebaseStore = store;
window.dispatchEvent(new CustomEvent('firebase-store-ready', { detail: store }));

export default store;

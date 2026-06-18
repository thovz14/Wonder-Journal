// ═══════════════════════════════════════════════
//  Wonder Journal — app.js (gedeeld door alle pagina's)
// ═══════════════════════════════════════════════

// ─── POCKETBASE CONFIG ───
const PB_URL = 'http://192.168.88.73:8090';

// ─── THEME ───
const ThemeManager = {
  get: () => localStorage.getItem('wj_theme') || 'dark',
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wj_theme', theme);
  },
  toggle(x, y) {
    const next = this.get() === 'dark' ? 'light' : 'dark';
    const overlay = document.getElementById('theme-overlay');
    if (overlay) {
      overlay.style.setProperty('--tx', x + 'px');
      overlay.style.setProperty('--ty', y + 'px');
      overlay.style.background = next === 'light' ? '#f0ebe0' : '#05050b';
      overlay.classList.add('expanding');
      setTimeout(() => {
        this.apply(next);
        overlay.classList.remove('expanding');
      }, 560);
    } else {
      this.apply(next);
    }
    return next;
  },
  init() { this.apply(this.get()); }
};

// ─── AES ENCRYPTIE (Web Crypto API) ───
const Crypto = {
  async getKey(uid) {
    const raw = new TextEncoder().encode(uid.padEnd(32, '0').slice(0, 32));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  },
  async encrypt(uid, plaintext) {
    const key = await this.getKey(uid);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
    const combined = new Uint8Array(12 + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), 12);
    return btoa(String.fromCharCode(...combined));
  },
  async decrypt(uid, b64) {
    try {
      const key = await this.getKey(uid);
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const iv = bytes.slice(0, 12);
      const data = bytes.slice(12);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(plain);
    } catch { return null; }
  }
};

// ─── INDEXEDDB ───
const DB = {
  _db: null,
  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('WonderJournal', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'date' });
          s.createIndex('by_date', 'date');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },
  async put(store, obj) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = res; tx.onerror = rej;
    });
  },
  async get(store, key) {
    const db = await this.open();
    return new Promise((res) => {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  },
  async getAll(store) {
    const db = await this.open();
    return new Promise((res) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  },
  async getMeta(key) {
    const r = await this.get('meta', key);
    return r ? r.value : null;
  },
  async setMeta(key, value) {
    await this.put('meta', { key, value });
  }
};

// ─── POCKETBASE SYNC ───
const PBSync = {
  async _req(method, path, body) {
    const user = Session.getUser();
    const token = user?.token || '';
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': token }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${PB_URL}/api/${path}`, opts);
      if (!res.ok) throw new Error(`PB ${res.status}`);
      return await res.json();
    } catch(e) {
      console.warn('PocketBase request failed:', e.message);
      return null;
    }
  },

  async syncEntry(uid, entry, encryptedText) {
    // Zoek bestaande record op date + user
    const search = await this._req('GET',
      `collections/entries/records?filter=(user="${uid}" %26%26 date="${entry.date}")&perPage=1`
    );
    const existing = search?.items?.[0];
    const data = {
      user: uid,
      date: entry.date,
      mood: entry.mood || '',
      steps: entry.steps || 0,
      text_enc: encryptedText || '',
      ts: entry.ts || Date.now()
    };
    if (existing) {
      await this._req('PATCH', `collections/entries/records/${existing.id}`, data);
    } else {
      await this._req('POST', 'collections/entries/records', data);
    }
  },

  async fetchAll(uid) {
    const result = await this._req('GET',
      `collections/entries/records?filter=(user="${uid}")&perPage=500`
    );
    return result?.items || [];
  },

  async fetchUser(uid) {
    return await this._req('GET', `collections/users/records/${uid}`);
  }
};

// ─── SESSION ───
const Session = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('wonderUser') || 'null'); } catch { return null; }
  },
  getUID() { return this.getUser()?.wonderId || null; },
  requireAuth(redirectPath = 'index.html') {
    const u = this.getUser();
    if (!u?.isLoggedIn || !u?.wonderId) {
      window.location.href = redirectPath;
      return false;
    }
    return true;
  },
  async refreshLive() {
    const u = this.getUser();
    if (!u?.wonderId) return;
    try {
      // 1. Haal verse user data op
      const record = await PBSync.fetchUser(u.wonderId);
      if (record) {
        let avatarVal = record.profilePicSelection;
        // Als profilePicSelection bijv. 'avatar1' is (zonder extensie of data/http), gebruik dan record.avatar
        if (avatarVal && !avatarVal.startsWith('http') && !avatarVal.startsWith('data:') && !avatarVal.includes('.')) {
          avatarVal = record.avatar || '';
        } else if (!avatarVal) {
          avatarVal = record.avatar || '';
        }
        
        if (avatarVal && avatarVal.startsWith('data:')) {
          // Base64 image, do nothing
        } else if (avatarVal && !avatarVal.startsWith('http') && avatarVal.length > 5 && avatarVal.includes('.')) {
          avatarVal = `${PB_URL}/api/files/users/${record.id}/${avatarVal}?token=${u.token}`;
        }
        
        // Check of foto een emoji of data url is
        if (avatarVal && (avatarVal.match(/[\u{1F300}-\u{1F6FF}]/u) || avatarVal.startsWith('data:'))) {
           // It's an emoji or base64 data, leave it
        } else if (avatarVal) {
          // voeg een cache-buster toe zodat hij altijd de nieuwste versie forceert
          avatarVal = avatarVal + (avatarVal.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
        
        u.name = record.name || record.email?.split('@')[0] || 'Wonder Gebruiker';
        u.avatar = avatarVal;
        localStorage.setItem('wonderUser', JSON.stringify(u));
      }
      
      // 2. Haal verse entries op uit de cloud en zet in IndexedDB
      const cloudEntries = await PBSync.fetchAll(u.wonderId);
      for (const ce of cloudEntries) {
        const local = await DB.get('entries', ce.date);
        if (!local || local.ts < ce.ts) {
          // Cloud is nieuwer of bestaat niet lokaal -> opslaan lokaal
          await DB.put('entries', {
            date: ce.date,
            mood: ce.mood,
            steps: ce.steps,
            text_enc: ce.text_enc,
            ts: ce.ts
          });
        }
      }
    } catch(e) { console.warn('Live refresh failed', e); }
  }
};

// ─── ENTRY HELPERS ───
const dateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const Entries = {
  async save(uid, { date, mood, steps, text }) {
    const encText = text ? await Crypto.encrypt(uid, text) : '';
    const entry = { date, mood, steps: steps || 0, text_enc: encText, ts: Date.now() };
    await DB.put('entries', entry);
    await PBSync.syncEntry(uid, entry, encText);
    await StreakManager.update();
    await NotifManager.scheduleReminder();
  },
  async load(date) {
    return DB.get('entries', date);
  },
  async loadDecrypted(uid, date) {
    const e = await DB.get('entries', date);
    if (!e) return null;
    const text = e.text_enc ? (await Crypto.decrypt(uid, e.text_enc)) || '' : '';
    return { ...e, text };
  },
  async getAll() { return DB.getAll('entries'); },
  async getAllDecrypted(uid) {
    const all = await this.getAll();
    return Promise.all(all.map(async e => ({
      ...e,
      text: e.text_enc ? (await Crypto.decrypt(uid, e.text_enc)) || '' : ''
    })));
  }
};

// ─── STREAK MANAGER ───
const StreakManager = {
  async getCurrent() {
    const all = await DB.getAll('entries');
    if (!all.length) return 0;
    const dates = all.map(e => e.date).sort().reverse();
    const today = dateStr();
    let streak = 0;
    let check = new Date();
    for (let i = 0; i < 365; i++) {
      const d = dateStr(check);
      if (dates.includes(d)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else if (d === today) {
        check.setDate(check.getDate() - 1); // today not yet filled = skip
      } else break;
    }
    return streak;
  },
  async update() {
    const streak = await this.getCurrent();
    const prev = (await DB.getMeta('last_streak')) || 0;
    await DB.setMeta('last_streak', streak);
    if ([3, 7, 30].includes(streak) && streak !== prev) {
      showStreakBadge(streak);
      showConfetti();
    }
  }
};

// ─── CONFETTI ───
function showConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#7c3aed','#6366f1','#22c55e','#f97316','#fbbf24','#ec4899'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.cssText = `
      left:${Math.random()*100}%;
      width:${6+Math.random()*8}px;
      height:${6+Math.random()*8}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${2+Math.random()*2}s;
      animation-delay:${Math.random()*0.5}s;
    `;
    container.appendChild(p);
  }
  setTimeout(() => container.innerHTML = '', 4500);
}

function showStreakBadge(days) {
  const overlay = document.getElementById('streak-overlay');
  if (!overlay) return;
  const emojis = { 3:'🔥', 7:'⚡', 30:'👑' };
  const titles = { 3:'3 Dagen op rij!', 7:'Een week streak!', 30:'30 Dagen — Legende!' };
  overlay.querySelector('.badge-emoji').textContent = emojis[days] || '🎉';
  overlay.querySelector('.badge-title').textContent = titles[days] || `${days} dagen!`;
  overlay.querySelector('.badge-subtitle').textContent = `Je hebt ${days} dagen achter elkaar geschreven. Geweldig!`;
  overlay.classList.add('visible');
}

// ─── PUSH NOTIFICATIES ───
const NotifManager = {
  async requestPermission() {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },
  async scheduleReminder() {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: 'SCHEDULE_REMINDER' });
    }
  },
  async checkYearEnd() {
    const now = new Date();
    if (now.getMonth() === 11 && now.getDate() === 31) {
      this.triggerYearWrap();
    }
  },
  async triggerYearWrap() {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: 'YEAREND_WRAPPED',
        body: 'Bekijk jouw Wonder Jaaroverzicht — jouw verhaal van dit jaar!'
      });
    }
  }
};

// Navigator: luister op CHECK_REMINDER van SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data?.type === 'CHECK_REMINDER') {
      const entry = await Entries.load(dateStr());
      if (!entry || !entry.text_enc) {
        if (Notification.permission === 'granted') {
          const msgs = [
            { title: '✨ Wonder Journal', body: 'Hoe was je dag? Schrijf even iets.' },
            { title: '🔥 Streak Alert!', body: 'Schrijf nu om je streak te bewaren!' },
            { title: '🌙 Wonder Journal', body: 'De dag loopt bijna ten einde...' },
          ];
          const m = msgs[Math.floor(Math.random()*msgs.length)];
          new Notification(m.title, { body: m.body, icon: '/icons/icon-192.png' });
        }
      }
    }
  });
}

// ─── WEBAUTHN ───
const WebAuthnManager = {
  async register() {
    try {
      const uid = Session.getUID();
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Wonder Journal' },
          user: { id: new TextEncoder().encode(uid), name: uid, displayName: 'Wonder User' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { userVerification: 'required' },
          timeout: 60000
        }
      });
      await DB.setMeta('webauthn_id', btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
      await DB.setMeta('webauthn_enabled', true);
      return true;
    } catch(e) { console.error(e); return false; }
  },
  async verify() {
    const enabled = await DB.getMeta('webauthn_enabled');
    if (!enabled) return true;
    const id = await DB.getMeta('webauthn_id');
    if (!id) return true;
    try {
      const rawId = Uint8Array.from(atob(id), c => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      return true;
    } catch { return false; }
  },
  async isEnabled() { return !!(await DB.getMeta('webauthn_enabled')); }
};

// ─── NAV INDICATOR ───
function updateNavIndicator(activeBtn) {
  const indicator = document.getElementById('nav-indicator');
  if (!indicator || !activeBtn) return;
  const nav = document.querySelector('.bottom-nav');
  const navRect = nav.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  const left = btnRect.left - navRect.left;
  indicator.style.transform = `translateX(${left}px)`;
  indicator.style.width = `${btnRect.width}px`;
}

function initNav(currentPage) {
  const pages = {
    dashboard: { id: 'nav-dashboard', href: 'dashboard.html' },
    insights:  { id: 'nav-insights',  href: 'insights.html'  },
    calendar:  { id: 'nav-calendar',  href: 'calendar.html'  },
    settings:  { id: 'nav-settings',  href: 'settings.html'  }
  };

  Object.entries(pages).forEach(([page, cfg]) => {
    const btn = document.getElementById(cfg.id);
    if (!btn) return;
    // Vervang de inline onclick met een cache-busting navigatie
    btn.onclick = null;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (page === currentPage) return; // al op deze pagina
      window.location.href = `${cfg.href}?v=${Date.now()}`;
    });
  });

  const activeId = pages[currentPage]?.id;
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) {
    activeBtn.classList.add('active');
    setTimeout(() => updateNavIndicator(activeBtn), 50);
  }
}

// ─── HEALTH STEPS API ───
const HealthManager = {
  async getStepsToday() {
    if ('health' in navigator) {
      try {
        const r = await navigator.health.query({
          startTime: new Date(new Date().setHours(0,0,0,0)).toISOString(),
          endTime: new Date().toISOString(),
          metrics: ['steps']
        });
        return r?.steps?.total || 0;
      } catch { return 0; }
    }
    return 0;
  }
};

// ─── JAAR OVERZICHT ───
async function showYearWrap(uid) {
  const entries = await Entries.getAllDecrypted(uid);
  const year = new Date().getFullYear();
  const yearEntries = entries.filter(e => e.date.startsWith(year));
  const totalDays = yearEntries.length;
  const totalSteps = yearEntries.reduce((s, e) => s + (e.steps || 0), 0);
  const moodCount = {};
  yearEntries.forEach(e => { if (e.mood) moodCount[e.mood] = (moodCount[e.mood]||0)+1; });
  const topMood = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || '😊';
  const heavyDays = yearEntries.filter(e => ['😢','😰'].includes(e.mood)).length;
  const ageGroup = await DB.getMeta('age_group') || 'adult';

  let advice = '';
  if (heavyDays > 30) {
    const adviceMap = {
      baby:   'Rust en knuffelmomentjes zijn het allerbelangrijkste.',
      child:  'Praat met een volwassene die je vertrouwt over hoe je je voelde.',
      teen:   'Je bent niet alleen. Durf met iemand te praten — een vriend, ouder of hulplijn.',
      adult:  'Zware tijden vragen om zorg voor jezelf. Overweeg professionele steun — het is een teken van kracht.',
      senior: 'Verbinding met anderen helpt enorm. Zoek sociale steun en praat met je huisarts als het zwaar blijft.'
    };
    advice = adviceMap[ageGroup] || adviceMap.adult;
  }

  const overlay = document.getElementById('yearwrap-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="yearwrap-story">
      <span class="yearwrap-emoji">${topMood}</span>
      <div class="yearwrap-title">Jouw ${year} in Beeld</div>
      <p class="yearwrap-body" style="margin-bottom:24px">
        Je schreef <strong>${totalDays} dagboekpagina's</strong> en liep gemiddeld
        <strong>${totalDays ? Math.round(totalSteps/totalDays).toLocaleString() : 0} stappen</strong> per dag.
        Je meest voorkomende gevoel was ${topMood}.
      </p>
      ${advice ? `<div class="insight-card"><p>💜 ${advice}</p></div>` : ''}
      <button class="btn btn-primary" style="margin-top:24px" onclick="document.getElementById('yearwrap-overlay').classList.remove('open')">Sluiten</button>
    </div>`;
  overlay.classList.add('open');
}

// ─── INSIGHTS BEREKENINGEN ───
function calcCorrelation(entries) {
  const valid = entries.filter(e => e.steps > 0 && e.mood);
  if (valid.length < 3) return null;
  const moodScore = { '😊':5,'😄':5,'😌':4,'😐':3,'😞':2,'😢':1,'😰':1,'😡':2,'🥱':3,'🤒':2 };
  const xs = valid.map(e => e.steps);
  const ys = valid.map(e => moodScore[e.mood] || 3);
  const n = xs.length;
  const meanX = xs.reduce((a,b)=>a+b,0)/n;
  const meanY = ys.reduce((a,b)=>a+b,0)/n;
  const num = xs.reduce((s,x,i)=>s+(x-meanX)*(ys[i]-meanY),0);
  const den = Math.sqrt(xs.reduce((s,x)=>s+(x-meanX)**2,0)*ys.reduce((s,y)=>s+(y-meanY)**2,0));
  return den === 0 ? 0 : (num/den).toFixed(2);
}

function getMoodDistribution(entries) {
  const dist = {};
  entries.forEach(e => { if (e.mood) dist[e.mood] = (dist[e.mood]||0)+1; });
  return dist;
}

// ─── SERVICE WORKER REGISTRATIE ───
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('SW registered:', reg.scope);
      NotifManager.scheduleReminder();
      NotifManager.checkYearEnd();
    } catch(e) { console.warn('SW reg failed:', e); }
  }
}

// Initialiseer bij laden
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  registerSW();
});
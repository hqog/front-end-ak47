'use strict';

// Anti-clickjacking : refuse de s'afficher dans une iframe
if (window.top !== window.self) { document.documentElement.replaceChildren(); throw new Error('iframe interdite'); }

// ───── Configuration ─────
const API = 'https://back-en-ak47.onrender.com';   // doit correspondre à connect-src dans index.html
const TOKEN_KEY = 'panel_token';
const NONCE_KEY = 'panel_nonce';

const PRESENCES = { online: 'En ligne', idle: 'Inactif', dnd: 'Ne pas déranger', invisible: 'Invisible' };
const ACTIVITIES = { playing: 'Joue à', watching: 'Regarde', listening: 'Écoute', competing: 'Participe à', streaming: 'Streame', custom: 'Statut personnalisé' };

// ───── Utilitaires ─────
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (s, k) => { try { return s.getItem(k); } catch { return null; } },
  set: (s, k, v) => { try { s.setItem(k, v); } catch { /* stockage bloqué */ } },
  del: (s, k) => { try { s.removeItem(k); } catch { /* ignoré */ } },
};

// Création de DOM sans innerHTML : le contenu venant du serveur reste du texte.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

const nf = new Intl.NumberFormat('fr-FR');
const num = (v) => nf.format(Number(v) || 0);
const randomHex = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

let token = null;
let me = null;
let view = 'home';
let refreshTimer = null;
let toastTimer = null;

// ───── Retour de Discord : #token=...&n=... ─────
function showLoginError(msg) {
  const e = $('err');
  e.textContent = msg;
  e.classList.remove('hidden');
}

function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;
  history.replaceState(null, '', location.pathname + location.search);   // efface le token de l'URL
  const p = new URLSearchParams(raw);
  const saved = store.get(sessionStorage, NONCE_KEY);
  store.del(sessionStorage, NONCE_KEY);
  if (p.get('error')) return showLoginError('Connexion Discord impossible. Réessaie.');
  const t = p.get('token');
  const n = p.get('n');
  if (!t || !n || !saved || n !== saved) return showLoginError('Connexion refusée : vérification échouée. Réessaie.');
  store.set(sessionStorage, TOKEN_KEY, t);
}

function startLogin(e) {
  e.preventDefault();
  const n = randomHex();
  store.set(sessionStorage, NONCE_KEY, n);
  location.href = `${API}/auth/discord?n=${n}`;
}

function logout() {
  const old = token;
  store.del(sessionStorage, TOKEN_KEY);
  store.del(localStorage, TOKEN_KEY);   // ancien emplacement du token
  clearInterval(refreshTimer);
  token = null;
  if (old) fetch(`${API}/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${old}` } }).catch(() => {});   // révoque le token côté serveur
  me = null;
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
}

// ───── API ─────
async function api(path, opts = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (opts.body) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(API + path, { ...opts, headers }); }
  catch { throw new Error('Serveur injoignable. Réessaie dans un instant.'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('Session expirée, reconnecte-toi.'); }
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

async function loadMe() {
  me = await api('/api/me');
  $('avatar').src = me.avatar;
  $('username').textContent = me.username;
  $('sync').textContent = me.synced ? `Synchronisé à ${new Date(me.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'En attente du bot';
}

// Envoie une action, puis attend que le bot la traite.
async function sendAction(payload) {
  const { id } = await api('/api/actions', { method: 'POST', body: JSON.stringify(payload) });
  for (let i = 0; i < 50; i++) {
    await sleep(1500);
    const a = await api(`/api/actions/${id}`);
    if (a.status === 'done') {
      if (a.result && a.result.ok) return a.result.message || 'Fait.';
      throw new Error((a.result && a.result.error) || 'Le bot a refusé la demande.');
    }
  }
  throw new Error('Le bot ne répond pas. Réessaie plus tard.');
}

function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = kind || '';
  clearTimeout(toastTimer);
  if (kind) toastTimer = setTimeout(() => t.classList.add('hidden'), 5000);
}

// Lance une action depuis un bouton : état de chargement, message, rafraîchissement.
const HIST_KEY = 'panel_hist';
const LABELS = { renew: 'Renouvellement', settings: 'Statut du bot', groups: 'Catégories', promo: 'Code promo', promo_create: 'Création de code', credits: 'Ajustement de crédits' };
function loadHist() {
  try { const l = JSON.parse(store.get(sessionStorage, HIST_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function pushHist(type, ok, msg) {
  store.set(sessionStorage, HIST_KEY, JSON.stringify([{ at: Date.now(), type, ok, msg }, ...loadHist()].slice(0, 30)));
}

async function run(btn, payload) {
  btn.disabled = true;
  let sent = false;
  toast('Demande envoyée au bot…');
  try {
    const msg = await sendAction(payload);
    sent = true;
    pushHist(payload.type, true, msg);
    toast(msg, 'ok');
    await loadMe();
    render();
  } catch (err) {
    if (!sent) pushHist(payload.type, false, err.message);
    toast(err.message, 'bad');
  } finally {
    btn.disabled = false;
  }
}

// ───── Vues ─────
function field(label, control) {
  return h('div', { class: 'field' }, h('label', {}, label), control);
}

function select(options, current) {
  return h('select', {}, Object.entries(options).map(([v, l]) => h('option', { value: v, selected: v === current }, l)));
}

function dateOf(v) {
  if (v == null) return null;
  const d = new Date(typeof v === 'number' && v < 1e12 ? v * 1000 : v);
  return Number.isNaN(d.getTime()) ? null : d;
}
const expiryOf = (b) => dateOf(b.expiresAt ?? b.expires ?? b.expiry ?? b.endsAt);
const botName = (b, i) => b.name || b.username || b.botName || `Bot ${i + 1}`;

function homeView() {
  const d = me.data;
  const out = [h('h1', {}, `Salut ${me.username}`)];
  if (!d) {
    out.push(h('p', { class: 'notice' }, 'Le bot n’a pas encore envoyé tes données. Réessaie dans une minute.'));
    return out;
  }
  d.bots.forEach((b, i) => {
    const exp = expiryOf(b);
    if (!exp) return;
    const days = Math.ceil((exp - Date.now()) / 864e5);
    if (days > 3) return;
    out.push(h('div', { class: 'notice alert' },
      h('span', {}, days <= 0 ? `${botName(b, i)} a expiré.` : `${botName(b, i)} expire dans ${days} jour${days > 1 ? 's' : ''}.`),
      h('button', { class: 'btn', onclick: () => { view = 'bots'; render(); } }, 'Renouveler')));
  });
  out.push(h('div', { class: 'stats' },
    h('div', { class: 'stat main' }, h('b', {}, num(d.credits)), h('span', { class: 'muted' }, 'crédits')),
    h('div', { class: 'stat' }, h('b', {}, num(d.bots.length)), h('span', { class: 'muted' }, 'bots')),
    h('div', { class: 'stat' }, h('b', {}, num(d.referral.count)), h('span', { class: 'muted' }, 'parrainages')),
    h('div', { class: 'stat' }, h('b', {}, num(d.vouches.count)), h('span', { class: 'muted' }, 'avis')),
  ));
  if (d.referral.earned) out.push(h('p', { class: 'muted' }, `Tes parrainages t’ont rapporté ${num(d.referral.earned)} crédits.`));
  return out;
}

function botCard(b, i) {
  const name = b.name || b.username || b.botName || `Bot ${i + 1}`;
  const exp = expiryOf(b);
  const expired = exp && exp < new Date();
  const head = h('header', {},
    h('h3', {}, name),
    exp ? h('span', { class: `tag ${expired ? 'ko' : 'ok'}` }, `${expired ? 'Expiré le' : 'Actif jusqu’au'} ${exp.toLocaleDateString('fr-FR')}`) : null,
  );

  // Renouveler
  const planSel = h('select', {}, me.plans.map((p) => {
    const cost = p.price ?? p.credits ?? p.cost;
    return h('option', { value: p.days }, `${p.days} jours${cost != null ? ` — ${num(cost)} crédits` : ''}`);
  }));
  const renewBtn = h('button', { class: 'btn', onclick: () => run(renewBtn, { type: 'renew', key: b.key, days: Number(planSel.value) }) }, 'Renouveler');
  const renew = h('details', {}, h('summary', {}, 'Renouveler'),
    me.plans.length ? [field('Durée', planSel), renewBtn] : h('p', { class: 'muted' }, 'Aucune durée disponible pour le moment.'));

  // Paramètres
  const presence = select(PRESENCES, b.presence || 'online');
  const actType = select(ACTIVITIES, b.activityType || 'playing');
  const actText = h('input', { type: 'text', maxlength: 128, value: b.activityText || '' });
  const saveBtn = h('button', { class: 'btn', onclick: () => run(saveBtn, { type: 'settings', key: b.key, presence: presence.value, activityType: actType.value, activityText: actText.value }) }, 'Enregistrer');
  const preview = h('p', { class: 'preview' });
  const updPreview = () => preview.replaceChildren(h('span', { class: `dot ${presence.value}` }), h('b', {}, PRESENCES[presence.value]), ` ${ACTIVITIES[actType.value]} ${actText.value}`.trimEnd());
  [presence, actType, actText].forEach((el) => el.addEventListener('input', updPreview));
  updPreview();
  const settings = h('details', {}, h('summary', {}, 'Statut du bot'),
    field('Présence', presence), field('Activité', actType), field('Texte de l’activité', actText), h('div', { class: 'field' }, h('label', {}, 'Aperçu'), preview), saveBtn);

  // Catégories
  const current = new Set(Array.isArray(b.groups) ? b.groups.map(String) : []);
  const boxes = me.groups.map((g) => h('label', {}, h('input', { type: 'checkbox', value: g, checked: current.has(g) }), g));
  const groupsBtn = h('button', { class: 'btn', onclick: () => run(groupsBtn, { type: 'groups', key: b.key, groups: boxes.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c.value) }) }, 'Enregistrer les catégories');
  const groups = h('details', {}, h('summary', {}, 'Catégories'),
    me.groups.length ? [h('div', { class: 'checks' }, boxes), groupsBtn] : h('p', { class: 'muted' }, 'Aucune catégorie disponible.'));

  return h('section', { class: 'panel' }, head, renew, settings, groups);
}

function botsView() {
  const bots = me.data ? me.data.bots : [];
  const out = [h('h1', {}, 'Mes bots')];
  if (!me.data) out.push(h('p', { class: 'notice' }, 'En attente des données du bot…'));
  else if (!bots.length) out.push(h('p', { class: 'muted' }, 'Tu n’as aucun bot pour l’instant.'));
  else out.push(bots.map(botCard));
  return out;
}

function promoView() {
  const code = h('input', { type: 'text', maxlength: 40, placeholder: 'MONCODE', autocomplete: 'off' });
  const btn = h('button', { class: 'btn', onclick: () => { if (code.value.trim()) run(btn, { type: 'promo', code: code.value.trim() }); } }, 'Utiliser le code');
  const used = me.data ? me.data.redeemed : [];
  return [
    h('h1', {}, 'Code promo'),
    h('section', { class: 'panel' }, field('Ton code', code), btn),
    used.length ? h('section', { class: 'panel' }, h('h3', {}, 'Codes déjà utilisés'),
      h('div', { class: 'row' }, used.map((u) => h('span', { class: 'tag' }, typeof u === 'string' ? u : (u.code || '—'))))) : null,
  ];
}

const stat = (label, v, main) => h('div', { class: `stat${main ? ' main' : ''}` }, h('b', {}, num(v)), h('span', { class: 'muted' }, label));
const waiting = () => h('p', { class: 'notice' }, 'En attente des données du bot…');

function kv(obj) {
  const rows = Object.entries(obj || {});
  if (!rows.length) return h('p', { class: 'muted' }, 'Aucune donnée.');
  return h('div', {}, rows.map(([k, v]) => (v !== null && typeof v === 'object'
    ? h('details', {}, h('summary', {}, k), h('pre', {}, JSON.stringify(v, null, 2).slice(0, 3000)))
    : h('div', { class: 'row kv' }, h('span', { class: 'muted' }, k), h('b', {}, typeof v === 'number' ? num(v) : String(v))))));
}

function referralView() {
  const r = me.data && me.data.referral;
  if (!r) return [h('h1', {}, 'Parrainage'), waiting()];
  const link = r.link || r.url || r.code;
  const copy = h('button', { class: 'btn ghost', onclick: () => navigator.clipboard.writeText(String(link)).then(() => toast('Copié', 'ok')).catch(() => toast('Copie impossible', 'bad')) }, 'Copier');
  return [
    h('h1', {}, 'Parrainage'),
    h('div', { class: 'stats' }, stat('Filleuls', r.count), stat('Ont payé', r.paid), stat('Crédits gagnés', r.earned, true)),
    link ? h('section', { class: 'panel' }, h('h3', {}, 'Ton lien'), h('div', { class: 'row' }, h('code', {}, String(link)), copy))
      : h('p', { class: 'muted' }, 'Le bot n’envoie pas encore ton lien de parrainage. Utilise la commande de parrainage sur Discord.'),
  ];
}

function vouchesView() {
  const v = me.data && me.data.vouches;
  if (!v) return [h('h1', {}, 'Avis'), waiting()];
  const list = Array.isArray(v.last) ? v.last : [];
  return [
    h('h1', {}, 'Avis'),
    h('p', { class: 'muted' }, `${num(v.count)} avis reçus.`),
    list.length ? list.map((x) => {
      const it = x && typeof x === 'object' ? x : { text: String(x) };
      const stars = Number(it.stars ?? it.rating);
      const when = dateOf(it.at ?? it.date ?? it.createdAt);
      return h('section', { class: 'panel' },
        h('header', {}, h('b', {}, String(it.username || it.author || it.from || it.user || 'Anonyme')), when ? h('small', { class: 'muted' }, when.toLocaleDateString('fr-FR')) : null),
        stars > 0 ? h('div', { class: 'stars' }, '★'.repeat(Math.min(5, Math.round(stars)))) : null,
        h('p', {}, String(it.text || it.message || it.comment || it.reason || '')));
    }) : h('p', { class: 'muted' }, 'Aucun avis pour le moment.'),
  ];
}

function economyView() {
  const e = me.data && me.data.economy;
  return [
    h('h1', {}, 'Économie'),
    me.data ? (e && typeof e === 'object' ? h('section', { class: 'panel' }, kv(e)) : h('p', { class: 'muted' }, 'Aucune donnée d’économie pour ton compte.')) : waiting(),
  ];
}

function historyView() {
  const list = loadHist();
  const clear = h('button', { class: 'btn ghost', onclick: () => { store.del(sessionStorage, HIST_KEY); render(); } }, 'Vider');
  return [
    h('h1', {}, 'Historique'),
    h('p', { class: 'muted' }, 'Tes actions de cette session.'),
    list.length ? [h('section', { class: 'panel' }, list.map((e) => h('div', { class: 'logrow' },
      h('small', { class: 'muted' }, new Date(e.at).toLocaleString('fr-FR')),
      h('span', {}, LABELS[e.type] || e.type),
      h('span', { class: `tag ${e.ok ? 'ok' : 'ko'}` }, e.ok ? 'Réussi' : 'Échec'),
      h('span', { class: 'muted' }, e.msg)))), clear] : h('p', { class: 'muted' }, 'Aucune action pour l’instant.'),
  ];
}

function memberCard(m) {
  const bots = Array.isArray(m.bots) ? m.bots : [];
  return h('section', { class: 'panel' },
    h('div', { class: 'stats' }, stat('Crédits', m.credits, true), stat('Bots', bots.length), stat('Filleuls', m.referral && m.referral.count), stat('Avis', m.vouches && m.vouches.count)),
    bots.length ? h('div', {}, bots.map((b, i) => {
      const exp = expiryOf(b);
      return h('div', { class: 'row kv' }, h('b', {}, botName(b, i)), h('span', { class: 'muted' }, exp ? `jusqu’au ${exp.toLocaleDateString('fr-FR')}` : 'sans date'));
    })) : h('p', { class: 'muted' }, 'Aucun bot.'),
    m.economy && typeof m.economy === 'object' ? h('details', {}, h('summary', {}, 'Économie'), kv(m.economy)) : null);
}

function adminView() {
  const pCode = h('input', { type: 'text', maxlength: 40, placeholder: 'Laisser vide = code aléatoire' });
  const pCredits = h('input', { type: 'number', min: 1, max: 100000, value: 100 });
  const pUses = h('input', { type: 'number', min: 1, max: 10000, value: 1 });
  const pDays = h('input', { type: 'number', min: 0, max: 365, value: 0 });
  const pBtn = h('button', { class: 'btn', onclick: () => run(pBtn, { type: 'promo_create', code: pCode.value.trim(), credits: Number(pCredits.value), maxUses: Number(pUses.value), expiresDays: Number(pDays.value) }) }, 'Créer le code');

  const target = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'ID Discord du membre' });
  const amount = h('input', { type: 'number', min: -1000000, max: 1000000, value: 0 });
  const cBtn = h('button', { class: 'btn', onclick: () => run(cBtn, { type: 'credits', targetId: target.value.trim(), amount: Number(amount.value) }) }, 'Appliquer');

  // Recherche de membre
  const q = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'ID Discord du membre' });
  const found = h('div', {});
  const qBtn = h('button', { class: 'btn', onclick: async () => {
    qBtn.disabled = true;
    try {
      const { id, data } = await api(`/api/admin/user/${encodeURIComponent(q.value.trim())}`);
      const use = h('button', { class: 'btn ghost', onclick: () => { target.value = id; target.scrollIntoView({ block: 'center' }); } }, 'Ajuster ses crédits');
      found.replaceChildren(memberCard(data), use);
    } catch (err) { found.replaceChildren(); toast(err.message, 'bad'); }
    qBtn.disabled = false;
  } }, 'Chercher');

  // Codes promo (si le bot envoie la liste)
  const codes = me.admin && (me.admin.promos || me.admin.promoCodes || me.admin.codes || me.admin.promo_codes);
  const codesBox = Array.isArray(codes) && codes.length
    ? h('div', {}, codes.map((c) => {
      const o = c && typeof c === 'object' ? c : { code: String(c) };
      const used = o.uses ?? o.used ?? o.usedCount;
      const exp = dateOf(o.expiresAt ?? o.expires);
      return h('div', { class: 'row kv' }, h('b', {}, String(o.code ?? '—')),
        h('span', { class: 'muted' }, [o.credits != null ? `${num(o.credits)} crédits` : '', used != null ? `${num(used)}/${num(o.maxUses)} utilisés` : '', exp ? `expire le ${exp.toLocaleDateString('fr-FR')}` : ''].filter(Boolean).join(', ')));
    }))
    : h('p', { class: 'muted' }, 'Le bot n’envoie pas encore la liste des codes. Ajoute un champ « promos » à l’état qu’il synchronise pour l’afficher ici.');

  // Journal des actions admin
  const logBox = h('p', { class: 'muted' }, 'Chargement…');
  api('/api/admin/log').then(({ log }) => {
    logBox.replaceWith(log.length ? h('div', {}, log.map((e) => {
      const detail = e.type === 'credits' ? `${e.amount > 0 ? '+' : ''}${num(e.amount)} pour ${e.targetId}`
        : `${e.code || 'code automatique'}, ${num(e.credits)} crédits, ${num(e.maxUses)} utilisation(s)`;
      const st = { pending: ['', 'En attente'], done: ['ok', 'Fait'], failed: ['ko', 'Échec'] }[e.status] || ['', e.status];
      return h('div', { class: 'logrow' },
        h('small', { class: 'muted' }, new Date(e.at).toLocaleString('fr-FR')),
        h('span', {}, `${e.admin} : ${LABELS[e.type] || e.type}`),
        h('span', { class: `tag ${st[0]}` }, st[1]),
        h('span', { class: 'muted' }, e.message ? `${detail} (${e.message})` : detail));
    })) : h('p', { class: 'muted' }, 'Aucune action admin depuis le dernier redémarrage du serveur.'));
  }).catch((err) => { logBox.textContent = err.message; });

  return [
    h('h1', {}, 'Administration'),
    h('section', { class: 'panel' }, h('h2', {}, 'Chercher un membre'), field('ID Discord', q), qBtn, found),
    h('section', { class: 'panel' }, h('h2', {}, 'Créer un code promo'),
      field('Code', pCode), field('Crédits offerts', pCredits), field('Utilisations maximum', pUses), field('Expire après (jours, 0 = jamais)', pDays), pBtn),
    h('section', { class: 'panel' }, h('h2', {}, 'Codes promo existants'), codesBox),
    h('section', { class: 'panel' }, h('h2', {}, 'Ajuster les crédits'),
      field('Membre', target), field('Montant (négatif pour retirer)', amount), cBtn),
    h('section', { class: 'panel' }, h('h2', {}, 'Journal des actions admin'), logBox),
    me.admin ? h('section', { class: 'panel' }, h('details', {}, h('summary', {}, 'Données brutes'),
      h('pre', {}, JSON.stringify(me.admin, null, 2).slice(0, 5000)))) : null,
  ];
}

const VIEWS = {
  home: { label: 'Accueil', render: homeView },
  bots: { label: 'Mes bots', render: botsView },
  promo: { label: 'Code promo', render: promoView },
  referral: { label: 'Parrainage', render: referralView },
  vouches: { label: 'Avis', render: vouchesView },
  economy: { label: 'Économie', render: economyView },
  history: { label: 'Historique', render: historyView },
  admin: { label: 'Administration', render: adminView, admin: true },
};

function render() {
  if (!me) return;
  if (!VIEWS[view] || (VIEWS[view].admin && !me.isAdmin)) view = 'home';
  $('nav').replaceChildren(...Object.entries(VIEWS)
    .filter(([, v]) => !v.admin || me.isAdmin)
    .map(([id, v]) => h('button', { class: id === view ? 'on' : '', onclick: () => { view = id; render(); } }, v.label)));
  $('view').replaceChildren(...[VIEWS[view].render()].flat().filter(Boolean).flat());
}

// ───── Démarrage ─────
async function boot() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('view').replaceChildren(h('div', { class: 'spinner' }), h('p', { class: 'muted' }, 'Chargement… le serveur peut mettre une trentaine de secondes à se réveiller.'));
  try {
    await loadMe();
    render();
    // Le bot renvoie ses données chaque minute : on rafraîchit sans toucher aux formulaires en cours.
    refreshTimer = setInterval(() => loadMe().then(() => { if (view === 'home') render(); }).catch(() => {}), 60_000);
  } catch (err) {
    if (!token) return;   // déconnecté pendant le chargement
    $('view').replaceChildren(h('p', { class: 'notice' }, err.message), h('button', { class: 'btn', onclick: boot }, 'Réessayer'));
  }
}

// Thème : choix mémorisé, sinon réglage du téléphone
const THEME_KEY = 'panel_theme';
const applyTheme = (t) => { document.documentElement.dataset.theme = t; store.set(localStorage, THEME_KEY, t); themeBtn.textContent = t === 'light' ? 'Thème sombre' : 'Thème clair'; };
const themeBtn = h('button', { class: 'btn ghost', onclick: () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light') });
$('logout').before(themeBtn);
applyTheme(store.get(localStorage, THEME_KEY) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

readHash();
store.del(localStorage, TOKEN_KEY);
token = store.get(sessionStorage, TOKEN_KEY);
$('loginBtn').addEventListener('click', startLogin);
$('logout').addEventListener('click', logout);
if (token) boot();

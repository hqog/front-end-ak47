'use strict';

if (window.top !== window.self) { document.documentElement.replaceChildren(); throw new Error('iframe interdite'); }

const API = 'https://back-en-ak47.onrender.com';
const TOKEN_KEY = 'panel_token';
const NONCE_KEY = 'panel_nonce';
const HIST_KEY = 'panel_hist';
const THEME_KEY = 'panel_theme';

const PRESENCES = { online: 'En ligne', idle: 'Inactif', dnd: 'Ne pas déranger', invisible: 'Invisible' };
const ACTIVITIES = { playing: 'Joue à', watching: 'Regarde', listening: 'Écoute', competing: 'Participe à', streaming: 'Streame', custom: 'Statut personnalisé' };
const LABELS = { renew: 'Renouvellement', settings: 'Statut du bot', groups: 'Catégories', promo: 'Code promo', promo_create: 'Création de code', credits: 'Ajustement de crédits' };

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  bot: 'M5 8h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 8V4M9 13h.01M15 13h.01M9.5 16.2h5',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  chart: 'M5 21V11M12 21V3M19 21v-7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 6.5v11M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};
const NAV_ICONS = { home: 'home', bots: 'bot', promo: 'tag', referral: 'users', vouches: 'star', economy: 'chart', history: 'clock', admin: 'shield' };

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (s, k) => { try { return s.getItem(k); } catch { return null; } },
  set: (s, k, v) => { try { s.setItem(k, v); } catch { } },
  del: (s, k) => { try { s.removeItem(k); } catch { } },
};

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

function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || '');
  svg.append(p);
  return svg;
}

const nf = new Intl.NumberFormat('fr-FR');
const num = (v) => nf.format(Number(v) || 0);
const randomHex = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const fmtDate = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

let token = null;
let me = null;
let view = 'home';
let refreshTimer = null;
let toastTimer = null;

function showLoginError(msg) {
  const e = $('err');
  e.textContent = msg;
  e.classList.remove('hidden');
}

function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;
  history.replaceState(null, '', location.pathname + location.search);
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
  store.del(localStorage, TOKEN_KEY);
  clearInterval(refreshTimer);
  token = null;
  if (old) fetch(`${API}/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${old}` } }).catch(() => {});
  me = null;
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
}

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
  $('sync').textContent = me.synced ? `Synchronisé à ${fmtTime(new Date(me.updatedAt))}` : 'En attente du bot';
}

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

const go = (v) => { view = v; render(); window.scrollTo({ top: 0 }); };
const copyText = (text) => navigator.clipboard.writeText(String(text)).then(() => toast('Copié', 'ok')).catch(() => toast('Copie impossible', 'bad'));

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
const daysLeft = (exp) => Math.ceil((exp - Date.now()) / 864e5);

function expiryChip(exp) {
  if (!exp) return null;
  const d = daysLeft(exp);
  const [cls, text] = d <= 0 ? ['ko', 'Expiré'] : d <= 7 ? ['warn', `${d} jour${d > 1 ? 's' : ''} restant${d > 1 ? 's' : ''}`] : ['ok', `${d} jours restants`];
  return h('span', { class: `tag ${cls}`, title: `${d <= 0 ? 'Expiré le' : 'Jusqu’au'} ${fmtDate(exp)}` }, text);
}

function presenceStatus(b) {
  const p = PRESENCES[b.presence] ? b.presence : 'online';
  const act = b.activityText ? `${ACTIVITIES[b.activityType] || ''} ${b.activityText}`.trim() : '';
  return h('span', { class: 'status' }, h('span', { class: `dot ${p}` }), h('span', {}, act ? `${PRESENCES[p]} · ${act}` : PRESENCES[p]));
}

const stat = (label, v, main, ico, sub) => h('div', { class: `stat${main ? ' main' : ''}` },
  ico ? icon(ico) : null,
  h('b', {}, num(v)),
  h('span', { class: 'muted' }, label),
  sub ? h('small', { class: 'muted' }, sub) : null);

const waiting = () => h('p', { class: 'notice' }, 'En attente des données du bot…');
const empty = (ico, text) => h('div', { class: 'empty' }, icon(ico), h('p', {}, text));
const avgStars = (list) => {
  const n = list.map((x) => Number(x && (x.stars ?? x.rating))).filter((x) => x > 0);
  return n.length ? (n.reduce((a, b) => a + b, 0) / n.length).toFixed(1).replace('.', ',') : null;
};

function homeView() {
  const d = me.data;
  const hour = new Date().getHours();
  const greet = hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
  const hero = h('section', { class: 'hero' },
    h('div', {}, h('h1', {}, `${greet}, ${me.username}`), h('p', { class: 'muted' }, 'Voici l’état de ton compte.')),
    h('span', { class: 'pill' }, h('span', { class: `dot ${me.synced ? '' : 'idle'}` }),
      me.synced ? `Synchronisé à ${fmtTime(new Date(me.updatedAt))}` : 'En attente du bot'));

  if (!d) {
    const btn = h('button', { class: 'btn', onclick: async () => { btn.disabled = true; try { await loadMe(); } catch (e) { toast(e.message, 'bad'); } btn.disabled = false; render(); } }, icon('refresh'), 'Actualiser');
    return [hero, h('div', { class: 'panel' }, h('div', { class: 'empty' }, icon('bot'), h('p', {}, 'Le bot n’a pas encore envoyé tes données. Ça arrive en général en moins d’une minute.'), btn))];
  }

  const bots = Array.isArray(d.bots) ? d.bots : [];
  const out = [hero];

  bots.forEach((b, i) => {
    const exp = expiryOf(b);
    if (!exp) return;
    const days = daysLeft(exp);
    if (days > 3) return;
    out.push(h('div', { class: `notice alert${days <= 0 ? ' bad' : ''}` },
      h('span', { class: 'lead' }, icon('alert'), days <= 0 ? `${botName(b, i)} a expiré.` : `${botName(b, i)} expire dans ${days} jour${days > 1 ? 's' : ''}.`),
      h('button', { class: 'btn sm', onclick: () => go('bots') }, icon('refresh'), 'Renouveler')));
  });

  const vouchList = d.vouches && Array.isArray(d.vouches.last) ? d.vouches.last : [];
  const avg = avgStars(vouchList);
  out.push(h('div', { class: 'stats' },
    stat('crédits', d.credits, true, 'coin'),
    stat('bots', bots.length, false, 'bot'),
    stat('parrainages', d.referral.count, false, 'users', d.referral.earned ? `+${num(d.referral.earned)} crédits gagnés` : null),
    stat('avis', d.vouches.count, false, 'star', avg ? `Moyenne ${avg} / 5` : null)));

  const botsPanel = h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Mes bots'), bots.length ? h('button', { class: 'link', onclick: () => go('bots') }, 'Tout gérer', icon('arrow')) : null),
    bots.length ? bots.map((b, i) => h('div', { class: 'botrow' },
      h('span', { class: 'botico' }, icon('bot')),
      h('div', { class: 'botinfo' }, h('b', {}, botName(b, i)), presenceStatus(b)),
      expiryChip(expiryOf(b)),
      h('button', { class: 'btn ghost sm', onclick: () => go('bots') }, 'Gérer')))
      : empty('bot', 'Tu n’as aucun bot pour l’instant.'));

  const actions = h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Actions rapides')),
    h('div', { class: 'actions' },
      h('button', { class: 'action', onclick: () => go('bots') }, icon('refresh'), 'Renouveler un bot'),
      h('button', { class: 'action', onclick: () => go('promo') }, icon('tag'), 'Utiliser un code'),
      h('button', { class: 'action', onclick: () => go('referral') }, icon('users'), 'Parrainer un ami'),
      h('button', { class: 'action', onclick: () => go('history') }, icon('clock'), 'Mon historique')));

  const r = d.referral;
  const link = r.link || r.url || r.code;
  const referral = h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Parrainage')),
    link ? h('div', { class: 'linkbox' }, h('code', {}, String(link)), h('button', { class: 'btn sm', onclick: () => copyText(link) }, icon('copy'), 'Copier')) : null,
    h('div', { class: 'mini' },
      h('span', {}, h('b', {}, num(r.count)), ' filleuls'),
      h('span', {}, h('b', {}, num(r.paid)), ' ont payé'),
      h('span', {}, h('b', {}, num(r.earned)), ' crédits gagnés')));

  const latest = vouchList.slice(0, 3);
  const vouches = latest.length ? h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Derniers avis'), h('button', { class: 'link', onclick: () => go('vouches') }, 'Tout voir', icon('arrow'))),
    latest.map((x) => vouchItem(x))) : null;

  out.push(h('div', { class: 'cols' },
    h('div', { class: 'col' }, botsPanel, recentActivity()),
    h('div', { class: 'col' }, actions, referral, vouches)));
  return out;
}

function recentActivity() {
  const list = loadHist().slice(0, 5);
  if (!list.length) return null;
  return h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Activité récente'), h('button', { class: 'link', onclick: () => go('history') }, 'Tout voir', icon('arrow'))),
    list.map(historyRow));
}

function historyRow(e) {
  return h('div', { class: 'logrow' },
    h('small', { class: 'muted' }, new Date(e.at).toLocaleString('fr-FR')),
    h('span', {}, LABELS[e.type] || e.type),
    h('span', { class: `tag ${e.ok ? 'ok' : 'ko'}` }, e.ok ? 'Réussi' : 'Échec'),
    h('span', { class: 'muted' }, e.msg));
}

function botCard(b, i) {
  const name = botName(b, i);
  const exp = expiryOf(b);

  const head = h('header', {},
    h('div', { class: 'bothead' }, h('span', { class: 'botico' }, icon('bot')), h('div', { class: 'botinfo' }, h('h3', {}, name), presenceStatus(b))),
    expiryChip(exp));

  const planSel = h('select', {}, me.plans.map((p) => {
    const cost = p.price ?? p.credits ?? p.cost;
    return h('option', { value: p.days }, `${p.days} jours${cost != null ? ` — ${num(cost)} crédits` : ''}`);
  }));
  const renewBtn = h('button', { class: 'btn', onclick: () => run(renewBtn, { type: 'renew', key: b.key, days: Number(planSel.value) }) }, icon('refresh'), 'Renouveler');
  const renew = h('details', {}, h('summary', {}, icon('refresh'), 'Renouveler'),
    me.plans.length ? [field('Durée', planSel), renewBtn] : h('p', { class: 'muted' }, 'Aucune durée disponible pour le moment.'));

  const presence = select(PRESENCES, b.presence || 'online');
  const actType = select(ACTIVITIES, b.activityType || 'playing');
  const actText = h('input', { type: 'text', maxlength: 128, value: b.activityText || '' });
  const saveBtn = h('button', { class: 'btn', onclick: () => run(saveBtn, { type: 'settings', key: b.key, presence: presence.value, activityType: actType.value, activityText: actText.value }) }, 'Enregistrer');
  const preview = h('p', { class: 'preview' });
  const updPreview = () => preview.replaceChildren(h('span', { class: `dot ${presence.value}` }), h('b', {}, PRESENCES[presence.value]), ` ${ACTIVITIES[actType.value]} ${actText.value}`.trimEnd());
  [presence, actType, actText].forEach((el) => el.addEventListener('input', updPreview));
  updPreview();
  const settings = h('details', {}, h('summary', {}, icon('bot'), 'Statut du bot'),
    field('Présence', presence), field('Activité', actType), field('Texte de l’activité', actText), h('div', { class: 'field' }, h('label', {}, 'Aperçu'), preview), saveBtn);

  const current = new Set(Array.isArray(b.groups) ? b.groups.map(String) : []);
  const boxes = me.groups.map((g) => h('label', {}, h('input', { type: 'checkbox', value: g, checked: current.has(g) }), g));
  const groupsBtn = h('button', { class: 'btn', onclick: () => run(groupsBtn, { type: 'groups', key: b.key, groups: boxes.map((l) => l.firstChild).filter((c) => c.checked).map((c) => c.value) }) }, 'Enregistrer les catégories');
  const groups = h('details', {}, h('summary', {}, icon('tag'), 'Catégories'),
    me.groups.length ? [h('div', { class: 'checks' }, boxes), groupsBtn] : h('p', { class: 'muted' }, 'Aucune catégorie disponible.'));

  return h('section', { class: 'panel bot' }, head, renew, settings, groups);
}

function botsView() {
  const bots = me.data ? me.data.bots : [];
  const out = [h('div', { class: 'page-head' }, h('h1', {}, 'Mes bots'), h('p', { class: 'muted' }, 'Renouvelle, change le statut et les catégories de chaque bot.'))];
  if (!me.data) out.push(waiting());
  else if (!bots.length) out.push(h('div', { class: 'panel' }, empty('bot', 'Tu n’as aucun bot pour l’instant.')));
  else out.push(bots.map(botCard));
  return out;
}

function promoView() {
  const code = h('input', { type: 'text', maxlength: 40, placeholder: 'MONCODE', autocomplete: 'off' });
  const btn = h('button', { class: 'btn', onclick: () => { if (code.value.trim()) run(btn, { type: 'promo', code: code.value.trim() }); } }, icon('tag'), 'Utiliser le code');
  const used = me.data ? me.data.redeemed : [];
  return [
    h('div', { class: 'page-head' }, h('h1', {}, 'Code promo'), h('p', { class: 'muted' }, 'Entre un code pour recevoir des crédits.')),
    h('section', { class: 'panel' }, field('Ton code', code), btn),
    used.length ? h('section', { class: 'panel' }, h('h3', {}, 'Codes déjà utilisés'),
      h('div', { class: 'row' }, used.map((u) => h('span', { class: 'tag' }, typeof u === 'string' ? u : (u.code || '—'))))) : null,
  ];
}

function kv(obj, depth = 0) {
  const rows = Object.entries(obj || {});
  if (!rows.length) return h('p', { class: 'muted' }, 'Aucune donnée.');
  return h('div', { class: depth ? 'nested' : '' }, rows.map(([k, v]) => {
    if (v !== null && typeof v === 'object') {
      return h('details', {}, h('summary', {}, k), depth < 2 ? kv(v, depth + 1) : h('pre', {}, JSON.stringify(v, null, 2).slice(0, 3000)));
    }
    return h('div', { class: 'row kv' }, h('span', { class: 'muted' }, k), h('b', {}, typeof v === 'number' ? num(v) : String(v)));
  }));
}

function referralView() {
  const r = me.data && me.data.referral;
  const head = h('div', { class: 'page-head' }, h('h1', {}, 'Parrainage'), h('p', { class: 'muted' }, 'Invite tes amis et gagne des crédits quand ils paient.'));
  if (!r) return [head, waiting()];
  const link = r.link || r.url || r.code;
  return [
    head,
    h('div', { class: 'stats' }, stat('Filleuls', r.count, false, 'users'), stat('Ont payé', r.paid, false, 'coin'), stat('Crédits gagnés', r.earned, true, 'star')),
    link ? h('section', { class: 'panel' }, h('h3', {}, 'Ton lien'),
      h('div', { class: 'linkbox' }, h('code', {}, String(link)), h('button', { class: 'btn sm', onclick: () => copyText(link) }, icon('copy'), 'Copier')))
      : h('p', { class: 'muted' }, 'Ton lien de parrainage n’est pas encore disponible.'),
  ];
}

function vouchItem(x, full) {
  const it = x && typeof x === 'object' ? x : { text: String(x) };
  const stars = Number(it.stars ?? it.rating);
  const when = dateOf(it.at ?? it.date ?? it.createdAt);
  const text = String(it.text || it.message || it.comment || it.reason || '');
  return h('div', { class: 'quote' },
    h('header', {}, h('b', {}, String(it.username || it.author || it.from || it.user || 'Anonyme')), when ? h('small', { class: 'muted' }, fmtDate(when)) : null),
    stars > 0 ? h('div', { class: 'stars' }, '★'.repeat(Math.min(5, Math.round(stars)))) : null,
    text ? h('p', {}, !full && text.length > 160 ? `${text.slice(0, 157)}…` : text) : null);
}

function vouchesView() {
  const v = me.data && me.data.vouches;
  const head = h('div', { class: 'page-head' }, h('h1', {}, 'Avis'), h('p', { class: 'muted' }, v ? `${num(v.count)} avis reçus.` : ''));
  if (!v) return [head, waiting()];
  const list = Array.isArray(v.last) ? v.last : [];
  return [head, list.length ? h('section', { class: 'panel' }, list.map((x) => vouchItem(x, true))) : h('div', { class: 'panel' }, empty('star', 'Aucun avis pour le moment.'))];
}

function economyView() {
  const e = me.data && me.data.economy;
  return [
    h('div', { class: 'page-head' }, h('h1', {}, 'Économie')),
    me.data ? (e && typeof e === 'object' ? h('section', { class: 'panel' }, kv(e)) : h('div', { class: 'panel' }, empty('chart', 'Aucune donnée d’économie pour ton compte.'))) : waiting(),
  ];
}

function historyView() {
  const list = loadHist();
  const clear = h('button', { class: 'btn ghost', onclick: () => { store.del(sessionStorage, HIST_KEY); render(); } }, 'Vider');
  return [
    h('div', { class: 'page-head' }, h('h1', {}, 'Historique'), h('p', { class: 'muted' }, 'Tes actions de cette session.')),
    list.length ? [h('section', { class: 'panel' }, list.map(historyRow)), clear] : h('div', { class: 'panel' }, empty('clock', 'Aucune action pour l’instant.')),
  ];
}

function memberCard(m) {
  const bots = Array.isArray(m.bots) ? m.bots : [];
  return h('section', { class: 'panel' },
    h('div', { class: 'stats' }, stat('Crédits', m.credits, true), stat('Bots', bots.length), stat('Filleuls', m.referral && m.referral.count), stat('Avis', m.vouches && m.vouches.count)),
    bots.length ? h('div', {}, bots.map((b, i) => {
      const exp = expiryOf(b);
      return h('div', { class: 'row kv' }, h('b', {}, botName(b, i)), h('span', { class: 'muted' }, exp ? `jusqu’au ${fmtDate(exp)}` : 'sans date'));
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

  const codes = me.admin && (me.admin.promos || me.admin.promoCodes || me.admin.codes || me.admin.promo_codes);
  const codesBox = Array.isArray(codes) && codes.length
    ? h('div', {}, codes.map((c) => {
      const o = c && typeof c === 'object' ? c : { code: String(c) };
      const used = o.uses ?? o.used ?? o.usedCount;
      const exp = dateOf(o.expiresAt ?? o.expires);
      return h('div', { class: 'row kv' }, h('b', {}, String(o.code ?? '—')),
        h('span', { class: 'muted' }, [o.credits != null ? `${num(o.credits)} crédits` : '', used != null ? `${num(used)}/${num(o.maxUses)} utilisés` : '', exp ? `expire le ${fmtDate(exp)}` : ''].filter(Boolean).join(', ')));
    }))
    : h('p', { class: 'muted' }, 'Aucun code promo.');

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
    })) : h('p', { class: 'muted' }, 'Aucune action pour l’instant.'));
  }).catch((err) => { logBox.textContent = err.message; });

  return [
    h('div', { class: 'page-head' }, h('h1', {}, 'Administration')),
    h('section', { class: 'panel' }, h('h2', {}, 'Chercher un membre'), field('ID Discord', q), qBtn, found),
    h('section', { class: 'panel' }, h('h2', {}, 'Créer un code promo'),
      field('Code', pCode), field('Crédits offerts', pCredits), field('Utilisations maximum', pUses), field('Expire après (jours, 0 = jamais)', pDays), pBtn),
    h('section', { class: 'panel' }, h('h2', {}, 'Codes promo existants'), codesBox),
    h('section', { class: 'panel' }, h('h2', {}, 'Ajuster les crédits'),
      field('Membre', target), field('Montant (négatif pour retirer)', amount), cBtn),
    h('section', { class: 'panel' }, h('h2', {}, 'Journal des actions admin'), logBox),
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
    .map(([id, v]) => h('button', { class: id === view ? 'on' : '', 'aria-current': id === view ? 'page' : false, onclick: () => go(id) }, icon(NAV_ICONS[id]), v.label)));
  $('view').replaceChildren(...[VIEWS[view].render()].flat().filter(Boolean).flat());
}

async function boot() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('view').replaceChildren(
    h('div', { class: 'skel t' }), h('div', { class: 'skel' }), h('div', { class: 'skel' }),
    h('p', { class: 'muted' }, 'Chargement… le serveur peut mettre une trentaine de secondes à se réveiller.'));
  try {
    await loadMe();
    render();
    refreshTimer = setInterval(() => loadMe().then(() => { if (view === 'home') render(); }).catch(() => {}), 60_000);
  } catch (err) {
    if (!token) return;
    $('view').replaceChildren(h('p', { class: 'notice' }, err.message), h('button', { class: 'btn', onclick: boot }, 'Réessayer'));
  }
}

const applyTheme = (t) => {
  document.documentElement.dataset.theme = t;
  store.set(localStorage, THEME_KEY, t);
  themeBtn.replaceChildren(icon(t === 'light' ? 'moon' : 'sun'), h('span', { class: 'label' }, t === 'light' ? 'Thème sombre' : 'Thème clair'));
};
const themeBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light') });
$('logout').before(themeBtn);
$('logout').replaceChildren(icon('logout'), h('span', { class: 'label' }, 'Se déconnecter'));
$('loginBtn').prepend(icon('login'));
applyTheme(store.get(localStorage, THEME_KEY) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

readHash();
store.del(localStorage, TOKEN_KEY);
token = store.get(sessionStorage, TOKEN_KEY);
$('loginBtn').addEventListener('click', startLogin);
$('logout').addEventListener('click', logout);
if (token) boot();

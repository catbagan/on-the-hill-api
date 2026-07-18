export const INTERNAL_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Internal — On The Hill</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --panel-hi: #21262d;
    --border: #30363d; --text: #e6edf3; --muted: #8b949e;
    --accent: #58a6ff; --ok: #3fb950; --err: #f85149;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text); font-family: var(--mono);
    font-size: 13px; line-height: 1.5; padding: 24px; max-width: 1100px; margin: 0 auto;
  }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin-bottom: 12px; color: var(--accent); font-weight: 600; }
  .sub { color: var(--muted); margin-bottom: 24px; font-size: 12px; }
  section {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 6px; padding: 16px; margin-bottom: 16px;
  }
  .row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  input, select, button, textarea {
    background: var(--bg); color: var(--text); border: 1px solid var(--border);
    border-radius: 4px; padding: 6px 10px; font-family: var(--mono); font-size: 13px;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
  input, select { flex: 1; min-width: 160px; }
  button {
    background: var(--panel-hi); cursor: pointer; padding: 6px 14px;
    border-color: var(--border); white-space: nowrap;
  }
  button:hover { background: var(--border); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.primary { background: var(--accent); color: #000; border-color: var(--accent); }
  button.danger { color: var(--err); }
  .out {
    background: #010409; border: 1px solid var(--border); border-radius: 4px;
    padding: 12px; margin-top: 8px; font-family: var(--mono); font-size: 12px;
    max-height: 400px; overflow: auto; white-space: pre; color: #d4d4d4;
  }
  .out:empty { display: none; }
  .status {
    display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px;
    margin-left: 8px;
  }
  .status.ok { background: rgba(63,185,80,0.15); color: var(--ok); }
  .status.err { background: rgba(248,81,73,0.15); color: var(--err); }
  .status.pending { background: rgba(88,166,255,0.15); color: var(--accent); }
  label { display: block; color: var(--muted); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .field { margin-bottom: 12px; flex: 1; min-width: 160px; }
  .field input, .field select { width: 100%; }
  .gate {
    background: var(--panel); border: 1px solid var(--err); color: var(--err);
    padding: 20px; border-radius: 6px; text-align: center;
  }
  #meta { color: var(--muted); font-size: 11px; margin-top: 12px; }
  .timer { color: var(--muted); font-size: 11px; margin-left: 8px; }
</style>
</head>
<body>
<h1>Internal Debug</h1>
<p class="sub">Test auth + data endpoints without going through the app.</p>

<section id="auth-section">
  <h2>Auth <span id="auth-status" class="status pending">checking…</span></h2>
  <div id="auth-signed-out" style="display:none">
    <div class="row">
      <input id="signin-email" type="email" placeholder="email" autocomplete="email">
      <input id="signin-password" type="password" placeholder="password" autocomplete="current-password">
      <button class="primary" onclick="signIn()">Sign In</button>
    </div>
  </div>
  <div id="auth-signed-in" style="display:none">
    <div id="auth-user"></div>
    <div class="row" style="margin-top:12px">
      <button onclick="signOut()">Sign Out</button>
    </div>
  </div>
  <div id="auth-out" class="out"></div>
</section>

<div id="gate" style="display:none">
  <div class="gate">Not authorized. Only Daniel can use this page.</div>
</div>

<div id="app" style="display:none">

<section>
  <h2>Player Search <span id="search-status"></span></h2>
  <p class="sub">Uses <code>POST /api/player/search</code> — the same endpoint the app calls. Returns player + their teams.</p>
  <div class="row">
    <input id="search-name" placeholder="player name (e.g. Daniel Catbagan)">
    <button class="primary" onclick="doSearch()">Search</button>
  </div>
  <div id="search-out" class="out"></div>
</section>

<section>
  <h2>Report Get <span id="report-status"></span></h2>
  <p class="sub">Uses <code>POST /api/report/get</code>. Same endpoint the stats screen calls.</p>
  <div class="row">
    <div class="field">
      <label>Member ID</label>
      <input id="report-member" placeholder="3209723">
    </div>
    <div class="field">
      <label>Game Type</label>
      <select id="report-gametype">
        <option value="">(both)</option>
        <option value="EIGHT_BALL">EIGHT_BALL</option>
        <option value="NINE_BALL">NINE_BALL</option>
      </select>
    </div>
    <div class="field">
      <label>Seasons (comma-separated, optional)</label>
      <input id="report-seasons" placeholder="Fall 2025, Spring 2025">
    </div>
  </div>
  <div class="row">
    <button class="primary" onclick="doReport()">Get Report</button>
  </div>
  <div id="report-out" class="out"></div>
</section>

<section>
  <h2>Raw APA — bypasses Supabase cache <span id="apa-status"></span></h2>
  <p class="sub">Directly hits the APA GraphQL API. Useful for verifying what upstream actually returns.</p>

  <div class="row">
    <div class="field">
      <label>APA: Search for Player</label>
      <input id="apa-search-name" placeholder="Daniel Catbagan">
    </div>
    <button onclick="apa('search', {name: val('apa-search-name')})">Fetch</button>
  </div>

  <div class="row">
    <div class="field">
      <label>APA: Teams for Player</label>
      <input id="apa-teams-member" placeholder="memberId (e.g. 3209723)">
    </div>
    <button onclick="apa('teams', {memberId: val('apa-teams-member')})">Fetch</button>
  </div>

  <div class="row">
    <div class="field">
      <label>APA: Matches for Team</label>
      <input id="apa-matches-team" placeholder="apa team id">
    </div>
    <button onclick="apa('matches', {teamId: val('apa-matches-team')})">Fetch</button>
  </div>

  <div class="row">
    <div class="field">
      <label>APA: Match Details</label>
      <input id="apa-details-id" placeholder="apa match id">
    </div>
    <button onclick="apa('match-details', {scheduleId: val('apa-details-id')})">Fetch</button>
  </div>

  <div id="apa-out" class="out"></div>
</section>

<p id="meta">All internal endpoints require your Supabase session cookie + are gated to daniel@catbagan.me.</p>

</div>

<script>
const val = id => document.getElementById(id).value.trim();
const setOut = (id, data) => {
  const el = document.getElementById(id);
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
};
const setStatus = (id, kind, text) => {
  const el = document.getElementById(id);
  el.className = 'status ' + kind;
  el.textContent = text;
};

async function api(path, body, method = 'POST') {
  const started = performance.now();
  const res = await fetch('/api' + path, {
    method,
    headers: body ? {'Content-Type': 'application/json'} : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data, ms };
}

async function checkAuth() {
  const r = await api('/internal/me', undefined, 'GET');
  if (r.ok && r.data.email) {
    setStatus('auth-status', 'ok', 'signed in');
    document.getElementById('auth-signed-out').style.display = 'none';
    document.getElementById('auth-signed-in').style.display = 'block';
    document.getElementById('auth-user').innerHTML =
      '<strong>' + r.data.email + '</strong> <span class="timer">(' + r.data.userId + ')</span>';
    if (r.data.email === 'daniel@catbagan.me') {
      document.getElementById('app').style.display = 'block';
      document.getElementById('gate').style.display = 'none';
    } else {
      document.getElementById('gate').style.display = 'block';
    }
  } else {
    setStatus('auth-status', 'err', 'signed out');
    document.getElementById('auth-signed-out').style.display = 'block';
    document.getElementById('auth-signed-in').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('gate').style.display = 'none';
  }
}

async function signIn() {
  const email = val('signin-email'), password = val('signin-password');
  if (!email || !password) return;
  const r = await api('/auth/signin', { email, password });
  setOut('auth-out', { status: r.status, timeMs: r.ms, ...r.data });
  if (r.ok) await checkAuth();
}

async function signOut() {
  const r = await api('/auth/signout');
  setOut('auth-out', { status: r.status, timeMs: r.ms, ...r.data });
  await checkAuth();
}

async function doSearch() {
  const name = val('search-name');
  if (!name) return;
  setStatus('search-status', 'pending', 'loading…');
  const r = await api('/player/search', { name });
  setStatus('search-status', r.ok ? 'ok' : 'err', r.status + ' · ' + r.ms + 'ms');
  setOut('search-out', r.data);
}

async function doReport() {
  const memberId = val('report-member');
  if (!memberId) return;
  const gameType = val('report-gametype') || undefined;
  const seasonsRaw = val('report-seasons');
  const seasons = seasonsRaw ? seasonsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  setStatus('report-status', 'pending', 'loading…');
  const r = await api('/report/get', { memberId, gameType, seasons });
  setStatus('report-status', r.ok ? 'ok' : 'err', r.status + ' · ' + r.ms + 'ms');
  setOut('report-out', r.data);
}

async function apa(op, body) {
  setStatus('apa-status', 'pending', op + ' loading…');
  const r = await api('/internal/apa/' + op, body);
  setStatus('apa-status', r.ok ? 'ok' : 'err', op + ' · ' + r.status + ' · ' + r.ms + 'ms');
  setOut('apa-out', r.data);
}

checkAuth();
</script>
</body>
</html>`;

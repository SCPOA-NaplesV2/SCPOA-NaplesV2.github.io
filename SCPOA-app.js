(() => {
  "use strict";
  const SB = "https://tpqghsroatbplixgwnrr.supabase.co";
  const KEY = "sb_publishable_KsDRBE2PDko3o1EfYw_Aow_XlQ1OrRB";
  const H = { apikey: KEY, Authorization: "Bearer " + KEY };
  const qs = new URLSearchParams(location.search);
  const TV = qs.has("tv");
  const RAINBOW = ["var(--r1)","var(--r2)","var(--r3)","var(--r4)","var(--r5)","var(--r6)","var(--r7)","var(--r8)"];
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = { get(k){ try { return sessionStorage.getItem(k); } catch(_) { return null; } }, set(k,v){ try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k,v); } catch(_){} } };

  let settings = null, players = [], results = { smash:{}, kart:{} }, tab = "smash", closedShown = null, firstLoad = true;
  let knownIds = new Set(), hostPin = store.get("hostPin"), kartPicks = {};

  async function api(path, opts = {}) {
    const r = await fetch(SB + "/rest/v1/" + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    if (!r.ok) { let e = {}; try { e = await r.json(); } catch(_){} e.status = r.status; throw e; }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
  const rpc = (fn, body) => api("rpc/" + fn, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const isClosed = () => !!settings && Date.now() >= new Date(settings.close_at).getTime();
  const ord = n => n + (["th","st","nd","rd"][((n % 100) - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
  const ORD = n => ord(n).toUpperCase();
  const pad = n => String(n).padStart(2, "0");

  // ---------- event details ----------
  function fitText(node, max, min) {
    node.style.fontSize = max + "px";
    let s = max;
    while (node.scrollWidth > node.clientWidth + 1 && s > min) { s -= 1; node.style.fontSize = s + "px"; }
    if (node.scrollWidth > node.clientWidth + 1) { node.style.whiteSpace = "normal"; node.style.lineHeight = "1.05"; } else { node.style.whiteSpace = ""; node.style.lineHeight = ""; }
  }
  function fitDoor() {
    const wide = matchMedia("(min-width:1100px)").matches;
    const door = document.querySelector(".door");
    const base = wide ? 40 : Math.max(16, Math.min(38, door.clientWidth * 0.066));
    document.querySelectorAll(".door .v").forEach(v => fitText(v, base, 16));
  }
  function renderDetails() {
    const map = { date: settings.event_date_label, time: settings.event_time_label, place: settings.event_location };
    document.querySelectorAll("[data-bind]").forEach(n => { n.textContent = map[n.dataset.bind] || "TBD"; });
    fitDoor();
    const f = new Intl.DateTimeFormat(undefined, { weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
    $("closesLabel").textContent = "Signups close: " + f.format(new Date(settings.close_at));
  }
  addEventListener("resize", () => { if (settings) fitDoor(); drawLinks(); });

  function tick() {
    if (!settings) return;
    let ms = Math.max(0, new Date(settings.close_at).getTime() - Date.now());
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4); ms -= m * 6e4;
    $("cdD").textContent = pad(d); $("cdH").textContent = pad(h); $("cdM").textContent = pad(m); $("cdS").textContent = pad(Math.floor(ms / 1e3));
    const c = isClosed();
    if (c !== closedShown) { closedShown = c; applyClosed(c); }
  }
  function applyClosed(c) {
    $("cdStatus").textContent = c ? "Signups closed" : "Signups open";
    $("cdStatus").classList.toggle("live", !c);
    if (c) { $("form").hidden = true; $("success").hidden = true; $("closed").hidden = false; }
    else { $("closed").hidden = true; if ($("success").hidden) $("form").hidden = false; }
    document.querySelectorAll("#enterBtn,.door").forEach(a => a.setAttribute("href", c ? "#bracket" : "#join"));
    $("enterBtn").textContent = c ? "SEE THE BRACKET" : "ENTER THE TOURNAMENT!";
    renderBracket();
  }

  // ---------- players ----------
  function renderPlayers() {
    const s = players.filter(p => p.smash).length, k = players.filter(p => p.kart).length;
    $("nSmash").textContent = pad(s); $("nKart").textContent = pad(k);
    const box = $("rows"); box.textContent = "";
    if (!players.length) {
      const e = el("div", "board-empty"); e.append(el("span", "px", "INSERT PLAYER 1"), document.createTextNode("No names on the board yet. Be the first.")); box.append(e); return;
    }
    players.forEach((p, i) => {
      const r = el("div", "prow" + (!firstLoad && !knownIds.has(p.id) ? " new" : ""));
      r.style.color = RAINBOW[i % 8];
      r.append(el("span", "rk", ORD(i + 1)), el("span", "nm", p.full_name), el("span", "gm", [p.smash && "SMASH", p.kart && "KART"].filter(Boolean).join("·")));
      box.append(r);
    });
  }
  let toastQ = [], toastBusy = false;
  function toast(name) { toastQ.push(name); if (!toastBusy) nextToast(); }
  function nextToast() {
    const n = toastQ.shift(); if (!n) { toastBusy = false; return; }
    toastBusy = true; $("toastName").textContent = n; $("toast").classList.add("on");
    setTimeout(() => { $("toast").classList.remove("on"); setTimeout(nextToast, 500); }, 3200);
  }
  async function loadPlayers() {
    const list = await api("signups?select=id,full_name,smash,kart,created_at&order=created_at.asc,id.asc");
    const fresh = list.filter(p => !knownIds.has(p.id));
    players = list;
    renderPlayers(); renderBracket();
    if (!firstLoad && fresh.length && fresh.length <= 3 && !document.hidden) fresh.forEach(p => toast(p.full_name));
    knownIds = new Set(list.map(p => p.id)); firstLoad = false;
  }
  async function loadResults() {
    const list = await api("results?select=game,match_label,winners");
    const next = { smash:{}, kart:{} };
    list.forEach(r => { (next[r.game] ||= {})[r.match_label] = r.winners; });
    const changed = JSON.stringify(next) !== JSON.stringify(results);
    results = next; if (changed) renderBracket();
  }

  // ---------- signup ----------
  const clean = s => s.replace(/\s+/g, " ").trim();
  function showAlert(t) { const a = $("alert"); a.textContent = t; a.classList.add("on"); a.classList.remove("shake"); void a.offsetWidth; a.classList.add("shake"); }
  $("form").addEventListener("submit", async e => {
    e.preventDefault(); $("alert").classList.remove("on");
    const name = clean($("name").value), smash = $("gSmash").checked, kart = $("gKart").checked;
    if (!/^\S+(\s+\S+)+$/.test(name) || name.length < 3) { $("name").focus(); return showAlert("Enter your first and last name."); }
    if (!smash && !kart) return showAlert("Pick at least one game.");
    if (isClosed()) return showAlert("Signups are closed.");
    const b = $("submit"); b.disabled = true; b.innerHTML = 'INSERTING<span class="blink">…</span>';
    try {
      await api("signups", { method:"POST", headers:{ "Content-Type":"application/json", Prefer:"return=minimal" }, body: JSON.stringify({ full_name:name, smash, kart }) });
      const games = [smash && "Smash Bros.", kart && "Mario Kart"].filter(Boolean).join(" and ");
      $("successText").textContent = `${name}, you’re registered for ${games}.`;
      $("form").hidden = true; $("success").hidden = false;
      const sym = $("success").querySelector(".sym"); sym.classList.remove("pop"); void sym.offsetWidth; sym.classList.add("pop");
      $("form").reset();
      $("formCard").scrollIntoView({ behavior:"smooth", block:"center" });
      await loadPlayers();
    } catch (err) {
      if (err.code === "23505") showAlert("That name is already on the board. Need to change your games? Ask the planning team.");
      else if (err.code === "42501") showAlert("Signups are closed.");
      else if (err.code === "23514") showAlert("Check your name and pick at least one game.");
      else showAlert("Couldn’t connect. Check your signal and try again.");
    } finally { b.disabled = false; b.textContent = "ENTER THE TOURNAMENT!"; }
  });
  $("again").addEventListener("click", () => { $("success").hidden = true; $("form").hidden = false; $("name").focus(); });

  // ---------- brackets ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(list, game) { const s = (settings ? settings.seed : "") + "|" + game; return [...list].sort((a, b) => hash(s + a.id) - hash(s + b.id) || (a.id < b.id ? -1 : 1)); }

  function buildSmash(ps) {
    const n = ps.length; if (!n) return null;
    const R = results.smash || {};
    if (n === 1) return { rounds: [], champion: null, solo: true };
    const size = 2 ** Math.ceil(Math.log2(n)), m = size / 2, byes = size - n;
    const rounds = []; let num = 1, i = 0;
    const r1 = [];
    for (let k = 0; k < m; k++) {
      const bye = Math.floor((k + 1) * byes / m) > Math.floor(k * byes / m);
      const slots = bye ? [{ name: ps[i++].full_name }, { bye: true }] : [{ name: ps[i++].full_name }, { name: ps[i++].full_name }];
      r1.push({ label: "M" + num++, slots });
    }
    rounds.push(r1);
    const decide = mt => {
      if (mt.slots[1].bye) { mt.winner = mt.slots[0].name; mt.auto = true; return; }
      const names = mt.slots.filter(s => s.name).map(s => s.name);
      const w = (R[mt.label] || [])[0];
      mt.winner = names.length === 2 && names.includes(w) ? w : null;
    };
    r1.forEach(decide);
    let prev = r1;
    while (prev.length > 1) {
      const next = [];
      for (let k = 0; k < prev.length; k += 2) {
        const mt = { label: "M" + num++, slots: [prev[k], prev[k + 1]].map(f => f.winner ? { name: f.winner } : { tbd: "Winner " + f.label }) };
        prev[k].next = mt.label; prev[k + 1].next = mt.label;
        decide(mt); next.push(mt);
      }
      rounds.push(next); prev = next;
    }
    const fin = prev[0];
    let runner = null;
    if (fin.winner) runner = fin.slots.find(s => s.name && s.name !== fin.winner)?.name || null;
    return { rounds, champion: fin.winner, runner };
  }

  function buildKart(ps) {
    if (!ps.length) return null;
    const R = results.kart || {}, K = 4, A = 2;
    const rounds = []; let pool = ps.map(p => ({ name: p.full_name })), hn = 1;
    while (pool.length > K) {
      const g = Math.ceil(pool.length / K), heats = Array.from({ length: g }, () => []);
      pool.forEach((s, idx) => { const row = Math.floor(idx / g), col = idx % g; heats[row % 2 ? g - 1 - col : col].push(s); });
      const round = heats.map(racers => ({ label: "H" + hn++, racers, need: A }));
      round.forEach(h => {
        const names = h.racers.filter(r => r.name).map(r => r.name);
        if (h.racers.length <= A) { h.placed = names.slice(); h.auto = true; }
        else { const w = (R[h.label] || []).filter(x => names.includes(x)); h.placed = names.length === h.racers.length && w.length >= A ? w.slice(0, A) : []; }
      });
      rounds.push(round);
      pool = [];
      round.forEach(h => {
        if (h.auto) h.racers.forEach(r => pool.push(r.name ? { name: r.name } : r));
        else for (let k = 0; k < A; k++) pool.push(h.placed[k] ? { name: h.placed[k] } : { tbd: (k ? "2nd · " : "1st · ") + h.label });
      });
      if (pool.length <= K) round.forEach(h => { h.next = "F1"; });
    }
    const fin = { label: "F1", racers: pool, final: true, need: Math.min(3, pool.length) };
    const names = fin.racers.filter(r => r.name).map(r => r.name);
    const w = (R.F1 || []).filter(x => names.includes(x));
    fin.placed = names.length === fin.racers.length && w.length >= Math.min(fin.need, 1) ? w.slice(0, fin.need) : [];
    if (fin.racers.length === 1 && names.length === 1) fin.placed = names.slice();
    rounds.push([fin]);
    return { rounds, champion: fin.placed[0] || null, podium: fin.placed };
  }

  function roundName(i, total, game) {
    const left = total - i;
    if (game === "kart") return left === 1 ? "FINAL RACE" : (i === 0 ? "QUALIFYING HEATS" : "ROUND " + (i + 1));
    if (left === 1) return "FINAL"; if (left === 2) return "SEMIFINALS"; if (left === 3) return "QUARTERFINALS";
    return "ROUND " + (i + 1);
  }

  function renderBracket() {
    if (!settings) return;
    const closed = isClosed(), host = !!hostPin && closed;
    document.body.classList.toggle("host", !!hostPin);
    $("tabSmash").setAttribute("aria-selected", tab === "smash");
    $("tabKart").setAttribute("aria-selected", tab === "kart");
    $("bdescT").textContent = tab === "smash" ? "Single elimination · 1v1" : "Heats of up to 4 · Top 2 advance";
    const st = $("bdescS"); st.textContent = closed ? "LIVE" : "PREVIEW"; st.classList.toggle("live", closed);
    $("lockedNote").hidden = closed;
    $("bview").classList.toggle("preview", !closed);
    const list = seeded(players.filter(p => tab === "smash" ? p.smash : p.kart), tab);
    const data = tab === "smash" ? buildSmash(list) : buildKart(list);
    const R = $("rounds"); R.textContent = "";
    // champion banner
    const champ = $("champ");
    if (data && data.champion && closed) {
      champ.classList.add("on");
      $("champK").textContent = tab === "smash" ? "SMASH BROS. CHAMPION" : "MARIO KART CHAMPION";
      $("champName").textContent = data.champion;
      $("champPodium").textContent = tab === "smash" ? (data.runner ? "Runner-up: " + data.runner : "") :
        (data.podium || []).slice(1).map((n, i) => (i ? "3rd: " : "2nd: ") + n).join(" · ");
    } else champ.classList.remove("on");
    if (!data || (!data.rounds.length && !data.solo)) {
      R.append(el("div", "bempty", "No players in this bracket yet."));
      $("scrollCue").hidden = true; drawLinks(); return;
    }
    if (data.solo) { R.append(el("div", "bempty", "Only one player so far. Needs at least two for a bracket.")); $("scrollCue").hidden = true; drawLinks(); return; }
    data.rounds.forEach((round, i) => {
      const col = el("div", "rcol" + (tab === "kart" ? " wide" : "") + (i === data.rounds.length - 1 ? " final" : ""));
      col.append(el("h3", "", roundName(i, data.rounds.length, tab)));
      const stack = el("div", "stack");
      round.forEach(mt => stack.append(tab === "smash" ? smashCard(mt, host, i === data.rounds.length - 1) : kartCard(mt, host)));
      col.append(stack); R.append(col);
    });
    requestAnimationFrame(() => { drawLinks(); const v = $("bview"); $("scrollCue").hidden = v.scrollWidth <= v.clientWidth + 4; });
  }

  function smashCard(mt, host, isFinal) {
    const c = el("div", "card" + (mt.auto ? " adv" : "") + (isFinal ? " final" : ""));
    c.dataset.label = mt.label; if (mt.next) c.dataset.next = mt.next; if (mt.winner) c.dataset.done = "1";
    const mh = el("div", "mh"); mh.append(el("span", "", mt.label));
    const right = el("span", mt.auto ? "ok" : "", mt.auto ? "ADVANCED" : mt.winner ? "FINAL" : "1V1");
    if (mt.winner && !mt.auto) { right.className = "ok"; right.textContent = isFinal ? "CHAMPION" : "DONE"; }
    if (host && mt.winner && !mt.auto) { const rs = el("button", "reset", "RESET"); rs.type = "button"; rs.onclick = () => score("smash", mt.label, null); right.append(rs); }
    mh.append(right); c.append(mh);
    const ready = mt.slots.every(s => s.name);
    mt.slots.forEach(s => {
      const isBtn = host && ready && !mt.auto;
      const sl = el(isBtn ? "button" : "div", "slot");
      if (isBtn) { sl.type = "button"; sl.classList.add("pick"); sl.onclick = () => score("smash", mt.label, mt.winner === s.name ? null : [s.name]); }
      if (s.bye) { sl.classList.add("bye"); sl.append(el("span", "nm", "BYE")); }
      else if (s.tbd) { sl.classList.add("tbd"); sl.append(el("span", "nm", "TBD · " + s.tbd)); }
      else {
        sl.append(el("span", "nm", s.name));
        if (mt.winner === s.name) { sl.classList.add("win"); sl.append(el("span", "tag", isFinal ? "★" : "ADV")); }
        else if (mt.winner) sl.classList.add("out");
      }
      c.append(sl);
    });
    return c;
  }

  function kartCard(h, host) {
    const done = h.placed && h.placed.length >= (h.final ? Math.min(h.need, h.racers.length) : h.need);
    const c = el("div", "card" + (h.final ? " final" : "") + (h.auto ? " adv" : ""));
    c.dataset.label = h.label; if (h.next) c.dataset.next = h.next; if (done || h.auto) c.dataset.done = "1";
    const mh = el("div", "mh"); mh.append(el("span", "", h.label));
    const right = el("span", h.final ? "" : "ok", h.final ? "FINAL RACE" : h.auto ? "ADVANCED" : "TOP 2 ADV");
    if (host && h.placed.length && !h.auto) { const rs = el("button", "reset", "RESET"); rs.type = "button"; rs.onclick = () => { kartPicks[h.label] = []; score("kart", h.label, null); }; right.append(rs); }
    mh.append(right); c.append(mh);
    const ready = h.racers.every(r => r.name), picks = kartPicks[h.label] || [];
    const canPick = host && ready && !h.auto && !h.placed.length && h.racers.length > 1;
    h.racers.forEach((r, idx) => {
      const sl = el(canPick ? "button" : "div", "slot");
      const place = r.name ? h.placed.indexOf(r.name) : -1, pick = r.name ? picks.indexOf(r.name) : -1;
      sl.append(el("span", "pos", place >= 0 ? String(place + 1) : pick >= 0 ? String(pick + 1) : String(idx + 1)));
      if (r.tbd) { sl.classList.add("tbd"); sl.append(el("span", "nm", "TBD · " + r.tbd)); }
      else {
        sl.append(el("span", "nm", r.name));
        if (place >= 0) { sl.classList.add("win"); sl.append(el("span", "tag", h.final ? (["★ 1ST","2ND","3RD"][place]) : "ADV")); }
        else if (h.auto) { sl.classList.add("win"); sl.append(el("span", "tag", "ADV")); }
        else if (pick >= 0) { sl.classList.add("picked"); sl.append(el("span", "tag", ORD(pick + 1))); }
        else if (h.placed.length) sl.classList.add("out");
      }
      if (canPick && r.name) { sl.type = "button"; sl.classList.add("pick"); sl.onclick = () => kartTap(h, r.name); }
      c.append(sl);
    });
    return c;
  }

  function kartTap(h, name) {
    const p = kartPicks[h.label] ||= [];
    const i = p.indexOf(name);
    if (i >= 0) p.splice(i, 1); else p.push(name);
    const need = h.final ? Math.min(h.need, h.racers.length) : h.need;
    if (p.length >= need) { const w = p.slice(0, need); kartPicks[h.label] = []; score("kart", h.label, w); }
    else renderBracket();
  }

  async function score(game, label, winners) {
    if (!hostPin) return;
    try {
      const ok = await rpc("set_result", { p_pin: hostPin, p_game: game, p_match: label, p_winners: winners });
      if (ok === false) { hostPin = null; store.set("hostPin", null); renderBracket(); openPin("PIN no longer valid. Log in again."); return; }
      await loadResults(); renderBracket();
    } catch (_) { alert("Couldn’t save. Check your signal and try again."); }
  }

  function drawLinks() {
    const R = $("rounds"); if (!R) return;
    R.querySelector(".bsvg")?.remove();
    const cards = [...R.querySelectorAll(".card[data-next]")]; if (!cards.length) return;
    const base = R.getBoundingClientRect();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "bsvg");
    svg.setAttribute("width", R.scrollWidth); svg.setAttribute("height", R.scrollHeight);
    cards.forEach(c => {
      const t = R.querySelector(`.card[data-label="${c.dataset.next}"]`); if (!t) return;
      const a = c.getBoundingClientRect(), b = t.getBoundingClientRect();
      const x1 = a.right - base.left, y1 = a.top + a.height / 2 - base.top, x2 = b.left - base.left, y2 = b.top + b.height / 2 - base.top, xm = (x1 + x2) / 2;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x1} ${y1}H${xm}V${y2}H${x2}`);
      if (c.dataset.done) p.setAttribute("class", "done");
      svg.append(p);
    });
    R.prepend(svg);
  }

  $("tabSmash").onclick = () => { tab = "smash"; renderBracket(); };
  $("tabKart").onclick = () => { tab = "kart"; renderBracket(); };

  // ---------- host ----------
  const dlg = $("pinDlg");
  function openPin(msg) { $("pinErr").textContent = msg || ""; $("pin").value = ""; if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); setTimeout(() => $("pin").focus(), 50); }
  $("hostLink").onclick = () => hostPin ? document.getElementById("bracket").scrollIntoView({ behavior:"smooth" }) : openPin();
  $("pinCancel").onclick = () => dlg.close();
  $("pinForm").addEventListener("submit", async e => {
    e.preventDefault(); const pin = $("pin").value.trim(); if (!pin) return;
    $("pinGo").disabled = true;
    try {
      const ok = await rpc("verify_pin", { p_pin: pin });
      if (ok === true) { hostPin = pin; store.set("hostPin", pin); dlg.close(); renderBracket(); document.getElementById("bracket").scrollIntoView({ behavior:"smooth" });
        if (!isClosed()) $("hostHint").textContent = "Scoring unlocks when signups close."; }
      else $("pinErr").textContent = "Wrong PIN.";
    } catch (err) { $("pinErr").textContent = /too many/.test(err.message || "") ? "Too many tries. Wait 10 minutes." : "Couldn’t connect. Try again."; }
    finally { $("pinGo").disabled = false; }
  });
  $("hostExit").onclick = () => { hostPin = null; store.set("hostPin", null); kartPicks = {}; renderBracket(); };
  if (qs.has("host") && !hostPin) setTimeout(() => openPin(), 400);

  // ---------- TV mode ----------
  if (TV) {
    document.body.classList.add("tvmode");
    setInterval(() => {
      const hasS = players.some(p => p.smash), hasK = players.some(p => p.kart);
      if (hasS && hasK) { tab = tab === "smash" ? "kart" : "smash"; renderBracket(); }
    }, 20000);
  }

  // ---------- starfield for main page ----------
  (() => { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const f = el("div", "starfield"); f.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 22; i++) { const st = el("i"); const big = r() > .75; st.style.cssText = `left:${(r()*100).toFixed(1)}%;top:${(r()*100).toFixed(1)}%;width:${big?4:2}px;height:${big?4:2}px;background:${r()>.6?"#36b8ff":"#9b98b4"};opacity:${big?.65:.35}`; f.append(st); }
    document.querySelector("main").prepend(f); })();

  // ---------- boot ----------
  (async () => {
    try { const rows = await api("settings?select=*&id=eq.1"); settings = rows[0]; renderDetails(); tick(); setInterval(tick, 1000); }
    catch (_) { $("rows").innerHTML = '<div class="board-empty"><span class="px">CONNECTION LOST</span>Refresh the page to try again.</div>'; return; }
    try { await Promise.all([loadPlayers(), loadResults()]); } catch (_) {}
    setInterval(() => { if (!document.hidden) loadPlayers().catch(() => {}); }, TV ? 8000 : 12000);
    setInterval(() => { if (!document.hidden && isClosed()) loadResults().catch(() => {}); }, TV ? 4000 : 8000);
    setInterval(() => api("settings?select=*&id=eq.1").then(r => { settings = r[0]; renderDetails(); }).catch(() => {}), 120000);
    if (document.fonts) { document.fonts.ready.then(() => { fitDoor(); drawLinks(); }); document.fonts.addEventListener("loadingdone", () => { fitDoor(); drawLinks(); }); }
    setTimeout(fitDoor, 1500);
    if (window.ResizeObserver) new ResizeObserver(() => fitDoor()).observe(document.querySelector(".door"));
  })();
})();

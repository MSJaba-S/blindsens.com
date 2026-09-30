/* blindsens.com – forside (v3): intro, levende arena, de fem skjulte trin, kurven, tal-rulle, roller og trailer.
   Ingen sporing, ingen eksterne kald. Kun transform og opacity animeres (undtagen arenaen, der er et lærred). */
(function(){
"use strict";
var d = document, H = d.documentElement, BS = window.BS || (window.BS = {});
var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
var FINE = !!(window.matchMedia && matchMedia("(pointer: fine)").matches);
var LIME = "#e4ff33", CYAN = "#12eeff";
function $(s, r){ return (r || d).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function c01(v){ return clamp(v, 0, 1); }
function io(el, fn, th){
  if(!el) return;
  if(!("IntersectionObserver" in window)){ fn(true, null); return; }
  var o = new IntersectionObserver(function(es){ es.forEach(function(x){ fn(x.isIntersecting, o); }); }, {threshold: th == null ? .3 : th});
  o.observe(el);
}
function easeOut3(k){ return 1 - Math.pow(1 - k, 3); }
function easeBack(k, s){ s = s == null ? 1.3 : s; var t = k - 1; return 1 + (s + 1) * t * t * t + s * t * t; }

/* =====================================================================
   ARENA (hero) – samme rum, mål og træf som i programmet
   ===================================================================== */
var hero = $(".hero");
var ARENA = (function(){
  var cv = $(".hero canvas"); if(!cv || !hero || !cv.getContext) return null;
  var g = cv.getContext("2d");
  var W = 0, Hh = 0, F = 0, CX = 0, CY = 0, small = false;
  var ROOM = {x: 7, h: 5, z: 16}, EYE = 1.7, NEAR = .12;
  var cam = {yaw: 0, pitch: 0};
  var T = [], forb = [], mouse = null, lastMove = -1e9, raf = 0, last = 0, vis = true, awake = !d.hidden, flick = null;
  var G = {x: 0, y: 0, to: null, from: null, t0: 0, trail: [], next: 0};
  var S = {hits: 0, clicks: 0, times: [], lastHit: 0, note: false};
  var hud = {hits: $("[data-h='hits']"), time: $("[data-h='time']"), acc: $("[data-h='acc']")}, note = $(".hud-note");
  var started = false;

  function rel(el){
    if(!el) return null; var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
    if(!r.width || !r.height) return null;
    return [r.left - c.left, r.top - c.top, r.right - c.left, r.bottom - c.top];
  }
  var bg = d.createElement("canvas"), bgx = bg.getContext("2d"), bgKey = "", DPR = 1, main = g;
  function size(){
    var r = cv.getBoundingClientRect();
    W = r.width; Hh = r.height; small = W < 700;
    /* skarpt, men aldrig mere end ca. 4 mio. pixels pr. billede */
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(4.2e6 / Math.max(1, W * Hh))));
    cv.width = bg.width = Math.round(W * DPR); cv.height = bg.height = Math.round(Hh * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0); bgx.setTransform(DPR, 0, 0, DPR, 0, 0); bgKey = "";
    F = small ? Math.max(W, Hh) * .66 : Math.max(W, Hh * 1.2) * .6;
    CX = W / 2; CY = Hh * (small ? .36 : .42);
    forb = [rel($(".hud")), rel(note), rel($(".hero h1")), rel($(".hero .side")), rel($(".hero-foot .in")), [0, 0, W, (parseFloat(getComputedStyle(H).getPropertyValue("--nav")) || 72) + 8]].filter(Boolean);
  }
  /* verden -> kamera */
  function cam3(x, y, z){
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var X = x, Y = y - EYE, Z = z;
    var x1 = X * cy - Z * sy, z1 = X * sy + Z * cy;
    return [x1, Y * cp - z1 * sp, Y * sp + z1 * cp];
  }
  function scr(p){ return [CX + F * p[0] / p[2], CY - F * p[1] / p[2]]; }
  function clipPoly(ps){
    var out = [];
    for(var i = 0; i < ps.length; i++){
      var a = ps[i], b = ps[(i + 1) % ps.length], ai = a[2] > NEAR, bi = b[2] > NEAR;
      if(ai) out.push(a);
      if(ai !== bi){ var t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    return out;
  }
  function poly(pts, fill){
    var c = clipPoly(pts.map(function(p){ return cam3(p[0], p[1], p[2]); })); if(c.length < 3) return;
    g.beginPath(); c.forEach(function(p, i){ var s = scr(p); if(i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.closePath();
    g.fillStyle = fill; g.fill();
  }
  function seg(a, b){
    var p = cam3(a[0], a[1], a[2]), q = cam3(b[0], b[1], b[2]), t;
    if(p[2] <= NEAR && q[2] <= NEAR) return;
    if(p[2] < NEAR){ t = (NEAR - p[2]) / (q[2] - p[2]); p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR]; }
    else if(q[2] < NEAR){ t = (NEAR - q[2]) / (p[2] - q[2]); q = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, NEAR]; }
    var s = scr(p), e = scr(q); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]);
  }
  function room(){
    var key = cam.yaw.toFixed(5) + "," + cam.pitch.toFixed(5) + "," + W + "," + Hh;
    if(key !== bgKey){ bgKey = key; g = bgx; roomDraw(); g = main; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function roomDraw(){
    var X = ROOM.x, C = ROOM.h, Z = ROOM.z, z0 = NEAR, i;
    g.fillStyle = "#07080a"; g.fillRect(0, 0, W, Hh);
    poly([[-X, C, z0], [X, C, z0], [X, C, Z], [-X, C, Z]], "#0a0b0e");
    poly([[-X, 0, z0], [X, 0, z0], [X, 0, Z], [-X, 0, Z]], "#0c0d10");
    poly([[-X, 0, z0], [-X, 0, Z], [-X, C, Z], [-X, C, z0]], "#111317");
    poly([[X, 0, z0], [X, 0, Z], [X, C, Z], [X, C, z0]], "#131519");
    poly([[-X, 0, Z], [X, 0, Z], [X, C, Z], [-X, C, Z]], "#17191e");
    g.lineWidth = 1;
    g.beginPath(); g.strokeStyle = "rgba(255,255,255,.05)";
    for(i = -X + 1; i < X; i++) seg([i, 0, z0], [i, 0, Z]);
    for(i = 1; i < Z; i++) seg([-X, 0, i], [X, 0, i]);
    g.stroke();
    g.beginPath(); g.strokeStyle = "rgba(255,255,255,.03)";
    for(i = -X + 2; i < X; i += 2) seg([i, 0, Z], [i, C, Z]);
    for(i = 2; i < Z; i += 2){ seg([-X, 0, i], [-X, C, i]); seg([X, 0, i], [X, C, i]); }
    g.stroke();
    g.beginPath(); g.strokeStyle = "rgba(255,255,255,.07)";
    seg([-X, C, Z], [X, C, Z]); seg([-X, 0, Z], [-X, C, Z]); seg([X, 0, Z], [X, C, Z]); seg([-X, C, z0], [-X, C, Z]); seg([X, C, z0], [X, C, Z]);
    g.stroke();
    g.beginPath(); g.strokeStyle = "rgba(228,255,51,.46)"; g.lineWidth = 1.2;
    seg([-X, 0, Z], [X, 0, Z]); seg([-X, 0, z0], [-X, 0, Z]); seg([X, 0, z0], [X, 0, Z]);
    g.stroke();
  }
  function circ(x, y, r){ g.beginPath(); g.arc(x, y, Math.max(.5, r), 0, 6.2832); }
  function place(t, fixed){
    var n = 0, x, y, z, p, s, r;
    for(; n < 60; n++){
      if(fixed && n === 0){ x = fixed[0]; y = fixed[1]; z = fixed[2]; }
      else { z = 10.5 + Math.random() * 4.2; x = (Math.random() * 2 - 1) * (small ? 3.4 : 5.6); y = .9 + Math.random() * 3.4; }
      p = cam3(x, y, z); if(p[2] < 1) continue;
      s = scr(p); r = F * t.wr / p[2];
      if(s[0] < r + 14 || s[0] > W - r - 14 || s[1] < r + 14 || s[1] > Hh - r - 14) continue;
      if(forb.some(function(f){ return s[0] + r + 14 > f[0] && s[0] - r - 14 < f[2] && s[1] + r + 14 > f[1] && s[1] - r - 14 < f[3]; })) continue;
      if(T.some(function(o){ return o !== t && o.sx != null && Math.hypot(o.sx - s[0], o.sy - s[1]) < r * 5.5; })) continue;
      break;
    }
    t.x = x; t.y = y; t.z = z; t.hit = -1; t.born = performance.now(); t.sx = s ? s[0] : null; t.sy = s ? s[1] : null; t.r = r || 10;
  }
  function reset(){
    size();
    var n = small ? 3 : 4; T = [];
    for(var i = 0; i < n; i++){ var t = {wr: small ? .4 : .3}; T.push(t); place(t); }
    if(!G.trail.length){ G.x = CX + (small ? -40 : -W * .12); G.y = CY + (small ? 40 : Hh * .14); }
  }
  function target(t, now){
    var p = cam3(t.x, t.y, t.z); if(p[2] < .5) return;
    var s = scr(p), r = F * t.wr / p[2]; t.sx = s[0]; t.sy = s[1]; t.r = r;
    if(t.hit >= 0){
      var k = (now - t.hit) / 460;
      if(k < 1 && !RM) burst(s[0], s[1], r, k);
      if(k > 1.15 || RM) place(t);
      return;
    }
    var a = RM ? 1 : c01((now - t.born) / 240), sc = .55 + .45 * easeOut3(a);
    g.globalAlpha = a;
    g.fillStyle = LIME; circ(s[0], s[1], r * sc); g.fill();
    g.lineWidth = Math.max(1, r * .06); g.strokeStyle = "rgba(0,0,0,.35)"; circ(s[0], s[1], r * sc); g.stroke();
    g.fillStyle = "rgba(0,0,0,.55)"; circ(s[0], s[1], Math.max(1.4, r * .11 * sc)); g.fill();
    g.globalAlpha = 1;
  }
  function burst(x, y, r, k){
    var e = easeOut3(k);
    if(k < .38){ g.fillStyle = "rgba(255,255,255," + (1 - k / .38).toFixed(3) + ")"; circ(x, y, r * (1 - .45 * k / .38)); g.fill(); }
    var R = r * (1.1 + e * 1.35);
    g.globalAlpha = 1 - k; g.strokeStyle = LIME; g.lineWidth = Math.max(1.5, r * .1); g.lineCap = "round";
    circ(x, y, R); g.stroke();
    g.beginPath();
    for(var i = 0; i < 8; i++){ var q = i * .7854 + .39, a0 = R + r * .35, a1 = a0 + r * .5 * (1 - e * .6); g.moveTo(x + Math.cos(q) * a0, y + Math.sin(q) * a0); g.lineTo(x + Math.cos(q) * a1, y + Math.sin(q) * a1); }
    g.stroke(); g.globalAlpha = 1;
  }
  function cross(x, y, a){
    g.globalAlpha = a == null ? 1 : a; g.strokeStyle = "#fff"; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x - 5, y); g.moveTo(x + 5, y); g.lineTo(x + 13, y); g.moveTo(x, y - 13); g.lineTo(x, y - 5); g.moveTo(x, y + 5); g.lineTo(x, y + 13); g.stroke();
    g.globalAlpha = 1;
  }
  function trail(pts){
    if(pts.length < 2) return;
    g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 2.6; g.strokeStyle = CYAN;
    for(var i = 1; i < pts.length; i++){ g.globalAlpha = i / pts.length * .9; g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
    g.globalAlpha = 1;
  }
  function ghost(now){
    var t = G.to;
    if(t && t.hit >= 0){ G.to = t = null; G.next = now + 380; }
    if(!t && now >= G.next){
      var free = T.filter(function(o){ return o.hit < 0 && o.sx != null && now - o.born > 400; });
      if(free.length){ t = G.to = free[Math.floor(Math.random() * free.length)]; G.from = [G.x, G.y]; G.t0 = now; }
    }
    if(t){
      var k = c01((now - G.t0) / 540), e = easeBack(k, 1.1);
      G.x = G.from[0] + (t.sx - G.from[0]) * e; G.y = G.from[1] + (t.sy - G.from[1]) * e;
      G.trail.push([G.x, G.y]); if(G.trail.length > 22) G.trail.shift();
      if(now - G.t0 > 700){ t.hit = now; G.to = null; G.next = now + 420 + Math.random() * 520; }
    } else if(G.trail.length) G.trail.shift();
    trail(G.trail); cross(G.x, G.y, .92);
  }
  function frame(now){
    raf = 0;
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    var active = !!mouse && now - lastMove < 2600;
    if(flick){
      var k = (now - flick.t0) / flick.dur;
      if(k >= 1){ cam.yaw = 0; flick = null; var c = T[0]; if(c && c.hit < 0){ c.hit = now; } G.x = CX; G.y = CY; G.trail = []; G.next = now + 650; }
      else cam.yaw = flick.from * (1 - easeBack(k, 1.15));
    } else if(!RM){
      var ty = active ? (mouse.x / W - .5) * 2 * .045 : 0, tp = active ? -(mouse.y / Hh - .5) * 2 * .028 : 0, a = Math.min(1, dt * 5);
      cam.yaw += (ty - cam.yaw) * a; cam.pitch += (tp - cam.pitch) * a;
    }
    room();
    for(var i = 0; i < T.length; i++) target(T[i], now);
    if(flick) cross(CX, CY, 1);
    else if(!active && !RM && started) ghost(now);
    loop();
  }
  function loop(){ if(!raf && vis && awake && !RM) raf = requestAnimationFrame(frame); }
  function draw(){ if(RM) frame(performance.now()); else loop(); }

  /* HUD */
  function setHud(hit){
    if(hud.hits){ hud.hits.textContent = String(S.hits); if(hit){ hud.hits.classList.add("lit"); setTimeout(function(){ hud.hits.classList.remove("lit"); }, 200); } }
    if(hud.time && S.times.length){ var m = S.times.reduce(function(a, b){ return a + b; }, 0) / S.times.length; hud.time.textContent = Math.round(m) + " ms"; }
    if(hud.acc && S.clicks) hud.acc.textContent = Math.round(S.hits / S.clicks * 100) + "%";
    if(S.hits >= 8 && !S.note && note){ S.note = true; note.classList.add("on"); setTimeout(function(){ note.classList.remove("on"); }, 6000); }
  }
  function shoot(x, y, slack){
    var now = performance.now(), hitT = null;
    S.clicks++;
    for(var i = 0; i < T.length; i++){ var t = T[i]; if(t.hit < 0 && t.sx != null && Math.hypot(x - t.sx, y - t.sy) <= t.r * slack){ hitT = t; break; } }
    if(hitT){
      hitT.hit = now; S.hits++;
      var base = Math.max(hitT.born, S.lastHit || 0), dtm = now - base;
      if(dtm > 60 && dtm < 4000){ S.times.push(dtm); if(S.times.length > 10) S.times.shift(); }
      S.lastHit = now; if(G.to === hitT) G.to = null;
    }
    setHud(!!hitT); draw();
  }
  var ptype = "mouse";
  hero.addEventListener("pointerdown", function(e){
    ptype = e.pointerType || "mouse";
    if(ptype !== "mouse" || e.button !== 0) return;
    if(e.target.closest && e.target.closest("a,button,.side,.nav,.menu")) return;
    var r = cv.getBoundingClientRect(); shoot(e.clientX - r.left, e.clientY - r.top, 1.12);
  });
  hero.addEventListener("click", function(e){
    if(ptype === "mouse") return;
    if(e.target.closest && e.target.closest("a,button,.side,.nav,.menu")) return;
    var r = cv.getBoundingClientRect(); shoot(e.clientX - r.left, e.clientY - r.top, 1.8);
  });
  if(FINE){
    hero.classList.add("aim");
    hero.addEventListener("pointermove", function(e){
      if(e.pointerType !== "mouse") return;
      var r = cv.getBoundingClientRect(); mouse = {x: e.clientX - r.left, y: e.clientY - r.top};
      if(!S.lastHit) S.lastHit = performance.now();
      lastMove = performance.now(); loop();
    });
    hero.addEventListener("pointerleave", function(){ mouse = null; });
  }
  var rs = 0;
  window.addEventListener("resize", function(){ cancelAnimationFrame(rs); rs = requestAnimationFrame(function(){ reset(); draw(); }); });
  io(hero, function(v){ vis = v; if(v) draw(); }, 0);
  d.addEventListener("visibilitychange", function(){ awake = !d.hidden; if(awake) draw(); });
  if(d.fonts && d.fonts.ready) d.fonts.ready.then(function(){ var keep = T; size(); keep.forEach(function(t){ if(t.sx != null && forb.some(function(f){ return t.sx > f[0] && t.sx < f[2] && t.sy > f[1] && t.sy < f[3]; })) place(t); }); draw(); });
  reset(); draw();

  return {
    /* åbningen: kameraet flikker ind på et mål, præcis som i en test */
    start: function(){
      if(started) return; started = true;
      if(RM){ draw(); return; }
      var c = T[0]; if(c){ c.wr = small ? .4 : .3; place(c, small ? [.35, 2.55, 12] : [.9, 2.35, 12.5]); }
      flick = {t0: performance.now(), dur: 1050, from: small ? .3 : .36};
      cam.yaw = flick.from; draw();
    }
  };
})();

/* ---------- intro, derefter åbner overskriften ---------- */
(function(){
  var h1 = $(".hero h1"), intro = $(".intro"), done = false;
  function go(delay){
    if(done) return; done = true;
    if(hero) hero.classList.add("go");
    if(h1) h1.classList.add("go");
    if(ARENA) setTimeout(ARENA.start, delay || 0);
  }
  if(H.classList.contains("intro-on") && intro && !RM){
    try{ sessionStorage.setItem("bs-intro", "1"); }catch(e){}
    if(BS.lockScroll) BS.lockScroll(true);
    intro.classList.add("run");
    var evs = ["pointerdown", "keydown", "wheel", "touchstart"];
    var end = function(){ intro.classList.add("done"); H.classList.remove("intro-on"); if(BS.lockScroll) BS.lockScroll(false); evs.forEach(function(ev){ window.removeEventListener(ev, skip, true); }); };
    var t1 = setTimeout(function(){ go(260); }, 1900), t2 = setTimeout(end, 2760);
    var skip = function(){ clearTimeout(t1); clearTimeout(t2); end(); go(); };
    evs.forEach(function(ev){ window.addEventListener(ev, skip, true); });
  } else {
    if(intro) intro.classList.add("done");
    H.classList.remove("intro-on");
    setTimeout(go, d.referrer && /blindsens|file:/.test(d.referrer) ? 320 : 80);
  }
  /* touch-tip */
  if(!FINE){ var tr = $(".hero-foot .try"); if(tr) tr.textContent = "The targets are live. Tap one."; }
})();

/* =====================================================================
   VANEN – ordene tænder, mens man læser
   ===================================================================== */
(function(){
  var p = $(".habit .say"); if(!p) return;
  var words = p.textContent.trim().split(/\s+/);
  p.innerHTML = words.map(function(w){ return '<span class="w8">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>"; }).join(" ");
  var ws = $$(".w8", p);
  if(RM){ ws.forEach(function(w){ w.classList.add("on"); }); return; }
  var n0 = -1;
  function upd(){
    var r = p.getBoundingClientRect(), vh = window.innerHeight;
    var k = c01((vh * .86 - r.top) / (r.height + vh * .32)), n = Math.round(k * ws.length);
    if(n === n0) return; n0 = n;
    ws.forEach(function(w, i){ w.classList.toggle("on", i < n); });
  }
  window.addEventListener("scroll", upd, {passive: true}); window.addEventListener("resize", upd); upd();
})();

/* =====================================================================
   DE FEM SKJULTE TRIN – lukker øjnene, blandes, åbner
   ===================================================================== */
(function(){
  var box = $(".slots"); if(!box || RM) return;
  var busy = false, on = false, timer = 0;
  function flip(){
    var cs = $$(".slot", box), first = cs.map(function(c){ return c.getBoundingClientRect(); });
    var order = cs.slice();
    for(var i = order.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    if(order.every(function(c, i){ return c === cs[i]; })) order.push(order.shift());
    order.forEach(function(c){ box.appendChild(c); });
    cs.forEach(function(c, i){
      var l = c.getBoundingClientRect(), f = first[i];
      c.style.transition = "none"; c.style.transform = "translate(" + (f.left - l.left) + "px," + (f.top - l.top) + "px)";
    });
    void box.offsetWidth;
    cs.forEach(function(c){ c.style.transition = "transform .7s cubic-bezier(.76,0,.24,1)"; c.style.transform = ""; });
  }
  function cycle(){
    if(!on || busy) return; busy = true;
    box.classList.add("shut");
    setTimeout(flip, 760); setTimeout(flip, 1520); setTimeout(flip, 2280);
    setTimeout(function(){
      box.classList.add("opening"); box.classList.remove("shut");
      setTimeout(function(){ box.classList.remove("opening"); }, 600);
      busy = false; timer = setTimeout(cycle, 3400);
    }, 3150);
  }
  io(box, function(v){ on = v; if(v && !busy && !timer) timer = setTimeout(cycle, 1100); if(!v && timer){ clearTimeout(timer); timer = 0; } }, .5);
})();

/* =====================================================================
   KURVEN – 30 blokke, kurvetilpasning, 400 gentrækninger, 90 %-bånd.
   Samme data og samme metode som eksemplet i programmet (0.400 -> 0.336).
   ===================================================================== */
(function(){
  var pin = $(".pin"), box = $("#chart"); if(!pin || !box) return;
  var ST = [.70, .84, 1, 1.19, 1.42], U = ST.map(Math.log);
  /* [trin, forskydning, score] i den rækkefølge, blokkene blev spillet */
  var P = [[3,.0039,.978],[4,.0039,.274],[2,-.0052,1.026],[1,-.0039,1.327],[3,-.0052,.7],[1,-.013,1.78],[0,.0052,.995],[0,.013,1.209],[1,.0052,1.332],[0,.0039,1.147],
           [3,.0052,.996],[2,.013,1.448],[0,-.0052,.96],[2,-.0039,1.264],[0,-.013,1.746],[2,.0039,1.265],[4,.013,.373],[0,-.0039,1.32],[1,-.0052,1.725],[3,-.0039,1.009],
           [1,.013,1.417],[2,.0052,1.286],[2,-.013,1.241],[3,-.013,.45],[4,.0052,.171],[3,.013,.775],[4,-.0052,.225],[1,.0039,1.273],[4,-.0039,.144],[4,-.013,.105]];
  function fit(idx){
    var s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
    idx.forEach(function(i){ var u = U[P[i][0]], y = P[i][2], u2 = u * u; s0++; s1 += u; s2 += u2; s3 += u2 * u; s4 += u2 * u2; t0 += y; t1 += u * y; t2 += u2 * y; });
    var A = [[s0, s1, s2, t0], [s1, s2, s3, t1], [s2, s3, s4, t2]];
    for(var c = 0; c < 3; c++){ var p = c; for(var r = c + 1; r < 3; r++) if(Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; var tmp = A[c]; A[c] = A[p]; A[p] = tmp;
      for(r = 0; r < 3; r++){ if(r === c) continue; var f = A[r][c] / A[c][c]; for(var k = c; k < 4; k++) A[r][k] -= f * A[c][k]; } }
    return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  }
  var ALL = []; for(var i = 0; i < 30; i++) ALL.push(i);
  var CF = fit(ALL), UPK = -CF[1] / (2 * CF[2]);
  var seed = 7; function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  var BOOT = [];
  for(var b = 0; b < 400 && BOOT.length < 36; b++){ var idx = []; for(i = 0; i < 30; i++) idx.push(Math.floor(rnd() * 30)); var c = fit(idx); if(c[2] < 0) BOOT.push(c); }
  var BAND = [Math.log(.311 / .4), Math.log(.353 / .4)];
  var rd = $(".readout", pin), rk = $(".k", rd), rv = $("b", rd), rs = $(".s", rd);
  var lis = $$(".steps li", pin), bars = $$(".steps .bar b", pin), segs = $$(".segs b", pin);
  var els = null, L = 0, lastP = -1;
  var mqStatic = window.matchMedia ? matchMedia("(max-height:540px),(max-width:1023px) and (max-height:600px)") : {matches: false};
  function isStatic(){ return RM || mqStatic.matches; }

  function render(){
    var r = box.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height); if(w < 60 || h < 60) return;
    var sm = w < 560, ml = sm ? 36 : 50, mr = sm ? 6 : 12, mt = sm ? 40 : 46, mb = sm ? 44 : 52;
    var x0 = ml, x1 = w - mr, y0 = mt, y1 = h - mb, uA = Math.log(.62), uB = Math.log(1.6), sMax = 1.92;
    function X(u){ return x0 + (u - uA) / (uB - uA) * (x1 - x0); }
    function Y(s){ return y1 - s / sMax * (y1 - y0); }
    function curve(c){
      var pts = [], u, y;
      for(var j = 0; j <= 72; j++){ u = Math.log(.66) + (Math.log(1.5) - Math.log(.66)) * j / 72; y = c[0] + c[1] * u + c[2] * u * u; if(y < 0){ pts.push([X(u), Y(0)]); break; } pts.push([X(u), Y(y)]); }
      return "M" + pts.map(function(p){ return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
    }
    var s = "", k;
    [.5, 1, 1.5].forEach(function(v){ s += '<line class="gl" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="tk" x="' + (x0 - 10) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v.toFixed(2) + "</text>"; });
    var cw = (X(U[1]) - X(U[0])) * .56;
    s += '<g class="cols">';
    for(k = 0; k < 5; k++) s += '<rect class="col" x="' + (X(U[k]) - cw / 2).toFixed(1) + '" y="' + y0 + '" width="' + cw.toFixed(1) + '" height="' + (y1 - y0) + '" rx="8"/>';
    s += "</g>";
    s += '<rect class="band" x="' + X(BAND[0]).toFixed(1) + '" y="' + y0 + '" width="' + (X(BAND[1]) - X(BAND[0])).toFixed(1) + '" height="' + (y1 - y0) + '"/>';
    s += '<line class="ax" x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '"/>';
    for(k = 0; k < 5; k++) s += '<text class="tk' + (k === 2 ? " me" : "") + '" x="' + X(U[k]).toFixed(1) + '" y="' + (y1 + 22) + '" text-anchor="middle">×' + ST[k].toFixed(2) + "</text>";
    s += '<text class="ttl" x="' + x1 + '" y="' + (h - 4) + '" text-anchor="end">Hidden sensitivity step</text>';
    s += '<text class="ttl" x="' + x0 + '" y="' + (y0 - 22) + '">Score</text>';
    s += '<g class="boots">' + BOOT.map(function(c){ return '<path class="bs" d="' + curve(c) + '"/>'; }).join("") + "</g>";
    s += '<path class="fit" d="' + curve(CF) + '"/>';
    s += P.map(function(p){ return '<circle class="dot" cx="' + X(U[p[0]] + p[1]).toFixed(1) + '" cy="' + Y(p[2]).toFixed(1) + '" r="' + (sm ? 3.8 : 4.6) + '" fill="#fff"/>'; }).join("");
    var nx = X(0).toFixed(1), bx = X(UPK).toFixed(1), by = Y(CF[0] + CF[1] * UPK + CF[2] * UPK * UPK).toFixed(1);
    s += '<g class="mk now"><line x1="' + nx + '" x2="' + nx + '" y1="' + (y0 + 12) + '" y2="' + y1 + '" stroke="#fff" stroke-width="1.4" stroke-dasharray="4 6"/><text class="lbl" x="' + (+nx + 8) + '" y="' + (y0 + 24) + '" fill="#fff">Now</text></g>';
    s += '<g class="mk best"><line x1="' + bx + '" x2="' + bx + '" y1="' + (y0 + 12) + '" y2="' + y1 + '" stroke="' + LIME + '" stroke-width="2"/><circle cx="' + bx + '" cy="' + by + '" r="7" fill="' + LIME + '"/><circle cx="' + bx + '" cy="' + by + '" r="14" fill="none" stroke="' + LIME + '" stroke-opacity=".4" stroke-width="1.6"/><text class="lbl" x="' + (+bx - 12) + '" y="' + (y0 + 24) + '" text-anchor="end" fill="' + LIME + '">Best ×0.84</text></g>';
    var tw = sm ? 172 : 206, th = sm ? 26 : 30;
    s += '<g class="mk tag"><rect x="' + (x1 - tw) + '" y="' + (y0 - th - 12) + '" width="' + tw + '" height="' + th + '" rx="' + th / 2 + '" fill="' + LIME + '"/><text class="tagt" x="' + (x1 - tw / 2) + '" y="' + (y0 - th / 2 - 8) + '" text-anchor="middle">STATISTICALLY CONFIDENT</text></g>';
    box.innerHTML = '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true" focusable="false">' + s + "</svg>";
    var svg = box.firstChild;
    var tt = $(".tagt", svg), trc = $(".tag rect", svg);
    if(tt && trc && tt.getComputedTextLength){ var tl = tt.getComputedTextLength(), pw = Math.ceil(tl + (sm ? 24 : 30)); trc.setAttribute("width", pw); trc.setAttribute("x", x1 - pw); tt.setAttribute("x", (x1 - pw / 2 + 1).toFixed(1)); }
    els = {cols: $$(".col", svg), dots: $$(".dot", svg), bs: $$(".bs", svg), fit: $(".fit", svg), band: $(".band", svg), now: $(".now", svg), best: $(".best", svg), tag: $(".tag", svg)};
    L = els.fit.getTotalLength ? els.fit.getTotalLength() : 900;
    els.fit.style.strokeDasharray = L;
    lastP = -1; update(true);
  }
  function text(a, b, c, lit){
    if(rk.textContent !== a) rk.textContent = a; if(rv.textContent !== b) rv.textContent = b; if(rs.textContent !== c) rs.textContent = c;
    rv.classList.toggle("lit", !!lit);
  }
  function update(force){
    if(!els) return;
    var p = 1;
    if(!isStatic()){ var r = pin.getBoundingClientRect(), tot = r.height - window.innerHeight; p = tot > 0 ? c01(-r.top / tot) : 1; }
    if(!force && Math.abs(p - lastP) < .0004) return; lastP = p;
    var q = c01((p - .03) / .9) * 4, s1 = c01(q), s2 = c01(q - 1), s3 = c01(q - 2), s4 = c01(q - 3), k = Math.min(3, Math.floor(q));
    var sv = [s1, s2, s3, s4];
    lis.forEach(function(l, i){ l.classList.toggle("on", i === k); l.classList.toggle("done", i < k); });
    bars.forEach(function(b, i){ b.style.transform = "scaleX(" + sv[i].toFixed(4) + ")"; });
    segs.forEach(function(b, i){ b.style.transform = "scaleX(" + sv[i].toFixed(4) + ")"; });
    var blk = Math.min(29, Math.floor(s1 * 30)), live = s1 > 0 && s1 < 1;
    els.cols.forEach(function(c, i){ c.classList.toggle("on", live && P[blk][0] === i); });
    var nd = Math.round(s2 * 30); els.dots.forEach(function(dd, i){ dd.classList.toggle("on", i < nd); });
    var f3 = c01(s3 * 1.35); els.fit.style.strokeDashoffset = (L * (1 - f3)).toFixed(1);
    var nb = Math.round(c01(s3 * 1.4 - .35) * els.bs.length); els.bs.forEach(function(x, i){ x.classList.toggle("on", i < nb); });
    els.band.style.transform = "scaleX(" + c01(s4 * 1.8).toFixed(3) + ")";
    els.now.classList.toggle("on", s4 > .08); els.best.classList.toggle("on", s4 > .3); els.tag.classList.toggle("on", s4 > .72);
    if(k === 0) text("Block", (blk + 1) + " / 30", "Sensitivity hidden");
    else if(k === 1) text("Points", nd + " / 30", "One score per block");
    else if(k === 2) text("Resamples", Math.round(c01(s3 * 1.4 - .35) * 400) + " / 400", "How far can the peak move?");
    else { var e = c01(s4 * 1.3), v = .4 + (.4 * Math.exp(UPK) - .4) * easeOut3(e); text("Your sens", v.toFixed(3), e >= 1 ? "Statistically confident" : "Checking the peak", e >= 1); }
  }
  function mode(){ pin.classList.toggle("static", RM); }
  mode();
  var rr = 0;
  function onResize(){ cancelAnimationFrame(rr); rr = requestAnimationFrame(render); }
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", function(){ update(false); }, {passive: true});
  if(d.fonts && d.fonts.ready) d.fonts.ready.then(render);
  render();
})();

/* =====================================================================
   TAL-RULLE 0.400 -> 0.336, låser i lime
   ===================================================================== */
(function(){
  var el = $(".odo .new"); if(!el) return;
  var to = el.getAttribute("data-v"), from = el.getAttribute("data-from") || to, html = "";
  for(var i = 0; i < to.length; i++){
    var ch = to[i];
    if(ch < "0" || ch > "9"){ html += '<span class="pt">' + ch + "</span>"; continue; }
    var col = ""; for(var n = 0; n <= 9; n++) col += "<b>" + n + "</b>";
    var f = from[i] >= "0" && from[i] <= "9" ? +from[i] : 0;
    html += '<span class="dg"><span data-to="' + ch + '" style="transform:translateY(' + (-f * 10) + '%)">' + col + "</span></span>";
  }
  el.innerHTML = html; el.setAttribute("aria-label", to); el.setAttribute("role", "img");
  var cols = $$(".dg > span", el);
  function go(){
    cols.forEach(function(s, i){ s.style.transitionDelay = (i * .12) + "s"; s.style.transform = "translateY(" + (-parseInt(s.getAttribute("data-to"), 10) * 10) + "%)"; });
    setTimeout(function(){ el.classList.remove("pre"); }, RM ? 0 : 1250);
  }
  if(RM){ go(); return; }
  el.classList.add("pre");
  io(el, function(v, o){ if(v){ if(o) o.disconnect(); go(); } }, .4);
})();

/* ---------- resultatbilledet åbner som et øjenlåg; numrene peger ---------- */
(function(){
  var fr = $(".frame"); if(!fr) return;
  if(RM) fr.classList.add("in"); else io(fr, function(v, o){ if(v){ fr.classList.add("in"); if(o) o.disconnect(); } }, .25);
  $$(".legend li").forEach(function(li){
    var pa = $('.pa[data-n="' + li.getAttribute("data-n") + '"]', fr); if(!pa) return;
    li.addEventListener("mouseenter", function(){ pa.classList.add("hot"); });
    li.addEventListener("mouseleave", function(){ pa.classList.remove("hot"); });
  });
})();

/* =====================================================================
   ROLLER – et tal pr. rolle (eksempel fra Overwatch)
   ===================================================================== */
(function(){
  var root = $(".roles"); if(!root) return;
  var R = {
    sharp:   {tests: [["flick", "Flick"], ["micro", "Micro adjust"]], heroes: "Ana, Ashe, Cassidy, Emre, Freja, Hanzo, Illari, Kiriko, Sojourn, Widowmaker", zoom: true},
    anchor:  {tests: [["track", "Tracking"], ["strafe", "Reactive tracking"]], heroes: "Baptiste, Bastion, Domina, Juno, Mauga, Sierra, Soldier: 76, Symmetra, Winston, Zarya"},
    entry:   {tests: [["switch", "Target switch"], ["strafe", "Reactive tracking"]], heroes: "Anran, D.Va, Doomfist, Genji, Hazard, Junker Queen, Reaper, Shion, Sombra, Tracer, Vendetta, Venture, Wrecking Ball"},
    support: {tests: [["flick", "Flick"], ["track", "Tracking"], ["switch", "Target switch"]], heroes: "Brigitte, D.Mon, Echo, Jetpack Cat, Junkrat, Lifeweaver, Lúcio, Mei, Mercy, Mizuki, Moira, Orisa, Pharah, Ramattra, Reinhardt, Roadhog, Sigma, Torbjörn, Wuyang, Zenyatta"}
  };
  var tabs = $$(".tab", root), panel = $("#rolepanel"), imgs = $$(".stagebox img", root), cap = $(".stagebox .cap", root);
  var chipsBox = $("[data-f='chips']", root), heroesEl = $("[data-f='heroes']", root), zoomEl = $("[data-f='zoom']", root), cur = "sharp", busy = 0;
  function pic(dkey, label){
    imgs.forEach(function(im){ im.classList.toggle("on", im.getAttribute("data-d") === dkey); });
    if(cap) cap.textContent = label;
    $$(".chip", chipsBox).forEach(function(c){ c.setAttribute("aria-pressed", c.getAttribute("data-d") === dkey ? "true" : "false"); });
  }
  function fill(key){
    var r = R[key];
    chipsBox.innerHTML = r.tests.map(function(t, i){ return '<button class="chip" type="button" data-d="' + t[0] + '" aria-pressed="' + (i ? "false" : "true") + '">' + t[1] + "</button>"; }).join("");
    heroesEl.textContent = r.heroes;
    zoomEl.hidden = !r.zoom;
    pic(r.tests[0][0], r.tests[0][1]);
  }
  function select(key, focus){
    if(key === cur && !focus) return;
    cur = key;
    tabs.forEach(function(t){ var on = t.getAttribute("data-role") === key; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; if(on && focus) t.focus(); });
    panel.setAttribute("aria-labelledby", "tab-" + key);
    if(RM){ fill(key); return; }
    clearTimeout(busy); panel.classList.add("swap");
    busy = setTimeout(function(){ fill(key); panel.classList.remove("swap"); }, 220);
  }
  tabs.forEach(function(t, i){
    t.addEventListener("click", function(){ select(t.getAttribute("data-role")); });
    t.addEventListener("keydown", function(e){
      var n = null;
      if(e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % tabs.length;
      else if(e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      else if(e.key === "Home") n = 0; else if(e.key === "End") n = tabs.length - 1;
      if(n != null){ e.preventDefault(); select(tabs[n].getAttribute("data-role"), true); }
    });
  });
  chipsBox.addEventListener("click", function(e){ var c = e.target.closest && e.target.closest(".chip"); if(c) pic(c.getAttribute("data-d"), c.textContent); });
})();

/* =====================================================================
   TRAILER – fuld skærm med egne kontroller (ingen browser-standard)
   ===================================================================== */
(function(){
  var screen = $(".screen"); if(!screen) return;
  var SRC = screen.getAttribute("href"), POSTER = "media/poster.webp";
  /* markøren bliver en «Play»-cirkel over billedet */
  if(FINE && !RM){
    screen.addEventListener("mousemove", function(e){ var r = screen.getBoundingClientRect(); screen.style.setProperty("--cx", (e.clientX - r.left) + "px"); screen.style.setProperty("--cy", (e.clientY - r.top) + "px"); screen.classList.add("hov"); });
    screen.addEventListener("mouseleave", function(){ screen.classList.remove("hov"); });
  }
  var tv = d.createElement("div");
  tv.className = "tv paused"; tv.setAttribute("role", "dialog"); tv.setAttribute("aria-modal", "true"); tv.setAttribute("aria-label", "Blindsens trailer");
  tv.innerHTML = '<div class="scr"><video playsinline preload="none"></video><div class="ctl">' +
    '<button class="pp" type="button" aria-label="Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" fill="currentColor"/><path class="i-play" d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></button>' +
    '<div class="trk" role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="38" aria-valuenow="0" tabindex="0"><i></i></div><span class="tm">0:00 / 0:38</span>' +
    '<button class="mu" type="button" aria-label="Mute"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="i-snd" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="i-off" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
    '</div></div><button class="x" type="button" aria-label="Close trailer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
  d.body.appendChild(tv);
  var vid = $("video", tv), pp = $(".pp", tv), mu = $(".mu", tv), trk = $(".trk", tv), bar = $(".trk i", tv), tm = $(".tm", tv), scr = $(".scr", tv), hideT = 0, opener = null, isOn = false, raf = 0;
  vid.poster = POSTER;
  function fmt(t){ t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
  function sync(){
    tv.classList.toggle("paused", vid.paused); pp.setAttribute("aria-label", vid.paused ? "Play" : "Pause");
    tv.classList.toggle("muted", vid.muted); mu.setAttribute("aria-label", vid.muted ? "Unmute" : "Mute");
  }
  function tick(){
    raf = 0; if(!isOn) return;
    var dur = vid.duration || 38;
    bar.style.transform = "scaleX(" + c01(vid.currentTime / dur).toFixed(4) + ")";
    tm.textContent = fmt(vid.currentTime) + " / " + fmt(dur); trk.setAttribute("aria-valuenow", Math.floor(vid.currentTime));
    raf = requestAnimationFrame(tick);
  }
  function play(){ var p = vid.play(); if(p && p.catch) p.catch(function(){ sync(); }); }
  function toggle(){ if(vid.paused) play(); else vid.pause(); }
  function show(){
    if(!vid.getAttribute("src")) vid.src = SRC;
    tv.classList.add("on"); H.classList.add("tv-on"); if(BS.lockScroll) BS.lockScroll(true); isOn = true;
    try{ vid.currentTime = 0; }catch(e){}
    play(); tick(); $(".x", tv).focus({preventScroll: true}); poke();
  }
  function open(trigger, shut){
    opener = trigger || d.activeElement;
    if(shut){ show(); if(BS.lids) BS.lids.open(); return; }
    if(BS.lids && !RM) BS.lids.close(function(){ show(); BS.lids.open(); }); else show();
  }
  function close(){
    var fin = function(){ vid.pause(); tv.classList.remove("on"); H.classList.remove("tv-on"); if(BS.lockScroll) BS.lockScroll(false); isOn = false; if(opener && opener.focus) opener.focus({preventScroll: true}); };
    if(BS.lids && !RM) BS.lids.close(function(){ fin(); BS.lids.open(); }); else fin();
  }
  function poke(){ tv.classList.add("act"); clearTimeout(hideT); hideT = setTimeout(function(){ tv.classList.remove("act"); }, 1900); }
  BS.openTrailer = open;
  $(".x", tv).addEventListener("click", close);
  vid.addEventListener("ended", close);
  pp.addEventListener("click", toggle); vid.addEventListener("click", toggle);
  mu.addEventListener("click", function(){ vid.muted = !vid.muted; sync(); });
  ["play", "pause", "volumechange", "loadedmetadata"].forEach(function(ev){ vid.addEventListener(ev, sync); });
  function seek(e){ var r = trk.getBoundingClientRect(); if(vid.duration) vid.currentTime = c01((e.clientX - r.left) / r.width) * vid.duration; }
  var drag = false;
  trk.addEventListener("pointerdown", function(e){ drag = true; try{ trk.setPointerCapture(e.pointerId); }catch(err){} seek(e); });
  trk.addEventListener("pointermove", function(e){ if(drag) seek(e); });
  trk.addEventListener("pointerup", function(){ drag = false; });
  scr.addEventListener("mousemove", poke);
  d.addEventListener("keydown", function(e){
    if(!isOn) return;
    if(e.key === "Escape"){ e.preventDefault(); close(); }
    else if((e.key === " " || e.key === "k") && e.target.tagName !== "BUTTON"){ e.preventDefault(); toggle(); poke(); }
    else if(e.key === "m"){ vid.muted = !vid.muted; sync(); poke(); }
    else if(e.key === "ArrowRight"){ vid.currentTime = Math.min(vid.duration || 38, vid.currentTime + 5); poke(); }
    else if(e.key === "ArrowLeft"){ vid.currentTime = Math.max(0, vid.currentTime - 5); poke(); }
    else if(e.key === "Tab"){ var f = [pp, trk, mu, $(".x", tv)], i = f.indexOf(d.activeElement);
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); } else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); } }
  });
})();
})();

/* blindsens.com – fælles for alle sider: Steam-knap, navigation, mobilmenu, øjenlåg ved sideskift og hop.
   Ingen sporing, ingen cookies, ingen eksterne kald. */
(function(){
"use strict";

/* ================================================================
   ÉT STED AT ÆNDRE, NÅR STEAM-SIDEN ER OFFENTLIG
   Indsæt adressen, fx "https://store.steampowered.com/app/1234560/Blindsens/".
   Så bliver alle «Coming to Steam» til en lime «Wishlist on Steam»-knap.
   ================================================================ */
var STEAM_URL = "";

var d = document, H = d.documentElement;
var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function $(s, r){ return (r || d).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
var BS = window.BS = window.BS || {};
BS.RM = RM;

/* ---------- Steam ---------- */
if(STEAM_URL){
  $$("[data-steam]").forEach(function(el){
    var a = d.createElement("a");
    a.className = "btn pri"; a.href = STEAM_URL; a.rel = "noopener";
    a.innerHTML = el.innerHTML.replace("Coming to Steam", "Wishlist on Steam");
    el.parentNode.replaceChild(a, el);
  });
  /* én hovedknap: traileren bliver sekundær, når Steam er klar */
  $$("[data-ctas] .btn.pri[data-cta='trailer']").forEach(function(b){ b.classList.remove("pri"); b.classList.add("sec"); });
}

/* ---------- blød scroll (kun forsiden har Lenis) ---------- */
if(window.Lenis && !RM && !(window.matchMedia && matchMedia("(pointer: coarse)").matches)){
  try{
    BS.lenis = new window.Lenis({lerp: .11, wheelMultiplier: 1, smoothWheel: true, syncTouch: false});
    (function raf(t){ BS.lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }catch(e){ BS.lenis = null; }
}
function scrollToY(y){
  if(BS.lenis) BS.lenis.scrollTo(y, {immediate: true, force: true});
  else { var b = H.style.scrollBehavior; H.style.scrollBehavior = "auto"; window.scrollTo(0, y); H.style.scrollBehavior = b; }
}
BS.scrollToY = scrollToY;
function lockScroll(on){ if(BS.lenis){ if(on) BS.lenis.stop(); else BS.lenis.start(); } }
BS.lockScroll = lockScroll;

/* ---------- øjenlåg ---------- */
var lids = $(".lids");
var lidT = 0;
BS.lids = {
  close: function(cb){
    if(!lids || RM){ if(cb) cb(); return; }
    clearTimeout(lidT);
    lids.classList.remove("opening"); lids.classList.add("on"); void lids.offsetWidth; lids.classList.add("shut");
    lidT = setTimeout(function(){ if(cb) cb(); }, 450);
  },
  open: function(cb){
    if(!lids || RM){ if(lids) lids.classList.remove("on", "shut", "opening"); if(cb) cb(); return; }
    clearTimeout(lidT);
    lids.classList.add("on", "opening"); lids.classList.remove("shut");
    lidT = setTimeout(function(){ lids.classList.remove("on", "opening"); if(cb) cb(); }, 760);
  }
};
/* ankomst fra en anden side: låget er lukket fra første billede og åbner nu */
if(H.classList.contains("veil-in")){
  if(lids){ lids.classList.add("on", "shut"); }
  H.classList.remove("veil-in");
  var opened = false;
  var go = function(){ if(opened) return; opened = true; requestAnimationFrame(function(){ BS.lids.open(); }); };
  if(d.fonts && d.fonts.ready) d.fonts.ready.then(go);
  setTimeout(go, 260);
}
/* tilbage-knappen kan gendanne en side med lukket låg */
window.addEventListener("pageshow", function(e){ if(e.persisted && lids && lids.classList.contains("shut")) BS.lids.open(); });

/* ---------- hop inden for siden: lukker, flytter, åbner ---------- */
function targetY(el){
  var sp = parseFloat(getComputedStyle(H).scrollPaddingTop) || 0, sm = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - sp - sm);
}
BS.targetY = targetY;
BS.jump = function(el, hash){
  if(!el) return;
  BS.lids.close(function(){
    scrollToY(targetY(el));
    if(hash && history.replaceState) try{ history.replaceState(null, "", hash); }catch(e){}
    setTimeout(function(){ BS.lids.open(); }, 60);
  });
};

/* ---------- navigation: gennemsigtig over hero, sort ellers ---------- */
var nav = $(".nav");
if(nav && d.body.classList.contains("nav-clear")){
  var onScroll = function(){ nav.classList.toggle("solid", window.pageYOffset > 24); };
  window.addEventListener("scroll", onScroll, {passive: true}); onScroll();
}

/* ---------- mobilmenu ---------- */
var menu = $("#menu"), mbtn = $(".nav .mbtn"), menuOpen = false, lastFocus = null;
function openMenu(){
  if(!menu || menuOpen) return; menuOpen = true; lastFocus = d.activeElement;
  mbtn.setAttribute("aria-expanded", "true"); H.classList.add("menu-on"); lockScroll(true);
  BS.lids.close(function(){
    menu.hidden = false; menu.classList.add("on"); void menu.offsetWidth; menu.classList.add("show");
    var first = $(".big a", menu); if(first) first.focus({preventScroll: true});
  });
}
function closeMenu(after){
  if(!menu || !menuOpen) { if(after) after(); return; }
  menuOpen = false; mbtn.setAttribute("aria-expanded", "false");
  menu.classList.remove("show");
  setTimeout(function(){
    menu.classList.remove("on"); menu.hidden = true; H.classList.remove("menu-on"); lockScroll(false);
    if(after) after(); else { BS.lids.open(); if(lastFocus && lastFocus.focus) lastFocus.focus({preventScroll: true}); }
  }, RM ? 0 : 160);
}
BS.closeMenu = closeMenu;
if(mbtn && menu){
  mbtn.addEventListener("click", openMenu);
  $("[data-close]", menu).addEventListener("click", function(){ closeMenu(); });
  d.addEventListener("keydown", function(e){
    if(!menuOpen) return;
    if(e.key === "Escape"){ e.preventDefault(); closeMenu(); return; }
    if(e.key === "Tab"){
      var f = $$("a[href],button:not([disabled])", menu).filter(function(x){ return x.offsetParent !== null; });
      if(!f.length) return;
      var i = f.indexOf(d.activeElement);
      if(e.shiftKey && (i <= 0)){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("resize", function(){ if(menuOpen && window.innerWidth > 860) closeMenu(); });
}

/* ---------- alle links: hop, trailer og sideskift med øjenlåg ---------- */
function samePage(u){
  var a = u.pathname.replace(/index\.html$/, ""), b = location.pathname.replace(/index\.html$/, "");
  return a === b && u.search === location.search;
}
d.addEventListener("click", function(e){
  var a = e.target.closest && e.target.closest("a[href]"); if(!a) return;
  if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  var href = a.getAttribute("href") || "";
  if(/^(mailto|tel):/i.test(href)) return;
  var u; try{ u = new URL(a.href, location.href); }catch(err){ return; }
  if(u.protocol !== location.protocol || u.host !== location.host) return;
  var inMenu = menuOpen && menu.contains(a);

  /* traileren åbner i fuld skærm, uanset hvor linket står */
  if(a.getAttribute("data-cta") === "trailer" && BS.openTrailer && (samePage(u) || /\.mp4$/i.test(u.pathname))){
    e.preventDefault();
    if(inMenu){ closeMenu(function(){ BS.openTrailer(a, true); }); } else BS.openTrailer(a);
    return;
  }
  /* hop til en sektion på samme side */
  if(samePage(u) && u.hash){
    var el = d.getElementById(decodeURIComponent(u.hash.slice(1))); if(!el) return;
    e.preventDefault();
    if(inMenu){
      closeMenu(function(){ scrollToY(targetY(el)); if(history.replaceState) try{ history.replaceState(null, "", u.hash); }catch(err){} setTimeout(function(){ BS.lids.open(); }, 60); });
    } else BS.jump(el, u.hash);
    return;
  }
  /* en anden side på blindsens.com */
  if(!/(\.html|\/)$/i.test(u.pathname)) return;
  e.preventDefault();
  try{ sessionStorage.setItem("bs-veil", "1"); }catch(err){}
  var goNow = function(){ window.location.href = u.href; };
  if(inMenu){ menu.classList.remove("show"); setTimeout(goNow, RM ? 0 : 160); }
  else BS.lids.close(goNow);
  /* sikkerhed: bliver vi på siden (fx en fejlende adresse), åbner låget igen */
  setTimeout(function(){ try{ sessionStorage.removeItem("bs-veil"); }catch(err){} BS.lids.open(); }, 5000);
});

/* ---------- linjer der åbner som et øje, når de ses ---------- */
function io(el, fn, th){
  if(!el) return;
  if(!("IntersectionObserver" in window)){ fn(true); return; }
  var o = new IntersectionObserver(function(es){ es.forEach(function(x){ if(x.isIntersecting){ fn(true, o); } }); }, {threshold: th == null ? .35 : th});
  o.observe(el);
}
BS.io = io;
$$("[data-eye='view']").forEach(function(el){ if(RM){ el.classList.add("go"); return; } io(el, function(v, o){ el.classList.add("go"); if(o) o.disconnect(); }, .45); });

/* ---------- indholdsfortegnelse (privatliv, presse) ---------- */
var toc = $(".toc");
if(toc && "IntersectionObserver" in window){
  var links = $$("a", toc), map = {};
  links.forEach(function(l){ var id = l.getAttribute("href").slice(1); var t = d.getElementById(id); if(t) map[id] = l; });
  var ob = new IntersectionObserver(function(es){
    es.forEach(function(x){ if(x.isIntersecting){ links.forEach(function(l){ l.classList.remove("on"); }); var l = map[x.target.id]; if(l) l.classList.add("on"); } });
  }, {rootMargin: "-20% 0px -70% 0px"});
  Object.keys(map).forEach(function(id){ ob.observe(d.getElementById(id)); });
}

/* ---------- kopiér tekst (presse) ---------- */
$$("[data-copy]").forEach(function(b){
  b.addEventListener("click", function(){
    var src = $(b.getAttribute("data-copy")); if(!src) return;
    var txt = src.textContent.trim(), label = b.textContent;
    var done = function(){ b.classList.add("ok"); b.textContent = "Copied"; setTimeout(function(){ b.classList.remove("ok"); b.textContent = label; }, 1600); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    function fallback(){
      var r = d.createRange(); r.selectNodeContents(src); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      try{ d.execCommand("copy"); done(); }catch(e){}
    }
  });
});
})();

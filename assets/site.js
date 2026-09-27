/* blindsens.com: intro-animation, kurven tegnes ved visning, trailer-afspiller. Ingen sporing. */
(function(){
  var h=document.querySelector(".hero");
  if(h){
    var go=function(){ if(h.classList.contains("anim")) return;
      var l=h.querySelector(".lockup"), w=h.querySelector(".wmc");
      var sx=(w.offsetWidth+parseFloat(getComputedStyle(w).marginLeft||0))/2;
      l.style.setProperty("--sx", sx+"px"); h.classList.add("anim"); };
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    setTimeout(go, 1200);
  }
  var c=document.getElementById("chart");
  if(c){
    if("IntersectionObserver" in window){
      var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ c.classList.add("in"); io.disconnect(); } }); },{threshold:.35});
      io.observe(c);
    } else c.classList.add("in");
  }
  document.querySelectorAll(".player").forEach(function(p){
    var v=p.querySelector("video"), b=p.querySelector(".play");
    if(!v||!b) return;
    b.addEventListener("click", function(){ p.classList.add("on"); v.controls=true; var r=v.play(); if(r&&r.catch) r.catch(function(){}); });
  });
})();

(function (LV) {
  LV.animStarBurst = function (x, y, color, onDone) {
    const layer = document.getElementById('fx-layer');
    if (!layer) { if (onDone) onDone(); return; }

    const star = document.createElement('div');
    star.className = 'fx-star';
    star.textContent = '⭐';
    star.style.left = x + 'px';
    star.style.top = y + 'px';
    layer.appendChild(star);

    const barEl = document.querySelector('.bar-slot.is-champ') ||
      document.querySelector('.bar-slot');
    let ex = innerWidth / 2;
    let ey = 120;
    if (barEl) {
      const r = barEl.getBoundingClientRect();
      ex = r.left + r.width / 2;
      ey = r.top + r.height * 0.3;
    }

    const dur = 800;
    const t0 = performance.now();

    function frame(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const bx = x + (ex - x) * ease;
      const by = y + (ey - y) * ease - Math.sin(p * Math.PI) * 60;
      star.style.transform = 'translate(' + (bx - x) + 'px, ' + (by - y) + 'px) scale(' + (1 + p * 0.5) + ') rotate(' + (p * 360) + 'deg)';
      star.style.opacity = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
      if (p < 1) requestAnimationFrame(frame);
      else {
        star.remove();
        miniBurst(ex, ey, color);
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(frame);
  };

  function miniBurst(cx, cy, color) {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    for (let i = 0; i < 12; i++) {
      const sp = document.createElement('div');
      const a = (Math.PI * 2 / 12) * i;
      const dist = 24 + Math.random() * 20;
      sp.className = 'fx-particle';
      sp.style.background = color;
      sp.style.left = cx + 'px';
      sp.style.top = cy + 'px';
      layer.appendChild(sp);
      let prog = 0;
      const tx = cx + Math.cos(a) * dist;
      const ty = cy + Math.sin(a) * dist;
      (function anim() {
        prog = Math.min(prog + 0.07, 1);
        sp.style.left = (cx + (tx - cx) * prog) + 'px';
        sp.style.top = (cy + (ty - cy) * prog + prog * prog * 12) + 'px';
        sp.style.opacity = 1 - prog;
        if (prog < 1) requestAnimationFrame(anim);
        else sp.remove();
      })();
    }
  }
})(window.LV);

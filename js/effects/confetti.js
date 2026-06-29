(function (LV) {
  const fwC = () => document.getElementById('fw-canvas');
  let fwP = [];
  let fwOn = false;
  let fwInt = null;
  let fwStopTimer = null;

  function getCtx() {
    const c = fwC();
    return c ? c.getContext('2d') : null;
  }

  LV.resizeConfetti = function () {
    const c = fwC();
    if (c) { c.width = innerWidth; c.height = innerHeight; }
  };

  function mkFW(x, y, color) {
    const n = 40 + Math.random() * 20;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i + Math.random() * 0.3;
      const s = 2 + Math.random() * 5;
      fwP.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        alpha: 1,
        color: color || 'hsl(' + (Math.random() * 360) + ', 85%, 60%)',
        size: 2 + Math.random() * 3,
        grav: 0.12,
        decay: 0.025 + Math.random() * 0.015,
      });
    }
  }

  function animFW() {
    if (!fwOn) return;
    const ctx = getCtx();
    const c = fwC();
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = fwP.length - 1; i >= 0; i--) {
      const p = fwP[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.grav;
      p.vx *= 0.985;
      p.alpha -= p.decay;
      if (p.alpha <= 0) fwP.splice(i, 1);
    }
    requestAnimationFrame(animFW);
  }

  LV.launchConfetti = function (color) {
    if (fwStopTimer) clearTimeout(fwStopTimer);
    if (fwInt) clearInterval(fwInt);
    fwOn = true;
    LV.resizeConfetti();
    animFW();

    let c = 0;
    (function burst() {
      if (c >= 10) return;
      const canvas = fwC();
      if (!canvas) return;
      mkFW(Math.random() * canvas.width, Math.random() * canvas.height * 0.55, c % 3 === 0 ? color : null);
      mkFW(Math.random() * canvas.width, Math.random() * canvas.height * 0.5, '#FFD93D');
      c++;
      setTimeout(burst, 200 + Math.random() * 200);
    })();

    fwInt = setInterval(() => {
      const canvas = fwC();
      if (canvas && fwP.length < 40) {
        mkFW(Math.random() * canvas.width, Math.random() * canvas.height * 0.5, color);
      }
    }, 1800);

    fwStopTimer = setTimeout(LV.stopConfetti, LV.FW_DURATION_MS);
  };

  LV.stopConfetti = function () {
    fwOn = false;
    if (fwInt) clearInterval(fwInt);
    if (fwStopTimer) clearTimeout(fwStopTimer);
    fwP = [];
    const ctx = getCtx();
    const c = fwC();
    if (ctx && c) ctx.clearRect(0, 0, c.width, c.height);
  };

  window.addEventListener('resize', LV.resizeConfetti);
})(window.LV);

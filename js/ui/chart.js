(function (LV) {
  LV.renderChart = function () {
    const container = document.getElementById('chart-bars');
    if (!container) return;

    const ranked = LV.getRanks();
    const rankByTeamId = {};
    ranked.forEach((t, idx) => { rankByTeamId[t.id] = idx; });
    const n = LV.TEAMS.length;
    const cW = container.offsetWidth || 600;
    const cH = container.offsetHeight || 320;
    const leftGutter = 12;
    const rightPad = 10;
    const topPad = 20;
    const bottomReserve = 52;
    const gap = 8;
    const slotW = Math.floor((cW - leftGutter - rightPad - gap * (n - 1)) / n);
    const usableH = cH - topPad - bottomReserve - 36;
    const maxV = Math.max(...LV.TEAMS.map(t => LV.votes[t.id] || 0), 1);
    const cMax = maxV * 1.15;

    const grid = document.getElementById('chart-grid');
    grid.innerHTML = '';
    [0.25, 0.5, 0.75].forEach(f => {
      const gl = document.createElement('div');
      gl.className = 'g-line';
      gl.style.bottom = (f * usableH) + 'px';
      grid.appendChild(gl);
    });

    LV.TEAMS.forEach((t, posIdx) => {
      const val = LV.votes[t.id] || 0;
      const rankIdx = rankByTeamId[t.id];
      const bH = Math.max((val / cMax) * usableH, val > 0 ? 10 : 4);
      const isChamp = rankIdx === 0 && val > 0;
      const leftX = leftGutter + posIdx * (slotW + gap);
      const ownerEmail = LV.getTeamOwnerEmail(t.id);

      let slot = document.getElementById('barslot-' + t.id);
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'bar-slot';
        slot.id = 'barslot-' + t.id;
        slot.innerHTML =
          '<div class="rank-medal" id="bmedal-' + t.id + '"></div>' +
          '<div class="bar-val" id="bval-' + t.id + '"></div>' +
          '<div class="bar-fill-wrap"><div class="bar-fill" id="bfill-' + t.id + '"></div></div>' +
          '<div class="bar-lbl" id="blbl-' + t.id + '">' +
            '<span class="bar-emoji"></span><span class="bar-name"></span><span class="bar-email"></span>' +
          '</div>';
        container.appendChild(slot);
      }

      slot.style.left = leftX + 'px';
      slot.style.width = slotW + 'px';
      slot.classList.toggle('is-champ', isChamp);

      const fill = document.getElementById('bfill-' + t.id);
      if (fill) {
        fill.style.height = bH + 'px';
        fill.style.background = 'linear-gradient(180deg, ' + t.color + ', ' + t.color + '99)';
        fill.style.boxShadow = '0 4px 0 ' + t.color + '66';
        fill.className = 'bar-fill' + (isChamp ? ' champ-bar' : '');
        if (fill.parentElement) fill.parentElement.style.height = bH + 'px';
      }

      const valEl = document.getElementById('bval-' + t.id);
      if (valEl) {
        valEl.textContent = val > 0 ? val.toLocaleString() : '0';
        valEl.style.color = t.color;
      }

      const medalEl = document.getElementById('bmedal-' + t.id);
      if (medalEl) medalEl.textContent = val > 0 ? LV.MEDALS[rankIdx] : '';

      const lbl = document.getElementById('blbl-' + t.id);
      if (lbl) {
        lbl.querySelector('.bar-emoji').textContent = t.emoji;
        lbl.querySelector('.bar-name').textContent = t.name;
        lbl.querySelector('.bar-name').style.color = t.color;
        lbl.querySelector('.bar-email').textContent = ownerEmail || '—';
      }

      let crown = slot.querySelector('.crown-badge');
      if (isChamp && !crown) {
        crown = document.createElement('div');
        crown.className = 'crown-badge';
        crown.textContent = '👑';
        slot.insertBefore(crown, slot.firstChild.nextSibling);
      } else if (!isChamp && crown) {
        crown.remove();
      }
    });
  };

  window.addEventListener('resize', () => {
    if (document.getElementById('main-app')?.style.display !== 'none') LV.renderChart();
  });
})(window.LV);

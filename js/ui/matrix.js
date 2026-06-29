(function (LV) {
  LV.updateMatrix = function () {
    const wrap = document.getElementById('matrix-wrap');
    const thead = document.getElementById('matrix-thead');
    const tbody = document.getElementById('matrix-body');
    if (!wrap || !LV.currentUser) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';

    thead.innerHTML = '<tr><th class="row-hdr">Voter</th>' +
      LV.TEAMS.map(t =>
        '<th><span class="th-pill" style="background:' + t.color + '22;color:' + t.color + '">' + t.emoji + ' ' + t.name + '</span></th>'
      ).join('') + '</tr>';

    const rows = LV.SLOT_KEYS.map(slotKey => {
      const info = LV.slotDisplayInfo(slotKey);
      const isTeam = slotKey.startsWith('team:');
      const email = LV.getSlotOwnerEmail(slotKey) || '—';
      const isRole = slotKey.startsWith('role:');
      const roleId = isRole ? slotKey.slice(5) : null;
      const fromTeam = isTeam
        ? LV.TEAMS.find(t => t.id === parseInt(slotKey.slice(5), 10))?.name
        : LV.ROLES.find(r => r.id === roleId)?.fromTeam;

      const scoresByTeam = {};
      LV.voteLog.filter(v => v.from === fromTeam).forEach(v => {
        const tid = LV.TEAMS.find(t => t.name === v.to)?.id;
        if (tid != null) scoresByTeam[tid] = v.pts;
      });

      let cells;
      if (isTeam) {
        const hasVoted = LV.TEAMS.some(t => scoresByTeam[t.id] != null);
        cells = hasVoted
          ? '<td class="tick-cell tick-span" colspan="4"><span class="tick-yes">✓</span></td>'
          : LV.TEAMS.map(() =>
            '<td class="tick-cell"><span class="tick-no">·</span></td>'
          ).join('');
      } else if (roleId === 'mentor') {
        cells = LV.TEAMS.map(t => {
          const scored = scoresByTeam[t.id] != null;
          return '<td class="tick-cell">' +
            (scored ? '<span class="tick-yes">✓</span>' : '<span class="tick-no">·</span>') +
            '</td>';
        }).join('');
      } else {
        cells = LV.TEAMS.map(t => {
          const pts = scoresByTeam[t.id];
          return '<td class="score-cell">' + (pts != null ? pts.toLocaleString() : '·') + '</td>';
        }).join('');
      }

      const rowClass = isRole ? (roleId === 'mentor' ? 'row-mentor' : 'row-pain') : '';
      const icon = isRole ? (roleId === 'mentor' ? '🎓' : '📌') : info.emoji;

      return '<tr class="' + rowClass + '"><td class="voter-cell">' +
        '<div class="voter-name">' + icon + ' ' + info.label + '</div>' +
        '<span class="voter-email">' + email + '</span></td>' + cells + '</tr>';
    }).join('');

    tbody.innerHTML = rows;

    const participants = new Set(LV.voteLog.map(v => v.email)).size;
    document.getElementById('matrix-sub').textContent =
      participants + ' voter(s) have submitted scores';
  };
})(window.LV);

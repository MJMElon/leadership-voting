(function (LV) {
  const CARTOON_EMOJIS = ['⭐', '🎈', '🎉', '✨', '🎊', '🌟', '🎁', '🏆'];

  function spawnCartoonElements(layer) {
    if (!layer) return;
    layer.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('span');
      el.className = 'winner-cartoon-item';
      el.textContent = CARTOON_EMOJIS[i % CARTOON_EMOJIS.length];
      el.style.left = (Math.random() * 100) + '%';
      el.style.animationDelay = (Math.random() * 4) + 's';
      el.style.animationDuration = (4 + Math.random() * 4) + 's';
      el.style.fontSize = (1.8 + Math.random() * 2.2) + 'rem';
      layer.appendChild(el);
    }
  }

  LV.openWinnerAnnouncement = async function () {
    if (!LV.isInteractive()) return;
    const top = LV.getRanks()[0];
    if (!top || LV.votes[top.id] === 0) return;

    const overlay = document.getElementById('winner-announcement');
    const teamEl = document.getElementById('winner-team-label');
    const announceBtn = document.getElementById('champ-announce-btn');
    if (!overlay || !teamEl) return;
    if (announceBtn) announceBtn.disabled = true;

    try {
      await LV.fadeOutVoteBgm(LV.VOTE_BGM_FADE_MS);

      const result = await LV.dbSetWinnerAnnounced(true);
      if (!result.ok) {
        LV.showToast('Failed to open winner announcement. Try again.', true);
        return;
      }

      teamEl.textContent = top.emoji + ' Team ' + top.id;
      spawnCartoonElements(document.getElementById('winner-cartoon-layer'));
      overlay.classList.add('show');
      LV.startChampionBgm();
      LV.launchConfetti(top.color);
      LV.renderVotingUI();
    } finally {
      if (announceBtn) announceBtn.disabled = false;
    }
  };

  LV.closeWinnerAnnouncement = async function () {
    const overlay = document.getElementById('winner-announcement');
    if (overlay) overlay.classList.remove('show');
    LV.stopChampionBgm();
    await LV.dbSetWinnerAnnounced(false);
    LV.renderVotingUI();
  };
})(window.LV);

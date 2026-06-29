(function (LV) {
  LV.updateChampAnnounceBtn = function () {
    const btn = document.getElementById('champ-announce-btn');
    const banner = document.getElementById('champ-banner');
    if (!btn || !banner) return;
    const show = LV.isInteractive() && banner.classList.contains('show');
    btn.hidden = !show;
  };

  LV.checkChampion = function () {
    const top = LV.getRanks()[0];
    const banner = document.getElementById('champ-banner');

    if (!top || LV.votes[top.id] === 0) {
      banner.classList.remove('show');
      LV.setLastChampionId(null);
      LV.updateChampAnnounceBtn();
      return;
    }

    document.getElementById('champ-name').textContent = top.emoji + ' ' + top.name;
    document.getElementById('champ-pts').textContent =
      'Total Points: ' + LV.votes[top.id].toLocaleString() + ' marks';
    banner.classList.add('show');

    if (top.id !== LV.lastChampionId) {
      LV.setLastChampionId(top.id);
      LV.launchConfetti(top.color);
    }

    LV.updateChampAnnounceBtn();
  };
})(window.LV);

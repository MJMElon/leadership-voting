(function (LV) {
  const CARTOON_EMOJIS = ['⭐', '🎈', '🎉', '✨', '🎊', '🌟', '🎁', '🏆'];

  let suspenseRaf = null;
  let captionRevealTimer = null;

  function cancelSuspenseAnimation() {
    if (suspenseRaf) {
      cancelAnimationFrame(suspenseRaf);
      suspenseRaf = null;
    }
    if (captionRevealTimer) {
      clearTimeout(captionRevealTimer);
      captionRevealTimer = null;
    }
  }

  function formatMarks(value) {
    return Math.round(value).toLocaleString();
  }

  function getLeaderboardMaxMark(targets) {
    const actualMax = Math.max(0, ...targets);
    return Math.max(1000, Math.ceil(actualMax / 1000) * 1000);
  }

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

  function resetWinnerPanels() {
    const suspense = document.getElementById('winner-suspense');
    const caption = document.getElementById('winner-caption');
    const chart = document.getElementById('winner-lb-chart');
    if (suspense) suspense.classList.add('is-hidden');
    if (caption) caption.classList.add('is-hidden');
    if (chart) chart.innerHTML = '';
  }

  function createSweepers(teams, maxScore) {
    return teams.map(team => {
      const phase = Math.random() * Math.PI * 2;
      const startMark = (maxScore / 2) + Math.sin(phase) * (maxScore / 2);
      return {
        team,
        target: LV.votes[team.id] || 0,
        phase,
        speed: 0.0035 + Math.random() * 0.0025,
        display: startMark,
      };
    });
  }

  function buildLeaderboard(chartEl, sweepers, maxScore) {
    chartEl.innerHTML = '';
    sweepers.forEach(s => {
      const pct = maxScore > 0 ? (s.display / maxScore) * 100 : 0;
      const col = document.createElement('div');
      col.className = 'winner-lb-col';
      col.dataset.teamId = String(s.team.id);
      col.innerHTML =
        '<div class="winner-lb-val" id="winner-lb-val-' + s.team.id + '">' + formatMarks(s.display) + '</div>' +
        '<div class="winner-lb-track">' +
          '<div class="winner-lb-fill" id="winner-lb-fill-' + s.team.id + '" style="background:' + s.team.color + ';height:' + Math.max(2, pct) + '%"></div>' +
        '</div>' +
        '<div class="winner-lb-label">' + s.team.emoji + '<br><span>Team ' + s.team.id + '</span></div>';
      chartEl.appendChild(col);
    });
  }

  function updateLeaderboardBar(teamId, score, maxScore) {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const fill = document.getElementById('winner-lb-fill-' + teamId);
    const val = document.getElementById('winner-lb-val-' + teamId);
    if (fill) fill.style.height = Math.max(2, pct) + '%';
    if (val) val.textContent = formatMarks(score);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function runSuspenseAnimation(sweepers, maxScore, winnerId, onComplete) {
    const duration = LV.WINNER_SUSPENSE_MS || 6500;
    const settleStart = 0.72;
    const start = performance.now();
    let lastNow = start;

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const dt = Math.min(now - lastNow, 48);
      lastNow = now;
      const speedFactor = Math.pow(1 - progress, 1.6);
      const drift = Math.min(progress / settleStart, 1);

      sweepers.forEach(s => {
        let score;

        if (progress < settleStart) {
          s.phase += s.speed * dt * (0.45 + speedFactor * 3.2);
          const amplitude = (maxScore / 2) * Math.pow(1 - progress / settleStart, 0.55);
          const center = (maxScore / 2) * (1 - drift) + s.target * drift;
          score = center + Math.sin(s.phase) * amplitude;
          score = Math.max(0, Math.min(maxScore, score));
          s.display = score;
        } else {
          const settleT = easeOutCubic((progress - settleStart) / (1 - settleStart));
          score = s.display + (s.target - s.display) * Math.min(settleT * 0.22 + 0.04, 1);
          s.display = score;
        }

        updateLeaderboardBar(s.team.id, score, maxScore);
      });

      if (progress < 1) {
        suspenseRaf = requestAnimationFrame(frame);
        return;
      }

      sweepers.forEach(s => {
        updateLeaderboardBar(s.team.id, s.target, maxScore);
        const col = document.querySelector('.winner-lb-col[data-team-id="' + s.team.id + '"]');
        if (col) {
          col.classList.add('is-settled');
          if (s.team.id === winnerId) col.classList.add('is-winner');
        }
      });

      suspenseRaf = null;
      captionRevealTimer = setTimeout(onComplete, LV.WINNER_CAPTION_REVEAL_MS || 900);
    }

    suspenseRaf = requestAnimationFrame(frame);
  }

  function revealWinnerCaption(top) {
    const suspense = document.getElementById('winner-suspense');
    const caption = document.getElementById('winner-caption');
    const teamEl = document.getElementById('winner-team-label');
    if (suspense) suspense.classList.add('is-hidden');
    if (caption) caption.classList.remove('is-hidden');
    if (teamEl) teamEl.textContent = top.emoji + ' Team ' + top.id;
    spawnCartoonElements(document.getElementById('winner-cartoon-layer'));
    LV.startChampionBgm();
    LV.launchConfetti(top.color);
  }

  LV.openWinnerAnnouncement = async function () {
    if (!LV.isInteractive()) return;
    const top = LV.getRanks()[0];
    if (!top || LV.votes[top.id] === 0) return;

    const overlay = document.getElementById('winner-announcement');
    const suspense = document.getElementById('winner-suspense');
    const caption = document.getElementById('winner-caption');
    const chart = document.getElementById('winner-lb-chart');
    if (!overlay || !suspense || !caption || !chart) return;

    cancelSuspenseAnimation();
    resetWinnerPanels();

    await LV.fadeOutVoteBgm(LV.VOTE_BGM_FADE_MS);

    const result = await LV.dbSetWinnerAnnounced(true);
    if (!result.ok) {
      LV.showToast('Failed to open winner announcement. Try again.', true);
      return;
    }

    const targets = LV.TEAMS.map(team => LV.votes[team.id] || 0);
    const maxScore = getLeaderboardMaxMark(targets);
    const sweepers = createSweepers(LV.TEAMS, maxScore);

    buildLeaderboard(chart, sweepers, maxScore);
    suspense.classList.remove('is-hidden');
    caption.classList.add('is-hidden');
    overlay.classList.add('show');
    LV.renderVotingUI();
    LV.playDrumRollSound();

    runSuspenseAnimation(sweepers, maxScore, top.id, function () {
      revealWinnerCaption(top);
    });
  };

  LV.closeWinnerAnnouncement = async function () {
    cancelSuspenseAnimation();
    resetWinnerPanels();

    const overlay = document.getElementById('winner-announcement');
    if (overlay) overlay.classList.remove('show');
    LV.stopDrumRollSound();
    LV.stopChampionBgm();
    await LV.dbSetWinnerAnnounced(false);
    LV.renderVotingUI();
  };
})(window.LV);

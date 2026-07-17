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

  function formatWinnerTeams(teams) {
    const labels = teams.map(team => team.emoji + ' Team ' + team.id);
    if (labels.length <= 1) return labels[0] || '';
    if (labels.length === 2) return labels.join(' & ');
    return labels.slice(0, -1).join(', ') + ' & ' + labels[labels.length - 1];
  }

  function getWinnerIds(winners) {
    return new Set(winners.map(team => team.id));
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
    const title = document.getElementById('winner-suspense-title');
    const stage = document.getElementById('winner-reveal-stage');
    if (suspense) suspense.classList.add('is-hidden');
    if (title) title.classList.remove('is-hidden');
    if (caption) {
      caption.classList.add('is-hidden');
      caption.classList.remove('is-overlay-reveal', 'is-at-top');
    }
    if (stage) {
      stage.classList.remove('is-revealing');
      stage.style.removeProperty('--winner-overlay-reveal-ms');
    }
    if (chart) chart.innerHTML = '';
    const teamEl = document.getElementById('winner-team-label');
    if (teamEl) teamEl.classList.remove('is-tie');
  }

  function createSweepers(teams, maxScore) {
    return teams.map(team => {
      const startMark = maxScore * (0.25 + Math.random() * 0.5);
      return {
        team,
        target: LV.votes[team.id] || 0,
        phaseA: Math.random() * Math.PI * 2,
        phaseB: Math.random() * Math.PI * 2,
        phaseC: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        speedA: 0.003 + Math.random() * 0.005,
        speedB: 0.004 + Math.random() * 0.006,
        speedC: 0.002 + Math.random() * 0.004,
        driftSpeed: 0.0008 + Math.random() * 0.0015,
        ampA: 0.18 + Math.random() * 0.22,
        ampB: 0.12 + Math.random() * 0.18,
        ampC: 0.08 + Math.random() * 0.14,
        centerRatio: 0.28 + Math.random() * 0.44,
        display: startMark,
        settleStart: null,
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

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function runSuspenseAnimation(sweepers, maxScore, winnerIds, onComplete) {
    const duration = LV.WINNER_SUSPENSE_MS || 6500;
    const chaosEnd = 0.8;
    const start = performance.now();
    let lastNow = start;

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const dt = Math.min(now - lastNow, 48);
      lastNow = now;

      sweepers.forEach(s => {
        let score;

        if (progress < chaosEnd) {
          const chaosProgress = progress / chaosEnd;
          const speedMul = 0.55 + (1 - chaosProgress) * 2.4;

          s.phaseA += s.speedA * dt * speedMul;
          s.phaseB += s.speedB * dt * speedMul * 1.3;
          s.phaseC += s.speedC * dt * speedMul * 0.85;
          s.driftPhase += s.driftSpeed * dt;

          const center = maxScore * (
            s.centerRatio +
            Math.sin(s.driftPhase) * 0.14 +
            Math.sin(chaosProgress * Math.PI * 2.3 + s.phaseA) * 0.08
          );

          const wave =
            Math.sin(s.phaseA) * maxScore * s.ampA +
            Math.sin(s.phaseB * 1.41 + 1.2) * maxScore * s.ampB +
            Math.sin(s.phaseC * 0.67) * maxScore * s.ampC;

          score = center + wave;
          score = Math.max(maxScore * 0.04, Math.min(maxScore * 0.99, score));
          s.display = score;
        } else {
          if (s.settleStart == null) s.settleStart = s.display;
          const settleT = easeOutQuart((progress - chaosEnd) / (1 - chaosEnd));
          score = s.settleStart + (s.target - s.settleStart) * settleT;
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
          if (winnerIds.has(s.team.id)) col.classList.add('is-winner');
        }
      });

      suspenseRaf = null;
      captionRevealTimer = setTimeout(onComplete, LV.WINNER_CAPTION_REVEAL_MS || 900);
    }

    suspenseRaf = requestAnimationFrame(frame);
  }

  function revealWinnerCaption(winners) {
    const title = document.getElementById('winner-suspense-title');
    const caption = document.getElementById('winner-caption');
    const stage = document.getElementById('winner-reveal-stage');
    const teamEl = document.getElementById('winner-team-label');
    const revealMs = LV.WINNER_OVERLAY_REVEAL_MS || 5000;

    if (title) title.classList.add('is-hidden');
    if (teamEl) {
      teamEl.textContent = formatWinnerTeams(winners);
      teamEl.classList.toggle('is-tie', winners.length > 1);
    }
    if (caption) {
      caption.classList.remove('is-hidden', 'is-at-top');
      void caption.offsetWidth;
      caption.classList.add('is-overlay-reveal');
    }
    if (stage) {
      stage.style.setProperty('--winner-overlay-reveal-ms', revealMs + 'ms');
      stage.classList.add('is-revealing');
    }

    spawnCartoonElements(document.getElementById('winner-cartoon-layer'));
    LV.startChampionBgm();
    winners.forEach((team, i) => {
      setTimeout(() => LV.launchConfetti(team.color), i * 350);
    });

    captionRevealTimer = setTimeout(function () {
      if (caption) {
        caption.classList.remove('is-overlay-reveal');
        caption.classList.add('is-at-top');
      }
      if (stage) stage.classList.remove('is-revealing');
      captionRevealTimer = null;
    }, revealMs);
  }

  LV.openWinnerAnnouncement = async function () {
    if (!LV.isInteractive()) return;
    const winners = LV.getWinners();
    if (!winners.length) return;

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

    runSuspenseAnimation(sweepers, maxScore, getWinnerIds(winners), function () {
      revealWinnerCaption(winners);
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

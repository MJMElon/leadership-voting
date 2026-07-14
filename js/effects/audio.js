(function (LV) {
  let audioCtx = null;
  let voteBgmEl = null;
  let championBgmEl = null;
  let voteBgmFadeId = null;

  const INTERACTIVE_BGM_KEYS = ['vote', 'champion'];
  const INTERACTIVE_ONE_SHOT_KEYS = ['doneVote', 'drumRoll'];

  const BGM_PATHS = {
    vote: 'sounds/vote_bgm.mp3',
    champion: 'sounds/champion.mp3',
  };

  const ONE_SHOT_PATHS = {
    doneVote: 'sounds/done_vote.mp3',
    drumRoll: 'sounds/drum_roll.mp3',
  };

  const bgmCache = {
    vote: { el: null, ready: false },
    champion: { el: null, ready: false },
  };

  const oneShotCache = {
    doneVote: { el: null, ready: false },
    drumRoll: { el: null, ready: false },
  };

  function getAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function stopEl(el) {
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    el.volume = 1;
  }

  function ensureBgmEl(key) {
    const track = bgmCache[key];
    if (!track.el) {
      track.el = new Audio(BGM_PATHS[key]);
      track.el.preload = 'auto';
      track.el.loop = true;
    }
    return track.el;
  }

  function preloadTrack(key) {
    const track = bgmCache[key];
    const el = ensureBgmEl(key);
    if (track.ready) return Promise.resolve();

    return new Promise(resolve => {
      const finish = () => {
        track.ready = true;
        el.pause();
        el.currentTime = 0;
        resolve();
      };
      if (el.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        finish();
        return;
      }
      el.addEventListener('canplaythrough', finish, { once: true });
      el.addEventListener('error', finish, { once: true });
      el.load();
    });
  }

  function ensureOneShotEl(key) {
    const track = oneShotCache[key];
    if (!track.el) {
      track.el = new Audio(ONE_SHOT_PATHS[key]);
      track.el.preload = 'auto';
      track.el.loop = false;
    }
    return track.el;
  }

  function preloadOneShot(key) {
    const track = oneShotCache[key];
    const el = ensureOneShotEl(key);
    if (track.ready) return Promise.resolve();

    return new Promise(resolve => {
      const finish = () => {
        track.ready = true;
        el.pause();
        el.currentTime = 0;
        resolve();
      };
      if (el.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        finish();
        return;
      }
      el.addEventListener('canplaythrough', finish, { once: true });
      el.addEventListener('error', finish, { once: true });
      el.load();
    });
  }

  function cancelVoteBgmFade() {
    if (voteBgmFadeId != null) {
      cancelAnimationFrame(voteBgmFadeId);
      voteBgmFadeId = null;
    }
  }

  LV.preloadInteractiveSounds = function () {
    return Promise.all([
      ...INTERACTIVE_BGM_KEYS.map(preloadTrack),
      ...INTERACTIVE_ONE_SHOT_KEYS.map(preloadOneShot),
    ]);
  };

  LV.preloadInteractiveBgm = LV.preloadInteractiveSounds;

  LV.releaseInteractiveBgm = function () {
    cancelVoteBgmFade();
    voteBgmEl = null;
    championBgmEl = null;
    stopEl(bgmCache.vote.el);
    stopEl(bgmCache.champion.el);
    stopEl(oneShotCache.doneVote.el);
    stopEl(oneShotCache.drumRoll.el);
    bgmCache.vote.el = null;
    bgmCache.vote.ready = false;
    bgmCache.champion.el = null;
    bgmCache.champion.ready = false;
    oneShotCache.doneVote.el = null;
    oneShotCache.doneVote.ready = false;
    oneShotCache.drumRoll.el = null;
    oneShotCache.drumRoll.ready = false;
  };

  LV.startVoteBgm = function () {
    LV.stopVoteBgm();
    voteBgmEl = ensureBgmEl('vote');
    voteBgmEl.volume = 1;
    voteBgmEl.currentTime = 0;
    voteBgmEl.play().catch(() => {});
  };

  LV.stopVoteBgm = function () {
    cancelVoteBgmFade();
    stopEl(voteBgmEl);
    voteBgmEl = null;
  };

  LV.fadeOutVoteBgm = function (durationMs) {
    durationMs = durationMs ?? LV.VOTE_BGM_FADE_MS ?? 1000;
    return new Promise(resolve => {
      if (!voteBgmEl) {
        resolve();
        return;
      }
      cancelVoteBgmFade();
      const el = voteBgmEl;
      const startVol = el.volume;
      const start = performance.now();

      function tick(now) {
        if (voteBgmEl !== el) {
          voteBgmFadeId = null;
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / durationMs);
        el.volume = Math.max(0, startVol * (1 - t));
        if (t < 1) {
          voteBgmFadeId = requestAnimationFrame(tick);
          return;
        }
        voteBgmFadeId = null;
        stopEl(el);
        if (voteBgmEl === el) voteBgmEl = null;
        resolve();
      }

      voteBgmFadeId = requestAnimationFrame(tick);
    });
  };

  LV.startChampionBgm = function () {
    LV.stopChampionBgm();
    championBgmEl = ensureBgmEl('champion');
    championBgmEl.volume = 1;
    championBgmEl.currentTime = 0;
    championBgmEl.play().catch(() => {});
  };

  LV.stopChampionBgm = function () {
    stopEl(championBgmEl);
    championBgmEl = null;
  };

  LV.stopAllBgm = function () {
    LV.stopVoteBgm();
    LV.stopChampionBgm();
  };

  function playOneShot(key) {
    const el = ensureOneShotEl(key);
    el.pause();
    el.currentTime = 0;
    el.volume = 1;
    el.play().catch(() => {});
  }

  LV.playDoneVoteSound = function () {
    LV.stopVoteBgm();
    playOneShot('doneVote');
  };

  LV.stopDoneVoteSound = function () {
    stopEl(oneShotCache.doneVote.el);
  };

  LV.playDrumRollSound = function () {
    playOneShot('drumRoll');
  };

  LV.stopDrumRollSound = function () {
    stopEl(oneShotCache.drumRoll.el);
  };

  LV.playWhoosh = function () {
    const ctx = getAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  };

  LV.playCoin = function () {
    const ctx = getAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [
      { f: 880, t: 0, d: 0.08 },
      { f: 1175, t: 0.06, d: 0.18 },
    ].forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.2, now + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  };
})(window.LV);

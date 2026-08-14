(function (LV) {
  const FADE_MS = 400;
  let votingDoneTimer = null;
  let votingUiDone = false;
  let scaleRaf = null;
  let scaleObserver = null;
  let scaleBound = false;

  function panels() {
    return {
      display: document.getElementById('interactive-display'),
      ready: document.getElementById('interactive-ready'),
      voting: document.getElementById('interactive-voting'),
      mainApp: document.getElementById('main-app'),
      progressText: document.getElementById('voting-progress-text'),
      doneBtn: document.getElementById('voting-done-btn'),
      scaleHost: document.querySelector('.interactive-voting-scale-host'),
      scaleWrap: document.getElementById('interactive-voting-scale-wrap'),
      scaleInner: document.getElementById('interactive-voting-scale'),
    };
  }

  function isVotingScreenActive() {
    const { voting } = panels();
    return !!voting?.classList.contains('is-active');
  }

  function resetInteractiveVotingScale() {
    const { scaleWrap, scaleInner } = panels();
    if (scaleWrap) {
      scaleWrap.style.width = '';
      scaleWrap.style.height = '';
    }
    if (scaleInner) {
      scaleInner.style.transform = '';
      scaleInner.style.width = '';
    }
  }

  LV.fitInteractiveVotingScale = function () {
    const { voting, scaleHost, scaleWrap, scaleInner } = panels();
    if (!isVotingScreenActive() || !scaleHost || !scaleWrap || !scaleInner) {
      resetInteractiveVotingScale();
      return;
    }

    scaleWrap.style.width = '';
    scaleWrap.style.height = '';
    scaleInner.style.transform = 'none';
    scaleInner.style.width = '';

    const availW = scaleHost.clientWidth;
    const availH = scaleHost.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const naturalW = scaleInner.offsetWidth;
    const naturalH = scaleInner.offsetHeight;
    if (naturalW <= 0 || naturalH <= 0) return;

    const buffer = 12;
    const scale = Math.min(
      1,
      (availW - buffer) / naturalW,
      (availH - buffer) / naturalH
    );

    scaleInner.style.width = naturalW + 'px';
    scaleInner.style.transform = 'scale(' + scale + ')';
    scaleInner.style.transformOrigin = 'top left';
    scaleWrap.style.width = (naturalW * scale) + 'px';
    scaleWrap.style.height = (naturalH * scale) + 'px';
  };

  function scheduleFitInteractiveVotingScale() {
    if (!isVotingScreenActive()) return;
    if (scaleRaf) cancelAnimationFrame(scaleRaf);
    scaleRaf = requestAnimationFrame(function () {
      scaleRaf = requestAnimationFrame(function () {
        scaleRaf = null;
        LV.fitInteractiveVotingScale();
      });
    });
  }

  function bindInteractiveVotingScale() {
    if (scaleBound) return;
    const { scaleHost, voting, scaleInner } = panels();
    if (!scaleHost || !voting || !scaleInner) return;

    scaleBound = true;
    scaleObserver = new ResizeObserver(function () {
      scheduleFitInteractiveVotingScale();
    });
    scaleObserver.observe(scaleHost);
    scaleObserver.observe(voting);

    window.addEventListener('resize', scheduleFitInteractiveVotingScale);
    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleFitInteractiveVotingScale);
    }

    const qrImg = scaleInner.querySelector('.qr-image');
    if (qrImg && !qrImg.complete) {
      qrImg.addEventListener('load', scheduleFitInteractiveVotingScale, { once: true });
    }
  }

  function setInteractiveVotingActive(active) {
    document.body.classList.toggle('interactive-voting-active', !!active);
    if (active) {
      bindInteractiveVotingScale();
      scheduleFitInteractiveVotingScale();
      return;
    }
    document.body.classList.remove('interactive-voting-active');
    resetInteractiveVotingScale();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clearVotingDoneTimer() {
    if (votingDoneTimer != null) {
      clearTimeout(votingDoneTimer);
      votingDoneTimer = null;
    }
  }

  function setVotingStatus(mode) {
    const { progressText, doneBtn } = panels();

    if (mode === 'done') {
      if (progressText) {
        progressText.hidden = true;
        progressText.style.display = 'none';
      }
      if (doneBtn) {
        doneBtn.hidden = false;
        doneBtn.classList.add('is-visible');
      }
      votingUiDone = true;
      LV.playDoneVoteSound();
      scheduleFitInteractiveVotingScale();
      return;
    }

    const wasDone = votingUiDone;
    votingUiDone = false;

    if (progressText) {
      progressText.hidden = false;
      progressText.style.display = '';
      progressText.textContent = 'Voting in progress...';
    }
    if (doneBtn) {
      doneBtn.hidden = true;
      doneBtn.classList.remove('is-visible');
    }

    if (wasDone && LV.isInteractive() && LV.currentUser?.votingStarted) {
      LV.startVoteBgm();
    }

    scheduleFitInteractiveVotingScale();
  }

  function activateReady(ready) {
    if (!ready) return;
    ready.classList.add('is-active');
    ready.classList.remove('is-fading-out');
  }

  function deactivateReady(ready) {
    if (!ready) return;
    ready.classList.remove('is-active', 'is-fading-out');
  }

  function activateVoting(voting) {
    if (!voting) return;
    voting.removeAttribute('hidden');
    voting.classList.add('is-active');
    voting.classList.remove('is-fading-out');
    setInteractiveVotingActive(true);
  }

  function deactivateVoting(voting) {
    if (!voting) return;
    voting.classList.remove('is-active', 'is-fading-out');
    setInteractiveVotingActive(false);
  }

  LV.resetInteractiveVotingStatus = function () {
    clearVotingDoneTimer();
    votingUiDone = false;
    setVotingStatus('progress');
    LV.stopDoneVoteSound();
  };

  LV.updateInteractiveVotingStatus = function () {
    if (!LV.isInteractive() || !LV.currentUser?.votingStarted) return;

    const { doneBtn } = panels();
    if (!doneBtn) return;

    if (!LV.isVotingComplete()) {
      clearVotingDoneTimer();
      setVotingStatus('progress');
      return;
    }

    if (votingUiDone || votingDoneTimer != null) return;

    votingDoneTimer = setTimeout(() => {
      votingDoneTimer = null;
      if (!LV.isInteractive() || !LV.currentUser?.votingStarted) return;
      if (!LV.isVotingComplete()) {
        setVotingStatus('progress');
        return;
      }
      setVotingStatus('done');
    }, LV.INTERACTIVE_VOTING_DONE_MS);
  };

  LV.setInteractiveMode = function (enabled) {
    const { mainApp, display, ready, voting } = panels();
    if (!mainApp) return;

    mainApp.classList.toggle('interactive-mode', !!enabled);
    if (display) {
      display.classList.toggle('is-visible', !!enabled);
      display.toggleAttribute('hidden', !enabled);
    }

    if (!enabled) {
      deactivateReady(ready);
      deactivateVoting(voting);
      setInteractiveVotingActive(false);
    }
  };

  LV.showInteractiveReady = function () {
    const { ready, voting } = panels();
    if (!ready || !voting) return;

    activateReady(ready);
    deactivateVoting(voting);
    LV.resetInteractiveVotingStatus();
  };

  LV.showInteractiveVoting = function (animate) {
    const { ready, voting } = panels();
    if (!ready || !voting) return Promise.resolve();

    if (!votingUiDone) {
      clearVotingDoneTimer();
      setVotingStatus('progress');
    }

    if (!animate) {
      deactivateReady(ready);
      activateVoting(voting);
      LV.updateInteractiveVotingStatus();
      return Promise.resolve();
    }

    ready.classList.add('is-fading-out');
    ready.classList.remove('is-active');

    return wait(FADE_MS).then(() => {
      deactivateReady(ready);
      activateVoting(voting);
      LV.updateInteractiveVotingStatus();
      scheduleFitInteractiveVotingScale();
    });
  };

  LV.renderInteractiveDisplay = function () {
    if (!LV.isInteractive()) {
      LV.setInteractiveMode(false);
      LV.resetInteractiveVotingStatus();
      return;
    }

    LV.setInteractiveMode(true);

    if (LV.currentUser?.votingStarted) {
      LV.showInteractiveVoting(false);
      if (!votingUiDone) LV.startVoteBgm();
      LV.updateInteractiveVotingStatus();
    } else {
      LV.showInteractiveReady();
    }
  };

  LV.startInteractiveVoting = async function () {
    if (!LV.isInteractive() || LV.currentUser?.votingStarted) return;

    LV.currentUser.votingStarted = true;
    LV.saveSession(LV.currentUser);

    await LV.showInteractiveVoting(true);
    LV.startVoteBgm();
    LV.updateInteractiveVotingStatus();
  };
})(window.LV);

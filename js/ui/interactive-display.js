(function (LV) {
  const FADE_MS = 400;
  let votingDoneTimer = null;
  let votingUiDone = false;

  function panels() {
    return {
      display: document.getElementById('interactive-display'),
      ready: document.getElementById('interactive-ready'),
      voting: document.getElementById('interactive-voting'),
      mainApp: document.getElementById('main-app'),
      progressText: document.getElementById('voting-progress-text'),
      doneBtn: document.getElementById('voting-done-btn'),
    };
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
  }

  function deactivateVoting(voting) {
    if (!voting) return;
    voting.classList.remove('is-active', 'is-fading-out');
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
    if (display) display.classList.toggle('is-visible', !!enabled);

    if (!enabled) {
      deactivateReady(ready);
      deactivateVoting(voting);
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

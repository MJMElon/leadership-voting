(function (LV) {
  function rerenderRemote() {
    if (!LV.currentUser) return;
    LV.updateInteractiveVotingStatus();
    LV.refreshAssignmentModal();
    if (!LV.isUserEditing()) {
      LV.renderVotingUI();
    }
  }

  LV.setRemoteUpdateHandler(rerenderRemote);

  window.proceedEmail = function () { LV.proceedEmail(); };
  window.startInteractiveVoting = function () { LV.startInteractiveVoting(); };
  window.logout = function () { LV.logout(); };
  window.closeConfirmDialog = function () { LV.closeConfirmDialog(); };
  window.confirmVote = function () { LV.confirmVote(); };
  window.closeAssignmentModal = function () { LV.closeAssignmentModal(); };
  window.openWinnerAnnouncement = function () { LV.openWinnerAnnouncement(); };
  window.closeWinnerAnnouncement = function () { LV.closeWinnerAnnouncement(); };

  LV.resizeConfetti();
  LV.initSupabase().then(function () {
    LV.subscribeRealtime();
    return LV.tryRestoreSession();
  }).then(function (restored) {
    if (!restored) {
      document.getElementById('auth-screen').style.display = 'flex';
    }
  });
})(window.LV);

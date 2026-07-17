(function (LV) {
  LV.currentUser = null;
  LV.dbClient = null;
  LV.votes = {};
  LV.voteLog = [];
  LV.takenSlots = {};
  LV.roleScoreDrafts = {};
  LV.ourVoteIds = new Set();
  LV.myTeamVote = null;
  LV.myRoleScores = {};
  LV.lastInputAt = 0;
  LV.confirmDialogOpen = false;
  LV.winnerAnnounced = false;

  LV.setWinnerAnnounced = function (open) { LV.winnerAnnounced = !!open; };
  LV.isVotingLocked = function () { return LV.winnerAnnounced; };

  if (Array.isArray(LV.TEAMS)) {
    LV.TEAMS.forEach(t => { LV.votes[t.id] = 0; });
  }

  LV.setCurrentUser = function (user) { LV.currentUser = user; };
  LV.setDbClient = function (client) { LV.dbClient = client; };

  LV.resetUserVoteState = function () {
    LV.myTeamVote = null;
    LV.myRoleScores = {};
    Object.keys(LV.roleScoreDrafts).forEach(k => delete LV.roleScoreDrafts[k]);
  };

  LV.bumpInputTime = function () { LV.lastInputAt = Date.now(); };
  LV.setConfirmDialogOpen = function (open) { LV.confirmDialogOpen = open; };
  LV.setMyTeamVote = function (v) { LV.myTeamVote = v; };
  LV.setMyRoleScore = function (teamId, pts) { LV.myRoleScores[teamId] = pts; };
  LV.clearMyRoleScore = function (teamId) { delete LV.myRoleScores[teamId]; };

  LV.clearTakenSlots = function () {
    Object.keys(LV.takenSlots).forEach(k => delete LV.takenSlots[k]);
  };

  LV.resetVotes = function () {
    if (Array.isArray(LV.TEAMS)) {
      LV.TEAMS.forEach(t => { LV.votes[t.id] = 0; });
    }
    LV.voteLog.length = 0;
  };
})(window.LV);

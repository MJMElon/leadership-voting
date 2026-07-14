(function (LV) {
  let pollTimer = null;
  let onRemoteUpdate = null;

  LV.setRemoteUpdateHandler = function (fn) { onRemoteUpdate = fn; };

  function rerenderRemote() {
    if (onRemoteUpdate) onRemoteUpdate();
  }

  LV.isUserEditing = function () {
    if (LV.confirmDialogOpen) return true;
    if (Date.now() - LV.lastInputAt < 3000) return true;
    const el = document.activeElement;
    if (el?.classList?.contains('role-score-inp') || el?.classList?.contains('email-inp')) return true;
    for (const k in LV.roleScoreDrafts) {
      if (LV.roleScoreDrafts[k] !== undefined && LV.roleScoreDrafts[k] !== '') return true;
    }
    return false;
  };

  LV.subscribeRealtime = function () {
    if (!LV.dbClient) return;

    LV.dbClient.channel('votes-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, payload => {
        const v = payload.new;
        if (LV.ourVoteIds.has(v.id)) return;

        const dupe = LV.voteLog.some(l =>
          l.email === v.voter_email && l.pts === v.points &&
          LV.TEAMS.find(t => t.name === l.to)?.id === v.to_team_id
        );
        if (dupe) { LV.ourVoteIds.add(v.id); return; }

        LV.votes[v.to_team_id] = (LV.votes[v.to_team_id] || 0) + v.points;
        const tName = LV.TEAMS.find(t => t.id === v.to_team_id)?.name || '';
        LV.voteLog.unshift({
          id: v.id, voter: v.voter_name, email: v.voter_email,
          from: v.from_team, to: tName, pts: v.points,
          time: new Date(v.created_at).toLocaleTimeString(),
        });
        rerenderRemote();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, payload => {
        const v = payload.old;
        if (!v || v.id == null) return;
        const idx = LV.voteLog.findIndex(l => l.id === v.id);
        if (idx === -1) return;
        const entry = LV.voteLog[idx];
        const target = LV.TEAMS.find(t => t.name === entry.to);
        if (target) LV.votes[target.id] = Math.max(0, (LV.votes[target.id] || 0) - entry.pts);
        LV.voteLog.splice(idx, 1);
        rerenderRemote();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, payload => {
        const row = payload.new || payload.old;
        if (row && row.id === 1) {
          LV.setWinnerAnnounced(!!row.winner_announced);
          rerenderRemote();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' }, payload => {
        const newEmail = payload.new.email;
        LV.takenSlots[payload.new.slot_key] = newEmail;
        if (LV.currentUser && newEmail !== LV.currentUser.email) {
          const info = LV.slotDisplayInfo(payload.new.slot_key);
          LV.showToast(newEmail + ' claimed ' + info.emoji + ' ' + info.label);
        }
        rerenderRemote();
      })
      .subscribe((status, err) => {
        console.log('[Realtime]', status, err || '');
      });
  };

  function restoreMyVotesFromLog() {
    if (!LV.currentUser?.slot) return;

    if (LV.currentUser.slot.type === 'team') {
      const myVotes = LV.voteLog.filter(v => v.email === LV.currentUser.email);
      if (myVotes.length) {
        const v = myVotes[0];
        const target = LV.TEAMS.find(t => t.name === v.to);
        if (target) LV.setMyTeamVote({ teamId: target.id, confirmed: true });
      }
      return;
    }

    if (LV.currentUser.slot.roleId === 'mentor') {
      LV.myRoleScores = {};
      LV.voteLog.filter(v => v.email === LV.currentUser.email && v.from === 'Mentor').forEach(v => {
        const tid = LV.TEAMS.find(t => t.name === v.to)?.id;
        if (tid != null) LV.setMyRoleScore(tid, v.pts);
      });
      const ppVote = LV.voteLog.find(v => v.email === LV.currentUser.email && v.from === 'Pain Point Marks');
      if (ppVote) {
        const target = LV.TEAMS.find(t => t.name === ppVote.to);
        LV.setMyPainPointVote(target ? { teamId: target.id, confirmed: true } : null);
      } else {
        LV.setMyPainPointVote(null);
      }
    }
  }

  LV.startPolling = function () {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!LV.dbClient || !LV.currentUser) return;
      if (LV.isUserEditing()) return;
      try {
        await LV.loadFromSupabase();
        restoreMyVotesFromLog();
        rerenderRemote();
      } catch (e) { /* swallow */ }
    }, LV.POLL_MS);
  };

  LV.stopPolling = function () {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  };

  ['input', 'keydown', 'pointerdown', 'focusin'].forEach(ev => {
    addEventListener(ev, e => {
      if (e.target?.classList?.contains('role-score-inp') ||
          e.target?.classList?.contains('email-inp')) {
        LV.bumpInputTime();
      }
    }, true);
  });

  addEventListener('input', e => {
    const t = e.target;
    if (t?.classList?.contains('role-score-inp') && t.dataset.teamId) {
      LV.roleScoreDrafts[t.dataset.teamId] = t.value;
      LV.bumpInputTime();
    }
  }, true);
})(window.LV);

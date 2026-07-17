(function (LV) {
  let pendingVoteTeamId = null;

  const MENTOR_FROM = 'Mentor';

  function hideVotingSections(section, roleSection) {
    if (section) section.style.display = 'none';
    if (roleSection) roleSection.style.display = 'none';
  }

  function votingLocked() {
    return typeof LV.isVotingLocked === 'function' && LV.isVotingLocked();
  }

  function refreshAfterVote() {
    LV.renderVotingUI();
  }

  LV.renderVotingUI = function () {
    const section = document.getElementById('vote-section');
    const grid = document.getElementById('vote-grid');
    const roleSection = document.getElementById('role-score-section');
    if (!section || !grid || !roleSection) return;

    if (!LV.currentUser || LV.isReadOnly() || !LV.currentUser.slot || !LV.TEAMS?.length) {
      hideVotingSections(section, roleSection);
      return;
    }

    if (LV.currentUser.slot.type === 'team') {
      section.style.display = 'block';
      roleSection.style.display = 'none';
      renderTeamVoteCards(grid, { lockOwnTeam: true });
    } else if (LV.currentUser.slot.roleId === 'mentor') {
      section.style.display = 'none';
      roleSection.style.display = 'block';
      renderMentorPanel();
    } else {
      hideVotingSections(section, roleSection);
    }
  };

  function renderTeamVoteCards(grid, opts) {
    opts = opts || {};
    const myTeamId = opts.myTeamId ?? (LV.currentUser.slot.teamId ?? LV.currentUser.slot.team?.id);
    const hasVoted = opts.hasVoted ?? LV.myTeamVote?.confirmed;
    const votedTeamId = opts.votedTeamId ?? LV.myTeamVote?.teamId;
    const locked = votingLocked();
    const pts = opts.points ?? LV.TEAM_VOTE_PTS;
    const instructionEl = opts.instructionEl || document.getElementById('vote-instruction');
    const undoWrapId = opts.undoWrapId || 'vote-undo-wrap';
    const onTap = opts.onTap || ((t) => openConfirmDialog(t));
    const onUndo = opts.onUndo || undoTeamVote;
    const voteLabel = opts.voteLabel || 'Voted';

    if (instructionEl) {
      if (locked) {
        instructionEl.textContent = hasVoted
          ? '✓ ' + voteLabel + ' — ' + pts.toLocaleString() + ' marks to ' +
            (LV.TEAMS.find(t => t.id === votedTeamId)?.name || 'a team') +
            '. Voting is locked while the winner announcement is displayed.'
          : 'Voting is locked while the winner announcement is displayed.';
      } else if (hasVoted) {
        instructionEl.textContent =
          '✓ ' + voteLabel + ' — ' + pts.toLocaleString() + ' marks to ' +
          (LV.TEAMS.find(t => t.id === votedTeamId)?.name || 'a team') +
          '. Tap Undo to change your vote.';
      } else {
        instructionEl.textContent = opts.emptyInstruction ||
          'Tap the team you think is best — you have one vote worth 1,000 marks.';
      }
    }

    grid.innerHTML = '';

    LV.TEAMS.forEach(t => {
      const isOwn = opts.lockOwnTeam && t.id === myTeamId;
      const isVoted = hasVoted && votedTeamId === t.id;
      const isLocked = isOwn || (hasVoted && !isVoted) || locked;

      const card = document.createElement('div');
      card.className = 'vote-card' +
        (isOwn ? ' is-own' : '') +
        (isLocked ? ' is-locked' : '') +
        (isVoted ? ' is-voted' : '');

      card.innerHTML =
        '<div class="vc-accent" style="background:' + t.color + '"></div>' +
        '<div class="vc-body">' +
          '<span class="vc-emoji">' + t.emoji + '</span>' +
          '<span class="vc-name">' + t.name + '</span>' +
          (isOwn ? '<span class="vc-badge">Your team</span>' : '') +
          (isVoted ? '<span class="vc-badge voted">✓ Voted</span>' : '') +
          (!isOwn && isLocked && !isVoted ? '<span class="vc-badge locked">Locked</span>' : '') +
        '</div>';

      if (!isOwn && !hasVoted && !locked) {
        card.onclick = () => onTap(t);
      }
      grid.appendChild(card);
    });

    const parent = grid.parentElement;
    let undoWrap = document.getElementById(undoWrapId);
    if (hasVoted && !locked) {
      if (!undoWrap) {
        undoWrap = document.createElement('div');
        undoWrap.id = undoWrapId;
        undoWrap.className = 'vote-undo-wrap';
        parent.appendChild(undoWrap);
      }
      undoWrap.innerHTML =
        '<button type="button" class="btn-undo-score" id="' + undoWrapId + '-btn">Undo Vote</button>';
      undoWrap.querySelector('button').onclick = onUndo;
      undoWrap.style.display = 'block';
    } else if (undoWrap) {
      undoWrap.style.display = 'none';
    }
  }

  function openConfirmDialog(team) {
    if (votingLocked()) {
      LV.showToast('Voting is locked while the winner announcement is displayed.', true);
      return;
    }
    pendingVoteTeamId = team.id;
    LV.setConfirmDialogOpen(true);

    document.getElementById('confirm-modal-title').textContent = '🗳️ Confirm Your Vote';
    document.getElementById('confirm-modal-message').innerHTML =
      'Cast your vote (<span id="confirm-points-label">' + LV.TEAM_VOTE_PTS.toLocaleString() + '</span> marks) to:';
    document.getElementById('confirm-team-label').textContent = team.emoji + ' ' + team.name;
    document.getElementById('vote-confirm-modal').classList.add('open');
  }

  LV.closeConfirmDialog = function () {
    LV.setConfirmDialogOpen(false);
    pendingVoteTeamId = null;
    document.getElementById('vote-confirm-modal').classList.remove('open');
  };

  async function undoTeamVote() {
    if (!LV.myTeamVote?.confirmed || votingLocked()) return;

    const votedTeamId = LV.myTeamVote.teamId;
    const fromTeam = LV.fromTeamForSlot(LV.currentUser.slot);

    const result = await LV.dbUndoTeamVote();
    if (!result.ok) {
      LV.showToast('Failed to undo vote. Try again.', true);
      return;
    }

    LV.setMyTeamVote(null);
    LV.votes[votedTeamId] = Math.max(0, (LV.votes[votedTeamId] || 0) - LV.TEAM_VOTE_PTS);
    removeVoteLogEntry(LV.currentUser.email, fromTeam);

    refreshAfterVote();
    LV.showToast('Vote cleared — tap a team to vote again');
  }

  function removeVoteLogEntry(email, fromTeam, toTeamName) {
    for (let i = LV.voteLog.length - 1; i >= 0; i--) {
      const entry = LV.voteLog[i];
      if (entry.email !== email || entry.from !== fromTeam) continue;
      if (toTeamName && entry.to !== toTeamName) continue;
      LV.voteLog.splice(i, 1);
      if (!toTeamName) break;
    }
  }

  LV.confirmVote = async function () {
    return LV.confirmTeamVote();
  };

  LV.confirmTeamVote = async function () {
    const teamId = pendingVoteTeamId;
    if (!teamId || LV.myTeamVote?.confirmed || votingLocked()) return;

    const myTeamId = LV.currentUser.slot.teamId ?? LV.currentUser.slot.team?.id;
    if (teamId === myTeamId) return;

    LV.closeConfirmDialog();

    const team = LV.TEAMS.find(t => t.id === teamId);
    const card = document.querySelector('#vote-grid .vote-card:not(.is-own):not(.is-locked)');

    const result = await LV.dbSaveTeamVote(teamId);
    if (!result.ok) {
      LV.showToast('Failed to save vote. Try again.', true);
      return;
    }
    if (result.id != null) LV.ourVoteIds.add(result.id);

    LV.setMyTeamVote({ teamId, confirmed: true });
    LV.votes[teamId] = (LV.votes[teamId] || 0) + LV.TEAM_VOTE_PTS;
    LV.voteLog.unshift({
      id: result.id, voter: LV.currentUser.name, email: LV.currentUser.email,
      from: LV.fromTeamForSlot(LV.currentUser.slot), to: team.name,
      pts: LV.TEAM_VOTE_PTS, time: new Date().toLocaleTimeString(),
    });

    LV.playWhoosh();
    const afterVote = () => {
      LV.playCoin();
      refreshAfterVote();
      LV.showToast(LV.TEAM_VOTE_PTS.toLocaleString() + ' marks → ' + team.name + '!');
    };

    if (card) {
      const rect = card.getBoundingClientRect();
      LV.animStarBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, team.color, afterVote);
    } else {
      afterVote();
    }
  };

  function renderMentorPanel() {
    renderRoleScoreInputs();
  }

  function renderRoleScoreInputs() {
    const fromTeam = MENTOR_FROM;
    const locked = votingLocked();

    document.getElementById('role-score-title').textContent = '🎓 Mentor Scoring';
    document.getElementById('role-score-hint').textContent = locked
      ? 'Scoring is locked while the winner announcement is displayed.'
      : 'Enter 0–8,000 marks per team and submit. Submitted rows lock — tap Undo to change a score.';

    const grid = document.getElementById('role-score-grid');
    grid.innerHTML = '';

    LV.TEAMS.forEach(t => {
      const saved = LV.myRoleScores[t.id];
      const isLocked = saved != null;
      const draft = LV.roleScoreDrafts[t.id];
      const canUndo = isLocked && !locked;
      const row = document.createElement('div');
      row.className = 'role-score-row' + (isLocked ? ' is-submitted' : '');
      row.innerHTML =
        '<div class="rs-accent" style="background:' + t.color + '"></div>' +
        '<div class="rs-team">' +
          '<span class="rs-emoji">' + t.emoji + '</span>' +
          '<span class="rs-name">' + t.name + '</span>' +
          (isLocked ? '<span class="rs-saved">Saved: ' + saved.toLocaleString() + '</span>' : '') +
        '</div>' +
        '<input type="number" class="role-score-inp' + (isLocked || locked ? ' is-locked' : '') + '" data-team-id="' + t.id + '"' +
          ' min="' + LV.MENTOR_MIN_PTS + '" max="' + LV.MENTOR_MAX_PTS + '"' +
          ' inputmode="numeric" placeholder="0" aria-label="Mentor score for ' + t.name + '"' +
          (isLocked || locked ? ' disabled' : '') +
          ' value="' + (isLocked ? saved : (draft ?? (saved != null ? saved : ''))) + '">' +
        (canUndo
          ? '<button type="button" class="btn-undo-score" data-team-id="' + t.id + '">Undo</button>'
          : (isLocked
            ? '<button type="button" class="btn-submit-score is-disabled" data-team-id="' + t.id + '" disabled>Submit</button>'
            : '<button type="button" class="btn-submit-score" data-team-id="' + t.id + '">Submit</button>'));

      grid.appendChild(row);
    });

    grid.querySelectorAll('.btn-submit-score:not(.is-disabled)').forEach(btn => {
      btn.onclick = () => submitRoleScore(parseInt(btn.dataset.teamId, 10), fromTeam);
    });

    grid.querySelectorAll('.btn-undo-score').forEach(btn => {
      btn.onclick = () => undoRoleScore(parseInt(btn.dataset.teamId, 10), fromTeam);
    });

    grid.querySelectorAll('.role-score-inp:not(.is-locked)').forEach(inp => {
      inp.addEventListener('input', () => {
        LV.roleScoreDrafts[inp.dataset.teamId] = inp.value;
        LV.bumpInputTime();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitRoleScore(parseInt(inp.dataset.teamId, 10), fromTeam);
        }
      });
    });
  }

  async function undoRoleScore(teamId, fromTeam) {
    if (votingLocked()) {
      LV.showToast('Scoring is locked while the winner announcement is displayed.', true);
      return;
    }
    const oldPts = LV.myRoleScores[teamId];
    if (oldPts == null) return;

    const team = LV.TEAMS.find(t => t.id === teamId);
    const result = await LV.dbUndoRoleScore(teamId, fromTeam);
    if (!result.ok) {
      LV.showToast('Failed to undo score. Try again.', true);
      return;
    }

    LV.clearMyRoleScore(teamId);
    delete LV.roleScoreDrafts[teamId];
    LV.votes[teamId] = Math.max(0, (LV.votes[teamId] || 0) - oldPts);
    const tName = team?.name || '';
    removeVoteLogEntry(LV.currentUser.email, fromTeam, tName);

    refreshAfterVote();
    LV.showToast('Score cleared for ' + tName + ' — re-enter to submit');
  }

  async function submitRoleScore(teamId, fromTeam, opts) {
    opts = opts || {};
    if (votingLocked()) {
      if (!opts.silent) {
        LV.showToast('Scoring is locked while the winner announcement is displayed.', true);
      }
      return;
    }
    if (LV.myRoleScores[teamId] != null) return;

    const inp = document.querySelector('.role-score-inp[data-team-id="' + teamId + '"]');
    if (!inp || inp.disabled) return;

    let pts = parseInt(inp.value, 10);
    if (isNaN(pts) || pts < 0) pts = 0;
    if (pts > LV.MENTOR_MAX_PTS) {
      pts = LV.MENTOR_MAX_PTS;
      inp.classList.add('input-error');
      if (!opts.silent) {
        LV.showToast('Mentor max is ' + LV.MENTOR_MAX_PTS.toLocaleString() + ' per team', true);
      }
      setTimeout(() => inp.classList.remove('input-error'), 2000);
    }

    LV.bumpInputTime();
    delete LV.roleScoreDrafts[teamId];

    const result = await LV.dbSaveRoleScore(teamId, pts, fromTeam);
    if (!result.ok) {
      LV.showToast('Failed to save score. Try again.', true);
      LV.renderVotingUI();
      return;
    }
    if (result.id != null) LV.ourVoteIds.add(result.id);

    LV.setMyRoleScore(teamId, pts);
    LV.votes[teamId] = (LV.votes[teamId] || 0) + pts;
    const tName = LV.TEAMS.find(t => t.id === teamId)?.name || '';
    LV.voteLog.unshift({
      id: result.id, voter: LV.currentUser.name, email: LV.currentUser.email,
      from: fromTeam, to: tName, pts,
      time: new Date().toLocaleTimeString(),
    });

    if (!opts.silent) LV.playCoin();
    if (!opts.skipRerender) refreshAfterVote();
    if (!opts.silent) LV.showToast(pts.toLocaleString() + ' marks → ' + tName);
  }
})(window.LV);

(function (LV) {
  let pendingVoteTeamId = null;

  function hideVotingSections(section, roleSection) {
    if (section) section.style.display = 'none';
    if (roleSection) roleSection.style.display = 'none';
  }

  function votingLocked() {
    return typeof LV.isVotingLocked === 'function' && LV.isVotingLocked();
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
      renderTeamVoteCards(grid);
    } else {
      section.style.display = 'none';
      roleSection.style.display = 'block';
      renderRoleScoreInputs();
    }
  };

  function renderTeamVoteCards(grid) {
    const slot = LV.currentUser.slot;
    const myTeamId = slot.teamId ?? slot.team?.id;
    const hasVoted = LV.myTeamVote?.confirmed;
    const votedTeamId = LV.myTeamVote?.teamId;
    const locked = votingLocked();

    const instruction = document.getElementById('vote-instruction');
    if (locked) {
      instruction.textContent = hasVoted
        ? '✓ Voted — ' + LV.TEAM_VOTE_PTS.toLocaleString() + ' marks to ' +
          (LV.TEAMS.find(t => t.id === votedTeamId)?.name || 'a team') +
          '. Voting is locked while the winner announcement is displayed.'
        : 'Voting is locked while the winner announcement is displayed.';
    } else if (hasVoted) {
      instruction.textContent =
        '✓ Voted — ' + LV.TEAM_VOTE_PTS.toLocaleString() + ' marks to ' +
        (LV.TEAMS.find(t => t.id === votedTeamId)?.name || 'a team') +
        '. Tap Undo to change your vote.';
    } else {
      instruction.textContent =
        'Tap the team you think is best — you have one vote worth 1,000 marks.';
    }

    grid.innerHTML = '';

    LV.TEAMS.forEach(t => {
      const isOwn = t.id === myTeamId;
      const isVoted = hasVoted && votedTeamId === t.id;
      const isLocked = hasVoted && !isVoted;

      const card = document.createElement('div');
      card.className = 'vote-card' +
        (isOwn ? ' is-own' : '') +
        (isLocked || locked ? ' is-locked' : '') +
        (isVoted ? ' is-voted' : '');

      card.innerHTML =
        '<div class="vc-accent" style="background:' + t.color + '"></div>' +
        '<div class="vc-body">' +
          '<span class="vc-emoji">' + t.emoji + '</span>' +
          '<span class="vc-name">' + t.name + '</span>' +
          (isOwn ? '<span class="vc-badge">Your team</span>' : '') +
          (isVoted ? '<span class="vc-badge voted">✓ Voted</span>' : '') +
          (isLocked ? '<span class="vc-badge locked">Locked</span>' : '') +
        '</div>';

      if (!isOwn && !hasVoted && !locked) {
        card.onclick = () => openConfirmDialog(t);
      }
      grid.appendChild(card);
    });

    let undoWrap = document.getElementById('vote-undo-wrap');
    if (hasVoted && !locked) {
      if (!undoWrap) {
        undoWrap = document.createElement('div');
        undoWrap.id = 'vote-undo-wrap';
        undoWrap.className = 'vote-undo-wrap';
        grid.parentElement.appendChild(undoWrap);
      }
      undoWrap.innerHTML =
        '<button type="button" class="btn-undo-score" id="vote-undo-btn">Undo Vote</button>';
      undoWrap.querySelector('#vote-undo-btn').onclick = undoTeamVote;
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
    document.getElementById('confirm-team-label').textContent = team.emoji + ' ' + team.name;
    document.getElementById('confirm-points-label').textContent = LV.TEAM_VOTE_PTS.toLocaleString();
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
    const team = LV.TEAMS.find(t => t.id === votedTeamId);
    const fromTeam = LV.fromTeamForSlot(LV.currentUser.slot);

    const result = await LV.dbUndoTeamVote();
    if (!result.ok) {
      LV.showToast('Failed to undo vote. Try again.', true);
      return;
    }

    LV.setMyTeamVote(null);
    LV.votes[votedTeamId] = Math.max(0, (LV.votes[votedTeamId] || 0) - LV.TEAM_VOTE_PTS);
    for (let i = LV.voteLog.length - 1; i >= 0; i--) {
      if (LV.voteLog[i].email === LV.currentUser.email && LV.voteLog[i].from === fromTeam) {
        LV.voteLog.splice(i, 1);
      }
    }

    LV.renderChart();
    LV.renderVotingUI();
    LV.updateMatrix();
    LV.checkChampion();
    LV.showToast('Vote cleared — tap a team to vote again');
  }

  LV.confirmTeamVote = async function () {
    const teamId = pendingVoteTeamId;
    if (!teamId || LV.myTeamVote?.confirmed || votingLocked()) return;
    LV.closeConfirmDialog();

    const team = LV.TEAMS.find(t => t.id === teamId);
    const card = document.querySelector('.vote-card:not(.is-own):not(.is-locked)');

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
      LV.renderChart();
      LV.renderVotingUI();
      LV.updateMatrix();
      LV.checkChampion();
      LV.showToast(LV.TEAM_VOTE_PTS.toLocaleString() + ' marks → ' + team.name + '!');
    };

    if (card) {
      const rect = card.getBoundingClientRect();
      LV.animStarBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, team.color, afterVote);
    } else {
      afterVote();
    }
  };

  function renderRoleScoreInputs() {
    const isMentor = LV.currentUser.slot.roleId === 'mentor';
    const min = isMentor ? LV.MENTOR_MIN_PTS : LV.PAIN_POINT_MIN_PTS;
    const max = isMentor ? LV.MENTOR_MAX_PTS : null;
    const fromTeam = LV.fromTeamForSlot(LV.currentUser.slot);
    const locked = votingLocked();

    document.getElementById('role-score-title').textContent =
      isMentor ? '🎓 Mentor Scoring' : '📌 Pain Point Marks';
    document.getElementById('role-score-hint').textContent = locked
      ? 'Scoring is locked while the winner announcement is displayed.'
      : isMentor
        ? 'Enter 0–3,000 marks per team and submit. Submitted rows lock — tap Undo to change a score.'
        : 'Enter marks per team (minimum 0, no maximum) and submit. Submitted rows lock — tap Undo to change a score.';

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
          ' min="' + min + '"' + (max != null ? ' max="' + max + '"' : '') +
          ' inputmode="numeric" placeholder="0" aria-label="Score for ' + t.name + '"' +
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
      btn.onclick = () => submitRoleScore(parseInt(btn.dataset.teamId, 10), isMentor, fromTeam);
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
          submitRoleScore(parseInt(inp.dataset.teamId, 10), isMentor, fromTeam);
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
    for (let i = LV.voteLog.length - 1; i >= 0; i--) {
      if (LV.voteLog[i].email === LV.currentUser.email &&
          LV.voteLog[i].to === tName &&
          LV.voteLog[i].from === fromTeam) {
        LV.voteLog.splice(i, 1);
      }
    }

    LV.renderChart();
    LV.renderVotingUI();
    LV.updateMatrix();
    LV.checkChampion();
    LV.showToast('Score cleared for ' + tName + ' — re-enter to submit');
  }

  async function submitRoleScore(teamId, isMentor, fromTeam, opts) {
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
    if (isMentor && pts > LV.MENTOR_MAX_PTS) {
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
    LV.renderChart();
    if (!opts.skipRerender) LV.renderVotingUI();
    LV.updateMatrix();
    LV.checkChampion();
    if (!opts.silent) LV.showToast(pts.toLocaleString() + ' marks → ' + tName);
  }
})(window.LV);

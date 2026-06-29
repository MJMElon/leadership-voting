(function (LV) {
  LV.isViewer = function () {
    return !!LV.currentUser?.isViewer;
  };

  LV.isInteractive = function () {
    return !!LV.currentUser?.isInteractive;
  };

  LV.isReadOnly = function () {
    return LV.isViewer() || LV.isInteractive();
  };

  function restoreMyVotes(user) {
    if (user.isViewer || user.isInteractive || !user.slot) return;
    const fromTeam = LV.fromTeamForSlot(user.slot);
    if (user.slot.type === 'team') {
      const myVote = LV.voteLog.find(v => v.email === user.email);
      if (myVote) {
        const target = LV.TEAMS.find(t => t.name === myVote.to);
        if (target) LV.setMyTeamVote({ teamId: target.id, confirmed: true });
      }
    } else {
      LV.voteLog.filter(v => v.email === user.email && v.from === fromTeam).forEach(v => {
        const tid = LV.TEAMS.find(t => t.name === v.to)?.id;
        if (tid != null) LV.setMyRoleScore(tid, v.pts);
      });
    }
  }

  LV.tryRestoreSession = async function () {
    const saved = LV.getSavedSession();
    if (!saved) return false;

    await LV.loadFromSupabase();

    if (saved.isViewer) {
      await LV.finishLogin({
        name: 'Viewer',
        email: '',
        avatar: '👁',
        isViewer: true,
        slot: null,
      });
      return true;
    }

    if (saved.isInteractive) {
      await LV.finishLogin({
        name: 'Interactive',
        email: LV.INTERACTIVE_EMAIL,
        avatar: '📺',
        isInteractive: true,
        slot: null,
      });
      return true;
    }

    const name = saved.name || LV.nameFromEmail(saved.email);
    const slot = LV.buildSlotFromKey(saved.slotKey);
    if (!slot) { LV.clearSession(); return false; }

    const owner = LV.getSlotOwnerEmail(saved.slotKey);
    if (owner && owner !== saved.email) {
      LV.clearSession();
      LV.showToast('Saved session no longer valid — please log in again.', true);
      return false;
    }

    if (!LV.takenSlots[saved.slotKey]) {
      const ok = await LV.dbLockSlot(saved.slotKey, saved.email, name);
      if (!ok) { LV.clearSession(); return false; }
    }

    await LV.finishLogin({ name, email: saved.email, avatar: name[0].toUpperCase(), slot });
    return true;
  };

  LV.proceedEmail = async function () {
    const inp = document.getElementById('email-inp');
    const raw = inp.value.trim().toLowerCase();

    if (raw === LV.INTERACTIVE_EMAIL) {
      await LV.loadFromSupabase();
      await LV.finishLogin({
        name: 'Interactive',
        email: LV.INTERACTIVE_EMAIL,
        avatar: '📺',
        isInteractive: true,
        slot: null,
      });
      return;
    }

    const email = raw;
    if (!email || !email.includes('@')) {
      inp.classList.add('input-error');
      LV.showToast('Enter a valid email address', true);
      setTimeout(() => inp.classList.remove('input-error'), 1600);
      return;
    }

    await LV.loadFromSupabase();

    const name = LV.nameFromEmail(email);
    const partial = { name, email, avatar: name[0].toUpperCase() };

    const activeSlotKey = LV.SLOT_KEYS.find(k => LV.takenSlots[k] === email);
    if (activeSlotKey) {
      partial.slot = LV.buildSlotFromKey(activeSlotKey);
      LV.showToast('Welcome back, ' + name + '!');
      return LV.finishLogin(partial);
    }

    LV.openAssignmentModal(partial);
  };

  LV.enterAsViewer = async function () {
    await LV.loadFromSupabase();
    LV.showToast('Entering as viewer.');
    await LV.finishLogin({
      name: 'Viewer',
      email: '',
      avatar: '👁',
      isViewer: true,
      slot: null,
    });
  };

  LV.finishLogin = async function (user) {
    LV.setCurrentUser(user);
    LV.resetUserVoteState();

    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';

    if (user.isViewer) {
      document.getElementById('u-avatar').textContent = '👁';
      document.getElementById('u-name').textContent = 'Viewer';
      document.getElementById('u-team').textContent = '👁️ Viewer';
    } else if (user.isInteractive) {
      document.getElementById('u-avatar').textContent = '📺';
      document.getElementById('u-name').textContent = 'Interactive';
      document.getElementById('u-team').textContent = '📺 Interactive';
    } else {
      document.getElementById('u-avatar').textContent = user.slot.type === 'team'
        ? user.avatar
        : (user.slot.roleId === 'mentor' ? '🎓' : '📌');
      document.getElementById('u-name').textContent = user.name;

      if (user.slot.type === 'team') {
        document.getElementById('u-team').textContent = user.slot.team.emoji + ' ' + user.slot.team.name;
      } else {
        document.getElementById('u-team').textContent = user.slot.label;
      }
    }

    await LV.loadFromSupabase();

    if (!user.isViewer && !user.isInteractive && user.slot) {
      LV.takenSlots[user.slot.key] = user.email;
      restoreMyVotes(user);
    }

    LV.renderChart();
    LV.renderVotingUI();
    LV.updateMatrix();
    LV.checkChampion();
    LV.saveSession(user);
    LV.startPolling();

    if (user.isInteractive) {
      await LV.preloadInteractiveBgm();
      LV.startVoteBgm();
      LV.updateChampAnnounceBtn();
    }
  };

  LV.logout = function () {
    LV.closeWinnerAnnouncement();
    if (LV.isInteractive()) {
      LV.releaseInteractiveBgm();
    } else {
      LV.stopAllBgm();
    }
    LV.clearSession();
    LV.stopPolling();
    LV.setCurrentUser(null);
    LV.resetUserVoteState();
    LV.stopConfetti();
    document.getElementById('champ-banner').classList.remove('show');
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('email-inp').value = '';
  };
})(window.LV);

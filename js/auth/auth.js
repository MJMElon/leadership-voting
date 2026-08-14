(function (LV) {
  LV.isInteractive = function () {
    return !!LV.currentUser?.isInteractive;
  };

  LV.isReadOnly = function () {
    return LV.isInteractive();
  };

  LV.isRoleUser = function (roleId) {
    return LV.currentUser?.slot?.roleId === roleId;
  };

  LV.isMentorUser = function () {
    return LV.isRoleUser('mentor');
  };

  LV.isPreviousUser = function () {
    return LV.isRoleUser('previous');
  };

  function restoreMyVotes(user) {
    if (user.isInteractive || !user.slot) return;

    if (user.slot.type === 'team') {
      const myVote = LV.voteLog.find(v => v.email === user.email);
      if (myVote) {
        const target = LV.TEAMS.find(t => t.name === myVote.to);
        if (target) LV.setMyTeamVote({ teamId: target.id, confirmed: true });
      }
      return;
    }

    if (user.slot.type === 'role') {
      const fromTeam = LV.fromTeamForSlot(user.slot);
      LV.voteLog.filter(v => v.email === user.email && v.from === fromTeam).forEach(v => {
        const tid = LV.TEAMS.find(t => t.name === v.to)?.id;
        if (tid != null) LV.setMyRoleScore(tid, v.pts);
      });
    }
  }

  async function ensureRoleSlot(role) {
    const slotKey = 'role:' + role.id;
    const email = role.keyword;
    const owner = LV.getSlotOwnerEmail(slotKey);
    if (owner && owner !== email) return false;
    if (LV.takenSlots[slotKey] === email) return true;
    return LV.dbLockRoleSlots([slotKey], email, role.name);
  }

  async function finishRoleLogin(role) {
    const ok = await ensureRoleSlot(role);
    if (!ok) {
      LV.showToast(role.name + ' slot already claimed by another user.', true);
      return false;
    }
    await LV.finishLogin({
      name: role.name,
      email: role.keyword,
      avatar: role.avatar,
      slot: LV.buildSlotFromKey('role:' + role.id),
    });
    return true;
  }

  LV.tryRestoreSession = async function () {
    const saved = LV.getSavedSession();
    if (!saved) return false;

    await LV.loadFromSupabase();

    if (saved.isInteractive) {
      await LV.finishLogin({
        name: 'Interactive',
        email: LV.INTERACTIVE_EMAIL,
        avatar: '📺',
        isInteractive: true,
        votingStarted: !!saved.votingStarted,
        slot: null,
      });
      return true;
    }

    const savedRole = LV.findRoleByKeyword(saved.email);
    if (savedRole) {
      return finishRoleLogin(savedRole);
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
        votingStarted: false,
        slot: null,
      });
      return;
    }

    const keywordRole = LV.findRoleByKeyword(raw);
    if (keywordRole) {
      await LV.loadFromSupabase();
      await finishRoleLogin(keywordRole);
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

  LV.finishLogin = async function (user) {
    LV.setCurrentUser(user);
    LV.resetUserVoteState();
    LV.setInteractiveMode(!!user.isInteractive);

    document.getElementById('auth-screen').style.display = 'none';
    const mainApp = document.getElementById('main-app');
    mainApp.style.display = user.isInteractive ? 'flex' : 'block';
    mainApp.classList.toggle('interactive-mode', !!user.isInteractive);

    if (user.isInteractive) {
      document.getElementById('u-avatar').textContent = '📺';
      document.getElementById('u-name').textContent = 'Interactive';
      document.getElementById('u-team').textContent = '📺 Interactive';
    } else {
      document.getElementById('u-avatar').textContent = user.slot.type === 'team'
        ? user.avatar
        : (user.slot.role?.avatar || user.avatar);
      document.getElementById('u-name').textContent = user.name;

      if (user.slot.type === 'team') {
        document.getElementById('u-team').textContent = user.slot.team.emoji + ' ' + user.slot.team.name;
      } else {
        document.getElementById('u-team').textContent =
          (user.slot.role?.avatar ? user.slot.role.avatar + ' ' : '') + user.slot.label;
      }
    }

    await LV.loadFromSupabase();

    if (!user.isInteractive && user.slot) {
      LV.takenSlots[user.slot.key] = user.email;
      restoreMyVotes(user);
    }

    LV.renderVotingUI();
    LV.saveSession(user);
    LV.startPolling();

    if (user.isInteractive) {
      await LV.preloadInteractiveSounds();
      LV.renderInteractiveDisplay();
      return;
    }
  };

  LV.logout = function () {
    LV.closeWinnerAnnouncement();
    if (LV.isInteractive()) {
      LV.releaseInteractiveBgm();
    } else {
      LV.stopAllBgm();
    }
    LV.setInteractiveMode(false);
    LV.resetInteractiveVotingStatus();
    LV.clearSession();
    LV.stopPolling();
    LV.setCurrentUser(null);
    LV.resetUserVoteState();
    LV.stopConfetti();
    const mainApp = document.getElementById('main-app');
    mainApp.classList.remove('interactive-mode');
    mainApp.style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('email-inp').value = '';
  };
})(window.LV);

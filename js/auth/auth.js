(function (LV) {
  LV.isInteractive = function () {
    return !!LV.currentUser?.isInteractive;
  };

  LV.isReadOnly = function () {
    return LV.isInteractive();
  };

  LV.isMentorUser = function () {
    return LV.currentUser?.slot?.roleId === 'mentor';
  };

  const PAIN_POINT_FROM = 'Pain Point Marks';
  const MENTOR_FROM = 'Mentor';

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

    if (user.slot.roleId === 'mentor') {
      LV.voteLog.filter(v => v.email === user.email && v.from === MENTOR_FROM).forEach(v => {
        const tid = LV.TEAMS.find(t => t.name === v.to)?.id;
        if (tid != null) LV.setMyRoleScore(tid, v.pts);
      });
      const ppVote = LV.voteLog.find(v => v.email === user.email && v.from === PAIN_POINT_FROM);
      if (ppVote) {
        const target = LV.TEAMS.find(t => t.name === ppVote.to);
        if (target) LV.setMyPainPointVote({ teamId: target.id, confirmed: true });
      }
    }
  }

  async function ensureMentorSlots(email, name) {
    const blocked = LV.MENTOR_SLOT_KEYS.some(k => {
      const owner = LV.getSlotOwnerEmail(k);
      return owner && owner !== email;
    });
    if (blocked) return false;

    const ownsBoth = LV.MENTOR_SLOT_KEYS.every(k => LV.takenSlots[k] === email);
    if (ownsBoth) return true;

    return LV.dbLockMentorSlots(email, name);
  }

  async function finishMentorLogin() {
    const email = LV.MENTOR_EMAIL;
    const name = 'Mentor';
    const ok = await ensureMentorSlots(email, name);
    if (!ok) {
      LV.showToast('Mentor slots already claimed by another user.', true);
      return false;
    }
    await LV.finishLogin({
      name,
      email,
      avatar: '🎓',
      slot: LV.buildSlotFromKey('role:mentor'),
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

    if (saved.email === LV.MENTOR_EMAIL) {
      return finishMentorLogin();
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

    if (raw === LV.MENTOR_EMAIL) {
      await LV.loadFromSupabase();
      await finishMentorLogin();
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
        : '🎓';
      document.getElementById('u-name').textContent = user.name;

      if (user.slot.type === 'team') {
        document.getElementById('u-team').textContent = user.slot.team.emoji + ' ' + user.slot.team.name;
      } else {
        document.getElementById('u-team').textContent = user.slot.label;
      }
    }

    await LV.loadFromSupabase();

    if (!user.isInteractive && user.slot) {
      LV.takenSlots[user.slot.key] = user.email;
      if (user.slot.roleId === 'mentor') {
        LV.MENTOR_SLOT_KEYS.forEach(k => { LV.takenSlots[k] = user.email; });
      }
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

    LV.setInteractiveMode(false);
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

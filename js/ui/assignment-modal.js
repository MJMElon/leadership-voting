(function (LV) {
  let pendingUser = null;

  LV.openAssignmentModal = function (partial) {
    pendingUser = partial;
    renderAssignmentGrid();
    document.getElementById('assignment-modal').classList.add('open');
  };

  function renderAssignmentGrid() {
    const teamGrid = document.getElementById('team-slot-grid');
    const roleGrid = document.getElementById('role-slot-grid');
    teamGrid.innerHTML = '';
    roleGrid.innerHTML = '';

    LV.SLOT_KEYS.forEach(slotKey => {
      const info = LV.slotDisplayInfo(slotKey);
      const isTeam = slotKey.startsWith('team:');
      const owner = LV.getSlotOwnerEmail(slotKey);
      const taken = !!owner && owner !== pendingUser?.email;
      const grid = isTeam ? teamGrid : roleGrid;

      const btn = document.createElement('button');
      btn.className = 'slot-btn' + (taken ? ' is-locked' : '');
      btn.disabled = taken;
      btn.innerHTML =
        '<span class="slot-btn-label">' + (info.emoji ? info.emoji + ' ' : '') + info.label + '</span>' +
        (taken ? '<span class="slot-btn-email">🔒 ' + owner + '</span>' : '');
      if (!taken) {
        btn.onclick = () => claimSlot(slotKey);
      } else {
        btn.onclick = () => {
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 400);
        };
      }
      grid.appendChild(btn);
    });
  }

  async function claimSlot(slotKey) {
    if (!pendingUser) return;
    const info = LV.slotDisplayInfo(slotKey);
    const ok = await LV.dbLockSlot(slotKey, pendingUser.email, pendingUser.name);
    if (!ok) {
      LV.showToast('Slot already claimed by another email.', true);
      await LV.loadFromSupabase();
      renderAssignmentGrid();
      return;
    }
    pendingUser.slot = LV.buildSlotFromKey(slotKey);
    document.getElementById('assignment-modal').classList.remove('open');
    LV.showToast(pendingUser.email + ' claimed ' + info.emoji + ' ' + info.label);
    await LV.finishLogin(pendingUser);
  }

  LV.closeAssignmentModal = function () {
    document.getElementById('assignment-modal').classList.remove('open');
  };

  LV.refreshAssignmentModal = function () {
    if (document.getElementById('assignment-modal').classList.contains('open')) {
      renderAssignmentGrid();
    }
  };
})(window.LV);

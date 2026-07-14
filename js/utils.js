(function (LV) {
  LV.nameFromEmail = function (email) {
    const raw = email.split('@')[0].replace(/[._+]/g, ' ');
    return raw.replace(/\b\w/g, c => c.toUpperCase());
  };

  LV.getSlotOwnerEmail = function (slotKey) {
    if (LV.takenSlots[slotKey]) return LV.takenSlots[slotKey];
    const parsed = LV.parseSlotKey(slotKey);
    if (!parsed) return null;
    const fromName = parsed.type === 'team' ? parsed.team.name : parsed.role.fromTeam;
    const entries = LV.voteLog.filter(v => v.from === fromName);
    if (entries.length) return entries[entries.length - 1].email;
    return null;
  };

  LV.getTeamOwnerEmail = function (teamId) {
    return LV.getSlotOwnerEmail('team:' + teamId);
  };

  LV.getRanks = function () {
    return [...LV.TEAMS].sort((a, b) => (LV.votes[b.id] || 0) - (LV.votes[a.id] || 0));
  };

  LV.isVotingComplete = function () {
    if (!Array.isArray(LV.TEAMS) || !LV.TEAMS.length) return false;

    const teamVotesDone = LV.TEAMS.every(team =>
      LV.voteLog.some(v => v.from === team.name)
    );

    const mentorScoredTeams = new Set(
      LV.voteLog
        .filter(v => v.from === 'Mentor')
        .map(v => LV.TEAMS.find(t => t.name === v.to)?.id)
        .filter(id => id != null)
    );
    const mentorDone = LV.TEAMS.every(t => mentorScoredTeams.has(t.id));

    const painPointDone = LV.voteLog.some(v => v.from === 'Pain Point Marks');

    return teamVotesDone && mentorDone && painPointDone;
  };

  LV.buildSlotFromKey = function (slotKey) {
    const parsed = LV.parseSlotKey(slotKey);
    if (!parsed) return null;
    return {
      key: slotKey,
      type: parsed.type,
      label: parsed.label,
      team: parsed.team || null,
      role: parsed.role || null,
      roleId: parsed.roleId || null,
      teamId: parsed.teamId || null,
    };
  };

  LV.fromTeamForSlot = function (slot) {
    if (slot.type === 'team') return slot.team.name;
    if (slot.type === 'role') return slot.role.fromTeam;
    return '';
  };
})(window.LV);

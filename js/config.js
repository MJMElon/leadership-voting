(function (LV) {
  LV.SUPABASE_URL = 'https://pptbzcncthcnqojiljqk.supabase.co';
  LV.SUPABASE_KEY = 'sb_publishable_v3WGxtpxNGVZFjr8q_qwPA_bEns0BTQ';
  LV.USE_SUPABASE = true;
  LV.TEAM_VOTE_PTS = 1000;
  LV.MENTOR_MIN_PTS = 0;
  LV.MENTOR_MAX_PTS = 8000;
  LV.PREVIOUS_MIN_PTS = 0;
  LV.PREVIOUS_MAX_PTS = 10000;
  LV.FW_DURATION_MS = 8000;
  LV.POLL_MS = 2000;
  LV.VOTE_BGM_FADE_MS = 1000;
  LV.INTERACTIVE_MAX_W = 3840;
  LV.INTERACTIVE_MAX_H = 2160;
  LV.INTERACTIVE_QR_IMAGE = 'images/vote-qr-code.png';
  LV.INTERACTIVE_VOTING_DONE_MS = 5000;
  LV.WINNER_SUSPENSE_MS = 7000;
  LV.WINNER_CAPTION_REVEAL_MS = 1800;
  LV.WINNER_OVERLAY_REVEAL_MS = 5000;
  LV.STORAGE_KEY = 'lv_session_v2';
  LV.INTERACTIVE_EMAIL = 'interactive';
  LV.MENTOR_EMAIL = 'mentor';
  LV.PREVIOUS_EMAIL = 'previous';

  LV.TEAM_SLOT_KEYS = ['team:1', 'team:2', 'team:3', 'team:4'];
  LV.MENTOR_SLOT_KEYS = ['role:mentor'];
  LV.PREVIOUS_SLOT_KEYS = ['role:previous'];

  LV.TEAMS = [
    { id: 1, name: 'Team 1', emoji: '🔥', color: '#f59e0b' },
    { id: 2, name: 'Team 2', emoji: '⚡', color: '#10b981' },
    { id: 3, name: 'Team 3', emoji: '🌊', color: '#6366f1' },
    { id: 4, name: 'Team 4', emoji: '🦁', color: '#ef4444' },
  ];

  LV.ROLES = [
    { id: 'mentor', name: 'Mentor', fromTeam: 'Mentor', avatar: '🎓', keyword: LV.MENTOR_EMAIL, minPts: LV.MENTOR_MIN_PTS, maxPts: LV.MENTOR_MAX_PTS },
    { id: 'previous', name: 'Previous', fromTeam: 'Previous', avatar: '⏮️', keyword: LV.PREVIOUS_EMAIL, minPts: LV.PREVIOUS_MIN_PTS, maxPts: LV.PREVIOUS_MAX_PTS },
  ];

  LV.ROLE_SLOT_KEYS = LV.ROLES.map(r => 'role:' + r.id);

  LV.SLOT_KEYS = LV.TEAM_SLOT_KEYS.concat(LV.ROLE_SLOT_KEYS);

  LV.MEDALS = ['🥇', '🥈', '🥉', '4️⃣'];

  LV.parseSlotKey = function (slotKey) {
    if (slotKey.startsWith('team:')) {
      const teamId = parseInt(slotKey.slice(5), 10);
      const team = LV.TEAMS.find(t => t.id === teamId);
      return { key: slotKey, type: 'team', teamId, label: team?.name || slotKey, team };
    }
    if (slotKey.startsWith('role:')) {
      const roleId = slotKey.slice(5);
      const role = LV.ROLES.find(r => r.id === roleId);
      return { key: slotKey, type: 'role', roleId, label: role?.name || slotKey, role };
    }
    return null;
  };

  LV.slotDisplayInfo = function (slotKey) {
    const parsed = LV.parseSlotKey(slotKey);
    if (!parsed) return { label: slotKey, emoji: '' };
    if (parsed.type === 'team') return { label: parsed.team.name, emoji: parsed.team.emoji };
    return { label: parsed.role.name, emoji: parsed.role.avatar || '🎓' };
  };

  LV.findRoleByKeyword = function (raw) {
    const key = String(raw || '').trim().toLowerCase();
    return LV.ROLES.find(r => r.id === key || r.keyword === key) || null;
  };

  LV.getRoleScoreLimits = function (role) {
    return {
      min: role?.minPts ?? LV.MENTOR_MIN_PTS,
      max: role?.maxPts ?? LV.MENTOR_MAX_PTS,
    };
  };
})(window.LV = window.LV || {});

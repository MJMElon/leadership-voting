(function (LV) {
  LV.initSupabase = async function () {
    if (!LV.USE_SUPABASE) return;
    try {
      if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return;
      }
      LV.setDbClient(supabase.createClient(LV.SUPABASE_URL, LV.SUPABASE_KEY));
      await LV.loadFromSupabase();
    } catch (e) {
      console.error('Supabase init failed:', e);
    }
  };

  LV.loadFromSupabase = async function () {
    if (!LV.dbClient) return;

    const { data: sessions } = await LV.dbClient.from('sessions').select('*');
    LV.clearTakenSlots();
    (sessions || []).forEach(s => { LV.takenSlots[s.slot_key] = s.email; });

    const { data: vrows } = await LV.dbClient.from('votes')
      .select('*')
      .order('created_at', { ascending: false });

    await LV.loadEventState();

    LV.resetVotes();
    (vrows || []).forEach(v => {
      LV.votes[v.to_team_id] = (LV.votes[v.to_team_id] || 0) + v.points;
      LV.voteLog.push({
        id: v.id,
        voter: v.voter_name,
        email: v.voter_email,
        from: v.from_team,
        to: LV.TEAMS.find(t => t.id === v.to_team_id)?.name || v.to_team_id,
        pts: v.points,
        time: new Date(v.created_at).toLocaleTimeString(),
      });
    });
  };

  LV.dbLockMentorSlots = async function (email, name) {
    for (const slotKey of LV.MENTOR_SLOT_KEYS) {
      const owner = LV.getSlotOwnerEmail(slotKey);
      if (owner && owner !== email) return false;
    }
    for (const slotKey of LV.MENTOR_SLOT_KEYS) {
      const ok = await LV.dbLockSlot(slotKey, email, name);
      if (!ok) return false;
    }
    return true;
  };

  LV.dbLockSlot = async function (slotKey, email, name) {
    const owner = LV.getSlotOwnerEmail(slotKey);
    if (owner && owner !== email) return false;

    if (!LV.dbClient) {
      LV.takenSlots[slotKey] = email;
      return true;
    }

    const { data, error: selErr } = await LV.dbClient.from('sessions')
      .select('email')
      .eq('slot_key', slotKey)
      .maybeSingle();
    if (selErr) console.warn('[dbLockSlot] select error', selErr);
    if (data && data.email !== email) return false;

    if (!data) {
      const { error } = await LV.dbClient.from('sessions').insert({ slot_key: slotKey, email, name });
      if (error) {
        console.error('[dbLockSlot] insert failed', error);
        LV.showToast('DB write failed: ' + error.message, true);
        return false;
      }
    }
    LV.takenSlots[slotKey] = email;
    return true;
  };

  LV.dbSaveVote = async function (toTeamId, points, fromTeam) {
    if (!LV.dbClient) return { ok: true, id: null };
    const { data, error } = await LV.dbClient.from('votes').insert({
      voter_email: LV.currentUser.email,
      voter_name: LV.currentUser.name,
      from_team: fromTeam,
      to_team_id: toTeamId,
      points,
    }).select().single();
    if (error) {
      console.error('[dbSaveVote] insert failed', error);
      LV.showToast('DB write failed: ' + error.message, true);
      return { ok: false, id: null };
    }
    return { ok: true, id: data?.id || null };
  };

  LV.dbDeleteVoteForTarget = async function (voterEmail, toTeamId, fromTeam) {
    if (!LV.dbClient) return;
    await LV.dbClient.from('votes')
      .delete()
      .eq('voter_email', voterEmail)
      .eq('to_team_id', toTeamId)
      .eq('from_team', fromTeam);
  };

  LV.loadEventState = async function () {
    if (!LV.dbClient) return;
    const { data, error } = await LV.dbClient.from('event_state')
      .select('winner_announced')
      .eq('id', 1)
      .maybeSingle();
    if (error) console.warn('[loadEventState]', error);
    if (data) LV.setWinnerAnnounced(data.winner_announced);
  };

  LV.dbSetWinnerAnnounced = async function (open) {
    LV.setWinnerAnnounced(open);
    if (!LV.dbClient) return { ok: true };
    const { error } = await LV.dbClient.from('event_state')
      .upsert({ id: 1, winner_announced: !!open });
    if (error) {
      console.error('[dbSetWinnerAnnounced] upsert failed', error);
      return { ok: false };
    }
    return { ok: true };
  };

  LV.dbUndoTeamVote = async function () {
    if (!LV.dbClient) return { ok: true };
    const fromTeam = LV.fromTeamForSlot(LV.currentUser.slot);
    const { error } = await LV.dbClient.from('votes')
      .delete()
      .eq('voter_email', LV.currentUser.email)
      .eq('from_team', fromTeam);
    if (error) {
      console.error('[dbUndoTeamVote] delete failed', error);
      LV.showToast('DB delete failed: ' + error.message, true);
      return { ok: false };
    }
    return { ok: true };
  };

  LV.dbUndoRoleScore = async function (toTeamId, fromTeam) {
    if (!LV.dbClient) return { ok: true };
    const { error } = await LV.dbClient.from('votes')
      .delete()
      .eq('voter_email', LV.currentUser.email)
      .eq('to_team_id', toTeamId)
      .eq('from_team', fromTeam);
    if (error) {
      console.error('[dbUndoRoleScore] delete failed', error);
      LV.showToast('DB delete failed: ' + error.message, true);
      return { ok: false };
    }
    return { ok: true };
  };

  LV.dbSaveTeamVote = async function (toTeamId) {
    return LV.dbSaveVote(toTeamId, LV.TEAM_VOTE_PTS, LV.fromTeamForSlot(LV.currentUser.slot));
  };

  LV.dbSaveRoleScore = async function (toTeamId, points, fromTeam) {
    if (LV.dbClient) {
      await LV.dbDeleteVoteForTarget(LV.currentUser.email, toTeamId, fromTeam);
    }
    return LV.dbSaveVote(toTeamId, points, fromTeam);
  };
})(window.LV);

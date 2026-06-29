(function (LV) {
  LV.saveSession = function (user) {
    try {
      if (user?.isViewer) {
        localStorage.setItem(LV.STORAGE_KEY, JSON.stringify({ isViewer: true }));
        return;
      }
      if (user?.isInteractive) {
        localStorage.setItem(LV.STORAGE_KEY, JSON.stringify({ isInteractive: true }));
        return;
      }
      if (!user?.slot) return;
      localStorage.setItem(LV.STORAGE_KEY, JSON.stringify({
        email: user.email,
        name: user.name,
        slotKey: user.slot.key,
      }));
    } catch (e) { /* localStorage may be disabled */ }
  };

  LV.clearSession = function () {
    try { localStorage.removeItem(LV.STORAGE_KEY); } catch (e) {}
  };

  LV.getSavedSession = function () {
    try {
      const raw = localStorage.getItem(LV.STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data?.isViewer) return { isViewer: true };
      if (data?.isInteractive) return { isInteractive: true };
      return (data && data.email && data.slotKey) ? data : null;
    } catch (e) { return null; }
  };
})(window.LV);

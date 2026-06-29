(function (LV) {
  let toastTmr;

  LV.showToast = function (msg, err) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (err ? ' error' : '');
    clearTimeout(toastTmr);
    toastTmr = setTimeout(() => el.classList.remove('show'), 3000);
  };
})(window.LV);

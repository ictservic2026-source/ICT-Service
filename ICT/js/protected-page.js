(function () {
  const tag = document.currentScript;
  const roles = (tag.dataset.roles || '').split(',').map((role) => role.trim()).filter(Boolean);
  document.documentElement.classList.add('auth-pending');
  window.ICTAuth.loadProtectedPage(tag.dataset.pageScript, roles);
})();

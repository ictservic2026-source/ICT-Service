(function () {
  const form = document.getElementById('loginForm');
  const button = document.getElementById('loginButton');
  const message = document.getElementById('loginMessage');
  const next = new URLSearchParams(location.search).get('next');

  window.ICTAuth.ready.then((user) => {
    if (user) location.replace(next || window.ICTAuth.defaultPage(user.role));
  }).catch(() => {});

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    button.disabled = true;
    button.textContent = 'กำลังเข้าสู่ระบบ...';
    try {
      const user = await window.ICTAuth.signIn(
        document.getElementById('email').value.trim(),
        document.getElementById('password').value
      );
      location.replace(next || window.ICTAuth.defaultPage(user.role));
    } catch (error) {
      message.textContent = error.message || 'ไม่สามารถเข้าสู่ระบบได้';
      button.disabled = false;
      button.textContent = 'เข้าสู่ระบบ';
    }
  });
})();

/* Shared Supabase authentication for protected ICT pages. */
(function () {
  const SUPABASE_URL = 'https://dcsjvursqnvhcwbeqzmd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg';
  const nativeFetch = window.fetch.bind(window);
  let currentUser = null;
  let fetchInstalled = false;

  function getClient() {
    if (!window.supabase) throw new Error('ไม่สามารถโหลดระบบ Login ได้');
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  const client = getClient();

  async function profileFor(session) {
    const response = await nativeFetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,display_name,role,is_active`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` } }
    );
    if (!response.ok) throw new Error('ไม่สามารถอ่านสิทธิ์ผู้ใช้งานได้');
    const rows = await response.json();
    if (!rows.length || !rows[0].is_active) throw new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน');
    return { ...rows[0], email: session.user.email };
  }

  function installAuthenticatedFetch() {
    if (fetchInstalled) return;
    fetchInstalled = true;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith(SUPABASE_URL)) return nativeFetch(input, init);
      const session = (await client.auth.getSession()).data.session;
      const headers = new Headers(init && init.headers ? init.headers : (typeof input === 'string' ? undefined : input.headers));
      headers.set('apikey', SUPABASE_ANON_KEY);
      if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
      return nativeFetch(input, { ...(init || {}), headers });
    };
  }

  const ready = (async function () {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;
    currentUser = await profileFor(data.session);
    installAuthenticatedFetch();
    return currentUser;
  })();

  function defaultPage(role) {
    return role === 'ITM' ? 'admin-itm.html' : role === 'ITL' ? 'admin-itl.html' : 'admin-ico.html';
  }

  function redirectToLogin() {
    const next = `${location.pathname.split('/').pop() || 'admin-ico.html'}${location.search}`;
    location.replace(`login.html?next=${encodeURIComponent(next)}`);
  }

  function renderUserMenu(user) {
    document.querySelector('.auth-user-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'auth-user-menu';
    const links = ['<a class="auth-user-menu__link" href="dashboard.html">Dashboard</a>'];
    if (user.role === 'ITL' || user.role === 'ITM') links.unshift('<a class="auth-user-menu__link" href="admin-ico.html">งาน ICO</a>');
    if (user.role === 'ITM') links.unshift('<a class="auth-user-menu__link" href="admin-itl.html">งาน ITL</a>');
    menu.innerHTML = `<span class="auth-user-menu__name"></span><a class="auth-user-menu__role" href="${defaultPage(user.role)}"></a>${links.join('')}<button type="button" class="auth-user-menu__logout">ออกจากระบบ</button>`;
    menu.querySelector('.auth-user-menu__name').textContent = user.display_name;
    menu.querySelector('.auth-user-menu__role').textContent = user.role;
    menu.querySelector('.auth-user-menu__logout').addEventListener('click', signOut);
    document.body.appendChild(menu);
  }

  function applyUserIdentity(user) {
    const fields = ['f-staff', 'iw-staff'];
    fields.forEach((id) => {
      const field = document.getElementById(id);
      if (field) { field.value = user.display_name; field.readOnly = true; }
    });
    const navName = document.getElementById('navName');
    const navInitials = document.getElementById('navInitials');
    if (navName) navName.textContent = user.display_name;
    if (navInitials) navInitials.textContent = user.role;
  }

  async function requireRoles(roles) {
    let user;
    try { user = await ready; } catch (error) { console.error(error); }
    if (!user) { redirectToLogin(); return null; }
    if (!roles.includes(user.role)) { location.replace(defaultPage(user.role)); return null; }
    return user;
  }

  async function loadProtectedPage(scriptPath, roles) {
    const user = await requireRoles(roles);
    if (!user) return;
    applyUserIdentity(user);
    renderUserMenu(user);
    document.documentElement.classList.remove('auth-pending');
    const script = document.createElement('script');
    script.src = scriptPath;
    document.body.appendChild(script);
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = await profileFor(data.session);
    installAuthenticatedFetch();
    return currentUser;
  }

  async function signOut() {
    await client.auth.signOut();
    currentUser = null;
    location.replace('login.html');
  }

  window.ICTAuth = { ready, signIn, signOut, requireRoles, loadProtectedPage, getCurrentUser: () => currentUser, defaultPage };
})();
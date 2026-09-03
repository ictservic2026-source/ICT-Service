(function () {
  const SUPABASE_URL = 'https://dcsjvursqnvhcwbeqzmd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkY3NqdnJyc3Fudmhjd2JlqXptZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxMTQ2NDU2LCJleHAiOjIwOTY3MjI0NTZ9.IZyMbPMY3Vk8sIM5N8pqBzFoNRlJPpCKitJwgsnc_Hg';

  const form = document.getElementById('resetPasswordForm');
  const button = document.getElementById('resetButton');
  const message = document.getElementById('resetMessage');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  if (!form) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  /**
   * ฟังก์ชันสำหรับล็อคฟอร์มเมื่อไม่มี Session
   */
  function lockForm() {
    message.textContent = 'ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้งานแล้ว กรุณาขอลิงก์ใหม่';
    message.className = 'reset-message error';
    button.disabled = true;
    newPassword.disabled = true;
    confirmPassword.disabled = true;
  }

  /**
   * ฟังก์ชันสำหรับปลดล็อคฟอร์มเมื่อ Session ถูกต้อง
   */
  function unlockForm() {
    message.textContent = '';
    message.className = 'reset-message';
    button.disabled = false;
    newPassword.disabled = false;
    confirmPassword.disabled = false;
  }

  /* 
   * แก้ไขจุดนี้: ใช้ onAuthStateChange แทนการเรียก checkRecoverySession() ทันที
   * เพื่อรอให้ Supabase ประมวลผล Token จาก URL ให้เสร็จก่อน
   */
  client.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth Event:", event);

    if (event === 'SIGNED_IN' && session) {
      // เมื่อระบบตรวจพบว่า Token ใน URL ถูกต้องและทำการ Login ให้แล้ว
      console.log("Recovery session detected and active.");
      unlockForm();
    } else if (event === 'SIGNED_OUT') {
      lockForm();
    }
  });

  /* 
   * ตรวจสอบเผื่อกรณีที่ Session อาจจะถูกโหลดมาก่อนที่ Listener จะทำงาน 
   * หรือกรณีที่ไม่มี Session จริงๆ หลังจากรอสักพัก
   */
  setTimeout(async () => {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      // ถ้าผ่านไป 2 วินาทีแล้วยังไม่มี session ให้ล็อคฟอร์ม
      lockForm();
    }
  }, 2000);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const password = newPassword.value;
    const confirm = confirmPassword.value;

    message.textContent = '';
    message.className = 'reset-message';

    if (password.length < 8) {
      message.textContent = 'กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร';
      message.className = 'reset-message error';
      return;
    }

    if (password !== confirm) {
      message.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
      message.className = 'reset-message error';
      return;
    }

    button.disabled = true;
    button.textContent = 'กำลังเปลี่ยนรหัสผ่าน...';

    try {
      const { error } = await client.auth.updateUser({
        password: password
      });

      if (error) throw error;

      message.textContent = 'เปลี่ยนรหัสผ่านสำเร็จ กำลังกลับหน้าเข้าสู่ระบบ...';
      message.className = 'reset-message success';

      // ออกจาก Session Recovery เพื่อความปลอดภัย
      await client.auth.signOut();

      setTimeout(function () {
        window.location.replace('login.html');
      }, 1500);

    } catch (error) {
      console.error(error);
      message.textContent = error.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
      message.className = 'reset-message error';
      button.disabled = false;
      button.textContent = 'เปลี่ยนรหัสผ่าน';
    }
  });

})();

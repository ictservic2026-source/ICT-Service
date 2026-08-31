(function () {

  const SUPABASE_URL =
    'https://dcsjvursqnvhcwbeqzmd.supabase.co';

  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkY3NqdnJyc3Fudmhjd2JlqXptZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxMTQ2NDU2LCJleHAiOjIwOTY3MjI0NTZ9.IZyMbPMY3Vk8sIM5N8pqBzFoNRlJPpCKitJwgsnc_Hg';

  const form =
    document.getElementById('resetPasswordForm');

  const button =
    document.getElementById('resetButton');

  const message =
    document.getElementById('resetMessage');

  const newPassword =
    document.getElementById('newPassword');

  const confirmPassword =
    document.getElementById('confirmPassword');

  if (!form) return;

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  async function checkRecoverySession() {

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error || !data.session) {

      message.textContent =
        'ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้งานแล้ว กรุณาขอลิงก์ใหม่';

      message.className =
        'reset-message error';

      button.disabled = true;

      newPassword.disabled = true;

      confirmPassword.disabled = true;

      return false;
    }

    return true;
  }

  /*
   * ตรวจสอบว่าลิงก์ Recovery
   * สร้าง Session ให้แล้วหรือยัง
   */
  checkRecoverySession();

  form.addEventListener(
    'submit',
    async function (event) {

      event.preventDefault();

      const password =
        newPassword.value;

      const confirm =
        confirmPassword.value;

      message.textContent = '';

      message.className =
        'reset-message';

      if (password.length < 8) {

        message.textContent =
          'กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร';

        message.className =
          'reset-message error';

        return;
      }

      if (password !== confirm) {

        message.textContent =
          'รหัสผ่านทั้งสองช่องไม่ตรงกัน';

        message.className =
          'reset-message error';

        return;
      }

      button.disabled = true;

      button.textContent =
        'กำลังเปลี่ยนรหัสผ่าน...';

      try {

        const {
          error
        } = await client.auth.updateUser({
          password: password
        });

        if (error) {
          throw error;
        }

        message.textContent =
          'เปลี่ยนรหัสผ่านสำเร็จ กำลังกลับหน้าเข้าสู่ระบบ...';

        message.className =
          'reset-message success';

        /*
         * ออกจาก Session Recovery
         */
        await client.auth.signOut();

        setTimeout(function () {

          window.location.replace(
            'login.html'
          );

        }, 1500);

      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          'ไม่สามารถเปลี่ยนรหัสผ่านได้';

        message.className =
          'reset-message error';

        button.disabled = false;

        button.textContent =
          'เปลี่ยนรหัสผ่าน';
      }

    }
  );

})();
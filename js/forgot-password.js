(function () {

  const SUPABASE_URL =
    'https://dcsjvursqnvhcwbeqzmd.supabase.co';

  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg';

  const form =
    document.getElementById('forgotPasswordForm');

  const emailInput =
    document.getElementById('forgotEmail');

  const message =
    document.getElementById('forgotMessage');

  const button =
    document.getElementById('forgotButton');

  if (!form) return;

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

  form.addEventListener('submit', async function (event) {

    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) return;

    button.disabled = true;
    button.textContent = 'กำลังส่ง...';

    message.textContent = '';
    message.className = 'forgot-message';

    try {

      /*
       * หลังจากกดลิงก์ใน Email
       * Supabase จะส่ง User กลับมาหน้านี้
       */
      const redirectTo =
        `${window.location.origin}/reset-password.html`;

      const { error } =
        await client.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: redirectTo
          }
        );

      if (error) {
        throw error;
      }

      message.textContent =
        'ส่งลิงก์เปลี่ยนรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย';

      message.className =
        'forgot-message success';

      emailInput.value = '';

    } catch (error) {

      console.error(error);

      message.textContent =
        error.message ||
        'ไม่สามารถส่งลิงก์เปลี่ยนรหัสผ่านได้';

      message.className =
        'forgot-message error';

    } finally {

      button.disabled = false;

      button.textContent =
        'ส่งลิงก์เปลี่ยนรหัสผ่าน';

    }

  });

})();
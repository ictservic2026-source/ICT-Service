
const SUPABASE_URL = "https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const API    = `${SUPABASE_URL}/rest/v1/tickets`;
const STORE  = `${SUPABASE_URL}/storage/v1/object/ticket-files`;
const PUB    = `${SUPABASE_URL}/storage/v1/object/public/ticket-files`;
const HDR    = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };

// ── Ticket number ──────────────────────────────────────────────
function prefix() {
  const n = new Date();
  return `ICT-${String(n.getFullYear()).slice(2)}${String(n.getMonth()+1).padStart(2,'0')}`;
}
async function nextSeq() {
  const p = prefix();
  const r = await fetch(`${API}?select=ticket_no&ticket_no=like.${p}-%25&order=ticket_no.desc&limit=100`, { headers: HDR });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return 1;
  return Math.max(...rows.map(x => parseInt(x.ticket_no.split('-').pop()) || 0)) + 1;
}
let ticketNo = prefix() + '-?';
document.getElementById('ticketTag').textContent = ticketNo;
(async () => {
  try {
    ticketNo = `${prefix()}-${await nextSeq()}`;
    document.getElementById('ticketTag').textContent = ticketNo;
  } catch(e) {}
})();

// ── Progress bar ───────────────────────────────────────────────
const requiredIds = ['requester_name','department','location','required_date','issue_detail','requester_email','manager_email'];
function updateProgress() {
  const filled = requiredIds.filter(id => document.getElementById(id)?.value.trim()).length;
  document.getElementById('progressBar').style.width = (filled / requiredIds.length * 100) + '%';
}
requiredIds.forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateProgress);
});

// ── Char counter ───────────────────────────────────────────────
function updateChar(el, spanId) {
  document.getElementById(spanId).textContent = el.value.length;
  updateProgress();
}

// ── Image preview ──────────────────────────────────────────────
let imgFiles = [], attachFiles = [];

function handleImgFiles(input) {
  imgFiles = Array.from(input.files);
  const grid = document.getElementById('imgPreviews');
  const inner = document.getElementById('imgInner');
  grid.innerHTML = '';
  if (!imgFiles.length) { inner.style.display = ''; return; }
  inner.style.display = 'none';
  imgFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    const isImg = f.type.startsWith('image/');
    if (isImg) {
      const img = document.createElement('img');
      const url = URL.createObjectURL(f);
      img.src = url;
      item.appendChild(img);
    } else {
      item.innerHTML = `<div class="file-thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${f.name}</span></div>`;
    }
    const rm = document.createElement('button');
    rm.className = 'remove'; rm.textContent = '×';
    rm.onclick = (e) => { e.stopPropagation(); imgFiles.splice(i,1); renderImgFiles(); };
    item.appendChild(rm);
    grid.appendChild(item);
  });
}
function renderImgFiles() {
  const dt = new DataTransfer();
  imgFiles.forEach(f => dt.items.add(f));
  document.getElementById('issue_img').files = dt.files;
  handleImgFiles(document.getElementById('issue_img'));
}

// ── Doc file list ──────────────────────────────────────────────
function handleDocFiles(input) {
  attachFiles = Array.from(input.files);
  renderDocList();
}
function renderDocList() {
  const list = document.getElementById('attachList');
  const inner = document.getElementById('attachInner');
  list.innerHTML = '';
  if (!attachFiles.length) { inner.style.display = ''; return; }
  inner.style.display = 'none';
  attachFiles.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>${f.name}</span>
      <span class="sz">${(f.size/1024).toFixed(0)} KB</span>
      <button class="rm" onclick="removeDoc(${i})">×</button>`;
    list.appendChild(row);
  });
}
function removeDoc(i) {
  attachFiles.splice(i,1);
  const dt = new DataTransfer();
  attachFiles.forEach(f => dt.items.add(f));
  document.getElementById('attachment').files = dt.files;
  renderDocList();
}

// ── Drag hover ─────────────────────────────────────────────────
['imgZone','attachZone'].forEach(id => {
  const z = document.getElementById(id);
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
  z.addEventListener('dragleave', () => z.classList.remove('over'));
  z.addEventListener('drop', () => z.classList.remove('over'));
});

// ── Upload to Storage ──────────────────────────────────────────
async function uploadFile(file, folder) {
  const ext  = file.name.split('.').pop();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const res  = await fetch(`${STORE}/${path}`, {
    method: 'POST',
    headers: { ...HDR, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) throw new Error(`อัปโหลดไม่สำเร็จ: ${file.name}`);
  return `${PUB}/${path}`;
}
async function uploadMany(files, folder) {
  if (!files.length) return null;
  return await Promise.all(files.map(f => uploadFile(f, folder)));
}

// ── Validate ───────────────────────────────────────────────────
function validate() {
  for (const id of requiredIds) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      el?.focus();
      toast('⚠️ กรุณากรอก "' + (el?.previousElementSibling?.textContent?.replace('*','').trim() || id) + '"', true);
      return false;
    }
  }
  return true;
}

// ── Submit ─────────────────────────────────────────────────────
async function submitForm() {
  if (!validate()) return;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;

  try {
    setBtn(btn, '🔄 กำลังอัปโหลดไฟล์...');
    const [imgUrls, attachUrls] = await Promise.all([
      uploadMany(imgFiles, 'images'),
      uploadMany(attachFiles, 'attachments')
    ]);

    setBtn(btn, '💾 กำลังบันทึกข้อมูล...');
    const seq = await nextSeq();
    ticketNo = `${prefix()}-${seq}`;
    document.getElementById('ticketTag').textContent = ticketNo;

    const payload = {
      ticket_no:       ticketNo,
      required_date:   document.getElementById('required_date').value,
      requester_name:  document.getElementById('requester_name').value,
      department:      document.getElementById('department').value,
      location:        document.getElementById('location').value,
      asset_id:        document.getElementById('asset_id').value || null,
      issue_detail:    document.getElementById('issue_detail').value,
      requester_email: document.getElementById('requester_email').value,
      manager_email:   document.getElementById('manager_email').value,
      issue_img_url:   imgUrls,      // array หรือ null
      attachment_url:  attachUrls,   // array หรือ null
      status: 'OPEN'
    };

    const res = await fetch(API, {
      method: 'POST',
      headers: { ...HDR, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      document.getElementById('successNo').textContent = ticketNo;
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'flex';
      document.getElementById('progressBar').style.width = '100%';

      /* ── Make.com Webhook ── */
      try {
        await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event:           'OPEN',
            action:          'NEW_REQUEST',
            new_status:      'OPEN',
            ticket_no:       payload.ticket_no,
            requester_name:  payload.requester_name   || '',
            requester_email: payload.requester_email  || '',
            manager_email:   payload.manager_email    || '',
            department:      payload.department       || '',
            location:        payload.location         || '',
            asset_id:        payload.asset_id         || '',
            issue_detail:    payload.issue_detail     || '',
            required_date:   payload.required_date    || '',
            issue_img_url:   (payload.issue_img_url   || []).join(','),
            attachment_url:  (payload.attachment_url  || []).join(','),
            approve_link:    window.location.origin + '/approve.html?ticket=' + encodeURIComponent(payload.ticket_no),
            timestamp:       new Date().toISOString()
          })
        });
      } catch(wErr) { console.warn('[Make webhook]', wErr); }

    } else {
      const err = await res.json();
      toast('❌ ' + (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'), true);
      resetBtn(btn);
    }
  } catch(e) {
    toast('❌ ' + (e.message || 'เชื่อมต่อไม่ได้'), true);
    resetBtn(btn);
  }
}

function setBtn(btn, txt) {
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> ${txt}`;
}
function resetBtn(btn) {
  btn.disabled = false;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> ส่งคำขอรับบริการ`;
}

async function resetAll() {
  document.querySelectorAll('input:not([type=file]),textarea').forEach(el => el.value = '');
  imgFiles = []; attachFiles = [];
  document.getElementById('imgPreviews').innerHTML = '';
  document.getElementById('attachList').innerHTML = '';
  document.getElementById('imgInner').style.display = '';
  document.getElementById('attachInner').style.display = '';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('formView').style.display = 'block';
  document.getElementById('successView').style.display = 'none';
  resetBtn(document.getElementById('submitBtn'));
  try {
    ticketNo = `${prefix()}-${await nextSeq()}`;
    document.getElementById('ticketTag').textContent = ticketNo;
  } catch(e) {}
}

function copyTicket() {
  navigator.clipboard.writeText(ticketNo).then(() => toast('✅ คัดลอกแล้ว: ' + ticketNo));
}

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : ' ok');
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

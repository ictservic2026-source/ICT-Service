
const SB   = "https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const API  = `${SB}/rest/v1/tickets`;
const LOG  = `${SB}/rest/v1/tickets_log`;
const STORE= `${SB}/storage/v1/object/ticket-files`;
const PUB  = `${SB}/storage/v1/object/public/ticket-files`;
const HDR  = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };

// ── โหลด ticket ───────────────────────────────────────────────
const ticketParam = new URLSearchParams(location.search).get('ticket');
let ticketData = null;

async function loadTicket() {
  const url = ticketParam
    ? `${API}?ticket_no=eq.${encodeURIComponent(ticketParam)}&limit=1`
    : `${API}?order=request_date.desc&limit=1`;
  const res  = await fetch(url, { headers: HDR });
  const rows = await res.json();
  if (!rows.length) { showToast('ไม่พบข้อมูลคำขอ', true); return; }
  ticketData = rows[0];
  render(ticketData);
}

function fmtDate(s) {
  if (!s) return '–';
  return new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
}

function render(t) {
  // Header
  document.getElementById('dispNo').textContent      = t.ticket_no || '–';
  document.getElementById('dispReqDate').textContent = fmtDate(t.request_date);
  document.getElementById('dispNeedDate').textContent = fmtDate(t.required_date);
  document.getElementById('dispNeedDate2').textContent = fmtDate(t.required_date);

  // Requester highlight
  const initials = (t.requester_name || '?').split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
  document.getElementById('reqAvatar').textContent = initials;
  document.getElementById('reqName').textContent   = t.requester_name || '–';
  document.getElementById('reqDept').textContent   = t.department || '–';
  document.getElementById('reqLoc').textContent    = t.location || '–';

  // ปัญหา
  if (t.asset_id) {
    document.getElementById('assetRow').style.display = '';
    document.getElementById('dispAsset').textContent = t.asset_id;
  }
  document.getElementById('dispIssue').textContent = t.issue_detail || '–';

  // รูปภาพ — แสดงเฉพาะถ้ามี
  const imgs = toArray(t.issue_img_url);
  if (imgs.length) {
    document.getElementById('imgSection').style.display = '';
    const g = document.getElementById('imgGallery');
    imgs.forEach(url => {
      const img = document.createElement('img');
      img.className = 'gimg'; img.src = url; img.alt = '';
      img.onclick = () => openLB(url);
      g.appendChild(img);
    });
  }

  // เอกสารแนบ — แสดงเฉพาะถ้ามี
  const docs = toArray(t.attachment_url);
  if (docs.length) {
    document.getElementById('attachSection').style.display = '';
    const al = document.getElementById('attachList');
    docs.forEach(url => {
      const name = decodeURIComponent(url.split('/').pop());
      const isPDF = name.toLowerCase().endsWith('.pdf');
      const isImg = /\.(jpe?g|png|gif|webp)$/i.test(name);
      const color = isPDF ? '#EF4444' : '#F59E0B';
      const div = document.createElement('div');
      div.className = 'attach-row';
      div.style.cursor = 'pointer';
      div.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="attach-name">${name}</span>
        <span class="attach-open" style="color:${color}">
          พรีวิว
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>`;
      div.onclick = () => openFileModal(url, name, isPDF, isImg);
      al.appendChild(div);
    });
  }

  // ถ้าอนุมัติ/ไม่อนุมัติแล้ว
  if (t.mgr_status === 'APPROVED' || t.mgr_status === 'REJECTED') {
    showDone(t.mgr_status, t.ticket_no);
  }
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string' && val.startsWith('{')) {
    return val.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,'')).filter(Boolean);
  }
  return [val];
}

// ── Canvas ─────────────────────────────────────────────────────
const canvas = document.getElementById('sigCanvas');
const ctx    = canvas.getContext('2d');
let drawing = false, hasSig = false;

function initCanvas() {
  // ต้อง show panel ก่อน ถึงจะ getBoundingClientRect ได้ถูก
  const panel = document.getElementById('sigDrawPanel');
  const wasHidden = panel.style.display === 'none';
  if (wasHidden) { panel.style.visibility = 'hidden'; panel.style.display = ''; }

  const r = canvas.getBoundingClientRect();
  const w = r.width  || canvas.offsetWidth  || 500;
  const h = r.height || canvas.offsetHeight || 150;
  const dpr = window.devicePixelRatio || 1;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(1,0,0,1,0,0); // reset ก่อน scale
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = '#1C1917';
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (wasHidden) { panel.style.display = 'none'; panel.style.visibility = ''; }
}
window.addEventListener('resize', initCanvas);

function pos(e) {
  // ใช้ getBoundingClientRect ทุกครั้งเพื่อให้ offset ถูกเสมอ
  const r = canvas.getBoundingClientRect();
  const s = e.touches ? e.touches[0] : e;
  return {
    x: (s.clientX - r.left),
    y: (s.clientY - r.top)
  };
}
canvas.addEventListener('mousedown',  e => { e.preventDefault(); drawing=true; ctx.beginPath(); const p=pos(e); ctx.moveTo(p.x,p.y); });
canvas.addEventListener('mousemove',  e => { if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); markSig(); });
canvas.addEventListener('mouseup',    () => drawing=false);
canvas.addEventListener('mouseleave', () => drawing=false);
canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing=true; ctx.beginPath(); const p=pos(e); ctx.moveTo(p.x,p.y); }, {passive:false});
canvas.addEventListener('touchmove',  e => { e.preventDefault(); if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); markSig(); }, {passive:false});
canvas.addEventListener('touchend',   () => drawing=false);

function markSig() { hasSig=true; document.getElementById('canvasHint').style.opacity='0'; }
function clearCanvas() {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  hasSig=false;
  document.getElementById('canvasHint').style.opacity='1';
}

// ── Tab switch ─────────────────────────────────────────────────
let sigMode = 'type';
function switchSig(m) {
  sigMode = m;
  document.getElementById('sigTypePanel').style.display = m==='type' ? '' : 'none';
  document.getElementById('sigDrawPanel').style.display = m==='draw' ? '' : 'none';
  document.getElementById('tabType').classList.toggle('active', m==='type');
  document.getElementById('tabDraw').classList.toggle('active', m==='draw');
  // init canvas หลัง panel visible แล้ว
  if (m === 'draw') requestAnimationFrame(() => initCanvas());
}

// ── Get signature value ────────────────────────────────────────
async function getSig() {
  if (sigMode === 'type') {
    return { url: null, name: document.getElementById('sigText').value.trim() };
  }
  // draw → upload PNG
  const blob = await new Promise(r => canvas.toBlob(r,'image/png'));
  const path = `signatures/${ticketData.ticket_no}-mgr-${Date.now()}.png`;
  const res  = await fetch(`${STORE}/${path}`,{method:'POST',headers:{...HDR,'Content-Type':'image/png','x-upsert':'true'},body:blob});
  if (!res.ok) throw new Error('อัปโหลดลายเซ็นไม่สำเร็จ');
  return { url: `${PUB}/${path}`, name: null };
}

// ── Submit ─────────────────────────────────────────────────────
async function doAction(action) {
  // Validate
  const comment = document.getElementById('mgr_comment').value.trim();
  if (action === 'REJECTED' && !comment) { showToast('กรุณาระบุเหตุผลที่ไม่อนุมัติ', true); return; }
  if (sigMode === 'type' && !document.getElementById('sigText').value.trim()) { showToast('กรุณาพิมพ์ชื่อก่อนยืนยัน', true); return; }
  if (sigMode === 'draw' && !hasSig) { showToast('กรุณาวาดลายเซ็นก่อนยืนยัน', true); return; }

  const ab = document.getElementById('approveBtn');
  const rb = document.getElementById('rejectBtn');
  ab.disabled = rb.disabled = true;
  ab.innerHTML = rb.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="10" stroke-opacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> กำลังบันทึก...`;

  try {
    const sig = await getSig();

    // PATCH tickets — ใช้ column จริงใน Supabase
    // status: APPROVED → ICO_WORK (รอ ICO รับงาน), REJECTED → REJECTED
    const newStatus = action === 'APPROVED' ? 'ICO_WORK' : 'REJECTED';
    const now = new Date().toISOString();
    const patch = {
      status:           newStatus,
      mgr_status:       action,
      mgr_name:         sig.name || null,
      mgr_signature_url:sig.url  || null,
      mgr_approved_at:  now,
    };
    if (comment) patch.mgr_comment = comment;

    const r1 = await fetch(`${API}?ticket_no=eq.${encodeURIComponent(ticketData.ticket_no)}`, {
      method: 'PATCH',
      headers: { ...HDR, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(patch)
    });
    if (!r1.ok) {
      const e = await r1.json();
      throw new Error(e.message || 'บันทึกไม่สำเร็จ');
    }

    // INSERT tickets_log
    const rLog = await fetch(LOG, {
      method: 'POST',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_no:  ticketData.ticket_no,
        step_name:  'MANAGER_APPROVE',
        status:     action,
        action_by:  sig.name || 'วาดลายเซ็น',
        comment:    comment || null
      })
    });
    if (!rLog.ok) {
      showToast(`⚠️ บันทึกสำเร็จ แต่เขียน log ไม่สำเร็จ (HTTP ${rLog.status})`, true);
    }

    /* ── Make.com Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          event:           'MANAGER_APPROVE',
          action:          action,
          new_status:      newStatus,
          ticket_no:       ticketData.ticket_no,
          requester_name:  ticketData.requester_name   ||'',
          requester_email: ticketData.requester_email  ||'',
          department:      ticketData.department       ||'',
          location:        ticketData.location         ||'',
          asset_id:        ticketData.asset_id         ||'',
          issue_detail:    ticketData.issue_detail     ||'',
          request_date:    ticketData.request_date     ||'',
          required_date:   ticketData.required_date    ||'',
          mgr_name:        sig.name                   ||'',
          mgr_comment:     comment                    ||'',
          mgr_approved_at: now,
          timestamp:       new Date().toISOString()
        })
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}

    showDone(action, ticketData.ticket_no);
  } catch(e) {
    showToast('❌ ' + e.message, true);
    ab.disabled = rb.disabled = false;
    ab.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> อนุมัติ';
    rb.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ไม่อนุมัติ';
  }
}

function showDone(action, no) {
  const ok = action === 'APPROVED';
  document.getElementById('approveView').style.display = 'none';
  document.getElementById('doneView').style.display    = 'flex';
  document.getElementById('statusPill').innerHTML      = ok
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> อนุมัติแล้ว'
    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ไม่อนุมัติ';
  document.getElementById('statusPill').style.cssText  = ok
    ? 'background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;'
    : 'background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;';

  const icon = document.getElementById('doneIcon');
  icon.className = 'done-icon ' + (ok ? 'ok' : 'ng');
  document.getElementById('doneIconSvg').innerHTML = ok
    ? '<polyline points="20 6 9 17 4 12" stroke="#16A34A"/>'
    : '<line x1="18" y1="6" x2="6" y2="18" stroke="#DC2626"/><line x1="6" y1="6" x2="18" y2="18" stroke="#DC2626"/>';

  document.getElementById('doneTitle').textContent = ok ? 'อนุมัติเรียบร้อยแล้ว' : 'บันทึกการไม่อนุมัติแล้ว';
  document.getElementById('doneSub').textContent   = ok
    ? 'ทีม ICT จะดำเนินการและติดต่อกลับหาผู้แจ้ง'
    : 'ระบบจะแจ้งผู้แจ้งพร้อมเหตุผลที่ท่านระบุ';
  const badge = document.getElementById('doneBadge');
  badge.textContent = no; badge.className = 'done-badge ' + (ok ? 'ok' : 'ng');
}

// ── Lightbox ───────────────────────────────────────────────────
function openLB(url) { document.getElementById('lbImg').src=url; document.getElementById('lb').classList.add('open'); }
function closeLB()   { document.getElementById('lb').classList.remove('open'); }

// ── File Preview Modal ────────────────────────────────────────
let _fmUrl = '';
function openFileModal(url, name, isPDF, isImg) {
  _fmUrl = url;
  document.getElementById('fmName').textContent = name;
  const body = document.getElementById('fmBody');
  body.innerHTML = '';

  if (isImg) {
    // รูปภาพ — ใช้ img tag
    const img = document.createElement('img');
    img.src = url; img.alt = name;
    body.style.background = '#111';
    body.appendChild(img);
  } else if (isPDF) {
    // PDF — ใช้ iframe ให้ browser render built-in PDF viewer
    const iframe = document.createElement('iframe');
    iframe.src = url + '#toolbar=1&navpanes=0';
    iframe.title = name;
    body.style.background = 'white';
    body.appendChild(iframe);
  } else {
    // ไฟล์อื่น (Word, Excel ฯลฯ) — ไม่มี built-in viewer แนะนำให้เปิดแท็บใหม่
    body.style.background = '#1C1917';
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:#A8A29E;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:14px;text-align:center;line-height:1.7;">ไฟล์ประเภทนี้ไม่รองรับพรีวิว<br><span style="font-size:12px;">กด "เปิดแท็บใหม่" หรือ "บันทึก" เพื่อดูไฟล์</span></div>
      </div>`;
  }
  document.getElementById('fileModal').classList.add('open');
}
function closeFileModal(e) {
  if (e && e.target !== document.getElementById('fileModal')) return;
  document.getElementById('fileModal').classList.remove('open');
  document.getElementById('fmBody').innerHTML = ''; // ล้าง iframe เพื่อหยุด PDF
}
function openInTab()    { window.open(_fmUrl, '_blank', 'noopener'); }
function downloadFile() {
  const a = document.createElement('a');
  a.href = _fmUrl; a.download = decodeURIComponent(_fmUrl.split('/').pop());
  a.click();
}

function showToast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast'+(err?' err':'');
  void t.offsetWidth; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3500);
}

loadTicket().then(() => initCanvas());

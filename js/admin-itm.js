
const SB="https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const HDR={'apikey':KEY,'Authorization':'Bearer '+KEY};
const API=`${SB}/rest/v1/tickets`;
const SVCAPI=`${SB}/rest/v1/ticket_services`;
const LOG=`${SB}/rest/v1/tickets_log`;
let allTickets=[],currentTicket=null,currentService=null,selectedPriority='MED';
document.getElementById('searchInput').addEventListener('input',renderTable);
document.getElementById('statusFilter').addEventListener('change',renderTable);
refreshTickets();
async function refreshTickets(){
  document.getElementById('ticketTableBody').innerHTML='<tr class="loading-row"><td colspan="8">กำลังโหลด...</td></tr>';
  try{
    const res=await fetch(`${API}?status=in.(ITM_WAIT,ICO_FINAL,DONE,CANCELLED)&order=request_date.desc&limit=200`,{headers:HDR});
    const data=await res.json();
    if(!Array.isArray(data))throw new Error(data.message||'โหลดไม่สำเร็จ');

    /* ── ตีกลับ ICO: หา ticket ที่ IT MGR เคยตีกลับ (จาก log) แล้วเช็คว่ายังค้างอยู่จริง (status ปัจจุบัน = ICO_WORK) ── */
    let backTickets=[];
    try{
      const lr=await fetch(`${LOG}?step_name=eq.IT_MGR_APPROVE&status=eq.BACK_TO_ICO&order=created_at.desc&select=ticket_no,action_by,comment,created_at`,{headers:HDR});
      const lrows=await lr.json();
      if(Array.isArray(lrows)&&lrows.length){
        const bounceInfo={};
        lrows.forEach(r=>{ if(!bounceInfo[r.ticket_no]) bounceInfo[r.ticket_no]=r; }); // rows เรียง desc แล้ว เก็บแค่ครั้งล่าสุดต่อ ticket
        const noList=Object.keys(bounceInfo);
        if(noList.length){
          const tr=await fetch(`${API}?ticket_no=in.(${noList.map(encodeURIComponent).join(',')})&status=eq.ICO_WORK`,{headers:HDR});
          const trows=await tr.json();
          if(Array.isArray(trows))backTickets=trows.map(t=>({...t,_bounce:bounceInfo[t.ticket_no]}));
        }
      }
    }catch(be){console.warn('[ITM] โหลดรายการตีกลับไม่สำเร็จ',be);}

    allTickets=[...data,...backTickets];
    document.getElementById('s-pending').textContent=data.filter(t=>t.status==='ITM_WAIT').length;
    document.getElementById('s-approved').textContent=data.filter(t=>t.status==='ICO_FINAL').length;
    document.getElementById('s-done').textContent=data.filter(t=>t.status==='DONE').length;
    document.getElementById('s-cancel').textContent=data.filter(t=>t.status==='CANCELLED').length;
    document.getElementById('s-back').textContent=backTickets.length;
    document.getElementById('pendingBadge').textContent=data.filter(t=>t.status==='ITM_WAIT').length;
    document.getElementById('backBadge').textContent=backTickets.length;
    renderTable();
  }catch(e){showToast('❌ '+e.message,'err');}
}
function setFilter(s){document.getElementById('statusFilter').value=s;renderTable();}
function renderTable(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  const st=document.getElementById('statusFilter').value;
  let rows=allTickets.filter(t=>{
    const mq=!q||[t.ticket_no,t.requester_name,t.department,t.issue_detail].some(v=>(v||'').toLowerCase().includes(q));
    const ms=!st||t.status===st;
    return mq&&ms;
  });
  const smap={ITM_WAIT:'<span class="status s-itm">รออนุมัติ IT MGR</span>',ICO_FINAL:'<span class="status" style="background:var(--blue-pale);color:var(--blue);border:1px solid var(--blue-border);">ICO ปิดงาน</span>',DONE:'<span class="status s-done">เสร็จสิ้น</span>',CANCELLED:'<span class="status s-cancel">ยกเลิก</span>',ICO_WORK:'<span class="status" style="background:var(--amber-pale);color:var(--amber);border:1px solid var(--amber-border);">↩ ตีกลับ ICO</span>'};
  const tbody=document.getElementById('ticketTableBody');
  if(!rows.length){tbody.innerHTML='<tr class="loading-row"><td colspan="8">ไม่พบข้อมูล</td></tr>';return;}
  tbody.innerHTML=rows.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    const issue=(t.issue_detail||'').slice(0,45)+((t.issue_detail||'').length>45?'…':'');
    const cost=t.repair_cost?'฿'+Number(t.repair_cost).toLocaleString():'—';
    const bounceTip=t._bounce?` title="ตีกลับโดย ${esc(t._bounce.action_by||'—')} เมื่อ ${fmtDT(t._bounce.created_at)}${t._bounce.comment?' — '+esc(t._bounce.comment):''}"`:'';
    return`<tr onclick="openModal('${esc(t.ticket_no)}')">
      <td><span class="td-no">${esc(t.ticket_no)}</span></td>
      <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
      <td style="font-size:12px;color:var(--sub);">${esc(t.department||'—')}</td>
      <td title="${esc(t.issue_detail||'')}">${esc(issue)}</td>
      <td style="font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:var(--teal);">${cost}</td>
      <td${bounceTip}>${smap[t.status]||t.status}</td>
      <td><span class="td-date">${d}</span></td>
      <td><button class="btn-row btn-review" onclick="event.stopPropagation();openModal('${esc(t.ticket_no)}')">อนุมัติ</button></td>
    </tr>`;
  }).join('');
  document.getElementById('tableFooter').textContent=`แสดง ${rows.length} รายการ`;
}
async function openModal(no){
  currentTicket=allTickets.find(t=>t.ticket_no===no);
  if(!currentTicket)return;
  selectedPriority='MED';
  setPriority('MED');
  document.getElementById('rm-title').textContent=`อนุมัติงาน — ${no}`;
  document.getElementById('rm-sub').textContent=currentTicket.issue_detail?currentTicket.issue_detail.slice(0,80):'—';
  document.getElementById('rm-requester').textContent=currentTicket.requester_name||'—';
  document.getElementById('rm-dept').textContent=currentTicket.department||'—';
  document.getElementById('rm-loc').textContent=currentTicket.location||'—';
  document.getElementById('rm-asset').textContent=currentTicket.asset_id||'—';
  document.getElementById('rm-reqdate').textContent=fmtDate(currentTicket.request_date);
  document.getElementById('rm-issue').textContent=currentTicket.issue_detail||'—';
  document.getElementById('rm-itl-name').textContent=currentTicket.itl_name||'—';
  document.getElementById('rm-itl-status').textContent=currentTicket.itl_status==='ITL_APPROVE'?'✅ อนุมัติ':currentTicket.itl_status||'—';
  document.getElementById('rm-itl-comment').textContent=currentTicket.itl_comment||'—';
  document.getElementById('itm-comment').value='';
  const bb=document.getElementById('bounce-banner');
  if(currentTicket._bounce){
    bb.style.display='flex';
    document.getElementById('bounce-meta').textContent=`ตีกลับโดย ${currentTicket._bounce.action_by||'—'} เมื่อ ${fmtDT(currentTicket._bounce.created_at)}${currentTicket._bounce.comment?' — เหตุผล: '+currentTicket._bounce.comment:''}`;
  }else{
    bb.style.display='none';
  }
  try{
    const r=await fetch(`${SVCAPI}?ticket_no=eq.${encodeURIComponent(no)}&limit=1`,{headers:HDR});
    const rows=await r.json();
    currentService=rows[0]||null;
    if(currentService){
      document.getElementById('rm-staff').textContent=currentService.staff_name||'—';
      document.getElementById('rm-recv').textContent=fmtDate(currentService.received_date);
      document.getElementById('rm-cat').textContent=currentService.job_category||'—';
      document.getElementById('rm-inspect').textContent=currentService.inspection_detail||'—';
      document.getElementById('rm-action').textContent=currentService.action_detail||'—';
      document.getElementById('rm-parts').textContent=currentService.spare_parts_detail||'—';
      const c=currentService.repair_cost?'฿'+Number(currentService.repair_cost).toLocaleString():'—';
      document.getElementById('rm-cost').textContent=c;
      document.getElementById('rm-cost-box').textContent=c;
      document.getElementById('rm-rec').textContent=currentService.recommendations||'—';
      const icoF=toArray(currentService.attachment_urls);
      document.getElementById('rm-ico-files').innerHTML=icoF.length?icoF.map(u=>fLink(u)).join(''):'<span style="font-size:12px;color:var(--mute);">ไม่มีไฟล์</span>';
    }else{document.getElementById('rm-cost-box').textContent='฿ —';}
  }catch(e){}
  const reqF=toArray(currentTicket.attachment_url);
  document.getElementById('rm-req-files').innerHTML=reqF.length?reqF.map(u=>fLink(u)).join(''):'<span style="font-size:12px;color:var(--mute);">ไม่มีไฟล์</span>';
  await loadLog(no);
  buildApproverChain(no);
  switchTab('ti-req',document.querySelector('.tab-btn'));
  document.getElementById('reviewModal').classList.add('open');
}
function fLink(url){const name=decodeURIComponent(url.split('/').pop());return`<a class="glink" href="${esc(url)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span></a>`;}
async function loadLog(no){
  const t=document.getElementById('rm-thread');
  t.innerHTML='<div style="padding:16px;text-align:center;color:var(--mute);font-size:12px;">กำลังโหลด...</div>';
  try{
    const r=await fetch(`${LOG}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.asc`,{headers:HDR});
    const rows=await r.json();
    if(!rows.length){t.innerHTML='<div style="padding:16px;text-align:center;color:var(--mute);font-size:12px;">ยังไม่มี log</div>';return;}
    const roleMap={'MANAGER_APPROVE':'หัวหน้างาน','ICO_CHECK':'ICO','ICT_ACTION':'ICO/ช่าง','ITL_APPROVE':'ITL','IT_MGR_APPROVE':'IT Manager'};
    t.innerHTML=rows.map(r=>{
      const sc=r.status==='APPROVED'?'var(--green)':r.status==='REJECTED'||r.status==='CANCELLED'?'var(--red)':'var(--sub)';
      const dt=r.created_at?fmtDT(r.created_at):'';
      return`<div class="comment-item"><div class="comment-meta"><span class="comment-who">${esc(r.action_by||'—')}</span><span class="comment-role">${roleMap[r.step_name]||r.step_name||''}</span><span style="font-size:10px;font-weight:700;color:${sc};">${r.status||''}</span><span class="comment-time">${dt}</span></div>${r.comment?`<div class="comment-text">${esc(r.comment)}</div>`:''}</div>`;
    }).join('');
  }catch(e){}
}
function setPriority(p){
  selectedPriority=p;
  ['low','med','high'].forEach(x=>{const b=document.getElementById('p-'+x);b.className='priority-btn';});
  document.getElementById('p-'+p.toLowerCase()).classList.add('active-'+p.toLowerCase());
}
async function doAction(action){
  if(!currentTicket)return;
  const comment=document.getElementById('itm-comment').value.trim();
  if((action==='CANCELLED'||action==='BACK_TO_ITL'||action==='BACK_TO_ICO')&&!comment){showToast('กรุณาระบุเหตุผล','err');return;}
  const mgrName=window.ICTAuth?.getCurrentUser?.().display_name||'';
  if(!mgrName){showToast('ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่','err');return;}
  const statusMap={ITM_APPROVE:'ICO_FINAL',CANCELLED:'CANCELLED',BACK_TO_ITL:'ITL_WAIT',BACK_TO_ICO:'ICO_WORK'};
  const newStatus=statusMap[action]||'ICO_FINAL';
  const logStatus=action==='ITM_APPROVE'?'APPROVED':action==='CANCELLED'?'CANCELLED':action; // BACK_TO_ITL / BACK_TO_ICO บันทึกตามจริง ไม่ยุบเป็น REJECTED
  /* disable all action buttons */
  document.querySelectorAll('.modal-foot button').forEach(b=>b.disabled=true);
  try{
    /* อัปเดต ticket status — core step */
    /* อัปเดตเฉพาะ status (เก็บ itm info ใน tickets_log) */
    const ticketRes=await fetch(`${API}?ticket_no=eq.${encodeURIComponent(currentTicket.ticket_no)}`,{
      method:'PATCH',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({
        status:          newStatus,
        itm_approved_at: action==='ITM_APPROVE'?new Date().toISOString():null
      })
    });
    if(!ticketRes.ok){const e=await ticketRes.text();throw new Error('อัปเดตสถานะไม่สำเร็จ: '+e);}
    /* บันทึก log — จุดนี้คือแหล่งข้อมูลจริงที่ ICO ใช้แสดงผล IT MGR ต้องเช็คว่าสำเร็จจริง */
    const logRes=await fetch(LOG,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ticket_no:currentTicket.ticket_no,step_name:'IT_MGR_APPROVE',status:logStatus,action_by:mgrName.trim(),comment:comment||null})
    });
    if(!logRes.ok){const le=await logRes.text();console.error('[ITM] บันทึก log ไม่สำเร็จ:',le);showToast('⚠️ อัปเดตสถานะสำเร็จ แต่บันทึกประวัติ (log) ไม่สำเร็จ: '+le,'err');}
    /* ── Make.com Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
      event:         action==='ITM_APPROVE'?'IT_MGR_APPROVE':action==='CANCELLED'?'CANCELLED':'REJECTED',
      action:        action,
      new_status:    newStatus,
      ticket_no:     currentTicket.ticket_no,
      requester_name:  currentTicket.requester_name  ||'',
      requester_email: currentTicket.requester_email ||'',
      department:    currentTicket.department  ||'',
      issue_detail:  currentTicket.issue_detail||'',
      request_date:  currentTicket.request_date||'',
      itm_name:      mgrName.trim(),
      itm_comment:   comment||'',
      itm_approved_at: action==='ITM_APPROVE'?new Date().toISOString():'',
      priority:      selectedPriority,
      repair_cost:   currentService?currentService.repair_cost||0:0,
      action_detail: currentService?currentService.action_detail||'':'',
      timestamp:     new Date().toISOString()
})
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}
    const msgs={ITM_APPROVE:'✅ อนุมัติแล้ว — แจ้ง ICO ปิดงาน',CANCELLED:'🚫 ยกเลิกงานแล้ว',BACK_TO_ITL:'↩ ตีกลับ ITL แล้ว',BACK_TO_ICO:'↩ ตีกลับ ICO แล้ว'};
    showToast(msgs[action]||'บันทึกแล้ว','ok');
    closeModal();await refreshTickets();
  }catch(e){
    console.error('ITM doAction error:',e);
    showToast('❌ '+e.message,'err');
  }
  finally{document.querySelectorAll('.modal-foot button').forEach(b=>b.disabled=false);}
}
function closeModal(){document.getElementById('reviewModal').classList.remove('open');}
function switchTab(id,btn){document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');if(btn)btn.classList.add('active');}
function fmtDate(s){if(!s)return'—';return new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});}
function fmtDT(s){
  if(!s)return'—';
  const d=new Date(s);
  const day=String(d.getDate()).padStart(2,'0');
  const mon=String(d.getMonth()+1).padStart(2,'0');
  const yr=String(d.getFullYear()).slice(2);
  const hr=String(d.getHours()).padStart(2,'0');
  const mn=String(d.getMinutes()).padStart(2,'0');
  return `${day}/${mon}/${yr} ${hr}:${mn}`;
}
async function buildApproverChain(no){
  const chainEl=document.getElementById('approver-chain-itm');
  if(!chainEl)return;
  try{
    const r=await fetch(`${LOG}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.asc`,{headers:HDR});
    const rows=await r.json();
    if(!Array.isArray(rows)||!rows.length){chainEl.innerHTML='<span style="font-size:11px;color:var(--mute);">ยังไม่มีประวัติ</span>';return;}
    const roleMap={'MANAGER_APPROVE':['หัวหน้างาน','#D97706'],'ICO_CHECK':['ICO','#7C3AED'],'ICT_ACTION':['ICO/ช่าง','#7C3AED'],'ITL_APPROVE':['ITL','#EA580C'],'IT_MGR_APPROVE':['IT Manager','#0F766E']};
    const approved=rows.filter(r=>['APPROVED','COMMENT','DONE'].includes(r.status));
    chainEl.innerHTML=approved.map(r=>{
      const [roleLabel,color]=roleMap[r.step_name]||['—','#9CA3AF'];
      const sc=r.status==='APPROVED'||r.status==='DONE'?'#15803D':r.status==='REJECTED'?'#DC2626':'#6B7280';
      return`<div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid #E5E7EB;border-radius:7px;padding:5px 10px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div><div style="font-size:11px;font-weight:700;color:#111827;">${esc(r.action_by||'—')}</div><div style="font-size:9px;color:${color};">${roleLabel}</div></div>
        <div style="margin-left:4px;text-align:right;"><div style="font-size:9px;font-weight:700;color:${sc};">${r.status}</div><div style="font-size:9px;color:#9CA3AF;font-family:'Inter',sans-serif;">${fmtDT(r.created_at)}</div></div>
      </div>`;
    }).join('');
  }catch(e){chainEl.innerHTML='<span style="font-size:11px;color:var(--mute);">โหลดไม่สำเร็จ</span>';}
}
function toArray(val){if(!val)return[];if(Array.isArray(val))return val.filter(Boolean);if(typeof val==='string'&&val.startsWith('{'))return val.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,'')).filter(Boolean);return[val];}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let toastTimer;
function showToast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(type?' '+type:'');void t.offsetWidth;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}


const SB="https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const HDR={'apikey':KEY,'Authorization':'Bearer '+KEY};
const API=`${SB}/rest/v1/tickets`;
const SVCAPI=`${SB}/rest/v1/ticket_services`;
const SVCITL=`${SB}/rest/v1/itl_services`;
const LOG=`${SB}/rest/v1/tickets_log`;
const STORE=`${SB}/storage/v1/object/ticket-files`;
const PUB=`${SB}/storage/v1/object/public/ticket-files`;
let allTickets=[],currentTicket=null,currentService=null,currentITLWork=null,itlFiles=[];
document.getElementById('searchInput').addEventListener('input',renderTable);
document.getElementById('statusFilter').addEventListener('change',renderTable);
refreshTickets();
async function refreshTickets(){
  document.getElementById('ticketTableBody').innerHTML='<tr class="loading-row"><td colspan="7">กำลังโหลด...</td></tr>';
  try{
    const res=await fetch(`${API}?status=in.(ITL_WAIT,ITM_WAIT,DONE,ICO_WORK,ICO_FINAL,CANCELLED)&order=request_date.desc&limit=200`,{headers:HDR});
    const data=await res.json();
    if(!Array.isArray(data))throw new Error(data.message||'โหลดไม่สำเร็จ');
    allTickets=data;
    document.getElementById('s-pending').textContent=data.filter(t=>t.status==='ITL_WAIT').length;
    document.getElementById('s-itm').textContent=data.filter(t=>t.status==='ITM_WAIT').length;
    document.getElementById('s-back').textContent=data.filter(t=>t.itl_status==='BACK_TO_ICO').length;
    document.getElementById('s-final').textContent=data.filter(t=>t.status==='ICO_FINAL'||t.status==='DONE').length;
    document.getElementById('s-done').textContent=data.filter(t=>t.status==='DONE').length;
    document.getElementById('pendingBadge').textContent=data.filter(t=>t.status==='ITL_WAIT').length;
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
  const map={ITL_WAIT:'<span class="status s-itl">รออนุมัติ ITL</span>',ITM_WAIT:'<span class="status s-itm">รอ IT MGR</span>',DONE:'<span class="status s-done">เสร็จสิ้น</span>',ICO_WORK:'<span class="status s-back">ส่งกลับ ICO</span>'};
  const tbody=document.getElementById('ticketTableBody');
  if(!rows.length){tbody.innerHTML='<tr class="loading-row"><td colspan="7">ไม่พบข้อมูล</td></tr>';return;}
  tbody.innerHTML=rows.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    const issue=(t.issue_detail||'').slice(0,50)+((t.issue_detail||'').length>50?'…':'');
    return`<tr onclick="openModal('${esc(t.ticket_no)}')">
      <td><span class="td-no">${esc(t.ticket_no)}</span></td>
      <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
      <td style="font-size:12px;color:var(--sub);">${esc(t.department||'—')}</td>
      <td title="${esc(t.issue_detail||'')}">${esc(issue)}</td>
      <td>${map[t.status]||t.status}</td>
      <td><span class="td-date">${d}</span></td>
      <td><button class="btn-row btn-review" onclick="event.stopPropagation();openModal('${esc(t.ticket_no)}')">ตรวจสอบ</button></td>
    </tr>`;
  }).join('');
  document.getElementById('tableFooter').textContent=`แสดง ${rows.length} รายการ`;
}
async function openModal(no){
  currentTicket=allTickets.find(t=>t.ticket_no===no);
  if(!currentTicket)return;
  document.getElementById('rm-title').textContent=`ตรวจสอบงาน — ${no}`;
  document.getElementById('rm-sub').textContent=currentTicket.issue_detail?currentTicket.issue_detail.slice(0,80):'—';
  document.getElementById('rm-requester').textContent=currentTicket.requester_name||'—';
  document.getElementById('rm-dept').textContent=currentTicket.department||'—';
  document.getElementById('rm-loc').textContent=currentTicket.location||'—';
  document.getElementById('rm-asset').textContent=currentTicket.asset_id||'—';
  document.getElementById('rm-reqdate').textContent=fmtDate(currentTicket.request_date);
  document.getElementById('rm-needdate').textContent=fmtDate(currentTicket.required_date);
  document.getElementById('rm-issue').textContent=currentTicket.issue_detail||'—';
  document.getElementById('itl-comment').value='';
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
      const costText=currentService.repair_cost?'฿'+Number(currentService.repair_cost).toLocaleString('th-TH'):'฿ 0';
      document.getElementById('rm-cost').textContent=costText;
      document.getElementById('cost-banner').textContent=currentService.repair_cost?'฿'+Number(currentService.repair_cost).toLocaleString('th-TH'):'฿ —';
      document.getElementById('cost-sub').textContent=currentService.repair_cost?`${currentService.job_category||''}  ${currentService.staff_name||''}`.trim():'ICO ยังไม่ระบุ';
      document.getElementById('rm-rec').textContent=currentService.recommendations||'—';
      const icoF=toArray(currentService.attachment_urls);
      document.getElementById('rm-ico-files').innerHTML=icoF.length?icoF.map(u=>fileLink(u)).join(''):'<span style="font-size:12px;color:var(--mute);">ไม่มีไฟล์</span>';
    }
  }catch(e){}
  const reqF=toArray(currentTicket.attachment_url);
  document.getElementById('rm-requester-files').innerHTML=reqF.length?reqF.map(u=>fileLink(u)).join(''):'<span style="font-size:12px;color:var(--mute);">ไม่มีไฟล์</span>';
  await loadITLWork(no);
  await loadLog(no);
  buildApproverChain(no);
  switchTab('ti-req',document.querySelector('.tab-btn'));
  document.getElementById('reviewModal').classList.add('open');
}
function fileLink(url){const name=decodeURIComponent(url.split('/').pop());return`<a class="glink" href="${esc(url)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span></a>`;}

/* ═══ ITL WORK RECORD (บันทึกงานที่ ITL ลงมือทำเอง) ═══ */
async function loadITLWork(no){
  itlFiles=[];document.getElementById('itlFileList').innerHTML='';
  const ids=['iw-staff','iw-received','iw-category','iw-inspection','iw-action','iw-parts','iw-cost','iw-finish','iw-hours','iw-recommend','iw-notes'];
  ids.forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('iw-priority').value='MED';
  document.getElementById('iw-existing-files').innerHTML='';
  try{
    const r=await fetch(`${SVCITL}?ticket_no=eq.${encodeURIComponent(no)}&limit=1`,{headers:HDR});
    const rows=await r.json();
    currentITLWork=Array.isArray(rows)&&rows[0]?rows[0]:null;
    if(currentITLWork){
      document.getElementById('iw-staff').value=currentITLWork.staff_name||'';
      document.getElementById('iw-received').value=currentITLWork.received_date||'';
      document.getElementById('iw-category').value=currentITLWork.job_category||'';
      document.getElementById('iw-priority').value=currentITLWork.priority||'MED';
      document.getElementById('iw-inspection').value=currentITLWork.inspection_detail||'';
      document.getElementById('iw-action').value=currentITLWork.action_detail||'';
      document.getElementById('iw-parts').value=currentITLWork.spare_parts_detail||'';
      document.getElementById('iw-cost').value=currentITLWork.repair_cost||'';
      document.getElementById('iw-finish').value=currentITLWork.finish_date||'';
      document.getElementById('iw-hours').value=currentITLWork.work_hours||'';
      document.getElementById('iw-recommend').value=currentITLWork.recommendations||'';
      document.getElementById('iw-notes').value=currentITLWork.additional_notes||'';
      const exF=toArray(currentITLWork.attachment_urls);
      document.getElementById('iw-existing-files').innerHTML=exF.length?exF.map(u=>fileLink(u)).join(''):'';
    }
  }catch(e){currentITLWork=null;}
  const authStaff=window.ICTAuth?.getCurrentUser?.().display_name||'';
  if(authStaff){const staffInput=document.getElementById('iw-staff');if(staffInput){staffInput.value=authStaff;staffInput.readOnly=true;}}
}
function handleITLFiles(files){itlFiles=[...itlFiles,...Array.from(files)].slice(0,10);renderITLFileList();}
function handleITLDrop(e){e.preventDefault();handleITLFiles(e.dataTransfer.files);}
function renderITLFileList(){
  document.getElementById('itlFileList').innerHTML=itlFiles.map((f,i)=>`
    <div class="file-item">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="file-item-name">${esc(f.name)}</span>
      <span style="font-size:10px;color:var(--mute);">${(f.size/1024).toFixed(0)}KB</span>
      <button class="file-remove" onclick="itlFiles.splice(${i},1);renderITLFileList()">×</button>
    </div>`).join('');
}
async function uploadITLFiles(files,folder){
  const urls=[];
  for(const f of files){
    const path=`${folder}/${Date.now()}-${f.name}`;
    const r=await fetch(`${STORE}/${path}`,{method:'POST',headers:{...HDR,'Content-Type':f.type||'application/octet-stream','x-upsert':'true'},body:f});
    if(r.ok)urls.push(`${PUB}/${path}`);
  }
  return urls;
}
async function saveITLWork(){
  if(!currentTicket)return;
  const staff=document.getElementById('iw-staff').value.trim();
  if(!staff){showToast('กรุณาระบุชื่อ ITL ผู้ปฏิบัติงาน','err');return;}
  const btn=document.getElementById('btn-itl-draft');
  const orig=btn.innerHTML;
  btn.disabled=true;btn.innerHTML='กำลังบันทึก...';
  try{
    let urls=toArray(currentITLWork?.attachment_urls);
    try{if(itlFiles.length){const up=await uploadITLFiles(itlFiles,`itl-services/${currentTicket.ticket_no}`);urls=[...urls,...up];}}catch(ue){console.warn('upload warn:',ue);}
    const payload={
      ticket_no:currentTicket.ticket_no,
      staff_name:staff,
      received_date:document.getElementById('iw-received').value||null,
      job_category:document.getElementById('iw-category').value||null,
      priority:document.getElementById('iw-priority').value||'MED',
      inspection_detail:document.getElementById('iw-inspection').value.trim()||null,
      action_detail:document.getElementById('iw-action').value.trim()||null,
      spare_parts_detail:document.getElementById('iw-parts').value.trim()||null,
      repair_cost:parseFloat(document.getElementById('iw-cost').value)||null,
      finish_date:document.getElementById('iw-finish').value||null,
      work_hours:parseFloat(document.getElementById('iw-hours').value)||null,
      recommendations:document.getElementById('iw-recommend').value.trim()||null,
      additional_notes:document.getElementById('iw-notes').value.trim()||null,
      attachment_urls:urls.length?urls:null,
      updated_at:new Date().toISOString(),
    };
    const svcRes=await fetch(`${SVCITL}?on_conflict=ticket_no`,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(payload)
    });
    if(!svcRes.ok){
      const patchRes=await fetch(`${SVCITL}?ticket_no=eq.${encodeURIComponent(currentTicket.ticket_no)}`,{
        method:'PATCH',
        headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(payload)
      });
      if(!patchRes.ok){const e=await patchRes.text();throw new Error('บันทึกงาน ITL ไม่สำเร็จ: '+e);}
    }
    const logRes=await fetch(LOG,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ticket_no:currentTicket.ticket_no,step_name:'ITL_WORK',status:'DRAFT',action_by:staff,comment:'ITL บันทึกรายละเอียดงานที่ดำเนินการเอง'})
    });
    if(!logRes.ok){console.warn('[ITL] เขียน log ไม่สำเร็จ');}
    itlFiles=[];document.getElementById('itlFileList').innerHTML='';
    showToast('💾 บันทึกงาน ITL แล้ว','ok');
    await loadITLWork(currentTicket.ticket_no);
    await loadLog(currentTicket.ticket_no);
  }catch(e){
    console.error('saveITLWork error:',e);
    showToast('❌ '+e.message,'err');
  }finally{btn.disabled=false;btn.innerHTML=orig;}
}
async function loadLog(no){
  const t=document.getElementById('rm-thread');
  t.innerHTML='<div style="padding:16px;text-align:center;color:var(--mute);font-size:12px;">กำลังโหลด...</div>';
  try{
    const r=await fetch(`${LOG}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.asc`,{headers:HDR});
    const rows=await r.json();
    if(!rows.length){t.innerHTML='<div style="padding:16px;text-align:center;color:var(--mute);font-size:12px;">ยังไม่มี log</div>';return;}
    const roleMap={'MANAGER_APPROVE':'หัวหน้างาน','ICO_CHECK':'ICO','ICT_ACTION':'ICO/ช่าง','ITL_APPROVE':'ITL','ITL_WORK':'ITL (บันทึกงาน)','IT_MGR_APPROVE':'IT Manager'};
    t.innerHTML=rows.map(r=>{
      const sc=r.status==='APPROVED'?'var(--green)':r.status==='REJECTED'?'var(--red)':'var(--sub)';
      const dt=r.created_at?fmtDT(r.created_at):'';
      return`<div class="comment-item${r.step_name?'':' system'}"><div class="comment-meta"><span class="comment-who">${esc(r.action_by||'—')}</span><span class="comment-role">${roleMap[r.step_name]||r.step_name||''}</span><span style="font-size:10px;font-weight:700;color:${sc};">${r.status||''}</span><span class="comment-time">${dt}</span></div>${r.comment?`<div class="comment-text">${esc(r.comment)}</div>`:''}</div>`;
    }).join('');
  }catch(e){}
}
async function doAction(action){
  if(!currentTicket)return;
  const comment=document.getElementById('itl-comment').value.trim();
  if(action==='BACK_TO_ICO'&&!comment){showToast('กรุณาระบุเหตุผลก่อนตีกลับ','err');return;}
  const itlName=window.ICTAuth?.getCurrentUser?.().display_name||'';
  if(!itlName){showToast('ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่','err');return;}
  const newStatus=action==='ITL_APPROVE'?'ITM_WAIT':'ICO_WORK';
  const logStatus=action==='ITL_APPROVE'?'APPROVED':action; // BACK_TO_ICO บันทึกตามจริง ไม่ยุบเป็น REJECTED
  const btn=action==='ITL_APPROVE'?document.querySelector('.btn-success'):document.querySelector('.btn-warn');
  if(btn){btn.disabled=true;}
  try{
    /* อัปเดต ticket status — core step */
    /* อัปเดตเฉพาะ status (ไม่ส่ง column ที่อาจไม่มีใน schema) */
    const ticketRes=await fetch(`${API}?ticket_no=eq.${encodeURIComponent(currentTicket.ticket_no)}`,{
      method:'PATCH',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({status:newStatus,itl_approved_at:new Date().toISOString()})
    });
    if(!ticketRes.ok){const e=await ticketRes.text();throw new Error('อัปเดตสถานะไม่สำเร็จ: '+e);}
    /* บันทึก log — จุดนี้คือแหล่งข้อมูลจริงที่ ICO ใช้แสดงผล ITL ต้องเช็คว่าสำเร็จจริง */
    const logRes=await fetch(LOG,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ticket_no:currentTicket.ticket_no,step_name:'ITL_APPROVE',status:logStatus,action_by:itlName.trim(),comment:comment||null})
    });
    if(!logRes.ok){const le=await logRes.text();console.error('[ITL] บันทึก log ไม่สำเร็จ:',le);showToast('⚠️ อัปเดตสถานะสำเร็จ แต่บันทึกประวัติ (log) ไม่สำเร็จ: '+le,'err');}
    /* ── Make.com Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
      event:         action==='ITL_APPROVE'?'ITL_APPROVE':'REJECTED',
      action:        action,
      new_status:    newStatus,
      ticket_no:     currentTicket.ticket_no,
      requester_name:  currentTicket.requester_name  ||'',
      requester_email: currentTicket.requester_email ||'',
      department:    currentTicket.department  ||'',
      issue_detail:  currentTicket.issue_detail||'',
      request_date:  currentTicket.request_date||'',
      itl_name:      itlName.trim(),
      itl_comment:   comment||'',
      itl_approved_at: new Date().toISOString(),
      timestamp:     new Date().toISOString()
})
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}
    showToast(action==='ITL_APPROVE'?'✅ อนุมัติ — ส่งต่อ IT MGR แล้ว':'↩ ตีกลับ ICO แล้ว','ok');
    closeModal();await refreshTickets();
  }catch(e){
    console.error('ITL doAction error:',e);
    showToast('❌ '+e.message,'err');
  }
  finally{if(btn)btn.disabled=false;}
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
  const chainEl=document.getElementById('approver-chain');
  try{
    const r=await fetch(`${LOG}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.asc`,{headers:HDR});
    const rows=await r.json();
    if(!Array.isArray(rows)||!rows.length){chainEl.innerHTML='<span style="font-size:11px;color:var(--mute);">ยังไม่มีการอนุมัติก่อนหน้า</span>';return;}
    const roleMap={'MANAGER_APPROVE':['หัวหน้างาน','#D97706'],'ICO_CHECK':['ICO','#7C3AED'],'ICT_ACTION':['ICO/ช่าง','#7C3AED'],'ITL_APPROVE':['ITL','#EA580C'],'IT_MGR_APPROVE':['IT Manager','#0F766E']};
    const approved=rows.filter(r=>['APPROVED','COMMENT'].includes(r.status)||r.status==='DONE');
    if(!approved.length){chainEl.innerHTML='<span style="font-size:11px;color:var(--mute);">ยังไม่มีการอนุมัติก่อนหน้า</span>';return;}
    chainEl.innerHTML=approved.map(r=>{
      const [roleLabel,color]=roleMap[r.step_name]||['—','#9CA3AF'];
      const sc=r.status==='APPROVED'||r.status==='DONE'?'#15803D':r.status==='REJECTED'?'#DC2626':'#6B7280';
      return`<div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid #E5E7EB;border-radius:7px;padding:5px 10px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#111827;">${esc(r.action_by||'—')}</div>
          <div style="font-size:9px;color:${color};">${roleLabel}</div>
        </div>
        <div style="margin-left:4px;text-align:right;">
          <div style="font-size:9px;font-weight:700;color:${sc};">${r.status}</div>
          <div style="font-size:9px;color:#9CA3AF;font-family:'Inter',sans-serif;">${fmtDT(r.created_at)}</div>
        </div>
      </div>`;
    }).join('');
  }catch(e){chainEl.innerHTML='<span style="font-size:11px;color:var(--mute);">โหลดไม่สำเร็จ</span>';}
}
function toArray(val){if(!val)return[];if(Array.isArray(val))return val.filter(Boolean);if(typeof val==='string'&&val.startsWith('{'))return val.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,'')).filter(Boolean);return[val];}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let toastTimer;
function showToast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(type?' '+type:'');void t.offsetWidth;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}

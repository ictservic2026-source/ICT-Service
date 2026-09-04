/* ═══ CONFIG (จุดเชื่อมต่อเดียวกับหน้า ICO/ITL/ITM) ═══ */
const SB   = "https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const HDR  = {'apikey':KEY,'Authorization':'Bearer '+KEY};
const API  = `${SB}/rest/v1/tickets`;
const SVC  = `${SB}/rest/v1/ticket_services`;
const LOG  = `${SB}/rest/v1/tickets_log`;
const SURV = `${SB}/rest/v1/ticket_survey`;

/* ═══ WIDGET LIST — เพิ่ม/ลด widget ในอนาคตแค่แก้ array นี้ ═══ */
const WIDGETS=[
  {id:'overviewTotals',label:'📊 ภาพรวมรวมทั้งหมด (เคส/ปิด/ค้าง/รอประเมิน)'},
  {id:'bounceBanner',label:'แบนเนอร์: งานถูกตีกลับ'},
  {id:'finalBanner',  label:'แบนเนอร์: รอปิดงาน'},
  {id:'kpiRow',       label:'การ์ด KPI ทั้งแถว'},
  {id:'kpiOpen',      label:'  ↳ KPI: คำขอใหม่ (OPEN)'},
  {id:'kpiIco',       label:'  ↳ KPI: ICO ดำเนินการ'},
  {id:'kpiBounce',    label:'  ↳ KPI: ถูกตีกลับ'},
  {id:'kpiItl',       label:'  ↳ KPI: รอ ITL'},
  {id:'kpiFinal',     label:'  ↳ KPI: รอปิดงาน'},
  {id:'kpiDone',      label:'  ↳ KPI: เสร็จสิ้น'},
  {id:'costSummary',  label:'💰 สรุปค่าใช้จ่ายรวม (เดือน/ปี/ทั้งหมด/ตามตัวกรอง)'},
  {id:'chartStatus',  label:'กราฟ: สถานะงาน (โดนัท)'},
  {id:'chartCat',     label:'กราฟ: ประเภทงาน (แท่ง)'},
  {id:'chartMonth',   label:'กราฟ: งานรายเดือน'},
  {id:'monthlyBreakdown', label:'ตาราง: สรุปรายเดือน (รับแจ้ง/ปิด/ค้าง/คะแนน)'},
  {id:'deptTable',    label:'ตาราง: งานแยกตามแผนก'},
  {id:'survey',       label:'สรุปคะแนนความพึงพอใจ'},
  {id:'svTrack',      label:'ติดตามแบบประเมิน (ค้าง/เสร็จ)'},
  {id:'recent',       label:'ตาราง: รายการงานตามขั้นตอน (คำขอใหม่/ICO/รอ ITL/รอปิดงาน)'},
];
const DEFAULT_HIDDEN=['bounceBanner','finalBanner']; // เริ่มต้นซ่อน เพราะเป็นมุมมองเฉพาะคิว ICO
const PREF_KEY='ictDashboardWidgetPrefs';

function loadWidgetPrefs(){
  try{
    const raw=localStorage.getItem(PREF_KEY);
    if(raw)return JSON.parse(raw);
  }catch(e){}
  const def={};
  WIDGETS.forEach(w=>def[w.id]=!DEFAULT_HIDDEN.includes(w.id));
  return def;
}
let widgetPrefs=loadWidgetPrefs();

function renderSettingsGrid(){
  const grid=document.getElementById('settingsGrid');
  grid.innerHTML=WIDGETS.map(w=>`
    <label class="chk-item">
      <input type="checkbox" data-wid="${w.id}" ${widgetPrefs[w.id]!==false?'checked':''}>
      ${w.label}
    </label>`).join('');
}
/* กลุ่ม widget ↔ หัวข้อ section: ซ่อนหัวข้อ section เมื่อ widget ในกลุ่มถูกซ่อนหมด */
const SECTION_GROUPS=[
  {header:'w-overviewTotals-hd', widgets:['overviewTotals']},
  {header:'w-status-hd',         widgets:['bounceBanner','finalBanner','kpiRow']},
  {header:'w-costSummary-hd',    widgets:['costSummary']},
  {header:'w-charts-hd',         widgets:['chartStatus','chartCat','chartMonth','monthlyBreakdown']},
  {header:'w-deptsurvey-hd',     widgets:['deptTable','survey']},
  {header:'w-svTrack-hd',        widgets:['svTrack']},
  {header:'w-recent-hd',         widgets:['recent']},
];
function applyWidgetVisibility(){
  WIDGETS.forEach(w=>{
    const el=document.getElementById('w-'+w.id);
    if(el)el.classList.toggle('hidden',widgetPrefs[w.id]===false);
  });
  SECTION_GROUPS.forEach(g=>{
    const hd=document.getElementById(g.header);
    if(!hd)return;
    const allHidden=g.widgets.every(id=>widgetPrefs[id]===false);
    hd.classList.toggle('hidden',allHidden);
  });
}
function saveWidgetPrefs(){
  document.querySelectorAll('#settingsGrid input[type=checkbox]').forEach(cb=>{
    widgetPrefs[cb.dataset.wid]=cb.checked;
  });
  localStorage.setItem(PREF_KEY,JSON.stringify(widgetPrefs));
  applyWidgetVisibility();
  showToast('✅ บันทึกมุมมอง Dashboard แล้ว','ok');
}
function resetWidgetPrefs(){
  widgetPrefs={};
  WIDGETS.forEach(w=>widgetPrefs[w.id]=true);
  localStorage.removeItem(PREF_KEY);
  renderSettingsGrid();
  applyWidgetVisibility();
  showToast('รีเซ็ตเป็นค่าเริ่มต้นแล้ว','ok');
}
function toggleSettings(){
  document.getElementById('settingsPanel').classList.toggle('open');
}

/* ═══ STATE ═══ */
let allTickets=[],chartS=null,chartC=null,chartM=null,chartD=null;
let bounceMap={},surveySet=new Set(),surveyMeta={},svTrackTab='pending';
let costTab='month',allServices=null;
let recentTab='open',lastFilteredData=[];
/* กลุ่มสถานะสำหรับ "รายการงานตามขั้นตอน" — ใช้เกณฑ์เดียวกับการ์ด KPI ด้านบน */
const STATUS_GROUPS={
  open:t=>['OPEN','MGR_WAIT'].includes(t.status),
  ico:t=>t.status==='ICO_WORK',
  itl:t=>t.status==='ITL_WAIT',
  itm:t=>t.status==='ITM_WAIT',
  final:t=>t.status==='ICO_FINAL',
};

/* ═══ BOOT ═══ */
(function(){
  const sel=document.getElementById('dash-month');
  const now=new Date();
  for(let i=0;i<24;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lb=d.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    const o=document.createElement('option');o.value=v;o.textContent=lb;if(i===0)o.selected=true;
    sel.appendChild(o);
  }
  renderSettingsGrid();
  applyWidgetVisibility();
  onModeChange(); // ตั้งค่าเริ่มต้น: โหมด "เลือกเดือน" + ซ่อนช่วงวันที่กำหนดเอง
  refreshAll();
})();

/* ═══ FILTER MODE (เดือน / ช่วงวันที่กำหนดเอง / ทุกช่วงเวลา) ═══ */
function onModeChange(){
  const mode=document.getElementById('dash-mode').value;
  document.getElementById('dash-month').style.display=mode==='month'?'':'none';
  document.getElementById('dateRangeWrap').classList.toggle('show',mode==='range');
  syncCostTabToFilter();
  buildDashboard();
}
function fmtShort(iso){
  if(!iso)return'';
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
}
/* คืนช่วงวันที่ที่ใช้กรองอยู่ตอนนี้ ไม่ว่าจะมาจากโหมดไหน ({from,to,label,mode}) */
function getFilterRange(){
  const mode=document.getElementById('dash-mode').value;
  if(mode==='range'){
    const fromV=document.getElementById('dash-date-from').value;
    const toV=document.getElementById('dash-date-to').value;
    const from=fromV?new Date(fromV+'T00:00:00'):null;
    const to=toV?new Date(toV+'T23:59:59'):null;
    let label='ทุกช่วงเวลา';
    if(fromV&&toV)label=`${fmtShort(fromV)} - ${fmtShort(toV)}`;
    else if(fromV)label=`ตั้งแต่ ${fmtShort(fromV)}`;
    else if(toV)label=`ถึง ${fmtShort(toV)}`;
    return{from,to,label,mode};
  }
  if(mode==='month'){
    const m=document.getElementById('dash-month').value;
    if(!m)return{from:null,to:null,label:'ทุกช่วงเวลา',mode};
    const[y,mo]=m.split('-').map(Number);
    const from=new Date(y,mo-1,1);
    const to=new Date(y,mo,0,23,59,59);
    const label=from.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    return{from,to,label,mode};
  }
  return{from:null,to:null,label:'ทุกช่วงเวลา',mode};
}
function inRange(dateStr,range){
  if(!dateStr)return false;
  if(!range.from&&!range.to)return true;
  const d=new Date(dateStr);
  if(range.from&&d<range.from)return false;
  if(range.to&&d>range.to)return false;
  return true;
}
/* ปี/เดือนอ้างอิงสำหรับ widget ที่ต้อง "ฟิว" ตามตัวกรองด้านบน (สรุปรายเดือน, กราฟรายเดือน, ค่าใช้จ่ายรายเดือน/ปี)
   - โหมดเดือน  -> ใช้เดือน/ปีที่เลือก
   - โหมดช่วงวันที่ -> ใช้ปีของวันที่เริ่มต้น (หรือวันที่สิ้นสุดถ้าไม่ได้ระบุวันเริ่ม)
   - โหมดทุกช่วงเวลา -> ใช้ปี/เดือนปัจจุบันจริง (ค่าเริ่มต้นที่สมเหตุสมผลที่สุด) */
function getFilterYearMonth(){
  const mode=document.getElementById('dash-mode').value;
  if(mode==='month'){
    const m=document.getElementById('dash-month').value;
    if(m){const[y,mo]=m.split('-').map(Number);return{y,m:mo-1};}
  }
  if(mode==='range'){
    const fromV=document.getElementById('dash-date-from').value;
    const toV=document.getElementById('dash-date-to').value;
    const ref=fromV||toV;
    if(ref){const d=new Date(ref+'T00:00:00');return{y:d.getFullYear(),m:d.getMonth()};}
  }
  const now=new Date();
  return{y:now.getFullYear(),m:now.getMonth()};
}
/* เดือน (yr,m) ทับซ้อนกับช่วงที่กรองอยู่หรือไม่ — ใช้ไฮไลต์แถวในตารางสรุปรายเดือน */
function isMonthInRange(yr,m,range){
  if(!range.from&&!range.to)return false;
  const start=new Date(yr,m,1);
  const end=new Date(yr,m+1,0,23,59,59);
  if(range.to&&start>range.to)return false;
  if(range.from&&end<range.from)return false;
  return true;
}
/* สลับแท็บค่าใช้จ่ายให้ตรงกับตัวกรองด้านบนโดยอัตโนมัติ (เลือกเดือน -> รายเดือน, ช่วงวันที่ -> ตามตัวกรอง, ทุกช่วงเวลา -> ทั้งหมด)
   ผู้ใช้ยังกดแท็บอื่น (เช่น รายปี) เองได้เสมอ — ค่านี้จะถูกเซตใหม่ก็ต่อเมื่อมีการเปลี่ยนตัวกรองด้านบนอีกครั้ง */
function syncCostTabToFilter(){
  const mode=document.getElementById('dash-mode').value;
  const target=mode==='month'?'month':mode==='range'?'filtered':'all';
  costTab=target;
  document.querySelectorAll('.log-filter-btn[data-cost]').forEach(b=>b.classList.toggle('active',b.dataset.cost===target));
}
/* ใช้กับ onchange ของ dash-month และช่วงวันที่กำหนดเอง */
function onFilterChange(){
  syncCostTabToFilter();
  buildDashboard();
}

async function refreshAll(){
  await Promise.all([fetchTickets(),loadBounceMap(),loadSurveySet(),loadAllServices()]);
  buildDashboard();
}

/* ดึงค่าฟิลด์แรกที่มีจริงจาก object ตามรายชื่อคีย์ที่เดา — เผื่อไม่รู้ชื่อคอลัมน์จริงในตาราง
   (ใช้ select=* แทนการระบุคอลัมน์ตรงๆ เพื่อไม่ให้ query พังถ้าคอลัมน์ไม่ตรงชื่อที่เดาไว้) */
function pickField(row,keys){
  if(!row)return null;
  for(const k of keys){
    if(row[k]!==undefined&&row[k]!==null&&String(row[k]).trim()!=='')return row[k];
  }
  return null;
}

/* ดึง JSON จาก Supabase แบบปลอดภัย: ลอง select=* ก่อน (เผื่อได้ฟิลด์พิเศษที่ไม่รู้ชื่อ)
   ถ้า request ไม่ผ่าน (เช่น เจอคอลัมน์ที่สิทธิ์ anon เข้าไม่ถึง หรือ type ที่ query ไม่ได้ ทำให้ทั้ง request พัง)
   จะ fallback ไปใช้ select แบบระบุคอลัมน์ตรงๆ ที่รู้ว่าใช้ได้แน่นอนแทน — กันไม่ให้ของเดิมที่เคยทำงานพังไปด้วย */
async function fetchSafe(baseUrl,fallbackSelect){
  try{
    const r=await fetch(`${baseUrl}?select=*&limit=5000`,{headers:HDR});
    if(r.ok){
      const rows=await r.json();
      if(Array.isArray(rows))return rows;
    }
  }catch(e){console.warn('fetchSafe(*) failed, falling back:',e);}
  try{
    const r2=await fetch(`${baseUrl}?select=${fallbackSelect}&limit=5000`,{headers:HDR});
    if(!r2.ok)return[];
    const rows2=await r2.json();
    return Array.isArray(rows2)?rows2:[];
  }catch(e){console.warn('fetchSafe(fallback) failed:',e);return[];}
}

/* ═══ COST SUMMARY (เดือน/ปี/ทั้งหมด) ═══
   ลอง select=* ก่อนเพื่อได้คอลัมน์ "รายละเอียดการแก้ไข" ที่ไม่รู้ชื่อจริง — ถ้าพัง fallback กลับไปใช้คอลัมน์เดิมที่รู้ว่าใช้ได้ */
async function loadAllServices(){
  allServices=await fetchSafe(SVC,'ticket_no,repair_cost,received_date,finish_date,work_hours');
}
const RESOLUTION_FIELD_CANDIDATES=['solution','fix_detail','resolution','resolution_detail','repair_detail','repair_note','work_detail','work_note','fix_note','solution_detail','note','description','result_detail'];
function resolutionOf(row){return pickField(row,RESOLUTION_FIELD_CANDIDATES);}
function costDateOf(row){
  return row.finish_date||row.received_date||null;
}
function setCostTab(tab,btn){
  costTab=tab;
  document.querySelectorAll('.log-filter-btn[data-cost]').forEach(b=>b.classList.toggle('active',b.dataset.cost===tab));
  buildCostSummary();
}
function buildCostSummary(){
  const el=document.getElementById('cs-total');
  const subEl=document.getElementById('cs-sub');
  const countEl=document.getElementById('cs-count');
  const listEl=document.getElementById('cs-list');
  if(!el)return;
  if(!Array.isArray(allServices)){
    el.textContent='กำลังโหลด...';
    return;
  }
  let rows=allServices.filter(r=>r.repair_cost!=null&&costDateOf(r));
  let label='';
  if(costTab==='month'){
    const ref=getFilterYearMonth();
    rows=rows.filter(r=>{const d=new Date(costDateOf(r));return d.getFullYear()===ref.y&&d.getMonth()===ref.m;});
    label=new Date(ref.y,ref.m,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});
  }else if(costTab==='year'){
    const ref=getFilterYearMonth();
    rows=rows.filter(r=>new Date(costDateOf(r)).getFullYear()===ref.y);
    label=`ปี ${ref.y+543}`;
  }else if(costTab==='filtered'){
    const range=getFilterRange();
    rows=rows.filter(r=>inRange(costDateOf(r),range));
    label=`ตามตัวกรอง: ${range.label}`;
  }else{
    label='ตั้งแต่เริ่มใช้งานระบบ';
  }
  const total=rows.reduce((a,b)=>a+(parseFloat(b.repair_cost)||0),0);
  const count=rows.length;
  const caseCount=new Set(rows.map(r=>r.ticket_no)).size; // เคสที่ไม่ซ้ำ (บางเคสอาจมีค่าใช้จ่ายหลายรายการ)
  el.textContent=total.toLocaleString('th-TH',{maximumFractionDigits:0});
  subEl.textContent=label;
  countEl.textContent=caseCount.toLocaleString('th-TH');
  const noteEl=document.getElementById('cs-count-note');
  if(noteEl)noteEl.textContent=count!==caseCount?`(${count.toLocaleString('th-TH')} รายการ — บางเคสมีค่าใช้จ่ายมากกว่า 1 รายการ)`:'';

  if(!listEl)return;
  if(!rows.length){
    listEl.innerHTML='<div style="text-align:center;color:var(--mute);padding:14px;font-size:12px;">ไม่มีรายการค่าใช้จ่ายในช่วงนี้</div>';
    return;
  }
  const sorted=[...rows].sort((a,b)=>new Date(costDateOf(b))-new Date(costDateOf(a)));
  listEl.innerHTML=sorted.map((r,i)=>{
    const t=allTickets.find(x=>x.ticket_no===r.ticket_no);
    const dept=t?t.department:null;
    const jobRaw=t?t.issue_detail:null;
    const job=jobRaw?(jobRaw.slice(0,40)+(jobRaw.length>40?'…':'')):'—';
    const rid=`cs-row-${i}`;
    const dupCount=rows.filter(x=>x.ticket_no===r.ticket_no).length;
    return`<div class="cs-item" style="border-bottom:1px solid var(--field);">
      <div onclick="toggleCsDetail('${rid}')" style="display:grid;grid-template-columns:90px 1fr 1fr 90px 100px;gap:8px;padding:9px 10px;font-size:12px;cursor:pointer;align-items:center;" onmouseover="this.style.background='var(--field)'" onmouseout="this.style.background=''">
        <span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(r.ticket_no)}${dupCount>1?` <span style="color:var(--amber);font-weight:700;" title="เคสนี้มีค่าใช้จ่ายหลายรายการ">×${dupCount}</span>`:''}</span>
        <span style="color:var(--sub);">${esc(dept||'—')}</span>
        <span style="color:var(--sub);">${esc(job)}</span>
        <span style="color:var(--mute);">${fmtD(costDateOf(r))}</span>
        <span style="text-align:right;font-weight:700;color:var(--ink);">${(parseFloat(r.repair_cost)||0).toLocaleString('th-TH',{maximumFractionDigits:0})}</span>
      </div>
      <div id="${rid}" style="display:none;padding:4px 14px 12px 14px;font-size:11.5px;color:var(--sub);background:var(--field);">
        <div><b>ผู้แจ้ง:</b> ${esc(t?t.requester_name:null)||'—'}</div>
        <div style="margin-top:2px;"><b>ปัญหาเต็ม:</b> ${esc(jobRaw)||'—'}</div>
        <div style="margin-top:2px;"><b>สถานะปัจจุบัน:</b> ${t?buildStatusBadge(t.status):'—'}</div>
        <div style="margin-top:2px;"><b>รับเรื่อง:</b> ${fmtD(r.received_date)} &nbsp; <b>เสร็จ/ปิดงาน:</b> ${fmtD(r.finish_date)}</div>
        ${r.work_hours!=null?`<div style="margin-top:2px;"><b>ชั่วโมงที่ใช้:</b> ${esc(r.work_hours)}</div>`:''}
        <div style="margin-top:2px;"><b>การแก้ไขปัญหา:</b> ${esc(r.action_detail)||'—'}</div>
        ${dupCount>1?`<div style="margin-top:2px;color:var(--amber);"><b>หมายเหตุ:</b> เคสนี้มีรายการค่าใช้จ่าย ${dupCount} รายการรวมอยู่ในยอดรวม</div>`:''}
      </div>
    </div>`;
  }).join('');
}
function toggleCsDetail(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

async function fetchTickets(){
  try{
    const r=await fetch(`${API}?order=request_date.desc&limit=500`,{headers:HDR});
    if(!r.ok){const e=await r.text();throw new Error(`HTTP ${r.status}: ${e}`);}
    const d=await r.json();
    if(!Array.isArray(d))throw new Error(d.message||d.hint||'โหลดไม่สำเร็จ');
    allTickets=d;
    /* เติม option แผนกจากข้อมูลจริง */
    const dsel=document.getElementById('dash-dept');
    const cur=dsel.value;
    const depts=[...new Set(d.map(t=>t.department).filter(Boolean))].sort();
    dsel.innerHTML='<option value="">ทุกแผนก</option>'+depts.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    dsel.value=cur;
  }catch(e){
    console.error('fetchTickets error:',e);
    showToast('❌ โหลดข้อมูลไม่สำเร็จ: '+e.message,'err');
  }
}

/* ═══ BOUNCE-BACK ═══ */
async function loadBounceMap(){
  try{
    const r=await fetch(`${LOG}?select=ticket_no,step_name,status,comment,action_by,created_at&order=created_at.desc&limit=3000`,{headers:HDR});
    if(!r.ok)return;
    const rows=await r.json();
    const map={};
    if(Array.isArray(rows))for(const row of rows){if(row.ticket_no&&!map[row.ticket_no])map[row.ticket_no]=row;}
    bounceMap=map;
  }catch(e){console.warn('loadBounceMap:',e);}
}
function isBouncedTicket(t){
  const latest=bounceMap[t.ticket_no];
  return !!(latest&&t.status==='ICO_WORK'&&latest.status==='BACK_TO_ICO');
}
function countBounced(){return allTickets.filter(isBouncedTicket).length;}

/* select=* เพราะไม่รู้ชื่อคอลัมน์คอมเม้น/ชื่อผู้ประเมินที่แท้จริงในตาราง ticket_survey —
   ดึงมาทั้งหมดแล้วค่อยเดาชื่อฟิลด์ตอนแสดงผล (ดู pickField ด้านบน) แจ้งชื่อคอลัมน์จริงมาได้ถ้าต้องการให้ตรงเป๊ะ */
const SURVEY_COMMENT_FIELD_CANDIDATES=['comment','comments','feedback','note','remark','opinion','suggestion'];
const SURVEY_EVALUATOR_FIELD_CANDIDATES=['evaluator_name','rater_name','respondent_name','reviewer_name','name'];
function surveyCommentOf(row){return pickField(row,SURVEY_COMMENT_FIELD_CANDIDATES);}
function surveyEvaluatorOf(row,ticket){
  // เอาชื่อผู้แจ้ง (จากตั๋วจริง) เป็นหลักก่อน เพราะแบบประเมินมักผูกกับผู้แจ้งตั๋วนั้นๆ
  return (ticket&&ticket.requester_name)||pickField(row,SURVEY_EVALUATOR_FIELD_CANDIDATES);
}
async function loadSurveySet(){
  let rows=null;
  try{
    const r=await fetch(`${SURV}?select=*&order=created_at.desc&limit=2000`,{headers:HDR});
    if(r.ok){const d=await r.json();if(Array.isArray(d))rows=d;}
  }catch(e){console.warn('loadSurveySet(*) failed, falling back:',e);}
  if(!rows){
    try{
      const r2=await fetch(`${SURV}?select=ticket_no,score_total,score_q1,score_q2,score_q3,score_q4,score_q5,created_at&order=created_at.desc&limit=2000`,{headers:HDR});
      if(r2.ok){const d2=await r2.json();rows=Array.isArray(d2)?d2:[];}else{rows=[];}
    }catch(e){console.warn('loadSurveySet(fallback) failed:',e);rows=[];}
  }
  surveySet=new Set();surveyMeta={};
  rows.forEach(row=>{
    if(!row.ticket_no)return;
    surveySet.add(row.ticket_no);
    if(!surveyMeta[row.ticket_no])surveyMeta[row.ticket_no]=row; // แถวแรก = ล่าสุด (order created_at.desc)
  });
}

/* เรียกฟังก์ชัน widget แบบกันพัง: ถ้าตัวไหน throw error จะไม่ทำให้ widget ตัวถัดไปที่เรียกต่อกันใน
   buildDashboard() หยุดทำงานไปด้วย (นี่คือสาเหตุของบั๊กที่เจอซ้ำมาแล้ว — ฟังก์ชันหนึ่งพังแล้วลากตัวหลังพังหมด) */
function safeCall(fn,...args){
  try{fn(...args);}catch(e){console.warn((fn&&fn.name)||'widget',':',e);}
}

/* ═══ DASHBOARD ═══ */
function buildDashboard(){
  const range=getFilterRange();
  const dept=document.getElementById('dash-dept').value;
  const cat=document.getElementById('dash-cat').value;
  let data=allTickets;
  if(range.from||range.to){
    data=data.filter(t=>inRange(t.request_date,range));
  }
  if(dept)data=data.filter(t=>t.department===dept);
  /* ข้อมูลสำหรับกราฟ "ประเภทงาน" ต้องไม่ถูกกรองด้วยตัวกรองประเภทงานเอง
     (มิเช่นนั้นเลือกฟิลเตอร์ประเภทใดประเภทหนึ่งแล้วกราฟจะเหลือแท่งเดียว นับผิดเพี้ยนไปหมด)
     — ยังคงเคารพช่วงวันที่/แผนกตามปกติ */
  const dataForCatChart=data;
  if(cat)data=data.filter(t=>t.job_category===cat);
  document.getElementById('dash-period-label').textContent=`(${range.label})`;
  safeCall(renderRangeSummary,data,range,dept,cat);

  const s=k=>data.filter(t=>t.status===k).length;
  document.getElementById('k-open').textContent=s('OPEN')+s('MGR_WAIT');
  document.getElementById('k-ico').textContent=s('ICO_WORK');
  document.getElementById('k-itl').textContent=s('ITL_WAIT');
  document.getElementById('k-itm').textContent=s('ITM_WAIT');
  document.getElementById('k-final').textContent=s('ICO_FINAL');
  document.getElementById('k-done').textContent=s('DONE');

  const bounceCount=countBounced();
  document.getElementById('k-bounce').textContent=bounceCount;
  const bb=document.getElementById('w-bounceBanner');
  if(bb&&widgetPrefs.bounceBanner!==false){
    bb.style.display=bounceCount>0?'flex':'none';
    document.getElementById('bounceBannerCount').textContent=`${bounceCount} รายการถูกตีกลับมา`;
  }
  const finalCount=s('ICO_FINAL');
  const fb=document.getElementById('w-finalBanner');
  if(fb&&widgetPrefs.finalBanner!==false){
    fb.style.display=finalCount>0?'flex':'none';
    document.getElementById('finalBannerCount').textContent=`${finalCount} รายการรอปิดงาน`;
  }

  /* ใหม่: ภาพรวมทั้งระบบ (ไม่ขึ้นกับตัวกรอง) */
  safeCall(buildOverviewTotals);

  safeCall(buildStatusChart,data);
  safeCall(buildCatChart,dataForCatChart);
  safeCall(buildMonthChart);

  /* ใหม่: ตารางสรุปรายเดือน */
  safeCall(buildMonthlyBreakdown);

  safeCall(buildDeptTable,data,range);
  safeCall(buildRecentQueue,data,range);

  /* ความพึงพอใจ: คิดจากตั๋วที่อยู่ใน "data" (ตามตัวกรองบนสุด — เดือน/ช่วงวันที่/แผนก/ประเภทงาน)
     แล้วดึงคะแนนของตั๋วนั้นๆ จาก surveyMeta ต่อ ticket_no — ไม่ใช่กรองจากวันที่ประเมิน
     (แก้บั๊ก: ตั๋วเดือน 6 ที่ประเมินไปแล้วไม่เคยขึ้น เพราะเดิมกรองด้วยวันที่ "ประเมิน" ไม่ใช่วันที่ตั๋ว) */
  safeCall(buildSurveyForFilter,data,range);
  safeCall(loadSurveyTracking,data,range);

  /* ใหม่: คะแนนประเมินรวมทั้งหมด */
  safeCall(buildSurveyAllTime);

  safeCall(buildCostSummary);
}

/* ═══ TOTAL + STATUS BREAKDOWN สำหรับช่วง/ตัวกรองที่เลือกอยู่ ═══ */
function renderRangeSummary(data,range,dept,cat){
  const box=document.getElementById('rangeSummary');
  const textEl=document.getElementById('rangeSummaryText');
  const chipsEl=document.getElementById('rangeSummaryChips');
  if(!textEl||!chipsEl||!box)return;
  const s=k=>data.filter(t=>t.status===k).length;
  /* รวมทุกสถานะที่เป็นไปได้ (รวม REJECTED ที่เคยตกหล่น) เพื่อให้ผลรวม = จำนวนเคสทั้งหมดเสมอ */
  const buckets=[
    {label:'OPEN/MGR',     cls:'s-open',   count:s('OPEN')+s('MGR_WAIT')},
    {label:'ICO ดำเนินการ', cls:'s-ico',    count:s('ICO_WORK')},
    {label:'รอ ITL',        cls:'s-itl',    count:s('ITL_WAIT')},
    {label:'รอ IT MGR',     cls:'s-itm',    count:s('ITM_WAIT')},
    {label:'รอปิดงาน',      cls:'s-final',  count:s('ICO_FINAL')},
    {label:'เสร็จสิ้น',      cls:'s-done',   count:s('DONE')},
    {label:'ยกเลิก',        cls:'s-cancel', count:s('CANCELLED')},
    {label:'ถูกปฏิเสธ',      cls:'s-reject', count:s('REJECTED')},
  ];
  let extra='';
  if(dept)extra+=` · แผนก: ${dept}`;
  if(cat)extra+=` · ประเภท: ${cat}`;
  textEl.innerHTML=`ช่วง <b>${esc(range.label)}</b> · รวม <b>${data.length.toLocaleString('th-TH')}</b> เคส${esc(extra)}`;
  chipsEl.innerHTML=data.length
    ?buckets.filter(b=>b.count>0).map(b=>`<span class="status ${b.cls}">${esc(b.label)} ${b.count}</span>`).join('')
    :'';
}

function buildStatusChart(data){
  const labels=['OPEN/MGR','ICO ดำเนินการ','รอ ITL','รอ IT MGR','รอปิดงาน','เสร็จสิ้น','ยกเลิก','ถูกปฏิเสธ'];
  const vals=[
    data.filter(t=>['OPEN','MGR_WAIT'].includes(t.status)).length,
    data.filter(t=>t.status==='ICO_WORK').length,
    data.filter(t=>t.status==='ITL_WAIT').length,
    data.filter(t=>t.status==='ITM_WAIT').length,
    data.filter(t=>t.status==='ICO_FINAL').length,
    data.filter(t=>t.status==='DONE').length,
    data.filter(t=>t.status==='CANCELLED').length,
    data.filter(t=>t.status==='REJECTED').length,
  ];
  const colors=['#3B82F6','#7C3AED','#EA580C','#0891B2','#0F766E','#22C55E','#94A3B8','#DC2626'];
  const total=vals.reduce((a,b)=>a+b,0)||1;
  if(chartS)chartS.destroy();
  chartS=new Chart(document.getElementById('chartStatus'),{
    type:'doughnut',
    data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{
      legend:{position:'right',labels:{font:{size:9},padding:6,boxWidth:10}},
      tooltip:{callbacks:{label:c=>{
        const v=c.parsed;const pct=Math.round(v/total*100);
        return ` ${c.label}: ${v.toLocaleString('th-TH')} เคส (${pct}%)`;
      }}}
    }}
  });
}
function buildCatChart(data){
  const known=['Hardware','Software','Network','อื่นๆ'];
  const norm=v=>(v||'').toString().trim().toLowerCase();
  /* เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่/ช่องว่างส่วนเกินกับ 4 ประเภทที่รู้จัก */
  const knownVals=known.map(c=>data.filter(t=>norm(t.job_category)===norm(c)).length);
  let cats=known, vals=knownVals, colors=['#6366F1','#8B5CF6','#06B6D4','#F59E0B'];
  /* ถ้าไม่มีเคสไหนตรงกับ 4 ประเภทที่รู้จักเลย ทั้งที่มีข้อมูลอยู่ แปลว่าค่าจริงในฐานข้อมูล
     สะกด/ตั้งชื่อไม่เหมือนที่ล็อกไว้ในโค้ด — สลับไปโชว์ค่าจริงที่พบแทน กันกราฟว่างเปล่าลวงตา */
  if(data.length && knownVals.every(v=>v===0)){
    const palette=['#6366F1','#8B5CF6','#06B6D4','#F59E0B','#DC2626','#0891B2','#22C55E'];
    const counts={};
    data.forEach(t=>{const k=(t.job_category||'').toString().trim()||'ไม่ระบุ';counts[k]=(counts[k]||0)+1;});
    const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    cats=entries.map(e=>e[0]);
    vals=entries.map(e=>e[1]);
    /* "ไม่ระบุ" ทำให้เป็นสีเทา แยกจากประเภทงานจริงชัดเจน เพราะมันคือข้อมูลที่ขาดหาย ไม่ใช่ประเภทงาน */
    colors=cats.map((c,i)=>c==='ไม่ระบุ'?'#94A3B8':palette[i%palette.length]);
    console.warn('[chartCat] ค่า job_category ในข้อมูลไม่ตรงกับ Hardware/Software/Network/อื่นๆ ที่ล็อกไว้ ใช้ค่าจริงที่พบแทน:',cats);
  }
  const total=vals.reduce((a,b)=>a+b,0)||1;
  if(chartC)chartC.destroy();
  chartC=new Chart(document.getElementById('chartCat'),{
    type:'bar',
    data:{labels:cats,datasets:[{data:vals,backgroundColor:colors,borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{
      legend:{display:false},
      tooltip:{callbacks:{label:c=>{
        const v=c.parsed.y;const pct=Math.round(v/total*100);
        return ` ${v.toLocaleString('th-TH')} เคส (${pct}%)`;
      }}}
    },scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:9}}},x:{ticks:{font:{size:10}}}}}
  });
}
async function buildMonthChart(){
  try{
    const ref=getFilterYearMonth();
    const yr=ref.y;
    const yrEl=document.getElementById('cm-year');
    if(yrEl)yrEl.textContent=yr+543;
    const r=await fetch(`${API}?request_date=gte.${yr}-01-01&request_date=lt.${yr+1}-01-01&select=request_date,status`,{headers:HDR});
    const data=await r.json();
    const months=Array.from({length:12},()=>({open:0,done:0}));
    data.forEach(t=>{const m=new Date(t.request_date).getMonth();if(m>=0&&m<12){months[m].open++;if(t.status==='DONE')months[m].done++;}});
    const labels=Array.from({length:12},(_,i)=>new Date(yr,i,1).toLocaleDateString('th-TH',{month:'short'}));
    if(chartM)chartM.destroy();
    chartM=new Chart(document.getElementById('chartMonth'),{
      type:'line',
      data:{labels,datasets:[
        {label:'รับแจ้ง',data:months.map(m=>m.open),borderColor:'#3B82F6',backgroundColor:'rgba(59,130,246,.08)',tension:.35,fill:true,pointRadius:3,pointBackgroundColor:'#3B82F6'},
        {label:'เสร็จ',data:months.map(m=>m.done),borderColor:'#22C55E',backgroundColor:'rgba(34,197,94,.06)',tension:.35,fill:true,pointRadius:3,pointBackgroundColor:'#22C55E'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{
        legend:{labels:{font:{size:9},padding:8}},
        tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.y.toLocaleString('th-TH')} เคส`}}
      },scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:9}}}}}
    });
  }catch(e){}
}
function buildDeptTable(data,range){
  const map={};
  data.forEach(t=>{const d=t.department||'ไม่ระบุ';map[d]=(map[d]||0)+1;});
  const total=data.length||1;
  const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  document.getElementById('dept-total').textContent=`${data.length} เคส`;
  const periodEl=document.getElementById('dept-period');
  if(periodEl)periodEl.textContent=range?`(${range.label})`:'';
  const labels=sorted.map(([d])=>d);
  const vals=sorted.map(([,c])=>c);
  const palette=['#3B82F6','#7C3AED','#22C55E','#EA580C','#0891B2','#F59E0B','#DC2626','#0F766E'];
  const colors=labels.map((d,i)=>d==='ไม่ระบุ'?'#94A3B8':palette[i%palette.length]);
  if(chartD)chartD.destroy();
  const canvas=document.getElementById('chartDept');
  if(!canvas)return;
  if(!vals.length){
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }
  chartD=new Chart(canvas,{
    type:'bar',
    data:{labels,datasets:[{data:vals,backgroundColor:colors,borderRadius:6,borderSkipped:false}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{
      legend:{display:false},
      tooltip:{callbacks:{label:c=>{
        const v=c.parsed.x;const pct=Math.round(v/total*100);
        return ` ${v.toLocaleString('th-TH')} เคส (${pct}%)`;
      }}}
    },scales:{x:{beginAtZero:true,ticks:{stepSize:1,font:{size:9}}},y:{ticks:{font:{size:10}}}}}
  });
}
/* ═══ รายการงานตามขั้นตอน (แทนที่ "รายการล่าสุด" เดิม) ═══
   แต่ละแท็บ = กลุ่มสถานะเดียวกับการ์ด KPI ด้านบน กรองด้วยตัวกรองบนสุด (วันที่/แผนก/ประเภทงาน) เหมือนกัน */
function buildRecentQueue(data,range){
  lastFilteredData=data;
  const lbl=document.getElementById('recent-period-label');
  if(lbl)lbl.textContent=range?`(${range.label})`:'';
  Object.keys(STATUS_GROUPS).forEach(k=>{
    const n=data.filter(STATUS_GROUPS[k]).length;
    const el=document.getElementById('rq-n-'+k);
    if(el)el.textContent=`(${n})`;
  });
  renderRecentBody();
}
function setRecentTab(tab,btn){
  recentTab=tab;
  document.querySelectorAll('.log-filter-btn[data-recent]').forEach(b=>b.classList.toggle('active',b.dataset.recent===tab));
  renderRecentBody();
}
function renderRecentBody(){
  const body=document.getElementById('recentBody');
  if(!body)return;
  const filterFn=STATUS_GROUPS[recentTab]||STATUS_GROUPS.open;
  const rows=lastFilteredData.filter(filterFn).sort((a,b)=>new Date(b.request_date||0)-new Date(a.request_date||0));
  if(!rows.length){
    body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ไม่มีรายการในหมวดนี้ตามตัวกรองปัจจุบัน</div>';
    return;
  }
  const shown=rows.slice(0,100);
  body.innerHTML=`<table class="mini-table" style="margin-top:-4px;"><thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th>ปัญหา</th><th>สถานะ</th><th>วันที่</th></tr></thead><tbody>${shown.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    return`<tr>
      <td><span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}</span></td>
      <td>${esc(t.requester_name||'—')}</td>
      <td style="color:var(--sub);">${esc(t.department||'—')}</td>
      <td style="color:var(--sub);">${esc((t.issue_detail||'').slice(0,40))}${(t.issue_detail||'').length>40?'…':''}</td>
      <td>${buildStatusBadge(t.status)}</td>
      <td style="color:var(--mute);">${d}</td>
    </tr>`;
  }).join('')}</tbody></table>${rows.length>100?`<div style="text-align:center;color:var(--mute);font-size:10.5px;padding:8px;">แสดง 100 จาก ${rows.length} รายการ</div>`:''}`;
}
const SURVEY_MAX_Q={1:30,2:30,3:20,4:10,5:10};
const SURVEY_KPI_THRESHOLD=96; // ต่ำกว่านี้ถือว่าไม่ถึง KPI ต้องดูคอมเม้นประกอบ
/* ═══ ความพึงพอใจ (FM-IC-001) — คิดจากตั๋วที่อยู่ใน "data" (ตามตัวกรองบนสุด) โดยจับคู่กับ surveyMeta ด้วย ticket_no
   ทำแบบนี้แทนการกรองจาก created_at ของแบบประเมิน เพราะตั๋วอาจถูกประเมินคนละเดือนกับที่แจ้งเรื่อง ═══ */
function buildSurveyForFilter(data,range){
  const periodEl=document.getElementById('sv-period');
  if(periodEl)periodEl.textContent=range?`(${range.label})`:'';
  const rows=data.filter(t=>surveyMeta[t.ticket_no]).map(t=>surveyMeta[t.ticket_no]);
  if(!rows.length){
    document.getElementById('sv-score').textContent='N/A';
    document.getElementById('sv-count').textContent='0 การประเมิน';
    document.getElementById('sv-grade').textContent='—';
    [1,2,3,4,5].forEach(i=>{
      document.getElementById('sv'+i).style.width='0%';
      document.getElementById('sn'+i).textContent=`0/${SURVEY_MAX_Q[i]}`;
    });
    return;
  }
  const avg=(rows.reduce((a,b)=>a+(b.score_total||0),0)/rows.length).toFixed(1);
  const avgNum=parseFloat(avg);
  document.getElementById('sv-score').textContent=avg;
  document.getElementById('sv-count').textContent=`${rows.length} การประเมิน`;
  const grade=avgNum>=90?'🏆 ดีเยี่ยม':avgNum>=75?'🎯 ดีมาก':avgNum>=60?'👍 ดี':avgNum>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
  const col=avgNum>=75?'#22C55E':avgNum>=50?'#D97706':'#DC2626';
  document.getElementById('sv-grade').textContent=grade;
  document.getElementById('sv-grade').style.color=col;
  document.getElementById('sv-score').style.color=col;
  [1,2,3,4,5].forEach(i=>{
    const avgQ=(rows.reduce((a,b)=>a+(b[`score_q${i}`]||0),0)/rows.length).toFixed(1);
    const pct=(parseFloat(avgQ)/SURVEY_MAX_Q[i])*100;
    const bar=document.getElementById('sv'+i);
    bar.style.width=pct+'%';
    bar.style.background=pct>=75?'#22C55E':pct>=50?'#D97706':'#DC2626';
    document.getElementById('sn'+i).textContent=`${avgQ}/${SURVEY_MAX_Q[i]}`;
  });
}

/* ═══ ติดตามแบบประเมิน — ตอนนี้ฟิวตามตัวกรองบนสุดเหมือนกันแล้ว (เดือน/ช่วงวันที่/แผนก/ประเภทงาน) ═══ */
let svTrackPending=[],svTrackEvaluated=[];
function setSvTrackTab(tab,btn){
  svTrackTab=tab;
  document.querySelectorAll('.log-filter-btn[data-svt]').forEach(b=>b.classList.toggle('active',b.dataset.svt===tab));
  renderSvTrackBody();
}
function loadSurveyTracking(data,range){
  const summary=document.getElementById('sv-track-summary');
  const periodEl=document.getElementById('sv-track-period');
  if(periodEl)periodEl.textContent=range?`(${range.label})`:'';
  const doneTickets=data.filter(t=>t.status==='DONE');
  svTrackEvaluated=doneTickets.filter(t=>surveySet.has(t.ticket_no));
  svTrackPending=doneTickets.filter(t=>!surveySet.has(t.ticket_no))
    .sort((a,b)=>new Date(a.closed_at||a.request_date||0)-new Date(b.closed_at||b.request_date||0));
  if(summary)summary.textContent=doneTickets.length
    ?`✅ ประเมินแล้ว ${svTrackEvaluated.length} ราย · ⏳ รอประเมิน ${svTrackPending.length} ราย`
    :'ไม่มีงานที่ปิดแล้วตามตัวกรองนี้';
  renderSvTrackBody();
}
function renderSvTrackBody(){
  const body=document.getElementById('sv-track-body');
  if(!body)return;
  if(svTrackTab==='done'){
    if(!svTrackEvaluated.length){body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ยังไม่มีงานไหนถูกประเมินเลยตามตัวกรองนี้</div>';return;}
    const sorted=[...svTrackEvaluated].sort((a,b)=>{
      const da=surveyMeta[a.ticket_no]?.created_at||0,db=surveyMeta[b.ticket_no]?.created_at||0;
      return new Date(db)-new Date(da);
    });
    body.innerHTML=sorted.map((t,i)=>{
      const meta=surveyMeta[t.ticket_no]||{};
      const score=meta.score_total!=null?meta.score_total:null;
      const sc=score!=null?(score>=75?'var(--green)':score>=50?'var(--amber)':'var(--red)'):'var(--mute)';
      const belowKpi=score!=null&&score<SURVEY_KPI_THRESHOLD;
      const rid=`svd-${i}`;
      const comment=surveyCommentOf(meta);
      const evaluator=surveyEvaluatorOf(meta,t);
      return`<div class="sv-item" style="border-bottom:1px solid var(--field);${belowKpi?'background:var(--amber-pale);':''}">
        <div onclick="toggleSvDetail('${rid}')" style="display:grid;grid-template-columns:90px 1fr 1fr 70px 130px;gap:8px;padding:9px 10px;font-size:14px;cursor:pointer;align-items:center;" onmouseover="this.style.background='var(--field)'" onmouseout="this.style.background='${belowKpi?'var(--amber-pale)':''}'">
          <span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}${belowKpi?' <span title="คะแนนต่ำกว่า KPI ('+SURVEY_KPI_THRESHOLD+')" style="color:var(--amber);">⚠</span>':''}</span>
          <span>${esc(t.requester_name||'—')}</span>
          <span style="color:var(--sub);">${esc(t.department||'—')}</span>
          <span style="font-weight:700;color:${sc};">${score!=null?score+'/100':'—'}</span>
          <span style="color:var(--mute);">${fmtD(meta.created_at)}</span>
        </div>
        <div id="${rid}" style="display:none;padding:4px 14px 12px 14px;font-size:13px;color:var(--sub);background:${belowKpi?'#FEF3E2':'var(--field)'};">
          <div><b>ผู้ประเมิน:</b> ${esc(evaluator)||'—'}</div>
          <div style="margin-top:4px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:4px 12px;">
            <span>แก้ไขตรงรายการ: <b>${meta.score_q1??'—'}/30</b></span>
            <span>ตรงตามเวลา: <b>${meta.score_q2??'—'}/30</b></span>
            <span>การอธิบาย: <b>${meta.score_q3??'—'}/20</b></span>
            <span>ความสุภาพ: <b>${meta.score_q4??'—'}/10</b></span>
            <span>พึงพอใจรวม: <b>${meta.score_q5??'—'}/10</b></span>
          </div>
          <div style="margin-top:6px;"><b>คอมเม้น:</b> ${esc(comment)||'— ไม่มีคอมเม้น —'}</div>
          ${belowKpi?`<div style="margin-top:4px;color:var(--amber);font-weight:600;">⚠ คะแนนต่ำกว่า KPI (${SURVEY_KPI_THRESHOLD}) — ควรตรวจสอบคอมเม้นประกอบ</div>`:''}
        </div>
      </div>`;
    }).join('');
    return;
  }
  if(!svTrackPending.length){body.innerHTML='<div style="text-align:center;color:var(--green);padding:16px;font-size:12px;">🎉 ประเมินครบทุกรายการตามตัวกรองนี้แล้ว</div>';return;}
  body.innerHTML=`<table class="mini-table"><thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th style="width:150px;">วันที่ปิดงาน</th><th style="width:70px;">ค้างมา</th></tr></thead><tbody>${svTrackPending.map(t=>{
    const closeDate=t.closed_at||t.request_date;
    const days=closeDate?Math.max(0,Math.round((Date.now()-new Date(closeDate))/86400000)):null;
    const dl=days===null?'—':`${days} วัน`;
    const dc=days!==null&&days>=7?'var(--red)':(days!==null&&days>=3?'var(--amber)':'var(--sub)');
    return`<tr><td><span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}</span></td><td>${esc(t.requester_name||'—')}</td><td style="color:var(--sub);">${esc(t.department||'—')}</td><td style="color:var(--mute);">${fmtD(closeDate)}</td><td style="font-weight:700;color:${dc};">${dl}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function toggleSvDetail(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}
function loadMetrics(data){
  const done=data.filter(t=>t.status==='DONE');
  document.getElementById('m-cancel').textContent=data.filter(t=>t.status==='CANCELLED').length;
  const nos=done.slice(0,50).map(t=>`"${t.ticket_no}"`).join(',');
  if(!nos){document.getElementById('m-avg').textContent='—';document.getElementById('m-max').textContent='—';document.getElementById('m-cost').textContent='0';return;}
  fetch(`${SVC}?select=repair_cost,received_date,finish_date,work_hours&ticket_no=in.(${nos})`,{headers:HDR}).then(r=>r.json()).then(rows=>{
    if(!rows.length)return;
    const days=rows.filter(r=>r.received_date&&r.finish_date).map(r=>Math.max(0,Math.round((new Date(r.finish_date)-new Date(r.received_date))/86400000)));
    document.getElementById('m-avg').textContent=days.length?(days.reduce((a,b)=>a+b,0)/days.length).toFixed(1):'—';
    document.getElementById('m-max').textContent=days.length?Math.max(...days):'—';
    const total=rows.reduce((a,b)=>a+(parseFloat(b.repair_cost)||0),0);
    document.getElementById('m-cost').textContent=total?total.toLocaleString('th-TH',{maximumFractionDigits:0}):'0';
  }).catch(()=>{});
}

/* ═══ NEW: ภาพรวมทั้งระบบ (ไม่ขึ้นกับตัวกรอง) ═══ */
function buildOverviewTotals(){
  const el=document.getElementById('w-overviewTotals');
  if(!el)return; // widget ถูกซ่อนหรือยังไม่ render
  try{
    const total=allTickets.length;
    const done=allTickets.filter(t=>t.status==='DONE').length;
    const closedStatuses=['DONE','CANCELLED','REJECTED'];
    const pending=allTickets.filter(t=>!closedStatuses.includes(t.status)).length;
    const unsurveyed=allTickets.filter(t=>t.status==='DONE'&&!surveySet.has(t.ticket_no)).length;

    document.getElementById('ov-total').textContent=total.toLocaleString('th-TH');
    document.getElementById('ov-done').textContent=done.toLocaleString('th-TH');
    document.getElementById('ov-pending').textContent=pending.toLocaleString('th-TH');
    document.getElementById('ov-unsurveyed').textContent=unsurveyed.toLocaleString('th-TH');

    document.getElementById('ov-done-pct').textContent=total?`${Math.round(done/total*100)}%`:'—';
    document.getElementById('ov-pending-pct').textContent=total?`${Math.round(pending/total*100)}%`:'—';
    document.getElementById('ov-unsurveyed-pct').textContent=done?`${Math.round(unsurveyed/done*100)}% ของปิด`:'—';
  }catch(e){
    console.warn('buildOverviewTotals:',e);
  }
}

/* ═══ NEW: คะแนนประเมินรวมทั้งหมด (All-Time) ═══ */
function buildSurveyAllTime(){
  const el=document.getElementById('sv-score-all');
  if(!el)return;
  try{
    const scores=Object.values(surveyMeta).map(m=>m.score_total).filter(v=>v!=null);
    const elC=document.getElementById('sv-count-all'),elG=document.getElementById('sv-grade-all');
    if(!scores.length){el.textContent='N/A';elC.textContent='(0 ราย)';elG.textContent='—';return;}
    const avg=(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
    const avgNum=parseFloat(avg);
    el.textContent=avg;
    elC.textContent=`(${scores.length} ราย)`;
    const grade=avgNum>=90?'🏆 ดีเยี่ยม':avgNum>=75?'🎯 ดีมาก':avgNum>=60?'👍 ดี':avgNum>=50?'😐 พอใช้':'⚠️ ต้องปรับปรุง';
    elG.textContent=grade;
    elG.style.color=avgNum>=75?'#22C55E':avgNum>=50?'#D97706':'#DC2626';
    el.style.color=elG.style.color;
  }catch(e){
    console.warn('buildSurveyAllTime:',e);
  }
}

/* ═══ ตารางสรุปรายเดือน — ฟิวตามตัวกรองด้านบน (ปี + ไฮไลต์เดือนที่อยู่ในช่วงที่เลือก) ═══ */
function buildMonthlyBreakdown(){
  const body=document.getElementById('mb-body');
  if(!body)return;
  try{
    const ref=getFilterYearMonth();
    const yr=ref.y;
    const range=getFilterRange();
    const yrEl=document.getElementById('mb-year');
    if(yrEl)yrEl.textContent=yr+543; // พ.ศ.

    const closedStatuses=['DONE','CANCELLED','REJECTED'];
    const perMonth=Array.from({length:12},()=>({total:0,done:0,pending:0}));
    
    allTickets.forEach(t=>{
      if(!t.request_date)return;
      const d=new Date(t.request_date);
      if(d.getFullYear()!==yr)return;
      const m=d.getMonth();
      perMonth[m].total++;
      if(t.status==='DONE')perMonth[m].done++;
      else if(!closedStatuses.includes(t.status))perMonth[m].pending++;
    });

    const surveyByMonth=Array.from({length:12},()=>[]);
    Object.values(surveyMeta).forEach(row=>{
      if(!row.created_at||row.score_total==null)return;
      const d=new Date(row.created_at);
      if(d.getFullYear()===yr)surveyByMonth[d.getMonth()].push(row.score_total);
    });

    const monthNames=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                      'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    
    body.innerHTML=perMonth.map((m,i)=>{
      const scores=surveyByMonth[i];
      const avgScore=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):'—';
      const isSelected=isMonthInRange(yr,i,range);
      return`<tr style="background:${isSelected?'var(--blue-pale)':''};">
        <td><strong>${monthNames[i]}${isSelected?' ⬤':''}</strong></td>
        <td>${m.total}</td>
        <td style="color:var(--green);font-weight:600;">${m.done}</td>
        <td style="color:${m.pending>0?'var(--orange)':'var(--mute)'};font-weight:600;">${m.pending}</td>
        <td>${avgScore}${avgScore!=='—'?'/100':''}</td>
        <td style="color:var(--mute);">${scores.length}</td>
      </tr>`;
    }).join('');
  }catch(e){
    console.warn('buildMonthlyBreakdown:',e);
    body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--red);padding:12px;">โหลดข้อมูลสรุปรายเดือนไม่สำเร็จ</td></tr>';
  }
}

/* ═══ HELPERS ═══ */
function buildStatusBadge(s){
  const map={
    'OPEN':['s-open','OPEN'],'MGR_WAIT':['s-mgr','รอหัวหน้า'],
    'ICO_WORK':['s-ico','ICO ดำเนินการ'],'ITL_WAIT':['s-itl','รอ ITL'],
    'ITM_WAIT':['s-itm','รอ IT MGR'],'ICO_FINAL':['s-final','รอปิดงาน'],
    'DONE':['s-done','เสร็จสิ้น'],'REJECTED':['s-reject','ถูกตีกลับ'],'CANCELLED':['s-cancel','ยกเลิก'],
  };
  const[cls,label]=map[s]||['s-open',s||'—'];
  return`<span class="status ${cls}">${label}</span>`;
}
function fmtD(s){if(!s)return'—';return new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let toastTimer;
function showToast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast show '+(type||'');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}

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
  {id:'bounceBanner',label:'แบนเนอร์: งานถูกตีกลับ'},
  {id:'finalBanner',  label:'แบนเนอร์: รอปิดงาน'},
  {id:'kpiRow',       label:'การ์ด KPI ทั้งแถว'},
  {id:'kpiOpen',      label:'  ↳ KPI: คำขอใหม่ (OPEN)'},
  {id:'kpiIco',       label:'  ↳ KPI: ICO ดำเนินการ'},
  {id:'kpiBounce',    label:'  ↳ KPI: ถูกตีกลับ'},
  {id:'kpiItl',       label:'  ↳ KPI: รอ ITL'},
  {id:'kpiFinal',     label:'  ↳ KPI: รอปิดงาน'},
  {id:'kpiDone',      label:'  ↳ KPI: เสร็จสิ้น'},
  {id:'chartStatus',  label:'กราฟ: สถานะงาน (โดนัท)'},
  {id:'chartCat',     label:'กราฟ: ประเภทงาน (แท่ง)'},
  {id:'chartMonth',   label:'กราฟ: งานรายเดือน'},
  {id:'deptTable',    label:'ตาราง: งานแยกตามแผนก'},
  {id:'costSummary',  label:'💰 สรุปค่าใช้จ่ายรวม (เดือน/ปี/ทั้งหมด)'},
  {id:'sla',          label:'สรุป SLA เฉลี่ย'},
  {id:'survey',       label:'สรุปคะแนนความพึงพอใจ'},
  {id:'svTrack',      label:'ติดตามแบบประเมิน (ค้าง/เสร็จ)'},
  {id:'recent',       label:'ตาราง: รายการล่าสุด'},
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
function applyWidgetVisibility(){
  WIDGETS.forEach(w=>{
    const el=document.getElementById('w-'+w.id);
    if(el)el.classList.toggle('hidden',widgetPrefs[w.id]===false);
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
let allTickets=[],chartS=null,chartC=null,chartM=null;
let bounceMap={},surveySet=new Set(),surveyMeta={},svTrackTab='pending';
let costTab='month',allServices=null;

/* ═══ BOOT ═══ */
(function(){
  const sel=document.getElementById('dash-month');
  const now=new Date();
  for(let i=0;i<13;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lb=d.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    const o=document.createElement('option');o.value=v;o.textContent=lb;if(i===0)o.selected=true;
    sel.appendChild(o);
  }
  const allOpt=document.createElement('option');allOpt.value='';allOpt.textContent='ทุกช่วงเวลา';
  sel.appendChild(allOpt);
  renderSettingsGrid();
  applyWidgetVisibility();
  refreshAll();
})();

async function refreshAll(){
  await Promise.all([fetchTickets(),loadBounceMap(),loadSurveySet(),loadAllServices()]);
  buildDashboard();
  loadSurveyTracking();
}

/* ═══ COST SUMMARY (เดือน/ปี/ทั้งหมด) ═══ */
async function loadAllServices(){
  try{
    const r=await fetch(`${SVC}?select=ticket_no,repair_cost,received_date,finish_date&limit=5000`,{headers:HDR});
    if(!r.ok){allServices=[];return;}
    const rows=await r.json();
    allServices=Array.isArray(rows)?rows:[];
  }catch(e){console.warn('loadAllServices:',e);allServices=[];}
}
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
  const avgEl=document.getElementById('cs-avg');
  if(!el)return;
  if(!Array.isArray(allServices)){
    el.textContent='กำลังโหลด...';
    return;
  }
  const now=new Date();
  let rows=allServices.filter(r=>r.repair_cost!=null&&costDateOf(r));
  let label='';
  if(costTab==='month'){
    const y=now.getFullYear(),m=now.getMonth();
    rows=rows.filter(r=>{const d=new Date(costDateOf(r));return d.getFullYear()===y&&d.getMonth()===m;});
    label=now.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
  }else if(costTab==='year'){
    const y=now.getFullYear();
    rows=rows.filter(r=>new Date(costDateOf(r)).getFullYear()===y);
    label=`ปี ${y+543}`;
  }else{
    label='ตั้งแต่เริ่มใช้งานระบบ';
  }
  const total=rows.reduce((a,b)=>a+(parseFloat(b.repair_cost)||0),0);
  const count=rows.length;
  const avg=count?total/count:0;
  el.textContent=total.toLocaleString('th-TH',{maximumFractionDigits:0});
  subEl.textContent=label;
  countEl.textContent=count.toLocaleString('th-TH');
  avgEl.textContent=avg?avg.toLocaleString('th-TH',{maximumFractionDigits:0}):'0';
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

async function loadSurveySet(){
  try{
    const r=await fetch(`${SURV}?select=ticket_no,score_total,created_at&order=created_at.desc&limit=2000`,{headers:HDR});
    if(!r.ok)return;
    const rows=await r.json();
    surveySet=new Set();surveyMeta={};
    if(Array.isArray(rows))rows.forEach(row=>{
      if(!row.ticket_no)return;
      surveySet.add(row.ticket_no);
      if(!surveyMeta[row.ticket_no])surveyMeta[row.ticket_no]=row;
    });
  }catch(e){console.warn('loadSurveySet:',e);}
}

/* ═══ DASHBOARD ═══ */
function buildDashboard(){
  const month=document.getElementById('dash-month').value;
  const dept=document.getElementById('dash-dept').value;
  const cat=document.getElementById('dash-cat').value;
  let data=allTickets;
  if(month){
    const[y,m]=month.split('-').map(Number);
    data=data.filter(t=>{if(!t.request_date)return false;const d=new Date(t.request_date);return d.getFullYear()===y&&(d.getMonth()+1)===m;});
  }
  if(dept)data=data.filter(t=>t.department===dept);
  if(cat)data=data.filter(t=>t.job_category===cat);
  document.getElementById('dash-period-label').textContent=month?`(${month})`:'(ทั้งหมด)';

  const s=k=>data.filter(t=>t.status===k).length;
  document.getElementById('k-open').textContent=s('OPEN')+s('MGR_WAIT');
  document.getElementById('k-ico').textContent=s('ICO_WORK');
  document.getElementById('k-itl').textContent=s('ITL_WAIT');
  document.getElementById('k-final').textContent=s('ICO_FINAL')+s('ITM_WAIT');
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

  buildStatusChart(data);
  buildCatChart(data);
  buildMonthChart();
  buildDeptTable(data);
  buildRecent(data);
  loadSurvey(month);
  loadMetrics(data);
  buildCostSummary();
}

function buildStatusChart(data){
  const labels=['OPEN/MGR','ICO ดำเนินการ','รอ ITL','รอ IT MGR','รอปิดงาน','เสร็จสิ้น','ยกเลิก'];
  const vals=[
    data.filter(t=>['OPEN','MGR_WAIT'].includes(t.status)).length,
    data.filter(t=>t.status==='ICO_WORK').length,
    data.filter(t=>t.status==='ITL_WAIT').length,
    data.filter(t=>t.status==='ITM_WAIT').length,
    data.filter(t=>t.status==='ICO_FINAL').length,
    data.filter(t=>t.status==='DONE').length,
    data.filter(t=>t.status==='CANCELLED').length,
  ];
  const colors=['#3B82F6','#7C3AED','#EA580C','#0891B2','#0F766E','#22C55E','#94A3B8'];
  if(chartS)chartS.destroy();
  chartS=new Chart(document.getElementById('chartStatus'),{
    type:'doughnut',
    data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'right',labels:{font:{size:9},padding:6,boxWidth:10}}}}
  });
}
function buildCatChart(data){
  const cats=['Hardware','Software','Network','Other'];
  const vals=cats.map(c=>data.filter(t=>t.job_category===c).length);
  if(chartC)chartC.destroy();
  chartC=new Chart(document.getElementById('chartCat'),{
    type:'bar',
    data:{labels:cats,datasets:[{data:vals,backgroundColor:['#3B82F6','#7C3AED','#0F766E','#F59E0B'],borderRadius:5,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:9}}},x:{ticks:{font:{size:10}}}}}
  });
}
async function buildMonthChart(){
  try{
    const yr=new Date().getFullYear();
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
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:9},padding:8}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:9}}}}}
    });
  }catch(e){}
}
function buildDeptTable(data){
  const map={};
  data.forEach(t=>{const d=t.department||'ไม่ระบุ';map[d]=(map[d]||0)+1;});
  const total=data.length||1;
  const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  document.getElementById('dept-total').textContent=`${data.length} เคส`;
  document.getElementById('deptBody').innerHTML=sorted.length?sorted.map(([d,c])=>{
    const p=Math.round(c/total*100);
    return`<tr><td>${esc(d)}</td><td style="font-family:'Inter',sans-serif;font-weight:600;">${c}</td><td><div class="bar-wrap"><div class="bar-bg"><div class="bar-fill" style="width:${p}%"></div></div><span class="bar-pct">${p}%</span></div></td></tr>`;
  }).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--mute);padding:12px;">ไม่มีข้อมูล</td></tr>';
}
function buildRecent(data){
  const rows=data.slice(0,10);
  document.getElementById('recentBody').innerHTML=rows.length?rows.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    return`<tr>
      <td><span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}</span></td>
      <td>${esc(t.requester_name||'—')}</td>
      <td style="color:var(--sub);">${esc(t.department||'—')}</td>
      <td style="color:var(--sub);">${esc((t.issue_detail||'').slice(0,40))}${(t.issue_detail||'').length>40?'…':''}</td>
      <td>${buildStatusBadge(t.status)}</td>
      <td style="color:var(--mute);">${d}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--mute);padding:16px;">ไม่มีข้อมูล</td></tr>';
}
async function loadSurvey(month){
  try{
    let url=`${SURV}?select=score_total,score_q1,score_q2,score_q3,score_q4,score_q5&limit=200&order=created_at.desc`;
    if(month)url+=`&created_at=gte.${month}-01T00:00:00`;
    const r=await fetch(url,{headers:HDR});
    const data=await r.json();
    const maxQ={1:30,2:30,3:20,4:10,5:10};
    if(!Array.isArray(data)||!data.length){
      document.getElementById('sv-score').textContent='N/A';
      document.getElementById('sv-count').textContent='0 การประเมิน';
      document.getElementById('sv-grade').textContent='—';
      [1,2,3,4,5].forEach(i=>{
        document.getElementById('sv'+i).style.width='0%';
        document.getElementById('sn'+i).textContent=`0/${maxQ[i]}`;
      });
      return;
    }
    const avg=(data.reduce((a,b)=>a+(b.score_total||0),0)/data.length).toFixed(1);
    const avgNum=parseFloat(avg);
    document.getElementById('sv-score').textContent=avg;
    document.getElementById('sv-count').textContent=`${data.length} การประเมิน`;
    const grade=avgNum>=90?'🏆 ดีเยี่ยม':avgNum>=75?'🎯 ดีมาก':avgNum>=60?'👍 ดี':avgNum>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
    const col=avgNum>=75?'#22C55E':avgNum>=50?'#D97706':'#DC2626';
    document.getElementById('sv-grade').textContent=grade;
    document.getElementById('sv-grade').style.color=col;
    document.getElementById('sv-score').style.color=col;
    [1,2,3,4,5].forEach(i=>{
      const avgQ=(data.reduce((a,b)=>a+(b[`score_q${i}`]||0),0)/data.length).toFixed(1);
      const pct=(parseFloat(avgQ)/maxQ[i])*100;
      const bar=document.getElementById('sv'+i);
      bar.style.width=pct+'%';
      bar.style.background=pct>=75?'#22C55E':pct>=50?'#D97706':'#DC2626';
      document.getElementById('sn'+i).textContent=`${avgQ}/${maxQ[i]}`;
    });
  }catch(e){console.warn('loadSurvey:',e);}
}
function setSvTrackTab(tab,btn){
  svTrackTab=tab;
  document.querySelectorAll('.log-filter-btn[data-svt]').forEach(b=>b.classList.toggle('active',b.dataset.svt===tab));
  loadSurveyTracking();
}
async function loadSurveyTracking(){
  const body=document.getElementById('sv-track-body');
  const summary=document.getElementById('sv-track-summary');
  try{
    const doneTickets=allTickets.filter(t=>t.status==='DONE');
    if(!doneTickets.length){
      summary.textContent='ยังไม่มีงานที่ปิดแล้ว';
      body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ยังไม่มีงานที่ปิดแล้ว</div>';
      return;
    }
    const evaluated=doneTickets.filter(t=>surveySet.has(t.ticket_no));
    const pending=doneTickets.filter(t=>!surveySet.has(t.ticket_no))
      .sort((a,b)=>new Date(a.closed_at||a.request_date||0)-new Date(b.closed_at||b.request_date||0));
    summary.textContent=`✅ ประเมินแล้ว ${evaluated.length} ราย · ⏳ รอประเมิน ${pending.length} ราย`;

    if(svTrackTab==='done'){
      if(!evaluated.length){body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ยังไม่มีงานไหนถูกประเมินเลย</div>';return;}
      const sorted=[...evaluated].sort((a,b)=>{
        const da=surveyMeta[a.ticket_no]?.created_at||0,db=surveyMeta[b.ticket_no]?.created_at||0;
        return new Date(db)-new Date(da);
      });
      body.innerHTML=`<table class="mini-table"><thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th style="width:80px;">คะแนน</th><th style="width:150px;">ประเมินเมื่อ</th></tr></thead><tbody>${sorted.map(t=>{
        const meta=surveyMeta[t.ticket_no];
        const score=meta&&meta.score_total!=null?meta.score_total:'—';
        const sc=score!=='—'?(score>=75?'var(--green)':score>=50?'var(--amber)':'var(--red)'):'var(--mute)';
        return`<tr><td><span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}</span></td><td>${esc(t.requester_name||'—')}</td><td style="color:var(--sub);">${esc(t.department||'—')}</td><td style="font-weight:700;color:${sc};">${score}${score!=='—'?'/100':''}</td><td style="color:var(--mute);">${fmtD(meta?meta.created_at:null)}</td></tr>`;
      }).join('')}</tbody></table>`;
      return;
    }
    if(!pending.length){body.innerHTML='<div style="text-align:center;color:var(--green);padding:16px;font-size:12px;">🎉 ประเมินครบทุกรายการแล้ว</div>';return;}
    body.innerHTML=`<table class="mini-table"><thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th style="width:150px;">วันที่ปิดงาน</th><th style="width:70px;">ค้างมา</th></tr></thead><tbody>${pending.map(t=>{
      const closeDate=t.closed_at||t.request_date;
      const days=closeDate?Math.max(0,Math.round((Date.now()-new Date(closeDate))/86400000)):null;
      const dl=days===null?'—':`${days} วัน`;
      const dc=days!==null&&days>=7?'var(--red)':(days!==null&&days>=3?'var(--amber)':'var(--sub)');
      return`<tr><td><span style="font-family:'Inter',sans-serif;font-weight:600;">${esc(t.ticket_no)}</span></td><td>${esc(t.requester_name||'—')}</td><td style="color:var(--sub);">${esc(t.department||'—')}</td><td style="color:var(--mute);">${fmtD(closeDate)}</td><td style="font-weight:700;color:${dc};">${dl}</td></tr>`;
    }).join('')}</tbody></table>`;
  }catch(e){
    console.warn('loadSurveyTracking:',e);
    summary.textContent='โหลดข้อมูลไม่สำเร็จ';
    body.innerHTML='<div style="text-align:center;color:var(--red);padding:16px;font-size:11.5px;">โหลดข้อมูลติดตามแบบประเมินไม่สำเร็จ</div>';
  }
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
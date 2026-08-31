
/* ═══ CONFIG ═══ */
const SB     = "https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const HDR    = {'apikey':KEY,'Authorization':'Bearer '+KEY};
const API    = `${SB}/rest/v1/tickets`;
const SVC    = `${SB}/rest/v1/ticket_services`;
const LOG    = `${SB}/rest/v1/tickets_log`;
const SURV   = `${SB}/rest/v1/ticket_survey`;
const STORE  = `${SB}/storage/v1/object/ticket-files`;
const PUB    = `${SB}/storage/v1/object/public/ticket-files`;

/* ═══ STATE ═══ */
let allTickets=[], currentTicket=null, currentSvc=null;
let sortField='request_date', sortAsc=false;
let icoFiles=[];
let chartS=null, chartC=null, chartM=null;
let bounceMap={};        // ticket_no -> ล่าสุด (แถว log ล่าสุดของแต่ละ ticket)
let surveySet=new Set(); // ticket_no ที่มีแบบประเมินแล้ว
let surveyMeta={};       // ticket_no -> {score_total, created_at} สำหรับแสดงสรุปแบบเร็วๆ โดยไม่ต้อง fetch ซ้ำ
let bounceOnly=false;    // true = กำลังกรองเฉพาะงานที่ถูกตีกลับ (ในหน้ารายการ)
let svTrackTab='pending';// แท็บที่กำลังดูใน "ติดตามแบบประเมิน" ของ Dashboard: pending | done

/* ═══ BOOT ═══ */
(function(){
  // month selector
  const sel=document.getElementById('dash-month');
  const now=new Date();
  for(let i=0;i<13;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const v=i===0?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lb=i===0?'เดือนนี้':d.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
    const o=document.createElement('option');o.value=v;o.textContent=lb;if(i===0)o.selected=true;
    sel.appendChild(o);
  }
  document.getElementById('searchInput').addEventListener('input',renderTable);
  document.getElementById('statusFilter').addEventListener('change',()=>{bounceOnly=false;document.getElementById('list-title').textContent='คำขอทั้งหมด';renderTable();});
  document.getElementById('catFilter').addEventListener('change',renderTable);
  refreshAll();
})();

async function refreshAll(){
  await Promise.all([fetchTickets(),loadBounceMap(),loadSurveySet()]);
  updateSBBadges(allTickets);
  buildDashboard();
  renderTable();          // เดิมไม่มีบรรทัดนี้ — ตอนอยู่หน้า "รายการ" แล้วกดรีเฟรช ตารางจะไม่ถูกวาดใหม่เลย (บั๊กที่ทำให้กดแล้วไม่มีอะไรเปลี่ยน)
  loadSurveyTracking();
}

async function fetchTickets(){
  try{
    const r=await fetch(`${API}?order=request_date.desc&limit=500`,{headers:HDR});
    if(!r.ok){const e=await r.text();throw new Error(`HTTP ${r.status}: ${e}`);}
    const d=await r.json();
    if(!Array.isArray(d))throw new Error(d.message||d.hint||'โหลดไม่สำเร็จ');
    allTickets=d;
    /* debug: แสดงจำนวน status ต่างๆ */
    const statusCounts={};
    d.forEach(t=>{statusCounts[t.status]=(statusCounts[t.status]||0)+1;});
    console.log('[ICO] tickets loaded:',d.length,'| statuses:',statusCounts);
  }catch(e){
    console.error('[ICO] fetchTickets error:',e);
    showToast('❌ โหลดไม่สำเร็จ: '+e.message,'err');
  }
}

/* ═══ BOUNCE-BACK TRACKING ═══
   ดึง log ล่าสุดของแต่ละ ticket (order=desc แล้วเก็บแถวแรกที่เจอต่อ ticket_no)
   เพื่อรู้ว่า ticket ไหนที่สถานะปัจจุบันเกิดจากการ "ตีกลับ" (BACK_TO_ICO) ล่าสุด
   — ถ้าหลังจากนั้น ICO ส่งงานต่อใหม่แล้ว (มี log ใหม่กว่าเข้ามาแทน) จะไม่ถูกนับว่าตีกลับอีกต่อไป */
async function loadBounceMap(){
  try{
    const r=await fetch(`${LOG}?select=ticket_no,step_name,status,comment,action_by,created_at&order=created_at.desc&limit=3000`,{headers:HDR});
    if(!r.ok){console.warn('[ICO] loadBounceMap HTTP',r.status);return;}
    const rows=await r.json();
    const map={};
    if(Array.isArray(rows)){
      for(const row of rows){
        if(row.ticket_no && !map[row.ticket_no]) map[row.ticket_no]=row; // แถวแรกที่เจอ = ล่าสุดสุด (เพราะ order desc)
      }
    }
    bounceMap=map;
  }catch(e){console.warn('[ICO] loadBounceMap error:',e);}
}
/* ticket ถือว่า "ถูกตีกลับ ยังไม่แก้ไข" เมื่อ log ล่าสุดของ ticket นั้นคือ BACK_TO_ICO
   และสถานะปัจจุบันของ ticket ยังเป็น ICO_WORK (ยังไม่ถูกส่งต่อใหม่) */
function isBouncedTicket(t){
  const latest=bounceMap[t.ticket_no];
  return !!(latest && t.status==='ICO_WORK' && latest.status==='BACK_TO_ICO');
}
function countBounced(){return allTickets.filter(isBouncedTicket).length;}

/* ═══ SURVEY SET (bulk) — ใช้ร่วมกันทั้งตารางรายการและ dashboard tracking ═══ */
async function loadSurveySet(){
  try{
    const r=await fetch(`${SURV}?select=ticket_no,score_total,created_at&order=created_at.desc&limit=2000`,{headers:HDR});
    if(!r.ok){console.warn('[ICO] loadSurveySet HTTP',r.status);return;}
    const rows=await r.json();
    surveySet=new Set();
    surveyMeta={};
    if(Array.isArray(rows)){
      rows.forEach(row=>{
        if(!row.ticket_no)return;
        surveySet.add(row.ticket_no);
        if(!surveyMeta[row.ticket_no]) surveyMeta[row.ticket_no]=row; // แถวแรก = ล่าสุด (order desc) เผื่อมีประเมินซ้ำ
      });
    }
  }catch(e){console.warn('[ICO] loadSurveySet error:',e);}
}

function setBounceFilter(){
  bounceOnly=true;
  document.getElementById('statusFilter').value='ICO_WORK';
  document.getElementById('list-title').textContent='งานที่ถูกตีกลับ — ต้องแก้ไข';
  renderTable();
}

function updateSBBadges(data){
  const s=k=>data.filter(t=>t.status===k).length;
  document.getElementById('sb-all').textContent=data.length;
  document.getElementById('sb-ico').textContent=s('ICO_WORK')+s('MGR_WAIT')+s('OPEN');
  const finalCount=s('ICO_FINAL');
  document.getElementById('sb-final').textContent=finalCount;
  /* show/hide banner */
  const banner=document.getElementById('finalBanner');
  if(banner){
    banner.style.display=finalCount>0?'flex':'none';
    const bc=document.getElementById('finalBannerCount');
    if(bc)bc.textContent=`${finalCount} รายการรอปิดงาน — คลิกเพื่อดู`;
  }
  /* bounce badges/banner */
  const bounceCount=countBounced();
  const sbBounceItem=document.getElementById('sb-bounce-item');
  const sbBounce=document.getElementById('sb-bounce');
  if(sbBounce)sbBounce.textContent=bounceCount;
  if(sbBounceItem)sbBounceItem.style.display=bounceCount>0?'flex':'none';
  const kBounce=document.getElementById('k-bounce');
  if(kBounce)kBounce.textContent=bounceCount;
  const kpiCard=document.getElementById('kpi-bounce-card');
  if(kpiCard)kpiCard.classList.toggle('has-alert',bounceCount>0);
  const dashBanner=document.getElementById('bounceDashBanner');
  if(dashBanner){
    dashBanner.style.display=bounceCount>0?'flex':'none';
    const bc2=document.getElementById('bounceDashBannerCount');
    if(bc2)bc2.textContent=`${bounceCount} รายการถูกตีกลับมา — คลิกเพื่อดู`;
  }
}

/* ═══ DASHBOARD ═══ */
function buildDashboard(){
  /* ถ้า dashboard view ไม่ active ให้ skip เพื่อไม่ให้ lag */
  const dashView=document.getElementById('view-dashboard');
  if(!dashView||!dashView.classList.contains('active')) return;
  const month=document.getElementById('dash-month').value;
  const cat=document.getElementById('dash-cat').value;
  let data=allTickets;
  if(month){
    const [y,m]=month.split('-').map(Number);
    data=data.filter(t=>{if(!t.request_date)return false;const d=new Date(t.request_date);return d.getFullYear()===y&&(d.getMonth()+1)===m;});
  }
  if(cat) data=data.filter(t=>t.job_category===cat);
  document.getElementById('dash-period-label').textContent=month?`(${month})`:'(ทั้งหมด)';
  // KPI
  const s=k=>data.filter(t=>t.status===k).length;
  document.getElementById('k-open').textContent=s('OPEN')+s('MGR_WAIT');
  document.getElementById('k-ico').textContent=s('ICO_WORK');
  document.getElementById('k-itl').textContent=s('ITL_WAIT');
  document.getElementById('k-final').textContent=s('ICO_FINAL')+s('ITM_WAIT');
  document.getElementById('k-done').textContent=s('DONE');
  buildStatusChart(data);
  buildCatChart(data);
  buildMonthChart();
  buildDeptTable(data);
  buildRecent(data);
  loadSurvey(month);
  loadMetrics(data);
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
    const months=Array.from({length:12},(_,i)=>({open:0,done:0}));
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
  const sb=buildStatusBadge;
  document.getElementById('recentBody').innerHTML=rows.length?rows.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    return`<tr onclick="openModal('${esc(t.ticket_no)}')" style="cursor:pointer;" onmouseover="this.style.background='#F8FAFE'" onmouseout="this.style.background=''">
      <td><span class="td-no">${esc(t.ticket_no)}</span></td>
      <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
      <td class="td-sub">${esc(t.department||'—')}</td>
      <td class="td-sub">${esc((t.issue_detail||'').slice(0,40))}${(t.issue_detail||'').length>40?'…':''}</td>
      <td>${sb(t.status)}</td>
      <td class="td-date">${d}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--mute);padding:16px;">ไม่มีข้อมูล</td></tr>';
}

async function loadSurvey(month){
  try{
    let url=`${SURV}?select=score_total,score_q1,score_q2,score_q3,score_q4,score_q5,chk_resolved,chk_explained&limit=200&order=created_at.desc`;
    if(month)url+=`&created_at=gte.${month}-01T00:00:00`;
    const r=await fetch(url,{headers:HDR});
    const data=await r.json();
    const maxQ={1:30,2:30,3:20,4:10,5:10};
    if(!Array.isArray(data)||!data.length){
      document.getElementById('sv-score').textContent='N/A';
      document.getElementById('sv-count').textContent='0 การประเมิน';
      const gEl=document.getElementById('sv-grade');if(gEl)gEl.textContent='—';
      [1,2,3,4,5].forEach(i=>{
        const b=document.getElementById('sv'+i);const n=document.getElementById('sn'+i);
        if(b)b.style.width='0%';if(n)n.textContent=`0/${maxQ[i]}`;
      });
      return;
    }
    /* เฉลี่ยรวม */
    const avg=(data.reduce((a,b)=>a+(b.score_total||0),0)/data.length).toFixed(1);
    const avgNum=parseFloat(avg);
    document.getElementById('sv-score').textContent=avg;
    document.getElementById('sv-count').textContent=`${data.length} การประเมิน`;
    const grade=avgNum>=90?'🏆 ดีเยี่ยม':avgNum>=75?'🎯 ดีมาก':avgNum>=60?'👍 ดี':avgNum>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
    const gradeCol=avgNum>=75?'var(--green-mid,#22C55E)':avgNum>=50?'var(--amber)':'var(--red)';
    const gEl=document.getElementById('sv-grade');
    if(gEl){gEl.textContent=grade;gEl.style.color=gradeCol;}
    document.getElementById('sv-score').style.color=gradeCol;
    /* เฉลี่ยรายหัวข้อ */
    [1,2,3,4,5].forEach(i=>{
      const avgQ=(data.reduce((a,b)=>a+(b[`score_q${i}`]||0),0)/data.length).toFixed(1);
      const pct=(parseFloat(avgQ)/maxQ[i])*100;
      const barEl=document.getElementById('sv'+i);
      const numEl=document.getElementById('sn'+i);
      if(barEl){barEl.style.width=pct+'%';barEl.style.background=pct>=75?'var(--green-mid,#22C55E)':pct>=50?'var(--amber)':'var(--red)';}
      if(numEl)numEl.textContent=`${avgQ}/${maxQ[i]}`;
    });
  }catch(e){console.warn('loadSurvey ICO:',e);}
}

/* ═══ SURVEY TRACKING ═══
   ดึงรายการ ticket_no ทั้งหมดที่มีการประเมินแล้วจาก ticket_survey มาเทียบกับงานที่ DONE ทั้งหมด
   เพื่อให้เห็นว่า TK ไหนยังไม่ได้ประเมิน จะได้ตามงานถูก — ไม่ผูกกับตัวกรองเดือน เพื่อให้เห็นภาพรวมค้างสะสมทั้งหมด
   มี 2 แท็บ: รอประเมิน (pending) / ประเมินแล้ว (done — คลิกแถวเพื่อดูรายละเอียดคะแนน+คำแนะนำได้ทันที) */
function setSvTrackTab(tab,btn){
  svTrackTab=tab;
  document.querySelectorAll('#view-dashboard .log-filter-btn[data-svt]').forEach(b=>b.classList.toggle('active',b.dataset.svt===tab));
  loadSurveyTracking();
}
async function loadSurveyTracking(){
  const body=document.getElementById('sv-track-body');
  const summary=document.getElementById('sv-track-summary');
  if(!body||!summary)return;
  try{
    const doneTickets=allTickets.filter(t=>t.status==='DONE');
    if(!doneTickets.length){
      summary.textContent='ยังไม่มีงานที่ปิดแล้ว';
      body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ยังไม่มีงานที่ปิดแล้ว</div>';
      return;
    }
    /* ใช้ surveySet/surveyMeta ที่โหลดไว้แล้ว (loadSurveySet) แทนการยิง fetch ซ้ำ */
    const evaluated=doneTickets.filter(t=>surveySet.has(t.ticket_no));
    const pending=doneTickets.filter(t=>!surveySet.has(t.ticket_no))
      .sort((a,b)=>new Date(a.closed_at||a.request_date||0)-new Date(b.closed_at||b.request_date||0)); // ค้างนานสุดอยู่บนสุด
    summary.textContent=`✅ ประเมินแล้ว ${evaluated.length} ราย   ·   ⏳ รอประเมิน ${pending.length} ราย`;

    if(svTrackTab==='done'){
      if(!evaluated.length){
        body.innerHTML='<div style="text-align:center;color:var(--mute);padding:16px;font-size:12px;">ยังไม่มีงานไหนถูกประเมินเลย</div>';
        return;
      }
      const sorted=[...evaluated].sort((a,b)=>{
        const da=surveyMeta[a.ticket_no]?.created_at||0, db=surveyMeta[b.ticket_no]?.created_at||0;
        return new Date(db)-new Date(da); // ประเมินล่าสุดขึ้นก่อน
      });
      body.innerHTML=`<table class="mini-table">
        <thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th style="width:80px;">คะแนน</th><th style="width:150px;">ประเมินเมื่อ</th><th style="width:60px;"></th></tr></thead>
        <tbody>${sorted.map(t=>{
          const meta=surveyMeta[t.ticket_no];
          const score=meta&&meta.score_total!=null?meta.score_total:'—';
          const scoreColor=score!=='—'?(score>=75?'var(--green)':score>=50?'var(--amber)':'var(--red)'):'var(--mute)';
          return`<tr style="cursor:pointer;" onclick="openSurveyDetail('${esc(t.ticket_no)}')">
            <td><span class="td-no">${esc(t.ticket_no)}</span></td>
            <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
            <td class="td-sub">${esc(t.department||'—')}</td>
            <td style="font-weight:700;color:${scoreColor};">${score}${score!=='—'?'/100':''}</td>
            <td class="td-date">${meta?fmtD(meta.created_at):'—'}</td>
            <td><span style="font-size:10.5px;color:var(--blue);font-weight:600;">ดู →</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
      return;
    }

    // tab: pending
    if(!pending.length){
      body.innerHTML='<div style="text-align:center;color:var(--green);padding:16px;font-size:12px;">🎉 ประเมินครบทุกรายการแล้ว</div>';
      return;
    }
    body.innerHTML=`<table class="mini-table">
      <thead><tr><th>เลขที่</th><th>ผู้แจ้ง</th><th>แผนก</th><th style="width:150px;">วันที่ปิดงาน</th><th style="width:70px;">ค้างมา</th></tr></thead>
      <tbody>${pending.map(t=>{
        const closeDate=t.closed_at||t.request_date;
        const days=closeDate?Math.max(0,Math.round((Date.now()-new Date(closeDate))/86400000)):null;
        const dayLabel=days===null?'—':`${days} วัน`;
        const dayColor=days!==null&&days>=7?'var(--red)':(days!==null&&days>=3?'var(--amber)':'var(--sub)');
        return`<tr style="cursor:pointer;" onclick="switchView('list');setFilter('DONE');activeSB(document.querySelectorAll('.sb-item')[5]||document.querySelector('.sb-item'));openModal('${esc(t.ticket_no)}')">
          <td><span class="td-no">${esc(t.ticket_no)}</span></td>
          <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
          <td class="td-sub">${esc(t.department||'—')}</td>
          <td class="td-date">${fmtD(closeDate)}</td>
          <td style="font-weight:700;color:${dayColor};">${dayLabel}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }catch(e){
    console.warn('loadSurveyTracking:',e);
    summary.textContent='โหลดข้อมูลไม่สำเร็จ';
    body.innerHTML='<div style="text-align:center;color:var(--red);padding:16px;font-size:11.5px;">โหลดข้อมูลติดตามแบบประเมินไม่สำเร็จ</div>';
  }
}

function loadMetrics(data){
  const done=data.filter(t=>t.status==='DONE');
  document.getElementById('m-cancel').textContent=data.filter(t=>t.status==='CANCELLED').length;
  // SLA & cost computed from ticket_services
  const nos=done.slice(0,50).map(t=>`"${t.ticket_no}"`).join(',');
  if(!nos){document.getElementById('m-avg').textContent='—';document.getElementById('m-max').textContent='—';document.getElementById('m-cost').textContent='0';return;}
  fetch(`${SVC}?select=repair_cost,received_date,finish_date,work_hours&ticket_no=in.(${nos})`,{headers:HDR}).then(r=>r.json()).then(rows=>{
    if(!rows.length)return;
    const days=rows.filter(r=>r.received_date&&r.finish_date).map(r=>Math.max(0,Math.round((new Date(r.finish_date)-new Date(r.received_date))/(86400000))));
    document.getElementById('m-avg').textContent=days.length?(days.reduce((a,b)=>a+b,0)/days.length).toFixed(1):'—';
    document.getElementById('m-max').textContent=days.length?Math.max(...days):'—';
    const total=rows.reduce((a,b)=>a+(parseFloat(b.repair_cost)||0),0);
    document.getElementById('m-cost').textContent=total?total.toLocaleString('th-TH',{maximumFractionDigits:0}):'0';
  }).catch(()=>{});
}

/* ═══ TABLE ═══ */
function switchView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('view-'+v);
  if(el){
    el.classList.add('active');
    /* scroll content area back to top */
    const content=document.querySelector('.content');
    if(content)content.scrollTop=0;
  }
  if(v==='list') renderTable();
  if(v==='dashboard') buildDashboard();
}
function activeSB(el){document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));el.classList.add('active');}
function setFilter(s){bounceOnly=false;document.getElementById('list-title').textContent='คำขอทั้งหมด';document.getElementById('statusFilter').value=s;renderTable();}
function sortBy(f){if(sortField===f)sortAsc=!sortAsc;else{sortField=f;sortAsc=true;}renderTable();}

function renderTable(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  const st=document.getElementById('statusFilter').value;
  const cat=document.getElementById('catFilter').value;
  let rows=allTickets.filter(t=>{
    const mq=!q||[t.ticket_no,t.requester_name,t.department,t.issue_detail].some(v=>(v||'').toLowerCase().includes(q));
    return mq&&(!st||t.status===st)&&(!cat||(t.job_category||'')===cat);
  });
  if(bounceOnly) rows=rows.filter(isBouncedTicket);
  rows.sort((a,b)=>{const av=a[sortField]||'',bv=b[sortField]||'';return sortAsc?(av>bv?1:-1):(av<bv?1:-1);});
  const tbody=document.getElementById('ticketTableBody');
  if(!rows.length){tbody.innerHTML=`<tr class="loading-row"><td colspan="8">${bounceOnly?'🎉 ไม่มีงานที่ถูกตีกลับ':'ไม่พบข้อมูล'}</td></tr>`;document.getElementById('tableFooter').textContent='';return;}
  tbody.innerHTML=rows.map(t=>{
    const d=t.request_date?new Date(t.request_date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
    const issue=(t.issue_detail||'').slice(0,46)+((t.issue_detail||'').length>46?'…':'');
    const pri=t.priority?`<span class="pri pri-${t.priority}">${t.priority}</span>`:'—';
    const bounced=isBouncedTicket(t);
    const bLog=bounceMap[t.ticket_no];
    const bounceTitle=bounced?`ตีกลับโดย ${esc(bLog.action_by||'-')} เมื่อ ${fmtDT(bLog.created_at)}${bLog.comment?' — เหตุผล: '+esc(bLog.comment):''}`:'';
    let statusCell=buildStatusBadge(t.status);
    if(bounced) statusCell+=`<br><span class="status s-bounce" title="${bounceTitle}" style="margin-top:3px;">⛔ ตีกลับ — ต้องแก้ไข</span>`;
    else if(t.status==='DONE'){
      if(surveySet.has(t.ticket_no)){
        const meta=surveyMeta[t.ticket_no];
        const scoreLabel=meta&&meta.score_total!=null?` ${meta.score_total}/100`:'';
        statusCell+=`<br><button type="button" class="sv-badge done" style="margin-top:3px;cursor:pointer;font-family:inherit;" onclick="event.stopPropagation();openSurveyDetail('${esc(t.ticket_no)}')">⭐ ประเมินแล้ว${scoreLabel} — ดูรายละเอียด</button>`;
      }else{
        statusCell+=`<br><span class="sv-badge pending" style="margin-top:3px;">⏳ รอประเมิน</span>`;
      }
    }
    // action buttons based on status
    let btns=`<button class="btn-row btn-work" onclick="event.stopPropagation();openModal('${esc(t.ticket_no)}')">บันทึก</button>`;
    if(bounced) btns=`<button class="btn-row" style="color:var(--red);border-color:var(--red-border);background:var(--red-pale);" onclick="event.stopPropagation();openModal('${esc(t.ticket_no)}')">แก้ไขด่วน!</button>`;
    else if(t.status==='ICO_FINAL') btns=`<button class="btn-row btn-close" onclick="event.stopPropagation();openModal('${esc(t.ticket_no)}')">ปิดงาน!</button>`;
    return`<tr class="${bounced?'row-bounced':''}" onclick="openModal('${esc(t.ticket_no)}')">
      <td><span class="td-no">${esc(t.ticket_no)}</span></td>
      <td><span class="td-name">${esc(t.requester_name||'—')}</span></td>
      <td class="td-sub">${esc(t.department||'—')}</td>
      <td title="${esc(t.issue_detail||'')}">${esc(issue)}</td>
      <td style="white-space:normal;">${statusCell}</td>
      <td>${pri}</td>
      <td class="td-date">${d}</td>
      <td>${btns}</td>
    </tr>`;
  }).join('');
  document.getElementById('tableFooter').textContent=`แสดง ${rows.length} / ${allTickets.length} รายการ${bounceOnly?' (เฉพาะงานที่ถูกตีกลับ)':''}`;
}

function buildStatusBadge(s){
  const map={
    'OPEN':['s-open','OPEN'],'MGR_WAIT':['s-mgr','รอหัวหน้า'],
    'ICO_WORK':['s-ico','ICO ดำเนินการ'],'ITL_WAIT':['s-itl','รอ ITL'],
    'ITM_WAIT':['s-itm','รอ IT MGR'],'ICO_FINAL':['s-final','รอปิดงาน'],
    'DONE':['s-done','เสร็จสิ้น'],'REJECTED':['s-reject','ถูกตีกลับ'],'CANCELLED':['s-cancel','ยกเลิก'],
  };
  const [cls,label]=map[s]||['s-open',s||'—'];
  return`<span class="status ${cls}">${label}</span>`;
}

/* ═══ MODAL ═══ */
async function openModal(no){
  icoFiles=[];
  document.getElementById('icoFileList').innerHTML='';
  logFilterMode='all';
  document.querySelectorAll('.log-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.f==='all'));
  if(document.getElementById('commentInternal'))document.getElementById('commentInternal').checked=false;
  currentTicket=allTickets.find(t=>t.ticket_no===no);
  if(!currentTicket)return;
  const T=currentTicket;
  console.log('[ICO] เปิด ticket:',no,'| ข้อมูลดิบจาก tickets table:',T);
  document.getElementById('bounceBanner').style.display='none';
  document.getElementById('wm-title').textContent=`จัดการงาน — ${no}`;
  document.getElementById('wm-sub').textContent=T.issue_detail?T.issue_detail.slice(0,80):'—';
  // info tab
  document.getElementById('wm-requester').textContent=T.requester_name||'—';
  document.getElementById('wm-dept').textContent=T.department||'—';
  document.getElementById('wm-loc').textContent=T.location||'—';
  document.getElementById('wm-email').textContent=T.requester_email||'—';
  document.getElementById('wm-asset').textContent=T.asset_id||'—';
  document.getElementById('wm-reqdate').textContent=fmtD(T.request_date);
  document.getElementById('wm-needdate').textContent=fmtD(T.required_date);
  document.getElementById('wm-issue').textContent=T.issue_detail||'—';
  // images
  const imgs=toArr(T.issue_img_url);
  const ig=document.getElementById('wm-imgs');ig.innerHTML='';
  if(imgs.length){
    document.getElementById('wm-imgs-sec').style.display='';
    imgs.forEach(u=>{const im=document.createElement('img');im.className='gthumb';im.src=u;im.onclick=()=>openLB(u);ig.appendChild(im);});
  }else document.getElementById('wm-imgs-sec').style.display='none';
  // itl/itm
  document.getElementById('itl-name').textContent=T.itl_name||'—';
  document.getElementById('itl-status').textContent=T.itl_status==='ITL_APPROVE'?'✅ อนุมัติ':T.itl_status||'—';
  document.getElementById('itl-comment').textContent=T.itl_comment||'—';
  document.getElementById('itm-name').textContent=T.itm_name||'—';
  document.getElementById('itm-status').textContent=T.itm_status==='ITM_APPROVE'?'✅ อนุมัติ':T.itm_status||'—';
  document.getElementById('itm-priority').textContent=T.priority||'—';
  document.getElementById('itm-comment').textContent=T.itm_comment||'—';
  // เคลียร์ข้อมูลหัวหน้างานก่อน (จะถูกเติมจาก log ใน updateItlItmFromLog หลัง loadLog)
  ['mgr_name','mgr_status','mgr_date','mgr_comment'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='—';});
  // itm notice
  const itmNotice=document.getElementById('itm-notice');
  if(T.status==='ICO_FINAL'){itmNotice.style.display='flex';document.getElementById('itm-notice-comment').textContent=T.itm_comment?`ความเห็น IT MGR: ${T.itm_comment}`:'';} else itmNotice.style.display='none';
  // close box
  document.getElementById('close-box').style.display=T.status==='ICO_FINAL'?'':'none';
  // survey link
  document.getElementById('f-survey-link').value=T.status==='ICO_FINAL'?`${location.origin}/survey.html?ticket=${encodeURIComponent(no)}`:'';
  // footer buttons
  document.getElementById('btn-draft').style.display='';
  document.getElementById('btn-itl').style.display=(['OPEN','MGR_WAIT','ICO_WORK'].includes(T.status))&&T.status!=='ICO_FINAL'?'inline-flex':'none';
  document.getElementById('btn-close-work').style.display=T.status==='ICO_FINAL'?'':'none';
  // timeline
  buildTimeline(T.status);
  // attachments
  const reqF=toArr(T.attachment_url);
  document.getElementById('req-files').innerHTML=reqF.length?reqF.map(u=>fLink(u)).join(''):'<span style="font-size:11px;color:var(--mute);">ไม่มีไฟล์</span>';
  // load svc
  await loadSvc(no);
  await loadLog(no);
  await loadTicketSurvey(no,T.status);
  switchTab('t-req',document.querySelector('.tab-btn'));
  document.getElementById('workModal').classList.add('open');
}

/* ═══ SURVEY RESULT (ในหน้ารายละเอียดงาน) ═══
   แสดงผลประเมินความพึงพอใจของผู้แจ้ง (ถ้ามี) หรือแจ้งว่ายังไม่ได้ประเมิน — เห็นตอนปิดงาน/ดูงานที่ปิดแล้ว */
async function loadTicketSurvey(no,status){
  const box=document.getElementById('survey-box');
  const body=document.getElementById('survey-box-body');
  if(!box||!body)return;
  if(!['DONE','ICO_FINAL'].includes(status)){box.style.display='none';return;}
  box.style.display='';
  body.innerHTML='<div style="font-size:12px;color:var(--sub);">กำลังโหลด...</div>';
  try{
    const r=await fetch(`${SURV}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.desc&limit=1`,{headers:HDR});
    if(!r.ok){body.innerHTML=`<div style="color:var(--red);font-size:11.5px;">โหลดผลประเมินไม่สำเร็จ (HTTP ${r.status})</div>`;return;}
    const rows=await r.json();
    const s=Array.isArray(rows)?rows[0]:null;
    if(!s){
      body.innerHTML=`<div style="display:flex;align-items:center;gap:8px;color:var(--sub);font-size:12.5px;">⏳ ผู้แจ้งยังไม่ได้ทำแบบประเมินความพึงพอใจสำหรับงานนี้</div>`;
      return;
    }
    const maxQ={1:30,2:30,3:20,4:10,5:10};
    const labels={1:'แก้ไขตรงตามรายการที่แจ้ง',2:'ระยะเวลาดำเนินการ',3:'การอธิบาย/ให้คำแนะนำ',4:'ความสุภาพ/มารยาท',5:'ความพึงพอใจโดยรวม'};
    const total=(s.score_total!=null?s.score_total:[1,2,3,4,5].reduce((a,i)=>a+(s[`score_q${i}`]||0),0));
    const grade=total>=90?'🏆 ดีเยี่ยม':total>=75?'🎯 ดีมาก':total>=60?'👍 ดี':total>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
    const gradeCol=total>=75?'var(--green)':total>=50?'var(--amber)':'var(--red)';
    const evaluatorName=findEvaluatorName(s)||currentTicket?.requester_name||null;
    let barsHtml='';
    [1,2,3,4,5].forEach(i=>{
      const v=s[`score_q${i}`]||0;
      const pct=Math.min(100,(v/maxQ[i])*100);
      barsHtml+=`<div class="s-bar-row"><label style="width:150px;text-align:left;font-size:10.5px;">${labels[i]}</label><div class="s-bar-bg"><div class="s-bar-fill" style="width:${pct}%;background:${pct>=75?'var(--green-mid)':pct>=50?'var(--amber)':'var(--red)'}"></div></div><span class="s-bar-n" style="min-width:34px;">${v}/${maxQ[i]}</span></div>`;
    });
    const chkParts=[];
    if(s.chk_resolved!=null)chkParts.push(`แก้ไขปัญหาสำเร็จ: ${s.chk_resolved?'✅ ใช่':'❌ ไม่'}`);
    if(s.chk_explained!=null)chkParts.push(`ได้รับคำอธิบาย: ${s.chk_explained?'✅ ใช่':'❌ ไม่'}`);
    body.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:12px;color:var(--sub);">ประเมินโดย</span>
        <span style="font-size:13px;font-weight:700;color:var(--ink);">${esc(evaluatorName||'ไม่ระบุชื่อ')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
        <div style="text-align:center;min-width:58px;">
          <div style="font-family:'Inter',sans-serif;font-size:30px;font-weight:800;color:var(--ink);line-height:1;">${total}</div>
          <div style="font-size:9px;color:var(--mute);">/100</div>
          <div style="font-size:10px;font-weight:700;margin-top:2px;color:${gradeCol};">${grade}</div>
        </div>
        <div style="flex:1;">${barsHtml}</div>
      </div>
      ${chkParts.length?`<div style="font-size:11px;color:var(--sub);margin-bottom:4px;">${chkParts.join(' &nbsp;|&nbsp; ')}</div>`:''}
      ${s.comment?`<div style="font-size:12px;color:var(--ink);margin-top:6px;padding-top:6px;border-top:1px solid var(--amber-border);white-space:pre-wrap;">💬 ความเห็นเพิ่มเติมจากผู้แจ้ง: ${esc(s.comment)}</div>`:''}
      <div style="font-size:10px;color:var(--mute);margin-top:6px;">ประเมินเมื่อ ${fmtDT(s.created_at)}</div>
      <div style="margin-top:10px;"><button type="button" class="btn-neutral btn-sm" onclick="openSurveyDetail('${esc(no)}')">🔍 ดูรายละเอียดแบบเต็ม</button></div>
    `;
  }catch(e){
    console.warn('[ICO] loadTicketSurvey error:',e);
    body.innerHTML=`<div style="color:var(--red);font-size:11.5px;">เกิดข้อผิดพลาด: ${esc(e.message)}</div>`;
  }
}

/* หาชื่อผู้ประเมินจากแถว survey — เผื่อชื่อคอลัมน์ในฐานข้อมูลจริงไม่ตรงกับที่เดาไว้ตัวใดตัวหนึ่งเป๊ะๆ
   จะลองไล่ชื่อคอลัมน์ที่เป็นไปได้ทั้งหมด แล้วใช้ตัวแรกที่มีค่า */
function findEvaluatorName(s){
  const nameKeys=['evaluator_name','rater_name','reviewer_name','respondent_name','submitted_by','evaluator','rater','requester_name','name'];
  for(const k of nameKeys){ if(s && s[k]) return s[k]; }
  return null;
}
/* หาข้อความคำแนะนำ/ความเห็นจากแถว survey — ไล่ชื่อคอลัมน์ที่เป็นไปได้เช่นกัน อาจมีมากกว่า 1 ช่อง */
function findTextFeedbackFields(s){
  const textKeys=['comment','comments','suggestion','suggestions','recommendation','recommendations','feedback','note','notes','additional_comment','other_comment'];
  const found=[];const seen=new Set();
  for(const k of textKeys){
    const v=s&&s[k];
    if(v && typeof v==='string' && v.trim() && !seen.has(v.trim())){found.push({key:k,val:v.trim()});seen.add(v.trim());}
  }
  return found;
}

/* ═══ SURVEY DETAIL — popup แบบเต็ม เรียกได้จากทุกจุด (รายการ / dashboard tracking / ในหน้า ticket) ═══ */
async function openSurveyDetail(no){
  const modal=document.getElementById('surveyDetailModal');
  const sub=document.getElementById('svd-sub');
  const body=document.getElementById('svd-body');
  if(!modal||!body)return;
  const T=allTickets.find(t=>t.ticket_no===no);
  sub.textContent=`Ticket ${no}${T&&T.requester_name?' — '+T.requester_name:''}`;
  body.innerHTML='<div style="text-align:center;color:var(--sub);padding:24px;font-size:12.5px;">กำลังโหลด...</div>';
  modal.classList.add('open');
  try{
    const r=await fetch(`${SURV}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.desc&limit=1`,{headers:HDR});
    if(!r.ok){body.innerHTML=`<div style="color:var(--red);font-size:12px;">โหลดไม่สำเร็จ (HTTP ${r.status})</div>`;return;}
    const rows=await r.json();
    const s=Array.isArray(rows)?rows[0]:null;
    if(!s){body.innerHTML=`<div style="color:var(--sub);font-size:12.5px;text-align:center;padding:16px;">⏳ ผู้แจ้งยังไม่ได้ทำแบบประเมินสำหรับงานนี้</div>`;return;}
    body.innerHTML=renderSurveyDetailHtml(s,T);
  }catch(e){
    console.warn('[ICO] openSurveyDetail error:',e);
    body.innerHTML=`<div style="color:var(--red);font-size:12px;">เกิดข้อผิดพลาด: ${esc(e.message)}</div>`;
  }
}
function closeSurveyDetail(){document.getElementById('surveyDetailModal').classList.remove('open');}

/* สร้าง HTML แสดงผลประเมินแบบเต็ม: คะแนนรวม, คะแนนรายหัวข้อทั้ง 5, ชื่อผู้ประเมิน, คำแนะนำ/ความเห็น,
   และ "ข้อมูลอื่นๆ" ที่เหลือในแถว survey (เผื่อ column ที่ไม่รู้จัก จะได้ไม่ตกหล่นข้อมูล) */
function renderSurveyDetailHtml(s,T){
  const maxQ={1:30,2:30,3:20,4:10,5:10};
  const labels={1:'1) แก้ไขตรงตามรายการที่แจ้ง',2:'2) ระยะเวลาดำเนินการ (ตรงตามเวลา)',3:'3) การอธิบาย/ให้คำแนะนำ',4:'4) ความสุภาพ/มารยาทของเจ้าหน้าที่',5:'5) ความพึงพอใจโดยรวม'};
  const total=(s.score_total!=null?s.score_total:[1,2,3,4,5].reduce((a,i)=>a+(s[`score_q${i}`]||0),0));
  const grade=total>=90?'🏆 ดีเยี่ยม':total>=75?'🎯 ดีมาก':total>=60?'👍 ดี':total>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
  const gradeCol=total>=75?'var(--green)':total>=50?'var(--amber)':'var(--red)';
  let barsHtml='';
  [1,2,3,4,5].forEach(i=>{
    const v=s[`score_q${i}`];
    if(v==null)return;
    const pct=Math.min(100,(v/maxQ[i])*100);
    barsHtml+=`<div class="s-bar-row" style="margin-bottom:8px;"><label style="width:230px;text-align:left;font-size:11.5px;color:var(--ink);">${labels[i]}</label><div class="s-bar-bg" style="height:9px;"><div class="s-bar-fill" style="width:${pct}%;background:${pct>=75?'var(--green-mid)':pct>=50?'var(--amber)':'var(--red)'}"></div></div><span class="s-bar-n" style="min-width:40px;font-size:11px;">${v}/${maxQ[i]}</span></div>`;
  });
  const evaluatorName=findEvaluatorName(s)||T?.requester_name||null;
  const textFieldsFound=findTextFeedbackFields(s);
  const knownKeys=new Set(['id','ticket_no','created_at','updated_at','score_total','score_q1','score_q2','score_q3','score_q4','score_q5','chk_resolved','chk_explained',
    'evaluator_name','rater_name','reviewer_name','respondent_name','submitted_by','evaluator','rater','requester_name','name',
    'comment','comments','suggestion','suggestions','recommendation','recommendations','feedback','note','notes','additional_comment','other_comment']);
  const extraEntries=Object.entries(s).filter(([k,v])=>!knownKeys.has(k)&&v!==null&&v!=='');

  let html=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">
      <div style="text-align:center;min-width:70px;flex-shrink:0;">
        <div style="font-family:'Inter',sans-serif;font-size:38px;font-weight:800;color:var(--ink);line-height:1;">${total}</div>
        <div style="font-size:10px;color:var(--mute);">คะแนนรวม /100</div>
        <div style="font-size:11px;font-weight:700;margin-top:4px;color:${gradeCol};">${grade}</div>
      </div>
      <div style="flex:1;">
        <div class="info-row" style="margin-bottom:5px;"><span class="info-key" style="min-width:90px;">ชื่อผู้ประเมิน</span><span class="info-val" style="font-weight:700;">${esc(evaluatorName||'ไม่ระบุชื่อ')}</span></div>
        <div class="info-row" style="margin-bottom:0;"><span class="info-key" style="min-width:90px;">วันที่ประเมิน</span><span class="info-val">${fmtDT(s.created_at)}</span></div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">คะแนนแยกรายหัวข้อ</div>
    <div style="margin-bottom:14px;">${barsHtml||'<div style="color:var(--mute);font-size:12px;">ไม่มีข้อมูลคะแนนรายหัวข้อ</div>'}</div>
  `;
  const chkParts=[];
  if(s.chk_resolved!=null)chkParts.push(`แก้ไขปัญหาสำเร็จ: <b>${s.chk_resolved?'✅ ใช่':'❌ ไม่'}</b>`);
  if(s.chk_explained!=null)chkParts.push(`ได้รับคำอธิบายจากเจ้าหน้าที่: <b>${s.chk_explained?'✅ ใช่':'❌ ไม่'}</b>`);
  if(chkParts.length) html+=`<div style="font-size:12.5px;color:var(--ink);background:var(--field);border-radius:8px;padding:10px 12px;margin-bottom:14px;">${chkParts.join('<br>')}</div>`;

  if(textFieldsFound.length){
    html+=`<div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">💬 คำแนะนำ / ความเห็นจากผู้แจ้ง</div>`;
    textFieldsFound.forEach(f=>{
      html+=`<div style="font-size:13px;color:var(--ink);background:var(--amber-pale);border:1px solid var(--amber-border);border-radius:8px;padding:10px 12px;margin-bottom:8px;white-space:pre-wrap;line-height:1.6;">${esc(f.val)}</div>`;
    });
  }else{
    html+=`<div style="font-size:12px;color:var(--mute);margin-bottom:10px;">— ผู้แจ้งไม่ได้เขียนคำแนะนำ/ความเห็นเพิ่มเติม —</div>`;
  }

  if(extraEntries.length){
    html+=`<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:11px;color:var(--mute);">ข้อมูลอื่นๆ ในแบบประเมิน (${extraEntries.length})</summary>
      <div class="info-group" style="margin-top:8px;">
        ${extraEntries.map(([k,v])=>`<div class="info-row"><span class="info-key">${esc(k)}</span><span class="info-val">${esc(typeof v==='object'?JSON.stringify(v):String(v))}</span></div>`).join('')}
      </div>
    </details>`;
  }
  return html;
}

function buildTimeline(status){
  const order=['OPEN','MGR_WAIT','ICO_WORK','ITL_WAIT','ITM_WAIT','ICO_FINAL','DONE'];
  const idx=order.indexOf(status);
  const steps=[
    {id:'tl-mgr',at:1},
    {id:'tl-ico',at:2},
    {id:'tl-itl',at:3},
    {id:'tl-itm',at:4},
    {id:'tl-done',at:6},
  ];
  steps.forEach(({id,at})=>{
    const el=document.getElementById(id);
    el.className='tl-step';
    if(idx>at) el.classList.add('done');
    else if(idx===at) el.classList.add('active');
    else if(status==='REJECTED'||status==='CANCELLED') el.classList.add('rejected');
  });
}

async function loadSvc(no){
  try{
    const r=await fetch(`${SVC}?ticket_no=eq.${encodeURIComponent(no)}&limit=1`,{headers:HDR});
    const rows=await r.json();
    currentSvc=rows[0]||null;
    if(currentSvc){
      const s=currentSvc;
      document.getElementById('f-staff').value=s.staff_name||'';
      document.getElementById('f-received').value=s.received_date||'';
      document.getElementById('f-category').value=s.job_category||'';
      document.getElementById('f-priority').value=s.priority||'MED';
      document.getElementById('f-inspection').value=s.inspection_detail||'';
      document.getElementById('f-action').value=s.action_detail||'';
      document.getElementById('f-parts').value=s.spare_parts_detail||'';
      document.getElementById('f-cost').value=s.repair_cost||'';
      document.getElementById('f-finish').value=s.finish_date||'';
      document.getElementById('f-hours').value=s.work_hours||'';
      document.getElementById('f-recommend').value=s.recommendations||'';
      document.getElementById('f-notes').value=s.additional_notes||'';
      if(s.close_summary) document.getElementById('f-summary').value=s.close_summary;
      if(s.close_result) document.getElementById('f-result').value=s.close_result;
      const iF=toArr(s.attachment_urls);
      document.getElementById('ico-files').innerHTML=iF.length?iF.map(u=>fLink(u)).join(''):'<span style="font-size:11px;color:var(--mute);">ยังไม่มีไฟล์</span>';
    }else{
      ['f-staff','f-inspection','f-action','f-parts','f-cost','f-notes','f-recommend','f-summary'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
      document.getElementById('f-received').value=new Date().toISOString().slice(0,10);
      document.getElementById('f-priority').value='MED';
      document.getElementById('ico-files').innerHTML='<span style="font-size:11px;color:var(--mute);">ยังไม่มีไฟล์</span>';
    }
  }catch(e){}
  const authStaff=window.ICTAuth?.getCurrentUser?.().display_name||'';
  if(authStaff){const staffInput=document.getElementById('f-staff');if(staffInput){staffInput.value=authStaff;staffInput.readOnly=true;}}
}

let currentLogRows=[];
let logFilterMode='all';

async function loadLog(no){
  const t=document.getElementById('logThread');
  t.innerHTML='<div style="padding:14px;text-align:center;color:var(--mute);font-size:12px;">กำลังโหลด...</div>';
  try{
    const r=await fetch(`${LOG}?ticket_no=eq.${encodeURIComponent(no)}&order=created_at.asc`,{headers:HDR});
    const rows=await r.json();
    if(!r.ok){
      /* แสดง error จริงแทนที่จะซ่อนเงียบๆ — ช่วยวินิจฉัยปัญหา RLS / ชื่อ table / สิทธิ์ */
      console.error('[ICO] loadLog HTTP error:',r.status,rows);
      t.innerHTML=`<div style="padding:14px;text-align:center;color:var(--red);font-size:11.5px;">โหลด log ไม่สำเร็จ (HTTP ${r.status})<br>${esc(rows&&(rows.message||rows.hint)||JSON.stringify(rows))}</div>`;
      currentLogRows=[];
      updateItlItmFromLog([]);updateBounceBanner([]);
      return;
    }
    console.log('[ICO] tickets_log rows for',no,':',rows);
    currentLogRows=Array.isArray(rows)?rows:[];
    renderLogThread();
    updateItlItmFromLog(currentLogRows);
    updateBounceBanner(currentLogRows);
  }catch(e){
    console.error('[ICO] loadLog exception:',e);
    t.innerHTML=`<div style="padding:14px;text-align:center;color:var(--red);font-size:11.5px;">เกิดข้อผิดพลาด: ${esc(e.message)}</div>`;
    currentLogRows=[];
  }
}

/* สลับมุมมอง Log: ทั้งหมด / ประวัติระบบ (การเปลี่ยนสถานะ-อนุมัติ-ตีกลับ) / คุยกันในทีม (COMMENT, INTERNAL_NOTE) */
function setLogFilter(mode,btn){
  logFilterMode=mode;
  document.querySelectorAll('.log-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderLogThread();
}

function renderLogThread(){
  const t=document.getElementById('logThread');
  if(!t)return;
  const rows=currentLogRows;
  if(!rows.length){
    t.innerHTML='<div style="padding:14px;text-align:center;color:var(--mute);font-size:12px;">ยังไม่มี log สำหรับ ticket นี้</div>';
    return;
  }
  const isNoteStatus=s=>s==='COMMENT'||s==='INTERNAL_NOTE';
  const filtered=rows.filter(r=>{
    if(logFilterMode==='history')return !isNoteStatus(r.status);
    if(logFilterMode==='note')return isNoteStatus(r.status);
    return true;
  });
  if(!filtered.length){
    t.innerHTML=`<div style="padding:14px;text-align:center;color:var(--mute);font-size:12px;">${logFilterMode==='history'?'ยังไม่มีประวัติระบบ':'ยังไม่มีข้อความคุยกันในทีม'}</div>`;
    return;
  }
  const rm={'MANAGER_APPROVE':'หัวหน้างาน','ICO_CHECK':'ICO','ICT_ACTION':'ICO/ช่าง','ITL_APPROVE':'ITL','IT_MGR_APPROVE':'IT Manager'};
  t.innerHTML=filtered.map(r=>{
    const isBounce=/BACK|REJECT/i.test(r.status||'');
    const isInternal=r.status==='INTERNAL_NOTE';
    const isApprove=/APPROVE|DONE/i.test(r.status||'')&&!isBounce;
    const sc=isBounce?'var(--red)':isInternal?'var(--purple)':isApprove?'var(--green)':'var(--sub)';
    const dt=r.created_at?fmtDT(r.created_at):'ไม่ระบุวันที่';
    const who=r.action_by||'ไม่ระบุผู้บันทึก';
    const statusLabel=isInternal?'🔒 คุยในทีม':(r.status==='COMMENT'?'💬 ความเห็น':(r.status||''));
    return`<div class="comment-item${!r.step_name?' system':''}${isBounce?' bounce':''}${isInternal?' internal':''}"><div class="comment-meta"><span class="comment-who">${esc(who)}</span><span class="comment-role">${rm[r.step_name]||r.step_name||''}</span><span style="font-size:9px;font-weight:700;color:${sc};">${isBounce?'⛔ ':''}${esc(statusLabel)}</span><span class="comment-time">🕐 ${dt}</span></div>${r.comment?`<div class="comment-text">${esc(r.comment)}</div>`:''}</div>`;
  }).join('');
}

/* ดึงผล ITL / IT MGR ล่าสุดจากประวัติ log — ไม่พึ่งพาแค่คอลัมน์ใน tickets table
   เพราะบางระบบเขียนผลไว้ที่ tickets_log เท่านั้น ทำให้แท็บ "ผล ITL / ผล IT MGR" ว่างเปล่า */
function updateItlItmFromLog(rows){
  const itl=[...rows].reverse().find(r=>r.step_name==='ITL_APPROVE');
  const itm=[...rows].reverse().find(r=>r.step_name==='IT_MGR_APPROVE');
  const mgr=[...rows].reverse().find(r=>r.step_name==='MANAGER_APPROVE');
  if(itl){
    document.getElementById('itl-name').textContent=itl.action_by||'ไม่ระบุชื่อผู้บันทึก';
    document.getElementById('itl-status').textContent=/BACK|REJECT/i.test(itl.status||'')?'⛔ ตีกลับ':(/APPROVE/i.test(itl.status||'')?'✅ อนุมัติ':(itl.status||'—'));
    document.getElementById('itl-comment').textContent=itl.comment||'— (ไม่มีความเห็นเพิ่มเติม)';
    const d=document.getElementById('itl-date');if(d)d.textContent=fmtDT(itl.created_at);
  }
  if(itm){
    document.getElementById('itm-name').textContent=itm.action_by||'ไม่ระบุชื่อผู้บันทึก';
    document.getElementById('itm-status').textContent=/BACK|REJECT/i.test(itm.status||'')?'⛔ ตีกลับ':(/APPROVE/i.test(itm.status||'')?'✅ อนุมัติ':(itm.status||'—'));
    document.getElementById('itm-comment').textContent=itm.comment||'— (ไม่มีความเห็นเพิ่มเติม)';
    const d=document.getElementById('itm-date');if(d)d.textContent=fmtDT(itm.created_at);
  }
  // หัวหน้างานผู้แจ้ง — ก่อนหน้านี้ไม่เคยแสดงส่วนนี้เลย
  if(mgr){
    document.getElementById('mgr_name').textContent=mgr.action_by||'ไม่ระบุชื่อผู้อนุมัติ';
    document.getElementById('mgr_status').textContent=/BACK|REJECT/i.test(mgr.status||'')?'⛔ ตีกลับ':(/APPROVE/i.test(mgr.status||'')?'✅ อนุมัติ':(mgr.status||'—'));
    document.getElementById('mgr_comment').textContent=mgr.comment||'— (ไม่มีความเห็นเพิ่มเติม)';
    const d=document.getElementById('mgr_date');if(d)d.textContent=fmtDT(mgr.created_at);
  }else{
    document.getElementById('mgr_name').textContent='ยังไม่มีการอนุมัติจากหัวหน้างาน';
    document.getElementById('mgr_status').textContent='—';
    document.getElementById('mgr_comment').textContent='—';
    const d=document.getElementById('mgr_date');if(d)d.textContent='—';
  }
}

/* แสดงแบนเนอร์แดงเมื่องานถูกตีกลับมาที่ ICO (จาก IT MGR หรือ ITL) พร้อมคอมเมนต์/วันที่/ชื่อผู้ตีกลับ */
function updateBounceBanner(rows){
  const banner=document.getElementById('bounceBanner');
  if(!banner)return;
  if(!currentTicket||!['ICO_WORK','ITL_WAIT','OPEN','MGR_WAIT'].includes(currentTicket.status)){banner.style.display='none';return;}
  const bounce=[...rows].reverse().find(r=>/BACK|REJECT/i.test(r.status||''));
  if(bounce){
    banner.style.display='flex';
    const fromLabel=bounce.step_name==='IT_MGR_APPROVE'?'IT Manager':(bounce.step_name==='ITL_APPROVE'?'ITL':'ทีมตรวจสอบ');
    document.getElementById('bounceBannerText').textContent=`⛔ งานนี้ถูกตีกลับจาก ${fromLabel} — โดย ${bounce.action_by||'-'} เมื่อ ${fmtDT(bounce.created_at)}`;
    document.getElementById('bounceBannerComment').textContent=bounce.comment?`เหตุผล: ${bounce.comment}`:'ไม่มีความเห็นเพิ่มเติม กรุณาตรวจสอบและแก้ไขงานอีกครั้ง';
  }else{
    banner.style.display='none';
  }
}

function closeModal(){document.getElementById('workModal').classList.remove('open');currentTicket=null;currentSvc=null;icoFiles=[];}

/* ═══ SAVE ═══ */
async function saveService(sendToITL){
  const staff=document.getElementById('f-staff').value.trim();
  const action=document.getElementById('f-action').value.trim();
  if(!staff||!action){showToast('กรุณาระบุชื่อเจ้าหน้าที่และการให้บริการ','err');return;}
  const btnId=sendToITL?'btn-itl':'btn-draft';
  const btn=document.getElementById(btnId);
  const orig=btn.innerHTML;
  btn.disabled=true;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10" stroke-opacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> กำลังบันทึก...';
  const ticketNo=currentTicket.ticket_no;
  const priority=document.getElementById('f-priority').value||'MED';
  try{
    /* 1. อัปโหลดไฟล์ (ถ้ามี) — ไม่ throw ถ้าล้มเหลว */
    let urls=toArr(currentSvc?.attachment_urls);
    try{if(icoFiles.length){const up=await uploadFiles(icoFiles,`services/${ticketNo}`);urls=[...urls,...up];}}catch(ue){console.warn('upload warn:',ue);}

    /* 2. บันทึก ticket_services — upsert ด้วย on_conflict */
    const svcPayload={
      ticket_no:ticketNo,
      staff_name:staff,
      received_date:document.getElementById('f-received').value||null,
      job_category:document.getElementById('f-category').value||null,
      priority,
      inspection_detail:document.getElementById('f-inspection').value.trim()||null,
      action_detail:action,
      spare_parts_detail:document.getElementById('f-parts').value.trim()||null,
      repair_cost:parseFloat(document.getElementById('f-cost').value)||null,
      finish_date:document.getElementById('f-finish').value||null,
      work_hours:parseFloat(document.getElementById('f-hours').value)||null,
      recommendations:document.getElementById('f-recommend').value.trim()||null,
      additional_notes:document.getElementById('f-notes').value.trim()||null,
      attachment_urls:urls.length?urls:null,
      updated_at:new Date().toISOString(),
    };
    /* ใช้ upsert เพื่อหลีกเลี่ยง 409 conflict */
    const svcRes=await fetch(`${SVC}?on_conflict=ticket_no`,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(svcPayload)
    });
    if(!svcRes.ok){
      const errBody=await svcRes.text();
      console.warn('ticket_services upsert warn:',svcRes.status,errBody);
      /* ลอง PATCH แทน */
      const patchRes=await fetch(`${SVC}?ticket_no=eq.${encodeURIComponent(ticketNo)}`,{
        method:'PATCH',
        headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(svcPayload)
      });
      if(!patchRes.ok){console.warn('patch also failed, continuing with status update');}
    }

    /* 3. อัปเดต ticket status — นี่คือ core และต้องสำเร็จ */
    let newStatus, logComment;
    if(sendToITL){
      newStatus='ITL_WAIT';
      logComment='ICO บันทึกงานและส่งต่อ ITL';
    } else {
      newStatus=['OPEN','MGR_WAIT'].includes(currentTicket.status)?'ICO_WORK':currentTicket.status;
      logComment='ICO บันทึกร่าง';
    }
    const _now=new Date().toISOString();
    const _tsField=sendToITL?{status:newStatus,ico_submitted_at:_now}:{status:newStatus,ico_received_at:_now};
    const ticketRes=await fetch(`${API}?ticket_no=eq.${encodeURIComponent(ticketNo)}`,{
      method:'PATCH',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(_tsField)
    });
    if(!ticketRes.ok){const e=await ticketRes.text();throw new Error('อัปเดตสถานะไม่สำเร็จ: '+e);}

    /* 4. บันทึก log */
    const logRes=await fetch(LOG,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ticket_no:ticketNo,step_name:'ICT_ACTION',status:sendToITL?'APPROVED':'DRAFT',action_by:staff,comment:logComment})
    });
    if(!logRes.ok){
      const le=await logRes.text();
      console.error('[ICO] เขียน log ไม่สำเร็จ:',logRes.status,le);
      showToast(`⚠️ บันทึกงานสำเร็จ แต่เขียน log ไม่สำเร็จ (HTTP ${logRes.status}) — ตรวจสอบชื่อตาราง tickets_log`,'err');
    }

    icoFiles=[];document.getElementById('icoFileList').innerHTML='';
    /* ── N8N Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
      event:         sendToITL?'ICT_ACTION':'ICO_DRAFT',
      action:        sendToITL?'SUBMITTED':'DRAFT',
      new_status:    newStatus,
      ticket_no:     ticketNo,
      requester_name:  currentTicket.requester_name  ||'',
      requester_email: currentTicket.requester_email ||'',
      department:    currentTicket.department  ||'',
      location:      currentTicket.location    ||'',
      issue_detail:  currentTicket.issue_detail||'',
      request_date:  currentTicket.request_date||'',
      staff_name:    staff,
      job_category:  svcPayload.job_category   ||'',
      inspection_detail: svcPayload.inspection_detail||'',
      action_detail: svcPayload.action_detail  ||'',
      spare_parts:   svcPayload.spare_parts_detail||'',
      repair_cost:   svcPayload.repair_cost    ||0,
      work_hours:    svcPayload.work_hours     ||0,
      finish_date:   svcPayload.finish_date    ||'',
      priority:      priority,
      timestamp:     new Date().toISOString()
})
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}
    showToast(sendToITL?'✅ ส่งต่อ ITL แล้ว':'💾 บันทึกร่างแล้ว', sendToITL?'ok':'');
    closeModal();
    await refreshAll();
  }catch(e){
    console.error('saveService error:',e);
    showToast('❌ '+e.message,'err');
  }
  finally{btn.disabled=false;btn.innerHTML=orig;}
}

/* ═══ CLOSE WORK ═══ */
async function closeWork(){
  const staff=document.getElementById('f-staff').value.trim()||'ICO';
  const summary=document.getElementById('f-summary').value.trim();
  if(!summary){showToast('กรุณากรอกสรุปผลการดำเนินงานก่อนปิด','err');return;}
  const btn=document.getElementById('btn-close-work');
  const orig=btn.innerHTML;btn.disabled=true;btn.innerHTML='กำลังปิดงาน...';
  const ticketNo=currentTicket.ticket_no;
  try{
    const result=document.getElementById('f-result').value;
    const finishDate=document.getElementById('f-finish').value||new Date().toISOString().slice(0,10);

    /* 1. บันทึก service data ล่าสุดก่อน (ignore error) */
    try{ await saveServiceData(staff); }catch(e2){console.warn('saveServiceData warn:',e2);}

    /* 2. อัปเดต close summary ใน ticket_services */
    await fetch(`${SVC}?ticket_no=eq.${encodeURIComponent(ticketNo)}`,{
      method:'PATCH',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({close_summary:summary,close_result:result,finish_date:finishDate})
    });

    /* 3. อัปเดต ticket → DONE (core step) */
    const doneRes=await fetch(`${API}?ticket_no=eq.${encodeURIComponent(ticketNo)}`,{
      method:'PATCH',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({status:'DONE',closed_at:new Date().toISOString()})
    });
    if(!doneRes.ok){const e=await doneRes.text();throw new Error('ปิดงานไม่สำเร็จ: '+e);}

    /* 4. log */
    const logRes=await fetch(LOG,{
      method:'POST',
      headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ticket_no:ticketNo,step_name:'ICT_ACTION',status:'DONE',action_by:staff,comment:`ปิดงาน — ${summary}`})
    });
    if(!logRes.ok){
      const le=await logRes.text();
      console.error('[ICO] เขียน log ไม่สำเร็จ:',logRes.status,le);
      showToast(`⚠️ ปิดงานสำเร็จ แต่เขียน log ไม่สำเร็จ (HTTP ${logRes.status}) — ตรวจสอบชื่อตาราง tickets_log`,'err');
    }

    /* ── N8N Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
      event:         'DONE',
      action:        'CLOSED',
      new_status:    'DONE',
      ticket_no:     ticketNo,
      requester_name:  currentTicket.requester_name  ||'',
      requester_email: currentTicket.requester_email ||'',
      department:    currentTicket.department  ||'',
      issue_detail:  currentTicket.issue_detail||'',
      staff_name:    staff,
      close_summary: summary,
      close_result:  result,
      finish_date:   finishDate,
      repair_cost:   document.getElementById('f-cost').value||0,
      closed_at:     new Date().toISOString(),
      survey_link:   window.location.origin+'/survey.html?ticket='+encodeURIComponent(ticketNo),
      timestamp:     new Date().toISOString()
})
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}
    showToast('🎉 ปิดงานเรียบร้อย!','ok');
    closeModal();await refreshAll();
  }catch(e){
    console.error('closeWork error:',e);
    showToast('❌ '+e.message,'err');
  }
  finally{btn.disabled=false;btn.innerHTML=orig;}
}

async function saveServiceData(staff){
  const payload={
    ticket_no:currentTicket.ticket_no,staff_name:staff||document.getElementById('f-staff').value.trim(),
    received_date:document.getElementById('f-received').value||null,
    job_category:document.getElementById('f-category').value||null,
    priority:document.getElementById('f-priority').value||'MED',
    inspection_detail:document.getElementById('f-inspection').value.trim()||null,
    action_detail:document.getElementById('f-action').value.trim()||null,
    spare_parts_detail:document.getElementById('f-parts').value.trim()||null,
    repair_cost:parseFloat(document.getElementById('f-cost').value)||null,
    finish_date:document.getElementById('f-finish').value||null,
    work_hours:parseFloat(document.getElementById('f-hours').value)||null,
    recommendations:document.getElementById('f-recommend').value.trim()||null,
    additional_notes:document.getElementById('f-notes').value.trim()||null,
    updated_at:new Date().toISOString(),
  };
  const method=currentSvc?'PATCH':'POST';
  const url=currentSvc?`${SVC}?ticket_no=eq.${encodeURIComponent(currentTicket.ticket_no)}`:SVC;
  await fetch(url,{method,headers:{...HDR,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}

/* ═══ COMMENT ═══ */
async function addComment(){
  if(!currentTicket)return;
  const text=document.getElementById('newComment').value.trim();
  if(!text){showToast('กรุณาพิมพ์ความเห็นก่อน','err');return;}
  const isInternal=document.getElementById('commentInternal')?.checked;
  try{
    const staff=document.getElementById('f-staff').value.trim()||'ICO';
    const logRes=await fetch(LOG,{method:'POST',headers:{...HDR,'Content-Type':'application/json'},body:JSON.stringify({ticket_no:currentTicket.ticket_no,step_name:'ICO_CHECK',status:isInternal?'INTERNAL_NOTE':'COMMENT',action_by:staff,comment:text})});
    if(!logRes.ok){
      const le=await logRes.text();
      console.error('[ICO] เขียน log ไม่สำเร็จ:',logRes.status,le);
      showToast(`❌ บันทึกไม่สำเร็จ (HTTP ${logRes.status}) — ตรวจสอบชื่อตาราง tickets_log ใน Supabase`,'err');
      return;
    }
    document.getElementById('newComment').value='';
    if(document.getElementById('commentInternal'))document.getElementById('commentInternal').checked=false;
    await loadLog(currentTicket.ticket_no);
    showToast(isInternal?'✅ บันทึกข้อความภายในทีมแล้ว':'✅ เพิ่มความเห็นแล้ว','ok');
  }catch(e){showToast('❌ '+e.message,'err');}
}

/* ═══ FILES ═══ */
function handleFiles(files){icoFiles=[...icoFiles,...Array.from(files)].slice(0,10);renderFileList();}
function handleDrop(e){e.preventDefault();handleFiles(e.dataTransfer.files);}
function renderFileList(){
  document.getElementById('icoFileList').innerHTML=icoFiles.map((f,i)=>`
    <div class="file-item">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="file-item-name">${esc(f.name)}</span>
      <span style="font-size:10px;color:var(--mute);">${(f.size/1024).toFixed(0)}KB</span>
      <button class="file-remove" onclick="icoFiles.splice(${i},1);renderFileList()">×</button>
    </div>`).join('');
}
async function uploadFiles(files,folder){
  const urls=[];
  for(const f of files){
    const path=`${folder}/${Date.now()}-${f.name}`;
    const r=await fetch(`${STORE}/${path}`,{method:'POST',headers:{...HDR,'Content-Type':f.type||'application/octet-stream','x-upsert':'true'},body:f});
    if(r.ok)urls.push(`${PUB}/${path}`);
  }
  return urls;
}
function jsq(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function fLink(url){
  const n=decodeURIComponent(url.split('/').pop());
  return`<a class="glink" href="javascript:void(0)" onclick="openFilePreview('${jsq(url)}','${jsq(n)}')"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(n)}</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></a>`;
}

/* เปิดพรีวิวไฟล์ในหน้าเดียวกัน แทนการเปิดแท็บใหม่ที่มักถูกบังคับดาวน์โหลด
   - รูปภาพ → แสดงตรงๆ
   - PDF → ฝังด้วย <iframe> (เบราว์เซอร์แสดงตัวอย่างในตัวโดยไม่ดาวน์โหลด)
   - Word/Excel/อื่นๆ → ใช้ Google Docs Viewer แสดงตัวอย่าง พร้อมปุ่มดาวน์โหลดสำรอง */
function openFilePreview(url,name){
  const ext=(name.split('.').pop()||'').toLowerCase();
  document.getElementById('fpName').textContent=name;
  document.getElementById('fpDownload').href=url;
  const body=document.getElementById('fpBody');
  body.innerHTML='';
  if(['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)){
    body.style.background='#111';
    body.innerHTML=`<img src="${esc(url)}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
  }else if(ext==='pdf'){
    body.style.background='#525659';
    body.innerHTML=`<iframe src="${esc(url)}" style="width:100%;height:100%;border:none;"></iframe>`;
  }else if(['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)){
    body.style.background='#fff';
    body.innerHTML=`<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true" style="width:100%;height:100%;border:none;"></iframe>`;
  }else{
    body.style.background='#fff';
    body.innerHTML=`<div style="text-align:center;color:var(--sub);padding:30px;font-size:13px;">ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้<br>กรุณากด "ดาวน์โหลด" เพื่อเปิดไฟล์</div>`;
  }
  document.getElementById('filePreviewModal').style.display='flex';
}
function closeFilePreview(){
  document.getElementById('filePreviewModal').style.display='none';
  document.getElementById('fpBody').innerHTML='';
}

/* ═══ TABS ═══ */
function switchTab(id,btn){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(btn)btn.classList.add('active');
}

/* ═══ UTILS ═══ */
function fmtD(s){if(!s)return'—';return new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});}
/* รูปแบบวันที่-เวลาแบบไทย: dd/mm/พ.ศ. (4 หลัก) hh:mm น. เช่น 03/07/2569 14:30 น. */
function fmtDT(s){
  if(!s)return'—';
  const d=new Date(s);
  if(isNaN(d.getTime()))return'—';
  const day=String(d.getDate()).padStart(2,'0');
  const mon=String(d.getMonth()+1).padStart(2,'0');
  const yrBE=d.getFullYear()+543;              // ปี พ.ศ.
  const hr=String(d.getHours()).padStart(2,'0');
  const mn=String(d.getMinutes()).padStart(2,'0');
  return `${day}/${mon}/${yrBE} ${hr}:${mn} น.`;
}
function toArr(v){if(!v)return[];if(Array.isArray(v))return v.filter(Boolean);if(typeof v==='string'&&v.startsWith('{'))return v.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,'')).filter(Boolean);return[v];}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function openLB(url){document.getElementById('lbImg').src=url;document.getElementById('lb').style.display='flex';}
function closeLB(){document.getElementById('lb').style.display='none';}
let toastTimer;
function showToast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(type?' '+type:'');void t.offsetWidth;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}

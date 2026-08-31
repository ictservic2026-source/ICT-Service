
/* ──────── CONFIG ──────── */
const SB   = "https://dcsjvursqnvhcwbeqzmd.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg";
const HDR  = {'apikey':KEY,'Authorization':'Bearer '+KEY};
const TAPI = `${SB}/rest/v1/tickets`;
const SAPI = `${SB}/rest/v1/ticket_services`;
const SURV = `${SB}/rest/v1/ticket_survey`;

/* ──────── STATE ──────── */
const scores   = {1:0,2:0,3:0,4:0,5:0};
const maxPts   = {1:30,2:30,3:20,4:10,5:10};
const chkState = {c1:false,c2:false};
let ticketNo   = '';
let submitted  = false;

/* ──────── INIT ──────── */
const params = new URLSearchParams(location.search);
ticketNo = params.get('ticket')||'';

(async function init(){
  if(!ticketNo){
    document.getElementById('ticketLoading').textContent='ไม่พบเลขที่งาน — กรุณาเข้าผ่านลิงก์ที่ได้รับจาก ICT';
    document.getElementById('btnSubmit').disabled=true;
    return;
  }
  try{
    /* load ticket */
    const r1=await fetch(`${TAPI}?ticket_no=eq.${enc(ticketNo)}&limit=1`,{headers:HDR});
    const t=await r1.json();
    document.getElementById('ticketLoading').style.display='none';
    if(t[0]){
      const tk=t[0];
      set('tc-no',tk.ticket_no);
      set('tc-requester',(tk.requester_name||'—')+(tk.department?` — ${tk.department}`:''));
      set('tc-dept',tk.department||'—');
      set('tc-issue',tk.issue_detail||'—');
      document.getElementById('ticketCard').style.display='';
      /* load service data */
      try{
        const r2=await fetch(`${SAPI}?ticket_no=eq.${enc(ticketNo)}&limit=1`,{headers:HDR});
        const sv=await r2.json();
        if(sv[0]){
          if(sv[0].action_detail){
            set('tc-action',sv[0].action_detail.slice(0,120)+(sv[0].action_detail.length>120?'…':''));
            document.getElementById('tc-action-row').style.display='';
          }
          if(sv[0].staff_name){
            set('tc-staff',sv[0].staff_name);
            document.getElementById('tc-staff-row').style.display='';
          }
        }
      }catch(e2){}
    }
    /* check existing survey */
    const r3=await fetch(`${SURV}?ticket_no=eq.${enc(ticketNo)}&limit=1`,{headers:HDR});
    const ex=await r3.json();
    if(ex&&ex.length){
      const ab=document.getElementById('alreadyBanner');
      ab.style.display='block';
      ab.textContent=`✅ คุณส่งแบบประเมินแล้ว (คะแนน: ${ex[0].score_total||'—'}/100) ขอบคุณ!`;
      document.getElementById('btnSubmit').disabled=true;
    }
  }catch(e){
    document.getElementById('ticketLoading').textContent='โหลดข้อมูลไม่สำเร็จ';
    console.error(e);
  }
})();

/* ──────── BUILD TRACKS ──────── */
[1,2,3,4,5].forEach(i=>{
  const wrap=document.getElementById(`trk-${i}`);
  const max=maxPts[i];
  /* build DOM */
  wrap.innerHTML=`
    <div class="score-track-bg">
      <div class="score-track-fill" id="fill-${i}" style="width:0%"></div>
    </div>
    <div class="score-track-thumb" id="thumb-${i}" style="left:0%"></div>
    <div class="score-ticks">
      <span class="score-tick">0</span>
      <span class="score-tick">${Math.round(max*0.25)}</span>
      <span class="score-tick">${Math.round(max*0.5)}</span>
      <span class="score-tick">${Math.round(max*0.75)}</span>
      <span class="score-tick">${max}</span>
    </div>`;
  /* events */
  function setFromX(clientX){
    const rect=wrap.getBoundingClientRect();
    const pct=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    const val=Math.round(pct*max);
    setScore(i,val);
  }
  let dragging=false;
  wrap.addEventListener('mousedown',e=>{dragging=true;setFromX(e.clientX);});
  wrap.addEventListener('mousemove',e=>{if(dragging)setFromX(e.clientX);});
  document.addEventListener('mouseup',()=>{dragging=false;});
  wrap.addEventListener('touchstart',e=>{e.preventDefault();setFromX(e.touches[0].clientX);},{passive:false});
  wrap.addEventListener('touchmove',e=>{e.preventDefault();setFromX(e.touches[0].clientX);},{passive:false});
});

/* ──────── SCORE LOGIC ──────── */
function setScore(item,val){
  scores[item]=val;
  const max=maxPts[item];
  const pct=(val/max)*100;
  document.getElementById(`fill-${item}`).style.width=pct+'%';
  document.getElementById(`thumb-${item}`).style.left=pct+'%';
  document.getElementById(`thumb-${item}`).classList.add('active');
  document.getElementById(`cur-${item}`).textContent=val;
  document.getElementById(`si-${item}`).classList.add('touched');
  /* color the current score */
  const ratio=val/max;
  const col=ratio>=0.8?'var(--g)':ratio>=0.5?'var(--amber)':'var(--red)';
  document.getElementById(`cur-${item}`).style.color=col;
  /* hint */
  const {text,emoji,color}=getHint(ratio);
  document.getElementById(`hint-${item}`).textContent=text;
  document.getElementById(`hint-${item}`).style.color=color;
  document.getElementById(`emo-${item}`).textContent=emoji;
  updateTotal();
}

function getHint(r){
  if(r===0)       return{text:'ยังไม่ได้ให้คะแนน',emoji:'',color:'var(--mute)'};
  if(r<=0.2)      return{text:'ควรปรับปรุงอย่างเร่งด่วน',emoji:'😞',color:'var(--red)'};
  if(r<=0.4)      return{text:'ต่ำกว่าความคาดหวัง',emoji:'😐',color:'#EA580C'};
  if(r<=0.6)      return{text:'พอใช้ได้',emoji:'🙂',color:'var(--amber)'};
  if(r<=0.75)     return{text:'ดี',emoji:'😊',color:'#65A30D'};
  if(r<=0.9)      return{text:'ดีมาก',emoji:'😄',color:'var(--g)'};
  return           {text:'ดีเยี่ยม!',emoji:'🤩',color:'var(--g)'};
}

/* ──────── TOTAL ──────── */
function updateTotal(){
  const total=Object.values(scores).reduce((a,b)=>a+b,0);
  document.getElementById('total-num').textContent=total;
  document.getElementById('total-bar').style.width=total+'%';
  const col=total>=80?'var(--g)':total>=60?'var(--amber)':'var(--red)';
  document.getElementById('total-num').style.color=col;
  const grade=total>=90?'🏆 ดีเยี่ยม':total>=75?'🎯 ดีมาก':total>=60?'👍 ดี':total>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
  document.getElementById('grade-text').textContent=grade;
}

/* ──────── CHECKBOX ──────── */
function toggleChk(id){
  chkState[id]=!chkState[id];
  document.getElementById(id).classList.toggle('on',chkState[id]);
}

/* ──────── SUBMIT ──────── */
/* ──────── SIGN TABS ──────── */
let currentSignTab='type';
let sigHasData=false;
let sigCtx=null;
let sigDrawing=false;

function switchSignTab(tab){
  currentSignTab=tab;
  document.getElementById('tab-type').classList.toggle('active',tab==='type');
  document.getElementById('tab-draw').classList.toggle('active',tab==='draw');
  document.getElementById('pane-type').style.display=tab==='type'?'':'none';
  document.getElementById('pane-draw').style.display=tab==='draw'?'':'none';
  if(tab==='draw'&&!sigCtx) initCanvas();
}

function initCanvas(){
  const canvas=document.getElementById('sigCanvas');
  sigCtx=canvas.getContext('2d');
  // scale for retina
  const ratio=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*ratio;
  canvas.height=130*ratio;
  sigCtx.scale(ratio,ratio);
  sigCtx.strokeStyle='#1447A0';
  sigCtx.lineWidth=2;
  sigCtx.lineCap='round';
  sigCtx.lineJoin='round';
  // mouse
  canvas.addEventListener('mousedown',e=>{sigDrawing=true;const p=getPos(canvas,e);sigCtx.beginPath();sigCtx.moveTo(p.x,p.y);hidePlaceholder();});
  canvas.addEventListener('mousemove',e=>{if(!sigDrawing)return;const p=getPos(canvas,e);sigCtx.lineTo(p.x,p.y);sigCtx.stroke();sigHasData=true;});
  canvas.addEventListener('mouseup',()=>{sigDrawing=false;});
  canvas.addEventListener('mouseleave',()=>{sigDrawing=false;});
  // touch
  canvas.addEventListener('touchstart',e=>{e.preventDefault();sigDrawing=true;const p=getTouchPos(canvas,e);sigCtx.beginPath();sigCtx.moveTo(p.x,p.y);hidePlaceholder();},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!sigDrawing)return;const p=getTouchPos(canvas,e);sigCtx.lineTo(p.x,p.y);sigCtx.stroke();sigHasData=true;},{passive:false});
  canvas.addEventListener('touchend',()=>{sigDrawing=false;});
}

function hidePlaceholder(){
  document.getElementById('canvasPlaceholder').classList.add('hidden');
  document.getElementById('canvasHint').textContent='มีลายเซ็น ✓';
  document.getElementById('canvasHint').style.color='var(--g)';
}

function clearCanvas(){
  if(!sigCtx)return;
  const canvas=document.getElementById('sigCanvas');
  sigCtx.clearRect(0,0,canvas.width,canvas.height);
  sigHasData=false;
  document.getElementById('canvasPlaceholder').classList.remove('hidden');
  document.getElementById('canvasHint').textContent='ยังไม่ได้เซ็น';
  document.getElementById('canvasHint').style.color='var(--mute)';
}

function getPos(canvas,e){
  const rect=canvas.getBoundingClientRect();
  return{x:(e.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1)),y:(e.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1))};
}
function getTouchPos(canvas,e){
  const rect=canvas.getBoundingClientRect();
  const t=e.touches[0];
  return{x:(t.clientX-rect.left)*(canvas.width/rect.width/(window.devicePixelRatio||1)),y:(t.clientY-rect.top)*(canvas.height/rect.height/(window.devicePixelRatio||1))};
}

/* ──────── SUBMIT ──────── */
async function submitSurvey(){
  if(submitted)return;
  const total=Object.values(scores).reduce((a,b)=>a+b,0);
  if(total===0){showErr('กรุณาให้คะแนนอย่างน้อย 1 หัวข้อก่อน');return;}
  /* validate signer */
  let signerName='';
  let sigDataUrl=null;
  if(currentSignTab==='type'){
    signerName=document.getElementById('sv-name-typed').value.trim();
    if(!signerName){
      document.getElementById('sv-name-typed').focus();
      showErr('กรุณาพิมพ์ชื่อ-นามสกุลผู้ประเมินก่อนส่ง');return;
    }
  }else{
    if(!sigHasData){showErr('กรุณาเซ็นชื่อในกล่องลายเซ็นก่อนส่ง');return;}
    sigDataUrl=document.getElementById('sigCanvas').toDataURL('image/png');
    signerName='[ลายเซ็น]';
  }
  const btn=document.getElementById('btnSubmit');
  const orig=btn.innerHTML;
  btn.disabled=true;
  btn.innerHTML='<span class="spin">⏳</span> กำลังส่ง...';
  try{
    const payload={
      ticket_no:     ticketNo,
      score_q1:      scores[1],
      score_q2:      scores[2],
      score_q3:      scores[3],
      score_q4:      scores[4],
      score_q5:      scores[5],
      /* score_total เป็น Generated Column ใน DB (คำนวณอัตโนมัติจาก q1-q5) ห้ามส่งค่าเข้ามาตรงๆ */
      chk_resolved:  chkState.c1,
      chk_explained: chkState.c2,
      comment:       document.getElementById('sv-comment').value.trim()||null,
      submitted_by:  signerName,
      signature_data: sigDataUrl,
    };
    /* ลองส่งพร้อม signature_data ก่อน ถ้า error (column ไม่มี) ให้ส่งใหม่โดยไม่มี field นั้น */
    let r=await fetch(SURV,{method:'POST',headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(payload)});
    if(!r.ok&&r.status!==201){
      const errText=await r.text();
      if(errText.includes('signature_data')||errText.includes('PGRST204')){
        /* column ยังไม่มีใน DB — ส่งใหม่โดยไม่มี signature_data */
        const p2={...payload};delete p2.signature_data;
        r=await fetch(SURV,{method:'POST',headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(p2)});
        if(!r.ok&&r.status!==201){const e2=await r.text();throw new Error(e2);}
      } else {
        throw new Error(errText);
      }
    }
    await fetch(`${TAPI}?ticket_no=eq.${enc(ticketNo)}`,{method:'PATCH',headers:{...HDR,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({survey_score:total})});
    /* ── Make.com Webhook ── */
    try{
      await fetch('https://pecan-magnifier-sister.ngrok-free.dev/webhook-test/b6054835-5826-4787-85b3-7bb26d5ba185',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          event:         'SURVEY_SUBMITTED',
          action:        'SUBMITTED',
          ticket_no:     ticketNo,
          score_total:   total,
          score_q1:      scores[1],
          score_q2:      scores[2],
          score_q3:      scores[3],
          score_q4:      scores[4],
          score_q5:      scores[5],
          chk_resolved:  chkState.c1,
          chk_explained: chkState.c2,
          submitted_by:  signerName,
          comment:       document.getElementById('sv-comment').value.trim()||'',
          timestamp:     new Date().toISOString()
        })
      });
    }catch(wErr){console.warn('[Make webhook]',wErr);}
    submitted=true;
    showSuccess(total,signerName,sigDataUrl);
  }catch(e){
    btn.disabled=false;btn.innerHTML=orig;
    showErr('ส่งไม่สำเร็จ: '+e.message);
  }
}

function showSuccess(total,signerName,sigDataUrl){
  document.getElementById('formSection').style.display='none';
  const sw=document.getElementById('successWrap');
  sw.style.display='block';
  document.getElementById('suc-total').textContent=total+'/100';
  const grade=total>=90?'🏆 ดีเยี่ยม':total>=75?'🎯 ดีมาก':total>=60?'👍 ดี':total>=50?'😐 พอใช้':'⚠️ ควรปรับปรุง';
  document.getElementById('suc-grade').textContent=grade;
  document.getElementById('suc-grade').style.color=total>=75?'var(--g)':total>=50?'var(--amber)':'var(--red)';
  const labels={1:'แก้ไขตรงรายการ',2:'ตรงเวลา',3:'การอธิบาย',4:'ความสุภาพ',5:'พึงพอใจรวม'};
  document.getElementById('suc-breakdown').innerHTML=Object.entries(scores).map(([k,v])=>`
    <div class="sb-item">
      <span class="sb-label">${labels[k]}</span>
      <span class="sb-val">${v}<span style="font-size:10px;color:var(--mute);">/${maxPts[k]}</span></span>
    </div>`).join('');
  /* show signer */
  const sigBox=document.createElement('div');
  sigBox.style.cssText='margin-top:10px;padding:10px;background:var(--w);border-radius:8px;border:1px solid var(--gb);text-align:left;';
  if(sigDataUrl){
    sigBox.innerHTML=`<div style="font-size:10px;color:var(--sub);margin-bottom:4px;font-weight:600;">ลายเซ็นผู้ประเมิน</div><img src="${sigDataUrl}" style="max-width:100%;height:60px;object-fit:contain;border-radius:4px;">`;
  }else{
    sigBox.innerHTML=`<div style="font-size:10px;color:var(--sub);margin-bottom:2px;font-weight:600;">ผู้ประเมิน</div><div style="font-size:13px;font-weight:700;color:var(--g);">${signerName}</div>`;
  }
  document.getElementById('suc-breakdown').after(sigBox);
}

function showErr(msg){
  const el=document.getElementById('errToast');
  el.textContent='❌ '+msg;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),5000);
}
function set(id,val){const e=document.getElementById(id);if(e)e.textContent=val;}
function enc(s){return encodeURIComponent(s);}

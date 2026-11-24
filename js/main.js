import {adjust} from './dda.js';
import {demo,localDate,fresh,valid,read,save,download,changed} from './storage.js';
import {el,button} from './ui.js';
import {report} from './report.js';
import {sample} from './debug.js';
import {cups} from './stages/cups.js';
import {puzzle} from './stages/puzzle.js';
import {poker} from './stages/poker.js';

const stages={
  cups:{name:'迷蹤茶杯',intro:'看懷錶藏在哪裡。茶杯停下後，點選你追蹤的那一杯。',limit:90000,run:cups},
  puzzle:{name:'碎裂茶盤',intro:'選一塊碎片，再找形狀相同的缺口。也可以直接拖過去。',limit:75000,run:puzzle},
  poker:{name:'士兵大閱兵',intro:'看清楚皇后的指令，只點符合花色的士兵。',limit:70000,run:poker}
};
const roomNames=['瘋帽客的午後茶室','紅心皇后的玫瑰花園','柴郡貓的微光蘑菇林','白兔先生的懷錶書房'];
const queues=[
  'cups puzzle poker','cups puzzle poker','cups poker','cups puzzle','puzzle cups','puzzle poker','cups puzzle poker',
  'cups puzzle','puzzle cups','cups poker','cups puzzle','puzzle cups','puzzle poker cups','cups puzzle poker'
].map(queue=>queue.split(' '));
const compare=[3,6,10,13];
const limit=30*60*1000;
const app=document.querySelector('#app');
const pauseButton=document.querySelector('#pause');
const muteButton=document.querySelector('#mute');
const portrait=document.querySelector('#portrait');
const orientation=matchMedia('(orientation: portrait) and (pointer: coarse)');
let data,game,writeAccess=false,blocked=false,audioContext;

function commit(change) {
  if(!writeAccess||blocked)throw Error('請在原遊玩分頁繼續。');
  const next=structuredClone(data);
  change(next);
  save(next);
  data=next;
}
function safe(action){
  try{action();}catch(error){const notice=el('p',error.message||'進度暫時無法寫入。','status');notice.setAttribute('role','alert');app.prepend(notice);}
}
function panel(title,text){
  app.replaceChildren();
  pauseButton.hidden=true;
  const root=el('section',undefined,'card');
  if(title)root.append(el('h1',title));
  if(text)root.append(el('p',text,'muted'));
  app.append(root);
  return root;
}
const room=day=>day===14?'白兔的祕密茶會':roomNames[(day-1)%4];
const timeOfDay=()=>{const hour=new Date().getHours();return hour>=5&&hour<12?'早上':hour>=12&&hour<18?'下午':'晚上';};
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
function showReport(){
  const root=panel();
  report(root,data,stages);
}
function home(){
  if(game)return pause();
  if(blocked){panel('請在原遊玩分頁繼續','重新開啟此頁即可再次取得遊玩權限。');return;}
  if(!data){settings();return;}
  if(!data.accepted){
    const root=panel('打開奇境大門','歡迎來到奇境茶會。你可以自己練習，也可以把遊玩紀錄分享給家人。');
    root.append(button('開始探索',()=>safe(()=>{commit(next=>next.accepted=true);home();}),'primary'));
    return;
  }
  const ended=data.day===15;
  const rested=!demo&&data.closedDate===localDate()&&!data.active;
  const root=panel();
  const hero=el('div',undefined,'hero'),copy=el('div'),seal=el('div','♧','seal');
  seal.setAttribute('aria-hidden','true');hero.append(copy,seal);root.append(hero);
  copy.append(el('p',demo?'時光機 · 展示模式':'愛麗絲的奇境茶會','muted'),
    el('h1',ended?'奇境紀念館':rested?'白兔休息室':'每日專注力探索'),
    el('p',ended?'旅程結束了。一起回顧你的奇境足跡吧。':rested?'今天的探險已結束。白兔正在午睡，明天再一起出發吧。':'第 '+data.day+'／14 天 · '+room(data.day)));
  const actions=el('div',undefined,'actions');
  if(!ended&&!rested)actions.append(button(data.active?'繼續旅程':'進入今日屋子',()=>safe(data.active?resumeSession:energy),'primary'));
  actions.append(button('查看紀錄',showReport),button('設定',settings));
  copy.append(actions);
  if(/Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent))copy.append(el('p','建議以 Safari 或 Chrome 開啟，並在設定匯出進度備份。'));
}
function energy(){
  if(!demo&&data.closedDate===localDate())return home();
  const root=panel('今天的精神電量？','選一個最像你現在的感覺。');
  const actions=el('div',undefined,'actions');
  ['滿格','一半','快沒電'].forEach(value=>actions.append(button(value,()=>safe(()=>{
    commit(next=>next.active={day:next.day,started:localDate(),energy:value,time:timeOfDay(),queue:queues[next.day-1],results:[],attempts:[],spent:0,pending:null});
    briefing();
  }))));
  root.append(actions);
}
function resumeSession(){
  const pending=data.active.pending;
  commit(next=>{
    if(pending){ next.active.attempts.push({...pending,status:'中斷'});next.active.pending=null; }
    if(next.active.started!==localDate()&&next.active.resumed?.date!==localDate())next.active.resumed={date:localDate(),time:timeOfDay()};
  });
  briefing();
}
function briefing(){
  const session=data.active;
  if(session.results.length===session.queue.length||session.spent>=limit)return finishDay();
  const id=session.queue[session.results.length], stage=stages[id];
  const root=panel(stage.name,stage.intro);
  root.prepend(el('p','🐾 第 '+(session.results.length+1)+'／'+session.queue.length+' 關','progress'));
  root.append(button('開始這一關',()=>safe(()=>start(id)),'primary'),button('回到大門',home));
}
function playSound(success){
  if(data.settings.muted)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  try{
    audioContext??=new Audio();
    const now=audioContext.currentTime, tone=audioContext.createOscillator(),volume=audioContext.createGain();
    tone.type='sine';tone.frequency.value=success?655:212;
    volume.gain.setValueAtTime(.045,now);volume.gain.exponentialRampToValueAtTime(.001,now+.13);
    tone.connect(volume).connect(audioContext.destination);tone.start(now);tone.stop(now+.14);
  }catch{}
}
function parameters(id,level,fixed){
  if(id==='cups')return {version:1,cups:3,exchanges:2+2*level,stepMs:510,hintMs:8000,revealMs:5000};
  if(id==='puzzle')return {version:1,gaps:level===1?2:3,decoys:level===3?2:1,hintMs:10000,secondHintMs:5000,wrongLimit:2};
  return {version:1,segments:fixed?2:level,perType:fixed?6:6/level,stimulusMs:2500,switchMs:1500};
}
function start(id){
  const stage=stages[id],session=data.active;
  const fixed=id==='poker'&&compare.includes(session.day);
  const level=session.entryLevel??data.dda[id].level;
  const record={id,attempt:uid(),fixed,level,parameters:parameters(id,level,fixed),rows:[]};
  commit(next=>{next.active.pending=record;next.active.entryLevel=level;});
  const root=panel(stage.name);
  const body=el('div');
  root.prepend(el('p','🐾 第 '+(session.results.length+1)+'／'+session.queue.length+' 關','progress'));
  root.append(body);pauseButton.hidden=false;
  const run={record,root,body,elapsed:0,previous:null,initial:session.spent,stageSpent:session.stageSpent||0,
    timers:[],paused:false,done:false,lastSave:0};
  game=run;
  const ctx={body,fixed,level,reduced:data.settings.reduced,now:()=>run.elapsed,
    row(values){const row={errors:0,hints:[],...values};record.rows.push(row);return row;},
    hint(row,reason){row.hint=true;row.hints.push({reason,at:Math.round(run.elapsed)});},
    after(ms,callback){run.timers.push({at:run.elapsed+ms,callback});},
    finish(reason){settle(reason||'finish');},
    feedback:playSound};
  run.controller=stage.run(ctx);
  if(session.spent>=limit||run.stageSpent>=stage.limit){settle('time');return;}
  if(orientation.matches||document.hidden)pause();
  requestAnimationFrame(tick);
  function tick(now){
    if(game!==run||run.done)return;
    if(!run.paused){
      if(run.previous!==null)run.elapsed+=Math.min(now-run.previous,1000);
      run.previous=now;
      if(run.initial+run.elapsed>=limit||run.stageSpent+run.elapsed>=stage.limit){settle('time');return;}
      const due=run.timers.filter(timer=>timer.at<=run.elapsed);
      run.timers=run.timers.filter(timer=>timer.at>run.elapsed);
      for(const timer of due){if(!run.done)timer.callback();}
      if(!run.done&&run.elapsed-run.lastSave>=1000){
        run.lastSave=run.elapsed;
        try{checkpoint(run);}catch{pause();run.root.prepend(el('p','暫時無法儲存。請確認瀏覽器儲存空間後再繼續。'));}
      }
    }
    requestAnimationFrame(tick);
  }
}
function checkpoint(run){
  commit(next=>{
    next.active.spent=Math.round(run.initial+run.elapsed);
    next.active.stageSpent=Math.round(run.stageSpent+run.elapsed);
    next.active.pending=run.record;
  });
}
function pause(){
  const run=game;
  if(!run||run.paused||run.done)return;
  run.paused=true;run.previous=null;run.body.hidden=true;
  run.controller.pause?.();
  const menu=el('div',undefined,'actions');
  menu.append(button('繼續',()=>{if(orientation.matches||document.hidden)return;run.paused=false;run.previous=null;menu.remove();run.body.hidden=false;},'primary'),
    button('離開屋子',()=>safe(()=>{
      checkpoint(run);
      commit(next=>{next.active.attempts.push({...run.record,status:'中斷'});next.active.pending=null;});
      game=null;home();
    })),
    button('跳過這關',()=>{if(confirm('跳過後會進到下一關。確定要跳過嗎？'))settle('skip');}));
  run.root.append(menu);
}
function settle(reason){
  const run=game;
  if(!run||run.done)return;
  run.done=true;
  const {record}=run;
  if(reason!=='skip')run.controller.settle?.();
  const status={skip:'跳過',help:'協助收尾',time:'時間收尾',finish:'完成'}[reason];
  const root=panel(stages[record.id].name,
    reason==='skip'?'這一關先休息，繼續下一段旅程。':'白兔替你記下這一關的足跡。');
  function persist(){
    commit(next=>{
      const session=next.active;
      if(session.results.some(result=>result.attempt===record.attempt))return;
      const current=next.dda[record.id];
      const result=reason==='skip'?{...current,reason:'跳過'}:adjust(record.id,current,record.rows,record.fixed);
      next.dda[record.id]=result;
      session.results.push({...record,status,nextLevel:result.level,reason:result.reason,elapsed:Math.round(run.stageSpent+run.elapsed)});
      session.spent=Math.round(run.initial+run.elapsed);session.pending=null;session.entryLevel=null;session.stageSpent=0;
    });
    game=null;
  }
  if(reason==='finish')root.append(el('p','獨立作答 '+record.rows.filter(row=>row.outcome==='independent').length+' 次'));
  const control=button('繼續旅程',()=>safe(briefing),'primary');
  root.append(control);
  function trySave(){
    try{
      persist();
      control.textContent='繼續旅程';
      control.disabled=false;
    }catch{
      control.disabled=true;
      root.append(el('p','進度暫時無法儲存。'),button('重試儲存',event=>{
        event.currentTarget.previousElementSibling.remove();
        event.currentTarget.remove();
        trySave();
      }));
    }
  }
  trySave();
}
function finishDay(){
  commit(next=>{
    const session=next.active;
    while(session.results.length<session.queue.length){
      const id=session.queue[session.results.length];
      session.results.push({id,status:'因時間未開始',rows:[],attempt:uid(),fixed:id==='poker'&&compare.includes(session.day)});
    }
    session.closed=localDate();
    session.advanced=session.results.some(result=>['完成','協助收尾','時間收尾'].includes(result.status)&&result.rows.some(row=>row.acted));
    next.history.push(session);next.closedDate=session.closed;next.active=null;
    if(session.advanced){next.advancedDate=session.closed;next.day++;}
  });
  const milestone=data.history.at(-1).advanced&&(data.day===8||data.day===15);
  const root=panel(data.day===15?'白兔的祕密茶會':'今日旅程結束',data.day===15?'和愛麗絲、白兔一起喝杯茶吧。':'歡迎下次回來繼續探索。');
  if(milestone)root.append(button('查看遊玩報告',showReport,'primary'));
  root.append(button('回到大門',home));
}
function settings(){
  if(game)return pause();
  const root=panel('設定');
  if(!data)root.append(el('p','目前無法讀取進度。你可以匯入一份備份。'));
  if(data){
    root.append(button(data.settings.reduced?'減敏模式：開啟':'減敏模式：關閉',()=>safe(()=>{commit(next=>next.settings.reduced=!next.settings.reduced);settings();})));
    root.append(button('下載進度備份',()=>download((demo?'模擬資料-':'')+'奇境進度.json',JSON.stringify({...data,dataset:demo?'simulation':'play'},null,2))));
    if(data.day===15||demo)root.append(button('重開旅程',()=>safe(()=>{
      if(!confirm('確定要開啟新一輪？可先下載進度備份。'))return;
      commit(next=>Object.assign(next,fresh(),{accepted:true,settings:next.settings}));home();
    })));
    if(demo)for(const days of [7,14])root.append(button('載入 '+days+' 日模擬紀錄',()=>safe(()=>{
      if(!confirm('取代目前的展示紀錄？'))return;
      commit(next=>{next.history=sample(days,queues);next.day=days+1;next.active=null;});
      showReport();
    })));
    if(demo)root.append(button('前往下一個旅程日',()=>safe(()=>{
      commit(next=>{next.day=Math.min(15,next.day+1);next.active=null;});home();
    })));
  }
  const input=el('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','匯入進度備份');
  input.addEventListener('change',async()=>{
    if(!input.files.length)return;
    try{
      const incoming=JSON.parse(await input.files[0].text());
      if(!valid(incoming)||(!demo&&incoming.dataset!=='play'))throw Error('這份備份與目前的遊玩模式不相容。');
      if(confirm('要用這份備份取代目前進度嗎？')){
        if(!writeAccess||blocked)throw Error('請在原遊玩分頁繼續。');
        save(incoming);data=incoming;home();
      }
    }catch(error){root.append(el('p',error.message));}
  });
  root.append(el('h2','匯入進度備份'),input);
}
function updateMute(){muteButton.textContent=data?.settings.muted?'取消靜音':'靜音';muteButton.setAttribute('aria-pressed',String(Boolean(data?.settings.muted)));}
document.querySelector('#home').onclick=home;
document.querySelector('#settings').onclick=settings;
pauseButton.onclick=pause;
muteButton.onclick=()=>safe(()=>{if(data){commit(next=>next.settings.muted=!next.settings.muted);updateMute();}});
function rotate(){portrait.hidden=!orientation.matches;if(!portrait.hidden)pause();}
orientation.addEventListener('change',rotate);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(game&&!game.done)safe(()=>checkpoint(game));}});
window.addEventListener('pagehide',()=>{if(game&&!game.done){try{checkpoint(game);}catch{}}});
window.addEventListener('storage',event=>{if(changed(event)){blocked=true;game=null;home();}});
function boot(){
  writeAccess=true;
  try{data=read();}catch{data=null;}
  updateMute();rotate();home();
}
if(navigator.locks){
  navigator.locks.request(demo?'wonderland-demo':'wonderland-play',{ifAvailable:true},async lock=>{
    if(!lock){blocked=true;home();return;}
    boot();
    await new Promise(()=>{});
  }).catch(()=>panel('無法開啟遊玩分頁','請重新整理後再試。'));
}else boot();




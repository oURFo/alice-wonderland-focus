import {adjust} from './dda.js';
import {demo,localDate,fresh,valid,normalize,read,save,download,changed} from './storage.js';
import {el,button} from './ui.js';
import {report} from './report.js';
import {sample} from './debug.js';
import {art,sparkle,prepareArtwork} from './art.js';
import {cups} from './stages/cups.js';
import {puzzle} from './stages/puzzle.js';
import {poker,paradeTiming} from './stages/poker.js';
import {shooting,tiltControls} from './stages/shooting.js';
import {potion} from './stages/potion.js';

const stages={
  cups:{name:'迷蹤茶杯',intro:'看懷錶藏在哪裡。茶杯停下後，點選你追蹤的那一杯。',limit:90000,preview:'cup',run:cups},
  puzzle:{name:'碎裂茶盤',intro:'選一塊碎片，再找形狀相同的缺口。也可以直接拖過去。依序完成三個茶盤。',limit:180000,preview:'plate',run:puzzle},
  poker:{name:'士兵大閱兵',intro:'看清楚皇后的指令，只點符合花色的士兵。',limit:80000,preview:'heart-card',run:poker},
  shooting:{name:'搖擺果園',intro:'用搖桿或點按移動茶匙準心，瞄準金星紅蘋果再發射。條紋和蟲洞的果子留在原處。',limit:70000,preview:'apple-target',run:shooting},
  potion:{name:'秘密藥水',intro:'照配方倒入指定份量。輕點瓶子加四分之一格，按住可連續倒入。',limit:110000,preview:'rose-bottle',run:potion}
};
const roomNames=['瘋帽客的午後茶室','紅心皇后的玫瑰花園','柴郡貓的微光蘑菇林','白兔先生的懷錶書房'];
const queues=[
  'cups puzzle poker','cups puzzle poker','cups poker potion','cups potion shooting','puzzle shooting cups','puzzle poker potion','cups potion puzzle poker',
  'cups puzzle shooting','puzzle shooting potion','cups poker potion','cups puzzle shooting','puzzle shooting potion','puzzle poker cups','cups puzzle shooting potion poker'
].map(queue=>queue.split(' '));
const compare=[3,6,10,13];
const limit=30*60*1000;
const preparationMs=10000;
const app=document.querySelector('#app');
const pauseButton=document.querySelector('#pause');
const muteButton=document.querySelector('#mute');
const portrait=document.querySelector('#portrait');
const orientation=matchMedia('(orientation: portrait) and (pointer: coarse)');
let data,game,practice,writeAccess=false,blocked=false,audioContext;

function commit(change) {
  if(!writeAccess||blocked)throw Error('請在原遊玩分頁繼續。');
  const next=structuredClone(data);
  change(next);
  if(!practice)save(next);
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
  if(practice)endPractice();
  rotate();
  if(blocked){panel('請在原遊玩分頁繼續','重新開啟此頁即可再次取得遊玩權限。');return;}
  if(!data){settings();return;}
  if(!data.accepted){
    const root=panel('打開奇境大門','歡迎來到奇境茶會。你可以自己練習，也可以把遊玩紀錄分享給家人。');
    root.classList.add('cover');
    root.prepend(el('p','愛麗絲的奇境茶會','eyebrow'));
    root.append(button('開始探索',()=>safe(()=>{commit(next=>next.accepted=true);home();}),'primary'),button('試玩關卡',practiceMenu));
    return;
  }
  const ended=data.day===15;
  const rested=!demo&&data.closedDate===localDate()&&!data.active;
  const root=panel();
  root.classList.add('cover');
  const hero=el('div',undefined,'hero'),copy=el('div');
  hero.append(copy);root.append(hero);
  copy.append(el('p',demo?'時光機 · 展示模式':'愛麗絲的奇境茶會','muted'),
    el('h1',ended?'奇境紀念館':rested?'白兔休息室':'每日專注力探索'),
    el('p',ended?'旅程結束了。一起回顧你的奇境足跡吧。':rested?'今天的探險已結束。白兔正在午睡，明天再一起出發吧。':'第 '+data.day+'／14 天 · '+room(data.day)));
  const actions=el('div',undefined,'actions');
  if(!ended&&!rested)actions.append(button(data.active?'繼續旅程':'進入今日屋子',()=>safe(data.active?resumeSession:energy),'primary'));
  actions.append(button('試玩關卡',practiceMenu),button('查看紀錄',showReport),button('設定',settings));
  copy.append(actions);
  if(/Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent))copy.append(el('p','建議以 Safari 或 Chrome 開啟，並在設定匯出進度備份。'));
}
function practiceMenu(){
  if(practice)endPractice();
  const root=panel('試玩關卡','選擇關卡直接開始。試玩不會計入每日旅程、難度或報告。');
  const level=el('select');
  for(const value of [1,2,3]){
    const option=el('option','Lv. '+value);
    option.value=String(value);
    level.append(option);
  }
  const label=el('label',undefined,'practice-level');
  label.append(document.createTextNode('難度'),level);
  const choices=el('div',undefined,'practice-stages');
  for(const [id,stage] of Object.entries(stages)){
    const launch=button(undefined,async()=>{
      for(const choice of choices.children)choice.disabled=true;
      try{
        await loadStage(id,root,()=>{
          practice={original:data,level:Number(level.value)};
          data={...fresh(),settings:{...data.settings},active:{
            day:1,started:localDate(),time:timeOfDay(),queue:[id],results:[],attempts:[],spent:0,pending:null
          }};
          data.dda[id].level=practice.level;
        });
      }finally{
        for(const choice of choices.children)choice.disabled=false;
      }
    },'practice-choice');
    launch.append(art(stage.preview),el('span',stage.name));
    choices.append(launch);
  }
  root.append(label,choices,button('回到大門',home));
}
function endPractice(){
  data=practice.original;
  practice=null;
  updateMute();
  leaveFullscreen();
}
function energy(){
  if(!demo&&data.closedDate===localDate())return home();
  const root=panel('今天的精神電量？','選一個最像你現在的感覺。');
  root.classList.add('cover');
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
function scenery(root,id){root.classList.add('scene','scene-'+id);}
function stageProgress(session){
  const row=el('p',undefined,'progress');
  row.append(art('watch'),document.createTextNode(practice?'單關試玩 · Lv. '+practice.level:'第 '+(session.results.length+1)+'／'+session.queue.length+' 關'));
  return row;
}
function briefing(){
  const session=data.active;
  if(session.results.length===session.queue.length||session.spent>=limit)return finishDay();
  const id=session.queue[session.results.length], stage=stages[id];
  const root=panel(stage.name,stage.intro);
  scenery(root,id);
  root.prepend(stageProgress(session));
  const launch=button('開始這一關',async()=>{
    launch.disabled=true;
    launch.textContent='準備道具中';
    const ready=await loadStage(id,root);
    launch.disabled=false;
    launch.textContent=ready?'開始這一關':'重新載入道具';
  },'primary');
  const motion=button('',()=>safe(()=>{
    commit(next=>next.settings.reduced=!next.settings.reduced);
    updateMotion();
  }));
  function updateMotion(){
    const enabled=!data.settings.reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    motion.textContent=enabled?'背景動態：開啟':'背景動態：關閉';
    motion.setAttribute('aria-pressed',String(enabled));
    motion.disabled=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(motion.disabled)motion.title='系統已設定減少動態效果';
  }
  updateMotion();
  root.append(launch,motion,button('回到大門',home));
}
async function loadStage(id,root,prepare){
  enterFullscreen();
  try{
    await prepareArtwork(id);
    if(!root.isConnected){leaveFullscreen();return false;}
    prepare?.();
    start(id);
    return true;
  }catch{
    if(practice&&!game)endPractice();
    if(root.isConnected){
      const message=el('p','無法開啟關卡，請再試一次。','status');
      message.setAttribute('role','alert');
      root.append(message);
    }
    leaveFullscreen();
    return false;
  }
}
function enterFullscreen(){
  if(document.fullscreenElement||!document.documentElement.requestFullscreen)return;
  document.documentElement.requestFullscreen().catch(()=>{});
}
function leaveFullscreen(){
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
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
function parameters(id,level,fixed,ambient){
  if(id==='cups')return {version:3,ambient,cups:3,exchanges:2+2*level,stepMs:510,hintMs:8000,revealMs:5000};
  if(id==='puzzle')return {version:3,ambient,sets:3,gaps:level===1?2:3,decoys:level===3?2:1,hintMs:10000,secondHintMs:5000,wrongLimit:2};
  if(id==='shooting')return {version:2,ambient,batches:3,windowMs:16000,holdMs:500};
  if(id==='potion')return {version:2,ambient,recipes:2,visibleMs:[null,4000,3000][level-1],tolerance:level===1?.15:.10,ordered:level===3};
  return {...paradeTiming,ambient,version:ambient?4:paradeTiming.version,segments:fixed?2:level,perType:fixed?6:6/level};
}
function start(id){
  const stage=stages[id],session=data.active;
  const fixed=id==='poker'&&compare.includes(session.day);
  const level=session.entryLevel??data.dda[id].level;
  const ambient=!fixed&&!data.settings.reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const record={id,attempt:uid(),fixed,level,parameters:parameters(id,level,fixed,ambient),rows:[]};
  commit(next=>{next.active.pending=record;next.active.entryLevel=level;});
  const root=panel(stage.name);
  const body=el('div',undefined,'game-board');
  root.classList.add('playing');
  scenery(root,id);
  root.prepend(stageProgress(session));
  const countdown=el('strong','10','countdown');
  const preparation=el('div',undefined,'preparation');
  preparation.append(el('h2','準備好了嗎？'),el('p',stage.intro),countdown,el('p','倒數結束後開始'));
  const input=id==='shooting'?tiltControls(preparation):null;
  if(practice)preparation.append(button('立即開始',()=>{if(!run.paused)run.elapsed=0;}));
  body.append(preparation);
  root.append(body);pauseButton.hidden=false;
  const run={record,root,body,elapsed:-preparationMs,previous:null,initial:session.spent,stageSpent:session.stageSpent||0,
    timers:[],input,paused:false,done:false,lastSave:0};
  game=run;
  const ctx={body,fixed,level,ambient,input,reduced:data.settings.reduced,now:()=>run.elapsed,
    row(values){const row={errors:0,hints:[],...values};record.rows.push(row);return row;},
    hint(row,reason){row.hint=true;row.hints.push({reason,at:Math.round(run.elapsed)});},
    after(ms,callback){run.timers.push({at:run.elapsed+ms,callback});},
    finish(reason){settle(reason||'finish');},
    feedback(success){
      playSound(success);
      if(success&&!data.settings.reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches)sparkle(root);
    }};
  if(session.spent>=limit||run.stageSpent>=stage.limit){settle('time');return;}
  rotate();
  if(document.hidden)pause();
  requestAnimationFrame(tick);
  function tick(now){
    if(game!==run||run.done)return;
    if(!run.paused){
      if(run.previous!==null)run.elapsed+=Math.min(now-run.previous,1000);
      run.previous=now;
      if(run.elapsed<0){
        countdown.textContent=String(Math.ceil(-run.elapsed/1000));
        requestAnimationFrame(tick);
        return;
      }
      if(!run.controller){
        run.elapsed=0;
        preparation.remove();
        run.controller=stage.run(ctx);
      }
      if(run.initial+Math.max(0,run.elapsed)>=limit||run.stageSpent+Math.max(0,run.elapsed)>=stage.limit){settle('time');return;}
      run.controller.update?.();
      if(run.done)return;
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
    next.active.spent=Math.round(run.initial+Math.max(0,run.elapsed));
    next.active.stageSpent=Math.round(run.stageSpent+Math.max(0,run.elapsed));
    next.active.pending=run.record;
  });
}
function pause(){
  const run=game;
  if(!run||run.paused||run.done)return;
  run.paused=true;run.previous=null;
  run.animations=run.body.getAnimations({subtree:true}).filter(animation=>animation.playState==='running');
  run.animations.forEach(animation=>animation.pause());
  run.body.classList.add('concealed');
  run.body.inert=true;
  run.controller?.pause?.();
  const menu=el('div',undefined,'actions');
  menu.append(button('繼續',()=>{if(orientation.matches||document.hidden)return;run.paused=false;run.previous=null;menu.remove();run.body.classList.remove('concealed');run.body.inert=false;run.animations.forEach(animation=>animation.play());},'primary'),
    button(practice?'離開試玩':'離開屋子',()=>safe(()=>{
      checkpoint(run);
      commit(next=>{next.active.attempts.push({...run.record,status:'中斷'});next.active.pending=null;});
      run.input?.dispose();
      game=null;
      if(practice)practiceMenu();else home();
    })),
    button('跳過這關',()=>{if(confirm('跳過後會進到下一關。確定要跳過嗎？'))settle('skip');}));
  run.root.append(menu);
}
function settle(reason){
  const run=game;
  if(!run||run.done)return;
  run.done=true;
  rotate();
  const {record}=run;
  if(reason!=='skip')run.controller?.settle?.();
  run.input?.dispose();
  const status={skip:'跳過',help:'協助收尾',time:'時間收尾',finish:'完成'}[reason];
  const root=panel(stages[record.id].name,
    reason==='skip'?'這一關先休息，繼續下一段旅程。':'白兔替你記下這一關的足跡。');
  scenery(root,record.id);
  const guide=art('rabbit');
  guide.className='guide';
  root.append(guide);
  function persist(){
    commit(next=>{
      const session=next.active;
      if(session.results.some(result=>result.attempt===record.attempt))return;
      const current=next.dda[record.id];
      const profiles=record.id==='shooting'?[...new Set(record.rows.flatMap(row=>
        (row.shots.length?row.shots.map(shot=>shot.mode):[row.mode]).map(mode=>mode+'／'+(row.auto?'停留':'按鍵'))
      ))]:[];
      const profile=profiles[0]??null;
      const state=current.ruleVersion===record.parameters.version&&(current.profile??null)===profile
        ?current:{...current,streak:0};
      const result=practice?{...current,reason:'單關試玩'}:reason==='skip'||record.fixed||profiles.length>1
        ?{...current,reason:reason==='skip'?'跳過':record.fixed?'固定條件':'本關使用多種操作方式'}
        :{...adjust(record.id,state,record.rows,false),ruleVersion:record.parameters.version,profile};
      next.dda[record.id]=result;
      session.results.push({...record,status,nextLevel:result.level,reason:result.reason,elapsed:Math.round(run.stageSpent+Math.max(0,run.elapsed))});
      session.spent=Math.round(run.initial+Math.max(0,run.elapsed));session.pending=null;session.entryLevel=null;session.stageSpent=0;
    });
    game=null;
    if(data.active.results.length===data.active.queue.length||data.active.spent>=limit)leaveFullscreen();
  }
  if(reason==='finish')root.append(el('p','獨立作答 '+record.rows.filter(row=>row.outcome==='independent').length+' 次'));
  const control=button(practice?'返回試玩選單':'繼續旅程',()=>safe(practice?practiceMenu:briefing),'primary');
  root.append(control);
  function trySave(){
    try{
      persist();
      control.textContent=practice?'返回試玩選單':'繼續旅程';
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
  leaveFullscreen();
  const milestone=data.history.at(-1).advanced&&(data.day===8||data.day===15);
  const root=panel(data.day===15?'白兔的祕密茶會':'今日旅程結束',data.day===15?'和愛麗絲、白兔一起喝杯茶吧。':'歡迎下次回來繼續探索。');
  root.classList.add('cover');
  if(milestone)root.append(button('查看遊玩報告',showReport,'primary'));
  root.append(button('回到大門',home));
}
function settings(){
  if(game)return pause();
  if(practice)endPractice();
  const root=panel('設定');
  if(!data)root.append(el('p','目前無法讀取進度。你可以匯入一份備份。'));
  if(data){
    root.append(button(data.settings.reduced?'減敏模式：開啟':'減敏模式：關閉',()=>safe(()=>{commit(next=>next.settings.reduced=!next.settings.reduced);settings();})));
    root.append(el('p','減敏模式會關閉窗光、鐘針、蒸氣、旗幟、跑動角色與星芒等效果。','muted'));
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
        data=normalize(incoming);save(data);home();
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
function rotate(){
  portrait.hidden=!(orientation.matches&&game&&!game.done);
  if(!portrait.hidden)pause();
}
orientation.addEventListener('change',rotate);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(game&&!game.done)safe(()=>checkpoint(game));}});
window.addEventListener('pagehide',()=>{if(game&&!game.done){try{checkpoint(game);}catch{}}});
window.addEventListener('storage',event=>{if(changed(event)){blocked=true;game?.input?.dispose();game=null;home();}});
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

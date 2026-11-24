import {el,button,shuffle} from '../ui.js';
import {art,crossing} from '../art.js';

export function tiltControls(preparation){
  const label=el('p','預設使用搖桿。');
  let baseline, velocity={x:0,y:0}, listener, timer, disposed=false;
  function stop(){
    if(listener)window.removeEventListener('deviceorientation',listener);
    clearTimeout(timer);
    listener=null;
    baseline=null;
    velocity={x:0,y:0};
  }
  const calibrate=button('校準傾斜控制',async()=>{
    calibrate.disabled=true;
    stop();
    label.textContent='請用遊玩姿勢拿好裝置。';
    try{
      const api=window.DeviceOrientationEvent;
      if(!api||!window.isSecureContext)throw Error();
      if(typeof api.requestPermission==='function'&&await api.requestPermission()!=='granted')throw Error();
      if(disposed)return;
      listener=event=>{
        if(!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
        if(!baseline){
          baseline={beta:event.beta,gamma:event.gamma};
          clearTimeout(timer);
          label.textContent='傾斜已校準。';
        }
        const angle=screen.orientation?.angle??window.orientation??0;
        const direction=angle===270||angle===-90?-1:1;
        const sideways=angle===90||angle===270||angle===-90;
        const beta=(event.beta-baseline.beta+540)%360-180;
        const gamma=event.gamma-baseline.gamma;
        const x=(sideways?beta*direction:gamma)/18;
        const y=(sideways?gamma*direction:beta)/18;
        velocity={x:velocity.x*.85+x*.15,y:velocity.y*.85+y*.15};
      };
      window.addEventListener('deviceorientation',listener);
      timer=setTimeout(()=>{
        if(!baseline){stop();label.textContent='未取得感應資料，繼續使用搖桿。';calibrate.disabled=false;}
      },1600);
    }catch{
      if(!disposed){label.textContent='傾斜控制無法使用，繼續使用搖桿。';calibrate.disabled=false;}
    }
  });
  const auto=el('input');
  auto.type='checkbox';
  const option=el('label',undefined,'orchard-option');
  option.append(auto,document.createTextNode('停留半秒自動發射'));
  preparation.append(calibrate,label,option);
  return {get active(){return Boolean(baseline);},get velocity(){return velocity;},get auto(){return auto.checked;},
    joystick:stop,dispose(){disposed=true;stop();}};
}

export const orchardTiming={version:3,total:15,spawnMs:1400,lifetimeMs:3800,holdMs:500};
export const desktopOrchard=()=>matchMedia('(hover: hover) and (pointer: fine)').matches;

export function shooting(ctx){
  const desktop=desktopOrchard();
  const field=el('div',undefined,'orchard-field'+(desktop?' desktop-orchard':''));
  const guide=el('p','只打有金星的紅蘋果。','orchard-guide');
  const status=el('p',desktop?'點果園內瞄準並發射。':'瞄準後按發射。','status');
  status.setAttribute('aria-live','polite');
  const progress=el('p',undefined,'orchard-count');
  const cursor=el('div',undefined,'orchard-cursor');
  cursor.append(art('spoon'));
  field.append(cursor);
  if(desktop){field.tabIndex=0;field.setAttribute('aria-label','果園射擊區，可用方向鍵瞄準及空白鍵發射');}
  const stick=button(undefined,()=>{},'orchard-stick');
  stick.setAttribute('aria-label','移動準心的搖桿');
  stick.append(el('span'));
  const fireButton=button('發射',()=>fire(),'primary orchard-fire');
  const controls=el('div',undefined,'orchard-controls');
  const mode=button('改用搖桿',()=>{ctx.input?.joystick();mode.hidden=true;});
  controls.append(stick,mode,fireButton);
  controls.hidden=desktop;
  ctx.body.append(guide,field,progress,status,controls);
  if(ctx.ambient)crossing(ctx,'moth','orchard-crossing',7);

  const auto=!desktop&&ctx.input?.auto;
  const types=shuffle([
    ...Array(ctx.level===1?10:9).fill('apple-target'),
    ...Array(ctx.level===1?5:3).fill('apple-green'),
    ...Array(ctx.level===1?0:3).fill('apple-rotten')
  ]);
  const positions=[22,50,78].flatMap(x=>[28,76].map(y=>({x,y})));
  const live=new Set();
  const held=new Set();
  const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  const clamp=value=>Math.max(-1,Math.min(1,value));
  let count=0, aim={x:50,y:52}, last=ctx.now(), locked=null, lockAt=last, pointer=null;
  let axis={x:0,y:0}, touchedAim=false, armed=false, finished=false, lastSpawn=false;
  const inputMode=()=>desktop?'滑鼠':ctx.input?.active?'傾斜':touchedAim?'點按':'搖桿';
  function arm(){if(!armed){armed=true;lockAt=ctx.now();}}
  function aimAt(event){
    const rect=field.getBoundingClientRect();
    aim={x:100*(event.clientX-rect.left)/rect.width,y:100*(event.clientY-rect.top)/rect.height};
  }
  function steer(event){
    const rect=stick.getBoundingClientRect();
    axis={x:clamp((event.clientX-rect.left-rect.width/2)/(rect.width/2)),y:clamp((event.clientY-rect.top-rect.height/2)/(rect.height/2))};
    stick.firstElementChild.style.translate=axis.x*13+'px '+axis.y*13+'px';
  }
  function release(){
    pointer=null;axis={x:0,y:0};held.clear();stick.firstElementChild.style.translate='';
  }
  stick.addEventListener('pointerdown',event=>{
    if(pointer!==null)return;
    ctx.input?.joystick();touchedAim=false;arm();
    pointer=event.pointerId;stick.setPointerCapture(pointer);steer(event);
  });
  stick.addEventListener('pointermove',event=>{if(event.pointerId===pointer)steer(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,release);
  ctx.body.addEventListener('keydown',event=>{
    if(event.code==='Space'&&event.target!==fireButton&&!event.repeat){event.preventDefault();fire();return;}
    if(!keys[event.key])return;
    ctx.input?.joystick();touchedAim=false;arm();event.preventDefault();held.add(event.key);
  });
  ctx.body.addEventListener('keyup',event=>held.delete(event.key));
  ctx.body.addEventListener('focusout',()=>held.clear());
  if(desktop)field.addEventListener('pointermove',aimAt);
  field.addEventListener('click',event=>{
    if(finished)return;
    ctx.input?.joystick();touchedAim=true;arm();aimAt(event);update();
    if(desktop)fire();
  });

  function spawn(){
    const name=types[count++];
    const available=positions.filter(pos=>![...live].some(item=>item.position===pos));
    const position=available[Math.floor(Math.random()*available.length)];
    const target=name==='apple-target';
    const image=art(name);
    image.className='orchard-fruit';
    image.alt=target?'金星紅蘋果':name==='apple-green'?'條紋青蘋果':'蟲洞蘋果';
    const row=ctx.row({unit:count,target,mode:inputMode(),auto,kind:image.alt,shots:[]});
    const item={image,position,row,since:ctx.now()};
    live.add(item);
    field.insertBefore(image,cursor);
    progress.textContent='水果 '+count+'／'+orchardTiming.total;
    ctx.after(orchardTiming.lifetimeMs,()=>retire(item));
    lastSpawn=count===types.length;
    if(!lastSpawn)ctx.after(orchardTiming.spawnMs,spawn);
    update();
  }
  function retire(item,shot=false){
    if(!live.delete(item))return;
    const {row}=item;
    item.image.remove();
    row.duration=Math.round(ctx.now()-item.since);
    row.acted=shot;
    row.outcome=shot?(row.target?'independent':'incorrect'):(row.target?'omission':'withheld');
    row.errors=Number(shot&&!row.target);
    if(shot)row.shots.push({at:row.duration,mode:inputMode(),result:row.target?'命中':'禁打'});
    if(locked===item){locked=null;lockAt=ctx.now();}
    if(lastSpawn&&!live.size){
      finished=true;fireButton.disabled=true;
      status.textContent='果園收工了。';
      ctx.after(450,()=>ctx.finish());
    }
  }
  function fire(){
    if(finished)return;
    const item=locked;
    if(!item){status.textContent='這次沒瞄到水果。';return;}
    const target=item.row.target;
    retire(item,true);
    ctx.feedback(target);
    if(!finished)status.textContent=target?'收下一顆金星蘋果！':'這顆要留在果園。';
  }
  function update(){
    const now=ctx.now(), delta=Math.min(.05,(now-last)/1000);
    last=now;
    if(finished)return;
    mode.hidden=!ctx.input?.active;
    const velocity=ctx.input?.active?ctx.input.velocity:axis;
    if(ctx.input?.active&&Math.hypot(velocity.x,velocity.y)>.12)arm();
    const directions=[...held].reduce((sum,key)=>[sum[0]+keys[key][0],sum[1]+keys[key][1]],[0,0]);
    aim.x=Math.max(0,Math.min(100,aim.x+clamp(velocity.x+directions[0])*delta*59));
    aim.y=Math.max(0,Math.min(100,aim.y+clamp(velocity.y+directions[1])*delta*71));
    cursor.style.left=aim.x+'%';cursor.style.top=aim.y+'%';
    const width=field.clientWidth,height=field.clientHeight;
    let candidate, closest=Infinity;
    for(const item of live){
      const i=item.row.unit;
      const sway=ctx.level===3?Math.sin(now/520+i*2)*3+Math.sin(now/277+i)*.9:ctx.level===2?Math.sin(now/850+i)*1.7:0;
      const x=item.position.x+sway, y=item.position.y;
      item.image.style.left=x+'%';item.image.style.top=y+'%';
      const dx=(x-aim.x)*width/100, dy=(y-aim.y)*height/100;
      const distance=Math.hypot(dx,dy);
      if(Math.abs(dx)<=item.image.offsetWidth*.49&&Math.abs(dy)<=item.image.offsetHeight*.49&&distance<closest){
        candidate=item;closest=distance;
      }
    }
    if(candidate!==locked){locked=candidate??null;lockAt=now;}
    cursor.classList.toggle('locked',Boolean(locked));
    if(auto&&armed&&locked&&now-lockAt>=orchardTiming.holdMs)fire();
  }
  spawn();
  return {update,pause(){
    release();locked=null;armed=false;
    for(const item of live)item.row.timingInterrupted=true;
  },settle(){
    for(const {row} of live){row.offered=false;row.outcome='assisted';}
  }};
}

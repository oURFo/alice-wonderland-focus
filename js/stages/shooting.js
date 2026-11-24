import {el,button} from '../ui.js';
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

export function shooting(ctx){
  const field=el('div',undefined,'orchard-field');
  const guide=el('p','只瞄準有金星的紅蘋果。','orchard-guide');
  const status=el('p',undefined,'status');
  status.setAttribute('aria-live','polite');
  const progress=el('p',undefined,'orchard-count');
  const cursor=el('div',undefined,'orchard-cursor');
  cursor.append(art('spoon'));
  const stick=button(undefined,()=>{},'orchard-stick');
  stick.setAttribute('aria-label','移動準心的搖桿');
  stick.append(el('span'));
  const fireButton=button('發射',()=>fire(),'primary orchard-fire');
  const controls=el('div',undefined,'orchard-controls');
  const mode=button('改用搖桿',()=>{ctx.input.joystick();mode.hidden=true;});
  controls.append(stick,mode,fireButton);
  ctx.body.append(guide,field,progress,status,controls);
  if(ctx.ambient)crossing(ctx,'moth','orchard-crossing',7);
  const auto=ctx.input.auto;
  const held=new Set();
  const keyVector={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  let batch=0, row, fruit=[], aim, last=ctx.now(), started, locked, lockAt, ready=false, pointer=null;
  let axis={x:0,y:0};
  const clamp=(value,limit=1)=>Math.max(-limit,Math.min(limit,value));
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
    ctx.input.joystick();mode.hidden=true;
    pointer=event.pointerId;stick.setPointerCapture(pointer);steer(event);
  });
  stick.addEventListener('pointermove',event=>{if(event.pointerId===pointer)steer(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,release);
  ctx.body.addEventListener('keydown',event=>{
    if(!keyVector[event.key])return;
    ctx.input.joystick();mode.hidden=true;
    event.preventDefault();held.add(event.key);
  });
  ctx.body.addEventListener('keyup',event=>held.delete(event.key));
  ctx.body.addEventListener('focusout',()=>held.clear());
  function next(){
    if(++batch>3){ctx.finish();return;}
    ready=true;started=ctx.now();aim={x:50,y:52};locked=null;
    row=ctx.row({unit:batch,group:batch,acted:false,mode:ctx.input.active?'傾斜':'搖桿',auto,targets:2,hits:0,missed:0,forbidden:0,shots:[]});
    const side=batch===2?70:30;
    const layout=[['apple-target',50,52,true],['apple-target',side,30,true]];
    if(ctx.level>=2)layout.push(['apple-green',100-side,43,false]);
    if(ctx.level>=3)layout.push(['apple-rotten',50,79,false]);
    fruit=layout.map(([name,x,y,target])=>{
      const image=art(name);
      image.className='orchard-fruit';
      image.alt=target?'金星紅蘋果':name==='apple-green'?'條紋青蘋果':'蟲洞蘋果';
      return {image,x,y,target,live:true};
    });
    field.replaceChildren(...fruit.map(item=>item.image),cursor);
    progress.textContent='第 '+batch+'／3 批';
    status.textContent=auto?'瞄準並停留半秒。':'移動準心後按發射。';
    fireButton.disabled=false;
    update();
    const current=row;
    ctx.after(16000,()=>{if(ready&&row===current)end();});
  }
  function end(){
    ready=false;
    fireButton.disabled=true;
    row.missed=row.targets-row.hits;
    row.outcome=row.missed?'omission':row.errors?'corrected':'independent';
    row.duration=Math.round(ctx.now()-started);
    status.textContent=row.missed?'果籃收好了，準備下一批。':'這批果子都收好了！';
    ctx.after(650,next);
  }
  function fire(){
    if(!ready)return;
    row.acted=true;
    const item=locked;
    row.shots.push({at:Math.round(ctx.now()-started),mode:ctx.input.active?'傾斜':'搖桿',result:item?(item.target?'命中':'禁打'):'落空'});
    if(item){
      item.live=false;item.image.hidden=true;
      if(item.target){row.hits++;ctx.feedback(true);}
      else{row.forbidden++;row.errors++;ctx.feedback(false);}
    }
    locked=null;lockAt=ctx.now();
    if(row.hits===row.targets)end();
    else status.textContent=item?.target?'收下一顆。':item?'這顆先留在樹上。':'再瞄準看看。';
  }
  function update(){
    const now=ctx.now(), delta=Math.min(.05,(now-last)/1000);
    last=now;
    mode.hidden=!ctx.input.active;
    if(!ready)return;
    const velocity=ctx.input.active?ctx.input.velocity:axis;
    const keys=[...held].reduce((sum,key)=>[sum[0]+keyVector[key][0],sum[1]+keyVector[key][1]],[0,0]);
    aim.x=Math.max(4,Math.min(96,aim.x+clamp(velocity.x+keys[0])*delta*59));
    aim.y=Math.max(6,Math.min(94,aim.y+clamp(velocity.y+keys[1])*delta*71));
    cursor.style.left=aim.x+'%';cursor.style.top=aim.y+'%';
    const width=field.clientWidth,height=field.clientHeight;
    let candidate;
    for(const [i,item] of fruit.entries()){
      if(!item.live)continue;
      const sway=ctx.level===3?Math.sin(now/520+i*2)*3+Math.sin(now/277+i)*.9:ctx.level===2?Math.sin(now/850+i)*1.7:0;
      const x=item.x+sway;
      item.image.style.left=x+'%';item.image.style.top=item.y+'%';
      const radius=(ctx.level===3?.32:.39)*item.image.offsetWidth;
      if(Math.hypot((x-aim.x)*width/100,(item.y-aim.y)*height/100)<=radius)candidate=item;
    }
    if(candidate!==locked){locked=candidate;lockAt=now;}
    cursor.classList.toggle('locked',Boolean(locked));
    if(auto&&locked&&now-lockAt>=500)fire();
  }
  next();
  return {update,pause(){release();if(ready){row.timingInterrupted=true;locked=null;}},settle(){
    if(ready){row.missed=row.targets-row.hits;row.outcome='assisted';row.duration=Math.round(ctx.now()-started);}
  }};
}

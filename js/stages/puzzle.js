import {el,button,mark,shuffle} from '../ui.js';
import {paint,ambient,crossing} from '../art.js';
const names={diamond:'菱形',circle:'圓形',triangle:'三角形',square:'方形',pentagon:'五角形'};
export function puzzle(ctx) {
  const shell=el('div',undefined,'puzzle-round');
  const progress=el('p',undefined,'puzzle-count');
  let group=0, controller, assisted=false;
  ctx.body.append(shell,progress);
  if(ctx.ambient) {
    ctx.body.prepend(ambient('steam','workshop-steam'));
    crossing(ctx,'moth','workshop-crossing',6);
  }
  function next(){
    group++;
    progress.textContent='茶盤 '+group+'／3';
    shell.replaceChildren();
    controller=makeBoard({...ctx,body:shell},group,help=>{
      assisted ||= help;
      if(group===3){ctx.finish(assisted?'help':undefined);return;}
      next();
    });
  }
  next();
  return {pause(){controller.pause();},settle(){controller.settle();}};
}

function makeBoard(ctx,group,complete) {
  const count = ctx.level === 1 ? 2 : 3;
  const available=['diamond','circle','triangle','square','pentagon'];
  const offset=group-1;
  const shapes=[...available.slice(offset),...available.slice(0,offset)].slice(0,count+(ctx.level===3?2:1));
  const units = shapes.slice(0,count).map((shape,index)=>ctx.row({unit:(group-1)*count+index+1,group,shape}));
  const board = el('div',undefined,'arena plate');
  const tray = el('div',undefined,'arena');
  const status = el('p','先選碎片，再點相同形狀的缺口。','status');
  status.setAttribute('aria-live','polite');
  let closed=false, selected, previousMiss, misses=0, timer=0, dragging=false, pending, starting=ctx.now();
  const slots = units.map((unit,index)=>paint(button(undefined,()=>place(index),'tile slot'),unit.shape,'缺口 '+names[unit.shape]));
  const pieces = new Map(shuffle([...shapes]).map(shape=>[shape,paint(button(undefined,()=>select(shape),'tile piece'),shape,'碎片 '+names[shape])]));
  board.append(...slots);
  tray.append(...pieces.values());
  const workspace=el('div',undefined,'puzzle-workspace');
  const plateArea=el('div');
  const trayArea=el('div');
  plateArea.append(el('p','茶盤缺口'),board);
  trayArea.append(el('p','碎片托盤'),tray);
  workspace.append(plateArea,trayArea);
  ctx.body.append(workspace,status,button('請瘋帽客幫忙',()=>finish(true)));


  function finish(help){
    if(closed)return;
    closed=true;
    if(help)units.filter(unit=>!unit.outcome).forEach(unit=>unit.outcome='assisted');
    complete(help);
  }
  function select(shape) {
    selected = shape;
    for (const [key,piece] of pieces) piece.setAttribute('aria-pressed',String(key===shape));
  }
  for (const [shape,piece] of pieces) {
    piece.addEventListener('pointerdown',()=>{dragging=true;});
    piece.addEventListener('pointercancel',release);
    piece.addEventListener('pointerup',event=>{
      const index = slots.indexOf(document.elementFromPoint(event.clientX,event.clientY)?.closest('button'));
      if (index >= 0 && !slots[index].disabled) {select(shape); place(index);}
      release();
    });
  }
  function release() {
    dragging=false;
    const show = pending;
    pending = undefined;
    show?.();
  }
  function hint(index,reason) {
    if (closed || units[index].outcome || units[index].hint) return;
    if (dragging) {pending=()=>hint(index,reason);return;}
    ctx.hint(units[index],reason);
    mark(slots[index],ctx.reduced);
    status.textContent='先看有記號的缺口。';
    ctx.after(5000,()=>{
      if (closed || units[index].outcome) return;
      const show = ()=>{
        if (closed || units[index].outcome) return;
        units[index].hints.push({reason:'標出碎片',at:Math.round(ctx.now())});
        mark(pieces.get(units[index].shape),ctx.reduced);
        status.textContent='試試有記號的碎片。';
      };
      if (dragging) pending=show; else show();
    });
  }
  function idle() {
    const token=++timer;
    ctx.after(10000,()=>{
      if (closed || token!==timer) return;
      const index=units.findIndex(unit=>!unit.outcome&&!unit.hint);
      if(index>=0){hint(index,'等待過久');idle();}
    });
  }
  function place(index) {
    if (closed || !selected || units[index].outcome) return;
    const unit=units[index];
    unit.acted=true;
    if (unit.shape!==selected) {
      if (!unit.hint) unit.errors++;
      unit.wrongCount=(unit.wrongCount||0)+1;
      misses=previousMiss===index ? misses+1 : 1;
      previousMiss=index;
      ctx.feedback(false);
      status.textContent='這一塊可以試別的缺口。';
      if(misses>=2) hint(index,'同一缺口連錯');
      return;
    }
    unit.outcome=unit.hint?'hinted':unit.errors?'corrected':'independent';
    unit.duration=Math.round(ctx.now()-starting);
    starting=ctx.now();
    slots[index].disabled=true;
    slots[index].classList.add('filled');
    slots[index].setAttribute('aria-label',names[unit.shape]+'已拼合');
    pieces.get(selected).disabled=true;
    select(undefined);
    previousMiss=undefined;
    status.textContent='拼好一塊了！';
    ctx.feedback(true);
    if(units.every(item=>item.outcome)) finish(false); else idle();
  }
  idle();
  return {
    pause(){dragging=false; pending=undefined; select(undefined); units.filter(unit=>!unit.outcome).forEach(unit=>unit.timingInterrupted=true);},
    settle(){units.filter(unit=>!unit.outcome).forEach(unit=>unit.outcome='assisted');}
  };
}

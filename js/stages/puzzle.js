import {el,button,mark,shuffle} from '../ui.js';
export function puzzle(ctx) {
  const count = ctx.level === 1 ? 2 : 3;
  const shapes = ['◆','●','▲','■','⬟'].slice(0,count+(ctx.level===3?2:1));
  const units = shapes.slice(0,count).map((shape,index)=>ctx.row({unit:index+1,shape}));
  const board = el('div',undefined,'arena');
  const tray = el('div',undefined,'arena');
  const status = el('p','先選碎片，再點相同形狀的缺口。','status');
  status.setAttribute('aria-live','polite');
  let selected, previousMiss, misses=0, timer=0, dragging=false, pending, starting=ctx.now();
  const slots = units.map((unit,index)=>button(unit.shape,()=>place(index),'tile'));
  const pieces = new Map(shuffle([...shapes]).map(shape=>[shape,button(shape,()=>select(shape),'tile')]));
  board.append(...slots);
  tray.append(...pieces.values());
  ctx.body.append(el('p','茶盤缺口'),board,el('p','碎片托盤'),tray,status,button('請瘋帽客幫忙',()=>ctx.finish('help')));
  slots.forEach(slot=>slot.setAttribute('aria-label','缺口 '+slot.textContent));
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
    if (units[index].outcome || units[index].hint) return;
    if (dragging) {pending=()=>hint(index,reason);return;}
    ctx.hint(units[index],reason);
    mark(slots[index],ctx.reduced);
    status.textContent='先看有記號的缺口。';
    ctx.after(5000,()=>{
      if (units[index].outcome) return;
      const show = ()=>{
        if (units[index].outcome) return;
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
      if (token!==timer) return;
      const index=units.findIndex(unit=>!unit.outcome&&!unit.hint);
      if(index>=0){hint(index,'等待過久');idle();}
    });
  }
  function place(index) {
    if (!selected || units[index].outcome) return;
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
    slots[index].textContent=unit.shape+' ✓';
    pieces.get(selected).disabled=true;
    select(undefined);
    previousMiss=undefined;
    status.textContent='拼好一塊了！';
    ctx.feedback(true);
    if(units.every(item=>item.outcome)) ctx.finish(); else idle();
  }
  idle();
  return {
    pause(){dragging=false; pending=undefined; select(undefined); units.filter(unit=>!unit.outcome).forEach(unit=>unit.timingInterrupted=true);},
    settle(){units.filter(unit=>!unit.outcome).forEach(unit=>unit.outcome='assisted');}
  };
}

import {el,button,shuffle} from '../ui.js';
import {art,paint} from '../art.js';
export function poker(ctx) {
  const label=el('h2');
  const board=el('div',undefined,'arena');
  const status=el('p',undefined,'status');
  ctx.body.append(label,board,status);
  const groups=ctx.fixed?2:ctx.level;
  const goals=['heart-card','spade-card','diamond-card'];
  const names=['紅心','黑桃','方塊'];
  const others=['club-card','diamond-card','heart-card'];
  let phase=-1, index=0, sequence, current, active=false, started=0;
  function segment() {
    if(++phase===groups) return ctx.finish();
    index=0;
    const perType=ctx.fixed?6:groups===3?2:groups===2?3:6;
    const symbols=[...Array(perType).fill(true),...Array(perType).fill(false)];
    sequence=shuffle(symbols);
    label.replaceChildren(art(goals[phase]),document.createTextNode('只點'+names[phase]+'士兵'));
    label.className='rule';
    status.textContent=phase?'皇后換指令囉！':'看清楚皇后的指令。';
    ctx.after(phase?1500:1000,show);
  }
  function show() {
    if(index===sequence.length) return segment();
    const target=sequence[index++];
    current=ctx.row({unit:phase*100+index,target,phase});
    active=true;
    started=ctx.now();
    status.textContent='第 '+(phase+1)+' 段';
    const card=button(undefined,()=>{
      if(!active)return;
      active=false;
      current.acted=true;
      current.errors=Number(!target);
      current.outcome=target?'independent':'incorrect';
      if(target)current.rt=Math.round(ctx.now()-started);
      card.disabled=true;
      ctx.feedback(target);
    },'tile soldier');
    paint(card,target?goals[phase]:others[phase],(target?names[phase]:['梅花','方塊','紅心'][phase])+'士兵');
    board.replaceChildren(card);
    ctx.after(2500,()=>{
      if(active) current.outcome=target?'omission':'withheld';
      active=false;
      board.replaceChildren();
      show();
    });
  }
  segment();
  return {
    pause(){if(active){if(ctx.fixed)current.interrupted=true;else current.timingInterrupted=true;}},
    settle(){if(active){current.interrupted=true;current.outcome='assisted';}}
  };
}

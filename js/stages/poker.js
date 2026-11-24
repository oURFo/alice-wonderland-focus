import {el,button,shuffle} from '../ui.js';
import {art,paint,ambient,crossing} from '../art.js';

export const paradeTiming = {version:2,stimulusMs:2500,gapMs:450,switchMs:1500};

export function poker(ctx) {
  const label=el('h2',undefined,'rule');
  const board=el('div',undefined,'arena parade-ground');
  const position=el('p',undefined,'parade-count');
  const status=el('p',undefined,'status');
  status.setAttribute('aria-live','polite');
  const cue=el('span',undefined,'parade-cue');
  cue.setAttribute('aria-hidden','true');
  ctx.body.append(label,board,position,status,cue);
  if(ctx.ambient){
    ctx.body.prepend(ambient('pennant','parade-pennant'));
    crossing(ctx,'rabbit-run','parade-crossing',7);
  }
  const groups=ctx.fixed?2:ctx.level;
  const goals=['heart-card','spade-card','diamond-card'];
  const names=['紅心','黑桃','方塊'];
  const others=['club-card','diamond-card','heart-card'];
  const othersNames=['梅花','方塊','紅心'];
  const perType=ctx.fixed?6:6/groups;
  const total=groups*perType*2;
  let phase=-1, index=0, sequence, current, active=false, started=0;
  function segment() {
    if(++phase===groups) return ctx.finish();
    index=0;
    sequence=shuffle([...Array(perType).fill(true),...Array(perType).fill(false)]);
    label.replaceChildren(art(goals[phase]),document.createTextNode('只點'+names[phase]+'士兵'));
    status.textContent=phase?'皇后換指令了，請看新花色。':'看清楚指令，第一位士兵即將進場。';
    ctx.after(phase?paradeTiming.switchMs:1000,show);
  }
  function show() {
    const target=sequence[index++];
    const row=ctx.row({unit:phase*100+index,target,phase});
    const number=phase*perType*2+index;
    current=row;
    active=true;
    started=ctx.now();
    position.textContent='士兵 '+number+'／'+total;
    status.textContent='辨認花色';
    cue.classList.remove('is-next');
    const card=button(undefined,()=>retire(true),'tile soldier');
    paint(card,target?goals[phase]:others[phase],(target?names[phase]:othersNames[phase])+'士兵');
    board.replaceChildren(card);
    function retire(acted) {
      if(!active||current!==row)return;
      active=false;
      row.acted=acted;
      row.errors=Number(acted&&!target);
      row.outcome=acted?(target?'independent':'incorrect'):(target?'omission':'withheld');
      if(acted&&target)row.rt=Math.round(ctx.now()-started);
      board.replaceChildren();
      const endGroup=index===sequence.length;
      const next=endGroup?(phase+1===groups?'閱兵結束':'接下來換指令'):'下一位即將進場';
      status.textContent=(acted?(target?'已接住。':'已退場。'):'')+next;
      cue.classList.add('is-next');
      if(acted)ctx.feedback(target);
      ctx.after(paradeTiming.gapMs,endGroup?segment:show);
    }
    ctx.after(paradeTiming.stimulusMs,()=>retire(false));
  }
  segment();
  return {
    pause(){if(active){if(ctx.fixed)current.interrupted=true;else current.timingInterrupted=true;}},
    settle(){if(active){current.interrupted=true;current.outcome='assisted';}}
  };
}

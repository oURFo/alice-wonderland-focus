import {el, button, mark} from '../ui.js';
import {paint,ambient,crossing} from '../art.js';
export function cups(ctx) {
  const board = el('div',undefined,'arena');
  const status = el('p',undefined,'status');
  status.setAttribute('aria-live','polite');
  ctx.body.append(board,status);
  if(ctx.ambient){
    ctx.body.prepend(ambient('sunlight','room-light'),ambient('clock-hand','room-clock'));
    crossing(ctx,'cat-crossing','tea-crossing',5,()=>ctx.body.classList.contains('is-tracking'));
  }
  let round = 0, current, ready = false, started = 0, generation = 0;
  function next() {
    if (++round > 3) return ctx.finish();
    const token = ++generation;
    const goal = Math.floor(Math.random()*3);
    const positions = [0,1,2];
    ready = false;
    ctx.body.classList.remove('is-tracking');
    current = ctx.row({unit:round,offered:false});
    status.textContent = '第 ' + round + ' 題，記住懷錶的位置。';
    const tiles = positions.map((_, index) => paint(button(undefined,()=>pick(index),'tile cup'),index===goal?'watch':'cup'));
    const place = (previous) => tiles.forEach((tile,index)=> {
      const delta=previous?previous[index]-positions[index]:0;
      tile.style.left = [22,50,78][positions[index]] + '%';
      if(delta&&tile.animate){
        const distance=board.clientWidth*.28*delta;
        const lift=delta>0?-board.clientHeight*.40:board.clientHeight*.10;
        tile.animate([
          {translate:distance+'px 0'},
          {translate:(distance*.5)+'px '+lift+'px'},
          {translate:'0 0'}
        ],{duration:420,easing:'ease-in-out'});
      }
      tile.setAttribute('aria-label', '第 ' + (positions[index]+1) + ' 個茶杯');
    });
    tiles.forEach(tile=>tile.disabled=true);
    board.replaceChildren(...tiles);
    place();
    function pick(index) {
      if (!ready) return;
      current.acted = true;
      current.errors = Number(index !== goal && !current.hint);
      if (index !== goal) current.wrong = true;
      if (index === goal && !current.hint) current.rt = Math.round(ctx.now()-started);
      reveal(index === goal ? (current.hint ? 'hinted' : 'independent') : 'incorrect');
    }
    function reveal(outcome) {
      ready = false;
      current.outcome = outcome;
      if (outcome === 'assisted') current.timeout = true;
      tiles.forEach(tile=>tile.disabled=true);
      paint(tiles[goal],'watch','懷錶在這裡');
      status.textContent = ['independent','hinted'].includes(outcome) ? '找到懷錶了！' : '柴郡貓掀開了茶杯。';
      ctx.feedback(['independent','hinted'].includes(outcome));
      ctx.after(650,next);
    }
    function exchange(left) {
      if (!left) {
        ready = true;
        ctx.body.classList.remove('is-tracking');
        current.offered = true;
        started = ctx.now();
        status.textContent = '哪一個茶杯藏著懷錶？';
        tiles.forEach(tile=>tile.disabled=false);
        ctx.after(8000,()=>{
          if (!ready || generation !== token) return;
          ctx.hint(current,'等待過久');
          mark(tiles[goal],ctx.reduced);
          status.textContent = '留意有記號的茶杯。';
          ctx.after(5000,()=>{if(ready && generation === token) reveal('assisted');});
        });
        return;
      }
      const leftPosition=Math.floor(Math.random()*2);
      const a=positions.indexOf(leftPosition);
      const b=positions.indexOf(leftPosition+1);
      const previous=[...positions];
      [positions[a],positions[b]] = [positions[b],positions[a]];
      place(previous);
      ctx.after(510,()=>exchange(left-1));
    }
    ctx.after(1100,()=>{
      paint(tiles[goal],'cup');
      ctx.body.classList.add('is-tracking');
      status.textContent = '跟著茶杯移動。';
      exchange(2+2*ctx.level);
    });
  }
  next();
  return {
    pause(){if(ready) current.timingInterrupted = true;},
    settle(){if(!current.outcome){current.outcome='assisted';current.timeout=true;}}
  };
}

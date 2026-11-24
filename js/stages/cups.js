import {el, button, mark} from '../ui.js';
export function cups(ctx) {
  const board = el('div',undefined,'arena');
  const status = el('p',undefined,'status');
  status.setAttribute('aria-live','polite');
  ctx.body.append(board,status);
  let round = 0, current, ready = false, started = 0, generation = 0;
  function next() {
    if (++round > 3) return ctx.finish();
    const token = ++generation;
    const goal = Math.floor(Math.random()*3);
    const positions = [0,1,2];
    ready = false;
    current = ctx.row({unit:round,offered:false});
    status.textContent = '第 ' + round + ' 題，記住懷錶的位置。';
    const tiles = positions.map((_, index) => button(index === goal ? '◉' : '☕',()=>pick(index),'tile cup'));
    const place = () => tiles.forEach((tile,index)=> {
      tile.style.left = [22,50,78][positions[index]] + '%';
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
      tiles[goal].textContent = '◉';
      status.textContent = ['independent','hinted'].includes(outcome) ? '找到懷錶了！' : '柴郡貓掀開了茶杯。';
      ctx.feedback(['independent','hinted'].includes(outcome));
      ctx.after(650,next);
    }
    function exchange(left) {
      if (!left) {
        ready = true;
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
      const a = Math.floor(Math.random()*3);
      const b = (a+1+Math.floor(Math.random()*2))%3;
      [positions[a],positions[b]] = [positions[b],positions[a]];
      place();
      ctx.after(510,()=>exchange(left-1));
    }
    ctx.after(1100,()=>{
      tiles[goal].textContent = '☕';
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


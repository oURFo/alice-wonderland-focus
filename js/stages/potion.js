import {el,button} from '../ui.js';
import {art,crossing} from '../art.js';

const ingredients=[
  {name:'玫瑰露',image:'rose-bottle',color:'#a43b58'},
  {name:'藍莓汁',image:'berry-bottle',color:'#415f99'},
  {name:'月光露',image:'moon-bottle',color:'#bc7a24'}
];
const recipes=[[[0,2],[1,1]],[[1,2],[0,1]],[[2,1],[1,1],[0,2]],[[1,1],[2,2],[0,1]]];

export function potion(ctx){
  const recipe=el('div',undefined,'potion-recipe');
  const bottles=el('div',undefined,'potion-bottles');
  const vessels=el('div',undefined,'potion-vessels');
  const progress=el('p',undefined,'potion-count');
  const status=el('p',undefined,'status');
  status.setAttribute('aria-live','polite');
  const actions=el('div',undefined,'potion-actions');
  const peek=button('偷看配方',showHint);
  const sponge=button('修正這次用量',correct);
  sponge.prepend(art('sponge'));
  const confirm=button('完成調配',check,'primary');
  const assist=button('請皇后幫忙',()=>finishRecipe(true));
  actions.append(peek,sponge,confirm,assist);
  ctx.body.append(recipe,progress,vessels,bottles,actions,status);
  if(ctx.ambient)crossing(ctx,'moth','potion-crossing',8);
  const ordered=ctx.level===3;
  const tolerance=ctx.level===1?.15:.10;
  let number=0, stepIndex=0, row, order, amounts, pours, meters, bottleButtons, started, displayToken, pouring, active=false;
  const format=value=>String(Math.round(value*100)/100);
  function next(){
    if(++number>2){ctx.finish();return;}
    active=true;started=ctx.now();displayToken={};
    const index=ctx.level===1?number-1:ctx.level===3?number+1:number===1?1:2;
    order=recipes[index];
    amounts=ingredients.map(()=>0);pours=[];pouring=null;stepIndex=0;
    row=ctx.row({unit:number,group:number,acted:false,recipe:order.map(([id,quantity])=>({ingredient:ingredients[id].name,quantity})),
      amounts:{},overpours:0,corrections:0,rejectedChecks:0,actions:[]});
    [confirm,sponge,assist].forEach(control=>control.disabled=false);
    peek.disabled=ctx.level===1;
    showRecipe();
    showIngredients();
  }
  function showIngredients(){
    const ids=ordered?[order[stepIndex][0]]:ctx.level===1?[0,1]:[0,1,2];
    progress.textContent='配方 '+number+'／2'+(ordered?' · 第 '+(stepIndex+1)+' 瓶／'+order.length:'');
    confirm.textContent=ordered&&stepIndex<order.length-1?'確認份量，下一瓶':'完成調配';
    status.textContent=ordered?'倒入'+ingredients[ids[0]].name+'，夠了就確認份量。':'輕點瓶子加 ¼ 格，也可以按住連續倒入。';
    vessels.replaceChildren();bottles.replaceChildren();
    meters=ids.map(id=>{
      const ingredient=ingredients[id];
      const vessel=el('div',undefined,'potion-vessel');
      const fill=el('div',undefined,'potion-fill');
      const read=el('p',undefined,'potion-reading');
      fill.style.backgroundColor=ingredient.color;
      const scale=el('div',undefined,'potion-scale');
      scale.setAttribute('aria-hidden','true');
      for(const mark of [0,1,2,3]){
        const tick=el('span',String(mark));
        tick.style.bottom='calc(var(--liquid-base) + '+mark+' * var(--liquid-unit))';
        scale.append(tick);
      }
      vessel.append(fill,art('beaker'),scale,read);
      vessels.append(vessel);
      return {id,fill,read};
    });
    bottleButtons=new Map(meters.map(({id})=>{
      const ingredient=ingredients[id];
      const control=button(undefined,event=>{
        if(event.detail===0&&!pouring){begin(id);add(.25);stop();}
      },'potion-bottle');
      control.append(art(ingredient.image),el('span',ingredient.name));
      control.addEventListener('pointerdown',event=>{
        if(event.button!==0||pouring||!active)return;
        control.setPointerCapture(event.pointerId);
        begin(id);
      });
      control.addEventListener('pointerup',()=>{
        if(pouring?.id!==id)return;
        update();
        if(ctx.now()-pouring.started<155)add(Math.max(0,.25-(amounts[id]-pouring.from)));
        stop();
      });
      for(const event of ['pointercancel','lostpointercapture'])control.addEventListener(event,()=>{if(pouring?.id===id)stop();});
      bottles.append(control);
      return [id,control];
    }));
    render();
  }
  function showRecipe(){
    const token={};displayToken=token;
    recipe.replaceChildren(el('strong',ordered?'配方順序':'配方'));
    for(const [id,quantity] of order){
      const step=el('span');
      step.setAttribute('aria-label',ingredients[id].name+' '+quantity+' 格');
      step.append(art(ingredients[id].image),document.createTextNode(quantity+' 格'));
      recipe.append(step);
    }
    if(ctx.level>1)ctx.after(ctx.level===3?3000:4000,()=>{
      if(active&&displayToken===token)recipe.replaceChildren(el('strong','配方已收起'));
    });
  }
  function showHint(){
    if(!active||ctx.level===1)return;
    ctx.hint(row,'偷看配方');
    showRecipe();
  }
  function render(){
    for(const {id,fill,read} of meters){
      fill.style.height='calc('+amounts[id]+' * var(--liquid-unit))';
      read.replaceChildren(el('span',ingredients[id].name),el('strong',format(amounts[id])+' 格'));
    }
  }
  function begin(id){
    if(!active)return;
    row.acted=true;
    const now=ctx.now();
    pouring={id,from:amounts[id],at:now,started:now,over:false};
    bottleButtons.get(id).classList.add('pouring');
  }
  function add(delta){
    if(!pouring)return;
    const {id}=pouring;
    amounts[id]=Math.min(3.5,amounts[id]+delta);
    const target=order.find(step=>step[0]===id)?.[1]??0;
    if(amounts[id]>target*(1+tolerance)+.001&&!pouring.over&&pouring.from<=target*(1+tolerance)+.001){
      pouring.over=true;row.overpours++;row.errors++;
    }
    render();
  }
  function update(){
    if(!pouring)return;
    const now=ctx.now();
    const elapsed=Math.max(0,now-pouring.at);
    pouring.at=now;
    add(elapsed/780);
  }
  function stop(){
    if(!pouring)return;
    update();
    const {id,from}=pouring;
    if(amounts[id]>from){
      pours.push({id,from});
      row.actions.push({type:'倒入',ingredient:ingredients[id].name,quantity:Number((amounts[id]-from).toFixed(2))});
    }
    bottleButtons.get(id).classList.remove('pouring');
    pouring=null;
  }
  function correct(){
    stop();
    const last=pours.pop();
    if(!last||!active)return;
    amounts[last.id]=last.from;
    row.corrections++;
    row.actions.push({type:'修正',ingredient:ingredients[last.id].name});
    render();
    status.textContent='已吸掉上一次倒入的份量。';
  }
  function check(){
    if(!active)return;
    stop();
    row.acted=true;
    const goals=ordered?[order[stepIndex]]:ingredients.map((_,id)=>[id,order.find(step=>step[0]===id)?.[1]??0]);
    if(!goals.every(([id,goal])=>Math.abs(amounts[id]-goal)<=goal*tolerance+.001)){
      row.rejectedChecks++;row.actions.push({type:'份量未合'});
      status.textContent='有些份量還差一點，可以接著調整。';
      ctx.feedback(false);return;
    }
    if(ordered&&stepIndex<order.length-1){
      const [id]=order[stepIndex++];
      row.actions.push({type:'確認份量',ingredient:ingredients[id].name,quantity:Number(amounts[id].toFixed(2))});
      pours=[];
      showIngredients();
      ctx.feedback(true);
      return;
    }
    finishRecipe(false);
  }
  function summarize(assisted){
    stop();
    row.amounts=Object.fromEntries(ingredients.map((ingredient,id)=>[ingredient.name,Number(amounts[id].toFixed(2))]));
    row.duration=Math.round(ctx.now()-started);
    row.outcome=assisted?'assisted':row.hint?'hinted':
      row.errors||row.corrections||row.rejectedChecks?'corrected':'independent';
  }
  function finishRecipe(assisted){
    if(!active)return;
    summarize(assisted);
    active=false;
    [confirm,sponge,assist,peek,...bottleButtons.values()].forEach(control=>control.disabled=true);
    if(!assisted)ctx.feedback(true);
    status.textContent=assisted?'皇后幫你調好了這杯。':'調配完成！';
    ctx.after(750,next);
  }
  next();
  return {update,pause(){stop();if(active)row.timingInterrupted=true;},settle(){if(active)summarize(true);}};
}

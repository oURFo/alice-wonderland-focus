const base = new URL('../assets/',import.meta.url);

export function art(name) {
  const image = new Image();
  image.src = new URL(name+'.png',base);
  image.alt = '';
  image.draggable = false;
  return image;
}

export function paint(node,name,label) {
  node.replaceChildren(art(name));
  if(label)node.setAttribute('aria-label',label);
  return node;
}

export function sparkle(node) {
  const image=art('sparkle');
  image.className='sparkle';
  image.addEventListener('animationend',()=>image.remove(),{once:true});
  node.append(image);
}

export function ambient(name, kind) {
  const image=art(name);
  image.className='ambient '+kind;
  image.setAttribute('aria-hidden','true');
  return image;
}

export function crossing(ctx,name,lane,interval,enabled=()=>true){
  const enter=()=>{
    if(enabled()){
      const sprite=ambient(name,lane+' crossing');
      sprite.addEventListener('animationend',()=>sprite.remove(),{once:true});
      ctx.body.prepend(sprite);
    }
    ctx.after(interval*1000,enter);
  };
  ctx.after(2300,enter);
}

export async function prepareArtwork(id) {
  const assets={
    cups:['cup','watch','sparkle','sunlight','clock-hand','cat-crossing'],
    puzzle:['plate','diamond','circle','triangle','square','pentagon','sparkle','steam','moth'],
    poker:['heart-card','spade-card','diamond-card','club-card','sparkle','pennant','rabbit-run'],
    shooting:['apple-target','apple-green','apple-rotten','spoon','moth','sparkle'],
    potion:['rose-bottle','berry-bottle','moon-bottle','beaker','sponge','moth','sparkle']
  };
  const scene=new Image();
  scene.src=new URL(id+'.webp',base);
  await Promise.all([scene,...assets[id].map(art)].map(image=>image.decode()));
}

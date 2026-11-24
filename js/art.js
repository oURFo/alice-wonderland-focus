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

export async function prepareArtwork(id) {
  const assets={
    cups:['cup','watch','sparkle','sunlight','clock-hand'],
    puzzle:['plate','diamond','circle','triangle','square','pentagon','sparkle','steam'],
    poker:['heart-card','spade-card','diamond-card','club-card','sparkle','pennant']
  };
  const scene=new Image();
  scene.src=new URL(id+'.webp',base);
  await Promise.all([scene,...assets[id].map(art)].map(image=>image.decode()));
}

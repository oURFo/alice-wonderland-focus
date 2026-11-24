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

export async function prepareArtwork(id) {
  const assets={
    cups:['cup','watch','sparkle'],
    puzzle:['plate','diamond','circle','triangle','square','pentagon','sparkle'],
    poker:['heart-card','spade-card','diamond-card','club-card','sparkle']
  };
  const scene=new Image();
  scene.src=new URL(id+'.webp',base);
  await Promise.all([scene,...assets[id].map(art)].map(image=>image.decode()));
}

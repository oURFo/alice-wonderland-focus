export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(text, run, className) {
  const node = el('button',text,className);
  node.type = 'button';
  node.addEventListener('click',run);
  return node;
}
export function mark(node, reduced) {
  node.classList.add('hint');
  if (!reduced) node.classList.add('shake');
}
export function shuffle(items) {
  for (let index=items.length-1;index>0;index--) {
    const other = Math.floor(Math.random()*(index+1));
    [items[index],items[other]] = [items[other],items[index]];
  }
  return items;
}

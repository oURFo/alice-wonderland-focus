const key = 'wonderland-focus-v1' + (new URLSearchParams(location.search).get('debug') === '1' ? '-demo' : '');
export const demo = key.endsWith('-demo');
export const localDate = () => {
  const now = new Date();
  return [now.getFullYear(), now.getMonth()+1, now.getDate()].map(value => String(value).padStart(2,'0')).join('-');
};
export const fresh = () => ({
  version:1, accepted:false, settings:{muted:false,reduced:false}, day:1, closedDate:null,
  advancedDate:null, active:null, history:[], dda:Object.fromEntries(['cups','puzzle','poker'].map(id=>[id,{level:1,streak:0}]))
});
export function valid(data) {
  const ids = ['cups','puzzle','poker'];
  const result = row => row && ids.includes(row.id) && Array.isArray(row.rows) && row.rows.every(unit => unit && typeof unit === 'object');
  const session = item => item && Array.isArray(item.queue) && item.queue.every(id => ids.includes(id)) &&
    Array.isArray(item.results) && item.results.every(result) && Number.isFinite(item.spent) &&
    Number.isInteger(item.day) && item.day >= 1 && item.day <= 14;
  return data?.version === 1 && typeof data.accepted === 'boolean' &&
    typeof data.settings?.muted === 'boolean' && typeof data.settings?.reduced === 'boolean' &&
    Number.isInteger(data.day) && data.day >= 1 && data.day <= 15 &&
    ids.every(id => Number.isInteger(data.dda?.[id]?.level) && data.dda[id].level >= 1 && data.dda[id].level <= 3 &&
      [0,1].includes(data.dda[id].streak)) && Array.isArray(data.history) && data.history.every(session) &&
    (data.active === null || session(data.active));
}
export function read() {
  const raw = localStorage.getItem(key);
  if (raw === null) return fresh();
  const data = JSON.parse(raw);
  if (!valid(data)) throw Error('無法讀取這份進度');
  return data;
}
export const save = data => localStorage.setItem(key, JSON.stringify(data));
export const changed = event => event.key === key || event.key === null;
export function download(name, value, type='application/json') {
  const url = URL.createObjectURL(new Blob([value],{type}));
  const link = Object.assign(document.createElement('a'),{href:url,download:name});
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

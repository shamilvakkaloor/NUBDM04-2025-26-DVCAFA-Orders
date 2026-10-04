export const ST={todo:['Not started','--s-todo'],prog:['In progress','--s-prog'],done:['Implemented','--s-done'],block:['Blocked','--s-block']};
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function today(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=t=>parts.find(p=>p.type===t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(s) {
  return s==='' || (typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s);
}
export function safeLink(s) {
  if(typeof s!=='string'||s.length>2048)return '';
  try { const u=new URL(s); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password ? u.href : ''; } catch { return ''; }
}
export const pct=o=>o.status==='done'?100:o.subs.length?Math.round(o.subs.filter(s=>s.d).length/o.subs.length*100):o.progress;
export const late=o=>!!o.due&&o.status!=='done'&&o.due<today();
export const daysTo=o=>Math.round((Date.parse(o.due)-Date.parse(today()))/864e5);
export function normalize(raw,id) {
  if(!raw||raw.id!==id||!/^00[1-9]$/.test(id)||!Object.hasOwn(ST,raw.status))throw Error(`Invalid order ${id}.`);
  for(const k of ['title','res','order','summary','due','done','link'])if(typeof raw[k]!=='string')throw Error(`Invalid ${k} in order ${id}.`);
  if(!Array.isArray(raw.owners)||!raw.owners.every(x=>typeof x==='string')||!Array.isArray(raw.subs)||!raw.subs.every(s=>s&&typeof s.t==='string'&&typeof s.o==='string'&&typeof s.d==='boolean')||!Array.isArray(raw.log)||!raw.log.every(l=>l&&typeof l.d==='string'&&typeof l.t==='string')||!Number.isFinite(raw.progress)||raw.progress<0||raw.progress>100||!validDate(raw.due)||!validDate(raw.done))throw Error(`Invalid data in order ${id}.`);
  return structuredClone(raw);
}
export function prepareUpdate(original,fields,note,by,date=today()) {
  const o={...structuredClone(original),...fields};
  if(!Object.hasOwn(ST,o.status)||!validDate(o.due)||!validDate(o.done)||!Number.isInteger(o.progress)||o.progress<0||o.progress>100)throw Error('Check the status, dates and progress.');
  o.link=o.link.trim();
  if(o.link&&!safeLink(o.link))throw Error('Evidence must be a complete HTTP or HTTPS URL without embedded credentials.');
  if(note.length>2000)throw Error('Updates must be 2,000 characters or fewer.');
  if(o.status==='done') { o.progress=100;o.subs.forEach(s=>s.d=true);o.done=o.done||date; }
  else { o.done='';if(o.status==='todo'){o.progress=0;o.subs.forEach(s=>s.d=false);}else if(!o.subs.length&&o.progress===100)throw Error('Choose Implemented for 100% progress, or reduce progress.');else if(o.subs.length&&o.subs.every(s=>s.d))throw Error('Choose Implemented when all conditions are complete.'); }
  if(note.trim()) { if(o.log.length>=200)throw Error('Update history is full. Ask the administrator to archive this order before adding more notes.');o.log.push({d:date,t:note.trim(),by}); }
  return o;
}
export function fingerprint(value) {
  return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
}

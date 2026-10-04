import {saveResolution,initializeResolutions} from './persistence.js';
import {CFG} from './config.js';
import {SEED} from './seed.js';
import {ST,esc,today,safeLink,pct,late,daysTo,normalize,prepareUpdate,fingerprint} from './core.js';
const $=s=>document.querySelector(s), LIVE=!!CFG.apiKey&&!CFG.apiKey.startsWith('YOUR');
let user=null,data={},fs,auth,au,db,editor=false,ready=false,saving=false,stopEditor;
const canEdit=()=>ready&&(!LIVE||editor);
function notice(message,error=false){$('#notice').textContent=message;$('#notice').className=error?'note late':'';}
function errorText(error){
  if(error.code==='permission-denied')return 'Permission denied. Ask the administrator to check your editor access and Firestore rules.';
  if(error.code==='unavailable')return 'Connection unavailable. Reconnect and retry; your changes have not been saved.';
  return error.message||'The operation failed. Please retry.';
}
async function save(o,expected){
  if(!canEdit())throw Error('You no longer have editor access.');
  if(LIVE){
    if(!navigator.onLine)throw Error('You are offline. Reconnect before saving.');
    await saveResolution(fs,db,o,expected);
  }else{
    const current=JSON.parse(localStorage.getItem('bod-tracker')||'{}');
    if(fingerprint(current[o.id])!==expected)throw Error('This order changed in another tab. Reopen it before saving.');
    const next={...current,[o.id]:o};localStorage.setItem('bod-tracker',JSON.stringify(next));data=next;render();
  }
}
async function initializeMissing(){
  if(!canEdit()||saving)return;
  saving=true;$('#initialize').disabled=true;
  try{
    if(LIVE)await initializeResolutions(fs,db,SEED);
    else{const next={...Object.fromEntries(SEED.map(o=>[o.id,o])),...data};localStorage.setItem('bod-tracker',JSON.stringify(next));data=next;render();}
    notice('Missing orders initialized successfully.');
  }catch(e){notice(errorText(e),true);}finally{saving=false;$('#initialize').disabled=false;}
}
async function init(){
  if(!LIVE){
    $('#demo').hidden=false;
    const cached=localStorage.getItem('bod-tracker');
    const loaded=cached?JSON.parse(cached):Object.fromEntries(SEED.map(o=>[o.id,o]));
    Object.entries(loaded).forEach(([id,o])=>normalize(o,id));data=loaded;
    if(!cached)localStorage.setItem('bod-tracker',JSON.stringify(data));
    ready=true;notice('Local demo loaded.');render();return;
  }
  const B='https://www.gstatic.com/firebasejs/10.12.2/';
  const app=(await import(B+'firebase-app.js')).initializeApp(CFG);
  [fs,au]=await Promise.all([import(B+'firebase-firestore.js'),import(B+'firebase-auth.js')]);
  db=fs.getFirestore(app);auth=au.getAuth(app);$('#signin').hidden=false;
  au.onAuthStateChanged(auth,u=>{
    stopEditor?.();editor=false;user=u;
    if(!saving&&$('#dlg').open)$('#dlg').close();
    $('#who').textContent=u?`${u.email||'Signed in'} · viewer`:'';
    $('#signin').textContent=u?'Sign out':'Editor sign-in';
    if(u){$('#login').close();$('#pw').value='';
      stopEditor=fs.onSnapshot(fs.doc(db,'editors',u.uid),snap=>{
        if(auth.currentUser?.uid!==u.uid)return;
        editor=snap.exists()&&snap.data().enabled===true;
        $('#who').textContent=`${u.email||'Signed in'} · ${editor?'editor':'viewer'}`;
        if(!editor&&!saving&&$('#dlg').open)$('#dlg').close();render();
      },()=>{editor=false;notice('Editor access could not be verified. Ask the administrator to configure the editors allowlist and rules.',true);render();});
    }render();
  });
  fs.onSnapshot(fs.collection(db,'resolutions'),{includeMetadataChanges:true},snap=>{
    const next={};let invalid=0;
    snap.forEach(d=>{try{next[d.id]=normalize(d.data(),d.id);}catch{invalid++;}});
    data=next;ready=!snap.metadata.fromCache;
    notice(invalid?`${invalid} invalid order(s) were omitted. Editing and printing are disabled until the administrator repairs them.`:snap.metadata.fromCache?'Offline or connecting: displayed data may be out of date. Editing and printing are disabled.':snap.empty?'No orders saved yet. An authorized editor can initialize the nine orders.':'Orders are up to date.',invalid>0);
    if(invalid)ready=false;render();
  },e=>{ready=false;data={};render();notice(errorText(e),true);});
}
$('#initialize').onclick=initializeMissing;
$('#signin').onclick=async()=>{try{if(user)await au.signOut(auth);else{$('#lerr').textContent='';$('#login').showModal();}}catch(e){notice(errorText(e),true);}};
$('#cancel-login').onclick=()=>{$('#pw').value='';$('#login').close();};
$('#prt').onclick=()=>{render();if(ready)print();};
window.addEventListener('beforeprint',render);
$('#gbtn').onclick=async()=>{const b=$('#gbtn');b.disabled=true;$('#lerr').textContent='';try{await au.signInWithPopup(auth,new au.GoogleAuthProvider());}catch{$('#lerr').textContent='Google sign-in failed. Check pop-up permissions and the Firebase authorized domain.';}finally{b.disabled=false;}};
$('#lform').onsubmit=async e=>{e.preventDefault();const b=$('#lform button[type="submit"]');b.disabled=true;$('#lerr').textContent='';try{await au.signInWithEmailAndPassword(auth,$('#em').value.trim(),$('#pw').value);}catch{$('#lerr').textContent='Sign-in failed. Check your details and connection.';}finally{b.disabled=false;}};
$('#dlg').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
window.addEventListener('storage',e=>{if(LIVE||e.key!=='bod-tracker')return;try{const loaded=JSON.parse(e.newValue||'{}');Object.entries(loaded).forEach(([id,o])=>normalize(o,id));data=loaded;ready=true;render();}catch{ready=false;render();notice('Local data is invalid. Ask the administrator to recover the saved data.',true);}});
window.addEventListener('offline',()=>{ready=false;render();notice('You are offline. Reconnect before editing or printing.',true);});
window.addEventListener('online',()=>{if(!LIVE){ready=true;render();}else notice('Reconnecting to Firebase…');});
let owner="all",filter="all",q="",sortBy="id";
{const p=new URLSearchParams(location.hash.slice(1));owner=p.get("o")||"all";const f=p.get("s");filter=["all","late",...Object.keys(ST)].includes(f)?f:"all";}
const hashSet=()=>history.replaceState(null,"","#"+new URLSearchParams({o:owner,s:filter}));
const dueTxt=o=>{if(!o.due)return esc(o.target||"No due date set");
  if(o.status==="done")return "Due "+esc(o.due);const d=daysTo(o);
  return d<0?`<span class="late">Overdue by ${-d} day${d===-1?"":"s"}</span>`:d<=14?`<span class="soon">Due in ${d} day${d===1?"":"s"}</span>`:"Due "+esc(o.due)};
function render(){
  $("#initialize").hidden=!canEdit()||!SEED.some(o=>!data[o.id]);
  $("#prt").disabled=!ready||!Object.keys(data).length;
  const all=Object.values(data).sort((a,b)=>a.id.localeCompare(b.id));
  const done=all.filter(o=>o.status==="done").length;
  const avg=all.length?Math.round(all.reduce((t,o)=>t+(o.status==="done"?100:pct(o)),0)/all.length):0;
  $("#ring").style.setProperty("--p",avg);$("#pct").textContent=avg+"%";
  const cnt=k=>k==="all"?all.length:k==="late"?all.filter(late).length:all.filter(o=>o.status===k).length;
  const T=[["all","All orders","--acc"],...Object.entries(ST).map(([k,v])=>[k,v[0],v[1]]),["late","Overdue","--late"]];
  $("#chips").innerHTML=T.map(([k,l,c])=>`<button class="tile" data-f="${k}" style="--c:var(${c})" aria-pressed="${filter===k}"><b>${cnt(k)}</b><span>${l}</span></button>`).join("");
  const names=[...new Set(all.flatMap(o=>o.owners))];
  const open=x=>all.filter(o=>o.owners.includes(x)&&o.status!=="done").length;
  $("#owners").innerHTML=[["all","Everyone",all.filter(o=>o.status!=="done").length],...names.map(x=>[x,x,open(x)])]
    .map(([k,l,n])=>`<button class="chip" data-o="${esc(k)}" aria-pressed="${owner===k}" title="${n} open">${esc(l)}<em>${n}</em></button>`).join("");
  const qq=q.toLowerCase();
  const rows=all.filter(o=>(filter==="all"||(filter==="late"?late(o):o.status===filter))&&(owner==="all"||o.owners.includes(owner))
    &&(!qq||([o.id,o.order,o.title,o.summary,o.res,...o.owners].join(" ")).toLowerCase().includes(qq)));
  if(sortBy==="due")rows.sort((a,b)=>(a.due||"9").localeCompare(b.due||"9")||a.id.localeCompare(b.id));
  $("#list").innerHTML=rows.map(o=>`
   <button class="row" data-id="${o.id}" style="--c:var(${ST[o.status][1]})">
    <div class="no">${o.id}<small>Item ${esc(o.res.split("/")[0])}</small></div>
    <div class="ttl">${esc(o.title)}</div>
    <div class="meta">${o.owners.map(x=>`<span class="tag">${esc(x)}</span>`).join("")} ${dueTxt(o)}</div>
    <div class="st"><span class="pill">${ST[o.status][0]}</span><div class="mini"><i style="width:${o.status==="done"?100:pct(o)}%"></i></div></div>
   </button>`).join("")||"<p>No resolutions match these filters.</p>";
  $("#report").innerHTML=!ready?"<p>Report unavailable: current data could not be verified. Reconnect and reload before printing.</p>":`<p>Status report as of ${today()} · ${done} of ${all.length} implemented · overall progress ${avg}%${owner==="all"?"":" · Responsible: "+esc(owner)}</p>
 <table><tr><th>Order</th><th>Resolution</th><th>Subject</th><th>Responsible</th><th>Status</th><th>Due</th><th>Done</th><th>Latest update</th></tr>${rows.map(o=>`<tr><td>${o.id}</td><td>${esc(o.res.split("/")[0])}</td><td>${esc(o.title)}${o.subs.map(s=>`<br>${s.d?"[x]":"[ ]"} ${esc(s.t)} (${esc(s.o)})`).join("")}</td><td>${o.owners.map(esc).join(", ")}</td><td>${ST[o.status][0]}, ${o.status==="done"?100:pct(o)}%</td><td>${esc(o.due||o.target||"Not set")}</td><td>${esc(o.done)}</td><td>${o.log.length?esc(o.log.at(-1).d+": "+o.log.at(-1).t):""}</td></tr>`).join("")}</table>`;
}
$("#chips").onclick=e=>{const b=e.target.closest("[data-f]");if(b){filter=b.dataset.f;hashSet();render()}};
$("#owners").onclick=e=>{const b=e.target.closest("[data-o]");if(b){owner=b.dataset.o;hashSet();render()}};
$("#q").oninput=e=>{q=e.target.value;render()};
$("#sort").onchange=e=>{sortBy=e.target.value;render()};
$("#list").onclick=e=>{const r=e.target.closest(".row");if(r)openEdit(r.dataset.id)};

function openEdit(id){
  if(!data[id])return;
  const o=structuredClone(data[id]), expected=fingerprint(data[id]);
  $("#form").innerHTML=`
   <h2 id="order-heading">${o.id} · ${esc(o.title)}</h2>
   <div style="font-size:13px;color:var(--mut)">Order ${esc(o.order)} · Resolution ${esc(o.res)}<br>Assigned: ${o.owners.map(esc).join(", ")}</div>
   <p style="margin:0">${esc(o.summary)}</p>
   <div class="g2">
    <label>Status<select id="f-st">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${o.status===k?"selected":""}>${v[0]}</option>`).join("")}</select></label>
    <label>Due date<input id="f-due" type="date" value="${esc(o.due)}"></label>
    ${o.subs.length?"":`<label>Progress: <span id="pv">${o.progress}</span>%<input id="f-pr" type="range" min="0" max="100" step="5" value="${o.progress}"></label>`}
    <label>Date implemented<input id="f-dn" type="date" value="${esc(o.done)}"></label>
   </div>
   ${o.subs.map((s,i)=>`<label class="sub"><input type="checkbox" data-i="${i}" ${s.d?"checked":""}><span>${esc(s.t)} <span class="tag">${esc(s.o)}</span></span></label>`).join("")}
   <label>Evidence link (letter, email, minutes)<input id="f-ln" type="url" value="${esc(o.link)}" placeholder="https://"></label>
   <label>Add an update<textarea maxlength="2000" id="f-nt" rows="2" placeholder="What was done, with whom, when"></textarea></label>
   <div>${o.log.slice().reverse().map(l=>`<p class="log"><time>${esc(l.d)}</time> ${esc(l.t)}</p>`).join("")}</div>
   <p id="save-error" role="alert" class="late" hidden></p><div class="btns"><button class="s" id="x">Cancel</button><button class="p" id="ok">Save changes</button></div>`;
  const dlg=$("#dlg");dlg.showModal();
  if($("#f-pr"))$("#f-pr").oninput=e=>$("#pv").textContent=e.target.value;
  $("#x").onclick=()=>dlg.close();
  if(!canEdit()){dlg.querySelectorAll("input,select,textarea").forEach(e=>e.disabled=true);
    $("#ok").hidden=true;$("#f-nt").closest("label").hidden=true;$("#x").textContent="Close";
    if(safeLink(o.link))$("#f-ln").insertAdjacentHTML("afterend",`<a href="${esc(safeLink(o.link))}" target="_blank" rel="noopener">Open evidence</a>`);}

  $('#ok').onclick=async()=>{
    if(saving)return;
    const error=$('#save-error');error.hidden=true;
    try{
      if(!canEdit())throw Error('Editor access is unavailable. Check your connection and sign-in.');
      const subs=o.subs.map((s,i)=>({...s,d:$('#form input[data-i="'+i+'"]').checked}));
      const next=prepareUpdate(o,{status:$('#f-st').value,due:$('#f-due').value,done:$('#f-dn').value,link:$('#f-ln').value,progress:$('#f-pr')?Number($('#f-pr').value):o.progress,subs},$('#f-nt').value,auth?.currentUser?.email||'local');
      saving=true;$('#ok').disabled=true;$('#x').disabled=true;$('#ok').textContent='Saving…';
      await save(next,expected);dlg.close();notice('Changes saved.');
    }catch(e){error.textContent=errorText(e);error.hidden=false;}
    finally{saving=false;$('#ok').disabled=false;$('#x').disabled=false;$('#ok').textContent='Save changes';}
  };
}
init().catch(e=>{ready=false;render();notice('Unable to start the tracker. '+errorText(e),true);});

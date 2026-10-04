import {readFile} from 'node:fs/promises';
import {before,after,beforeEach,test} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc} from 'firebase/firestore';
import {SEED} from '../seed.js';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-dvcafa',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'editors/editor'),{enabled:true});await setDoc(doc(db,'resolutions/002'),SEED[1]);});});
const ref=who=>doc((who?env.authenticatedContext(who,{email:who+'@example.com'}):env.unauthenticatedContext()).firestore(),'resolutions/002');
test('public can read but cannot write',async()=>{await assertSucceeds(getDoc(ref()));await assertFails(updateDoc(ref(),{progress:50,status:'prog'}));});
test('sign-in alone grants no write access or self-promotion',async()=>{await assertFails(updateDoc(ref('viewer'),{progress:50,status:'prog'}));await assertFails(setDoc(doc(env.authenticatedContext('viewer').firestore(),'editors/viewer'),{enabled:true}));});
test('allowlisted editors can update progress and append notes',async()=>{await assertSucceeds(updateDoc(ref('editor'),{progress:50,status:'prog',log:[{d:'2026-10-04',t:'In progress',by:'editor@example.com'}]}));});
test('editors cannot delete, change order text, or insert unsafe URLs',async()=>{await assertFails(deleteDoc(ref('editor')));await assertFails(updateDoc(ref('editor'),{title:'Altered'}));await assertFails(updateDoc(ref('editor'),{link:'javascript:alert(1)'}));});
test('invalid status, progress and incomplete completion are rejected',async()=>{for(const patch of [{status:'bad'},{progress:200},{status:'done',progress:100,done:''}])await assertFails(updateDoc(ref('editor'),patch));});
test('initialization creates only known order IDs',async()=>{const db=env.authenticatedContext('editor').firestore();await assertSucceeds(setDoc(doc(db,'resolutions/001'),SEED[0]));await assertFails(setDoc(doc(db,'resolutions/999'),{...SEED[0],id:'999'}));});
test('revocation applies at the database even if browser still has a form',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'editors/editor'),{enabled:false}));await assertFails(updateDoc(ref('editor'),{progress:50,status:'prog'}));});

import * as fs from 'firebase/firestore';
import {saveResolution,initializeResolutions} from '../persistence.js';
import {fingerprint,prepareUpdate} from '../core.js';
test('initializing all nine orders preserves existing updates',async()=>{
  const db=env.authenticatedContext('editor',{email:'editor@example.com'}).firestore();
  await updateDoc(doc(db,'resolutions/002'),{status:'prog',progress:40});
  await initializeResolutions(fs,db,SEED);
  const rows=await fs.getDocs(fs.collection(db,'resolutions'));
  if(rows.size!==9)throw Error('Initialization did not create all orders');
  if((await getDoc(doc(db,'resolutions/002'))).data().progress!==40)throw Error('Existing update overwritten');
});
test('two editors saving the same version cannot overwrite one another',async()=>{
  const db=env.authenticatedContext('editor',{email:'editor@example.com'}).firestore();
  const baseline=SEED[1],expected=fingerprint(baseline);
  const a=prepareUpdate(baseline,{status:'prog',progress:30},'A','editor@example.com');
  const b=prepareUpdate(baseline,{status:'prog',progress:70},'B','editor@example.com');
  const results=await Promise.allSettled([saveResolution(fs,db,a,expected),saveResolution(fs,db,b,expected)]);
  if(results.filter(r=>r.status==='fulfilled').length!==1)throw Error('Exactly one concurrent save must succeed');
  const rejected=results.find(r=>r.status==='rejected');
  if(!rejected.reason.message.includes('changed while'))throw rejected.reason;
});

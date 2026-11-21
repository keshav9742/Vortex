import { analyzeZip } from './analyzer.js';

const icons = {
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  map:'<svg viewBox="0 0 24 24"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};
const brandLogos = {
  google:'<svg viewBox="0 0 24 24" aria-label="Google"><path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.37-.18-2H12v3.79h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.32Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.45l-3.22-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.76-5.62-4.13H3.05v2.59A9.99 9.99 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.87A6.01 6.01 0 0 1 6.06 12c0-.65.11-1.28.32-1.87V7.54H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.46l3.33-2.59Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.51l2.87-2.87C16.95 2.9 14.7 2 12 2a9.99 9.99 0 0 0-8.95 5.54l3.33 2.59C7.17 7.76 9.39 6 12 6Z"/></svg>',
  spotify:'<svg viewBox="0 0 24 24" aria-label="Spotify"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7 9.2c3.4-1 6.8-.7 10 .6M7.6 12.2c2.8-.7 5.5-.4 8.1.6M8.4 15c2-.4 4-.2 5.8.5" fill="none" stroke="#07130b" stroke-width="1.5" stroke-linecap="round"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" aria-label="Instagram"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  amazon:'<svg viewBox="0 0 24 24" aria-label="Amazon"><text x="4" y="15" font-size="14" font-weight="700" fill="currentColor">a</text><path d="M5 18c4 3 9 3 14 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  youtube:'<svg viewBox="0 0 24 24" aria-label="YouTube"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="m10 9 5 3-5 3Z" fill="#fff"/></svg>',
  meta:'<svg viewBox="0 0 24 24" aria-label="Meta"><path d="M3 15c2.5-7 5.5-7 9 0s6.5 7 9 0c-2.5-7-5.5-7-9 0S5.5 22 3 15Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};
document.querySelectorAll('[data-icon]').forEach((el)=>{el.innerHTML=icons[el.dataset.icon]||''});
document.querySelectorAll('[data-platform] .platform-logo').forEach((el)=>{el.innerHTML=brandLogos[el.closest('[data-platform]').dataset.platform]||''});

const guides={
  google:{title:'Google Takeout',subtitle:'Export activity, Maps history, and searches',logo:'G',color:'#5b8def',url:'https://takeout.google.com',steps:['Open <code>takeout.google.com</code> and sign in to the Google account you want to check.','Click <b>Deselect all</b>, then select <b>My Activity</b> and <b>Location History</b> (Timeline).','Choose <b>JSON</b> as the format, then select <b>Create export</b>.','When Google emails you, download the ZIP to this device and drop it into TRACE.']},
  spotify:{title:'Spotify',subtitle:'Request listening history and account data',logo:'●',color:'#1ed760',url:'https://www.spotify.com/account/privacy/',steps:['Open <code>spotify.com/account/privacy</code> and sign in.','Scroll to <b>Download your data</b> and request <b>Extended streaming history</b>.','Spotify will email a download link when your archive is ready.','Download the ZIP here, then drop it into TRACE for local analysis.']},
  instagram:{title:'Instagram',subtitle:'Download your social graph and interests',logo:'◎',color:'#d94c82',url:'https://accountscenter.instagram.com/info_and_permissions/dyi/',steps:['Open Instagram’s <b>Accounts Center</b> and choose <b>Your information and permissions</b>.','Select <b>Download your information</b>, then choose the Instagram profile.','Choose <b>Some of your information</b> or all available information, with JSON format.','When ready, download the archive and drop it into TRACE.']},
  amazon:{title:'Amazon',subtitle:'Request orders, browsing, and account data',logo:'a',color:'#f0a329',url:'https://www.amazon.com/hz/privacy-central/data-requests',steps:['Open Amazon’s <b>Privacy Central</b> data request page and sign in.','Choose the data categories you want to request, including orders and browsing history.','Submit the request and wait for Amazon’s download email.','Download the archive and drop it into TRACE when it is ready.']},
  youtube:{title:'YouTube',subtitle:'Export watch and search history',logo:'▶',color:'#ff4d4d',url:'https://takeout.google.com',steps:['Open <code>takeout.google.com</code> and sign in.','Deselect all products, then select <b>YouTube and YouTube Music</b>.','Choose JSON format and create the export.','Download the ZIP when Google emails you, then drop it into TRACE.']},
  meta:{title:'Facebook / Meta',subtitle:'Export ads, contacts, and activity',logo:'∞',color:'#6f8cff',url:'https://accountscenter.facebook.com/info_and_permissions',steps:['Open <b>Accounts Center</b> and choose <b>Your information and permissions</b>.','Select <b>Download your information</b> and choose the profile.','Choose JSON format and select activity, ads, contacts, and connections.','Download the archive when it is ready and drop it into TRACE.']}
};

const modal=document.querySelector('#guideModal'); const guideLogo=document.querySelector('#guideLogo'); const guideTitle=document.querySelector('#guideTitle'); const guideSubtitle=document.querySelector('#guideSubtitle'); const guideSteps=document.querySelector('#guideSteps'); const openExport=document.querySelector('#openExport'); const archiveInput=document.querySelector('#archiveInput');
let currentGuide=null;
function showGuide(key){currentGuide=guides[key]; guideLogo.innerHTML=brandLogos[key]||currentGuide.logo; guideLogo.style.setProperty('--brand',currentGuide.color); guideTitle.textContent=currentGuide.title; guideSubtitle.textContent=currentGuide.subtitle; guideSteps.innerHTML=currentGuide.steps.map((s,i)=>`<div class="step"><span class="step-num">0${i+1}</span><div><h4>${['Open the official export page','Choose what to include','Request your archive','Bring it back to TRACE'][i]}</h4><p>${s}</p></div></div>`).join(''); openExport.onclick=()=>window.open(currentGuide.url,'_blank','noopener,noreferrer'); modal.classList.add('open');}
document.querySelectorAll('[data-platform]').forEach((card)=>card.addEventListener('click',()=>showGuide(card.dataset.platform)));
document.querySelector('#closeModal').addEventListener('click',()=>modal.classList.remove('open')); document.querySelector('#modalDone').addEventListener('click',()=>modal.classList.remove('open')); modal.addEventListener('click',(e)=>{if(e.target===modal)modal.classList.remove('open')});
document.querySelector('#modalChoose').addEventListener('click',()=>archiveInput.click()); document.querySelector('#dropButton').addEventListener('click',()=>archiveInput.click()); document.querySelector('#addArchive').addEventListener('click',()=>archiveInput.click());

const toast=document.querySelector('#toast');
const analysisResults=document.querySelector('#analysisResults');
const analysisCards=document.querySelector('#analysisCards');
let currentUser=null;
let currentAnalyses=[];

function showToast(message,error=false){
  toast.textContent=message;
  toast.classList.toggle('toast-error',error);
  toast.hidden=false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout=window.setTimeout(()=>{toast.hidden=true},5000);
}

function storageKey(uid){return `traceAnalyses:${uid}`}

function readAnalyses(uid){
  const saved=localStorage.getItem(storageKey(uid));
  if(!saved)return [];
  try{
    const analyses=JSON.parse(saved);
    if(!Array.isArray(analyses))throw new Error('Saved analysis data is not a list.');
    return analyses;
  }catch(error){
    throw new Error(`Could not read local analysis results: ${error.message}`);
  }
}

function textElement(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  element.textContent=text;
  return element;
}

function renderAnalyses(analyses){
  currentAnalyses=analyses;
  const findings=analyses.flatMap(item=>item.findings||[]);
  document.querySelector('#sourceCount').textContent=String(analyses.length).padStart(2,'0');
  document.querySelector('#dataPointCount').textContent=analyses.reduce((sum,item)=>sum+(item.dataPoints||0),0).toLocaleString();
  document.querySelector('#exposureScore').textContent=findings.length?String(Math.max(...findings.map(item=>item.priority))):'—';
  document.querySelector('#privacyStatus').textContent=analyses.length?'On device':'Ready';
  document.querySelector('#privacyNote').textContent=analyses.length?'Archives never leave this browser':'Archives stay on this device';
  analysisResults.hidden=analyses.length===0;
  analysisCards.replaceChildren();
  for(const analysis of analyses){
    const card=document.createElement('article');
    card.className='analysis-card';
    const heading=textElement('h3',null,`${analysis.platform[0].toUpperCase()}${analysis.platform.slice(1)} export`);
    const counts=analysis.counts||{};
    const summary=textElement('p','analysis-summary',`${(analysis.dataPoints||0).toLocaleString()} records · ${counts.location||0} locations · ${counts.activity||0} activities · ${counts.interest||0} interests`);
    card.append(heading,summary);
    if(!analysis.findings?.length){
      card.append(textElement('p','analysis-empty','No supported records were found in this archive.'));
    }
    for(const finding of analysis.findings||[]){
      const item=document.createElement('div');
      item.className='finding';
      item.append(textElement('h4',null,`${finding.label} · ${finding.bucket}`));
      item.append(textElement('p',null,`Priority ${finding.priority} · ${finding.count} records · about ${finding.minutes} min to fix`));
      item.append(textElement('p',null,finding.why));
      const steps=document.createElement('ol');
      for(const step of finding.steps||[])steps.append(textElement('li',null,step));
      item.append(steps);
      card.append(item);
    }
    const topics=analysis.inference?.sensitive_topics||[];
    if(topics.length)card.append(textElement('p','analysis-summary',`Sensitive topics detected: ${topics.join(', ')}`));
    analysisCards.append(card);
  }
}

function markdownReport(analyses){
  const lines=['# TRACE exposure report','','Generated locally in this browser.',''];
  for(const analysis of analyses){
    lines.push(`## ${analysis.platform[0].toUpperCase()}${analysis.platform.slice(1)}`,'');
    for(const finding of analysis.findings||[]){
      lines.push(`### ${finding.label} (${finding.bucket})`,`- Score: ${finding.priority}`,`- Records: ${finding.count}`,`- Why it matters: ${finding.why}`,`- Time to fix: about ${finding.minutes} minutes`,'- Steps:');
      lines.push(...((finding.steps||[]).map(step=>`  - ${step}`)), '');
    }
    lines.push(analysis.inference?.home_work?.explanation||'No location inference available.',`- Possible sensitive topics: ${(analysis.inference?.sensitive_topics||[]).join(', ')||'none detected'}`,'');
  }
  return lines.join('\n');
}

document.querySelector('#downloadReport').addEventListener('click',()=>{
  if(!currentAnalyses.length){showToast('Analyze an export before downloading a report.',true);return}
  const blob=new Blob([markdownReport(currentAnalyses)],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download='trace_report.md';
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#clearAnalyses').addEventListener('click',()=>{
  if(!currentUser)return;
  localStorage.removeItem(storageKey(currentUser.uid));
  renderAnalyses([]);
  showToast('Local analysis results cleared.');
});

document.querySelector('#signOut').addEventListener('click',async()=>{
  try{
    localStorage.removeItem('traceSession');
    if(window.firebase?.apps?.length) await firebase.auth().signOut();
    window.location.replace('login.html');
  }catch(error){
    showToast(error.message||'Could not sign out.',true);
  }
});

archiveInput.addEventListener('change',async()=>{
  const file=archiveInput.files?.[0];
  if(!file)return;
  modal.classList.remove('open');
  try{
    if(!currentUser)throw new Error('Sign in before analyzing an export.');
    showToast('Analyzing the ZIP in this browser…');
    const response=await fetch('/api/kb');
    if(!response.ok)throw new Error(`Analysis guidance could not be loaded (HTTP ${response.status}).`);
    const kb=await response.json();
    const analysis=await analyzeZip(file,kb);
    const saved=readAnalyses(currentUser.uid).filter(item=>item.platform!==analysis.platform);
    saved.push(analysis);
    localStorage.setItem(storageKey(currentUser.uid),JSON.stringify(saved));
    renderAnalyses(saved);
    showToast('Analysis complete. The ZIP was not uploaded.');
  }catch(error){
    showToast(error.message||'The archive could not be analyzed.',true);
  }finally{
    archiveInput.value='';
  }
});

document.querySelector('#mapNav').addEventListener('click',()=>{
  analysisResults.scrollIntoView({behavior:'smooth',block:'start'});
});
document.querySelector('#planNav').addEventListener('click',()=>{
  document.querySelector('#how-it-works').scrollIntoView({behavior:'smooth',block:'start'});
});
document.querySelector('#planLink').addEventListener('click',()=>{
  analysisResults.scrollIntoView({behavior:'smooth',block:'start'});
});

function initializeDashboardAuth(){
  let localSession=null;
  try{localSession=JSON.parse(localStorage.getItem('traceSession')||'null')}catch{}
  const urlEmail=new URLSearchParams(window.location.search).get('email');
  if(!localSession?.email && urlEmail){
    localSession={email:urlEmail,createdAt:Date.now()};
    localStorage.setItem('traceSession',JSON.stringify(localSession));
  }
  if(localSession?.email){
    currentUser={uid:`local:${localSession.email}`,email:localSession.email};
    document.querySelector('#profileEmail').textContent=localSession.email;
    document.querySelector('#avatar').textContent=localSession.email[0].toUpperCase();
    try{renderAnalyses(readAnalyses(currentUser.uid))}
    catch(error){showToast(error.message,true)}
    return;
  }
  if(!window.firebase||!window.TRACE_FIREBASE_CONFIG?.apiKey){
    showToast('Firebase could not load. Check deployment configuration and reload.',true);
    return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.TRACE_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(async user=>{
      if(!user||!user.emailVerified){
        window.location.replace('login.html');
        return;
      }
      currentUser=user;
      const email=user.email||'Verified user';
      document.querySelector('#profileEmail').textContent=email;
      document.querySelector('#avatar').textContent=email[0].toUpperCase();
      const params=new URLSearchParams(window.location.search);
      if(params.get('profileSync')==='failed'){
        showToast('You are signed in, but your profile could not sync to Firebase. The dashboard is still available.',true);
        window.history.replaceState(null,'',window.location.pathname);
      }
      try{renderAnalyses(readAnalyses(user.uid))}
      catch(error){showToast(error.message,true)}
    },error=>{
      console.error('Firebase dashboard authentication failed.',error);
      showToast(error.message||'Could not verify your Firebase session.',true);
    });
  }catch(error){
    console.error('Firebase dashboard initialization failed.',error);
    showToast(error.message||'Could not initialize Firebase.',true);
  }
}

initializeDashboardAuth();

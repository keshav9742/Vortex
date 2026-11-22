import { analyzeZip } from './analyzer.js';
import { listAnalyses, saveAnalysis, clearAnalyses as clearStoredAnalyses, migrateLegacyAnalyses, clearAllLocalData } from './local-store.js';

const dashboardRoot=document.documentElement;
const themeToggle=document.querySelector('#themeToggle');
const themeIcon=document.querySelector('#themeIcon');
const themeLabel=document.querySelector('#themeLabel');
function applyDashboardTheme(choice){
  const theme=choice==='system'?(window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark'):choice;
  dashboardRoot.dataset.theme=theme;
  if(themeIcon)themeIcon.textContent=theme==='dark'?'☼':'☾';
  if(themeLabel)themeLabel.textContent=choice==='dark'?'Light theme':choice==='light'?'System theme':'Dark theme';
  localStorage.setItem('trace-theme-choice',choice);
}
const savedTheme=localStorage.getItem('trace-theme-choice')||localStorage.getItem('trace-theme')||'system';
applyDashboardTheme(savedTheme);
themeToggle?.addEventListener('click',()=>applyDashboardTheme(dashboardRoot.dataset.theme==='dark'?'light':'dark'));

const icons = {
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  map:'<svg viewBox="0 0 24 24"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};
const brandLogos = {
  google:'<img src="assets/logos/google.png" alt="Google logo">',
  spotify:'<img src="assets/logos/spotify.png" alt="Spotify logo">',
  instagram:'<img src="assets/logos/instagram.png" alt="Instagram logo">',
  amazon:'<img src="assets/logos/amazon.png" alt="Amazon logo">',
  youtube:'<img src="assets/logos/youtube.png" alt="YouTube logo">',
  meta:'<img src="assets/logos/facebook.png" alt="Facebook logo">'
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

async function readAnalyses(uid){
  await migrateLegacyAnalyses(uid);
  return listAnalyses(uid);
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
  renderVisualInsights(analyses);
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
      item.append(textElement('h4',null,`${finding.action || 'Review'} · ${finding.label} · ${finding.bucket}`));
      item.append(textElement('p',null,`Priority ${finding.priority} · ${finding.count} records · ${finding.source || 'found in your data'} · about ${finding.minutes} min to fix`));
      if(finding.formula)item.append(textElement('p','finding-formula',finding.formula));
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

function renderVisualInsights(analyses){
  const section=document.querySelector('#visualInsights');
  section.hidden=analyses.length===0;
  if(!analyses.length)return;
  const platforms=analyses.map(item=>item.platform);
  const categories=['location','interest','contact','activity'];
  const labels={location:'Location info',interest:'Interests',contact:'Contacts',activity:'Activity patterns'};
  const svg=document.querySelector('#shadowGraph');
  const center={x:280,y:150};
  const platformPoints=platforms.map((platform,index)=>{const angle=(index/Math.max(1,platforms.length))*Math.PI*2-Math.PI/2;return {platform,x:center.x+Math.cos(angle)*165,y:center.y+Math.sin(angle)*95};});
  const categoryPoints=categories.map((category,index)=>({category,x:70+index*140,y:55}));
  const edges=[];
  for(const node of platformPoints){edges.push(`<line class="edge" x1="${center.x}" y1="${center.y}" x2="${node.x}" y2="${node.y}"/>`);}
  for(const node of platformPoints){const analysis=analyses.find(item=>item.platform===node.platform);for(const category of categories){if((analysis?.counts?.[category]||0)>0){const target=categoryPoints.find(item=>item.category===category);edges.push(`<line class="edge hot" x1="${node.x}" y1="${node.y}" x2="${target.x}" y2="${target.y}"/>`);}}}
  const nodeMarkup=[`<circle class="node center" cx="${center.x}" cy="${center.y}" r="30"/><text class="center-label" x="${center.x}" y="${center.y+4}" text-anchor="middle">YOU</text>`,...platformPoints.map(node=>`<circle class="node" cx="${node.x}" cy="${node.y}" r="25"/><text x="${node.x}" y="${node.y+4}" text-anchor="middle">${escapeHtml(node.platform)}</text>`),...categoryPoints.map(node=>`<circle class="node category" cx="${node.x}" cy="${node.y}" r="22"/><text x="${node.x}" y="${node.y+38}" text-anchor="middle">${labels[node.category]}</text>`)].join('');
  svg.innerHTML=edges.join('')+nodeMarkup;

  const overlapMap=new Map();
  for(const analysis of analyses)for(const category of categories)if((analysis.counts?.[category]||0)>0){if(!overlapMap.has(category))overlapMap.set(category,[]);overlapMap.get(category).push(analysis.platform);}
  const overlapList=document.querySelector('#overlapList');overlapList.replaceChildren();
  [...overlapMap.entries()].filter(([,items])=>items.length>1).forEach(([category,items])=>{const row=document.createElement('div');row.className='overlap-item';row.innerHTML=`<strong>${labels[category]}</strong><span>${items.map(escapeHtml).join(' · ')}</span>`;overlapList.append(row);});
  if(!overlapList.children.length)overlapList.append(textElement('p','empty-visual','Upload another platform export to reveal shared categories.'));

  const clusters=document.querySelector('#locationClusters');clusters.replaceChildren();
  const places=analyses.flatMap(analysis=>(analysis.inference?.location_clusters||[]).map(cluster=>({...cluster,platform:analysis.platform}))).sort((a,b)=>b.count-a.count).slice(0,6);
  const map=document.querySelector('#locationMap');
  if(places.length){
    const lats=places.map(place=>place.coordinates?.[0]||0),lons=places.map(place=>place.coordinates?.[1]||0),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
    const xFor=lon=>40+(lon-minLon)/(Math.max(.0001,maxLon-minLon))*440;
    const yFor=lat=>125-(lat-minLat)/(Math.max(.0001,maxLat-minLat))*100;
    map.innerHTML='<line class="map-line" x1="40" y1="125" x2="480" y2="125"/><line class="map-line" x1="40" y1="75" x2="480" y2="75"/><line class="map-line" x1="40" y1="25" x2="480" y2="25"/>'+places.map(place=>`<circle class="map-dot" cx="${xFor(place.coordinates[1])}" cy="${yFor(place.coordinates[0])}" r="${Math.max(5,Math.min(15,4+place.count/Math.max(1,places[0].count)*10))}"/><title>${escapeHtml(place.label)} · ${place.count} points</title>`).join('')+'<text x="10" y="20">N</text>';
  }else map.innerHTML='<text x="260" y="78" text-anchor="middle">No rounded location clusters yet</text>';
  for(const place of places){const row=document.createElement('div');row.className='cluster-item';row.innerHTML=`<strong>${escapeHtml(place.label)}</strong><span>${escapeHtml(place.platform)} · ${place.count} points</span>`;clusters.append(row);}
  if(!places.length)clusters.append(textElement('p','empty-visual','No location points were found in the selected exports.'));

  const matrix=Array.from({length:7},()=>Array(24).fill(0));for(const analysis of analyses)for(const [day,row] of (analysis.inference?.rhythm||[]).entries())for(let hour=0;hour<24;hour++)matrix[day][hour]+=(row[hour]||0);
  const max=Math.max(1,...matrix.flat());const rhythm=document.querySelector('#rhythmGrid');rhythm.replaceChildren();for(const row of matrix)for(const value of row){const cell=document.createElement('span');cell.className='rhythm-cell';cell.style.setProperty('--cell-opacity',String(value?0.18+0.82*(value/max):0.06));cell.title=`${value} activities`;rhythm.append(cell);}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));}

function markdownReport(analyses){
  const lines=['# TRACE exposure report','','Generated locally in this browser.',''];
  for(const analysis of analyses){
    lines.push(`## ${analysis.platform[0].toUpperCase()}${analysis.platform.slice(1)}`,'');
    for(const finding of analysis.findings||[]){
      lines.push(`### ${finding.action || 'Review'}: ${finding.label} (${finding.bucket})`,`- Score: ${finding.priority}`,`- Records: ${finding.count}`,`- Evidence: ${finding.source || 'found in your data'}`,`- Formula: ${finding.formula || 'sensitivity × volume × inference × sharing ÷ effort'}`,`- Why it matters: ${finding.why}`,`- Time to fix: about ${finding.minutes} minutes`,'- Steps:');
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

document.querySelector('#printReport').addEventListener('click',()=>{
  if(!currentAnalyses.length){showToast('Analyze an export before printing a report.',true);return}
  const printWindow=window.open('','_blank');
  if(!printWindow){showToast('Allow pop-ups to print the local report.',true);return}
  const body=currentAnalyses.flatMap(analysis=>(analysis.findings||[]).map(finding=>`<article><h2>${escapeHtml(finding.action||'Review')}: ${escapeHtml(finding.label)}</h2><p><b>Priority ${finding.priority}</b> · ${finding.count} records · ${escapeHtml(finding.source||'found in your data')}</p><p>${escapeHtml(finding.why)}</p><p><b>Formula:</b> ${escapeHtml(finding.formula||'sensitivity × volume × inference × sharing ÷ effort')}</p><ol>${(finding.steps||[]).map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol></article>`)).join('');
  printWindow.document.write(`<!doctype html><title>TRACE local exposure report</title><style>body{font:15px/1.6 system-ui;color:#101827;max-width:820px;margin:40px auto;padding:0 20px}h1{color:#214d92}article{border-top:1px solid #ccd5e3;padding:18px 0}h2{font-size:19px}small{color:#5d6b80}</style><h1>TRACE exposure report</h1><p>Generated locally. 0 bytes uploaded.</p>${body}`);
  printWindow.document.close();printWindow.focus();printWindow.print();
});

document.querySelector('#clearAnalyses').addEventListener('click',async()=>{
  if(!currentUser)return;
  await clearStoredAnalyses(currentUser.uid);
  renderAnalyses([]);
  showToast('Local analysis results cleared.');
});

document.querySelector('#clearAllLocal').addEventListener('click',async()=>{
  if(!confirm('Clear all TRACE analysis data from this browser?'))return;
  await clearAllLocalData();
  if(currentUser)renderAnalyses([]);
  showToast('All local analysis data was cleared.');
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

const dropCard=document.querySelector('.drop-card');
async function analyzeSelectedFile(file){
  if(!file)return;
  modal.classList.remove('open');
  try{
    if(!currentUser)throw new Error('Sign in before analyzing an export.');
    showToast('Analyzing locally in this browser…');
    const response=await fetch('/api/kb');
    if(!response.ok)throw new Error(`Analysis guidance could not be loaded (HTTP ${response.status}).`);
    const kb=await response.json();
    const analysis=await analyzeZip(file,kb,progress=>showToast(`${progress.stage} · ${progress.percent}%`));
    await saveAnalysis(currentUser.uid,analysis);
    const saved=await readAnalyses(currentUser.uid);
    renderAnalyses(saved);
    showToast('Analysis complete. 0 bytes uploaded.');
  }catch(error){
    showToast(error.message||'The archive could not be analyzed.',true);
  }finally{
    archiveInput.value='';
  }
}
archiveInput.addEventListener('change',()=>analyzeSelectedFile(archiveInput.files?.[0]));
['dragenter','dragover'].forEach(type=>dropCard.addEventListener(type,event=>{event.preventDefault();dropCard.classList.add('over')}));
['dragleave','drop'].forEach(type=>dropCard.addEventListener(type,event=>{event.preventDefault();dropCard.classList.remove('over')}));
dropCard.addEventListener('drop',event=>analyzeSelectedFile(event.dataTransfer.files?.[0]));

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
    try{renderAnalyses(await readAnalyses(currentUser.uid))}
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
      try{renderAnalyses(await readAnalyses(user.uid))}
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

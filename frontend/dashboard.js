const icons = {
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  map:'<svg viewBox="0 0 24 24"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  shield:'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};
document.querySelectorAll('[data-icon]').forEach((el)=>{el.innerHTML=icons[el.dataset.icon]||''});

const brandLogos={
  google:'<img src="assets/logos/google.png" alt="Google logo">',
  spotify:'<img src="assets/logos/spotify.png" alt="Spotify logo">',
  instagram:'<img src="assets/logos/instagram.png" alt="Instagram logo">',
  amazon:'<img src="assets/logos/amazon.png" alt="Amazon logo">',
  youtube:'<img src="assets/logos/youtube.png" alt="YouTube logo">',
  meta:'<img src="assets/logos/facebook.png" alt="Facebook logo">'
};
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
archiveInput.addEventListener('change',()=>{if(archiveInput.files.length){modal.classList.remove('open');const toast=document.querySelector('#toast');toast.textContent=`${archiveInput.files[0].name} is ready for local analysis.`;toast.hidden=false;setTimeout(()=>toast.hidden=true,3200)}});
const savedEmail=localStorage.getItem('traceUserEmail'); if(savedEmail){document.querySelector('#profileEmail').textContent=savedEmail;document.querySelector('#avatar').textContent=savedEmail[0].toUpperCase()}

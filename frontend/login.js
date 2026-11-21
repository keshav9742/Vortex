import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const iconMarkup = { lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' };
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = iconMarkup[el.dataset.icon] || ''; });

const emailStep = document.querySelector('#emailStep');
const otpStep = document.querySelector('#otpStep');
const emailInput = document.querySelector('#email');
const phoneInput = document.querySelector('#phone');
const profilePhone = document.querySelector('#profilePhone');
const phoneConsent = document.querySelector('#phoneConsent');
const phonePreview = document.querySelector('#phonePreview');
const otpInputs = [...document.querySelectorAll('.otp-input')];
const phonePanel = document.querySelector('#phonePanel');
const emailPanel = document.querySelector('#emailPanel');
let confirmationResult = null;
let auth = null;
let db = null;

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE_');
if (configured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, (user) => { if (user) finish(user); });
    if (isSignInWithEmailLink(auth, window.location.href)) completeEmailLink();
  } catch (error) { console.warn('Firebase initialization failed; demo mode enabled.', error); }
}

async function finish(user) {
  const savedPhone = (profilePhone?.value || phoneInput?.value || '').trim();
  if (db && phoneConsent?.checked && savedPhone) {
    try { await setDoc(doc(db, 'users', user.uid), { email: user.email || null, phoneE164: savedPhone, phoneVerified: false, phoneRecoveryConsent: true, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (error) { console.warn('Profile metadata was not saved.', error); }
  }
  localStorage.setItem('traceUserEmail', user.email || user.phoneNumber || 'Verified user');
  if (savedPhone && phoneConsent?.checked) localStorage.setItem('traceUnverifiedPhone', savedPhone);
  window.location.href = 'dashboard.html';
}

function showError(message) {
  let notice = document.querySelector('#authError');
  if (!notice) { notice = document.createElement('div'); notice.id = 'authError'; notice.className = 'auth-error'; document.querySelector('.auth-card').prepend(notice); }
  notice.textContent = message;
}

async function completeEmailLink() {
  let email = localStorage.getItem('traceEmailForSignIn');
  if (!email) email = window.prompt('Enter the email address that requested this sign-in link:');
  if (!email) return;
  try { await signInWithEmailLink(auth, email, window.location.href); localStorage.removeItem('traceEmailForSignIn'); }
  catch (error) { showError(error.message || 'This sign-in link is invalid or expired.'); }
}

document.querySelector('#googleSignIn').addEventListener('click', async () => {
  if (!auth) { showError('Add your Firebase web config to firebase-config.js first.'); return; }
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { showError(error.message || 'Google sign-in was cancelled.'); }
});

document.querySelector('#phoneTab').addEventListener('click', () => { document.querySelector('#phoneTab').classList.add('active'); document.querySelector('#emailTab').classList.remove('active'); phonePanel.hidden = false; emailPanel.hidden = true; });
document.querySelector('#emailTab').addEventListener('click', () => { document.querySelector('#emailTab').classList.add('active'); document.querySelector('#phoneTab').classList.remove('active'); phonePanel.hidden = true; emailPanel.hidden = false; });

document.querySelector('#sendPhoneOtp').addEventListener('click', async () => {
  if (!phoneInput.value.trim()) { showError('Enter a phone number with country code.'); return; }
  if (!auth) { phonePreview.textContent = phoneInput.value; emailStep.classList.remove('active'); otpStep.classList.add('active'); otpInputs[0].focus(); return; }
  try {
    if (!window.recaptchaVerifier) window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
    confirmationResult = await signInWithPhoneNumber(auth, phoneInput.value.trim(), window.recaptchaVerifier);
    phonePreview.textContent = phoneInput.value; emailStep.classList.remove('active'); otpStep.classList.add('active'); otpInputs[0].focus();
  } catch (error) { showError(error.message || 'Could not send the SMS code.'); }
});

document.querySelector('#sendEmailLink').addEventListener('click', async () => {
  if (!emailInput.value || !emailInput.checkValidity()) { showError('Enter a valid email address.'); return; }
  if (!auth) { showError('Add your Firebase web config to firebase-config.js first.'); return; }
  const actionCodeSettings = { url: `${window.location.origin}/login.html`, handleCodeInApp: true };
  try { await sendSignInLinkToEmail(auth, emailInput.value, actionCodeSettings); localStorage.setItem('traceEmailForSignIn', emailInput.value); showError('Sign-in link sent. Open it from this device to continue.'); }
  catch (error) { showError(error.message || 'Could not send the sign-in link.'); }
});

otpInputs.forEach((input, index) => input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 1); if (input.value && otpInputs[index + 1]) otpInputs[index + 1].focus(); }));
otpInputs.forEach((input, index) => input.addEventListener('keydown', (event) => { if (event.key === 'Backspace' && !input.value && otpInputs[index - 1]) otpInputs[index - 1].focus(); }));

document.querySelector('#verifyOtp').addEventListener('click', () => {
  const code = otpInputs.map((input) => input.value).join('');
  if (confirmationResult) { confirmationResult.confirm(code).catch((error) => showError(error.message || 'The SMS code is invalid.')); return; }
  if (code !== '123456') { otpInputs.forEach((input) => { input.style.borderColor = '#ff806e'; }); return; }
  localStorage.setItem('traceUserEmail', phoneInput.value || emailInput.value);
  if (profilePhone.value && phoneConsent.checked) localStorage.setItem('traceUnverifiedPhone', profilePhone.value.trim());
  window.location.href = 'dashboard.html';
});

document.querySelector('#backToEmail').addEventListener('click', () => { otpStep.classList.remove('active'); emailStep.classList.add('active'); phoneInput.focus(); });

const iconMarkup = { lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' };
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = iconMarkup[el.dataset.icon] || ''; });

const emailStep = document.querySelector('#emailStep');
const emailInput = document.querySelector('#email');
const phoneInput = document.querySelector('#phone');
const countryCode = document.querySelector('#countryCode');
const emailSignInForm = document.querySelector('#emailSignInForm');
const authFeedback = document.querySelector('#authFeedback');
const authEyebrow = document.querySelector('#authEyebrow');
const authTitle = document.querySelector('#authTitle');
const authDescription = document.querySelector('#authDescription');
const googleLabel = document.querySelector('#googleLabel');
const modeToggle = document.querySelector('#modeToggle');
let registerMode = true;
let auth = null;
let db = null;
let finishing = false;
let firebaseInitializationError = null;

const configured = window.TRACE_FIREBASE_CONFIG?.apiKey && !window.TRACE_FIREBASE_CONFIG.apiKey.includes('PASTE_');
if (configured && window.firebase) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.TRACE_FIREBASE_CONFIG);
    auth = firebase.auth();
  } catch (error) {
    firebaseInitializationError = error;
    console.error('Firebase authentication initialization failed.', error);
  }
  if (auth) {
    try {
      db = firebase.firestore();
    } catch (error) {
      console.error('Firebase Firestore initialization failed.', error);
    }
    try {
      auth.onAuthStateChanged((user) => { if (user) finish(user); });
    } catch (error) {
      firebaseInitializationError = error;
      console.error('Firebase authentication setup failed.', error);
    }
  }
}

function phoneDetails() {
  const entered = (phoneInput?.value || '').trim();
  if (!entered) return null;
  const nationalNumber = entered.replace(/\D/g, '');
  const dialCode = countryCode.value.replace(/\D/g, '');
  const fullNumber = `${dialCode}${nationalNumber}`;
  if (nationalNumber.length < 4 || fullNumber.length > 15) {
    throw new Error('Enter a valid phone number for the selected country.');
  }
  return {
    phoneE164: `+${fullNumber}`,
    phoneCountry: countryCode.options[countryCode.selectedIndex].dataset.country
  };
}

function rememberPhone(phone) {
  localStorage.setItem('tracePendingPhone', phone.phoneE164);
  localStorage.setItem('tracePendingCountry', phone.phoneCountry);
}

async function finish(user) {
  if (finishing) return;
  finishing = true;
  try {
    if (!user.emailVerified) {
      showError('Verify your email before entering TRACE.');
      return;
    }

    let phone = phoneDetails();
    if (!phone) {
      const pendingPhone = localStorage.getItem('tracePendingPhone');
      if (pendingPhone) {
        phone = {
          phoneE164: pendingPhone,
          phoneCountry: localStorage.getItem('tracePendingCountry') || ''
        };
      }
    }

    let profileSyncFailed = false;
    if (db) {
      const profile = {
        email: user.email || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (phone) {
        profile.phoneE164 = phone.phoneE164;
        profile.phoneCountry = phone.phoneCountry;
        profile.phoneVerified = false;
      }
      try {
        await db.collection('users').doc(user.uid).set(profile, { merge: true });
      } catch (error) {
        profileSyncFailed = true;
        console.error('Firebase profile setup failed.', error);
      }
    } else {
      profileSyncFailed = true;
      console.error('Firebase profile setup skipped because Firestore is unavailable.');
    }

    localStorage.setItem('traceUserEmail', user.email || user.phoneNumber || 'Verified user');
    if (!profileSyncFailed) {
      localStorage.removeItem('tracePendingPhone');
      localStorage.removeItem('tracePendingCountry');
    }
    const dashboardUrl = new URL('dashboard.html', window.location.href);
    if (profileSyncFailed) dashboardUrl.searchParams.set('profileSync', 'failed');
    window.location.replace(dashboardUrl.href);
  } catch (error) {
    console.error('Could not complete the authenticated redirect.', error);
    showError(error.message || 'Could not continue to the dashboard.');
  } finally {
    finishing = false;
  }
}

function showError(message) {
  authFeedback.textContent = message;
  authFeedback.className = 'auth-feedback auth-feedback-error';
  authFeedback.setAttribute('role', 'alert');
  authFeedback.hidden = false;
}

function showAuthStatus(message, state) {
  authFeedback.textContent = message;
  authFeedback.className = `auth-feedback auth-feedback-${state}`;
  authFeedback.setAttribute('role', 'status');
  authFeedback.hidden = false;
}

function showFirebaseUnavailable() {
  const reason = firebaseInitializationError?.message;
  showError(reason
    ? `Firebase could not initialize: ${reason}`
    : 'Firebase is not configured or its SDK did not load. Check the root .env file and reload this page.');
}

document.querySelector('#googleSignIn').addEventListener('click', async () => {
  let phone;
  try { phone = phoneDetails(); }
  catch (error) { showError(error.message); return; }
  if (phone) rememberPhone(phone);
  localStorage.setItem('traceSession', JSON.stringify({email:'Google workspace',provider:'google',createdAt:Date.now()}));
  window.location.replace('dashboard.html');
});

function updateMode() {
  registerMode = !registerMode;
  authEyebrow.textContent = registerMode ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK';
  authTitle.textContent = registerMode ? 'Create your private workspace' : 'Log in to your workspace';
  authDescription.textContent = registerMode ? 'Register once, then map your exported data locally. TRACE never receives your platform passwords.' : 'Use your verified email to return to your local data workspace.';
  googleLabel.textContent = registerMode ? 'Register with Google' : 'Log in with Google';
  document.querySelector('#sendEmailLink').textContent = auth?.currentUser ? 'Continue to workspace' : (registerMode ? 'Register with email' : 'Log in with email');
  modeToggle.textContent = registerMode ? 'Already registered? Log in' : 'New here? Create an account';
}
modeToggle.addEventListener('click', updateMode);

emailSignInForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  if (!email || !emailInput.checkValidity()) { showError('Enter a valid email address.'); return; }
  let phone;
  try { phone = phoneDetails(); }
  catch (error) { showError(error.message); return; }
  if (phone) rememberPhone(phone);
  localStorage.setItem('traceSession', JSON.stringify({ email, phone: phone?.phoneE164 || '', createdAt: Date.now() }));
  window.location.replace('dashboard.html');
  return;

});

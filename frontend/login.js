const iconMarkup = { lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' };
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = iconMarkup[el.dataset.icon] || ''; });

const emailStep = document.querySelector('#emailStep');
const otpStep = document.querySelector('#otpStep');
const emailInput = document.querySelector('#email');
const emailPreview = document.querySelector('#emailPreview');
const otpInputs = [...document.querySelectorAll('.otp-input')];

document.querySelector('#sendOtp').addEventListener('click', () => {
  if (!emailInput.value || !emailInput.checkValidity()) { emailInput.focus(); emailInput.style.borderColor = '#ff806e'; return; }
  emailPreview.textContent = emailInput.value;
  emailStep.classList.remove('active');
  otpStep.classList.add('active');
  otpInputs[0].focus();
});

otpInputs.forEach((input, index) => input.addEventListener('input', () => {
  input.value = input.value.replace(/\D/g, '').slice(0, 1);
  if (input.value && otpInputs[index + 1]) otpInputs[index + 1].focus();
}));
otpInputs.forEach((input, index) => input.addEventListener('keydown', (event) => {
  if (event.key === 'Backspace' && !input.value && otpInputs[index - 1]) otpInputs[index - 1].focus();
}));

document.querySelector('#verifyOtp').addEventListener('click', () => {
  const code = otpInputs.map((input) => input.value).join('');
  if (code !== '123456') { otpInputs.forEach((input) => { input.style.borderColor = '#ff806e'; }); return; }
  localStorage.setItem('traceUserEmail', emailInput.value);
  window.location.href = 'dashboard.html';
});

document.querySelector('#backToEmail').addEventListener('click', () => {
  otpStep.classList.remove('active');
  emailStep.classList.add('active');
  emailInput.focus();
});

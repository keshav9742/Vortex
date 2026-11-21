/* Email entry intentionally opens the local workspace without Firebase email auth. */
(() => {
  const button = document.querySelector('#sendEmailLink');
  const email = document.querySelector('#email');
  const feedback = document.querySelector('#authFeedback');
  if (!button || !email) return;
  button.addEventListener('click', () => {
    const value = email.value.trim();
    if (!value || !email.checkValidity()) {
      if (feedback) {
        feedback.textContent = 'Enter a valid email address.';
        feedback.className = 'auth-feedback auth-feedback-error';
        feedback.hidden = false;
      }
      email.focus();
      return;
    }
    localStorage.setItem('traceSession', JSON.stringify({email:value,createdAt:Date.now()}));
    window.location.replace(`dashboard.html?email=${encodeURIComponent(value)}`);
  });
})();

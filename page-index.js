(function () {
  const API = '/.netlify/functions/waitlist';

  const form = document.getElementById('waitlistForm');
  if (!form) return;

  const emailField = document.getElementById('waitlistEmail');
  const honeypot = document.getElementById('waitlistCompany');
  const notice = document.getElementById('waitlistNotice');
  const submitButton = form.querySelector('button[type="submit"], .waitlist-button');

  function show(message, kind) {
    notice.textContent = message;
    notice.className = 'form-notice is-visible is-' + kind;
  }

  function hide() {
    notice.className = 'form-notice';
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = emailField.value.trim();

    // Client-side shape check only. The server re-validates and owns the
    // case-insensitive duplicate check, which a browser cannot do.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show('Please enter a valid email address.', 'error');
      return;
    }

    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, company: honeypot ? honeypot.value : '' })
      });

      const body = await response.json().catch(function () {
        return {};
      });

      if (response.status === 409) {
        show(body.error || 'This email is already on the waitlist.', 'warning');
      } else if (!response.ok) {
        show(body.error || 'Something went wrong. Please try again.', 'error');
      } else {
        show("Thank you! You've been added to the waitlist.", 'success');
        form.reset();
      }
    } catch {
      show('Network error. Please try again.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
      setTimeout(hide, 6000);
    }
  });
})();

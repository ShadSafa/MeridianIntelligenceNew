// Submits any [data-netlify] form over fetch so the page keeps its inline
// success message instead of navigating to Netlify's default confirmation.
// Submissions land in the Netlify dashboard under the form's name.

(function () {
  const forms = document.querySelectorAll('form[data-netlify="true"]');
  if (forms.length === 0) return;

  function noticeFor(form) {
    const id = form.getAttribute('data-notice');
    return id ? document.getElementById(id) : null;
  }

  function show(node, message, kind) {
    if (!node) return;
    node.textContent = message;
    node.className = 'form-notice is-visible is-' + kind;
  }

  function hide(node) {
    if (node) node.className = 'form-notice';
  }

  forms.forEach(function (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const notice = noticeFor(form) || document.getElementById('formNotice');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      hide(notice);

      try {
        const response = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString()
        });

        if (response.ok) {
          show(notice, form.getAttribute('data-success') || 'Thank you! We will be in touch soon.', 'success');
          form.reset();
        } else {
          show(notice, 'Something went wrong. Please try again.', 'error');
        }
      } catch {
        show(notice, 'Network error. Please try again.', 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
        setTimeout(function () {
          hide(notice);
        }, 6000);
      }
    });
  });
})();

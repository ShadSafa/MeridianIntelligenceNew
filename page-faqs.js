(function () {
  const API = '/.netlify/functions/content';

  const list = document.getElementById('faqsList');
  const statusLine = document.getElementById('statusLine');
  const pageNotice = document.getElementById('pageNotice');
  const modalNotice = document.getElementById('modalNotice');
  const modal = document.getElementById('addModal');
  const questionField = document.getElementById('faqQuestion');
  const answerField = document.getElementById('faqAnswer');

  function showNotice(node, message, kind) {
    node.textContent = message;
    node.className = 'form-notice is-visible is-' + kind;
  }

  function hideNotice(node) {
    node.className = 'form-notice';
  }

  function renderItem(faq) {
    const item = document.createElement('div');
    item.className = 'faq-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'faq-question';
    button.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    // textContent, never innerHTML: content must never be parsed as markup.
    label.textContent = faq.question;

    const toggle = document.createElement('span');
    toggle.className = 'faq-toggle';
    toggle.textContent = '+';

    button.appendChild(label);
    button.appendChild(toggle);

    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    answer.textContent = faq.answer;

    button.addEventListener('click', function () {
      const open = item.classList.toggle('active');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    item.appendChild(button);
    item.appendChild(answer);
    return item;
  }

  function render(faqs) {
    list.replaceChildren();
    faqs.forEach(function (faq) {
      list.appendChild(renderItem(faq));
    });
    statusLine.hidden = faqs.length > 0;
    if (faqs.length === 0) {
      statusLine.textContent = 'No FAQs yet.';
    }
  }

  async function load() {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('bad status');
      const data = await response.json();
      render(data.faqs || []);
    } catch {
      statusLine.hidden = false;
      statusLine.textContent = '';
      showNotice(pageNotice, 'Could not load FAQs. Please refresh.', 'error');
    }
  }

  function openModal() {
    hideNotice(modalNotice);
    modal.classList.add('show');
    questionField.focus();
  }

  function closeModal() {
    modal.classList.remove('show');
    questionField.value = '';
    answerField.value = '';
    hideNotice(modalNotice);
  }

  async function save() {
    const payload = {
      type: 'faq',
      question: questionField.value.trim(),
      answer: answerField.value.trim()
    };

    if (!payload.question || !payload.answer) {
      showNotice(modalNotice, 'Please fill in both the question and the answer.', 'error');
      return;
    }

    const token = await window.MeridianAuth.token();
    if (!token) {
      showNotice(modalNotice, 'Your session expired. Please sign in again.', 'error');
      return;
    }

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        showNotice(modalNotice, body.error || 'Could not save the FAQ.', 'error');
        return;
      }

      render(body.faqs || []);
      closeModal();
      showNotice(pageNotice, 'FAQ added.', 'success');
      setTimeout(function () {
        hideNotice(pageNotice);
      }, 4000);
    } catch {
      showNotice(modalNotice, 'Network error. Please try again.', 'error');
    }
  }

  document.getElementById('openAddModal').addEventListener('click', openModal);
  document.getElementById('saveFaq').addEventListener('click', save);
  document.getElementById('cancelFaq').addEventListener('click', closeModal);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });

  load();
})();

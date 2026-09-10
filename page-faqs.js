(function () {
  const API = '/.netlify/functions/content';

  const list = document.getElementById('faqsList');
  const statusLine = document.getElementById('statusLine');
  const pageNotice = document.getElementById('pageNotice');
  const modalNotice = document.getElementById('modalNotice');
  const modal = document.getElementById('addModal');
  const modalTitle = document.getElementById('modalTitle');
  const questionField = document.getElementById('faqQuestion');
  const answerField = document.getElementById('faqAnswer');
  const saveButton = document.getElementById('saveFaq');

  // null while adding; holds the item id while editing.
  let editingId = null;

  function showNotice(node, message, kind) {
    node.textContent = message;
    node.className = 'form-notice is-visible is-' + kind;
  }

  function hideNotice(node) {
    node.className = 'form-notice';
  }

  function flash(message, kind) {
    showNotice(pageNotice, message, kind);
    setTimeout(function () {
      hideNotice(pageNotice);
    }, 4000);
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

    const body = document.createElement('div');
    body.className = 'faq-answer';

    const answer = document.createElement('p');
    answer.textContent = faq.answer;
    body.appendChild(answer);

    const controls = document.createElement('div');
    controls.className = 'item-admin';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn-edit';
    edit.textContent = 'Edit';
    edit.addEventListener('click', function () {
      openModal(faq);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-delete';
    remove.textContent = 'Delete';
    remove.addEventListener('click', function () {
      deleteFaq(faq, remove);
    });

    controls.appendChild(edit);
    controls.appendChild(remove);
    body.appendChild(controls);

    button.addEventListener('click', function () {
      const open = item.classList.toggle('active');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    item.appendChild(button);
    item.appendChild(body);
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

  function openModal(faq) {
    hideNotice(modalNotice);
    editingId = faq ? faq.id : null;
    modalTitle.textContent = faq ? 'Edit FAQ' : 'Add New FAQ';
    saveButton.textContent = faq ? 'Save changes' : 'Save';
    questionField.value = faq ? faq.question : '';
    answerField.value = faq ? faq.answer : '';
    modal.classList.add('show');
    questionField.focus();
  }

  function closeModal() {
    modal.classList.remove('show');
    editingId = null;
    questionField.value = '';
    answerField.value = '';
    hideNotice(modalNotice);
  }

  async function send(method, payload) {
    const token = await window.MeridianAuth.token();
    if (!token) return { ok: false, error: 'Your session expired. Please sign in again.' };

    try {
      const response = await fetch(API, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) return { ok: false, error: body.error || 'Could not save the FAQ.' };
      return { ok: true, data: body };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
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

    const editing = editingId !== null;
    if (editing) payload.id = editingId;

    saveButton.disabled = true;
    const result = await send(editing ? 'PUT' : 'POST', payload);
    saveButton.disabled = false;

    if (!result.ok) {
      showNotice(modalNotice, result.error, 'error');
      return;
    }

    render(result.data.faqs || []);
    closeModal();
    flash(editing ? 'FAQ updated.' : 'FAQ added.', 'success');
  }

  async function deleteFaq(faq, button) {
    if (!window.confirm('Delete this FAQ?\n\n' + faq.question)) return;

    button.disabled = true;
    const result = await send('DELETE', { type: 'faq', id: faq.id });
    button.disabled = false;

    if (!result.ok) {
      flash(result.error, 'error');
      return;
    }

    render(result.data.faqs || []);
    flash('FAQ deleted.', 'success');
  }

  document.getElementById('openAddModal').addEventListener('click', function () {
    openModal(null);
  });
  saveButton.addEventListener('click', save);
  document.getElementById('cancelFaq').addEventListener('click', closeModal);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });

  load();
})();

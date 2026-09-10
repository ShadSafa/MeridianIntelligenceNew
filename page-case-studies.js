(function () {
  const API = '/.netlify/functions/content';

  const grid = document.getElementById('caseStudiesGrid');
  const statusLine = document.getElementById('statusLine');
  const pageNotice = document.getElementById('pageNotice');
  const modalNotice = document.getElementById('modalNotice');
  const modal = document.getElementById('addModal');
  const modalTitle = document.getElementById('modalTitle');
  const saveButton = document.getElementById('saveCaseStudy');

  const fields = {
    company: document.getElementById('csCompanyName'),
    industry: document.getElementById('csIndustry'),
    challenge: document.getElementById('csChallenge'),
    solution: document.getElementById('csSolution'),
    results: document.getElementById('csResults')
  };

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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    // textContent, never innerHTML: content is operator-supplied and must
    // never be parsed as markup.
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCard(study) {
    const card = el('div', 'case-study-card');
    card.appendChild(el('h3', null, study.company));
    card.appendChild(el('span', 'case-study-tag', study.industry));

    const challenge = el('p');
    challenge.appendChild(el('strong', null, 'Challenge: '));
    challenge.appendChild(document.createTextNode(study.challenge));
    card.appendChild(challenge);

    const solution = el('p');
    solution.appendChild(el('strong', null, 'Solution: '));
    solution.appendChild(document.createTextNode(study.solution));
    card.appendChild(solution);

    const results = el('div', 'case-study-results');
    results.appendChild(el('h4', null, 'Results'));
    const list = el('ul');
    (study.results || []).forEach(function (item) {
      list.appendChild(el('li', null, item));
    });
    results.appendChild(list);
    card.appendChild(results);

    const controls = el('div', 'item-admin');

    const edit = el('button', 'btn-edit', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      openModal(study);
    });

    const remove = el('button', 'btn-delete', 'Delete');
    remove.type = 'button';
    remove.addEventListener('click', function () {
      deleteStudy(study, remove);
    });

    controls.appendChild(edit);
    controls.appendChild(remove);
    card.appendChild(controls);

    return card;
  }

  function render(studies) {
    grid.replaceChildren();
    studies.forEach(function (study) {
      grid.appendChild(renderCard(study));
    });
    statusLine.hidden = studies.length > 0;
    if (studies.length === 0) {
      statusLine.textContent = 'No case studies yet.';
    }
  }

  async function load() {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('bad status');
      const data = await response.json();
      render(data.caseStudies || []);
    } catch {
      statusLine.hidden = false;
      statusLine.textContent = '';
      showNotice(pageNotice, 'Could not load case studies. Please refresh.', 'error');
    }
  }

  function openModal(study) {
    hideNotice(modalNotice);
    editingId = study ? study.id : null;
    modalTitle.textContent = study ? 'Edit Case Study' : 'Add New Case Study';
    saveButton.textContent = study ? 'Save changes' : 'Save';

    fields.company.value = study ? study.company : '';
    fields.industry.value = study ? study.industry : '';
    fields.challenge.value = study ? study.challenge : '';
    fields.solution.value = study ? study.solution : '';
    fields.results.value = study ? (study.results || []).join('\n') : '';

    modal.classList.add('show');
    fields.company.focus();
  }

  function closeModal() {
    modal.classList.remove('show');
    editingId = null;
    Object.values(fields).forEach(function (field) {
      field.value = '';
    });
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

      if (!response.ok) return { ok: false, error: body.error || 'Could not save the case study.' };
      return { ok: true, data: body };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }

  async function save() {
    const results = fields.results.value
      .split('\n')
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    const payload = {
      type: 'caseStudy',
      company: fields.company.value.trim(),
      industry: fields.industry.value.trim(),
      challenge: fields.challenge.value.trim(),
      solution: fields.solution.value.trim(),
      results: results
    };

    if (!payload.company || !payload.industry || !payload.challenge || !payload.solution || results.length === 0) {
      showNotice(modalNotice, 'Please fill in every field, including at least one result.', 'error');
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

    render(result.data.caseStudies || []);
    closeModal();
    flash(editing ? 'Case study updated.' : 'Case study added.', 'success');
  }

  async function deleteStudy(study, button) {
    if (!window.confirm('Delete this case study?\n\n' + study.company)) return;

    button.disabled = true;
    const result = await send('DELETE', { type: 'caseStudy', id: study.id });
    button.disabled = false;

    if (!result.ok) {
      flash(result.error, 'error');
      return;
    }

    render(result.data.caseStudies || []);
    flash('Case study deleted.', 'success');
  }

  document.getElementById('openAddModal').addEventListener('click', function () {
    openModal(null);
  });
  saveButton.addEventListener('click', save);
  document.getElementById('cancelCaseStudy').addEventListener('click', closeModal);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });

  load();
})();

(function () {
  const API = '/.netlify/functions/waitlist';

  const rows = document.getElementById('rows');
  const count = document.getElementById('count');
  const emptyState = document.getElementById('emptyState');
  const notice = document.getElementById('pageNotice');
  const refresh = document.getElementById('refresh');

  function showNotice(message, kind) {
    notice.textContent = message;
    notice.className = 'form-notice is-visible is-' + kind;
  }

  function hideNotice() {
    notice.className = 'form-notice';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function render(entries) {
    // Newest first: the most recent signup is the one worth seeing.
    const sorted = entries.slice().sort(function (a, b) {
      return String(b.joinedAt || '').localeCompare(String(a.joinedAt || ''));
    });

    rows.replaceChildren();

    sorted.forEach(function (entry, index) {
      const tr = document.createElement('tr');

      const num = document.createElement('td');
      num.className = 'index';
      num.textContent = String(index + 1);

      const email = document.createElement('td');
      // textContent, never innerHTML: these strings came from a form.
      email.textContent = entry.email;

      const joined = document.createElement('td');
      joined.textContent = formatDate(entry.joinedAt);

      tr.appendChild(num);
      tr.appendChild(email);
      tr.appendChild(joined);
      rows.appendChild(tr);
    });

    emptyState.hidden = sorted.length > 0;
    count.textContent = sorted.length === 1 ? '1 signup' : sorted.length + ' signups';
  }

  async function load() {
    if (!window.MeridianAuth.isLoggedIn()) return;

    refresh.disabled = true;
    count.textContent = 'Loading...';

    const token = await window.MeridianAuth.token();
    if (!token) {
      showNotice('Your session expired. Please sign in again.', 'error');
      count.textContent = '';
      refresh.disabled = false;
      return;
    }

    try {
      const response = await fetch(API, {
        headers: { Authorization: 'Bearer ' + token }
      });

      if (response.status === 401) {
        showNotice('Your session is no longer valid. Please sign in again.', 'error');
        count.textContent = '';
        return;
      }

      if (!response.ok) {
        showNotice('Could not load the waitlist.', 'error');
        count.textContent = '';
        return;
      }

      const data = await response.json();
      hideNotice();
      render(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      showNotice('Network error. Please try again.', 'error');
      count.textContent = '';
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', load);

  // auth.js fires this once Identity has settled, and again on sign in/out.
  document.addEventListener('meridian-auth', function (event) {
    if (event.detail.user) {
      load();
    } else {
      rows.replaceChildren();
      count.textContent = '';
      hideNotice();
    }
  });
})();

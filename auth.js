// Shared Netlify Identity wiring. Every page includes this.
// The admin gate this drives is cosmetic on its own -- the real check happens
// server-side in netlify/functions, which rejects any write without a valid JWT.

(function () {
  const identity = window.netlifyIdentity;

  const state = {
    user: null
  };

  function notify() {
    document.dispatchEvent(
      new CustomEvent('meridian-auth', { detail: { user: state.user } })
    );
  }

  function renderButton() {
    const button = document.getElementById('authButton');
    if (!button) return;

    if (state.user) {
      button.textContent = 'Sign out';
      button.title = state.user.email || '';
    } else {
      button.textContent = 'Admin sign in';
      button.removeAttribute('title');
    }
  }

  function setUser(user) {
    state.user = user || null;
    document.body.classList.toggle('is-admin', Boolean(state.user));
    renderButton();
    notify();
  }

  window.MeridianAuth = {
    isLoggedIn() {
      return Boolean(state.user);
    },
    email() {
      return state.user ? state.user.email : null;
    },
    // Returns a fresh JWT, or null when signed out. The widget refreshes an
    // expired token automatically.
    async token() {
      if (!state.user) return null;
      try {
        return await state.user.jwt();
      } catch {
        return null;
      }
    },
    open() {
      if (identity) identity.open('login');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('authButton');

    if (!identity) {
      // Widget blocked or offline: leave the page in its signed-out state.
      if (button) button.hidden = true;
      notify();
      return;
    }

    if (button) {
      button.addEventListener('click', function () {
        if (state.user) {
          identity.logout();
        } else {
          identity.open('login');
        }
      });
    }

    identity.on('init', setUser);
    identity.on('login', function (user) {
      setUser(user);
      identity.close();
    });
    identity.on('logout', function () {
      setUser(null);
    });

    identity.init();
  });
})();

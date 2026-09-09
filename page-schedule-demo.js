(function () {
  const tabs = Array.from(document.querySelectorAll('.service-tab'));
  const panels = Array.from(document.querySelectorAll('.service-content'));
  const valid = panels.map(function (panel) {
    return panel.id;
  });

  function activate(name) {
    if (valid.indexOf(name) === -1) return;

    panels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === name);
    });

    tabs.forEach(function (tab) {
      const selected = tab.getAttribute('data-tab') === name;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(tab.getAttribute('data-tab'));
    });
  });

  // Lets index.html deep-link straight to a service, e.g. schedule-demo.html#training
  const requested = window.location.hash.replace('#', '');
  if (valid.indexOf(requested) !== -1) {
    activate(requested);
    // The hash makes the browser jump to the panel, which hides the tab bar.
    window.scrollTo(0, 0);
  }
})();

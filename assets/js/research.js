(() => {
  'use strict';

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.primary-navigation');
  if (header && menuButton && navigation) {
    const setMenu = (open) => {
      header.classList.toggle('nav-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
    };
    menuButton.hidden = false;
    header.classList.add('nav-ready');
    menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      setMenu(false);
      if (link.hash && link.pathname === window.location.pathname) {
        const section = document.getElementById(link.hash.slice(1));
        if (section) {
          section.setAttribute('tabindex', '-1');
          section.focus({ preventScroll: true });
        }
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('nav-open')) {
        setMenu(false);
        menuButton.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) setMenu(false);
    });
    window.matchMedia('(max-width: 820px)').addEventListener('change', () => setMenu(false));
  }

  // Content is visible by default, including when JavaScript or observers are unavailable.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (!motion.matches) entry.target.classList.add('reveal-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));
  }

  // Keep the accessible count fixed while animating the visual count.
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        counterObserver.unobserve(entry.target);
        const finalValue = Number(entry.target.dataset.count);
        if (motion.matches) return;
        let start;
        const tick = (time) => {
          if (start === undefined) start = time;
          const progress = Math.min((time - start) / 1000, 1);
          entry.target.textContent = String(Math.round(finalValue * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1 && !motion.matches) requestAnimationFrame(tick);
          else entry.target.textContent = String(finalValue);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.75 });
    counters.forEach((counter) => counterObserver.observe(counter));
  }

  document.querySelectorAll('.copy-citation').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const citation = document.getElementById(button.dataset.citation);
      const status = button.closest('.citation-box').querySelector('.copy-status');
      const text = citation.textContent.replace(/\s+/g, ' ').trim();
      status.textContent = '';
      try {
        if (window.ClipboardItem && navigator.clipboard.write) {
          const item = new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([`<p>${citation.innerHTML}</p>`], { type: 'text/html' }),
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(text);
        }
        status.textContent = 'Citation copied.';
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(citation);
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = 'Press Ctrl+C or ⌘C to copy the selected citation.';
      }
    });
  });

  const search = document.getElementById('contributor-query');
  if (search) {
    const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const items = Array.from(document.querySelectorAll('#contributor-list li'));
    const records = items.map((item) => ({ item, text: normalize(item.textContent) }));
    const count = document.getElementById('contributor-count');
    const clearButton = document.getElementById('clear-search');
    const emptyState = document.querySelector('.no-results');
    const directory = document.querySelector('.contributor-directory');
    document.querySelector('.contributor-search').hidden = false;
    const filter = () => {
      const query = normalize(search.value.trim());
      let matches = 0;
      records.forEach(({ item, text }) => {
        item.hidden = !text.includes(query);
        if (!item.hidden) matches += 1;
      });
      count.textContent = query ? `${matches} of ${items.length} contributors found` : `${items.length} contributors in the directory`;
      clearButton.hidden = !search.value;
      emptyState.hidden = matches !== 0;
      if (query) directory.open = true;
    };
    search.addEventListener('input', filter);
    clearButton.addEventListener('click', () => {
      search.value = '';
      filter();
      search.focus();
    });
    filter();
  }
})();

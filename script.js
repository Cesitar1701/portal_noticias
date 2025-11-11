// ===== Scripts migrados desde index.html =====

// --- Script 1 ---
// City dropdown behavior for weather widget
    (function () {
      const btn = document.getElementById('city-btn');
      const menu = document.getElementById('city-menu');
      if (!btn || !menu) return;

      function openMenu() {
        menu.setAttribute('aria-hidden', 'false');
        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
      function closeMenu() {
        menu.setAttribute('aria-hidden', 'true');
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = menu.getAttribute('aria-hidden') === 'false';
        if (isOpen) closeMenu(); else openMenu();
      });

      // click outside to close
      document.addEventListener('click', function (e) {
        if (!btn.contains(e.target) && !menu.contains(e.target)) closeMenu();
      });

      // keyboard: Esc closes
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

      // handle selection
      menu.querySelectorAll('li[role="menuitem"]').forEach(li => {
        li.addEventListener('click', function (e) {
          e.stopPropagation();
          menu.querySelectorAll('li').forEach(x => x.classList.remove('active'));
          li.classList.add('active');
          // update button label (keep icon)
          const icon = btn.querySelector('i');
          btn.firstChild.textContent = li.textContent;
          if (icon) btn.appendChild(icon);
          closeMenu();
          // future: trigger a weather data refresh for selected city
        });
      });
    })();

// --- Script 2 ---
// Videos carousel: prev/next + keyboard navigation
    (function () {
      const carousel = document.querySelector('.videos-carousel');
      const prevBtn = document.querySelector('.carousel-btn.prev');
      const nextBtn = document.querySelector('.carousel-btn.next');
      if (!carousel) return;

      function scrollAmount(dir) {
        const card = carousel.querySelector('.video-card');
        if (!card) return carousel.clientWidth * 0.8 * dir;
        const gap = parseInt(getComputedStyle(carousel).gap) || 18;
        return (card.offsetWidth + gap) * dir;
      }

      if (prevBtn) { prevBtn.addEventListener('click', () => { carousel.scrollBy({ left: -scrollAmount(1), behavior: 'smooth' }); }); }
      if (nextBtn) { nextBtn.addEventListener('click', () => { carousel.scrollBy({ left: scrollAmount(1), behavior: 'smooth' }); }); }

      // keyboard navigation when carousel focused
      carousel.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); carousel.scrollBy({ left: scrollAmount(1), behavior: 'smooth' }); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); carousel.scrollBy({ left: -scrollAmount(1), behavior: 'smooth' }); }
      });

      // make carousel focusable and hint
      carousel.setAttribute('tabindex', '0');
    })();

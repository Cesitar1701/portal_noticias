import { AIRTABLE_TOKEN, BASE_ID, TABLE_NAME } from './env.js';
const airtabletoken = AIRTABLE_TOKEN;
const baseId = BASE_ID;
const tableName = TABLE_NAME;
const viewName = "Grid view";
/* ===========================
   UTILIDADES
   =========================== */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const n = new Date(), d = new Date(dateStr);
  const diff = Math.max(0, n - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}
function esc(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const norm = s => (s || '').toString().trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ===========================
   RENDER DE UNA CARD 
   =========================== */
function renderCardHTML(rec) {
  const title = esc(rec.title), cat = esc(rec.category), excerpt = esc(rec.excerpt);
  const img = esc(rec.hero), meta = timeAgo(rec.publishedAt);
  return `
<article class="card" data-slug="${esc(rec.slug)}"data-title="${title}"
  data-category="${cat}"
  data-meta="${esc(meta)}"
  data-img="${img}">
  <img class="cover" src="${img}" alt="${title}">
  <button class="card-bookmark" aria-label="Guardar"><i class="fa-regular fa-bookmark"></i></button>
  <div class="body">
    <span class="kicker">${cat}</span>
    <div class="card-meta"><i class="fa-regular fa-clock"></i> ${esc(meta)}</div>
    <h3>${title}</h3>
    <p>${excerpt}</p>
    <a class="read-more" href="#article-modal">Leer más <span class="arrow">→</span></a>
  </div>
</article>`;
}

/* ===========================
   MODAL DINÁMICO (estructura, abrir/cerrar, cabecera)
   =========================== */
(function () {
  const backdrop = document.getElementById('article-modal');
  if (!backdrop) return;

  const modal = backdrop.querySelector('.modal');
  const badgeEl = modal.querySelector('.badge');
  const heroImg = modal.querySelector('.hero img');
  const titleEl = modal.querySelector('.title');
  const metaPills = modal.querySelectorAll('.meta .pill'); // [0]=tiempo, [1]=autor, [2]=vistas]
  const closeLink = modal.querySelector('.close-link');

  function openModal() {
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeModal() {
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal(); });
  if (closeLink) closeLink.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  function extractFromCard(card) {
    const img = card.querySelector('img.cover');
    const kicker = card.querySelector('.kicker');
    const title = card.querySelector('h3');
    const desc = card.querySelector('p');
    const time = card.querySelector('.card-meta')?.textContent?.trim();

    return {
      category: kicker?.textContent?.trim() || 'NOTICIAS',
      title: title?.textContent?.trim() || '',
      desc: desc?.textContent?.trim() || '',
      imgSrc: img?.getAttribute('src') || '',
      imgAlt: img?.getAttribute('alt') || '',
      time: time || '',
      author: null,
      views: null,
      slug: card.getAttribute('data-slug') || ''
    };
  }

  function fillModal(data) {
    if (badgeEl) badgeEl.textContent = data.category;
    if (heroImg) {
      if (data.imgSrc) heroImg.src = data.imgSrc;
      if (data.imgAlt) heroImg.alt = data.imgAlt;
    }
    if (titleEl) titleEl.textContent = data.title;

    if (metaPills[0]) {
      const svg = metaPills[0].querySelector('svg')?.outerHTML || '';
      metaPills[0].innerHTML = svg + ' ' + (data.time || '—');
    }
    if (metaPills[1]) {
      const svg = metaPills[1].querySelector('svg')?.outerHTML || '';
      metaPills[1].innerHTML = svg + ' ' + (data.author || 'Redacción');
    }
    if (metaPills[2]) {
      const svg = metaPills[2].querySelector('svg')?.outerHTML || '';
      metaPills[2].innerHTML = svg + ' ' + (data.views || '—');
    }

    const quote = modal.querySelector('.quote p');
    if (quote && data.desc) quote.textContent = data.desc;
  }

  // Exportamos fillModal para usarlo desde la parte async
  window.__fillModal = fillModal;

  // Handler “simple” por si se usa antes de que cargue Airtable 
  window.__handleReadMoreFromArticle = function (articleEl) {
    const data = extractFromCard(articleEl);
    fillModal(data);
    openModal();
  };

  // Delegación para “Leer más” del DOM inicial
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.read-more');
    if (!a) return;
    e.preventDefault();
    const article = a.closest('article');
    if (article && window.__handleReadMoreFromArticle) {
      window.__handleReadMoreFromArticle(article);
    }
  });
})();

/* ===========================
   TABS POR CATEGORÍA (acepta datos externos)
   =========================== */
(function () {
  const tabs = document.querySelector('.tabs');
  if (!tabs) return;

  const controls = tabs.querySelector('.tabs-controls');
  if (!controls) return;

  // Contenedor de resultados debajo de los controles
  let results = tabs.querySelector('#tabs-results');
  if (!results) {
    results = document.createElement('div');
    results.id = 'tabs-results';
    results.className = 'cards-3';
    controls.insertAdjacentElement('afterend', results);
  }

  const idToCat = {
    'tab-todas': 'todas',
    'tab-politica': 'politica',
    'tab-salud': 'salud',
    'tab-policiales': 'policiales',
    'tab-turismo': 'turismo',
    'tab-deportes': 'deportes',
    'tab-empleos': 'empleos',
    'tab-tecno': 'tecnologia',
    'tab-internacional': 'internacional',
  };

  const sourceCards = Array.from(document.querySelectorAll('.col-main .cards-3 article.card'));

  // let (reemplazable con datos externos)
  let pool = sourceCards.map((card) => {
    const catText = card.querySelector('.kicker')?.textContent || '';
    return { category: norm(catText), html: card.outerHTML };
  });

  let currentCategory = 'todas';

  function render(categoryNorm) {
    currentCategory = categoryNorm || 'todas';
    let items = pool;
    if (currentCategory !== 'todas') items = pool.filter((it) => it.category === currentCategory);
    results.innerHTML = items.length
      ? items.map((it) => it.html).join('')
      : '<p class="muted">No hay noticias en esta categoría (todavía).</p>';
  }

  controls.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'tabs') {
      const category = idToCat[e.target.id] || 'todas';
      render(category);
    }
  });

  results.addEventListener('click', (e) => {
    const a = e.target.closest('a.read-more');
    if (!a) return;
    e.preventDefault();
    const article = a.closest('article');
    if (window.__handleReadMoreFromArticle) window.__handleReadMoreFromArticle(article);
  });

  // Setter global para inyectar el pool desde Airtable
  window.__setTabsPool = function (externalPool) {
    pool = Array.isArray(externalPool) ? externalPool : [];
    render(currentCategory);
  };

  render('todas');
})();

/* ===========================
   AIRTABLE REST (con PAT) + Paginación
   =========================== */

// Mensaje de “cargando” bajo tabs + limpiar cards hardcodeadas
(function showLoading() {
  // 1) Últimas noticias: vaciar lo hardcodeado del HTML
  const latestContainer = document.querySelector('.col-main .cards-3');
  if (latestContainer) latestContainer.innerHTML = '';

  // 2) Tabs: mensaje "cargando..."
  const tabs = document.querySelector('.tabs');
  const controls = tabs?.querySelector('.tabs-controls');
  if (controls) {
    let results = tabs.querySelector('#tabs-results');
    if (!results) {
      results = document.createElement('div');
      results.id = 'tabs-results';
      results.className = 'cards-3';
      controls.insertAdjacentElement('afterend', results);
    }
    results.innerHTML = '<p class="muted">Cargando noticias...</p>';
  }
})();

// Descarga todas las páginas
async function fetchAirtableAll() {
  const baseURL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  let url = `${baseURL}?pageSize=100${viewName ? `&view=${encodeURIComponent(viewName)}` : ''}`;
  const headers = {
    'Authorization': `Bearer ${airtabletoken}`,
    'Content-Type': 'application/json',
  };
  const all = [];
  let guard = 0;

  while (url && guard++ < 50) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data.records || []));
    const offset = data.offset;
    url = offset ? `${baseURL}?pageSize=100${viewName ? `&view=${encodeURIComponent(viewName)}` : ''}&offset=${offset}` : null;
  }
  return all;
}

// Carga, separa las 3 últimas y alimenta Tabs con el resto
(async function loadFromAirtableREST() {
  try {
    const records = await fetchAirtableAll();

    // Mapeo de campos según tu tabla: Titulo, Categoria, Parrafo, Img (URL), Fecha_publicada, Slug :contentReference[oaicite:0]{index=0}
    const mapped = records.map(rec => {
      const f = rec.fields || {};
      return {
        title: (f.Titulo || '').trim(),
        category: (f.Categoria || 'NOTICIAS').toString(),
        excerpt: (f.Parrafo || '').trim(),
        body: (f.Parrafo || '').trim(),
        hero: (f.Img || '').toString(),
        publishedAt: (f.Fecha_publicada || '').toString(),
        slug: (f.Slug || '').toString(),
      };
    }).filter(x => x.title && x.slug);

    // 1) Ordenar por fecha DESC (más nuevas primero)
    const ts = (r) => Date.parse(r.publishedAt) || 0;
    mapped.sort((a, b) => ts(b) - ts(a));

    // 2) Separar últimas 3 y resto
    const latest3 = mapped.slice(0, 3);
    const rest = mapped.slice(3);

    // 3) Pintar “Últimas noticias”
    const latestContainer = document.querySelector('.col-main .cards-3');
    if (latestContainer) {
      latestContainer.innerHTML = latest3.map(renderCardHTML).join('');
      if (!window.__latestDelegationBound) {
        const colMain = document.querySelector('.col-main');
        if (colMain) {
          colMain.addEventListener('click', (e) => {
            const a = e.target.closest('a.read-more');
            if (!a) return;
            e.preventDefault();
            const article = a.closest('article');
            if (window.__handleReadMoreFromArticle) {
              window.__handleReadMoreFromArticle(article);
            }
          });
          window.__latestDelegationBound = true;
        }
      }
    }

    // 4) Enviar el resto al bloque Tabs
    const poolFromAPI = rest.map(r => ({
      category: norm(r.category),
      html: renderCardHTML(r),
    }));
    if (window.__setTabsPool) {
      window.__setTabsPool(poolFromAPI);
    }
    if (window.__updateCardBookmarks) {
      window.__updateCardBookmarks();
    }

  } catch (err) {
    console.error('Error Airtable:', err);
    const old = document.getElementById('tabs-loading');
    if (old) old.textContent = 'No se pudieron cargar noticias desde Airtable.';
  } finally {
    const old = document.getElementById('tabs-loading');
    if (old) old?.remove();
  }
})();

/* ====== Modal: cuerpo largo traído por Slug desde Airtable ====== */

// Detecta si es un enlace de YouTube
function isYouTube(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url);
}
function youTubeId(url) {
  const m1 = url.match(/v=([^&]+)/);
  const m2 = url.match(/youtu\.be\/([^?]+)/);
  return (m1 && m1[1]) || (m2 && m2[1]) || null;
}

// Muestra "cargando..." en el modal mientras se obtiene el contenido
function setModalBodyLoading() {
  const el = document.getElementById('article-body');
  if (el) el.innerHTML = '<p class="muted">Cargando artículo…</p>';
}

// Muestra el contenido HTML final dentro del modal
function setModalBodyHTML(html) {
  const el = document.getElementById('article-body');
  if (el) el.innerHTML = html || '<p class="muted">Sin contenido.</p>';
}

// Construye el cuerpo: hasta 3 párrafos y una media (URL única) entre P1 y P2
function buildArticleBody({ p1, p2, p3, mediaUrl, mediaAlt }) {
  const parts = [];

  const addP = (txt) => {
    const clean = (txt || '').trim();
    if (!clean) return;
    parts.push(`<p>${esc(clean)}</p>`);
  };

  const addMedia = (url, alt) => {
    const u = (url || '').trim();
    if (!u) return;
    const a = esc(alt || '');

    // YouTube
    if (isYouTube(u)) {
      const id = youTubeId(u);
      if (id) {
        parts.push(`
          <div class="article-embed">
            <iframe
              src="https://www.youtube.com/embed/${id}"
              title="${a || 'Video'}"
              loading="lazy"
              allowfullscreen
            ></iframe>
          </div>
        `);
        return;
      }
    }

    // Video por extensión
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) {
      parts.push(`
        <div class="article-embed">
          <video src="${esc(u)}" controls playsinline></video>
        </div>
      `);
      return;
    }

    // Imagen por defecto
    parts.push(`
      <figure class="article-media">
        <img src="${esc(u)}" alt="${a}">
      </figure>
    `);
  };

  // Orden: P1 → Media → P2 → P3 
  addP(p1);
  addMedia(mediaUrl, mediaAlt);
  addP(p2);
  addP(p3);

  return parts.join('\n');
}

// Obtiene UNA noticia desde Airtable usando el Slug :contentReference[oaicite:1]{index=1}
async function fetchOneBySlug(slug) {
  const baseURL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const params = new URLSearchParams({
    pageSize: '1',
    filterByFormula: `{Slug}="${slug}"`
  });
  const url = `${baseURL}?${params.toString()}`;
  const headers = {
    'Authorization': `Bearer ${airtabletoken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rec = (data.records && data.records[0]) ? data.records[0] : null;
  if (!rec) return null;

  const f = rec.fields || {};

  return {
    title: (f.Titulo || '').trim(),
    category: (f.Categoria || 'NOTICIAS').toString(),
    excerpt: (f.Parrafo || '').trim(),
    hero: (f.Img || '').toString(),
    publishedAt: (f.Fecha_publicada || '').toString(),
    slug: (f.Slug || '').toString(),
    p1: (f.P1 || '').toString(),
    p2: (f.P2 || '').toString(),
    p3: (f.P3 || '').toString(),
    mediaUrl: (f.Media || '').toString(),        //UNA sola columna Media
    mediaAlt: (f.Titulo || '').toString()
  };
}

// Handler final del modal (usa fetchOneBySlug + buildArticleBody)
window.__handleReadMoreFromArticle = async function (articleEl) {
  const img = articleEl.querySelector('img.cover');
  const kicker = articleEl.querySelector('.kicker');
  const title = articleEl.querySelector('h3');
  const desc = articleEl.querySelector('p');
  const time = articleEl.querySelector('.card-meta')?.textContent?.trim();

  const initialData = {
    category: kicker?.textContent?.trim() || 'NOTICIAS',
    title: title?.textContent?.trim() || '',
    desc: desc?.textContent?.trim() || '',
    imgSrc: img?.getAttribute('src') || '',
    imgAlt: img?.getAttribute('alt') || '',
    time: time || '',
    author: 'Redacción',
    views: null,
  };

  // Cabecera inicial
  if (typeof window.__fillModal === 'function') window.__fillModal(initialData);
  setModalBodyLoading();

  const backdrop = document.getElementById('article-modal');
  if (backdrop) {
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  const slug = articleEl.getAttribute('data-slug') || '';
  if (!slug) {
    setModalBodyHTML(`<p>${esc(initialData.desc)}</p>`);
    return;
  }

  try {
    const rec = await fetchOneBySlug(slug);
    if (!rec) {
      setModalBodyHTML(`<p>${esc(initialData.desc)}</p>`);
      return;
    }

    const enriched = {
      category: rec.category || initialData.category,
      title: rec.title || initialData.title,
      desc: rec.excerpt || initialData.desc,
      imgSrc: rec.hero || initialData.imgSrc,
      imgAlt: rec.title || initialData.imgAlt,
      time: rec.publishedAt || initialData.time,
      author: initialData.author,
      views: initialData.views,
    };
    if (typeof window.__fillModal === 'function') window.__fillModal(enriched);

    const bodyHtml = buildArticleBody({
      p1: rec.p1,
      p2: rec.p2,
      p3: rec.p3,
      mediaUrl: rec.mediaUrl,
      mediaAlt: rec.mediaAlt
    });

    setModalBodyHTML(bodyHtml);

  } catch (e) {
    console.warn('No se pudo cargar el cuerpo completo:', e);
    setModalBodyHTML(`<p>${esc(initialData.desc)}</p>`);
  }
};



/* ===========================
   Auth + Menú de usuario
   =========================== */

(function () {
  const btnLogin = document.querySelector('.btn-login');
  const authBackdrop = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const authTabs = authBackdrop ? authBackdrop.querySelectorAll('.auth-tab') : [];
  const inputName = document.getElementById('auth-name');
  const inputUser = document.getElementById('auth-email');
  const inputPass = document.getElementById('auth-password');
  const authCloseBtn = authBackdrop ? authBackdrop.querySelector('.auth-close') : null;
  const authMsg = document.getElementById('auth-message');

  const userMenu = document.getElementById('user-menu');
  const userMenuName = document.getElementById('user-menu-name');
  const userMenuEmail = document.getElementById('user-menu-email');
  const btnSaved = document.getElementById('user-menu-saved');
  const btnLogout = document.getElementById('user-menu-logout');

  if (!btnLogin || !authBackdrop || !authForm || !userMenu) return;

  const AUTH_STORAGE_KEY = 'noticias_auth_user';
  let mode = 'login'; // 'login' | 'register'

  // -------- storage simple (localStorage) --------
  function getStoredUser() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('No se pudo leer usuario almacenado', e);
      return null;
    }
  }

  function storeUser(user) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('No se pudo guardar usuario', e);
    }
  }

  function clearStoredUser() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) { }
  }

  // -------- UI: logueado / deslogueado --------
  function applyLoggedOutUI() {
    btnLogin.classList.remove('is-avatar');
    btnLogin.innerHTML = '<i class="fa-regular fa-user"></i> Ingresar';
    btnLogin.dataset.logged = '0';
    userMenu.classList.remove('open');
  }

  function applyLoggedInUI(user) {
    const name = (user && user.name) || '';
    const email = (user && user.email) || '';
    const initial = (name || email || '?').trim().charAt(0).toUpperCase();

    btnLogin.classList.add('is-avatar');
    btnLogin.textContent = initial;
    btnLogin.dataset.logged = '1';

    if (userMenuName) userMenuName.textContent = name || email;
    if (userMenuEmail) userMenuEmail.textContent = email;
  }

  // -------- Modal auth --------
  function openAuth() {
    authBackdrop.classList.add('open');
    document.body.classList.add('no-scroll');
    authMsg.textContent = '';
    authMsg.className = 'auth-message';
  }

  function closeAuth() {
    authBackdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
    authForm.reset();
    authMsg.textContent = '';
    authMsg.className = 'auth-message';

    const nameField = inputName && inputName.closest('.auth-field');
    if (nameField) {
      nameField.style.display = mode === 'register' ? '' : 'none';
    }
  }

  // Botón del header: si no está logueado abre modal, si sí, abre menú
  btnLogin.addEventListener('click', (e) => {
    e.preventDefault();
    const logged = btnLogin.dataset.logged === '1';
    if (logged) {
      userMenu.classList.toggle('open');
    } else {
      openAuth();
    }
  });

  // Tabs login / registro
  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      authTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.mode || 'login';

      const nameField = inputName && inputName.closest('.auth-field');
      if (nameField) {
        nameField.style.display = mode === 'register' ? '' : 'none';
      }

      authMsg.textContent = '';
      authMsg.className = 'auth-message';
    });
  });

  // Cerrar modal
  if (authCloseBtn) {
    authCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAuth();
    });
  }

  authBackdrop.addEventListener('click', (e) => {
    if (e.target === authBackdrop) {
      closeAuth();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authBackdrop.classList.contains('open')) {
      closeAuth();
    }
  });

  // -------- Airtable: registrar usuarios --------
  const airtableUsersTable = 'Usuarios';
  const airtableUsersURL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(airtableUsersTable)}`;
  const usersHeaders = {
    'Authorization': `Bearer ${airtabletoken}`,
    'Content-Type': 'application/json',
  };

  async function registerUser({ name, email, password }) {
    const body = {
      records: [
        {
          fields: {
            Nombre: name || '',
            Email: email,
            Password: password,
            Rol: 'usuario',
          },
        },
      ],
    };

    const res = await fetch(airtableUsersURL, {
      method: 'POST',
      headers: usersHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Airtable ${res.status}`);
    }
    return res.json();
  }

  // -------- Submit del formulario --------
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMsg.textContent = '';
    authMsg.className = 'auth-message';

    const name = (inputName.value || '').trim();
    const userOrEmail = (inputUser.value || '').trim();
    const password = (inputPass.value || '').trim();

    if (!userOrEmail || !password) {
      authMsg.textContent = 'Completá usuario/email y contraseña.';
      authMsg.classList.add('error');
      return;
    }

    // ADMIN 
    if (userOrEmail === 'Admin' && password === 'admin') {
      window.open('admin.html', '_blank');
      closeAuth();
      return;
    }

    try {
      if (mode === 'register') {
        await registerUser({ name, email: userOrEmail, password });
      }

      // En ambos casos (login o registro) dejamos al usuario logueado
      const user = { name, email: userOrEmail, role: 'usuario' };
      storeUser(user);
      applyLoggedInUI(user);
      closeAuth();

      if (window.__updateCardBookmarks) {
        window.__updateCardBookmarks();
      }
      if (window.__updateSavedCounter) {
        window.__updateSavedCounter();
      }
    } catch (err) {
      console.error(err);
      authMsg.textContent = 'No se pudo registrar el usuario en Airtable.';
      authMsg.classList.add('error');
    }
  });

  // -------- Menú: Cerrar sesión --------
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      clearStoredUser();
      applyLoggedOutUI();

      if (window.__updateCardBookmarks) {
        window.__updateCardBookmarks();
      }
      if (window.__updateSavedCounter) {
        window.__updateSavedCounter();
      }
    });
  }


  // Cerrar el menú al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!userMenu.classList.contains('open')) return;

    const clickEnMenu = userMenu.contains(e.target);
    const clickEnBoton = !!e.target.closest('.btn-login');

    if (!clickEnMenu && !clickEnBoton) {
      userMenu.classList.remove('open');
    }
  });

  // -------- Estado inicial --------
  const existingUser = getStoredUser();
  if (existingUser) {
    applyLoggedInUI(existingUser);
  } else {
    applyLoggedOutUI();
  }

  // Campo Nombre oculto por defecto (modo login)
  const nameField = inputName && inputName.closest('.auth-field');
  if (nameField) {
    nameField.style.display = 'none';
  }
})();

/* ===========================
   Guardados (bookmarks por usuario)
   =========================== */

(function () {
  const AUTH_KEY = 'noticias_auth_user';       // donde se guarda el usuario logueado
  const SAVED_KEY = 'noticias_saved_by_user';  // mapa email -> array de noticias

  const btnSaved = document.getElementById('user-menu-saved');
  const savedBackdrop = document.getElementById('saved-panel');
  const savedListEl = document.getElementById('saved-list');
  const savedCloseBtn = savedBackdrop ? savedBackdrop.querySelector('.saved-close') : null;
  const loginToastEl = document.getElementById('login-toast');
  const savedCountEl = document.getElementById('saved-count');

  if (!savedBackdrop || !savedListEl) return;

  let toastTimeoutId = null;

  // -------- utils de storage --------
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getUserKey() {
    const u = getCurrentUser();
    const email = (u && u.email) || '';
    return email.trim().toLowerCase() || null;
  }

  function loadSavedMap() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveSavedMap(map) {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(map));
    } catch { }
  }

  function getSavedForCurrentUser() {
    const key = getUserKey();
    if (!key) return [];
    const map = loadSavedMap();
    return Array.isArray(map[key]) ? map[key] : [];
  }
  function updateSavedCountBadge() {
    if (!savedCountEl) return;

    const saved = getSavedForCurrentUser();
    const n = saved.length;

    if (n > 0) {
      savedCountEl.textContent = n;
      savedCountEl.classList.add('visible');
    } else {
      savedCountEl.textContent = '0';
      savedCountEl.classList.remove('visible');
    }
  }

  // -------- UI helpers --------
  function showLoginToast() {
    if (!loginToastEl) {
      alert('Tenés que iniciar sesión para poder guardar noticias.');
      return;
    }
    loginToastEl.textContent = 'Iniciá sesión para poder guardar noticias.';
    loginToastEl.classList.add('show');
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      loginToastEl.classList.remove('show');
    }, 2600);
  }

  function setBookmarkButtonState(btn, isSaved) {
    if (!btn) return;
    btn.classList.toggle('is-saved', isSaved);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-regular', !isSaved);
      icon.classList.toggle('fa-solid', isSaved);
    }
  }

  function updateCardBookmarksUI() {
    const saved = getSavedForCurrentUser();
    const savedSet = new Set(saved.map(x => x.slug));

    document.querySelectorAll('.card-bookmark').forEach((btn) => {
      const card = btn.closest('article.card');
      if (!card) return;
      const slug = card.getAttribute('data-slug') || '';
      if (!slug) return;
      const isSaved = savedSet.has(slug);
      setBookmarkButtonState(btn, isSaved);
    });
  }

  // -------- lógica de toggle desde la card --------
  function toggleSaveFromCard(cardEl) {
    const userKey = getUserKey();
    if (!userKey) {
      showLoginToast();
      return;
    }

    const slug = cardEl.getAttribute('data-slug') || '';
    if (!slug) return;

    const title = cardEl.getAttribute('data-title') || (cardEl.querySelector('h3')?.textContent || '').trim();
    const category = cardEl.getAttribute('data-category') || (cardEl.querySelector('.kicker')?.textContent || '').trim();
    const meta = cardEl.getAttribute('data-meta') || (cardEl.querySelector('.card-meta')?.textContent || '').trim();
    const img = cardEl.getAttribute('data-img') || (cardEl.querySelector('img.cover')?.src || '');

    const map = loadSavedMap();
    const list = Array.isArray(map[userKey]) ? map[userKey] : [];

    const idx = list.findIndex(x => x.slug === slug);
    let savedNow = false;

    if (idx === -1) {
      list.push({
        slug,
        title,
        category,
        meta,
        img,
        savedAt: Date.now()
      });
      savedNow = true;
    } else {
      list.splice(idx, 1);
      savedNow = false;
    }

    map[userKey] = list;
    saveSavedMap(map);
    updateCardBookmarksUI();
    updateSavedCountBadge();

    if (loginToastEl) {
      loginToastEl.textContent = savedNow ? 'Noticia guardada.' : 'Noticia eliminada de guardados.';
      loginToastEl.classList.add('show');
      clearTimeout(toastTimeoutId);
      toastTimeoutId = setTimeout(() => {
        loginToastEl.classList.remove('show');
      }, 2000);
    }
  }

  // -------- render del panel de guardados --------
  function renderSavedList() {
    const saved = getSavedForCurrentUser();
    if (!saved.length) {
      savedListEl.innerHTML = '<p class="saved-empty">Todavía no guardaste noticias.</p>';
      return;
    }

    savedListEl.innerHTML = saved.map(item => `
      <div class="saved-item" data-slug="${item.slug}">
        <div class="saved-item-main">
          <button class="saved-item-title-btn" type="button">
            <span class="saved-item-title">${esc(item.title || '')}</span>
          </button>
          <span class="saved-item-meta">${esc(item.category || '')}${item.meta ? ' · ' + esc(item.meta) : ''}</span>
        </div>
        <button class="saved-item-remove" type="button" aria-label="Eliminar noticia guardada">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }

  function openSavedPanel() {
    if (!getUserKey()) {
      showLoginToast();
      return;
    }
    renderSavedList();
    savedBackdrop.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function closeSavedPanel() {
    savedBackdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  // -------- eventos --------

  // Click en bookmark de una card
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-bookmark');
    if (!btn) return;
    const card = btn.closest('article.card');
    if (!card) return;
    e.preventDefault();
    toggleSaveFromCard(card);
  });

  // Botón "Guardados" del menú de usuario
  if (btnSaved) {
    btnSaved.addEventListener('click', (e) => {
      e.preventDefault();
      openSavedPanel();
    });
  }

  // Cerrar panel
  if (savedCloseBtn) {
    savedCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSavedPanel();
    });
  }

  savedBackdrop.addEventListener('click', (e) => {
    if (e.target === savedBackdrop) {
      closeSavedPanel();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && savedBackdrop.classList.contains('open')) {
      closeSavedPanel();
    }
  });

  // Clic en tacho dentro del panel
  savedListEl.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.saved-item-remove');
    if (removeBtn) {
      const itemEl = removeBtn.closest('.saved-item');
      if (!itemEl) return;

      const slug = itemEl.getAttribute('data-slug') || '';
      const key = getUserKey();
      if (!key || !slug) return;

      const map = loadSavedMap();
      const list = Array.isArray(map[key]) ? map[key] : [];
      const idx = list.findIndex(x => x.slug === slug);
      if (idx !== -1) {
        list.splice(idx, 1);
        map[key] = list;
        saveSavedMap(map);
      }

      renderSavedList();
      updateCardBookmarksUI();
      updateSavedCountBadge();
      return;
    }

    const titleBtn = e.target.closest('.saved-item-title-btn');
    if (titleBtn) {
      const itemEl = titleBtn.closest('.saved-item');
      if (!itemEl) return;

      const slug = itemEl.getAttribute('data-slug');
      if (!slug) return;

      // cerramos el panel de guardados
      closeSavedPanel();

      // busca la card correspondiente en el DOM
      let selectorSlug = slug;
      if (window.CSS && CSS.escape) {
        selectorSlug = CSS.escape(slug);
      }
      const card = document.querySelector(`article.card[data-slug="${selectorSlug}"]`);
      if (!card) {
        console.warn('No se encontró la card para el slug:', slug);
        return;
      }

      // usa la misma lógica que “Leer más”
      if (window.__handleReadMoreFromArticle) {
        window.__handleReadMoreFromArticle(card);
      }

      return;
    }
  });
  // Exponer función para actualizar bookmarks desde fuera
  window.__updateCardBookmarks = updateCardBookmarksUI;
  window.__updateSavedCounter = updateSavedCountBadge;

  updateCardBookmarksUI();
  updateSavedCountBadge();
})();


/* ===========================
   Modal de Contacto (abrir/cerrar)
   =========================== */
(function () {
  const footerBtn = document.getElementById('footer-contact');
  const backdrop = document.getElementById('contact-modal');
  const closeBtn = backdrop ? backdrop.querySelector('.contact-close') : null;

  if (!footerBtn || !backdrop) return;

  function openContact() {
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function closeContact() {
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
    const form = document.getElementById('contact-form');
    const status = document.getElementById('contact-status');
    if (form) form.reset();
    if (status) {
      status.textContent = '';
      status.className = 'contact-status';
    }
  }

  footerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openContact();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeContact();
    });
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeContact();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) {
      closeContact();
    }
  });
})();


/* ===========================
   Envío de Contacto → Airtable
   =========================== */
(function () {
  const form   = document.getElementById('contact-form');
  const status = document.getElementById('contact-status');

  if (!form || !status) return;

  const table = "Contactos";
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  
  const headers = {
    "Authorization": `Bearer ${airtabletoken}`,
    "Content-Type": "application/json",
  };

  async function sendMessage(data) {
    const body = {
      records: [
        {
          fields: {
            Nombre:  data.name,
            Email:   data.email,
            Asunto:  data.subject,
            Mensaje: data.message,
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Airtable ${res.status}: ${txt}`);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    status.textContent = "";
    status.className = "contact-status";

    const fd = new FormData(form);
    const data = {
      name: fd.get("name").trim(),
      email: fd.get("email").trim(),
      subject: fd.get("subject").trim(),
      message: fd.get("message").trim(),
    };

    const btn = form.querySelector(".contact-submit");
    btn.disabled = true;

    try {
      await sendMessage(data);
      status.textContent = "¡Mensaje enviado correctamente!";
      status.classList.add("ok");
      form.reset();
    } catch (err) {
      status.textContent = "No se pudo enviar. Intentá nuevamente.";
      status.classList.add("error");
    } finally {
      btn.disabled = false;
    }
  });
})();

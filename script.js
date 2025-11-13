import { AIRTABLE_TOKEN, BASE_ID, TABLE_NAME } from './env.js';
/* ===========================
   CONFIG AIRTABLE (Front)
   =========================== */
// ⚠️ Estás usando PAT en el front por decisión propia.
const airtabletoken = AIRTABLE_TOKEN;   // TU PAT (ideal: solo lectura)
const baseId        = BASE_ID;              // ID de tu base
const tableName     = TABLE_NAME;                       // Nombre exacto de la tabla
const viewName      = "Grid view";                      // O dejalo "" si no querés filtrar por vista

/* ===========================
   UTILIDADES
   =========================== */
function timeAgo(dateStr){
  if(!dateStr) return '';
  const n=new Date(), d=new Date(dateStr);
  const diff=Math.max(0,n-d);
  const mins=Math.floor(diff/60000);
  if(mins<60) return `hace ${mins} min`;
  const hrs=Math.floor(mins/60);
  if(hrs<24) return `hace ${hrs} h`;
  const days=Math.floor(hrs/24);
  return `hace ${days} d`;
}
function esc(s){
  return (s||'').toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
const norm = s => (s||'').toString().trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/* ===========================
   RENDER DE UNA CARD (markup igual al tuyo)
   =========================== */
function renderCardHTML(rec){
  const title=esc(rec.title), cat=esc(rec.category), excerpt=esc(rec.excerpt);
  const img=esc(rec.hero), meta=timeAgo(rec.publishedAt);
  return `
<article class="card" data-slug="${esc(rec.slug)}">
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

  // Handler “simple” por si se usa antes de que cargue Airtable (luego será sobreescrito)
  window.__handleReadMoreFromArticle = function(articleEl) {
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
(function showLoading(){
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

// Descarga todas las páginas (100 en 100)
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
(async function loadFromAirtableREST(){
  try{
    const records = await fetchAirtableAll();

    // Mapeo de campos según tu tabla: Titulo, Categoria, Parrafo, Img (URL), Fecha_publicada, Slug :contentReference[oaicite:0]{index=0}
    const mapped = records.map(rec => {
      const f = rec.fields || {};
      return {
        title: (f.Titulo || '').trim(),
        category: (f.Categoria || 'NOTICIAS').toString(),
        excerpt: (f.Parrafo || '').trim(),
        body: (f.Parrafo || '').trim(),
        hero: (f.Img || '').toString(), // <- ahora Img es URL de texto
        publishedAt: (f.Fecha_publicada || '').toString(),
        slug: (f.Slug || '').toString(),
      };
    }).filter(x => x.title && x.slug);

    // 1) Ordenar por fecha DESC (más nuevas primero)
    const ts = (r) => Date.parse(r.publishedAt) || 0;
    mapped.sort((a, b) => ts(b) - ts(a));

    // 2) Separar últimas 3 y resto
    const latest3 = mapped.slice(0, 3);
    const rest    = mapped.slice(3);

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

  // Orden: P1 → Media → P2 → P3 (sin huecos)
  addP(p1);
  addMedia(mediaUrl, mediaAlt);
  addP(p2);
  addP(p3);

  return parts.join('\n');
}

// Obtiene UNA noticia desde Airtable usando el Slug (según tu tabla actual) :contentReference[oaicite:1]{index=1}
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
    mediaUrl: (f.Media || '').toString(),        // 👈 UNA sola columna Media (URL)
    mediaAlt: (f.Titulo || '').toString()
  };
}

// Handler final del modal (usa fetchOneBySlug + buildArticleBody)
window.__handleReadMoreFromArticle = async function(articleEl) {
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


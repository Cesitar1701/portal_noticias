import { AIRTABLE_TOKEN, BASE_ID, TABLE_NAME } from './env.js';
/* ======= CONFIG ======= */
const airtabletoken = AIRTABLE_TOKEN;
const baseId        = BASE_ID;
const tableName     = TABLE_NAME;
const viewName      = "Grid view"; 

/* ======= Helpers ======= */
const esc = s => (s||'').toString().replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function toSlug(s){
  return (s||'')
   .toString().trim().toLowerCase()
   .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^a-z0-9\s-]/g,'')
   .replace(/\s+/g,'-')
   .replace(/-+/g,'-')
   .slice(0,120);
}
function setStatus(t){ document.getElementById('status').textContent=t||''; }
function headers(){ return { "Authorization":"Bearer "+airtabletoken, "Content-Type":"application/json" }; }

/* ======= DOM refs ======= */
const f = {
  id:null, // recordId seleccionado
  Titulo: document.getElementById('fTitulo'),
  Slug: document.getElementById('fSlug'),
  Categoria: document.getElementById('fCategoria'),
  Fecha_publicada: document.getElementById('fFecha'),
  Parrafo: document.getElementById('fParrafo'),
  Img: document.getElementById('fImg'),
  P1: document.getElementById('fP1'),
  P2: document.getElementById('fP2'),
  P3: document.getElementById('fP3'),
  Media: document.getElementById('fMediaUrl'), // ← input de Media URL
  ImgPrev: document.getElementById('imgPrev'),
};

// Slug automático solo para mostrar (en Airtable es fórmula)
f.Titulo.addEventListener('input', ()=>{ 
  if(!f.id){ 
    f.Slug.value = toSlug(f.Titulo.value); 
  } 
});

// Preview de la imagen principal
f.Img.addEventListener('input', ()=>{ 
  f.ImgPrev.src = f.Img.value; 
});

/* ======= API base ======= */
const baseURL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
let lastOffset = null, currentOffset = null;

async function listRecords({query} = {}){
  const params = new URLSearchParams({ pageSize:'20' });
  if(viewName) params.set('view', viewName);
  if(currentOffset) params.set('offset', currentOffset);
  if(query){
    params.set('filterByFormula', `OR(FIND(LOWER("${query}"), LOWER({Titulo}))>0, FIND(LOWER("${query}"), LOWER({Slug}))>0)`);
  }
  const r = await fetch(`${baseURL}?${params}`, { headers: headers() });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function createRecord(fields){
  const r = await fetch(baseURL, {
    method:'POST', headers:headers(),
    body: JSON.stringify({ records:[{ fields }] })
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function updateRecord(id, fields){
  const r = await fetch(baseURL, {
    method:'PATCH', headers:headers(),
    body: JSON.stringify({ records:[{ id, fields }] })
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function deleteRecord(id){
  const r = await fetch(`${baseURL}?records[]=${encodeURIComponent(id)}`, {
    method:'DELETE', headers:headers()
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ======= Tabla ======= */
const tbody = document.querySelector('#tbl tbody');
function renderRows(records){
  tbody.innerHTML = records.map(rec=>{
    const flds = rec.fields||{};
    const est = flds.Estado || '—';
    return `<tr>
      <td>${esc(flds.Titulo||'')}</td>
      <td><span class="pill">${esc(flds.Categoria||'')}</span></td>
      <td class="muted">${esc(flds.Fecha_publicada||'')}</td>
      <td class="muted">${esc(flds.Slug||'')}</td>
      <td>${esc(est)}</td>
      <td><button class="btn" data-id="${rec.id}">Editar</button></td>
    </tr>`;
  }).join('');
}

tbody.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-id]');
  if(!btn) return;
  const row = btn.closest('tr');
  const slug = row.children[3].textContent.trim();
  loadBySlug(slug);
});

/* ======= Cargar por Slug (para editar) ======= */
async function loadBySlug(slug){
  try{
    setStatus('Cargando registro…');
    const params = new URLSearchParams({ pageSize:'1', filterByFormula:`{Slug}="${slug}"` });
    const r = await fetch(`${baseURL}?${params}`, { headers:headers() });
    if(!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const rec = (data.records && data.records[0]) ? data.records[0] : null;
    if(!rec){ setStatus('No encontrado'); return; }
    fillFormFromRecord(rec);
    setStatus('Listo para editar');
  }catch(err){
    console.error(err); setStatus('Error al cargar');
  }
}

/* ======= Form helpers ======= */
function formToFields(){
  if(!f.Titulo.value.trim()) throw new Error('Falta Título');

  // Fecha: si el campo está vacío, usamos la fecha/hora actual en ISO
  let fecha = f.Fecha_publicada.value.trim();
  if (!fecha) {
    fecha = new Date().toISOString(); // ejemplo: 2025-11-13T01:23:45.678Z
  }

  const fields = {
    Titulo: f.Titulo.value.trim(),
    // Slug NO se envía: en Airtable es fórmula
    Categoria: f.Categoria.value.trim(),
    Fecha_publicada: fecha,
    Parrafo: f.Parrafo.value.trim(),
    Img: f.Img.value.trim(),
    P1: f.P1.value.trim(),
    P2: f.P2.value.trim(),
    P3: f.P3.value.trim(),
    Media: f.Media.value.trim(),
  };
  return fields;
}

function fillFormFromRecord(rec){
  f.id = rec.id;
  const x = rec.fields||{};
  f.Titulo.value = x.Titulo||'';
  f.Slug.value = x.Slug||''; // solo mostrar
  f.Categoria.value = x.Categoria||'Política';
  f.Fecha_publicada.value = x.Fecha_publicada||'';
  f.Parrafo.value = x.Parrafo||'';
  f.Img.value = x.Img||'';
  f.P1.value = x.P1||'';
  f.P2.value = x.P2||'';
  f.P3.value = x.P3||'';
  f.Media.value = x.Media||'';
  f.ImgPrev.src = f.Img.value||'';

  document.getElementById('btnUpdate').disabled = false;
  document.getElementById('btnDelete').disabled = false;
  document.getElementById('btnCreate').disabled = true;
}

function resetForm(){
  f.id = null;
  const keys = ['Titulo','Slug','Categoria','Fecha_publicada','Parrafo','Img','P1','P2','P3','Media'];
  for(const k of keys){
    f[k].value = '';
  }
  f.Categoria.value = 'Política';
  f.ImgPrev.src = '';
  document.getElementById('btnUpdate').disabled = true;
  document.getElementById('btnDelete').disabled = true;
  document.getElementById('btnCreate').disabled = false;
  setStatus('');
}

/* ======= Eventos ======= */
document.getElementById('btnReload').onclick = async ()=>{ currentOffset = null; await refresh(); };
document.getElementById('btnSearch').onclick = async ()=>{ currentOffset = null; await refresh(); };
document.getElementById('prev').onclick = async ()=>{ currentOffset = null; await refresh(); };
document.getElementById('next').onclick = async ()=>{ 
  if(!lastOffset){ setStatus(''); return; }
  currentOffset = lastOffset; await refresh(); 
};

document.getElementById('btnNew').onclick = ()=> resetForm();

document.getElementById('btnCreate').onclick = async ()=>{
  try{
    setStatus('Creando…');
    const fields = formToFields();
    await createRecord(fields);
    setStatus('Creado ✔');
    resetForm();
    await refresh();
  }catch(err){ 
    console.error(err); 
    setStatus('Error al crear (revisá la consola)'); 
  }
};

document.getElementById('btnUpdate').onclick = async ()=>{
  try{
    if(!f.id) throw new Error('Nada seleccionado');
    setStatus('Actualizando…');
    const fields = formToFields();
    await updateRecord(f.id, fields);
    setStatus('Actualizado ✔');
    await refresh();
  }catch(err){ 
    console.error(err); 
    setStatus('Error al actualizar'); 
  }
};

document.getElementById('btnDelete').onclick = async ()=>{
  try{
    if(!f.id) throw new Error('Nada seleccionado');
    if(!confirm('¿Eliminar definitivamente?')) return;
    setStatus('Eliminando…');
    await deleteRecord(f.id);
    setStatus('Eliminado ✔');
    resetForm();
    await refresh();
  }catch(err){ 
    console.error(err); 
    setStatus('Error al eliminar'); 
  }
};

/* ======= Carga inicial ======= */
async function refresh(){
  try{
    setStatus('Cargando…');
    const q = document.getElementById('q').value.trim();
    const data = await listRecords({query:q});
    renderRows(data.records||[]);
    lastOffset = data.offset || null;
    document.getElementById('pageinfo').textContent = lastOffset ? 'Hay más resultados' : 'Fin';
    setStatus('');
  }catch(err){ 
    console.error(err); 
    setStatus('Error al cargar'); 
  }
}
refresh();
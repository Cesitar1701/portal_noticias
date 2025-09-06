// Inicio JS Barra de busqueda
const searchContainer = document.querySelector('.search-container');
const searchBtn = document.querySelector('.btn');
const searchInput = document.querySelector('.search-container input');
const menuContainer = document.querySelector('.menu-container');
const menuBtn = document.querySelector('.menu-btn');
const climaToggle = document.getElementById("climaToggle");
const climaPanel = document.getElementById("climaPanel");
const dolarToggle = document.getElementById("dolarToggle");
const dolarPanel = document.getElementById("dolarPanel");

// Toggle al hacer click en el botón
searchBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // evita que el click se propague al body
  searchContainer.classList.toggle('active');
  if (searchContainer.classList.contains('active')) {
    searchInput.focus(); // enfoca el input al abrir
  }
});

// Cierra si se hace click fuera
document.addEventListener('click', (e) => {
  if (!searchContainer.contains(e.target)) {
    searchContainer.classList.remove('active');
  }
});;

// Toggle al hacer click en el ícono
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuContainer.classList.toggle('active');
});

// Cierra el menú si hacés click fuera
document.addEventListener('click', (e) => {
  if (!menuContainer.contains(e.target)) {
    menuContainer.classList.remove('active');
  }
});
// Fin JS Barra de busqueda

// -------------------------------------------------------------------------

// Inicio JS Dolar Cotizaciones
async function loadDolaresInline() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares");
    const data = await res.json();

    // Mapear nombres de la API a nombres amigables
    const nombres = {
      oficial: "Oficial",
      blue: "Blue",
      tarjeta: "Tarjeta",
      bolsa: "MEP" 
    };

    // Solo mostrar estos tipos
    const tipos = ["oficial", "blue", "tarjeta", "bolsa"];

    const container = document.getElementById("dolarInline");
    container.innerHTML = "";

    const textos = data
      .filter(d => tipos.includes(d.casa.toLowerCase()))
      .map(d => `Dólar ${nombres[d.casa.toLowerCase()]} <b>$${d.venta.toFixed(2)}</b>`);

    container.innerHTML = textos.join(" - ");
  } catch (err) {
    console.error("Error al obtener cotizaciones:", err);
  }
}

// Ejecutar al cargar
loadDolaresInline();

// Actualizar cada 5 minutos
setInterval(loadDolaresInline, 300000);

// Fin JS Dolar Cotizaciones


// BOTONES
// Clima toggle
climaToggle.addEventListener("click", () => {
  const widget = document.getElementById("weatherWidget");
  climaPanel.appendChild(widget); // mueve el widget, no lo clona
  climaPanel.style.display = climaPanel.style.display === "block" ? "none" : "block";
});
// Dólar toggle
dolarToggle.addEventListener("click", () => {
  dolarPanel.innerHTML = document.getElementById("dolarInline").outerHTML;
  dolarPanel.style.display = dolarPanel.style.display === "block" ? "none" : "block";
});

// Cerrar al hacer click fuera
document.addEventListener("click", (e) => {
  if (!climaPanel.contains(e.target) && e.target !== climaToggle) {
    climaPanel.style.display = "none";
  }
  if (!dolarPanel.contains(e.target) && e.target !== dolarToggle) {
    dolarPanel.style.display = "none";
  }
});

const searchContainer = document.querySelector('.search-container');
const searchBtn = document.querySelector('.btn');
const searchInput = document.querySelector('.search-container input');
const menuContainer = document.querySelector('.menu-container');
const menuBtn = document.querySelector('.menu-btn');


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
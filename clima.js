const apiKey = "2289b162855d21505102540797f0222a"; // 🔑 poné tu API key de OpenWeather aquí
const widget = document.getElementById("weatherWidget");
const modal = document.getElementById("weatherModal");
const closeModal = document.getElementById("closeModal");
const citySelector = document.getElementById("citySelector");

// Abrir modal
widget.addEventListener("click", () => {
  modal.style.display = "flex";
});
closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Cambiar ciudad manualmente
citySelector.addEventListener("change", (e) => {
  const city = e.target.value;
  if (city) {
    loadWeatherByCity(city);
    document.getElementById("cityName").textContent = e.target.options[e.target.selectedIndex].text;
  }
});

// Geolocalización automática
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error);
  } else {
    alert("Tu navegador no soporta geolocalización.");
    loadWeatherByCity("Neuquen,AR");
  }
}

function error() {
  alert("No se pudo obtener tu ubicación. Se usará Neuquén por defecto.");
  loadWeatherByCity("Neuquen,AR");
}

function success(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  loadWeatherByCoords(lat, lon);
}

// Cargar datos con lat/lon
async function loadWeatherByCoords(lat, lon) {
  const urlCurrent = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
  const resCurrent = await fetch(urlCurrent);
  const dataCurrent = await resCurrent.json();
  updateCurrentWeather(dataCurrent);

  const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
  const resForecast = await fetch(urlForecast);
  const dataForecast = await resForecast.json();
  updateForecast(dataForecast);
}

// Cargar datos por ciudad
async function loadWeatherByCity(city) {
  const urlCurrent = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=es`;
  const resCurrent = await fetch(urlCurrent);
  const dataCurrent = await resCurrent.json();
  updateCurrentWeather(dataCurrent);

  const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric&lang=es`;
  const resForecast = await fetch(urlForecast);
  const dataForecast = await resForecast.json();
  updateForecast(dataForecast);
}

// Actualizar widget y modal
function updateCurrentWeather(data) {
  document.getElementById("cityName").textContent = data.name;
  document.getElementById("temperature").textContent = Math.round(data.main.temp);
  document.getElementById("humidity").textContent = data.main.humidity + "%";
  document.getElementById("weatherIcon").textContent = getIcon(data.weather[0].main);

  const dateStr = new Date().toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  document.getElementById("dateLocation").textContent = `${dateStr} - ${data.name}, ${data.sys.country}`;
  document.getElementById("modalTemp").textContent = Math.round(data.main.temp);
  document.getElementById("modalHumidity").textContent = data.main.humidity + "%";
  document.getElementById("modalPressure").textContent = data.main.pressure + " hPa";
  document.getElementById("modalWind").textContent = data.wind.speed + " km/h";
  document.getElementById("modalIcon").textContent = getIcon(data.weather[0].main);
}

function updateForecast(dataForecast) {
  const forecastEl = document.getElementById("forecast");
  forecastEl.innerHTML = "";

  for (let i = 8; i < dataForecast.list.length; i += 8) {
    const day = dataForecast.list[i];
    const date = new Date(day.dt_txt);
    const dayName = date.toLocaleDateString("es-AR", { weekday: "long" });

    const div = document.createElement("div");
    div.classList.add("forecast-day");
    div.innerHTML = `
      <p>${dayName}</p>
      <div class="icon">${getIcon(day.weather[0].main)}</div>
      <p>${Math.round(day.main.temp_max)}° <small>MÁX</small></p>
      <p>${Math.round(day.main.temp_min)}° <small>MÍN</small></p>
    `;
    forecastEl.appendChild(div);
  }
}

// Íconos simples
function getIcon(condition) {
  switch (condition.toLowerCase()) {
    case "clear": return "🌙";
    case "clouds": return "☁️";
    case "rain": return "🌧️";
    case "snow": return "❄️";
    case "thunderstorm": return "⛈️";
    default: return "🌡️";
  }
}

// Iniciar
getLocation();

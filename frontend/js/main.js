//const { log } = require("console");


// ==================ANTIGUO=========================
//const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;
const API_BASE = "http://localhost:5000/api";

const CHILD_ID = 1;
const DEFAULT_CENTER = { lat: -17.78305, lon: -63.18255 };
const VAPID_PUBLIC_KEY = "BJBWcyM9jEKZvKnIO3Nh3mUIQditqSCNiMSCVpfS-MJjL5Pm1Fk8dS1EzAXOU7fJMLV-jHKDStAArhDAWRkngmY"

let map;
let drawnItems;
let areaLayer = null;
let unidadLayer = null;
let marcador;
let unidadesCache = [];
let currentUser = null;
let childData = null;
let madreMonitorInterval = null;
let pendingAreaGeoJSON = null;
let drawPolygonTool = null;

const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-pass');
const estadoTexto = document.getElementById('estado-texto');
const unidadActivaEl = document.getElementById('unidad-activa');
const ninoActivoEl = document.getElementById('nino-activo');
const btnSimular = document.getElementById('btn-simular');
const btnDibujarArea = document.getElementById('btn-dibujar-area');
const btnGuardarArea = document.getElementById('btn-guardar-area');
const btnEliminarArea = document.getElementById('btn-eliminar-area');
btnSimular.disabled = true;

const panels = {
  login: document.getElementById('login-panel'),
  usuario: document.getElementById('usuario-panel'),
  madre: document.getElementById('madre-panel'),
  map: document.getElementById('map-panel')
};

document.addEventListener('DOMContentLoaded', () => {
  inicializarMapa();
  document.getElementById('btn-login').addEventListener('click', iniciarSesion);
  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
  btnSimular.addEventListener('click', actualizarPosicion);
  btnDibujarArea.addEventListener('click', iniciarDibujoMadre);
  btnGuardarArea.addEventListener('click', guardarAreaMadre);
  btnEliminarArea.addEventListener('click', eliminarAreaMadre);

  document.getElementById('btn-notificar').addEventListener('click', enviarNotificacionPrueba);

  cargarDatosNino();
  cargarUnidades();
});

function inicializarMapa() {
  map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lon], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  marcador = L.circleMarker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lon], {
    radius: 10,
    color: '#2ecc71',
    weight: 2,
    fillColor: '#2ecc71',
    fillOpacity: 0.8
  }).addTo(map);

  map.on(L.Draw.Event.CREATED, (event) => {
    if (!currentUser || currentUser.rol !== 'madre') return;
    if (areaLayer) {
      drawnItems.removeLayer(areaLayer);
    }
    areaLayer = event.layer;
    drawnItems.addLayer(areaLayer);
    pendingAreaGeoJSON = areaLayer.toGeoJSON();
    unidadActivaEl.textContent = 'Área segura (no guardada)';
  });
}

async function registrarPush(userId) {
  // Registrar service worker
  const registro = await navigator.serviceWorker.register("/service-worker.js");

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    console.log("Permiso de notificaciones denegado");
    return;
  }

  const subscription = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY // esta variable debe venir del backend
  });

  await fetch(`${API_BASE}/suscripcion-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, subscription })
  });

  console.log("Suscripción guardada correctamente");
}


async function cargarDatosNino() {
  try {
    const resp = await fetch(`${API_BASE}/ninos/${CHILD_ID}`);
    if (!resp.ok) throw new Error('No se pudo obtener datos del niño');
    childData = await resp.json();
    ninoActivoEl.textContent = childData.nombre;
    await cargarAreaSegura();
  } catch (error) {
    console.error(error.message);
  }
}


async function cargarUnidades() {
  try {
    const resp = await fetch(`${API_BASE}/unidades`);
    if (!resp.ok) throw new Error('No se pudo obtener unidades');
    unidadesCache = await resp.json();
    if (!areaLayer && unidadesCache.length) {
      await cargarUnidadEducativa(unidadesCache[0].id);
    }
  } catch (error) {
    console.error(error.message);
  }
}

async function cargarAreaSegura() {
  try {
    const resp = await fetch(`${API_BASE}/ninos/${CHILD_ID}/area`);
    if (!resp.ok) throw new Error('Sin área personalizada');
    const data = await resp.json();
    if (data.geom) {
      const geojson = JSON.parse(data.geom);
      pendingAreaGeoJSON = geojson;
      dibujarAreaSegura(geojson);
      unidadActivaEl.textContent = data.nombre || 'Área segura personalizada';
      return;
    }
  } catch (error) {
    console.log('Área personalizada no encontrada, usando unidad base.');
  }
  const fallbackId = childData?.unidadId || unidadesCache[0]?.id;
  if (fallbackId) {
    await cargarUnidadEducativa(fallbackId);
  } else {
    unidadActivaEl.textContent = 'Sin área segura';
  }
}

async function iniciarSesion() {
  try {
    const email = loginEmail.value.trim();
    const password = loginPass.value.trim();
    if (!email || !password) {
      return actualizarEstadoUI('Ingresa email y contraseña.', 'pendiente');
    }
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Credenciales inválidas.');
    }
    currentUser = data;

    registrarPush(currentUser.id);
    console.log("Push registrado para el usuario:", currentUser);

    loginEmail.value = '';
    loginPass.value = '';
    actualizarPaneles();
    if (currentUser.rol === 'madre') {
      iniciarMonitoreoMadre();
      actualizarEstadoUI('Dibuja el área segura y presiona guardar.', 'pendiente');
    } else {
      detenerMonitoreoMadre();
      actualizarEstadoUI('Conectado. Puedes reportar posiciones.', 'pendiente');
    }
  } catch (error) {
    actualizarEstadoUI(error.message, 'pendiente');
  }
}

function cerrarSesion() {
  currentUser = null;
  detenerMonitoreoMadre();
  actualizarPaneles();
  actualizarEstadoUI('Inicia sesión para comenzar.', 'pendiente');
}

function actualizarPaneles() {
  const isLogged = Boolean(currentUser);
  panels.login.classList.toggle('hidden', isLogged);
  panels.usuario.classList.toggle('hidden', !isLogged);
  panels.map.classList.toggle('hidden', !isLogged);
  panels.madre.classList.toggle('hidden', !isLogged || currentUser.rol !== 'madre');
  document.getElementById('usuario-rol').textContent = isLogged
    ? `${currentUser.rol === 'madre' ? 'Madre' : 'Niño'} conectado`
    : '';
  panels.usuario.querySelector('.usuario-detalle').textContent = isLogged ? currentUser.email : '';
  btnSimular.disabled = !isLogged || currentUser.rol !== 'nino';
  const soloMadre = !isLogged || currentUser.rol !== 'madre';
  [btnDibujarArea, btnGuardarArea, btnEliminarArea].forEach((btn) => {
    btn.disabled = soloMadre;
  });
}

function iniciarDibujoMadre() {
  if (!currentUser || currentUser.rol !== 'madre') {
    return actualizarEstadoUI('Solo la madre puede dibujar el área.', 'pendiente');
  }
  if (drawPolygonTool) {
    drawPolygonTool.disable();
  }
  drawPolygonTool = new L.Draw.Polygon(map, {
    showArea: true,
    allowIntersection: false,
    shapeOptions: {
      color: '#f39c12',
      weight: 2,
      fillColor: '#f39c12',
      fillOpacity: 0.2
    }
  });
  drawPolygonTool.enable();
  actualizarEstadoUI('Dibuja el polígono y luego presiona Guardar área.', 'pendiente');
}

async function guardarAreaMadre() {
  if (!currentUser || currentUser.rol !== 'madre') {
    return actualizarEstadoUI('Solo la madre puede guardar el área.', 'pendiente');
  }
  if (!pendingAreaGeoJSON && areaLayer) {
    pendingAreaGeoJSON = areaLayer.toGeoJSON();
  }
  if (!pendingAreaGeoJSON) {
    return actualizarEstadoUI('Dibuja un polígono antes de guardar.', 'pendiente');
  }
  try {
    const payload = {
      madre_id: currentUser.id,
      nombre: 'Área definida por la madre',
      geom: pendingAreaGeoJSON.geometry || pendingAreaGeoJSON
    };
    const resp = await fetch(`${API_BASE}/ninos/${CHILD_ID}/area`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(error.error || 'No se pudo guardar el área.');
    }
    const data = await resp.json();
    pendingAreaGeoJSON = JSON.parse(data.geom);
    dibujarAreaSegura(pendingAreaGeoJSON);
    unidadActivaEl.textContent = data.nombre || 'Área segura personalizada';
    actualizarEstadoUI('Área segura guardada correctamente.', 'dentro');
  } catch (error) {
    actualizarEstadoUI(error.message, 'pendiente');
  }
}

async function eliminarAreaMadre() {
  if (!currentUser || currentUser.rol !== 'madre') {
    return actualizarEstadoUI('Solo la madre puede eliminar el área.', 'pendiente');
  }
  try {
    await fetch(`${API_BASE}/ninos/${CHILD_ID}/area`, {
      method: 'DELETE'
    });
    if (areaLayer) {
      drawnItems.removeLayer(areaLayer);
      areaLayer = null;
    }
    pendingAreaGeoJSON = null;
    unidadActivaEl.textContent = 'Sin área segura';
    actualizarEstadoUI('Área segura eliminada.', 'pendiente');
    const fallbackId = childData?.unidadId || unidadesCache[0]?.id;
    if (fallbackId) {
      await cargarUnidadEducativa(fallbackId);
    }
  } catch (error) {
    actualizarEstadoUI(error.message, 'pendiente');
  }
}

async function cargarUnidadEducativa(id) {
  try {
    const resp = await fetch(`${API_BASE}/unidades/${id}/geom`);
    if (!resp.ok) {
      throw new Error('Geometría no disponible');
    }
    const data = await resp.json();
    const geojson = data.geom ? JSON.parse(data.geom) : null;
    if (!geojson) throw new Error('Respuesta sin geometría');
    dibujarUnidadBase(geojson);
    unidadActivaEl.textContent = data.nombre || getNombreUnidad(id);
  } catch (error) {
    console.warn('No se pudo cargar la geometría base:', error.message);
  }
}

function dibujarAreaSegura(geojson) {
  if (areaLayer) {
    drawnItems.removeLayer(areaLayer);
  }
  areaLayer = L.geoJSON(geojson, {
    style: {
      color: '#8e44ad',
      weight: 2,
      fillColor: '#8e44ad',
      fillOpacity: 0.15
    }
  });
  drawnItems.addLayer(areaLayer);
  map.fitBounds(areaLayer.getBounds(), { padding: [20, 20] });
}

function dibujarUnidadBase(geojson) {
  if (unidadLayer) {
    unidadLayer.remove();
  }
  unidadLayer = L.geoJSON(geojson, {
    style: {
      color: '#27ae60',
      weight: 2,
      fillColor: '#2ecc71',
      fillOpacity: 0.15
    }
  }).addTo(map);
  map.fitBounds(unidadLayer.getBounds(), { padding: [20, 20] });
}

async function actualizarPosicion() {
  if (!currentUser || currentUser.rol !== 'nino') {
    return actualizarEstadoUI('Solo el niño puede reportar su posición.', 'pendiente');
  }
  const punto = generarPuntoAleatorio();
  try {
    const resp = await fetch(`${API_BASE}/posiciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nino_id: CHILD_ID,
        lat: punto.lat,
        lon: punto.lon
      })
    });

    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(error.error || 'Error al registrar posición.');
    }

    const data = await resp.json();
    moverMarcador(data.lat, data.lon, data.estado);
    actualizarEstadoUI(data.mensaje, data.estado, data.fecha_hora);
  } catch (error) {
    actualizarEstadoUI(error.message, 'pendiente');
  }
}

function moverMarcador(lat, lon, estado) {
  marcador.setLatLng([lat, lon]);
  const color = estado === 'dentro' ? '#2ecc71' : '#e74c3c';
  marcador.setStyle({
    color,
    fillColor: color
  });
  map.panTo([lat, lon], { animate: true });
}

function actualizarEstadoUI(mensaje, estado, fecha) {
  if (!estadoTexto) return;
  estadoTexto.textContent = fecha ? `${mensaje} (${new Date(fecha).toLocaleTimeString()})` : mensaje;
  estadoTexto.className = 'estado ' + (estado === 'dentro'
    ? 'estado-dentro'
    : estado === 'fuera'
      ? 'estado-fuera'
      : 'estado-pendiente');
}

function generarPuntoAleatorio() {
  const delta = (Math.random() - 0.5) * 0.0015;
  const delta2 = (Math.random() - 0.5) * 0.0015;
  return {
    lat: DEFAULT_CENTER.lat + delta,
    lon: DEFAULT_CENTER.lon + delta2
  };
}

function getNombreUnidad(id) {
  const unidad = unidadesCache.find((u) => u.id === Number(id));
  return unidad ? unidad.nombre : 'Sin asignar';
}

function iniciarMonitoreoMadre() {
  detenerMonitoreoMadre();
  consultarUltimaPosicion();
  madreMonitorInterval = setInterval(consultarUltimaPosicion, 5000);
}

function detenerMonitoreoMadre() {
  if (madreMonitorInterval) {
    clearInterval(madreMonitorInterval);
    madreMonitorInterval = null;
  }
}

async function consultarUltimaPosicion() {
  try {
    const resp = await fetch(`${API_BASE}/posiciones/ultimas/${CHILD_ID}?limit=1`);
    if (!resp.ok) throw new Error('No se pudo obtener la última posición.');
    const data = await resp.json();
    if (data.total === 0) {
      actualizarEstadoUI('Aún no hay posiciones registradas.', 'pendiente');
      return;
    }
    const ultima = data.posiciones[0];
    const estado = ultima.estado;
    const mensaje = estado === 'dentro'
      ? 'El niño está dentro del área segura.'
      : 'ALERTA: El niño está fuera del área segura.';
    actualizarEstadoUI(mensaje, estado, ultima.fecha_hora);
    if (typeof ultima.lat === 'number' && typeof ultima.lon === 'number') {
      moverMarcador(ultima.lat, ultima.lon, estado);
    }
  } catch (error) {
    console.warn(error.message);
  }
}

async function enviarNotificacionPrueba() {
  if (!currentUser) {
    alert("Primero inicia sesión");
    return;
  }

  const titulo = "⚠ Alerta del Sistema";
  const mensaje = "Este es un mensaje predeterminado enviado por el frontend....";

  await fetch(`${API_BASE}/notificacion-prueba`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUser.id,
      titulo,
      mensaje
    })
  });


/*
  const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
*/

  alert("Notificación enviada");
}




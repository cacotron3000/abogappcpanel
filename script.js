// === script.js ===
// Este archivo contiene la lógica principal para la navegación entre vistas
// en la aplicación AbogApp Beta. En el futuro, aquí también se pueden inicializar
// funciones globales o cargar datos al iniciar la app.

// -----------------------------------------------------------------------------------
// FUNCIÓN: cambiarVista
// Tipo: Función declarada
// Objetivo: Oculta todas las secciones (.vista) y muestra solo la seleccionada.
// Nivel de relevancia: 🔥 Crítico. Es el corazón de la navegación entre módulos.
let vistaActual = localStorage.getItem("ultimaVista") || "dashboard";

// ------------------------------
// ⏳ Manejo de expiración de sesión
// ------------------------------
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
let sessionTimer;
let sessionStart = parseInt(localStorage.getItem("sessionStart") || Date.now());
window.sesionExpirada = false;

const DEFAULT_CONFIG = {
  radius: "12px",
  tema: "original",
  fuente: "16px",
  formatoFecha: "DMY",
  formatoHora: "24",
};

const NOMBRES_POR_EMAIL = {
  "cgorrono@gjabogados.cl": "Carlos Gorroño Vega",
  "ijara@gjabogados.cl": "Ignacio Jara Álvarez",
  "jmgorrono@gjabogados.cl": "José M. Gorroño Vega",
};
function esUsuarioAdmin(usuario) {
  if (!usuario) return false;
  return Boolean(usuario.esAdmin) || usuario.usuario === "admin@gjabogados.cl";
}

function usuarioKey(base) {
  const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  return u ? `${base}_${u.usuario}` : base;
}

let configuracion =
  JSON.parse(localStorage.getItem(usuarioKey("configuracion")) || "null") ||
  DEFAULT_CONFIG;
delete configuracion.transparencia;
if (configuracion.tema === "actual") {
  configuracion.tema = "original";
}

function parseFechaLocal(fecha) {
  if (!fecha) return null;
  const partes = fecha.split("-").map(Number);
  return partes.length === 3 ? new Date(partes[0], partes[1] - 1, partes[2]) : new Date(fecha);
}

function formatearCorta(fecha) {
  if (!fecha) return "-";
  let d;
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    d = parseFechaLocal(fecha);
  } else {
    d = new Date(fecha);
  }
  if (isNaN(d)) return fecha;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mostrarToast(mensaje, color = null) {
  if (window.Toastify) {
    const bg =
      color ||
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-principal"
      );
    Toastify({
      text: mensaje,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: bg.trim(),
        color: "#fff",
      },
    }).showToast();
    return;
  }
  const notif = document.getElementById("appNotification");
  if (!notif) return;
  notif.textContent = mensaje;
  if (color) {
    notif.style.backgroundColor = color;
  } else {
    notif.style.backgroundColor = "";
  }
  notif.classList.remove("oculto");
  setTimeout(() => notif.classList.add("oculto"), 3000);
}

function mostrarNotificacion(mensaje, color = null) {
  mostrarToast(mensaje, color);
}

function verificarEscritura(clave, id) {
  const lista = JSON.parse(localStorage.getItem(clave)) || [];
  return lista.some((e) => e.id === id);
}

function agregarNotificacionLocal(notif) {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const notifTime = new Date(notif.ts).getTime();
  if (notifTime <= tsLimpiar) return;
  const clave = `notificaciones_${usuario.usuario}`;
  const lista = JSON.parse(localStorage.getItem(clave)) || [];
  if (!lista.some((n) => n.id === notif.id)) {
    lista.unshift(notif);
    localStorage.setItem(clave, JSON.stringify(lista));
    actualizarCentroNotificaciones();
    if (window.Notification) {
      if (Notification.permission === "granted") {
        new Notification(notif.mensaje);
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") new Notification(notif.mensaje);
        });
      }
    }
  }
}

window.recibirNotificacionSupabase = agregarNotificacionLocal;

function registrarNotificacion(mensaje, destino = "dashboard") {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const notif = {
    id: Date.now(),
    mensaje,
    destino,
    ts: new Date().toISOString(),
    creadoPor: usuario.nombre,
  };
  agregarNotificacionLocal(notif);
  if (window.supabaseSync && supabaseSync.pushNotificacion) {
    supabaseSync.pushNotificacion(notif);
  }
}

function obtenerNotificaciones() {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return [];
  const clave = `notificaciones_${usuario.usuario}`;
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const datos = JSON.parse(localStorage.getItem(clave)) || [];
  return datos.filter((n) => new Date(n.ts).getTime() > tsLimpiar);
}

function actualizarCentroNotificaciones() {
  const listaEl = document.getElementById("listaNotificaciones");
  const contadorEl = document.getElementById("contadorNotificaciones");
  if (!listaEl) return;
  const datos = obtenerNotificaciones();
  listaEl.innerHTML = "";
  datos.forEach((n) => {
    const li = document.createElement("li");
    const fecha = new Date(n.ts).toLocaleString("es-CL");
    li.textContent = `${fecha}: ${n.mensaje}`;
    if (n.destino) {
      li.classList.add("clickable-notif");
      li.addEventListener("click", () => {
        cambiarVista(n.destino);
        const centro = document.getElementById("centroNotificaciones");
        if (centro) centro.classList.add("oculto");
      });
    }
    listaEl.appendChild(li);
  });
  if (contadorEl) {
    if (datos.length > 0) {
      contadorEl.textContent = datos.length;
      contadorEl.classList.remove("oculto");
    } else {
      contadorEl.classList.add("oculto");
    }
  }
}

function limpiarNotificaciones() {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const ts = Date.now();
  localStorage.setItem(`notificaciones_limpiar_${usuario.usuario}`, String(ts));
  localStorage.removeItem(`notificaciones_${usuario.usuario}`);
  actualizarCentroNotificaciones();
}

async function cargarNotificacionesDesdeSupabase() {
  if (!window.supabaseSync || !supabaseSync.fetchNotificaciones) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const datos = await supabaseSync.fetchNotificaciones();
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const filtrados = datos.filter(
    (n) => new Date(n.ts).getTime() > tsLimpiar
  );
  const clave = `notificaciones_${usuario.usuario}`;
  localStorage.setItem(clave, JSON.stringify(filtrados));
  actualizarCentroNotificaciones();
}

async function cerrarSesion() {
  localStorage.removeItem("usuarioActual");
  localStorage.removeItem("sessionStart");
  if (window.sb && sb.auth) {
    try {
      await sb.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut falló", e);
    }
  }
  location.reload();
}

function expirarSesion() {
  window.sesionExpirada = true;
  mostrarAlertaModal(
    "⚠️ Tu sesión ha expirado por inactividad. Los datos que ingreses no se sincronizarán con la base de datos."
  );
  document.body.classList.add("blurred");
  const app = document.getElementById("app");
  if (app) app.classList.add("blurred");
  cerrarSesion();
}

function aplicarConfiguracion() {
  document.documentElement.style.setProperty("--radius", configuracion.radius);
  document.documentElement.style.fontSize = configuracion.fuente;
  document.body.classList.remove(
    "tema-azul",
    "tema-rojo",
    "tema-amarillo",
    "tema-celeste",
    "tema-naranja",
    "tema-rosado",
    "tema-gris"
  );
  if (
    !document.body.classList.contains("dark-mode") &&
    configuracion.tema &&
    configuracion.tema !== "original"
  ) {
    document.body.classList.add("tema-" + configuracion.tema);
  }
}

function actualizarFechaChile() {
  const el = document.getElementById("fechaChile");
  if (el) {
    const ahora = new Date();
    const optsFecha =
      configuracion.formatoFecha === "YMD"
        ? { year: "numeric", month: "2-digit", day: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric" };
    const optsHora = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: configuracion.formatoHora === "12",
    };
    const fecha = ahora.toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
      ...optsFecha,
    });
    const hora = ahora.toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      ...optsHora,
    });
    el.textContent = `${fecha} ${hora}`;
  }
}

function actualizarInfoUsuario() {
  const el = document.getElementById("infoUsuario");
  const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (el && u) {
    const diff = Date.now() - sessionStart;
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `Usuario: ${u.nombre} - ${m}m ${s}s`;
  }
}

async function cargarPreferencias() {
  configuracion =
    JSON.parse(localStorage.getItem(usuarioKey("configuracion")) || "null") ||
    DEFAULT_CONFIG;
  if (configuracion.tema === "actual") {
    configuracion.tema = "original";
  }
  const usr = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (usr && window.supabaseSync && supabaseSync.obtenerTema) {
    const remoto = await supabaseSync.obtenerTema(usr.usuario);
    if (remoto) configuracion.tema = remoto;
  }
  const mediaPref = window.matchMedia("(prefers-color-scheme: dark)");
  const guardado = localStorage.getItem(usuarioKey("tema"));
  const oscuro = guardado ? guardado === "oscuro" : mediaPref.matches;
  document.body.classList.toggle("dark-mode", oscuro);
  const botonTema = document.getElementById("toggleTema");
  if (botonTema) {
    botonTema.innerHTML = oscuro
      ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
      : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
  }
  aplicarConfiguracion();
}

function reiniciarTemporizador() {
  if (window.sesionExpirada) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(expirarSesion, SESSION_TIMEOUT_MS);
}

function refrescarDatos() {
  if (typeof cargarClientes === "function") cargarClientes();
  if (typeof cargarTareasDia === "function") cargarTareasDia();
  if (typeof cargarTareasDiaArchivadas === "function") cargarTareasDiaArchivadas();
  if (typeof cargarAudiencias === "function") cargarAudiencias();
  if (typeof cargarAudienciasArchivadas === "function") cargarAudienciasArchivadas();
  if (typeof actualizarDashboard === "function") actualizarDashboard();
  actualizarCentroNotificaciones();
}
window.refrescarDatos = refrescarDatos;

// Manejo de capas de modales para permitir abrir un modal sobre otro
let modalZIndex = 12000;
function mostrarModal(modal) {
  if (!modal) return;
  modalZIndex += 1;
  modal.style.zIndex = modalZIndex;
  modal.classList.remove("oculto");
}

function mostrarAlertaModal(mensaje, driveLink) {
  mostrarToast(mensaje, "#e53935");
  const texto = document.getElementById("modalAlertaMensaje");
  const modal = document.getElementById("modalAlerta");
  const driveBtn = document.getElementById("modalAlertaDrive");
  if (texto && modal) {
    texto.innerHTML = mensaje;
    if (driveBtn) {
      if (driveLink) {
        driveBtn.href = driveLink;
        driveBtn.classList.remove("oculto");
      } else {
        driveBtn.classList.add("oculto");
      }
    }
    mostrarModal(modal);
  } else {
    alert(mensaje);
  }
}

// Utilidad para aplicar Choices.js a un select, destruyendo instancias previas
function enhanceSelect(select) {
  if (!window.Choices || !select) return;
  if (select.choicesInstance) {
    select.choicesInstance.destroy();
  }
  const config = { searchEnabled: true, itemSelectText: "" };
  if (select.multiple) {
    config.removeItemButton = true;
  }
  const ph = select.getAttribute("placeholder");
  if (ph) {
    config.placeholder = true;
    config.placeholderValue = ph;
  }
  select.choicesInstance = new Choices(select, config);
}

// Asigna un valor al <select> y actualiza Choices si está habilitado
function setSelectValue(select, value) {
  if (!select) return;
  if (select.multiple && Array.isArray(value)) {
    Array.from(select.options).forEach((opt) => {
      opt.selected = value.includes(opt.value);
    });
    if (select.choicesInstance) {
      select.choicesInstance.removeActiveItems();
      select.choicesInstance.setChoiceByValue(value);
    }
  } else {
    select.value = value;
    if (select.choicesInstance && typeof select.choicesInstance.setChoiceByValue === "function") {
      select.choicesInstance.setChoiceByValue(String(value));
    }
  }
}

function cambiarVista(vistaId) {
  const vistaMostrada = document.getElementById(`vista-${vistaId}`);
  if (!vistaMostrada) return;

  // 1) Recargar datos antes de mostrar la sección
  if (vistaId === "clientes" && typeof cargarClientes === "function") {
    cargarClientes();
  } else if (vistaId === "dashboard" && typeof actualizarDashboard === "function") {
    actualizarDashboard();
  } else if (vistaId === "internas" && typeof cargarTareasInternas === "function") {
    cargarTareasInternas();
    cargarTareasInternasArchivadas();
  } else if (vistaId === "tareas" && typeof cargarTareasDia === "function") {
    cargarTareasDia();
    cargarTareasDiaArchivadas();
  } else if (vistaId === "mistareas" && typeof cargarMisTareas === "function") {
    cargarMisTareas();
  } else if (vistaId === "audiencias" && typeof cargarAudiencias === "function") {
    cargarAudiencias();
    if (typeof mostrarAudienciasProximas === "function") {
      mostrarAudienciasProximas();
    }
  }

  // 2) Ocultamos todas las secciones
  document.querySelectorAll(".vista").forEach(seccion => seccion.classList.add("oculto"));
  // Quitamos la clase activa de los botones
  document.querySelectorAll(".tab").forEach(boton => boton.classList.remove("active"));

  // 3) Mostramos la sección ya cargada
  vistaMostrada.classList.remove("oculto");
  vistaActual = vistaId;

  const botonActivo = document.querySelector(`.tab[data-tab="${vistaId}"]`);
  if (botonActivo) botonActivo.classList.add("active");
}

// -----------------------------------------------------------------------------------
// EVENTO: DOMContentLoaded
// Tipo: Evento del navegador
// Objetivo: Ejecuta el bloque de código cuando todo el HTML haya sido cargado.
// Nivel de relevancia: 🔁 General. Permite que todo funcione correctamente al iniciar.
document.addEventListener("DOMContentLoaded", async () => {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  const appDiv = document.getElementById("app");
  const loginDiv = document.getElementById("login");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginUsuarioInput = document.getElementById("loginUsuario");
  const btnNotif = document.getElementById("btnNotificaciones");
  const centroNotif = document.getElementById("centroNotificaciones");
  const limpiarNotif = document.getElementById("limpiarNotificaciones");
  const notifWrapper = document.getElementById("notificacionesWrapper");
  const sidebar = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebar");
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const handleMobileLayout = () => {
      if (mobileQuery.matches) {
        sidebar.classList.remove("collapsed");
        toggleSidebarBtn.classList.add("oculto");
      } else {
        toggleSidebarBtn.classList.remove("oculto");
      }
    };
    handleMobileLayout();
    mobileQuery.addEventListener("change", handleMobileLayout);
  }

  if (loginUsuarioInput) {
    loginUsuarioInput.addEventListener("blur", () => {
      const v = loginUsuarioInput.value.trim();
      if (v && !v.includes("@")) {
        loginUsuarioInput.value = v + "@gjabogados.cl";
      }
    });
  }

  if (btnNotif && centroNotif) {
    btnNotif.addEventListener("click", () => {
      centroNotif.classList.toggle("oculto");
      actualizarCentroNotificaciones();
    });
    document.addEventListener("click", (e) => {
      if (!centroNotif.contains(e.target) && !btnNotif.contains(e.target)) {
        centroNotif.classList.add("oculto");
      }
    });
  }
  if (limpiarNotif) {
    limpiarNotif.addEventListener("click", () => {
      limpiarNotificaciones();
    });
  }

  // Mover modales de formularios al body para que puedan abrirse desde cualquier vista
  ["modalFormulario", "modalFormularioExpediente", "ModalFormularioTarea"].forEach(id => {
    const m = document.getElementById(id);
    if (m) document.body.appendChild(m);
  });

  // Convierte todos los <select> en listas con búsqueda usando Choices.js
  document.querySelectorAll("select").forEach(enhanceSelect);

  if (window.supabaseSync) {
    await window.supabaseSync.pullAll();
    window.supabaseSync.subscribeRealtime();
  }

  aplicarConfiguracion();


  if (typeof cargarAbogadosEnSelect === "function") {
    cargarAbogadosEnSelect();
  }
  if (typeof cargarAbogadosEnSelectTarea === "function") {
    cargarAbogadosEnSelectTarea();
  }

  function mostrarApp() {
    loginDiv.classList.add("oculto");
    appDiv.classList.remove("oculto");
    document.body.classList.remove("blurred");
    appDiv.classList.remove("blurred");
    const usuariosBtn = document.getElementById("tabUsuarios");
    if (usuariosBtn) {
      const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
      if (esUsuarioAdmin(u)) {
        usuariosBtn.classList.remove("oculto");
      } else {
        usuariosBtn.classList.add("oculto");
      }
    }
    reiniciarTemporizador();
    ["click", "keydown", "mousemove"].forEach((evt) =>
      document.addEventListener(evt, reiniciarTemporizador)
    );
    actualizarFechaChile();
    actualizarInfoUsuario();
    setInterval(actualizarFechaChile, 1000);
    setInterval(actualizarInfoUsuario, 1000);
    actualizarCentroNotificaciones();
    if (notifWrapper) notifWrapper.classList.remove("oculto");
    cargarNotificacionesDesdeSupabase();
    if (window.supabaseSync && supabaseSync.subscribeNotificaciones) {
      supabaseSync.subscribeNotificaciones();
    }
    refrescarDatos();
      cambiarVista(vistaActual);
      if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
      }
      const modalControlCausas = document.getElementById("modalControlCausas");
      const diasRecordatorio = [2, 4, 6]; // martes, jueves, sábado
      const diaActual = new Date().getDay();
      if (modalControlCausas && diasRecordatorio.includes(diaActual)) {
        const cerrarRecordatorio = document.getElementById("modalControlCausasCerrar");
        if (cerrarRecordatorio) {
          cerrarRecordatorio.addEventListener("click", () => {
            modalControlCausas.classList.add("oculto");
          });
        }
        modalControlCausas.addEventListener("click", (e) => {
          if (e.target === modalControlCausas) {
            modalControlCausas.classList.add("oculto");
          }
        });
        mostrarModal(modalControlCausas);
      }
    }

    let usuarioActual = null;
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    const email = session.user.email;
    usuarioActual = {
      usuario: email,
      nombre:
        NOMBRES_POR_EMAIL[email] || session.user.user_metadata?.nombre || email,
      esAdmin: Boolean(session.user.is_admin),
    };
    localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));
    sessionStart = parseInt(localStorage.getItem("sessionStart") || Date.now());
    await cargarPreferencias();
    mostrarApp();
  }
  if (!usuarioActual) {
    loginDiv.classList.remove("oculto");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = document.getElementById("loginUsuario").value.trim();
      const pass = document.getElementById("loginPass").value;
      const { data, error } = await sb.auth.signInWithPassword({
        email: usuario,
        password: pass,
      });
      if (error || !data.session) {
        loginError.textContent = "Credenciales incorrectas";
        return;
      }
      const user = data.user;
      const u = {
        usuario: user.email,
        nombre:
          NOMBRES_POR_EMAIL[user.email] ||
          user.user_metadata?.nombre ||
          user.email,
        esAdmin: Boolean(user.is_admin),
      };
      localStorage.setItem("usuarioActual", JSON.stringify(u));
      sessionStart = Date.now();
      localStorage.setItem("sessionStart", sessionStart.toString());
      loginError.textContent = "";
      await cargarPreferencias();
      mostrarApp();
    });
  }

  // Paso 1: Obtenemos todos los botones de pestañas con data-tab (evita el boton de tema)
  const tabs = document.querySelectorAll(".tab[data-tab]");

  // Paso 2: A cada botón le asignamos una función para cambiar la vista
  tabs.forEach(tab => {
    // Cada botón tiene un atributo personalizado llamado data-tab
    // que indica qué vista debe mostrarse cuando se hace clic.
    tab.addEventListener("click", () => {
      const vistaSeleccionada = tab.getAttribute("data-tab"); // extrae "dashboard", "clientes", etc.
        localStorage.setItem("ultimaVista", vistaSeleccionada);
        cambiarVista(vistaSeleccionada);
    });
  });

  // Paso 3: Mostramos la vista guardada o Dashboard por defecto
  cambiarVista(vistaActual);

  const botonTema = document.getElementById("toggleTema");
  if (botonTema) {
    const mediaPref = window.matchMedia("(prefers-color-scheme: dark)");

    function aplicarTema(pref) {
      const guardado = localStorage.getItem(usuarioKey("tema"));
      const oscuro = guardado ? guardado === "oscuro" : pref;
      document.body.classList.toggle("dark-mode", oscuro);
      botonTema.innerHTML = oscuro
        ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
        : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
      aplicarConfiguracion();
    }

    aplicarTema(mediaPref.matches);

    mediaPref.addEventListener("change", (e) => {
      if (!localStorage.getItem(usuarioKey("tema"))) {
        aplicarTema(e.matches);
        aplicarConfiguracion();
        cambiarVista(vistaActual);
      }
    });

    botonTema.addEventListener("click", () => {
      const nuevo = !document.body.classList.contains("dark-mode");
      document.body.classList.toggle("dark-mode", nuevo);
      botonTema.innerHTML = nuevo
        ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
        : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
      localStorage.setItem(usuarioKey("tema"), nuevo ? "oscuro" : "claro");
      aplicarConfiguracion();
      cambiarVista(vistaActual);
    });
  }

  const botonCerrar = document.getElementById("cerrarSesion");
  if (botonCerrar) {
    botonCerrar.addEventListener("click", cerrarSesion);
  }

  const modalAlerta = document.getElementById("modalAlerta");
  if (modalAlerta) {
    const cerrarAlerta = document.getElementById("modalAlertaCerrar");
    const driveBtn = document.getElementById("modalAlertaDrive");
    if (cerrarAlerta) {
      cerrarAlerta.addEventListener("click", () => {
        modalAlerta.classList.add("oculto");
        if (driveBtn) driveBtn.classList.add("oculto");
        if (window.sesionExpirada) cerrarSesion();
      });
    }
    modalAlerta.addEventListener("click", (e) => {
      if (e.target === modalAlerta) {
        modalAlerta.classList.add("oculto");
        if (driveBtn) driveBtn.classList.add("oculto");
        if (window.sesionExpirada) cerrarSesion();
      }
    });
  }

  const btnNuevaTareaDash = document.getElementById("nuevaTareaDashboard");
  if (btnNuevaTareaDash) {
    btnNuevaTareaDash.addEventListener("click", () => {
      const btnNueva = document.getElementById("nuevaTareaDiaBtn");
      if (btnNueva) btnNueva.click();
    });
  }

  const btnNuevoCliente = document.getElementById("nuevoClienteDashboard");
  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener("click", () => {
      mostrarModal(document.getElementById("modalFormulario"));
    });
  }

  const btnCotizaciones = document.getElementById("cotizacionesDashboard");
  if (btnCotizaciones) {
    btnCotizaciones.addEventListener("click", () => {
      window.open(
        "https://drive.google.com/drive/folders/1FBctJ8BlyM6twOBn_xRw8R_mW8xsqBPj",
        "_blank"
      );
    });
  }

  const btnGenCot = document.getElementById("generarCotizacionDashboard");
  const modalCot = document.getElementById("modalCotizacion");
  const modalPreview = document.getElementById("modalPreview");
  const cerrarPreview = document.getElementById("cerrarModalPreview");
  if (btnGenCot && modalCot) {
    const cerrarCot = document.getElementById("cerrarModalCotizacion");
    btnGenCot.addEventListener("click", () => mostrarModal(modalCot));
    if (cerrarCot) cerrarCot.addEventListener("click", () => modalCot.classList.add("oculto"));
    modalCot.addEventListener("click", (e) => {
      if (e.target === modalCot) modalCot.classList.add("oculto");
    });
  }
  if(modalPreview && cerrarPreview){
    cerrarPreview.addEventListener("click", () => modalPreview.classList.add("oculto"));
    modalPreview.addEventListener("click", e=>{ if(e.target===modalPreview) modalPreview.classList.add("oculto")});
  }


  const btnConfig = document.getElementById("abrirConfiguracion");
  const modalConfig = document.getElementById("modalConfiguracion");
  if (btnConfig && modalConfig) {
    const cerrarConfig = document.getElementById("cerrarModalConfiguracion");
    const guardarConfig = document.getElementById("guardarConfiguracion");
    btnConfig.addEventListener("click", () => {
      document.getElementById("configRadio").value = configuracion.radius;
      document.getElementById("configTema").value = configuracion.tema;
      document.getElementById("configFuente").value = configuracion.fuente;
      document.getElementById("configFormatoFecha").value = configuracion.formatoFecha;
      document.getElementById("configFormatoHora").value = configuracion.formatoHora;
      mostrarModal(modalConfig);
    });
    if (cerrarConfig) cerrarConfig.addEventListener("click", () => modalConfig.classList.add("oculto"));
    modalConfig.addEventListener("click", (e) => {
      if (e.target === modalConfig) modalConfig.classList.add("oculto");
    });
    const actualizarConfig = () => {
      localStorage.setItem(
        usuarioKey("configuracion"),
        JSON.stringify(configuracion)
      );
      aplicarConfiguracion();
    };

    function enlazar(id, prop, parser = (v) => v) {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, async () => {
        configuracion[prop] = parser(el.value);
        actualizarConfig();
        if (
          prop === "tema" &&
          window.supabaseSync &&
          supabaseSync.guardarTema
        ) {
          const u = JSON.parse(
            localStorage.getItem("usuarioActual") || "null"
          );
          if (u) supabaseSync.guardarTema(u.usuario, configuracion.tema);
        }
      });
    }

    enlazar("configRadio", "radius");
    enlazar("configTema", "tema");
    enlazar("configFuente", "fuente");
    enlazar("configFormatoFecha", "formatoFecha");
    enlazar("configFormatoHora", "formatoHora");

    if (guardarConfig) {
      guardarConfig.addEventListener("click", () => {
        modalConfig.classList.add("oculto");
      });
    }
  }
});

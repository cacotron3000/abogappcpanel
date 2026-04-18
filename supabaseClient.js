const PASSPHRASE = "abogapp";
const ENCRYPTED_URL =
  "U2FsdGVkX19STQ8d9snr+yMHPu7oBghWrej6/8KvNTOsbZ7eLsk3mIL7KVZzb3ScKHJ07RagCjQV/BjoCHGhSw==";
const ENCRYPTED_KEY =
  "U2FsdGVkX19mDCP/I2fslY5BzA07BNAKyE5LFQ60uEhskm/MAwo06967Far4pkEK67nCOlqlCccHYcnR7GjLtrKGy2VaTX5ZumsUqzk3TcqzKSQuSCciRQCkFt3Kjpj+Wo5ysKiHCLFxay87K8B8poDrorx8I9CwBz46J/r2fm850P8jyOcoU20EGJ7GlTCerW3HuAmDljCeiY2uvQ9rtoPOcF2iwJXKoPV6B3KW1daF9/dxwmQyaLq8KDGHIcxKHEvjxjyETX8SNv6qXkZmBEV/mMA4Jz399Gzibqokyxk7aSsQFml5IH6FLF0TysJe";
const ENCRYPTED_SERVICE_KEY =
  "U2FsdGVkX1+/X4D2nGMw1/4w4omMkxmlSU8wMA/L+0P7Ss115NdtNQGWNEHaQONXh4SCwI6rTjc2R4qjIGVjczKlyZK5BTmaX5WwhHI2zr72nJ8a0iFjxp4sRdSa2dO6CAkkb3nT+aRezl8f5WRs+vcjnqk5ABF7t6FQftIY9yDZH3+2Cc9BdL4F4QKUybHI/2NVIYmYAYe3RdXf3MfBYKY2DgGkhX2VciRtop4oQG3dMv+r0f3CPvz4nYGDV5SkBWtBBQ92mJ3y5PwCSNmCgWLaUvDY2lYbom2eUJBNurcwEPddSeT3Y+GkQY+Vzpkg";

const SUPABASE_URL = CryptoJS.AES.decrypt(ENCRYPTED_URL, PASSPHRASE).toString(
  CryptoJS.enc.Utf8
);
const SUPABASE_ANON_KEY = CryptoJS.AES.decrypt(
  ENCRYPTED_KEY,
  PASSPHRASE
).toString(CryptoJS.enc.Utf8);
const SUPABASE_SERVICE_KEY = CryptoJS.AES.decrypt(
  ENCRYPTED_SERVICE_KEY,
  PASSPHRASE
).toString(CryptoJS.enc.Utf8);

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
window.sesionExpirada = window.sesionExpirada || false;

const TABLAS = [
  "clientes",
  "diario",
  "diarioarchivadas",
  "tareasinternas",
  "comentarios_clientes",
  "audiencias",
  "audienciasarchivadas",
];
const TABLA_ALIASES = {
  diario: "tareasDia",
  diarioarchivadas: "tareasDiaArchivadas",
  tareasinternas: "tareasInternas",
  comentarios_clientes: "comentariosClientes",
  audienciasarchivadas: "audienciasArchivadas",
};

function localKey(tabla) {
  return TABLA_ALIASES[tabla] || tabla;
}

function mapToSupabase(tabla, obj) {
  const copia = { ...obj, app_id: obj.id };
  delete copia.id;
  if (tabla === "comentarios_clientes") {
    copia.cliente_id = copia.clienteId;
    delete copia.clienteId;
  }
  if (["diario", "diarioarchivadas", "tareasinternas"].includes(tabla)) {
    if (typeof copia.asignadosA !== "undefined") {
      copia.asignados = copia.asignadosA;
      delete copia.asignadosA;
    }
    if (typeof copia.fechaFin !== "undefined") {
      copia.fecha_fin = copia.fechaFin;
      if (copia.fecha_fin === "") copia.fecha_fin = null;
      delete copia.fechaFin;
    }
    if (typeof copia.creadoEn !== "undefined") {
      copia.creado_en = copia.creadoEn;
      delete copia.creadoEn;
    }
  }
  if (typeof copia.creadoPor !== "undefined") {
    copia.creado_por = copia.creadoPor;
    delete copia.creadoPor;
  }
  if (tabla === "notificaciones" && typeof copia.ts !== "undefined") {
    copia.created_at = copia.ts;
    delete copia.ts;
  }
  if (typeof copia.archivadoPor !== "undefined") {
    copia.archivado_por = copia.archivadoPor;
    delete copia.archivadoPor;
  }
  if (typeof copia.archivadoEn !== "undefined") {
    copia.archivado_en = copia.archivadoEn;
    delete copia.archivadoEn;
  }
  return copia;
}

function mapFromSupabase(tabla, obj) {
  const copia = { ...obj, id: obj.app_id };
  delete copia.app_id;
  if (tabla === "comentarios_clientes") {
    copia.clienteId = copia.cliente_id;
    delete copia.cliente_id;
  }
  if (["diario", "diarioarchivadas", "tareasinternas"].includes(tabla)) {
    if (typeof copia.asignados !== "undefined") {
      copia.asignadosA = copia.asignados;
      delete copia.asignados;
    }
    if (typeof copia.fecha_fin !== "undefined") {
      copia.fechaFin = copia.fecha_fin;
      delete copia.fecha_fin;
    }
    if (typeof copia.creado_en !== "undefined") {
      copia.creadoEn = copia.creado_en;
      delete copia.creado_en;
    }
  }
  if (typeof copia.creado_por !== "undefined") {
    copia.creadoPor = copia.creado_por;
    delete copia.creado_por;
  }
  if (tabla === "notificaciones" && typeof copia.created_at !== "undefined") {
    copia.ts = copia.created_at;
    delete copia.created_at;
  }
  if (typeof copia.archivado_por !== "undefined") {
    copia.archivadoPor = copia.archivado_por;
    delete copia.archivado_por;
  }
  if (typeof copia.archivado_en !== "undefined") {
    copia.archivadoEn = copia.archivado_en;
    delete copia.archivado_en;
  }
  return copia;
}

async function pullTabla(tabla) {
  const { data, error } = await sb.from(tabla).select();
  if (!error && Array.isArray(data)) {
    const mapeados = data.map((r) => mapFromSupabase(tabla, r));
    localStorage.setItem(localKey(tabla), JSON.stringify(mapeados));
  }
}

async function pullAll() {
  for (const t of TABLAS) {
    await pullTabla(t);
  }
}

function triggerBackgroundRefresh() {
  if (window.refrescarDatos) {
    setTimeout(() => window.refrescarDatos(), 0);
  }
}

async function pushTabla(tabla) {
  if (window.sesionExpirada) {
    console.warn("Sesión expirada. No se sincroniza la tabla " + tabla);
    if (window.mostrarAlertaModal) {
      window.mostrarAlertaModal(
        "⚠️ Los cambios no se guardaron porque la sesión expiró."
      );
    }
    return false;
  }
  const lista = JSON.parse(localStorage.getItem(localKey(tabla))) || [];
  const registros = lista.map((r) => mapToSupabase(tabla, r));
  try {
    await sb
      .from(tabla)
      .upsert(registros, { onConflict: "app_id" })
      .throwOnError();
    triggerBackgroundRefresh();
    return true;
  } catch (error) {
    console.error("Error al escribir en " + tabla, error);
    // Se omite mensaje de modal de error
    return false;
  }
}

async function pushRegistro(tabla, registro) {
  if (window.sesionExpirada) {
    console.warn("Sesión expirada. No se envía registro a " + tabla);
    if (window.mostrarAlertaModal) {
      window.mostrarAlertaModal(
        "⚠️ Los cambios no se guardaron porque la sesión expiró."
      );
    }
    return false;
  }
  const reg = mapToSupabase(tabla, registro);
  try {
    await sb
      .from(tabla)
      .upsert(reg, { onConflict: "app_id" })
      .throwOnError();
    triggerBackgroundRefresh();
    return true;
  } catch (error) {
    console.error("Error al escribir en " + tabla, error);
    // Se omite mensaje de modal de error
    return false;
  }
}

async function deleteRegistro(tabla, id) {
  if (window.sesionExpirada) {
    console.warn("Sesión expirada. No se elimina registro en " + tabla);
    if (window.mostrarAlertaModal) {
      window.mostrarAlertaModal(
        "⚠️ Los cambios no se guardaron porque la sesión expiró."
      );
    }
    return;
  }
  try {
    await sb.from(tabla).delete().eq("app_id", id).throwOnError();
    triggerBackgroundRefresh();
  } catch (error) {
    console.error("Error al eliminar en " + tabla, error);
    // Se omite mensaje de modal de error
  }
}

function handleRealtimeChange(tabla, payload) {
  if (!window.registrarNotificacion) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  if (tabla === "notificaciones") {
    const n = mapFromSupabase("notificaciones", payload.new);
    if (n.creadoPor === usuario.nombre) return;
    if (window.recibirNotificacionSupabase) {
      window.recibirNotificacionSupabase(n);
    }
    return;
  }
  const data = payload.new || payload.old || {};
  const actor = data.creado_por || data.archivado_por || "Otro usuario";
  if (actor === usuario.nombre) return;
  const nombre = data.nombre || data.titulo || data.texto || "registro";
  let accion;
  if (payload.eventType === "INSERT") {
    accion = tabla.includes("archivadas") ? "archivado" : "creado";
  } else if (payload.eventType === "UPDATE") {
    accion = "modificado";
  } else if (payload.eventType === "DELETE") {
    accion = "eliminado";
  }
  const destinos = {
    clientes: "clientes",
    comentarios_clientes: "clientes",
    diario: "dashboard",
    diarioarchivadas: "dashboard",
    tareasinternas: "tareasInternas",
    audiencias: "audiencias",
    audienciasarchivadas: "audiencias",
  };
  const destino = destinos[tabla] || "dashboard";
  if (accion) {
    registrarNotificacion(`${nombre} ${accion} por ${actor}`, destino);
  }
}

function subscribeRealtime() {
  TABLAS.forEach((tabla) => {
    sb.channel(`realtime-${tabla}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        (payload) => {
          pullTabla(tabla);
          handleRealtimeChange(tabla, payload);
          triggerBackgroundRefresh();
        }
      )
      .subscribe();
  });
}

async function pushNotificacion(notificacion) {
  return pushRegistro("notificaciones", notificacion);
}

async function fetchNotificaciones() {
  const { data, error } = await sb
    .from("notificaciones")
    .select()
    .order("id", { ascending: false });
  if (error) return [];
  return data.map((r) => mapFromSupabase("notificaciones", r));
}

function subscribeNotificaciones() {
  sb.channel("realtime-notificaciones")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones" },
      (payload) => {
        const n = mapFromSupabase("notificaciones", payload.new);
        if (window.recibirNotificacionSupabase) {
          window.recibirNotificacionSupabase(n);
        }
      }
    )
    .subscribe();
}

async function guardarTema(usuario, tema) {
  if (!usuario) return false;
  try {
    await sb
      .from("temas_usuarios")
      .upsert({ usuario, tema }, { onConflict: "usuario" })
      .throwOnError();
    return true;
  } catch (e) {
    console.error("Error guardando tema", e);
    return false;
  }
}

async function obtenerTema(usuario) {
  if (!usuario) return null;
  const { data, error } = await sb
    .from("temas_usuarios")
    .select("tema")
    .eq("usuario", usuario)
    .single();
  if (error || !data) return null;
  return data.tema;
}

window.supabaseSync = {
  pullAll,
  pushTabla,
  pushRegistro,
  deleteRegistro,
  subscribeRealtime,
  pushNotificacion,
  fetchNotificaciones,
  subscribeNotificaciones,
  guardarTema,
  obtenerTema,
};

async function fetchUserEmails() {
  if (!window.sbAdmin || !sbAdmin.auth || !sbAdmin.auth.admin) return [];
  const { data, error } = await sbAdmin.auth.admin.listUsers();
  if (error || !data || !data.users) return [];
  return data.users.map((u) => u.email);
}

async function fetchUsers() {
  if (!window.sbAdmin || !sbAdmin.auth || !sbAdmin.auth.admin) return [];
  const { data, error } = await sbAdmin.auth.admin.listUsers();
  if (error || !data || !data.users) return [];
  return data.users.map((u) => ({ email: u.email, nombre: u.user_metadata?.nombre || "" }));
}

window.supabaseAuth = {
  fetchUserEmails,
  fetchUsers,
};

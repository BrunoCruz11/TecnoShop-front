// Todas las llamadas al back (TecnoShop) pasan por aca.
// La URL sale de config.js, asi se cambia sin tocar el codigo.
const API_URL = (window.TECNOSHOP_CONFIG && window.TECNOSHOP_CONFIG.apiUrl) || "/api";

// token de sesion que devuelve /login; se manda en cada peticion
let tokenSesion = null;

function usarToken(token) {
    tokenSesion = token;
}

async function pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {} };
    if (tokenSesion) {
        opciones.headers["Authorization"] = "Bearer " + tokenSesion;
    }
    if (cuerpo !== undefined) {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
        respuesta = await fetch(API_URL + ruta, opciones);
    } catch {
        throw new Error("No se pudo conectar con el servidor. Revisá tu conexión o intentá más tarde.");
    }

    // el back devuelve {"error": "mensaje"} cuando algo sale mal
    const texto = await respuesta.text();
    let datos = null;
    try {
        datos = texto ? JSON.parse(texto) : null;
    } catch {
        datos = null;
    }

    // token vencido o invalido: app.js escucha este evento y vuelve al login
    if (respuesta.status === 401 && ruta !== "/login" && ruta !== "/registro") {
        window.dispatchEvent(new CustomEvent("sesion-vencida", { detail: datos && datos.error }));
    }
    if (!respuesta.ok) {
        throw new Error(datos && datos.error ? datos.error : "Error " + respuesta.status);
    }
    return datos;
}

const api = {
    login: (datos) => pedir("POST", "/login", datos),
    registro: (datos) => pedir("POST", "/registro", datos),
    catalogo: () => pedir("GET", "/catalogo"),
    // ficha de un producto: { producto, resenas }
    detalleProducto: (id) => pedir("GET", "/catalogo/" + id),
    publicarResena: (productoId, datos) => pedir("POST", "/catalogo/" + productoId + "/resenas", datos),
    borrarResena: (id) => pedir("DELETE", "/resenas/" + id),
    sesion: () => pedir("GET", "/sesion"),

    usuarios: {
        listar: () => pedir("GET", "/usuarios"),
        crear: (datos) => pedir("POST", "/usuarios", datos),
        cambiarActivo: (id, activo) => pedir("PUT", "/usuarios/" + id + "/activo", { activo }),
        cambiarRol: (id, rol) => pedir("PUT", "/usuarios/" + id + "/rol", { rol }),
    },

    productos: {
        listar: () => pedir("GET", "/productos"),
        porAcabar: () => pedir("GET", "/productos/por-acabar"),
        crear: (datos) => pedir("POST", "/productos", datos),
        modificar: (id, datos) => pedir("PUT", "/productos/" + id, datos),
        cambiarDisponible: (id, disponible) => pedir("PUT", "/productos/" + id + "/disponible", { disponible }),
    },

    proveedores: {
        listar: () => pedir("GET", "/proveedores"),
        crear: (datos) => pedir("POST", "/proveedores", datos),
        modificar: (id, datos) => pedir("PUT", "/proveedores/" + id, datos),
        eliminar: (id) => pedir("DELETE", "/proveedores/" + id),
    },

    compras: {
        // filtros: { usuarioId } | { proveedorId } | { desde, hasta } | {}
        listar: (filtros = {}) => pedir("GET", "/compras?" + new URLSearchParams(filtros)),
        detalles: (id) => pedir("GET", "/compras/" + id + "/detalles"),
        crear: (datos) => pedir("POST", "/compras", datos),
        confirmar: (id) => pedir("PUT", "/compras/" + id + "/confirmar"),
        cancelar: (id) => pedir("PUT", "/compras/" + id + "/cancelar"),
    },
};

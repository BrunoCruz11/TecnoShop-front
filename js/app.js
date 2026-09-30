// ================= Utilidades =================

const $ = (selector) => document.querySelector(selector);

// evita que un texto que venga del back se interprete como HTML
function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function plata(numero) {
    return "$ " + Number(numero).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// fecha de hoy en formato yyyy-mm-dd (hora local)
function hoy() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
}

function fechaLinda(iso) {
    if (!iso) return "—";
    const [anio, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${anio}`;
}

function avisar(mensaje, tipo = "ok") {
    const aviso = $("#aviso");
    aviso.textContent = mensaje;
    aviso.className = "aviso visible " + tipo;
    clearTimeout(avisar.temporizador);
    avisar.temporizador = setTimeout(() => (aviso.className = "aviso"), tipo === "error" ? 5000 : 3000);
}

// ================= Estado y sesion =================

const estado = {
    usuario: null,
    productos: [],
    proveedores: [],
    usuarios: [],
};

// Se guarda solo el token: los datos del usuario se piden al back con /sesion,
// asi un token vencido o de un usuario desactivado no deja entrar.
const CLAVE_TOKEN = "tecnoshop.token";

function leerToken() {
    try {
        return localStorage.getItem(CLAVE_TOKEN);
    } catch {
        return null;
    }
}

function guardarToken(token) {
    try {
        if (token) localStorage.setItem(CLAVE_TOKEN, token);
        else localStorage.removeItem(CLAVE_TOKEN);
    } catch {
        // sin localStorage la sesion dura hasta recargar la pagina
    }
}

// ================= Login =================
// No hay registro publico: los usuarios nuevos los crea alguien con sesion, desde la seccion Usuarios.

$("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const boton = $("#btn-login");
    boton.disabled = true;
    $("#info-login").hidden = true;
    try {
        const respuesta = await api.login({ email: datos.get("email").trim(), password: datos.get("password") });
        e.target.reset();
        guardarToken(respuesta.token);
        usarToken(respuesta.token);
        iniciarSesion(respuesta.usuario);
    } catch (error) {
        $("#error-login").textContent = error.message;
        $("#error-login").hidden = false;
    } finally {
        boton.disabled = false;
    }
});

function mostrarLogin(mensaje) {
    $("#vista-app").hidden = true;
    $("#vista-login").hidden = false;
    $("#error-login").hidden = true;
    $("#info-login").textContent = mensaje || "";
    $("#info-login").hidden = !mensaje;
    if ($("#modal").open) $("#modal").close();
}

function iniciarSesion(usuario) {
    estado.usuario = usuario;
    $("#nombre-usuario").textContent = usuario.nombre;
    $("#vista-login").hidden = true;
    $("#vista-app").hidden = false;
    mostrarSeccion("productos");
}

function cerrarSesion(mensaje) {
    estado.usuario = null;
    guardarToken(null);
    usarToken(null);
    mostrarLogin(mensaje);
}

$("#btn-salir").addEventListener("click", () => cerrarSesion());

// api.js avisa cuando el back responde 401 (token vencido, invalido o usuario desactivado)
window.addEventListener("sesion-vencida", (e) => {
    if (estado.usuario) cerrarSesion(e.detail || "Tu sesión venció, volvé a iniciar sesión.");
});

// ================= Navegacion =================

document.querySelectorAll(".nav button").forEach((boton) =>
    boton.addEventListener("click", () => mostrarSeccion(boton.dataset.seccion)));

async function mostrarSeccion(nombre) {
    document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("activa", b.dataset.seccion === nombre));
    document.querySelectorAll(".seccion").forEach((s) => (s.hidden = s.id !== "seccion-" + nombre));
    try {
        if (nombre === "productos") await cargarProductos();
        if (nombre === "proveedores") await cargarProveedores();
        if (nombre === "compras") await prepararCompras();
        if (nombre === "usuarios") await cargarUsuarios();
    } catch (error) {
        if (estado.usuario) avisar(error.message, "error");
    }
}

// ================= Modal reutilizable =================

let alGuardar = null;

function abrirModal({ titulo, cuerpo, textoGuardar = "Guardar", soloLectura = false, onGuardar = null, alAbrir = null }) {
    $("#modal-titulo").textContent = titulo;
    $("#modal-cuerpo").innerHTML = cuerpo;
    $("#modal-error").hidden = true;
    $("#modal-guardar").hidden = soloLectura;
    $("#modal-guardar").textContent = textoGuardar;
    $("#modal-cancelar").textContent = soloLectura ? "Cerrar" : "Cancelar";
    alGuardar = onGuardar;
    $("#modal").showModal();
    if (alAbrir) alAbrir($("#modal-cuerpo"));
}

$("#modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!alGuardar) return;
    const boton = $("#modal-guardar");
    boton.disabled = true;
    try {
        await alGuardar(new FormData(e.target));
        $("#modal").close();
    } catch (error) {
        $("#modal-error").textContent = error.message;
        $("#modal-error").hidden = false;
    } finally {
        boton.disabled = false;
    }
});

$("#modal-cancelar").addEventListener("click", () => $("#modal").close());

// si el usuario corrige algo, el error anterior deja de tener sentido
$("#modal-form").addEventListener("input", () => ($("#modal-error").hidden = true));
$("#modal-form").addEventListener("click", (e) => {
    if (e.target.closest("#btn-agregar-linea, .quitar-linea")) $("#modal-error").hidden = true;
});

// ================= Productos =================

async function cargarProductos() {
    // RF08: la lista de productos por acabar la calcula el back
    const [productos, porAcabar] = await Promise.all([api.productos.listar(), api.productos.porAcabar()]);
    estado.productos = productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    renderAlertaStock(porAcabar);
    renderProductos();
}

function renderAlertaStock(porAcabar) {
    const alerta = $("#alerta-stock");
    alerta.hidden = porAcabar.length === 0;
    if (porAcabar.length === 0) return;
    const nombres = porAcabar.map((p) => `<strong>${esc(p.nombre)}</strong> (${p.stock}/${p.stockMinimo})`).join(", ");
    alerta.innerHTML = `${porAcabar.length} producto${porAcabar.length > 1 ? "s" : ""} con stock en o por debajo del mínimo: ${nombres}`;
}

function renderProductos() {
    const filtro = $("#buscar-producto").value.trim().toLowerCase();
    const lista = estado.productos.filter((p) =>
        !filtro || p.nombre.toLowerCase().includes(filtro) || p.codigo.toLowerCase().includes(filtro));

    if (lista.length === 0) {
        $("#tabla-productos").innerHTML = `<tr><td colspan="8" class="vacio">No hay productos${filtro ? " que coincidan con la búsqueda" : ""}.</td></tr>`;
        return;
    }

    $("#tabla-productos").innerHTML = lista.map((p) => `
        <tr class="${p.disponible ? "" : "apagada"}">
            <td class="codigo">${esc(p.codigo)}</td>
            <td>
                <div class="nombre">${esc(p.nombre)}</div>
                <div class="descripcion">${esc(p.descripcion)}</div>
            </td>
            <td class="num ${p.stock <= p.stockMinimo ? "stock-bajo" : ""}">${p.stock}</td>
            <td class="num">${p.stockMinimo}</td>
            <td class="num">${plata(p.precioCompra)}</td>
            <td class="num">${plata(p.precioVenta)}</td>
            <td>
                <button type="button" class="etiqueta ${p.disponible ? "verde" : "gris"}" data-disponible="${p.id}"
                        title="Clic para marcar como ${p.disponible ? "no disponible" : "disponible"}">
                    ${p.disponible ? "Disponible" : "No disponible"}
                </button>
            </td>
            <td class="derecha"><button type="button" class="btn chico" data-editar-producto="${p.id}">Editar</button></td>
        </tr>`).join("");
}

$("#buscar-producto").addEventListener("input", renderProductos);

$("#tabla-productos").addEventListener("click", async (e) => {
    const botonDisponible = e.target.closest("[data-disponible]");
    const botonEditar = e.target.closest("[data-editar-producto]");

    // RF09: marcar disponible / no disponible sin eliminar
    if (botonDisponible) {
        const producto = estado.productos.find((p) => p.id === Number(botonDisponible.dataset.disponible));
        try {
            await api.productos.cambiarDisponible(producto.id, !producto.disponible);
            avisar(`${producto.nombre} ahora está ${producto.disponible ? "no disponible" : "disponible"}`);
            await cargarProductos();
        } catch (error) {
            avisar(error.message, "error");
        }
    }

    if (botonEditar) {
        const producto = estado.productos.find((p) => p.id === Number(botonEditar.dataset.editarProducto));
        abrirFormularioProducto(producto);
    }
});

$("#btn-nuevo-producto").addEventListener("click", () => abrirFormularioProducto(null));

function abrirFormularioProducto(producto) {
    const p = producto || { nombre: "", descripcion: "", codigo: "", stock: 0, stockMinimo: 0, precioCompra: 0, precioVenta: 0 };
    abrirModal({
        titulo: producto ? "Editar producto" : "Nuevo producto",
        cuerpo: `
            <label>Nombre <input name="nombre" required value="${esc(p.nombre)}"></label>
            <label>Descripción <textarea name="descripcion" rows="2">${esc(p.descripcion)}</textarea></label>
            <label>Código <input name="codigo" required value="${esc(p.codigo)}"></label>
            <div class="fila">
                <label>Stock <input name="stock" type="number" min="0" step="1" required value="${p.stock}"></label>
                <label>Stock mínimo <input name="stockMinimo" type="number" min="0" step="1" required value="${p.stockMinimo}"></label>
            </div>
            <div class="fila">
                <label>Precio de compra <input name="precioCompra" type="number" min="0" step="0.01" required value="${p.precioCompra}"></label>
                <label>Precio de venta <input name="precioVenta" type="number" min="0" step="0.01" required value="${p.precioVenta}"></label>
            </div>`,
        onGuardar: async (datos) => {
            const cuerpo = {
                nombre: datos.get("nombre").trim(),
                descripcion: datos.get("descripcion").trim(),
                codigo: datos.get("codigo").trim(),
                stock: Number(datos.get("stock")),
                stockMinimo: Number(datos.get("stockMinimo")),
                precioCompra: Number(datos.get("precioCompra")),
                precioVenta: Number(datos.get("precioVenta")),
            };
            // RF10 y el codigo repetido los valida el back; si falla, el mensaje se muestra en el modal
            if (producto) await api.productos.modificar(producto.id, cuerpo);
            else await api.productos.crear(cuerpo);
            avisar(producto ? "Producto actualizado" : "Producto registrado");
            await cargarProductos();
        },
    });
}

// ================= Proveedores =================

async function cargarProveedores() {
    estado.proveedores = (await api.proveedores.listar()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    renderProveedores();
}

function renderProveedores() {
    if (estado.proveedores.length === 0) {
        $("#tabla-proveedores").innerHTML = `<tr><td colspan="4" class="vacio">Todavía no hay proveedores.</td></tr>`;
        return;
    }
    $("#tabla-proveedores").innerHTML = estado.proveedores.map((p) => `
        <tr>
            <td class="nombre">${esc(p.nombre)}</td>
            <td>${esc(p.telefono)}</td>
            <td>${esc(p.email)}</td>
            <td class="derecha">
                <button type="button" class="btn chico" data-editar-proveedor="${p.id}">Editar</button>
                <button type="button" class="btn chico peligro" data-eliminar-proveedor="${p.id}">Eliminar</button>
            </td>
        </tr>`).join("");
}

$("#tabla-proveedores").addEventListener("click", async (e) => {
    const botonEditar = e.target.closest("[data-editar-proveedor]");
    const botonEliminar = e.target.closest("[data-eliminar-proveedor]");

    if (botonEditar) {
        abrirFormularioProveedor(estado.proveedores.find((p) => p.id === Number(botonEditar.dataset.editarProveedor)));
    }

    if (botonEliminar) {
        const proveedor = estado.proveedores.find((p) => p.id === Number(botonEliminar.dataset.eliminarProveedor));
        if (!confirm(`¿Eliminar el proveedor "${proveedor.nombre}"?`)) return;
        try {
            await api.proveedores.eliminar(proveedor.id); // RF06: el back lo impide si tiene compras
            avisar("Proveedor eliminado");
            await cargarProveedores();
        } catch (error) {
            avisar(error.message, "error");
        }
    }
});

$("#btn-nuevo-proveedor").addEventListener("click", () => abrirFormularioProveedor(null));

function abrirFormularioProveedor(proveedor) {
    const p = proveedor || { nombre: "", telefono: "", email: "" };
    abrirModal({
        titulo: proveedor ? "Editar proveedor" : "Nuevo proveedor",
        cuerpo: `
            <label>Nombre <input name="nombre" required value="${esc(p.nombre)}"></label>
            <label>Teléfono <input name="telefono" type="number" min="0" step="1" required value="${esc(p.telefono)}"></label>
            <label>Email <input name="email" type="email" required value="${esc(p.email)}"></label>`,
        onGuardar: async (datos) => {
            const cuerpo = {
                nombre: datos.get("nombre").trim(),
                telefono: Number(datos.get("telefono")),
                email: datos.get("email").trim(),
            };
            if (proveedor) await api.proveedores.modificar(proveedor.id, cuerpo);
            else await api.proveedores.crear(cuerpo);
            avisar(proveedor ? "Proveedor actualizado" : "Proveedor registrado");
            await cargarProveedores();
        },
    });
}

// ================= Compras =================

const ESTADOS = {
    PENDIENTE: { texto: "Pendiente", color: "amarilla" },
    CONFIRMADA: { texto: "Confirmada", color: "verde" },
    CANCELADA: { texto: "Cancelada", color: "gris" },
};

// las compras solo traen ids, asi que se cargan productos, proveedores y usuarios para mostrar nombres
async function prepararCompras() {
    const [productos, proveedores, usuarios] = await Promise.all([
        api.productos.listar(), api.proveedores.listar(), api.usuarios.listar(),
    ]);
    estado.productos = productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    estado.proveedores = proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    estado.usuarios = usuarios;

    const seleccionado = $("#filtro-proveedor").value;
    $("#filtro-proveedor").innerHTML = estado.proveedores.map((p) =>
        `<option value="${p.id}" ${String(p.id) === seleccionado ? "selected" : ""}>${esc(p.nombre)}</option>`).join("");
    await cargarCompras();
}

const nombreDe = (lista, id) => (lista.find((x) => x.id === id) || {}).nombre || "#" + id;

// RF13: historial filtrado por usuario, proveedor o rango de fechas
async function cargarCompras() {
    const tipo = $("#filtro-compras").value;
    $("#filtro-proveedor-campo").hidden = tipo !== "proveedor";
    $("#filtro-desde-campo").hidden = tipo !== "fechas";
    $("#filtro-hasta-campo").hidden = tipo !== "fechas";

    let filtros = {};
    if (tipo === "mias") filtros = { usuarioId: estado.usuario.id };
    if (tipo === "proveedor") {
        if (!$("#filtro-proveedor").value) return renderCompras([]);
        filtros = { proveedorId: $("#filtro-proveedor").value };
    }
    if (tipo === "fechas") {
        const desde = $("#filtro-desde").value;
        const hasta = $("#filtro-hasta").value;
        if (!desde || !hasta) return renderCompras([], "Elegí las dos fechas para filtrar.");
        filtros = { desde, hasta };
    }

    try {
        const compras = await api.compras.listar(filtros);
        renderCompras(compras.sort((a, b) => b.id - a.id));
    } catch (error) {
        renderCompras([], error.message);
    }
}

function renderCompras(compras, mensajeVacio = "No hay compras para mostrar.") {
    if (compras.length === 0) {
        $("#tabla-compras").innerHTML = `<tr><td colspan="7" class="vacio">${esc(mensajeVacio)}</td></tr>`;
        return;
    }
    $("#tabla-compras").innerHTML = compras.map((c) => {
        const e = ESTADOS[c.estado] || { texto: c.estado, color: "gris" };
        return `
        <tr>
            <td class="codigo">${c.id}</td>
            <td>${fechaLinda(c.fecha)}</td>
            <td>${esc(nombreDe(estado.proveedores, c.proveedorId))}</td>
            <td>${esc(nombreDe(estado.usuarios, c.usuarioId))}</td>
            <td class="num">${plata(c.total)}</td>
            <td><span class="etiqueta ${e.color}">${e.texto}</span></td>
            <td class="derecha">
                <button type="button" class="btn chico" data-ver="${c.id}">Ver</button>
                ${c.estado === "PENDIENTE" ? `<button type="button" class="btn chico primario" data-confirmar="${c.id}">Confirmar</button>` : ""}
                ${c.estado !== "CANCELADA" ? `<button type="button" class="btn chico peligro" data-cancelar="${c.id}" data-estado="${c.estado}">Cancelar</button>` : ""}
            </td>
        </tr>`;
    }).join("");
}

["#filtro-compras", "#filtro-proveedor", "#filtro-desde", "#filtro-hasta"].forEach((selector) =>
    $(selector).addEventListener("change", cargarCompras));

$("#tabla-compras").addEventListener("click", async (e) => {
    const ver = e.target.closest("[data-ver]");
    const confirmar = e.target.closest("[data-confirmar]");
    const cancelar = e.target.closest("[data-cancelar]");

    if (ver) await verCompra(Number(ver.dataset.ver));

    // RF14 y RF17: al confirmar, el back suma el stock de cada producto
    if (confirmar) {
        const id = Number(confirmar.dataset.confirmar);
        if (!confirm(`¿Confirmar la compra N° ${id}? Se va a sumar el stock de sus productos.`)) return;
        await accionCompra(() => api.compras.confirmar(id), `Compra N° ${id} confirmada, stock actualizado`);
    }

    if (cancelar) {
        const id = Number(cancelar.dataset.cancelar);
        const aviso = cancelar.dataset.estado === "CONFIRMADA"
            ? `¿Cancelar la compra N° ${id}? Ya estaba confirmada: se va a descontar el stock que sumó.`
            : `¿Cancelar la compra N° ${id}?`;
        if (!confirm(aviso)) return;
        await accionCompra(() => api.compras.cancelar(id), `Compra N° ${id} cancelada`);
    }
});

async function accionCompra(accion, mensajeOk) {
    try {
        await accion();
        avisar(mensajeOk);
        await prepararCompras();
    } catch (error) {
        avisar(error.message, "error");
    }
}

async function verCompra(id) {
    try {
        const detalles = await api.compras.detalles(id);
        const total = detalles.reduce((suma, d) => suma + d.subtotal, 0);
        abrirModal({
            titulo: `Compra N° ${id}`,
            soloLectura: true,
            cuerpo: `
                <table class="tabla compacta">
                    <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
                    <tbody>
                        ${detalles.map((d) => `
                            <tr>
                                <td>${esc(nombreDe(estado.productos, d.productoId))}</td>
                                <td class="num">${d.cantidad}</td>
                                <td class="num">${plata(d.precioUnitario)}</td>
                                <td class="num">${plata(d.subtotal)}</td>
                            </tr>`).join("")}
                    </tbody>
                    <tfoot><tr><td colspan="3">Total</td><td class="num">${plata(total)}</td></tr></tfoot>
                </table>`,
        });
    } catch (error) {
        avisar(error.message, "error");
    }
}

// ----- Nueva compra (RF11, RF12, RF15, RF16) -----

$("#btn-nueva-compra").addEventListener("click", () => {
    if (estado.proveedores.length === 0) return avisar("Primero registrá al menos un proveedor", "error");
    if (estado.productos.length === 0) return avisar("Primero registrá al menos un producto", "error");

    abrirModal({
        titulo: "Nueva compra",
        textoGuardar: "Registrar compra",
        cuerpo: `
            <div class="fila">
                <label>Proveedor
                    <select name="proveedorId" required>
                        ${estado.proveedores.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}
                    </select>
                </label>
                <label>Fecha <input name="fecha" type="date" required value="${hoy()}"></label>
            </div>
            <div class="lineas-titulo">
                <span>Productos</span>
                <button type="button" class="btn chico" id="btn-agregar-linea">Agregar producto</button>
            </div>
            <div id="lineas"></div>
            <div class="total-compra">Total: <strong id="total-compra">${plata(0)}</strong></div>`,
        alAbrir: () => {
            agregarLinea();
            $("#btn-agregar-linea").addEventListener("click", agregarLinea);
            $("#lineas").addEventListener("input", actualizarTotal);
            $("#lineas").addEventListener("change", (e) => {
                // al elegir un producto se sugiere su precio de compra actual
                if (e.target.name === "productoId") {
                    const producto = estado.productos.find((p) => p.id === Number(e.target.value));
                    e.target.closest(".linea").querySelector("[name=precioUnitario]").value = producto.precioCompra;
                    actualizarTotal();
                }
            });
            $("#lineas").addEventListener("click", (e) => {
                if (e.target.closest(".quitar-linea")) {
                    e.target.closest(".linea").remove();
                    actualizarTotal();
                }
            });
        },
        onGuardar: async (datos) => {
            const detalles = [...document.querySelectorAll("#lineas .linea")].map((linea) => ({
                productoId: Number(linea.querySelector("[name=productoId]").value),
                cantidad: Number(linea.querySelector("[name=cantidad]").value),
                precioUnitario: Number(linea.querySelector("[name=precioUnitario]").value),
            }));
            // RF12: si no hay lineas el back responde con el error y se muestra en el modal
            const respuesta = await api.compras.crear({
                proveedorId: Number(datos.get("proveedorId")),
                fecha: datos.get("fecha"),
                detalles,
            });
            avisar(`Compra N° ${respuesta.id} registrada como pendiente`);
            await prepararCompras();
        },
    });
});

function agregarLinea() {
    const primero = estado.productos[0];
    const linea = document.createElement("div");
    linea.className = "linea";
    linea.innerHTML = `
        <label>Producto
            <select name="productoId" required>
                ${estado.productos.map((p) => `<option value="${p.id}">${esc(p.nombre)}${p.disponible ? "" : " (no disponible)"}</option>`).join("")}
            </select>
        </label>
        <label>Cantidad <input name="cantidad" type="number" min="1" step="1" required value="1"></label>
        <label>Precio unit. <input name="precioUnitario" type="number" min="0" step="0.01" required value="${primero.precioCompra}"></label>
        <button type="button" class="btn chico quitar-linea" title="Quitar">✕</button>`;
    $("#lineas").appendChild(linea);
    actualizarTotal();
}

// RF16: el total se muestra mientras se arma la compra; el que se guarda lo calcula el back
function actualizarTotal() {
    const total = [...document.querySelectorAll("#lineas .linea")].reduce((suma, linea) => {
        const cantidad = Number(linea.querySelector("[name=cantidad]").value) || 0;
        const precio = Number(linea.querySelector("[name=precioUnitario]").value) || 0;
        return suma + cantidad * precio;
    }, 0);
    $("#total-compra").textContent = plata(total);
}

// ================= Usuarios (RF01 - RF03) =================

async function cargarUsuarios() {
    estado.usuarios = (await api.usuarios.listar()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    renderUsuarios();
}

function renderUsuarios() {
    $("#tabla-usuarios").innerHTML = estado.usuarios.map((u) => {
        const soyYo = u.id === estado.usuario.id;
        // no se ofrece desactivarse a uno mismo (el back tambien lo impide)
        const estadoHtml = soyYo
            ? `<span class="etiqueta verde">Activo (vos)</span>`
            : `<button type="button" class="etiqueta ${u.activo ? "verde" : "gris"}" data-activo="${u.id}"
                       title="Clic para ${u.activo ? "desactivar" : "activar"}">${u.activo ? "Activo" : "Inactivo"}</button>`;
        return `
        <tr class="${u.activo ? "" : "apagada"}">
            <td class="nombre">${esc(u.nombre)}</td>
            <td>${esc(u.email)}</td>
            <td>${estadoHtml}</td>
        </tr>`;
    }).join("");
}

$("#tabla-usuarios").addEventListener("click", async (e) => {
    const boton = e.target.closest("[data-activo]");
    if (!boton) return;
    const usuario = estado.usuarios.find((u) => u.id === Number(boton.dataset.activo));
    if (usuario.activo && !confirm(`¿Desactivar a ${usuario.nombre}? No va a poder iniciar sesión.`)) return;
    try {
        await api.usuarios.cambiarActivo(usuario.id, !usuario.activo);
        avisar(`${usuario.nombre} ahora está ${usuario.activo ? "inactivo" : "activo"}`);
        await cargarUsuarios();
    } catch (error) {
        avisar(error.message, "error");
    }
});

$("#btn-nuevo-usuario").addEventListener("click", () => {
    abrirModal({
        titulo: "Nuevo usuario",
        cuerpo: `
            <label>Nombre <input name="nombre" required autocomplete="off"></label>
            <label>Email <input name="email" type="email" required autocomplete="off"></label>
            <label>Contraseña <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
            <p class="ayuda">Mínimo 8 caracteres. El usuario la puede usar para iniciar sesión apenas se crea.</p>`,
        onGuardar: async (datos) => {
            await api.usuarios.crear({
                nombre: datos.get("nombre").trim(),
                email: datos.get("email").trim(),
                password: datos.get("password"),
            });
            avisar("Usuario creado");
            await cargarUsuarios();
        },
    });
});

// ================= Inicio =================

// si hay un token guardado, se le pregunta al back si sigue valido antes de entrar
(async function iniciar() {
    const token = leerToken();
    if (!token) return mostrarLogin();
    usarToken(token);
    try {
        iniciarSesion(await api.sesion());
    } catch {
        guardarToken(null);
        usarToken(null);
        mostrarLogin();
    }
})();

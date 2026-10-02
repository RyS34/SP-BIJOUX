import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =========================
   ELEMENTOS
========================= */

const pedidosContainer = document.getElementById("pedidos-container");
const productosContainer = document.getElementById("productos-container");
let pedidosAdmin = [];

/* =========================
   🔐 PROTECCIÓN ADMIN REAL (CON ROL)
========================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // 🔥 VALIDAR ROL EN FIRESTORE
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists() || snap.data().rol !== "admin") {
        alert("Acceso denegado ❌");
        await signOut(auth);
        window.location.href = "index.html";
        return;
    }

    console.log("🟢 ADMIN AUTORIZADO:", user.email);

    initPanel();
});

/* =========================
   🚀 INICIAR PANEL
========================= */

function initPanel() {
    configurarFiltrosPedidos();
    document.getElementById("ventas-periodo")?.addEventListener("change", () => {
        actualizarVentas(pedidosAdmin);
    });
    escucharPedidos();
    escucharProductos();
}

/* =========================
   📦 PEDIDOS EN TIEMPO REAL
========================= */

function escucharPedidos() {

    onSnapshot(collection(db, "pedidos"), (snapshot) => {

        if (!pedidosContainer) return;

        pedidosAdmin = snapshot.docs
            .map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }))
            .sort((pedidoA, pedidoB) =>
                (obtenerFechaPedido(pedidoB.fecha)?.getTime() || 0) -
                (obtenerFechaPedido(pedidoA.fecha)?.getTime() || 0)
            );

        actualizarDashboard(pedidosAdmin);
        actualizarVentas(pedidosAdmin);
        renderizarPedidos();
    });
}

function configurarFiltrosPedidos() {
    const busqueda = document.getElementById("pedidos-search");
    const filtro = document.getElementById("pedidos-filter");

    busqueda?.addEventListener("input", renderizarPedidos);
    filtro?.addEventListener("change", renderizarPedidos);

    pedidosContainer?.addEventListener("click", (event) => {
        const boton = event.target.closest("button[data-order-id]");
        if (!boton || boton.disabled) return;

        window.cambiarEstado(boton.dataset.orderId, boton.dataset.nextStatus);
    });
}

function normalizarBusqueda(valor) {
    return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function renderizarPedidos() {
    if (!pedidosContainer) return;

    const busqueda = normalizarBusqueda(document.getElementById("pedidos-search")?.value || "");
    const filtroEstado = document.getElementById("pedidos-filter")?.value || "todos";
    const pedidosFiltrados = pedidosAdmin.filter((pedido) => {
        const estado = String(pedido.estado || "pendiente").trim().toLowerCase();
        const coincideEstado = filtroEstado === "todos"
            || (filtroEstado === "otros"
                ? !["pendiente", "enviado", "entregado"].includes(estado)
                : estado === filtroEstado);
        const productos = Array.isArray(pedido.productos) ? pedido.productos : [];
        const textoPedido = normalizarBusqueda([
            pedido.id,
            ...productos.map((producto) => producto.nombre || "")
        ].join(" "));

        return coincideEstado && textoPedido.includes(busqueda);
    });

    const contador = document.getElementById("pedidos-result-count");
    if (contador) {
        contador.textContent = `${pedidosFiltrados.length} de ${pedidosAdmin.length} pedidos`;
    }

    if (!pedidosFiltrados.length) {
        const mensaje = pedidosAdmin.length
            ? "No se encontraron pedidos con esos filtros."
            : "Aún no hay pedidos registrados.";
        pedidosContainer.innerHTML = `
            <div class="orders-empty">
                <i class="fa-solid fa-box-open" aria-hidden="true"></i>
                <p>${mensaje}</p>
            </div>
        `;
        return;
    }

    const formatoFecha = new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    pedidosContainer.innerHTML = pedidosFiltrados.map((pedido) => {
        const id = escaparHTML(pedido.id);
        const fecha = obtenerFechaPedido(pedido.fecha);
        const fechaTexto = fecha ? formatoFecha.format(fecha) : "Fecha no disponible";
        const estado = String(pedido.estado || "pendiente").trim().toLowerCase();
        const clasesEstado = {
            pendiente: "pending",
            enviado: "shipped",
            entregado: "delivered"
        };
        const etiquetasEstado = {
            pendiente: "Pendiente",
            enviado: "Enviado",
            entregado: "Entregado"
        };
        const claseEstado = clasesEstado[estado] || "other";
        const etiquetaEstado = etiquetasEstado[estado] || escaparHTML(estado || "Sin estado");
        const productos = Array.isArray(pedido.productos) ? pedido.productos : [];
        const productosHTML = productos.length
            ? productos.map((producto) => `
                <div class="order-product-row">
                    <span>${escaparHTML(producto.nombre || "Producto")}</span>
                    <span>S/ ${(Number(producto.precio) || 0).toFixed(2)}</span>
                </div>
            `).join("")
            : '<div class="order-product-row"><span>Sin detalle de productos</span></div>';
        const total = (Number(pedido.total) || 0).toFixed(2);
        const idCorto = escaparHTML(pedido.id.slice(0, 6).toUpperCase());

        return `
            <article class="pedido">
                <div class="order-card-top">
                    <div>
                        <p class="order-reference">Pedido</p>
                        <h3>#${idCorto}</h3>
                        <time class="order-date">${fechaTexto}</time>
                    </div>
                    <span class="order-status ${claseEstado}">${etiquetaEstado}</span>
                </div>

                <div class="order-items">
                    <span class="order-items-heading">${productos.length} ${productos.length === 1 ? "producto" : "productos"}</span>
                    ${productosHTML}
                </div>

                <div class="order-card-bottom">
                    <div class="order-total-row"><span>Total del pedido</span><strong>S/ ${total}</strong></div>
                    <div class="order-actions">
                        <button class="order-action" type="button" data-order-id="${id}" data-next-status="enviado" ${["enviado", "entregado"].includes(estado) ? "disabled" : ""}>
                            <i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Marcar enviado
                        </button>
                        <button class="order-action deliver" type="button" data-order-id="${id}" data-next-status="entregado" ${estado === "entregado" ? "disabled" : ""}>
                            <i class="fa-solid fa-check" aria-hidden="true"></i> Marcar entregado
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* =========================
   📊 DASHBOARD
========================= */

function actualizarDashboard(pedidos) {

    const ingresosEl = document.getElementById("total-ingresos");
    const pedidosEl = document.getElementById("total-pedidos");
    const pendientesEl = document.getElementById("pedidos-pendientes");

    const totalIngresos = pedidos.reduce((total, pedido) => total + (Number(pedido.total) || 0), 0);
    const totalPendientes = pedidos.filter((pedido) =>
        !pedido.estado || String(pedido.estado).trim().toLowerCase() === "pendiente"
    ).length;

    if (ingresosEl) ingresosEl.textContent = "S/ " + totalIngresos.toFixed(2);
    if (pedidosEl) pedidosEl.textContent = pedidos.length;
    if (pendientesEl) pendientesEl.textContent = totalPendientes;

    actualizarGraficoIngresos(pedidos);
    actualizarEstadosPedidos(pedidos);
}

function actualizarVentas(pedidos) {
    const periodo = document.getElementById("ventas-periodo")?.value || "7d";
    const ahora = new Date();
    const inicio = periodo === "12m"
        ? new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1)
        : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - (periodo === "30d" ? 29 : 6));
    const pedidosPeriodo = pedidos.filter((pedido) => {
        const fecha = obtenerFechaPedido(pedido.fecha);
        return fecha && fecha >= inicio && fecha <= ahora;
    });

    const valorTotal = pedidosPeriodo.reduce((total, pedido) => total + (Number(pedido.total) || 0), 0);
    const entregados = pedidosPeriodo.filter((pedido) =>
        String(pedido.estado || "").trim().toLowerCase() === "entregado"
    ).length;

    const valorEl = document.getElementById("ventas-total-valor");
    const pedidosEl = document.getElementById("ventas-total-pedidos");
    const promedioEl = document.getElementById("ventas-ticket-promedio");
    const entregadosEl = document.getElementById("ventas-entregados");

    if (valorEl) valorEl.textContent = `S/ ${valorTotal.toFixed(2)}`;
    if (pedidosEl) pedidosEl.textContent = pedidosPeriodo.length;
    if (promedioEl) {
        promedioEl.textContent = `S/ ${(pedidosPeriodo.length ? valorTotal / pedidosPeriodo.length : 0).toFixed(2)}`;
    }
    if (entregadosEl) entregadosEl.textContent = entregados;

    actualizarGraficoVentas(pedidosPeriodo, periodo, inicio);
    actualizarProductosMasPedidos(pedidosPeriodo);
    actualizarTablaVentas(pedidosPeriodo);
}

function obtenerClaveMes(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function actualizarGraficoVentas(pedidos, periodo, inicio) {
    const grafico = document.getElementById("sales-chart");
    if (!grafico) return;

    const dias = periodo === "12m" ? 12 : periodo === "30d" ? 30 : 7;
    const esMensual = periodo === "12m";
    const formato = new Intl.DateTimeFormat("es-PE", esMensual
        ? { month: "short" }
        : periodo === "30d" ? { day: "2-digit", month: "2-digit" } : { weekday: "short" }
    );
    const periodos = Array.from({ length: dias }, (_, indice) => {
        const fecha = esMensual
            ? new Date(inicio.getFullYear(), inicio.getMonth() + indice, 1)
            : new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice);
        return {
            fecha,
            clave: esMensual ? obtenerClaveMes(fecha) : obtenerClaveDia(fecha),
            etiqueta: formato.format(fecha).replace(/\.$/, ""),
            valor: 0,
            pedidos: 0
        };
    });
    const porClave = new Map(periodos.map((item) => [item.clave, item]));

    pedidos.forEach((pedido) => {
        const fecha = obtenerFechaPedido(pedido.fecha);
        if (!fecha) return;

        const clave = esMensual ? obtenerClaveMes(fecha) : obtenerClaveDia(fecha);
        const item = porClave.get(clave);
        if (!item) return;

        item.valor += Number(pedido.total) || 0;
        item.pedidos++;
    });

    if (!pedidos.length) {
        grafico.innerHTML = '<p class="sales-chart-empty">Sin pedidos con fecha en este período.</p>';
        return;
    }

    const maximo = Math.max(...periodos.map((item) => item.valor), 0);
    const anchoMinimo = Math.max(periodos.length * 32, 100);
    const columnas = periodos.map((item) => {
        const altura = item.valor > 0 ? Math.max((item.valor / maximo) * 100, 4) : 0;

        return `
            <div class="sales-bar-column" title="${item.etiqueta}: S/ ${item.valor.toFixed(2)} (${item.pedidos} pedidos)">
                <span class="sales-bar-value">${item.valor > 0 ? item.valor.toFixed(0) : ""}</span>
                <div class="sales-bar-track"><span class="sales-bar" style="height: ${altura}%"></span></div>
                <span class="sales-bar-label">${item.etiqueta}</span>
            </div>
        `;
    }).join("");

    grafico.innerHTML = `<div class="sales-chart-grid" style="--sales-count: ${periodos.length}; min-width: ${anchoMinimo}px">${columnas}</div>`;
}

function actualizarProductosMasPedidos(pedidos) {
    const lista = document.getElementById("sales-top-products");
    if (!lista) return;

    const pedidosPorProducto = new Map();
    pedidos.forEach((pedido) => {
        const nombres = new Set((Array.isArray(pedido.productos) ? pedido.productos : [])
            .map((producto) => String(producto.nombre || "").trim())
            .filter(Boolean));

        nombres.forEach((nombre) => {
            pedidosPorProducto.set(nombre, (pedidosPorProducto.get(nombre) || 0) + 1);
        });
    });

    const productos = Array.from(pedidosPorProducto, ([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((productoA, productoB) => productoB.cantidad - productoA.cantidad)
        .slice(0, 5);

    if (!productos.length) {
        lista.innerHTML = '<p class="sales-chart-empty">Sin productos registrados en este período.</p>';
        return;
    }

    const maximo = productos[0].cantidad;
    lista.innerHTML = productos.map(({ nombre, cantidad }) => `
        <div class="sales-product-row">
            <div class="sales-product-heading">
                <span>${escaparHTML(nombre)}</span>
                <strong>${cantidad} ${cantidad === 1 ? "pedido" : "pedidos"}</strong>
            </div>
            <div class="sales-product-track">
                <span class="sales-product-fill" style="width: ${(cantidad / maximo) * 100}%"></span>
            </div>
        </div>
    `).join("");
}

function actualizarTablaVentas(pedidos) {
    const tabla = document.getElementById("sales-table-body");
    if (!tabla) return;

    if (!pedidos.length) {
        tabla.innerHTML = '<tr><td class="sales-table-empty" colspan="5">No hay pedidos con fecha en este período.</td></tr>';
        return;
    }

    const formatoFecha = new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    const clasesEstado = { pendiente: "pending", enviado: "shipped", entregado: "delivered" };
    const etiquetasEstado = { pendiente: "Pendiente", enviado: "Enviado", entregado: "Entregado" };

    tabla.innerHTML = pedidos.slice(0, 12).map((pedido) => {
        const estado = String(pedido.estado || "pendiente").trim().toLowerCase();
        const productos = Array.isArray(pedido.productos) ? pedido.productos.length : 0;
        const fecha = obtenerFechaPedido(pedido.fecha);
        const fechaTexto = fecha ? formatoFecha.format(fecha) : "Sin fecha";

        return `
            <tr>
                <td>#${escaparHTML(pedido.id.slice(0, 6).toUpperCase())}</td>
                <td>${fechaTexto}</td>
                <td>${productos}</td>
                <td><span class="order-status ${clasesEstado[estado] || "other"}">${etiquetasEstado[estado] || escaparHTML(estado)}</span></td>
                <td>S/ ${(Number(pedido.total) || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join("");
}

function actualizarProductosDashboard(totalProductos) {
    const productosEl = document.getElementById("total-productos");
    if (productosEl) productosEl.textContent = totalProductos;
}

function obtenerFechaPedido(fecha) {
    if (!fecha) return null;

    const fechaPedido = typeof fecha.toDate === "function"
        ? fecha.toDate()
        : fecha instanceof Date
            ? fecha
            : new Date(fecha);

    return Number.isNaN(fechaPedido.getTime()) ? null : fechaPedido;
}

function obtenerClaveDia(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function actualizarGraficoIngresos(pedidos) {
    const grafico = document.getElementById("revenue-chart");
    const totalSemanal = document.getElementById("weekly-total");
    if (!grafico) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const primerDia = new Date(hoy);
    primerDia.setDate(hoy.getDate() - 6);

    const dias = Array.from({ length: 7 }, (_, indice) => {
        const fecha = new Date(primerDia);
        fecha.setDate(primerDia.getDate() + indice);
        return { fecha, clave: obtenerClaveDia(fecha), total: 0, pedidos: 0 };
    });
    const diasPorClave = new Map(dias.map((dia) => [dia.clave, dia]));

    pedidos.forEach((pedido) => {
        const fecha = obtenerFechaPedido(pedido.fecha);
        if (!fecha) return;

        const dia = diasPorClave.get(obtenerClaveDia(fecha));
        if (!dia) return;

        dia.total += Number(pedido.total) || 0;
        dia.pedidos++;
    });

    const totalSemanalCalculado = dias.reduce((total, dia) => total + dia.total, 0);
    const maximoDiario = Math.max(...dias.map((dia) => dia.total), 0);
    const formatoDia = new Intl.DateTimeFormat("es-PE", { weekday: "short" });

    if (totalSemanal) totalSemanal.textContent = `S/ ${totalSemanalCalculado.toFixed(2)}`;

    if (!dias.some((dia) => dia.pedidos > 0)) {
        grafico.innerHTML = '<p class="chart-empty">Sin pedidos registrados en los últimos 7 días.</p>';
        return;
    }

    grafico.innerHTML = dias.map((dia) => {
        const altura = dia.total > 0 ? Math.max((dia.total / maximoDiario) * 100, 4) : 0;
        const etiqueta = formatoDia.format(dia.fecha).replace(/\.$/, "");

        return `
            <div class="revenue-day" title="${etiqueta}: S/ ${dia.total.toFixed(2)}">
                <div class="revenue-track">
                    <span class="revenue-bar" style="height: ${altura}%"></span>
                </div>
                <span class="revenue-day-label">${etiqueta}</span>
            </div>
        `;
    }).join("");
}

function actualizarEstadosPedidos(pedidos) {
    const lista = document.getElementById("order-status-list");
    if (!lista) return;

    const estados = [
        { clave: "pendiente", etiqueta: "Pendientes", color: "#d5a146" },
        { clave: "enviado", etiqueta: "Enviados", color: "#9973a8" },
        { clave: "entregado", etiqueta: "Entregados", color: "#5c9d79" },
        { clave: "otros", etiqueta: "Otros estados", color: "#87909a" }
    ];
    const conteos = Object.fromEntries(estados.map(({ clave }) => [clave, 0]));

    pedidos.forEach((pedido) => {
        const estado = String(pedido.estado || "pendiente").trim().toLowerCase();
        const clave = estados.some((item) => item.clave === estado) ? estado : "otros";
        conteos[clave]++;
    });

    lista.innerHTML = estados.map(({ clave, etiqueta, color }) => {
        const cantidad = conteos[clave];
        const porcentaje = pedidos.length ? (cantidad / pedidos.length) * 100 : 0;

        return `
            <div class="order-status-row">
                <div class="order-status-label"><span>${etiqueta}</span><strong>${cantidad}</strong></div>
                <div class="order-status-track" role="img" aria-label="${cantidad} ${etiqueta.toLowerCase()}">
                    <span class="order-status-fill" style="--status-color: ${color}; width: ${porcentaje}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

/* =========================
   🔄 CAMBIAR ESTADO PEDIDO
========================= */

window.cambiarEstado = async function (id, estado) {

    try {
        await updateDoc(doc(db, "pedidos", id), {
            estado
        });

        console.log("Estado actualizado:", estado);

    } catch (error) {
        console.error("Error cambiar estado:", error);
    }
};

/* =========================
   ➕ AGREGAR PRODUCTO (ACTUALIZADO)
========================= */
const formProducto = document.querySelector(".shopify-form");

if (formProducto) {
    formProducto.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombre").value;
        const precio = document.getElementById("precio").value;
        const stock = document.getElementById("stock").value;
        const categoria = document.getElementById("categoria").value;
        const descripcion = document.getElementById("descripcion").value;

        // CAMBIA LA LÍNEA DE ABAJO POR ESTA:
        const imagenInput = document.getElementById("imagen");
        const imagen = imagenInput && imagenInput.value ? imagenInput.value : "assets/logo_sin_pie_de_pagina.png";

        if (!nombre || !precio) {
            alert("Completa nombre y precio");
            return;
        }

        try {
            await addDoc(collection(db, "productos"), {
                nombre,
                precio: Number(precio),
                stock: Number(stock),
                categoria,
                descripcion: descripcion,
                imagen: imagen, // Ahora sí usará el valor del input o el logo por defecto
                fechaCreacion: new Date()
            });

            alert("✅ Producto agregado con éxito a Firestore");
            formProducto.reset();

        } catch (error) {
            console.error("Error agregar producto:", error);
            alert("Error al guardar: " + error.message);
        }
    });
}

/* =========================
   📦 LISTAR PRODUCTOS
========================= */

function escucharProductos() {

    onSnapshot(collection(db, "productos"), (snapshot) => {

        if (!productosContainer) return;

        actualizarProductosDashboard(snapshot.size);
        productosContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const p = docSnap.data();

            productosContainer.innerHTML += `
                <div class="producto-admin">
                    <div class="producto-info">
                        <img src="${p.imagen}" alt="${p.nombre}">
                        <div class="product-copy">
                            <h4>${p.nombre}</h4>
                            <p class="product-price">S/ ${p.precio}</p>
                            <div class="product-meta">
                                <span>${p.categoria || "Sin categoría"}</span>
                                <span>Stock: ${p.stock ?? 0}</span>
                            </div>
                        </div>
                    </div>

                    <div class="actions">
                        <button class="product-action delete" type="button" title="Eliminar producto" aria-label="Eliminar ${p.nombre}" onclick="eliminarProducto('${docSnap.id}')"><i class="fa-solid fa-trash-can"></i></button>
                        <button class="product-action edit" type="button" title="Editar producto" aria-label="Editar ${p.nombre}" onclick="editarProducto(
                        '${docSnap.id}',
                        '${p.nombre}',
                        '${p.precio}',
                        '${p.imagen}',
                        '${p.categoria}',
                        '${p.stock}'
                    )"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </div>
            `;
        });
    });
}

/* =========================
   🗑 ELIMINAR PRODUCTO
========================= */

window.eliminarProducto = async function (id) {

    try {
        await deleteDoc(doc(db, "productos", id));
    } catch (error) {
        console.error(error);
    }
};

/* =========================
   ✏️ EDITAR PRODUCTO
========================= */

let productoEditandoId = null;

window.editarProducto = function (
    id,
    nombre,
    precio,
    imagen,
    categoria,
    stock
) {

    productoEditandoId = id;

    // ABRIR MODAL
    document.getElementById("edit-modal")
        .classList.add("active");

    // CARGAR DATOS
    document.getElementById("edit-nombre").value = nombre;

    document.getElementById("edit-precio").value = precio;

    document.getElementById("edit-imagen").value = imagen;

    document.getElementById("edit-categoria").value = categoria;

    document.getElementById("edit-stock").value = stock;

    // PREVIEW
    document.getElementById("preview-img").src = imagen;
};

window.cerrarModal = function () {

    document.getElementById("edit-modal")
        .classList.remove("active");
};
window.guardarEdicion = async function () {

    try {

        const nombre =
            document.getElementById("edit-nombre").value;

        const precio =
            document.getElementById("edit-precio").value;

        const imagen =
            document.getElementById("edit-imagen").value;

        const categoria =
            document.getElementById("edit-categoria").value;

        const stock =
            document.getElementById("edit-stock").value;

        await updateDoc(
            doc(db, "productos", productoEditandoId),
            {
                nombre,
                precio: Number(precio),
                imagen,
                categoria,
                stock: Number(stock)
            }
        );

        alert("Producto actualizado ✔");

        cerrarModal();

    } catch (error) {

        console.error(error);

        alert("Error actualizando producto");
    }
};
/* =========================
   🚪 LOGOUT
========================= */

window.logout = function () {

    signOut(auth).then(() => {
        window.location.href = "login.html";
    });

};
window.mostrarSeccion = function (id, element) {

    // ocultar todas
    document.querySelectorAll(".admin-section")
        .forEach(sec => {
            sec.classList.remove("active");
        });

    // mostrar actual
    document.getElementById(id)
        .classList.add("active");

    // quitar active menu
    document.querySelectorAll(".sidebar-menu a")
        .forEach(link => {
            link.classList.remove("active");
        });

    // activar botón actual
    element.classList.add("active");
};
window.guardarConfiguracion = async function () {

    const btn = document.getElementById("btn-guardar");

    const tienda = document.getElementById("config-tienda").value.trim();
    const email = document.getElementById("config-email").value.trim();
    const whatsapp = document.getElementById("config-whatsapp").value.trim();

    // 🔒 VALIDACIÓN
    if (!tienda || !email || !whatsapp) {
        alert("Completa todos los campos");
        return;
    }

    try {

        // ⚡ estado de carga
        btn.disabled = true;
        btn.innerText = "Guardando...";

        await setDoc(doc(db, "configuracion", "tienda"), {
            tienda,
            email,
            whatsapp
        });

        // 🧼 limpiar
        document.getElementById("config-tienda").value = "";
        document.getElementById("config-email").value = "";
        document.getElementById("config-whatsapp").value = "";

        alert("Configuración guardada ✔");

    } catch (error) {
        console.error(error);
        alert("Error al guardar");

    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar configuración";
    }
};
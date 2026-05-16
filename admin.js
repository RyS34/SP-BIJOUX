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
    escucharPedidos();
    escucharProductos();
}

/* =========================
   📦 PEDIDOS EN TIEMPO REAL
========================= */

function escucharPedidos() {

    onSnapshot(collection(db, "pedidos"), (snapshot) => {

        if (!pedidosContainer) return;

        pedidosContainer.innerHTML = "";

        let totalIngresos = 0;
        let totalPedidos = 0;
        let pendientes = 0;

        snapshot.forEach((docSnap) => {

            const pedido = docSnap.data();
            const id = docSnap.id;

            totalPedidos++;
            totalIngresos += Number(pedido.total || 0);

            if (!pedido.estado || pedido.estado === "pendiente") {
                pendientes++;
            }

            let productosHTML = "";

            if (pedido.productos?.length) {
                pedido.productos.forEach(p => {
                    productosHTML += `
                        <div class="producto">
                            • ${p.nombre} - S/ ${p.precio}
                        </div>
                    `;
                });
            }

            pedidosContainer.innerHTML += `
                <div class="pedido">
                    <h3>🧾 Pedido #${id.slice(0, 6)}</h3>

                    ${productosHTML}

                    <p><b>Total:</b> S/ ${pedido.total}</p>
                    <p><b>Estado:</b> ${pedido.estado || "pendiente"}</p>

                    <button onclick="cambiarEstado('${id}', 'enviado')">Enviado</button>
                    <button onclick="cambiarEstado('${id}', 'entregado')">Entregado</button>
                </div>
            `;
        });

        actualizarDashboard(totalIngresos, totalPedidos, pendientes);
    });
}

/* =========================
   📊 DASHBOARD
========================= */

function actualizarDashboard(ingresos, pedidos, pendientes) {

    const ingresosEl = document.getElementById("total-ingresos");
    const pedidosEl = document.getElementById("total-pedidos");
    const pendientesEl = document.getElementById("pedidos-pendientes");

    if (ingresosEl) ingresosEl.textContent = "S/ " + ingresos.toFixed(2);
    if (pedidosEl) pedidosEl.textContent = pedidos;
    if (pendientesEl) pendientesEl.textContent = pendientes;
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

        productosContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {

            const p = docSnap.data();

            productosContainer.innerHTML += `
                <div class="producto-admin">
                    <img src="${p.imagen}" width="80">

                    <div>
                        <h4>${p.nombre}</h4>
                        <p>S/ ${p.precio}</p>
                    </div>

                    <button onclick="eliminarProducto('${docSnap.id}')">🗑</button>
                    <button onclick="editarProducto(
                        '${docSnap.id}',
                        '${p.nombre}',
                        '${p.precio}',
                        '${p.imagen}',
                        '${p.categoria}',
                        '${p.stock}'
                    )">✏️</button>
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
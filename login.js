console.log("LOGIN JS CARGADO ✔");

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.login = async function (event) {

    event.preventDefault(); // ✔ solo una vez

    console.log("LOGIN EJECUTADO ✔");

    const email = document.getElementById("user").value.trim();
    const password = document.getElementById("pass").value;
    const error = document.getElementById("error");

    error.textContent = "";

    try {

        console.log("Intentando login con:", email);

        // 🔐 LOGIN FIREBASE AUTH
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        const user = userCredential.user;

        console.log("LOGIN OK ✔");
        console.log("UID REAL:", user.uid);
        console.log("EMAIL:", user.email);

        // 🧾 BUSCAR EN FIRESTORE
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        console.log("EXISTE EN FIRESTORE:", userSnap.exists());

        if (!userSnap.exists()) {
            error.textContent = "Usuario no registrado en Firestore";
            return;
        }

        const data = userSnap.data();

        console.log("ROL:", data.rol);

        // 🔥 VALIDAR ROL
        if (data.rol === "admin") {
            console.log("REDIRECCIONANDO A ADMIN ✔");
            window.location.href = "admin.html";
        } else {
            console.log("REDIRECCIONANDO A INDEX");
            window.location.href = "index.html";
        }

    } catch (err) {

        console.error("LOGIN ERROR COMPLETO:", err);
        alert(err.message || err.code);

        // 🔥 MENSAJES CLAROS
        switch (err.code) {

            case "auth/user-not-found":
                error.textContent = "Usuario no existe";
                break;

            case "auth/wrong-password":
                error.textContent = "Contraseña incorrecta";
                break;

            case "auth/invalid-credential":
                error.textContent = "Credenciales inválidas";
                break;

            case "auth/invalid-api-key":
                error.textContent = "API Key incorrecta en Firebase";
                break;

            default:
                error.textContent = "Error de login";
                break;
        }
    }
};
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-form").addEventListener("submit", login);
});
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/* =========================
   CONFIG FIREBASE
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyCdM5204f7boeSJpMrnQ7T24PBpzNlidyQ",
  authDomain: "paginaweb-sp-bijoux.firebaseapp.com",
  projectId: "paginaweb-sp-bijoux",
  storageBucket: "paginaweb-sp-bijoux.firebasestorage.app",
  messagingSenderId: "396533356052",
  appId: "1:396533356052:web:d10c5854c5cb960daef901"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

/* =========================
   SERVICIOS
========================= */

export const db = getFirestore(app);
export const auth = getAuth(app);
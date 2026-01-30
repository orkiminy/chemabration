import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <--- Add this

const firebaseConfig = {
  apiKey: "AIzaSyA0vfyr1D4cPXxXwtg6Z2_vh-0hPmP_6cc",
  authDomain: "chemebration.firebaseapp.com",
  projectId: "chemebration",
  storageBucket: "chemebration.firebasestorage.app",
  messagingSenderId: "1061317941415",
  appId: "1:1061317941415:web:f95a59ae70b46d982a6382",
  measurementId: "G-8KJ09N7RW6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app); // <--- Add this
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyArXubl605fS6mpgzni0gb1_3YZhgQGMxo",
  authDomain: "safe-net-tw.firebaseapp.com",
  projectId: "safe-net-tw",
  storageBucket: "safe-net-tw.firebasestorage.app",
  messagingSenderId: "290555063879",
  appId: "1:290555063879:web:fac080454a35863dbd4b62",
  measurementId: "G-ES7GQHHYS6",
};

// Initialize Firebase with unique name for Admin
const app = initializeApp(firebaseConfig, "AdminApp");

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Set auth persistence to use different storage key
// This ensures Admin and Community Portal don't conflict
import { setPersistence, browserLocalPersistence } from "firebase/auth";

// Initialize auth with custom persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set persistence:", error);
});

export default app;

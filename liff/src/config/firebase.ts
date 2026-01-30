import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyArXubl605fS6mpgzni0gb1_3YZhgQGMxo",
  authDomain: "safe-net-tw.firebaseapp.com",
  projectId: "safe-net-tw",
  storageBucket: "safe-net-tw.firebasestorage.app",
  messagingSenderId: "290555063879",
  appId: "1:290555063879:web:fac080454a35863dbd4b62",
  measurementId: "G-ES7GQHHYS6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;

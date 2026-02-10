// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQwZFVxVhWY4v8ez8qKb3eB4GgHe3Tj9I",
  authDomain: "dreamlabos.firebaseapp.com",
  projectId: "dreamlabos",
  storageBucket: "dreamlabos.firebasestorage.app",
  messagingSenderId: "221183400235",
  appId: "1:221183400235:web:6f80e9993289e167534d6e",
  measurementId: "G-9ZJJFLR9ZZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Auth and Database services so we can use them elsewhere
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider(); // For Google Sign-in
export const db = getFirestore(app);

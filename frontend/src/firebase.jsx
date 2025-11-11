/* eslint-disable no-unused-vars */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJWDrLs6x2Jbq6X5lzp1Lp5HLBloPT18M",
  authDomain: "scoutify-68275.firebaseapp.com",
  projectId: "scoutify-68275",
  storageBucket: "scoutify-68275.firebasestorage.app",
  messagingSenderId: "820885384595",
  appId: "1:820885384595:web:3569c391fa993105a74c66",
  measurementId: "G-5BL7ND83H1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db};
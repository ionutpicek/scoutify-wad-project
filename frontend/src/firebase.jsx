/* eslint-disable no-unused-vars */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  getDoc as _getDoc,
  getDocs as _getDocs,
  onSnapshot as _onSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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
const auth = getAuth(app);
const storage = getStorage(app);

// DEBUG LOGGING FOR FIRESTORE READS/LISTENERS (remove when done tracing)
const logFs = (label, args) => {
  const stack = new Error().stack?.split("\n")[2]?.trim() || "";
  console.log(`[FS ${label}]`, args, stack);
};

export const getDocLogged = (...args) => {
  logFs("getDoc", args);
  return _getDoc(...args);
};

export const getDocsLogged = (...args) => {
  logFs("getDocs", args);
  return _getDocs(...args);
};

export const onSnapshotLogged = (...args) => {
  logFs("onSnapshot", args);
  return _onSnapshot(...args);
};

export { app, db, auth, storage};

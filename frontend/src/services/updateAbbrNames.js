import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccountKey = require("./serviceAccountKey.json");

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccountKey)
});

const db = getFirestore();

async function addAbbrNames() {
  const snapshot = await db.collection("player").get();

  snapshot.forEach(async (doc) => {
    const data = doc.data();
    const fullName = data.name;
    if (!fullName) return;

    const parts = fullName.split(" ");
    const abbrName = `${parts[0][0]}. ${parts[parts.length - 1]}`;
    await doc.ref.update({ abbrName });
    console.log(`Updated ${fullName} -> ${abbrName}`);
  });

  console.log("All players updated!");
}

addAbbrNames().catch(console.error);

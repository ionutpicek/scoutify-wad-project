import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccount = JSON.parse(
  fs.readFileSync(
    path.resolve("serviceAccountKey.json"),
    "utf8"
  )
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

admin.firestore().settings({ ignoreUndefinedProperties: true });

export const db = admin.firestore();
export const adminAuth = admin.auth();

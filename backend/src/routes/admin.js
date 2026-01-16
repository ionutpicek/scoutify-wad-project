import express from "express";
import { db, adminAuth } from "../firebase/firebaseAdmin.js";

const router = express.Router();

const USERS_COLLECTION = "users";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173/login";

router.get("/pending-verifications", async (req, res) => {
  try {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("verifyUser", "==", false)
      .get();

    const users = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({ users });
  } catch (error) {
    console.error("Failed to fetch pending verifications:", error);
    res.status(500).json({ message: "Unable to fetch pending verifications." });
  }
});

router.post("/send-verification", async (req, res) => {
  const { uid } = req.body || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }

  try {
    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const docSnapshot = await userRef.get();
    if (!docSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = docSnapshot.data();
    const email = userData.email;
    if (!email) {
      return res.status(400).json({ message: "User missing email address." });
    }

    const actionCodeSettings = {
      url: `${FRONTEND_URL}?source=verification`,
      handleCodeInApp: false,
    };

    const link = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);
    console.log(`[admin] Generated verification link for ${email}: ${link}`);

    await userRef.update({
      verifyUser: true,
      verifyEmail: false,
    });

    res.json({ link });
  } catch (error) {
    console.error("Failed to send verification mail:", error);
    res.status(500).json({ message: "Unable to send verification email." });
  }
});

export default router;

import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const serviceAccount = path.resolve(process.env.FIREBASE_KEY_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_URL,
});

const bucket = admin.storage().bucket();

export default bucket;

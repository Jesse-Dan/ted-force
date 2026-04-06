import dotenv from "dotenv";
import admin, { ServiceAccount } from "firebase-admin";

dotenv.config();

export class Firebase {
  private static instance: Firebase;
  private app: admin.app.App;
  private db: admin.firestore.Firestore;

  private constructor() {
    const base64 = process.env.FIREBASE_JSON;

    if (!base64) {
      throw new Error("Missing FIREBASE_JSON in environment variables");
    }

    const serviceAccount: ServiceAccount = JSON.parse(
      Buffer.from(base64, "base64").toString("utf-8"),
    );

    if (!admin.apps.length) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      this.app = admin.app();
    }

    this.db = this.app.firestore();
  }

  public static getInstance(): Firebase {
    if (!Firebase.instance) {
      Firebase.instance = new Firebase();
    }

    return Firebase.instance;
  }

  public getDb(): admin.firestore.Firestore {
    return this.db;
  }
}

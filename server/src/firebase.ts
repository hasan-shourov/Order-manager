import fs from 'node:fs';
import admin from 'firebase-admin';
import { config } from './config';

let firebaseApp: admin.app.App | null = null;

function loadCredential(): admin.credential.Credential | undefined {
  if (config.firebaseServiceAccountJson) {
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(config.firebaseServiceAccountJson) as admin.ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    return admin.credential.cert(parsed);
  }
  if (config.firebaseServiceAccountPath) {
    const raw = fs.readFileSync(config.firebaseServiceAccountPath, 'utf8');
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(raw) as admin.ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH does not point to valid JSON.');
    }
    return admin.credential.cert(parsed);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }
  return undefined;
}

export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    const credential = loadCredential();
    firebaseApp = admin.initializeApp({
      ...(credential ? { credential } : {}),
      projectId: config.firebaseProjectId,
    });
  }
  return firebaseApp;
}

export interface VerifiedToken {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
}

export async function verifyFirebaseToken(idToken: string): Promise<VerifiedToken> {
  const canCheckRevocation = Boolean(
    config.firebaseServiceAccountJson ||
      config.firebaseServiceAccountPath ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
  const decoded = await getFirebaseApp().auth().verifyIdToken(idToken, canCheckRevocation);
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    name: typeof decoded.name === 'string' ? decoded.name : null,
    picture: typeof decoded.picture === 'string' ? decoded.picture : null,
    emailVerified: decoded.email_verified === true,
  };
}

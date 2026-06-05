/**
 * firebase.js
 * -----------
 * Initializes the Firebase app and exports shared service instances.
 * All other modules should import { db } from here — never call
 * initializeApp() or getFirestore() directly elsewhere.
 *
 * Dependencies:
 *   firebase-config.js — provides the raw config object
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };

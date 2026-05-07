import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js';
import { getFirestore, collection } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(() => {
  analytics = null;
});

const collections = {
  tasks: collection(db, 'tasks'),
  projects: collection(db, 'projects'),
  users: collection(db, 'users')
};

export { app, db, analytics, collections };

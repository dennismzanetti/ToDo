import { db } from './firebase.js';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createTask } from './models.js';

const tasksRef = collection(db, 'tasks');

let _tasks = [];
let _listeners = [];

export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function notify() {
  _listeners.forEach(fn => fn([..._tasks]));
}

export function initStore() {
  const q = query(tasksRef, orderBy('order'));
  onSnapshot(q, (snap) => {
    _tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notify();
  });
}

export async function addTask(fields) {
  const task = createTask(fields);
  await addDoc(tasksRef, task);
}

export async function saveTask(id, fields) {
  const ref = doc(db, 'tasks', id);
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await updateDoc(ref, { ...fields, updatedAt: Timestamp.now() });
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'tasks', id));
}

export async function toggleComplete(id, completed) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await updateDoc(doc(db, 'tasks', id), { completed, updatedAt: Timestamp.now() });
}

export async function reorderTask(id, newOrder, newDueDate) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const update = { order: newOrder, updatedAt: Timestamp.now() };
  if (newDueDate !== undefined) update.dueDate = newDueDate;
  await updateDoc(doc(db, 'tasks', id), update);
}

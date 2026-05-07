import { db } from './firebase.js';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createTask, createTemplate } from './models.js';

const tasksRef     = collection(db, 'tasks');
const templatesRef = collection(db, 'templates');

let _tasks = [];
let _templates = [];
let _taskListeners = [];
let _templateListeners = [];

export function subscribe(fn) {
  _taskListeners.push(fn);
  return () => { _taskListeners = _taskListeners.filter(l => l !== fn); };
}
export function subscribeTemplates(fn) {
  _templateListeners.push(fn);
  return () => { _templateListeners = _templateListeners.filter(l => l !== fn); };
}

function notifyTasks()     { _taskListeners.forEach(fn => fn([..._tasks])); }
function notifyTemplates() { _templateListeners.forEach(fn => fn([..._templates])); }

export function getTasks()     { return [..._tasks]; }
export function getTemplates() { return [..._templates]; }

export function initStore() {
  const q = query(tasksRef, orderBy('order'));
  onSnapshot(q, snap => {
    _tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifyTasks();
  });
  onSnapshot(templatesRef, snap => {
    _templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifyTemplates();
  });
}

export async function addTask(fields) {
  await addDoc(tasksRef, createTask(fields));
}

export async function saveTask(id, fields) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await updateDoc(doc(db, 'tasks', id), { ...fields, updatedAt: Timestamp.now() });
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'tasks', id));
}

export async function toggleComplete(id, completed) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await updateDoc(doc(db, 'tasks', id), { completed, updatedAt: Timestamp.now() });
}

/**
 * reorderTask now accepts doOnFrom + doOnTo instead of dueDate for column placement.
 */
export async function reorderTask(id, newOrder, doOnFrom, doOnTo) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const update = { order: newOrder, updatedAt: Timestamp.now() };
  if (doOnFrom !== undefined) update.doOnFrom = doOnFrom;
  if (doOnTo   !== undefined) update.doOnTo   = doOnTo;
  await updateDoc(doc(db, 'tasks', id), update);
}

export async function addTemplate(fields) {
  await addDoc(templatesRef, createTemplate(fields));
}

export async function saveTemplate(id, fields) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const { appliedDates: _ignored, ...safeFields } = fields;
  await updateDoc(doc(db, 'templates', id), { ...safeFields, updatedAt: Timestamp.now() });
}

export async function deleteTemplate(id) {
  await deleteDoc(doc(db, 'templates', id));
}

export async function markTemplateApplied(id, appliedDates) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  await updateDoc(doc(db, 'templates', id), { appliedDates, updatedAt: Timestamp.now() });
}

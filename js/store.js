import { db } from './firebase.js';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createTask, createTemplate, createCategory } from './models.js';

const tasksRef      = collection(db, 'tasks');
const templatesRef  = collection(db, 'templates');
const categoriesRef = collection(db, 'categories');

let _tasks = [];
let _templates = [];
let _categories = [];
let _taskListeners = [];
let _templateListeners = [];
let _categoryListeners = [];

let _tasksReady      = false;
let _templatesReady  = false;
let _categoriesReady = false;

export function subscribe(fn) {
  _taskListeners.push(fn);
  if (_tasksReady) fn([..._tasks]);
  return () => { _taskListeners = _taskListeners.filter(l => l !== fn); };
}
export function subscribeTemplates(fn) {
  _templateListeners.push(fn);
  if (_templatesReady) fn([..._templates]);
  return () => { _templateListeners = _templateListeners.filter(l => l !== fn); };
}
export function subscribeCategories(fn) {
  _categoryListeners.push(fn);
  if (_categoriesReady) fn([..._categories]);
  return () => { _categoryListeners = _categoryListeners.filter(l => l !== fn); };
}

function notifyTasks()      { _taskListeners.forEach(fn => fn([..._tasks])); }
function notifyTemplates()  { _templateListeners.forEach(fn => fn([..._templates])); }
function notifyCategories() { _categoryListeners.forEach(fn => fn([..._categories])); }

export function getTasks()      { return [..._tasks]; }
export function getTemplates()  { return [..._templates]; }
export function getCategories() { return [..._categories]; }

export function initStore() {
  const q = query(tasksRef, orderBy('order'));
  onSnapshot(q, snap => {
    _tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _tasksReady = true;
    notifyTasks();
  });
  onSnapshot(templatesRef, snap => {
    _templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _templatesReady = true;
    notifyTemplates();
  });
  onSnapshot(categoriesRef, snap => {
    _categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _categoriesReady = true;
    notifyCategories();
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
 * reorderTask({ order, doOnFrom, doOnTo })
 * All fields optional except order.
 */
export async function reorderTask(id, { order, doOnFrom, doOnTo }) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const update = { order, updatedAt: Timestamp.now() };
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

export async function addCategory(fields) {
  await addDoc(categoriesRef, createCategory(fields));
}

export async function deleteCategory(id) {
  const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  // Clear categoryId from any task that referenced this category
  const affected = _tasks.filter(t => t.categoryId === id);
  await Promise.all(affected.map(t =>
    updateDoc(doc(db, 'tasks', t.id), { categoryId: null, updatedAt: Timestamp.now() })
  ));
  await deleteDoc(doc(db, 'categories', id));
}

# To-Do List App

A single-user to-do list web app with a 7-day board view, Firebase Firestore backend, drag-and-drop, inline add, and a full edit modal.

## Live
https://dennismzanetti.github.io/ToDo/

## Features
- 7-day board view (today + 6 days) + No Date column
- Previous/Next week navigation
- Quick inline task add (click "+ Add task" in any column)
- Full edit modal: title, priority, due date, tags, subtasks
- Drag and drop to reorder or move tasks between days
- Complete tasks (crossed out in place)
- Delete tasks
- Light / dark mode toggle
- Firebase Firestore real-time sync

## Data Model — tasks collection

| Field | Type | Notes |
|---|---|---|
| title | string | Required |
| priority | 'low' \| 'medium' \| 'high' | Default: medium |
| dueDate | Timestamp \| null | null → No Date column |
| completed | boolean | Crossed out in place |
| tags | string[] | Free-form labels |
| subtasks | {id, title, completed}[] | Checklist items |
| order | number | Sort position within column |
| createdAt | Timestamp | Auto-set |
| updatedAt | Timestamp | Auto-set on save |

## Stack
- Vanilla HTML / CSS / JavaScript (ES modules)
- Firebase JS SDK 10.12.2 (Firestore)
- GitHub Pages hosting

## Planned
- Firebase Authentication (multi-user login)
- Filter/search tasks
- Priority sort
- Task due date reminders

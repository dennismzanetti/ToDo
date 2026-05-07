# To-Do List App

A starter to-do list web app built as a static HTML/CSS/JavaScript project with Firebase Firestore.

## Pages
- **Dashboard** — task summary stats and recent tasks
- **Tasks** — add and manage tasks
- **Projects** — group tasks by project
- **Settings** — app configuration info

## Firebase
- Project: `todo-cbf89`
- Firestore collections: `tasks`, `projects`, `users`
- SDK version: Firebase JS SDK 12.13.0
- Analytics enabled via `measurementId: G-K6LJZBTR3R`

## Planned Firestore schema

### tasks
- title: string
- description: string
- status: string (Open | In Progress | Done)
- projectId: string
- dueDate: timestamp | null
- createdAt: timestamp
- updatedAt: timestamp

### projects
- name: string
- color: string
- createdAt: timestamp

### users
- email: string
- displayName: string
- createdAt: timestamp

## Structure
```
ToDo/
├── todo-list.html
├── README.md
├── css/
│   └── styles.css
└── js/
    ├── app.js
    ├── firebase.js
    └── firebase-config.js
```

# Planning Poker App

## About this project

A fullstack planning poker app using React with socket.io.

## Installation instructions

1. Clone Repo
2. Initialize main folder with `npm i`
3. Navigate to `frontend` folder
4. Initialize frontend with `npm i`
5. Create `env` file. Example:
   > `VITE_BACKEND_URL = http://localhost:3000`
   >
   > `VITE_FRONTEND_URL = http://localhost:5173`
6. Navigate to `backend` folder
7. Initialize frontend with `npm i`
8. Create `env` file. Example:
   > `MONGO_DB_CLIENT = "<MONGO-DB-URL>"`
   >
   > `PORT = 3000`
   >
   > `FRONTEND_URL = "http://localhost:5173"`
9. start frontend and backend with `npm run start`

## URLS

- Frontend URL: `http://localhost:5173/`
- Backend URL: `http://localhost:3000/`
- Admin URL to display logfiles: `http://localhost:3000/admin`

## Features

- Create a new session as a product manager
- Session Id can be copied to invite other users
- Developers can vote
- Observers cannot vote and only watch
- Product manger can show the votes, reset session and kick users from session
- Logfiles can be accessed via the admin page

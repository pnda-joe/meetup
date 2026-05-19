# Meetup

A small private availability calendar for a registered group. Users mark whole days when they are available, and dates turn green when every active participant can attend.

## Features

- Invite-only registration
- Email/password login with HttpOnly session cookies
- One shared rolling calendar for the current month and the next two months
- Per-day availability counts and participant names
- Admin invite creation
- SQLite persistence
- Docker Compose deployment

## Local development

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
cp .env.example .env
```

Set `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, and `COOKIE_SECRET` in `.env`.

Run the backend and frontend in two terminals:

```sh
npm run dev
npm run dev:client
```

Open `http://localhost:5173`. API requests proxy to the backend on port `3000`.

## Production with Docker Compose

On the server:

```sh
cp .env.example .env
```

Edit `.env`:

- `APP_ORIGIN` should be the public URL, for example `https://meetup.example.com`
- `COOKIE_SECRET` should be a long random value
- `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` seed the first admin account
- `DATABASE_PATH` should stay `/data/meetup.db` for the included volume

Start the app:

```sh
docker compose up -d --build
```

The app listens on port `3000`. Put your reverse proxy in front of it if you want HTTPS and a domain name.

## First admin login

On first startup, the app creates one admin user from the environment variables. It will not overwrite an existing admin user on later starts.

Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then open `/admin` to create invite links for participants.

## Backups

The SQLite database is stored in the `meetup_data` Docker volume at `/data/meetup.db`.

One simple backup option:

```sh
docker compose exec meetup cp /data/meetup.db /data/meetup-backup.db
docker cp meetup-meetup-1:/data/meetup-backup.db ./meetup-backup.db
```

Stop the container first for the quietest backup:

```sh
docker compose stop meetup
docker run --rm -v meetup_meetup_data:/data -v "$PWD":/backup node:22-bookworm-slim cp /data/meetup.db /backup/meetup.db
docker compose start meetup
```

## Checks

```sh
npm run lint
npm test
npm run build
```

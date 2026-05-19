# Changelog

Notable changes to this project are tracked here.

## 2026-05-19

### Added

- Added a right-side planning sidebar that lists days when every active participant is available.
- Added a meetup email composer for fully available dates, with editable location, time, and note fields.
- Added profile picture support with local image upload and an initials fallback when no photo is saved.
- Added avatar persistence in SQLite, including a migration for existing databases.
- Added tests for configuration defaults and profile picture save/remove behavior.

### Changed

- Updated local development invite links to use the Vite frontend origin, `http://localhost:5173`, so registration links work correctly during local testing.
- Expanded the app layout width to keep the three-month calendar readable alongside the planning sidebar.

### Verified

- `npm run lint`
- `npm test`
- `npm run build`

## 2026-05-18

### Added

- Built the initial private availability calendar MVP.
- Added invite-only registration.
- Added email/password login with HttpOnly session cookies.
- Added the rolling three-month shared calendar.
- Added per-day availability counts and participant names.
- Added admin invite creation.
- Added SQLite persistence.
- Added Docker Compose deployment support.
- Added local development and production setup documentation.

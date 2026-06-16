# CLAUDE.md

Guidance for working in the RIC3 Fam Hub codebase. The goal is scalable
architecture and reusable building blocks, so new features should follow the
conventions below rather than introducing one-off patterns.

## What this is

A server-rendered community hub for the RIC3 family / RIC3 2 RICE movement
(events, groups, user profiles, photo slideshows). It began as an Ultimate
Frisbee pickup app, so some internal names still say "game" where the UI says
"event" — treat `game` and `event` as the same entity.

## Stack

- **Node.js + Express**, ES modules (`"type": "module"` — use `import`/`export`).
- **express-handlebars** for server-side views.
- **MongoDB** via the native `mongodb` driver (no ODM/Mongoose).
- **Google Cloud Storage** for uploaded images (profile / event / group / slideshow).
- Deployed as a **Docker** image on **Google Cloud Run**.

## Run / seed / deploy

```bash
npm install          # install dependencies
npm start            # start the server (needs a reachable MongoDB)
npm run seed         # seed the database (seed.js)
```

- Requires a running MongoDB (`DB_URL`, default `mongodb://127.0.0.1:27017/`,
  database `RIC3-Frisbee`).
- No automated test suite exists yet (`npm test` is a placeholder).
- Container: `Dockerfile` (`node:latest`, `CMD ["npm","start"]`, `EXPOSE $PORT`).

## Configuration

All configuration is via environment variables — see **`.env.example`** for the
full list and descriptions. `dotenv` loads `.env` (gitignored) at startup.
In production, always set `SESSION_SECRET` and `ALLOWED_ORIGINS`.

## Architecture & layering

Requests flow through three layers. Keep responsibilities in their layer:

```
routes/*.js   HTTP: read req, validate input, call data layer, render/redirect
   |
data/*.js     Business logic + all MongoDB access (the only place that touches collections)
   |
config/*.js   DB connection + collection handles + settings
```

- **`app.js`** — entry point. Sets up middleware (cookies, json, CORS, static
  `/public`, urlencoded, Handlebars, session), request-scoped middleware
  (`res.locals.currentUser`, logging, auth redirects), mounts routes, and starts
  the server. It also runs the background event-expiry sweep (below).
- **`routes/index.js`** — mounts routers: `/users`, `/games`, `/groups`,
  `/search`, `/pictures`, and `/` (main), plus `/config` and a `*` 404 handler.
- **`data/index.js`** — re-exports each data module as `gamesData`, `usersData`,
  `groupsData`, `weatherData`, `picturesData`, `mediaData`. Import data functions
  from here, not from individual files.
- **`config/mongoConnection.js`** — single memoized `MongoClient` connection.
- **`config/mongoCollections.js`** — memoized collection getters
  (`users`, `games`, `groups`, `media`); call e.g. `const col = await games();`.
- **`helpers.js`** — shared input validation/formatting (ids, email, dates,
  times, locations, US states) and `stringHelper`, which trims and **XSS-escapes**.

### Conventions to follow

- **Data modules** export a default object of `async` functions and own all
  collection access and validation. Add new persistence logic here, not in routes.
- **Routes** use `Router().route(path).get/post(...)`. Wrap handlers in
  `try/catch` and, on failure, render the shared error view:
  `res.status(4xx).render('error', { title: 'Error', error: e })`.
- **Validation** goes through `helpers.js`. Reuse existing validators; add new
  ones there so they're shared. Always pass user strings through `stringHelper`
  (or `xss`) before persisting.
- **Auth/session** is cookie-based via `express-session`. The logged-in user is
  `req.session.user`; it's exposed to templates as `currentUser` through
  `res.locals`. Global middleware in `app.js` blocks non-GET requests from
  unauthenticated users (except `POST /login` and `/register`) and guards a few
  named routes. Admin-only actions check `usersData.isUserAdmin(...)`.

## Views & reusable front-end blocks

- Templates are in `views/`, layout in `views/layouts/main.handlebars`.
  `partialsDir` is the whole `views/` directory, so **every view is also usable
  as a partial** by basename (e.g. `{{> showSlideshow}}`).
- **Shared, parameterized partials live in `views/partials/`** and are referenced
  with their path: `{{> partials/imageUploadForm ...}}`.
- Custom Handlebars helpers (defined in `app.js`): `ifEquals`, `elseEquals`.

### Reuse these instead of duplicating

- **`views/partials/imageUploadForm.handlebars`** — the single source for the
  JPEG upload form (profile, event, group images). Pass `formId`, `inputId`,
  `inputName`, `labelText`, and optionally `hiddenIdElementId` / `hiddenIdValue`.
  The thin wrappers `updatePfp`, `updateGameImage`, `updateGroupImage` delegate to
  it. **Important:** the `formId`/`inputId` values are wired to
  `public/js/pictures.js`, which selects elements by exact id — keep ids in sync
  when adding new upload surfaces.
- **Spacing utilities** in `public/css/styles.css` (`.mt-5`, `.mb-5`, `.my-5`).
  Prefer these (and extend the scale, e.g. `.mt-10`) over inline `style=""`
  attributes so spacing stays consistent and reusable.

### Client-side JS

`public/js/*.js` is plain browser JS loaded per page and binds to elements by
**id**. When changing a template's ids/structure, check the matching script
(`pictures.js`, `slideshow.js`, `search.js`, the `*Validation.js` files, `main.js`).

## Background jobs

Past events are marked `expired: true` by `gamesData.keepStatusUpdated()`. This
runs **once at startup and every 10 minutes** (see `app.js`), not per request.
Newly-passed events may therefore take up to the interval to disappear from
listings, which is acceptable at day-level granularity.

## Gotchas

- `helpers.isDateInFuture(date)` is **semantically inverted**: it returns `true`
  when the date is in the *past*. Both callers (`formatAndValidateGame` and
  `keepStatusUpdated`) rely on this, so they behave correctly — do not "fix" the
  name without auditing every caller.
- Image uploads are **JPEG-only**, enforced client-side and through the signed-URL
  upload flow.
- `mongoConfig.database` is hardcoded to `RIC3-Frisbee` in `config/settings.js`.

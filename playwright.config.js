import 'dotenv/config';
import { defineConfig } from '@playwright/test';

// Load .env so E2E Mongo helpers (DB_URL) match the app started via `npm start`
// (app.js also imports dotenv/config). Without this, withDb falls back to
// mongodb://127.0.0.1:27017/ while the app writes to Atlas — findUserByUsername
// then returns null after a successful UI register/login.

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
});

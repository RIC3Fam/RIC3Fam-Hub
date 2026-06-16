import express from 'express';
import exphbs from 'express-handlebars';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';
import cors from 'cors';

import { gamesData } from './data/index.js';

import configRoutesFunction from './routes/index.js';

const app = express();

app.use(cookieParser());
app.use(express.json());

// In production set ALLOWED_ORIGINS to a comma-separated allowlist of origins.
// When unset (e.g. local dev) the request origin is reflected, matching prior behavior.
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : true,
};

app.use(cors(corsOptions));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const staticDir = express.static(__dirname + '/public');
app.use('/public', staticDir);

app.use(express.urlencoded({ extended: true }));

var hbs = exphbs.create({
    // Set helper functions
    helpers: {
        ifEquals: function (arg1, arg2, options) {
            return arg1 == arg2 ? options.fn(this) : options.inverse(this);
        },
        elseEquals: function (arg1, arg2, options) {
            return arg1 != arg2 ? options.fn(this) : options.inverse(this);
        },
    },
    defaultLayout: 'main',
    partialsDir: __dirname + '/views',
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.use(
    session({
        name: 'CoolSession',
        secret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret',
        saveUninitialized: false,
        resave: false,
        cookie: { maxAge: 60 * 10000 }, // 1 hr
    })
);

// Middleware that updates/stores currentUser object in app.locals for template usage.
app.use('/', (req, res, next) => {
    res.locals.currentUser = req.session.user;
    return next();
});

// Logging middleware
app.use('/', (req, res, next) => {
    const user = req.session.user;
    const auth = user ? 'Authenticated: ' + user.username : 'Not Authenticated';
    console.log(`[${new Date().toUTCString()}]: ${req.method} ${req.originalUrl} (${auth})`);
    return next();
});

// Any authentication redirecting that we explicitly add can be here.
app.use('/', (req, res, next) => {
    const user = req.session.user;

    // For safety. Prevents unauth'd users from methods other than GET, except for POST-ing to /login and /register.
    if (user == null && req.method != 'GET') {
        if (!(req.method == 'POST' && ['/login', '/register'].includes(req.originalUrl))) {
            return res.redirect('/login');
        }
    }

    let onlyAuthenticatedRoutes = ['/logout', '/create-event', '/create-group'];

    let onlyNonAuthenticatedRoutes = ['/login', '/register'];

    if (user == null) {
        if (onlyAuthenticatedRoutes.includes(req.originalUrl)) {
            return res.redirect('/login');
        }
    } else {
        if (onlyNonAuthenticatedRoutes.includes(req.originalUrl)) {
            return res.redirect('/');
        }
    }
    return next();
});

configRoutesFunction(app);

const port = process.env.PORT || 3000;

// Periodically mark past events as expired instead of running a full
// collection sweep on every GET /games request. Runs once at startup and
// then on a fixed interval.
const EXPIRY_SWEEP_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

const runExpirySweep = async () => {
    try {
        await gamesData.keepStatusUpdated();
    } catch (err) {
        console.log(err);
    }
};

app.listen(port, () => {
    console.log(`Up and running on port ${port}!`);
    runExpirySweep();
    setInterval(runExpirySweep, EXPIRY_SWEEP_INTERVAL_MS).unref();
});

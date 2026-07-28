import { test, expect } from '@playwright/test';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MongoClient } = require('mongodb');

const password = 'Family1$';
const unique = Date.now().toString(36);
let e2eMongoClient;

function userCreds(prefix) {
    return {
        name: `${prefix} User ${unique}`,
        username: `${prefix}${unique}`.slice(0, 20),
        email: `${prefix}.${unique}@example.com`,
        password,
    };
}

async function register(page, user) {
    await page.goto('/register');
    await page.fill('#name', user.name);
    await page.fill('#username', user.username);
    await page.fill('#emailAddress', user.email);
    await page.fill('#password', user.password);
    await page.fill('#confirm-password', user.password);
    await page.click('#register-submit-button');
    await expect(page).toHaveURL(/\/login/);
}

// login() only authenticates an existing user — it does not create one.
// Caption / DB-seeded tests must call register() first (same pattern as older e2e tests).
async function login(page, user) {
    await page.goto('/login');
    await page.fill('#login-username', user.username);
    await page.fill('#login-password', user.password);
    await page.click('#login-submit-button');
    await expect(page.locator('#header-profile-box')).toContainText(user.username);
}

async function openOwnProfile(page) {
    await page.goto('/');
    const href = await page.locator('#header-profile-box a[href^="/users/"]').getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href);
    await expect(page).toHaveURL(/\/users\//);
    return page.url();
}

function mongoHostLabel(dbUrl) {
    try {
        const u = new URL(dbUrl);
        return u.hostname || '(unknown-host)';
    } catch {
        if (dbUrl.includes('mongodb+srv://')) return 'mongodb-atlas';
        if (dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')) return 'localhost';
        return '(unparsed-host)';
    }
}

async function withDb(callback) {
    // Use createRequire — dynamic import('mongodb') hangs/fails under Playwright's ESM loader
    // on this Windows/Node setup ("Unexpected module status 3").
    // DB_URL must match the running app (playwright.config.js loads dotenv/config).
    const dbUrl = process.env.DB_URL || 'mongodb://127.0.0.1:27017/';
    const dbName = 'RIC3-Frisbee';
    if (!withDb._logged) {
        console.log(
            `[e2e-db] host=${mongoHostLabel(dbUrl)} database=${dbName} DB_URL_set=${Boolean(process.env.DB_URL)}`
        );
        withDb._logged = true;
    }
    if (!e2eMongoClient) {
        e2eMongoClient = new MongoClient(dbUrl);
        await e2eMongoClient.connect();
    }
    try {
        return await callback(e2eMongoClient.db(dbName));
    } catch (err) {
        await e2eMongoClient.close().catch(() => {});
        e2eMongoClient = null;
        throw err;
    }
}

async function findUserByUsername(username) {
    // App stores username via stringHelper (trim + xss); login lookup is case-insensitive.
    const doc = await withDb((db) =>
        db.collection('users').findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })
    );
    if (!doc) {
        const count = await withDb((db) => db.collection('users').countDocuments());
        console.log(
            `[e2e-db] findUserByUsername miss username=${username} usersCollectionCount=${count}`
        );
    }
    return doc;
}

async function patchCaption(page, body) {
    return page.evaluate(async (payload) => {
        const response = await fetch('/pictures/slideshow', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
        });
        const text = await response.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            data = { raw: text };
        }
        return { ok: response.ok, status: response.status, data };
    }, body);
}

test.describe('RIC3Fam Hub e2e', () => {
    test.afterAll(async () => {
        if (e2eMongoClient) {
            await e2eMongoClient.close();
            e2eMongoClient = null;
        }
    });

    test('home and events pages load', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('header')).toContainText('Events');

        await page.goto('/events');
        await expect(page.locator('.events-page-title')).toHaveText('EVENTS');
        await expect(page.locator('.list-header').first()).toHaveText('UPCOMING EVENTS');
        // pictureSlider scripts load only when slideshowImages.length > 0
        const slideCount = await page.locator('.picture-slider-slide').count();
        if (slideCount > 0) {
            await expect(page.locator('script[src="/public/js/pictureSlider.js"]')).toHaveCount(1);
        } else {
            await expect(page.locator('script[src="/public/js/pictureSlider.js"]')).toHaveCount(0);
        }
    });

    test('register, edit profile layout fields, show public badge', async ({ page }) => {
        const user = userCreds('pub');
        await register(page, user);
        await login(page, user);

        const profileUrl = await openOwnProfile(page);
        await expect(page.locator('.profile-name-top')).toHaveText(user.name);
        await expect(page.locator('.visibility-badge')).toContainText('Public');

        await page.click('button.edit-button');
        await expect(page).toHaveURL(/\/users\/edit\//);

        await page.fill('#statement', 'Artist statement for e2e');
        await page.fill('#description', 'Public description box');
        await page.fill('#link1', 'https://example.com');
        await page.fill('#link1desc', 'My Website');
        await page.fill('#link2', 'https://social.example.com/me');
        await page.fill('#link2desc', 'Social');
        await page.fill('#additionalDescription', 'More about me');
        await page.fill('#slideshowDescription', 'Picture bar note');
        await page.fill('#privateDescription', 'Family-only secrets');
        await page.fill('#preferredEmail', 'pref@example.com');
        await page.fill('#preferredPhone', '555-0100');
        await page.check('#optInFrisbeeNotices');
        await page.selectOption('#visibility', 'public');
        await page.click('button.form-submit-button[type="submit"]');

        await expect(page).toHaveURL(profileUrl);
        await expect(page.locator('.profile-short-desc')).toContainText('Artist statement for e2e');
        await expect(page.locator('.profile-description').filter({ hasText: 'Public description box' })).toBeVisible();
        await expect(page.locator('.profile-description').filter({ hasText: 'More about me' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'My Website' })).toHaveAttribute('href', 'https://example.com');
        await expect(page.getByRole('link', { name: 'Social' })).toHaveAttribute('href', 'https://social.example.com/me');
        await expect(page.locator('h3', { hasText: 'Private Communications' })).toHaveCount(0);
        await expect(page.locator('h3', { hasText: 'RIC3 Fam Connections' })).toHaveCount(0);
        await expect(page.locator('h3', { hasText: 'Events' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Family' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Groups' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Picture Bar' })).toHaveCount(0);
        await expect(page.locator('h3', { hasText: 'Skills' })).toHaveCount(0);
        await expect(page.locator('.profile-username')).toContainText(`@${user.username}`);
    });

    test('private profile is gated for strangers and visible to owner', async ({ page, browser }) => {
        const owner = userCreds('prv');
        await register(page, owner);
        await login(page, owner);

        const profileUrl = await openOwnProfile(page);
        await page.click('button.edit-button');
        await page.selectOption('#visibility', 'private');
        await page.fill('#privateDescription', 'Only family sees this');
        await page.click('button.form-submit-button[type="submit"]');
        await expect(page.locator('.visibility-badge')).toContainText('Private');
        await expect(page.locator('h3', { hasText: 'Private Communications' })).toHaveCount(0);

        const stranger = await browser.newPage();
        await stranger.goto(profileUrl);
        await expect(stranger.locator('.private-entity')).toContainText('This profile is private');
        await expect(stranger.locator('.profile-layout')).toHaveCount(0);
        await stranger.close();
    });

    test('create public group shows badge and private box for member', async ({ page }) => {
        const user = userCreds('grp');
        await register(page, user);
        await login(page, user);

        await page.goto('/create-group');
        await page.fill('#group-name', `E2E Group ${unique}`);
        await page.fill('#description', 'Group created by e2e test');
        await page.selectOption('#visibility', 'public');
        await page.fill('#privateDescription', 'Members-only group note');
        await page.click('#group-submit-button');

        await expect(page).toHaveURL(/\/groups\//);
        await expect(page.locator('.visibility-badge')).toContainText('Public');
        await expect(page.locator('.private-box')).toContainText('Members-only group note');
        // Zero-image groups do not render the slider (or its scripts)
        await expect(page.locator('.picture-slider')).toHaveCount(0);
        await expect(page.locator('script[src="/public/js/pictureSlider.js"]')).toHaveCount(0);
        await expect(page.locator('#slideshow-form')).toBeVisible();
        await expect(page.locator('#group-slideshow-id')).toHaveCount(1);
    });

    test('group links, project framer, section titles, and square image', async ({ page }) => {
        const owner = userCreds('gown');
        const framer = userCreds('fram');
        await register(page, framer);
        await register(page, owner);
        await login(page, owner);

        const groupName = `Framer Group ${unique}`;
        await page.goto('/create-group');
        await expect(page.locator('#group-framers-editor')).toBeAttached();
        await expect(page.locator('#add-framer-row')).toBeVisible();
        await expect(page.locator('#uppercaseTitle')).toBeVisible();
        await expect(page.locator('#lowercaseTitle')).toBeVisible();
        await expect(page.locator('#numericTitle')).toBeVisible();

        await page.fill('#group-name', groupName);
        await page.fill('#description', 'Community service network group');
        await page.fill('#link1', 'https://example.com/website');
        await page.fill('#link1desc', 'Website');
        await page.fill('#link2', 'https://example.com/social');
        await page.fill('#link2desc', 'Social Media');
        await page.fill('#uppercaseTitle', 'ALL CAPS');
        await page.fill('#lowercaseTitle', 'LOWER CASE');
        await page.fill('#numericTitle', 'NUMBERED SECTION');
        await page.selectOption('#visibility', 'public');
        await page.click('#group-submit-button');

        await expect(page).toHaveURL(/\/groups\//);
        const groupUrl = page.url();
        await expect(page.locator('.group-page-name')).toContainText(groupName);
        await expect(page.locator('.group-short-desc')).toContainText('Community service network group');
        await expect(page.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com/website');
        await expect(page.getByRole('link', { name: 'Social Media' })).toHaveAttribute('href', 'https://example.com/social');
        await expect(page.locator('.group-image')).toBeVisible();
        await expect
            .poll(async () => page.locator('.group-image').evaluate((img) => getComputedStyle(img).borderRadius))
            .toBe('4px');
        await expect(page.locator('h3', { hasText: 'Picture Bar' })).toHaveCount(0);
        await expect(page.locator('h3', { hasText: 'About Us' })).toHaveCount(0);
        await page.click('button.edit-button');
        await expect(page).toHaveURL(/\/groups\/edit\//);
        await expect(page.locator('#uppercaseTitle')).toHaveValue('ALL CAPS');
        await expect(page.locator('#lowercaseTitle')).toHaveValue('LOWER CASE');
        await expect(page.locator('#numericTitle')).toHaveValue('NUMBERED SECTION');
        await expect(page.locator('#link1')).toHaveValue('https://example.com/website');
        await expect(page.locator('#link2')).toHaveValue('https://example.com/social');

        await page.fill('#uppercaseTitle', 'GOLD TIER');
        await page.fill('#lowercaseTitle', 'STANDARD');
        await page.fill('#numericTitle', 'DIGIT ACCOUNTS');

        await page.click('#add-framer-row');
        const framerRow = page.locator('#group-framers-editor [data-leader-row]').last();
        await framerRow.locator('.leader-title').fill('Project Framer');
        await framerRow.locator('.leader-search').fill(framer.username);
        await expect(framerRow.locator('.leader-suggestions')).toBeVisible();
        await framerRow.locator('.leader-suggestion-btn').first().click();
        await expect(framerRow.locator('.leader-user-id')).not.toHaveValue('');
        await page.click('#group-submit-button');

        await expect(page).toHaveURL(groupUrl);
        await expect(page.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com/website');
        await expect(page.locator('.event-leaders h3')).toHaveText('Project Framers');
        await expect(page.locator('.group-framers-inline li.title-person-line')).toContainText('Project Framer');
        await expect(page.locator('.group-framers-inline li a')).toContainText(framer.name);
        await expect(page.locator('.title-person-line').filter({ hasText: 'Group Leader' })).toBeVisible();

        await page.click('button.edit-button');
        await expect(page.locator('#uppercaseTitle')).toHaveValue('GOLD TIER');
        await expect(page.locator('#lowercaseTitle')).toHaveValue('STANDARD');
        await expect(page.locator('#numericTitle')).toHaveValue('DIGIT ACCOUNTS');
        await expect(page.locator('.leader-title')).toHaveValue('Project Framer');
        await expect(page.locator('.leader-user-id')).not.toHaveValue('');
    });

    test('private group shows gate to strangers with join option when logged in', async ({ page, browser }) => {
        const owner = userCreds('pg');
        await register(page, owner);
        await login(page, owner);

        await page.goto('/create-group');
        await page.fill('#group-name', `Private Group ${unique}`);
        await page.fill('#description', 'Secret group body');
        await page.selectOption('#visibility', 'private');
        await page.fill('#privateDescription', 'Inner circle note');
        await page.click('#group-submit-button');
        await expect(page).toHaveURL(/\/groups\//);
        const groupUrl = page.url();
        await expect(page.locator('.visibility-badge')).toContainText('Private');

        const strangerCtx = await browser.newContext();
        const stranger = await strangerCtx.newPage();
        await stranger.goto(groupUrl);
        await expect(stranger.locator('.private-entity')).toContainText('This group is private');
        await expect(stranger.locator('.join-button')).toHaveCount(0);

        const joiner = userCreds('jn');
        await register(stranger, joiner);
        await login(stranger, joiner);
        await stranger.goto(groupUrl);
        await expect(stranger.locator('.private-entity')).toContainText('This group is private');
        await expect(stranger.locator('.join-button')).toBeVisible();
        await stranger.click('.join-button');
        await expect(stranger).toHaveURL(groupUrl);
        await expect(stranger.locator('h1')).toContainText(`Private Group ${unique}`);
        await expect(stranger.locator('.private-box')).toContainText('Inner circle note');

        await strangerCtx.close();
    });

    test('profile slideshow captions add, edit, clear, authorize, and preserve legacy slides', async ({ page, browser }) => {
        const owner = userCreds('pcap');
        const stranger = userCreds('pbad');
        await register(page, owner);
        await register(page, stranger);
        await login(page, owner);

        const ownerDoc = await findUserByUsername(owner.username);
        const ownerId = ownerDoc._id.toString();
        const objectSlideUrl = `https://example.com/${ownerId}/slideshow/profile-object-${unique}.jpg`;
        const legacySlideUrl = `https://example.com/${ownerId}/slideshow/profile-legacy-${unique}.jpg`;
        await withDb((db) =>
            db.collection('users').updateOne(
                { _id: ownerDoc._id },
                {
                    $set: {
                        slideshowImages: [
                            { url: objectSlideUrl, caption: 'Initial profile caption' },
                            legacySlideUrl,
                        ],
                    },
                }
            )
        );

        await page.goto(`/users/${ownerId}`);
        await expect(page.locator('.gallery-item')).toHaveCount(2);
        await expect(page.locator('.gallery-caption').nth(0)).toContainText('Initial profile caption');
        await expect(page.locator('.gallery-caption').nth(1)).toContainText(`profile legacy ${unique}`);

        let result = await patchCaption(page, { imageUrl: objectSlideUrl, caption: 'Owner added caption' });
        expect(result.ok).toBeTruthy();
        await page.reload();
        await expect(page.locator('.gallery-caption-input').nth(0)).toHaveValue('Owner added caption');
        await expect(page.locator('.gallery-caption').nth(0)).toContainText('Owner added caption');

        result = await patchCaption(page, { imageUrl: objectSlideUrl, caption: 'Owner edited caption' });
        expect(result.ok).toBeTruthy();
        await page.reload();
        await expect(page.locator('.gallery-caption-input').nth(0)).toHaveValue('Owner edited caption');
        await expect(page.locator('.gallery-caption').nth(0)).toContainText('Owner edited caption');

        result = await patchCaption(page, { imageUrl: objectSlideUrl, caption: '' });
        expect(result.ok).toBeTruthy();
        await page.reload();
        await expect(page.locator('.gallery-caption-input').nth(0)).toHaveValue('');
        await expect(page.locator('.gallery-caption').nth(0)).not.toContainText('profile-object');

        result = await patchCaption(page, { imageUrl: legacySlideUrl, caption: 'Legacy converted caption' });
        expect(result.ok).toBeTruthy();
        const savedOwner = await withDb((db) => db.collection('users').findOne({ _id: ownerDoc._id }));
        expect(savedOwner.slideshowImages.map((slide) => (typeof slide === 'string' ? slide : slide.url))).toEqual([
            objectSlideUrl,
            legacySlideUrl,
        ]);
        expect(savedOwner.slideshowImages[1]).toEqual({ url: legacySlideUrl, caption: 'Legacy converted caption' });

        const strangerContext = await browser.newContext();
        const strangerPage = await strangerContext.newPage();
        await login(strangerPage, stranger);
        const denied = await patchCaption(strangerPage, { imageUrl: objectSlideUrl, caption: 'Bad edit' });
        expect(denied.ok).toBeFalsy();
        expect([400, 403, 404]).toContain(denied.status);
        const afterDenied = await withDb((db) => db.collection('users').findOne({ _id: ownerDoc._id }));
        expect(afterDenied.slideshowImages[0].caption).toBe('');
        await strangerContext.close();
    });

    test('group slideshow captions clear, authorize, preserve privacy, and navigate', async ({ page, browser }) => {
        test.setTimeout(120_000);

        const leader = userCreds('gcap');
        const member = userCreds('gmem');
        const outsider = userCreds('gout');
        const admin = userCreds('gadm');
        await register(page, leader);
        await register(page, member);
        await register(page, outsider);
        await register(page, admin);
        await login(page, leader);

        await page.goto('/create-group');
        const groupName = `Caption Group ${unique}`;
        await page.fill('#group-name', groupName);
        await page.fill('#description', 'Caption test group');
        await page.selectOption('#visibility', 'public');
        await page.click('#group-submit-button');
        await expect(page).toHaveURL(/\/groups\//);
        const groupUrl = page.url();
        const groupId = groupUrl.split('/').pop();

        const leaderDoc = await findUserByUsername(leader.username);
        const memberDoc = await findUserByUsername(member.username);
        const adminDoc = await findUserByUsername(admin.username);
        const slideA = `https://example.com/${groupId}/slideshow/group-a-${unique}.jpg`;
        const slideB = `https://example.com/${groupId}/slideshow/group-b-${unique}.jpg`;
        const legacySlide = `https://example.com/${groupId}/slideshow/group-legacy-${unique}.jpg`;

        await withDb(async (db) => {
            await db.collection('users').updateOne({ _id: adminDoc._id }, { $set: { isAdmin: true, admin: true } });
            await db.collection('groups').updateOne(
                { groupName },
                {
                    $set: {
                        players: [leaderDoc._id.toString(), memberDoc._id.toString()],
                        slideshowImages: [
                            { url: slideA, caption: 'First group caption' },
                            { url: slideB, caption: 'Second group caption' },
                            legacySlide,
                        ],
                    },
                }
            );
        });

        await page.goto(groupUrl);
        await expect(page.locator('.picture-slider-slide')).toHaveCount(3);
        await expect(page.locator('.picture-slider-caption').first()).toContainText('First group caption');
        await expect(page.locator('.picture-slider-caption').nth(1)).toContainText('Second group caption');
        await expect(page.locator('.picture-slider-caption').nth(2)).toContainText(`group legacy ${unique}`);
        await page.locator('.picture-slider-next').click();
        await expect(page.locator('.picture-slider-slide').nth(1)).toHaveClass(/is-active/);

        let result = await patchCaption(page, { groupId, imageUrl: slideA, caption: 'Leader added caption' });
        expect(result.ok).toBeTruthy();
        result = await patchCaption(page, { groupId, imageUrl: slideA, caption: 'Leader edited caption' });
        expect(result.ok).toBeTruthy();
        await page.reload();
        await expect(page.locator('.gallery-caption-input').first()).toHaveValue('Leader edited caption');

        result = await patchCaption(page, { groupId, imageUrl: slideA, caption: '' });
        expect(result.ok).toBeTruthy();
        await page.reload();
        await expect(page.locator('.gallery-caption-input').first()).toHaveValue('');
        await expect(page.locator('.picture-slider-caption').first()).not.toContainText('group-a');

        const memberContext = await browser.newContext();
        const memberPage = await memberContext.newPage();
        await login(memberPage, member);
        const memberDenied = await patchCaption(memberPage, { groupId, imageUrl: slideB, caption: 'Member edit' });
        expect(memberDenied.ok).toBeFalsy();
        expect(memberDenied.status).toBe(403);
        await memberContext.close();

        const outsiderContext = await browser.newContext();
        const outsiderPage = await outsiderContext.newPage();
        await login(outsiderPage, outsider);
        const outsiderDenied = await patchCaption(outsiderPage, { groupId, imageUrl: slideB, caption: 'Outsider edit' });
        expect(outsiderDenied.ok).toBeFalsy();
        expect(outsiderDenied.status).toBe(403);
        await outsiderContext.close();

        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await login(adminPage, admin);
        const adminResult = await patchCaption(adminPage, { groupId, imageUrl: slideB, caption: 'Admin caption' });
        expect(adminResult.ok).toBeTruthy();
        await adminContext.close();

        await withDb((db) =>
            db.collection('groups').updateOne(
                { groupName },
                {
                    $set: {
                        visibility: 'private',
                        slideshowImages: [{ url: slideA, caption: 'Private caption' }],
                    },
                }
            )
        );
        const privateContext = await browser.newContext();
        const privatePage = await privateContext.newPage();
        await privatePage.goto(groupUrl);
        await expect(privatePage.locator('.private-entity')).toContainText('This group is private');
        await expect(privatePage.locator('.picture-slider')).toHaveCount(0);
        await privateContext.close();

        await page.goto(groupUrl);
        await expect(page.locator('.picture-slider-slide')).toHaveCount(1);
        await expect(page.locator('.picture-slider-caption').first()).toContainText('Private caption');

        await withDb((db) => db.collection('groups').updateOne({ groupName }, { $set: { slideshowImages: [] } }));
        await page.reload();
        await expect(page.locator('.picture-slider-slide')).toHaveCount(0);
        await expect(page.locator('.group-slideshow-empty')).toBeVisible();
    });

    test('caption validation is enforced server-side', async ({ page }) => {
        const user = userCreds('vcap');
        await register(page, user);
        await login(page, user);
        const userDoc = await findUserByUsername(user.username);
        const userId = userDoc._id.toString();
        const slideUrl = `https://example.com/${userId}/slideshow/validation-${unique}.jpg`;
        await withDb((db) =>
            db.collection('users').updateOne(
                { _id: userDoc._id },
                { $set: { slideshowImages: [{ url: slideUrl, caption: 'Initial' }] } }
            )
        );

        let result = await patchCaption(page, { imageUrl: slideUrl, caption: ''.padEnd(200, 'a') });
        expect(result.ok).toBeTruthy();
        result = await patchCaption(page, { imageUrl: slideUrl, caption: ''.padEnd(201, 'b') });
        expect(result.ok).toBeFalsy();
        expect(result.status).toBe(400);
        result = await patchCaption(page, { imageUrl: slideUrl, caption: '<script>alert("x")</script>' });
        expect(result.ok).toBeTruthy();
        result = await patchCaption(page, { imageUrl: slideUrl, caption: '   ' });
        expect(result.ok).toBeTruthy();

        const saved = await withDb((db) => db.collection('users').findOne({ _id: userDoc._id }));
        expect(saved.slideshowImages[0].caption).toBe('');
    });

    test('admin can save a caption on the events page slideshow', async ({ page }) => {
        const admin = userCreds('eadm');
        await register(page, admin);

        const slideUrl = `https://example.com/e2e-events-slide-${unique}.jpg`;
        await withDb(async (db) => {
            await db.collection('users').updateOne(
                { username: admin.username },
                { $set: { isAdmin: true, admin: true } }
            );
            await db.collection('media').updateOne(
                { title: 'Event Page Slideshow' },
                {
                    $set: {
                        title: 'Event Page Slideshow',
                        slideshowImages: [{ url: slideUrl, caption: 'Old events caption' }],
                    },
                },
                { upsert: true }
            );
        });

        await login(page, admin);
        await page.goto('/events');
        await expect(page.locator('#is-event-page')).toHaveCount(1);
        await expect(page.locator('.slider-caption-editor')).toBeVisible();

        const captionInput = page.locator('.gallery-caption-edit').first().locator('.gallery-caption-input');
        const saveBtn = page.locator('.gallery-caption-edit').first().locator('.gallery-caption-save');
        await expect(captionInput).toBeVisible();
        await captionInput.fill(`Events caption ${unique}`);
        await saveBtn.click();

        await expect(page.locator('#message-label')).toContainText('Caption saved');
        await expect(page.locator('#error-label')).toBeHidden();
        await expect(page.locator('.picture-slider-caption').first()).toContainText(`Events caption ${unique}`);

        await page.reload();
        await expect(page.locator('.gallery-caption-input').first()).toHaveValue(`Events caption ${unique}`);
        await expect(page.locator('.picture-slider-caption').first()).toContainText(`Events caption ${unique}`);
    });
});

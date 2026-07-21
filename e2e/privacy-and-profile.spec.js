import { test, expect } from '@playwright/test';

const password = 'Family1$';
const unique = Date.now().toString(36);

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

test.describe('RIC3Fam Hub e2e', () => {
    test('home and events pages load', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('header')).toContainText('Events');

        await page.goto('/events');
        await expect(page.locator('.events-page-title')).toHaveText('EVENTS');
        await expect(page.locator('.list-header').first()).toHaveText('UPCOMING EVENTS');
        await expect(page.locator('script[src="/public/js/pictureSlider.js"]')).toHaveCount(1);
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
        await expect(page.locator('.profile-statement')).toContainText('Artist statement for e2e');
        await expect(page.locator('.description-box').first()).toContainText('More about me');
        await expect(page.getByRole('link', { name: 'My Website' })).toHaveAttribute('href', 'https://example.com');
        await expect(page.getByRole('link', { name: 'Social' })).toHaveAttribute('href', 'https://social.example.com/me');
        await expect(page.locator('.private-box .description-box')).toContainText('Family-only secrets');
        await expect(page.locator('h3', { hasText: 'Private Communications' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Events' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Family' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Groups' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Picture Bar' })).toHaveCount(0);
        await expect(page.locator('h3', { hasText: 'Skills' })).toHaveCount(0);
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
        await expect(page.locator('.private-box')).toContainText('Only family sees this');

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
        await expect(page.locator('script[src="/public/js/pictureSlider.js"]')).toHaveCount(1);
        await expect(page.locator('#slideshow-form')).toBeVisible();
        await expect(page.locator('#group-slideshow-id')).toHaveCount(1);
    });

    test('group links, project framer, section titles, and circular image', async ({ page }) => {
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
            .toBe('50%');
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
        await expect(page.locator('.group-framers-inline li')).toContainText('Project Framer');
        await expect(page.locator('.group-framers-inline li a')).toContainText(framer.name);

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
});

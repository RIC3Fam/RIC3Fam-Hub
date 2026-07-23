import { test, expect } from '@playwright/test';

/**
 * Layout e2e for the picture gallery masonry CSS.
 * Uses a public fixture that mirrors views/showSlideshow.handlebars markup
 * and the live /public/css/styles.css (no Mongo / uploads required).
 */

test.describe('Gallery masonry layout', () => {
    test('uses CSS multi-column masonry and packs uneven heights', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 900 });
        await page.goto('/public/gallery-masonry-fixture.html');

        const grid = page.locator('.gallery-grid.gallery-masonry');
        await expect(grid).toBeVisible();
        await expect(page.locator('.gallery-item')).toHaveCount(6);

        await page.waitForFunction(() => {
            const imgs = [...document.querySelectorAll('.gallery-image')];
            return imgs.length === 6 && imgs.every((img) => img.getBoundingClientRect().height > 40);
        });

        const layout = await page.evaluate(() => {
            const gridEl = document.querySelector('.gallery-grid');
            const style = getComputedStyle(gridEl);
            const items = [...document.querySelectorAll('.gallery-item')].map((el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
            });
            const images = [...document.querySelectorAll('.gallery-image')].map((img) => {
                const cs = getComputedStyle(img);
                const r = img.getBoundingClientRect();
                return {
                    objectFit: cs.objectFit,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    renderedWidth: r.width,
                    renderedHeight: r.height,
                };
            });

            const sumHeights = items.reduce((s, i) => s + i.height, 0);
            const gridHeight = gridEl.getBoundingClientRect().height;

            const gaps = [];
            for (let i = 0; i < items.length; i++) {
                for (let j = 0; j < items.length; j++) {
                    if (i === j) continue;
                    const a = items[i];
                    const b = items[j];
                    const aMid = (a.left + a.right) / 2;
                    const bMid = (b.left + b.right) / 2;
                    if (Math.abs(aMid - bMid) > 40) continue;
                    if (b.top >= a.bottom - 1) gaps.push(b.top - a.bottom);
                }
            }

            return {
                display: style.display,
                columnCount: style.columnCount,
                columnGap: style.columnGap,
                gridTemplateColumns: style.gridTemplateColumns,
                sumHeights,
                gridHeight,
                gaps,
                images,
            };
        });

        expect(layout.display).toBe('block');
        expect(layout.gridTemplateColumns === 'none' || layout.gridTemplateColumns === '').toBeTruthy();
        expect(Number(layout.columnCount)).toBeGreaterThanOrEqual(2);
        expect(layout.columnGap).toBe('12px');
        expect(layout.gridHeight).toBeLessThan(layout.sumHeights * 0.75);

        expect(layout.gaps.length).toBeGreaterThan(0);
        for (const gap of layout.gaps) {
            expect(gap).toBeGreaterThanOrEqual(8);
            expect(gap).toBeLessThanOrEqual(20);
        }

        for (const img of layout.images) {
            expect(img.objectFit).toBe('contain');
            expect(img.naturalWidth).toBeGreaterThan(0);
            expect(img.naturalHeight).toBeGreaterThan(0);
            const expectedRatio = img.naturalWidth / img.naturalHeight;
            const renderedRatio = img.renderedWidth / img.renderedHeight;
            expect(Math.abs(expectedRatio - renderedRatio)).toBeLessThan(0.08);
        }
    });

    test('collapses to one column on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/public/gallery-masonry-fixture.html');

        await expect(page.locator('.gallery-item')).toHaveCount(6);
        const columnCount = await page.locator('.gallery-grid').evaluate(
            (el) => getComputedStyle(el).columnCount
        );
        expect(columnCount).toBe('1');
    });
});

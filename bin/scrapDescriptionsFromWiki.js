#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { compressJSON, DATA_PATH } from './common.js';

const DATABASE_PATH = join(import.meta.dirname, '../public/db.json');
const db = JSON.parse(readFileSync(DATABASE_PATH, 'utf-8'));

const DATABASE_DESCRIPTIONS_PATH = join(DATA_PATH, 'db-descriptions.bin');
const descriptions = {};

chromium.use(StealthPlugin());
chromium.launch({
    headless: false,
    args: [
        '-disable-blink-features=AutomationControlled',
        '-disable-dev-shm-usage',
        '-no-sandbox',
        '-disable-setuid-sandbox',
        '-disable-web-security',
        '-disable-features=IsolateOrigins,site-per-process'
    ]
}).then(async (browser) => {
    const context = await browser.newContext({
        javaScriptEnabled: true,
        acceptDownloads: true,
        ignoreHTTPSErrors: false
    });

    let processing = 1;
    const total = Object.keys(db).length;

    for (const id in db) {
        const entry = db[id];

        console.log(`Processing "${id}" (${processing}/${total})`);
        let page;

        try {
            page = await context.newPage();
            await page.goto(entry.link);
            await new Promise((resolve) => {
                const interval = setInterval(async () => {
                    const cloudflareTitle = await page.title();
                    if (cloudflareTitle !== 'Just a moment...') {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100)
            });

            const paragraph = (await page.locator('#mw-content-text section>p:first-of-type')
                .first()
                .innerText())
                .replace(/\[(note\s)?\d+\]/g, '')
                .trim();

            descriptions[id] = paragraph;
        } catch (error) {
            console.error(`Error on "${id}": `, error);
        }

        processing++;
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
        await page.close();
    }
    await browser.close();

    compressJSON(DATABASE_DESCRIPTIONS_PATH, descriptions);
});

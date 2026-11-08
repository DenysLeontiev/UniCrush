import * as cheerio from 'cheerio'
import { createInstitute, type Institute } from './models/Institute.js';
import { createDepartment, type Department } from './models/Department.js';
import { createWorker, type Worker } from './models/Worker.js';
import { rename, writeFile } from 'fs/promises';

// Usage: node dist/index.js [outputFile]   (default: output.json)
// Writes the file only if every page was fetched successfully, so a flaky run never
// replaces a good teacher list with a partial one. Exit code 1 on failure.

const nulpUrl: string = "https://lpnu.ua";
const institutesUrl: string = "https://lpnu.ua/institutes";

const workersPageHref: string = '/kolektyv-pratsivnykiv-kafedry';

const outputFile: string = process.argv[2] ?? 'output.json';

const maxAttempts: number = 3;

const institutes: Institute[] = [];
const departments: Department[] = [];
const workers: Worker[] = [];
const failures: string[] = [];
const skipped: string[] = [];

await main();

async function main() {
    const startedAt = Date.now();

    await fetchInstitutes();
    console.log(`Institutes: ${institutes.length}`);

    await fetchCafedras(institutes);
    console.log(`Departments: ${departments.length}`);

    await fetchWorkers(departments);
    console.log(`Workers (rows): ${workers.length}`);
    if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} units without a staff page (404), e.g. labs/centres.`);
    }

    if (failures.length > 0 || institutes.length === 0 || departments.length === 0 || workers.length === 0) {
        console.error(`Scraping failed, ${outputFile} was NOT written. Failed pages:`);
        failures.forEach(f => console.error(`  - ${f}`));
        process.exit(1);
    }

    // Write to a temp file first and rename, so readers never see a half-written file.
    const tempFile = `${outputFile}.tmp`;
    await writeFile(tempFile, JSON.stringify(workers));
    await rename(tempFile, outputFile);

    console.log(`Done in ${Math.round((Date.now() - startedAt) / 1000)}s -> ${outputFile}`);
}

/**
 * Fetches and parses a page, retrying network errors / 5xx.
 * With `optional`, a 404 means "this unit has no such page" (labs, centres) and is not a failure.
 */
async function loadPage(url: string, optional: boolean = false): Promise<cheerio.CheerioAPI | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url);

            if (response.status === 404 && optional) {
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return cheerio.load(await response.text());
        } catch (error) {
            console.warn(`Attempt ${attempt}/${maxAttempts} failed for ${url}: ${(error as Error).message}`);

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    failures.push(url);
    return null;
}

async function fetchInstitutes() {
    const $ = await loadPage(institutesUrl);
    if (!$) return;

    $('.item-list').each((i: number, element: any) => {

        const $itemList = $(element);

        const insituteName: string = $itemList.find('h3').text().trim()
        const instituteHref: string | undefined = $itemList.find('a').attr('href');

        if (!insituteName || !instituteHref) return;

        const fullInstituteHref: string = `${nulpUrl}${instituteHref}`;

        institutes.push(createInstitute(insituteName, fullInstituteHref));
    });
}

async function fetchCafedras(institutes: Institute[]) {

    for (const institute of institutes) {
        const $ = await loadPage(institute.href);
        if (!$) continue;

        $('.item-list > ul > li > div > div > a').each((i: number, element: any) => {

            const href: string = ($(element).attr('href') ?? '').trim();
            if (!href) return;

            const fullName: string = $(element).clone().children('strong').remove().end().text().trim();
            const shortName: string = $(element).find('strong').text();
            const fullWorkersPageHref: string = `${href}${workersPageHref}`;

            departments.push(createDepartment(institute, href, fullName, shortName, fullWorkersPageHref));
        });
    }
}

/** Collapses stray line breaks / double spaces from the HTML. */
function clean(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/** Looks for the staff ("Колектив") link on the department's own page. */
async function findStaffPageUrl(departmentHref: string): Promise<string | null> {
    const $ = await loadPage(departmentHref, true);
    if (!$) return null;

    const href = $(`a[href*="${workersPageHref.slice(1)}"]`).first().attr('href');
    return href ? new URL(href, nulpUrl).toString() : null;
}

async function fetchWorkers(departments: Department[]) {

    for (const department of departments) {
        let $ = await loadPage(department.workersPageHref, true);

        if (!$) {
            // The conventional URL is gone: follow the department's own "Колектив" link
            // (lpnu.ua sometimes moves it, e.g. /fv//kolektyv-pratsivnykiv-kafedry).
            const staffUrl = await findStaffPageUrl(department.href);
            if (staffUrl && staffUrl !== department.workersPageHref) {
                console.log(`Staff page moved: ${department.workersPageHref} -> ${staffUrl}`);
                department.workersPageHref = staffUrl;
                $ = await loadPage(staffUrl, true);
            }
        }

        if (!$) {
            skipped.push(department.href);
            continue;
        }

        $('.field-content').each((i: number, element: any) => {

            const workerImage: string | undefined = $(element).find('.dep_staff_photo').attr('src');
            const workerFullName: string = clean($(element).find('.dep_staff_info > h3').text());
            const workerPosition: string = clean($(element).find('.dep_staff_infod').text());
            const workerPersonalPageHref: string = $(element).find('.dep_staff_info > h3 > a').attr('href') ?? '';

            if (workerImage && workerFullName) {
                const fullWorkerImage: string = `${nulpUrl}${workerImage}`;
                workers.push(createWorker(fullWorkerImage, workerFullName, workerPosition, workerPersonalPageHref, department));
            }
        });
    }
}

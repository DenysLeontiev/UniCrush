import * as cheerio from 'cheerio';
import { createInstitute } from './models/Institute.js';
import { createDepartment } from './models/Department.js';
import { createWorker } from './models/Worker.js';
import { writeFile } from 'fs/promises';
const nulpUrl = "https://lpnu.ua";
const institutesUrl = "https://lpnu.ua/institutes";
const workersPageHref = '/kolektyv-pratsivnykiv-kafedry';
const fileName = 'ouput1.json';
const institutes = [];
const departments = [];
const workers = [];
let $;
await main();
async function main() {
    await fetchInstitutes();
    await fetchCafedras(institutes);
    await fetchWorkers(departments);
    const json = JSON.stringify(workers);
    await writeFile(fileName, json);
}
async function fetchInstitutes() {
    try {
        const response = await fetch(institutesUrl);
        const html = await response.text();
        $ = cheerio.load(html);
        $('.item-list').each((i, element) => {
            const $itemList = $(element);
            const insituteName = $itemList.find('h3').text().trim();
            const instituteHref = $itemList.find('a').attr('href');
            const fullInstituteHref = `${nulpUrl}${instituteHref}`;
            institutes.push(createInstitute(insituteName, fullInstituteHref));
        });
    }
    catch (err) {
        console.error(err);
    }
}
async function fetchCafedras(institutes) {
    for (let i = 0; i < institutes.length; i++) {
        let institute = institutes[i];
        try {
            const response = await fetch(`${institute.href}`);
            const html = await response.text();
            $ = cheerio.load(html);
            $('.item-list > ul > li > div > div > a').each((i, element) => {
                const href = $(element).attr('href').trim();
                const fullName = $(element).clone().children('strong').remove().end().text().trim();
                const shortName = $(element).find('strong').text();
                const fullWorkersPageHref = `${href}${workersPageHref}`;
                departments.push(createDepartment(institute, href, fullName, shortName, fullWorkersPageHref));
            });
        }
        catch (error) {
            console.log(error);
        }
    }
}
async function fetchWorkers(departments) {
    for (let i = 0; i < departments.length; i++) {
        const department = departments[i];
        const workersUrl = `${department.workersPageHref}`;
        try {
            const response = await fetch(workersUrl);
            const html = await response.text();
            $ = cheerio.load(html);
            $('.field-content').each((i, element) => {
                const workerImage = $(element).find('.dep_staff_photo').attr('src');
                const workerFullName = $(element).find('.dep_staff_info > h3').text().trim();
                const workerPosition = $(element).find('.dep_staff_infod').text().trim();
                const workerPersonalPageHref = $(element).find('.dep_staff_info > h3 > a').attr('href');
                const fullWorkerImage = `${nulpUrl}${workerImage}`;
                if (workerImage && workerFullName) {
                    workers.push(createWorker(fullWorkerImage, workerFullName, workerPosition, workerPersonalPageHref, department));
                }
            });
        }
        catch (error) {
            console.log(error);
        }
    }
}
//# sourceMappingURL=index.js.map
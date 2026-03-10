import fs from 'fs';

const data = JSON.parse(fs.readFileSync('wise_collection.json', 'utf8'));

function getUrls(items) {
    for (const item of items) {
        if (item.item) {
            getUrls(item.item);
        } else {
            const url = item.request?.url?.raw || item.request?.url;
            if (url && (url.toLowerCase().includes('attendance') || url.toLowerCase().includes('insight'))) {
                console.log(`[${item.name}] URL: ${url}`);
            }
        }
    }
}

getUrls(data.item);

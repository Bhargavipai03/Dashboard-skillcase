import fs from 'fs';

const data = JSON.parse(fs.readFileSync('wise_collection.json', 'utf8'));

function findReq(items) {
    for (let item of items) {
        if (item.item) {
            findReq(item.item);
        } else {
            let name = item.name || '';
            let url = item.request?.url?.raw || item.request?.url;
            console.log(`[${name}] ${url}`);
        }
    }
}
findReq(data.item || []);

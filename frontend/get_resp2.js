import fs from 'fs';

const data = JSON.parse(fs.readFileSync('wise_collection.json', 'utf8'));

function findReq(items) {
    for (let item of items) {
        if (item.item) {
            findReq(item.item);
        } else {
            let name = item.name || '';
            if (name.toLowerCase().includes('raw attendance')) {
                console.log("FOUND:", name);
                for (let resp of (item.response || [])) {
                    console.log("RESPONSE BODY:");
                    console.log(resp.body);
                }
            }
        }
    }
}
findReq(data.item || []);

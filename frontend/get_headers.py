import json

try:
    with open('wise_collection.json') as f:
        data = json.load(f)

    def get_items(items):
        for i in items:
            if 'item' in i:
                get_items(i['item'])
            else:
                req = i.get('request', {})
                headers = req.get('header', [])
                if headers:
                    print(f"[{i.get('name')}] Headers: {headers}")

    get_items(data.get('item', []))
except Exception as e:
    print(e)

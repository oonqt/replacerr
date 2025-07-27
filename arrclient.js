const axios = require('axios');

class ArrClient {
    constructor(url, key) {
        this.appBase = `${url}/api/v3`;
        this.apiKey = key;
    }

    request(route, method, query) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.appBase}/${route}`);

            url.searchParams.append('apiKey', this.apiKey);

            if (query) query.forEach(param => url.searchParams.append(param.name, param.value));

            axios({
                url,
                method: method || 'GET'
            })
                .then(res => resolve(res.data))
                .catch(reject);
        });
    }
}


module.exports = ArrClient;
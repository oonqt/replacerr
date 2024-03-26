const { qBittorrentClient } = require('@robertklep/qbittorrent');
const axios = require('axios');
const qbit = new qBittorrentClient(process.env.QBIT_URL, process.env.QBIT_USER, process.env.QBIT_PASS);

const check = async () => {
    log('Checking...');

    let torrents = await qbit.torrents.info();
    let movies = await radarrRequest('queue/details');
    let episodes = await sonarrRequest('queue/details');

    for (episode of episodes) {
        let torrent = torrents.filter(torrent => {
            return episode.downloadId.toLowerCase() === torrent.hash;
        });

        if (torrent) {

        }
    }

    for (movie of movies) {
        let torrent = torrents.filter(torrent => {
            return movie.downloadId.toLowerCase() === torrent.hash;
        });

        if (torrent) {
            console.log(torrent);    
        }
    }
}

const log = msg => console.log(`${new Date().toISOString()}: ${msg}`);

const radarrRequest = async (route, method, query, body) => {
    const url = new URL(`${process.env.RADARR_URL}/api/v3/${route}`);

    if (query) query.forEach(param => url.searchParams.append(param.name, param.value));

    url.searchParams.append('apikey', process.env.RADARR_API_KEY);

    let res = await axios({
        url,
        method: method || 'GET',
        body: body || null
    });

    return res.data;
}

const sonarrRequest = async (route, method, query, body) => {
    const url = new URL(`${process.env.SONARR_URL}/api/v3/${route}`);

    if (query) query.forEach(param => url.searchParams.append(param.name, param.value));

    url.searchParams.append('apikey', process.env.SONARR_API_KEY);

    let res = await axios({
        url,
        method: method || 'GET',
        body: body || null
    });

    return res.data;
}

log('Starting application...');

setInterval(check, process.env.CHECK_INTERVAL_SECONDS * 1000);

check();
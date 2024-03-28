const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Webhook } = require('discord-webhook-node');
const axios = require('axios');

const hook = new Webhook(process.env.DISCORD_WEBHOOK);

const check = async () => {
    log('Checking...');
    
    try {
        let qbit = new qBittorrentClient(process.env.QBIT_URL, process.env.QBIT_USER, process.env.QBIT_PASS);

        let torrents = await qbit.torrents.info();
        let movies = await radarrRequest('queue/details');
        let episodes = await sonarrRequest('queue/details');

        movies.forEach(movie => movie.type = 'movie');
        episodes.forEach(episode => episode.type = 'episode');

        let media = [...movies, ...episodes];

        for (item of media) {
            let torrent = torrents.filter(torrent => {
                return item.downloadId.toLowerCase() === torrent.hash;
            })[0];

            if (torrent) {
                log(`Identified torrent downloading ${item.title} with ID ${item.downloadId}`);

                if (((Date.now() / 1000) - torrent.seen_complete) > process.env.MAX_LAST_SEEN_SECONDS && torrent.downloaded === 0) {
                    log(`Removing ${torrent.content_path}, type: ${item.type}`);

                    if (item.type === 'movie') {
                        await radarrRequest(`queue/${item.id}`, 'DELETE', [{ name: 'blocklist', value: true }]);
                    } else if (item.type === 'episode') {
                        await sonarrRequest(`queue/${item.id}`, 'DELETE', [{ name: 'blocklist', value: true }]);
                    }

                    hook.send(`Removed ${item.title}. A search for a replacement has been started`).catch(log);
                    
                    log('Successfully removed from sonarr. A search has been started and a replacement should begin downloading shortly');
                }
            }
        }
    } catch (err) {
        log(err);
    }

    setTimeout(check, process.env.CHECK_INTERVAL_SECONDS * 1000);
}

const log = (...msg) => console.log(new Date().toISOString(), ...msg);

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

check();
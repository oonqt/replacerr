const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Webhook } = require('discord-webhook-node');
const axios = require('axios');

const hook = new Webhook(process.env.DISCORD_WEBHOOK);

const check = async () => {
    log('Checking...');

    try {
        const qbit = new qBittorrentClient(process.env.QBIT_URL, process.env.QBIT_USER, process.env.QBIT_PASS);
        const radarr = new ArrClient(process.env.RADARR_URL, process.env.RADARR_API_KEY);
        const sonarr = new ArrClient(process.env.SONARR_URL, process.env.SONARR_API_KEY);

        const [torrents, movieQueue, episodeQueue] = await Promise.all(qbit.torrents.info(), radarr.request('/queue/details'), sonarr.request('/queue/details'));
        movieQueue.forEach(movie => movie.type = 'movie');
        episodeQueue.forEach(episode => episode.type = 'episode');
        const globalQueue = [...movieQueue, ...episodeQueue];

        for (item of globalQueue) {
            let torrent = torrents.filter(torrent => {
                return item.downloadId.toLowerCase() === torrent.hash;
            })[0];

            log(torrent);

            if (torrent) {
                log(`Identified torrent downloading ${item.title} with ID ${item.downloadId}`);

                hook.send(`Removed ${item.title}. It was added ${new Date(torrent.added_on).toLocaleString()}, but never became seen. A search for a replacement has been started`).catch(log);

                if (((Date.now() / 1000) - torrent.seen_complete) > process.env.MAX_LAST_SEEN_SECONDS && torrent.downloaded === 0) {
                    log(`Removing ${torrent.content_path}, type: ${item.type}`);

                    if (item.type === 'movie') {
                        await radarrRequest(`queue/${item.id}`, 'DELETE', [{ name: 'blocklist', value: true }]);
                    } else if (item.type === 'episode') {
                        await sonarrRequest(`queue/${item.id}`, 'DELETE', [{ name: 'blocklist', value: true }]);
                    }

                    log('Successfully removed from sonarr. A search has been started and a replacement should begin downloading shortly');
                }
            }
        }
    } catch (err) {
        log(err);
    }

    setTimeout(check, process.env.CHECK_INTERVAL_SECONDS * 1000);
}

class ArrClient {
    constructor(url, key) {
        this.appBase = `${url}/api/v3/`;
        this.apiKey = key;
    }

    request(route, method, query) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.base}/${route}`);

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

const log = (msg, webhookLog) => {
    console.log(new Date().toISOString(), ...msg);
    if (webhookLog) {
        hook.send(msg).catch(err => log(err));
    }
}

log('Starting application...');

check();
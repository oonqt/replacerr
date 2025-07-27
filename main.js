const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Webhook } = require('discord-webhook-node');
const { version } = require('./package.json');
const Logger = require('./logger');
const ArrClient = require('./arrclient');

require('dotenv').config();

const { QBIT_URL, DEBUG, QBIT_USER, QBIT_PASS, RADARR_URL, RADARR_API_KEY, SONARR_URL, SONARR_API_KEY, CHECK_INTERVAL, MAX_LAST_SEEN, DISCORD_WEBHOOK } = process.env;
const hook = new Webhook(process.env.DISCORD_WEBHOOK);
const log = new Logger(DEBUG);

const check = async () => {
    log.info('Checking list...');

    try {
        const qbit = new qBittorrentClient(QBIT_URL, QBIT_USER, QBIT_PASS);
        const radarr = new ArrClient(RADARR_URL, RADARR_API_KEY);
        const sonarr = new ArrClient(SONARR_URL, SONARR_API_KEY);

        const [torrents, movieQueue, episodeQueue] = await Promise.all([qbit.torrents.info(), radarr.request('queue/details'), sonarr.request('queue/details')]);
        movieQueue.forEach(movie => movie.type = 'movie');
        episodeQueue.forEach(episode => episode.type = 'episode');

        log.info(`Found ${movieQueue.length} movies and ${episodeQueue.length} episodes in the queue. Torrents found: ${torrents.length}`);

        const globalQueue = [...movieQueue, ...episodeQueue];

        for (item of globalQueue) {
            let torrent = torrents.find(torrent => {
                return item.downloadId.toLowerCase() === torrent.hash;
            });

            if (torrent) {
                log.info(`Identified torrent downloading for ${item.title} with ID ${item.downloadId}`);

                const epochMinutes = Date.now() / 1000 / 60;
                log.debug(epochMinutes - torrent.seen_complete);
                if ((epochMinutes - torrent.seen_complete) > MAX_LAST_SEEN) {
                    log(`Removing ${torrent.content_path}, type: ${item.type}`);
                    
                    const queryParams = [
                        { name: 'blocklist', value: true },
                        { name: 'removeFromClient', value: true },
                        { name: 'skipRedownload', value: false },
                        { name: 'changeCategory', value: false }
                    ];
                    
                    switch (item.type) {
                        case 'movie':
                            // await radarr.request(`queue/${item.id}`, 'DELETE', queryParams);
                            break;
                        case 'episode':
                            // await sonarr.request(`queue/${item.id}`, 'DELETE', queryParams);
                            break;  
                        }
                            
                    log('Successfully removed from sonarr. A search has been started and a replacement should begin downloading shortly');
                    hook.send(`Removed \`${item.title}\`. It was added \`${new Date(torrent.added_on).toLocaleString()}\`, but never became seen. The previous torrent has been blacklisted and a search for a replacement has started`).catch(log);
                }
            } else {
                log.error(`No torrent found for ${item.title} with ID ${item.downloadId}.`);
            }
        }
    } catch (err) {
        log.error(err);
    }

    setTimeout(check, CHECK_INTERVAL * 60000);
}

log.info(`Starting application... (Version: ${version})`);

check();
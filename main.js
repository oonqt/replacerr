const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Webhook } = require('discord-webhook-node');
const { version } = require('./package.json');
const Logger = require('./logger');
const ArrClient = require('./arrclient');

if (process.env.NODE_ENV === 'development') require('dotenv').config();

const { QBIT_URL, DEBUG, QBIT_USER, QBIT_PASS, RADARR_URL, RADARR_API_KEY, SONARR_URL, SONARR_API_KEY, CHECK_INTERVAL, MAX_LAST_SEEN, DISCORD_WEBHOOK, MAX_STRIKES } = process.env;

const hook = new Webhook(DISCORD_WEBHOOK);
const radarr = new ArrClient(RADARR_URL, RADARR_API_KEY);
const sonarr = new ArrClient(SONARR_URL, SONARR_API_KEY);
const log = new Logger(DEBUG);

const strikes = new Map();

const removeAndSearch = (type, id) => new Promise((resolve, reject) => {
    const queryParams = [
        { name: 'blocklist', value: true },
        { name: 'removeFromClient', value: true },
        { name: 'skipRedownload', value: false },
        { name: 'changeCategory', value: false }
    ];

    switch (type) {
        case 'movie':
            // radarr.request(`queue/${id}`, 'DELETE', queryParams).then(resolve).catch(reject);
            break;
        case 'episode':
            // sonarr.request(`queue/${id}`, 'DELETE', queryParams).then(resolve).catch(reject);
            break;
    }
});

const check = async () => {
    log.info('Checking list...');

    try {
        const qbit = new qBittorrentClient(QBIT_URL, QBIT_USER, QBIT_PASS);

        const [torrents, movieQueue, episodeQueue] = await Promise.all([qbit.torrents.info(), radarr.request('queue/details'), sonarr.request('queue/details')]);
        movieQueue.forEach(movie => movie.type = 'movie');
        episodeQueue.forEach(episode => episode.type = 'episode');

        log.info(`Found ${movieQueue.length} movies and ${episodeQueue.length} episodes in the queue. Torrents found: ${torrents.length}`);

        const globalQueue = [...movieQueue, ...episodeQueue];

        for (item of globalQueue) {
            let torrent = torrents.find(torrent => item.downloadId.toLowerCase() === torrent.hash);

            if (torrent) {
                const downloadId = torrent.downloadId;
                const lastSeenMinutes = ((Date.now() / 1000) - torrent.seen_complete) / 60;

                log.info(`Identified torrent downloading for ${item.title} with ID ${item.downloadId}`);

                if (torrent.downloaded = 0 && torrent.state !== 'downloading') {
                    const currentStrikes = strikes.get(item.downloadId) || 0;

                    if (currentStrikes >= MAX_STRIKES) {
                        log.info(`Removing stalled download for ${item.title} (${item.type}) due to ${currentStrikes} strikes.`);

                        
                        try {
                            await removeAndSearch(item.type, item.id);
                            strikes.delete(downloadId);
                            
                            log.info('Successfully removed. Torrent has been blacklisted and replacement search started.');
                            await hook.send(`Removed \`${item.title} (${item.type})\` It has been stalled for too long and has reached the maximum number of strikes (${MAX_STRIKES}). A replacement search has been started.`).catch(log.error);
                        } catch (err) {
                            log.error('Failed to remove stalled download:', err);
                            await hook.send(`❌ Failed to remove \`${item.title} (${item.type})\`. Deletion attempt will be made again during next check.`).catch(log.error);
                        }
                    } else {
                        strikes.set(item.downloadId, currentStrikes + 1);

                        log.info(`Stalled download for ${item.title} (${item.type}) has been given a strike. Current strikes: ${currentStrikes + 1}/${MAX_STRIKES}.`);
                    }
                } else if (lastSeenMinutes > MAX_LAST_SEEN) {
                    log.info(`Beginning removal of ${item.title} (${item.type}). Last seen complete reported ${Math.round(lastSeenMinutes / 60 / 60)} hours ago.`);

                    strikes.delete(downloadId);

                    try {
                        await removeAndSearch(item.type, item.id);

                        log.info('Successfully removed. Torrent has been blacklisted and replacement search started.');
                        await hook.send(`Removed \`${item.title} (${item.type})\` It was last seen complete ${Math.round(lastSeenMinutes / 60 / 60)} hours ago. A replacement search has been started.`).catch(log.error);
                    } catch (err) {
                        log.error('Failed to remove stalled download:', err);
                        await hook.send(`❌ Failed to remove \`${item.title} (${item.type})\`. Deletion attempt will be retried during next check.`).catch(log.error);
                    }
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
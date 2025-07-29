const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Webhook } = require('discord-webhook-node');
const { version } = require('./package.json');
const Logger = require('./logger');
const ArrClient = require('./arrclient');

if (process.env.NODE_ENV === 'development') require('dotenv').config();

const { QBIT_URL, 
    DEBUG, 
    QBIT_USER, 
    QBIT_PASS, 
    RADARR_URL, 
    RADARR_API_KEY, 
    SONARR_URL, 
    SONARR_API_KEY, 
    CHECK_INTERVAL, 
    MAX_LAST_SEEN, 
    DISCORD_WEBHOOK, 
    MAX_STRIKES 
} = process.env;

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
            log.info('pretend we deleted a movie');
            resolve();
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
            const downloadId = item.downloadId;
            let torrent = torrents.find(torrent => item.downloadId.toLowerCase() === torrent.hash);

            if (torrent) {
                const lastSeenMinutes = ((Date.now() / 1000) - torrent.seen_complete) / 60;
                const strikeData = strikes.get(downloadId) || { stalled: 0, fakePeer: 0, lastSize: 0 };

                log.info(`Identified torrent downloading for ${item.title} with ID ${item.downloadId}`);

                if (torrent.downloaded === 0) { // catch-all for stalled downloads. after this we will rely on last seen complete to determine if a torrent is stalled for good and remove it.
                    if (strikeData.stalled >= MAX_STRIKES) {
                        log.info(`Removing stalled download for ${item.title} (${item.type}) due to ${strikeData.stalled} strikes.`);
                        
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
                        strikeData.stalled++;
                        strikes.set(downloadId, strikeData);

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
                
                // for finding fake peers, we have to make sure the value we compare against lastSeen time is > than the maximum strikes * check interval (with 1 minute margin), a hard coded value could result in good torrents being removed if the check interval and max strike count multiplied together are lower than the hardcoded value
                if (lastSeenMinutes < ((MAX_STRIKES * CHECK_INTERVAL) + 1)) { 
                    if (torrent.downloaded > strikeData.lastSize) {
                        strikeData.fakePeer = 0;
                    } else { 
                        strikeData.fakePeer++;
                    }

                    strikeData.lastSize = torrent.downloaded;
                    strikes.set(downloadId, strikeData);

                    if (strikeData.fakePeer >= MAX_STRIKES) {
                        try {
                            await removeAndSearch(item.type, item.id);

                            strikes.delete(downloadId);
                            log.info('Successfully removed. Torrent has been blacklisted and replacement search started.');
                            await hook.send(`Removed \`${item.title} (${item.type})\` Fake peers advertising 100% availability were identified. A replacement search has been started.`).catch(log.error);
                        } catch (err) {
                            log.error('Failed to remove stalled download:', err);
                            await hook.send(`❌ Failed to remove \`${item.title} (${item.type})\`. Deletion attempt will be made again during next check.`).catch(log.error);
                        }
                    }
                }

                log.info(strikeData)
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
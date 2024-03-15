const { qBittorrentClient } = require('@robertklep/qbittorrent');
const { Radarr } = require('@jc21/radarr-api');
const { Sonarr } = require('@jc21/sonarr-api');

const log = msg => console.log(`${new Date().toISOString()}: ${msg}`);

const qbit = new qBittorrentClient(process.env.QBIT_URL, process.env.QBIT_USER, process.env.QBIT_PASS);
const sonarr = new Sonarr(process.env.SONARR_URL, process.env.SONARR_API_KEY);
const radarr = new Radarr(process.env.RADARR_URL, process.env.RADARR_API_KEY);

const check = async () => {
    log('Checking...');
}

log('Starting application...');

setInterval(check, process.env.CHECK_INTERVAL_SECONDS * 1000);
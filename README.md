# Replacerr
#### A stalled download remover for the servarr stack (currently supports Radarr, Sonarr, and qBittorrent)

#

### *Why not just use Declutarr or some other stalled download handler?*
None of the other options I came across actually take into account the last seen complete parameter. I found this to be an issue as there could be an instance where a partially-downloaded torrent stalls out because the only seeder with the complete torrent goes offline for a period of time (ex. shut their computer off for the night). With the other handlers, they will just end up removing & blocklisting the torrent, allowing no time for the seeder to come back online. With Replacerr, partially-downloaded stalled torrents will be given a grace period defined in `MAX_LAST_SEEN` to allow the seeder to come back online. Only torrents that have been completely stalled since they were added to the torrent client will be removed with a strike-based system.

### *How It Works*
* Download queue is polled on an interval defined in `CHECK_INTERVAL`
* All items within the download queue are inspected
    * Items that have been stalled since they were added to the download client will be given a strike, once the amount of strikes meets the value defined in `MAX_STRIKES`, the download is removed and a replacement search started
    * Items that have been partially downloaded, but stalled due to complete torrent not being available will be allowed a grace period to resume downloading that is defined in the `MAX_LAST_SEEN` value. The download will be removed and a replacement search initiated once the grace period ends.
* If a download is removed, a notification is sent to the Discord webhook defined in `DISCORD_WEBHOOK` containing details (OPTIONAL)

### *Future Features!*
* Support full servarr stack (readarr, lidarr, whisparr)

# Installation

#### Via Docker Compose (ALL ENVIRONMENT VARIABLES REQUIRED UNLESS OTHERWISE SPECIFIED)
```yaml
services:
  replacerr:
    container_name: replacerr
    image: ghcr.io/oonqt/replacerr:latest
    restart: unless-stopped
    environment:
      - MAX_LAST_SEEN=1440 # Time in minutes 
      - MAX_STRIKES=3 
      - CHECK_INTERVAL=5 # Time in minutes
      - DISCORD_WEBHOOK=https://discord.com/api/webhooks/****/**** # (OPTIONAL)

      - QBIT_URL=http://qbittorrent:8080
      - QBIT_USER=admin
      - QBIT_PASS=********

      - RADARR_URL=http://radarr:7878
      - RADARR_API_KEY=********

      - SONARR_URL=http://sonarr:8989
      - SONARR_API_KEY=********
```
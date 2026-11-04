# Server schedules (Mr. B Ludo)

Managed by Lovable Cloud's scheduler; this file is the checked-in record of what runs.

| Job | When | Does |
|---|---|---|
| `ludo-maintenance-every-minute` | every minute | `POST /api/public/maintenance` (managed bearer auth): runs `cleanup_stale_matches`, plays idle quick-match turns, sends turn and weekly reminders |
| `ludo-stale-match-cleanup` | hourly at :17 | backup run of `cleanup_stale_matches` |

`cleanup_stale_matches` windows: waiting 6 h, quick inactive 24 h or empty 10 min, private inactive 14 days,
quick-search locks 1 min, invites expire 6 h, rate-limit counters 2 days,
admin diagnostics (`error`, `ad`, `server_timing`, `admin_pin_fail`) 30 days, other admin events 90 days.

Server health: server actions slower than 1 s or failing unexpectedly are stored as `server_timing`;
the admin panel flags ≥3 slow or ≥2 failed within 5 minutes (last 7 days).

Change schedules only with the scheduler tools, then update this file.

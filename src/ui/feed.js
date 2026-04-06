import { FEED_ICONS } from '../types';
import { tf } from '../i18n';
const log = document.getElementById('feed-log');
export function addFeedEntry(entry) {
    const el = document.createElement('div');
    el.className = `feed-entry ${entry.severity}`;
    el.dataset.id = entry.id;
    const month = Math.ceil(entry.day / 30);
    const dayOfMonth = entry.day % 30 || 30;
    const timeLabel = tf('topbar.clock', { y: entry.year, m: month, d: dayOfMonth });
    el.innerHTML = `
    <div class="feed-time">${FEED_ICONS[entry.severity] ?? '·'} ${timeLabel}</div>
    <div class="feed-text">${entry.text}</div>
  `;
    // Click → could highlight on map later
    el.addEventListener('click', () => {
        el.classList.toggle('selected');
    });
    log.prepend(el); // newest on top
    // Cap at 200 entries
    while (log.children.length > 200) {
        log.removeChild(log.lastChild);
    }
}
export function addFeedRaw(text, severity = 'info', year = 1, day = 1) {
    addFeedEntry({
        id: crypto.randomUUID(),
        tick: 0,
        day,
        year,
        text,
        icon: FEED_ICONS[severity] ?? '·',
        severity,
        related_npc_ids: [],
        related_zones: [],
    });
}
export function addFeedThinking(text = 'Processing...') {
    const el = document.createElement('div');
    el.className = 'feed-entry info';
    el.id = 'feed-thinking';
    el.innerHTML = `<div class="feed-text" style="color:#444;font-style:italic">${text}</div>`;
    log.prepend(el);
    return () => el.remove();
}

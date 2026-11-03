/** Quick-play search on Home acts as Yatzy's waiting room: no App Open ad on top of it. */
let searching = 0;
export function setQuickSearchActive(active: boolean): void { searching = Math.max(0, searching + (active ? 1 : -1)); }
export function waitingRoomAdBlocked(): boolean { return searching > 0; }

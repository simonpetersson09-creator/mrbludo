export interface PlayerSession { user: { id: string }; access_token: string; refresh_token: string }

/**
 * Deduplicate first-launch calls; never replace an existing identity on network failure.
 * At most one identity is created per app run: if the saved session cannot be read back
 * after creation, the one created this run is reused instead of minting another player.
 */
export function sessionInitializer<S extends PlayerSession>(restore: () => Promise<S | null>, create: () => Promise<S>) {
  let pending: Promise<S> | undefined;
  let created: S | undefined;
  return () => {
    if (!pending) pending = restore()
      .then((session) => session ?? created ?? create().then((s) => (created = s)))
      .finally(() => { pending = undefined; });
    return pending;
  };
}

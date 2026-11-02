export interface PlayerSession { user: { id: string }; access_token: string; refresh_token: string }

/** Deduplicate first-launch calls; never replace an existing identity on network failure. */
export function sessionInitializer<S extends PlayerSession>(restore: () => Promise<S | null>, create: () => Promise<S>) {
  let pending: Promise<S> | undefined;
  return () => {
    if (!pending) pending = restore().then((session) => session ?? create()).finally(() => { pending = undefined; });
    return pending;
  };
}
/** Bounded server diagnostics: labels and durations only, never query arguments/results/errors. */
export type StepName = "profile" | "stats" | "role" | "presence" | "friends" | "profiles" | "history" | "invites" | "lockCleanup" | "lockAcquire" | "lockRelease" | "search";
export type StepReport = { op: "getMe" | "listFriends" | "quickMatch"; ms: number; ok: boolean; steps: { step: StepName; ms: number; calls: number; failed: number }[] };
type Step = <T>(name: StepName, fn: () => PromiseLike<T>) => Promise<T>;

async function save(report: StepReport): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("app_events").insert({ kind: "server_timing", platform: "server", detail: report as never });
}

export async function withStepTiming<T>(op: StepReport["op"], fn: (step: Step) => Promise<T>, sink = save): Promise<T> {
  const start = performance.now();
  const steps = new Map<StepName, StepReport["steps"][number]>();
  let ok = true;
  const step: Step = async (name, action) => {
    const at = performance.now();
    let failed = false;
    try {
      const value = await action();
      failed = !!(value && typeof value === "object" && "error" in value && value.error);
      return value;
    } catch (e) { failed = true; throw e; }
    finally {
      const row = steps.get(name) ?? { step: name, ms: 0, calls: 0, failed: 0 };
      row.ms += Math.max(0, Math.round(performance.now() - at));
      row.calls++; row.failed += Number(failed); steps.set(name, row);
    }
  };
  try { return await fn(step); }
  catch (e) { ok = false; throw e; }
  finally {
    const ms = Math.max(0, Math.round(performance.now() - start));
    if (ms >= 1000 || !ok || [...steps.values()].some((s) => s.failed > 0)) {
      try { await sink({ op, ms, ok, steps: [...steps.values()] }); } catch { /* Logging never changes action results. */ }
    }
  }
}
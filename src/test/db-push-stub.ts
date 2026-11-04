// Database integration tests only: push delivery is out of scope and must never call Apple.
export async function notify() {}
export const defaultEnv = () => "development";

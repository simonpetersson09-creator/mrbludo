import { createFileRoute } from "@tanstack/react-router";
// Native clients call the remote authenticated service, never bundle its handler.
export const Route = createFileRoute("/api/public/native")({ component: () => null });
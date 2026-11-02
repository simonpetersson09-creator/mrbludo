import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import "@/styles.css";
import { installNativeDiagnostics, nativeDiagnostic } from "@/lib/native/diagnostics";

const stopDiagnostics = installNativeDiagnostics();
if (import.meta.hot) import.meta.hot.dispose(stopDiagnostics);
const element = document.getElementById("root");
if (element) {
  createRoot(element).render(<RouterProvider router={getRouter()} />);
} else nativeDiagnostic("startup", "failed");
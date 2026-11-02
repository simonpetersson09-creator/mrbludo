import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import "@/styles.css";

const element = document.getElementById("root");
if (element) createRoot(element).render(<RouterProvider router={getRouter()} />);
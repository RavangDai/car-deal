import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "./App";
import { queryClient } from "./queryClient";
import "./theme.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && (
        // Default bottom-right toggle collides with the app's own fixed
        // bottom taskbar — moved to top-right, the one corner nothing else uses.
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);

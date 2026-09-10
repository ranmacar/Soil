import { execFile } from "node:child_process";
import { defineConfig, type Plugin } from "vite";

/** Expose Termux GPS to the page when the browser geolocation API is blocked. */
function termuxLocation(): Plugin {
  return {
    name: "termux-location",
    configureServer(server) {
      server.middlewares.use("/api/location", (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        const bin = process.env.TERMUX_LOCATION_BIN ?? "termux-location";
        execFile(
          bin,
          ["-p", "network", "-r", "once"],
          { timeout: 20_000 },
          (err, stdout) => {
            res.setHeader("Content-Type", "application/json");
            if (err) {
              res.statusCode = 503;
              res.end(
                JSON.stringify({
                  error: "location_unavailable",
                  detail: err.message,
                }),
              );
              return;
            }
            try {
              const parsed: unknown = JSON.parse(stdout);
              if (
                !parsed ||
                typeof parsed !== "object" ||
                !("latitude" in parsed) ||
                !("longitude" in parsed)
              ) {
                throw new Error("unexpected termux-location payload");
              }
              res.end(JSON.stringify(parsed));
            } catch (parseErr) {
              res.statusCode = 503;
              res.end(
                JSON.stringify({
                  error: "location_unavailable",
                  detail:
                    parseErr instanceof Error
                      ? parseErr.message
                      : "invalid location payload",
                }),
              );
            }
          },
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [termuxLocation()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});

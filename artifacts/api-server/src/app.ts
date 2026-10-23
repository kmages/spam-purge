import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// The web app is same-origin and the mobile apps are not browsers, so cross-origin access is
// limited to the configured domain. Reflecting any origin would let other sites read a signed-in user's data.
app.use(
  cors({
    origin: process.env.DOMAIN ? [`https://${process.env.DOMAIN}`] : true,
    credentials: true,
  }),
);

app.use(cookieParser());

// express-session only carries OAuth state across the Google redirect. Sign-in itself uses api_tokens.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // long enough to finish the Google consent screen
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Self-host mode: serve the built frontend from this same process so the whole
// app runs as one service (no Replit path proxy). Gated behind SERVE_STATIC so it
// stays inert on Replit, where the frontend is served separately.
if (process.env.SERVE_STATIC === "true") {
  const staticDir =
    process.env.STATIC_DIR ??
    path.resolve(process.cwd(), "artifacts/spam-purge/dist/public");

  // extensions: plain-HTML pages such as /privacy are served without the .html suffix.
  app.use(express.static(staticDir, { extensions: ["html"] }));

  // SPA fallback: anything that isn't an API call or a real file returns index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });

  logger.info({ staticDir }, "Serving frontend static files");
}

export default app;

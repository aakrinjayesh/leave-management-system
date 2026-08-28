const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

// Behind Render's proxy (and the frontend's /api rewrite): trust one hop so the
// app sees HTTPS and the real client IP instead of the proxy's - matters for
// secure-cookie detection and IP-based rate limiting.
app.set("trust proxy", 1);

const isDevLocalhost = (origin) => env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_URL || isDevLocalhost(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    // Needed so the frontend can read the server-chosen filename off CSV
    // export downloads - browsers hide response headers cross-origin by
    // default unless explicitly exposed.
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json());
app.use(cookieParser());

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
}

app.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

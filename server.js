const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieSession = require("cookie-session");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();

// Render runs behind a reverse proxy.
// This is important for secure HTTPS session cookies.
app.set("trust proxy", 1);

const PORT = process.env.PORT || 10000;
const BASE_URL =
  process.env.BASE_URL || `http://localhost:${PORT}`;

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(__dirname, "data", "elisy254.db");

const UPLOAD_DIR = path.join(__dirname, "uploads");

// Make required directories
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// -------------------------
// DATABASE
// -------------------------

const db = new Database(DB_PATH);

db.pragma("journal_mode=WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#b9ff3d',
    active INTEGER NOT NULL DEFAULT 1,
    filename TEXT,
    original_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// -------------------------
// MIDDLEWARE
// -------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "elisy254_session",

    // cookie-session uses keys for signing/encrypting the session cookie
    keys: [
      process.env.SESSION_SECRET ||
        "CHANGE_ME_IN_PRODUCTION"
    ],

    httpOnly: true,

    // Render uses HTTPS in production
    secure: process.env.NODE_ENV === "production",

    // Allows OAuth redirect back to this site
    sameSite: "lax",

    maxAge: 7 * 24 * 60 * 60 * 1000
  })
);

app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// FILE UPLOAD
// -------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,

    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      cb(
        null,
        crypto.randomUUID() + "-" + safeName
      );
    }
  }),

  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// -------------------------
// HELPERS
// -------------------------

function adminOnly(req, res, next) {
  if (req.session?.admin) {
    return next();
  }

  return res
    .status(401)
    .json({
      error: "Admin authentication required"
    });
}

function safeEq(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}

function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pkceChallenge(verifier) {
  return base64url(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}

// -------------------------
// CONFIG
// -------------------------

app.get("/api/config", (req, res) => {
  res.json({
    authenticated: !!req.session?.user,
    admin: !!req.session?.admin,

    oauthConfigured:
      !!process.env.DERIV_CLIENT_ID &&
      !!process.env.DERIV_REDIRECT_URI,

    baseUrl: BASE_URL
  });
});

// -------------------------
// DERIV OAUTH START
// -------------------------

app.get("/auth/deriv/start", (req, res) => {
  if (
    !process.env.DERIV_CLIENT_ID ||
    !process.env.DERIV_REDIRECT_URI
  ) {
    return res
      .status(503)
      .send(
        "Deriv OAuth is not configured. Add DERIV_CLIENT_ID and DERIV_REDIRECT_URI in Render Environment."
      );
  }

  const verifier = base64url(
    crypto.randomBytes(48)
  );

  const state = base64url(
    crypto.randomBytes(32)
  );

  // Store OAuth information in the signed session cookie
  req.session.oauth = {
    verifier,
    state
  };

  const u = new URL(
    "https://auth.deriv.com/oauth2/auth"
  );

  u.searchParams.set(
    "response_type",
    "code"
  );

  u.searchParams.set(
    "client_id",
    process.env.DERIV_CLIENT_ID
  );

  u.searchParams.set(
    "redirect_uri",
    process.env.DERIV_REDIRECT_URI
  );

  u.searchParams.set(
    "scope",
    "trade account_manage application_read"
  );

  u.searchParams.set(
    "state",
    state
  );

  u.searchParams.set(
    "code_challenge",
    pkceChallenge(verifier)
  );

  u.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  return res.redirect(u.toString());
});

// -------------------------
// DERIV SIGNUP
// -------------------------

app.get("/auth/deriv/signup", (req, res) => {
  if (
    !process.env.DERIV_CLIENT_ID ||
    !process.env.DERIV_REDIRECT_URI
  ) {
    return res
      .status(503)
      .send(
        "Deriv OAuth is not configured."
      );
  }

  const verifier = base64url(
    crypto.randomBytes(48)
  );

  const state = base64url(
    crypto.randomBytes(32)
  );

  req.session.oauth = {
    verifier,
    state
  };

  const u = new URL(
    "https://auth.deriv.com/oauth2/auth"
  );

  u.searchParams.set(
    "response_type",
    "code"
  );

  u.searchParams.set(
    "client_id",
    process.env.DERIV_CLIENT_ID
  );

  u.searchParams.set(
    "redirect_uri",
    process.env.DERIV_REDIRECT_URI
  );

  u.searchParams.set(
    "scope",
    "trade account_manage application_read"
  );

  u.searchParams.set(
    "state",
    state
  );

  u.searchParams.set(
    "code_challenge",
    pkceChallenge(verifier)
  );

  u.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  u.searchParams.set(
    "prompt",
    "registration"
  );

  // Optional partner tracking
  if (
    process.env.DERIV_SIGNUP_TRACKING_TOKEN
  ) {
    u.searchParams.set(
      "t",
      process.env.DERIV_SIGNUP_TRACKING_TOKEN
    );
  }

  if (process.env.DERIV_AFFILIATE_ID) {
    u.searchParams.set(
      "utm_source",
      process.env.DERIV_AFFILIATE_ID
    );
  }

  u.searchParams.set(
    "utm_medium",
    "affiliate"
  );

  u.searchParams.set(
    "utm_campaign",
    "elisy254"
  );

  return res.redirect(u.toString());
});

// -------------------------
// DERIV OAUTH CALLBACK
// -------------------------

app.get(
  "/auth/deriv/callback",
  async (req, res) => {
    try {
      // Handle OAuth error
      if (req.query.error) {
        return res.redirect(
          "/?auth_error=" +
            encodeURIComponent(
              req.query.error_description ||
                req.query.error
            )
        );
      }

      const returnedState = String(
        req.query.state || ""
      );

      const oauthSession =
        req.session?.oauth;

      // IMPORTANT:
      // Validate OAuth state before exchanging the code.
      if (
        !oauthSession ||
        !oauthSession.state ||
        !safeEq(
          oauthSession.state,
          returnedState
        )
      ) {
        return res
          .status(400)
          .send(
            "Invalid OAuth state. Please start the Deriv login again."
          );
      }

      const code = String(
        req.query.code || ""
      );

      if (!code) {
        return res
          .status(400)
          .send(
            "Missing OAuth authorization code."
          );
      }

      if (!oauthSession.verifier) {
        return res
          .status(400)
          .send(
            "Missing OAuth PKCE verifier."
          );
      }

      const body = new URLSearchParams({
        grant_type:
          "authorization_code",

        client_id:
          process.env.DERIV_CLIENT_ID,

        code,

        code_verifier:
          oauthSession.verifier,

        redirect_uri:
          process.env.DERIV_REDIRECT_URI
      });

      const tokenResponse =
        await fetch(
          "https://auth.deriv.com/oauth2/token",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/x-www-form-urlencoded"
            },

            body
          }
        );

      const data =
        await tokenResponse.json();

      if (
        !tokenResponse.ok ||
        !data.access_token
      ) {
        console.error(
          "Deriv token exchange failed:",
          data
        );

        return res
          .status(502)
          .send(
            "Deriv token exchange failed."
          );
      }

      // Remove temporary OAuth data
      req.session.oauth = null;

      // Store authenticated user session
      req.session.user = {
        provider: "deriv",

        accessToken:
          data.access_token,

        expiresAt:
          Date.now() +
          Number(
            data.expires_in || 3600
          ) *
            1000
      };

      return res.redirect("/");
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      return res
        .status(500)
        .send(
          "OAuth callback error."
        );
    }
  }
);

// -------------------------
// ADMIN LOGIN
// -------------------------

app.post(
  "/api/admin/login",
  (req, res) => {
    const email =
      process.env.ADMIN_EMAIL || "";

    const password =
      process.env.ADMIN_PASSWORD || "";

    if (
      safeEq(
        req.body.email || "",
        email
      ) &&
      safeEq(
        req.body.password || "",
        password
      )
    ) {
      req.session.admin = true;

      return res.json({
        ok: true
      });
    }

    return res
      .status(401)
      .json({
        error:
          "Invalid admin credentials"
      });
  }
);

app.post(
  "/api/admin/logout",
  adminOnly,
  (req, res) => {
    req.session.admin = false;

    return res.json({
      ok: true
    });
  }
);

// -------------------------
// PUBLIC BOTS
// -------------------------

app.get(
  "/api/bots",
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT
          id,
          name,
          description,
          image_url,
          color,
          active,
          filename,
          original_name,
          created_at,
          updated_at
        FROM bots
        WHERE active = 1
        ORDER BY id DESC
      `)
      .all();

    return res.json(rows);
  }
);

// -------------------------
// ADMIN BOTS
// -------------------------

app.get(
  "/api/admin/bots",
  adminOnly,
  (req, res) => {
    return res.json(
      db
        .prepare(
          "SELECT * FROM bots ORDER BY id DESC"
        )
        .all()
    );
  }
);

// CREATE BOT

app.post(
  "/api/admin/bots",
  adminOnly,
  upload.single("file"),
  (req, res) => {
    const {
      name,
      description = "",
      image_url = "",
      color = "#b9ff3d",
      active = "1"
    } = req.body;

    if (!name?.trim()) {
      return res
        .status(400)
        .json({
          error: "Name required"
        });
    }

    const file = req.file;

    const info = db
      .prepare(`
        INSERT INTO bots (
          name,
          description,
          image_url,
          color,
          active,
          filename,
          original_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        name.trim(),
        description.trim(),
        image_url.trim(),
        color,
        active === "1" ? 1 : 0,
        file?.filename || null,
        file?.originalname || null
      );

    return res.json(
      db
        .prepare(
          "SELECT * FROM bots WHERE id = ?"
        )
        .get(info.lastInsertRowid)
    );
  }
);

// UPDATE BOT

app.put(
  "/api/admin/bots/:id",
  adminOnly,
  upload.single("file"),
  (req, res) => {
    const old = db
      .prepare(
        "SELECT * FROM bots WHERE id = ?"
      )
      .get(req.params.id);

    if (!old) {
      return res
        .status(404)
        .json({
          error: "Bot not found"
        });
    }

    const file = req.file;

    if (file && old.filename) {
      try {
        fs.unlinkSync(
          path.join(
            UPLOAD_DIR,
            old.filename
          )
        );
      } catch {}
    }

    db.prepare(`
      UPDATE bots
      SET
        name = ?,
        description = ?,
        image_url = ?,
        color = ?,
        active = ?,
        filename = ?,
        original_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      (req.body.name || old.name).trim(),

      (
        req.body.description ??
        old.description
      ).trim(),

      (
        req.body.image_url ??
        old.image_url
      ).trim(),

      req.body.color ||
        old.color,

      req.body.active === "1"
        ? 1
        : 0,

      file
        ? file.filename
        : old.filename,

      file
        ? file.originalname
        : old.original_name,

      req.params.id
    );

    return res.json(
      db
        .prepare(
          "SELECT * FROM bots WHERE id = ?"
        )
        .get(req.params.id)
    );
  }
);

// DELETE BOT

app.delete(
  "/api/admin/bots/:id",
  adminOnly,
  (req, res) => {
    const old = db
      .prepare(
        "SELECT * FROM bots WHERE id = ?"
      )
      .get(req.params.id);

    if (!old) {
      return res
        .status(404)
        .json({
          error: "Bot not found"
        });
    }

    if (old.filename) {
      try {
        fs.unlinkSync(
          path.join(
            UPLOAD_DIR,
            old.filename
          )
        );
      } catch {}
    }

    db.prepare(
      "DELETE FROM bots WHERE id = ?"
    ).run(req.params.id);

    return res.json({
      ok: true
    });
  }
);

// -------------------------
// BOT FILE DOWNLOAD
// -------------------------

app.get(
  "/api/bots/:id/file",
  (req, res) => {
    const bot = db
      .prepare(`
        SELECT *
        FROM bots
        WHERE id = ?
        AND active = 1
      `)
      .get(req.params.id);

    if (!bot?.filename) {
      return res
        .status(404)
        .send(
          "Bot file unavailable"
        );
    }

    return res.download(
      path.join(
        UPLOAD_DIR,
        bot.filename
      ),
      bot.original_name ||
        "bot.file"
    );
  }
);

// ADMIN BOT FILE DOWNLOAD

app.get(
  "/api/admin/bots/:id/file",
  adminOnly,
  (req, res) => {
    const bot = db
      .prepare(
        "SELECT * FROM bots WHERE id = ?"
      )
      .get(req.params.id);

    if (!bot?.filename) {
      return res
        .status(404)
        .send(
          "Bot file unavailable"
        );
    }

    return res.download(
      path.join(
        UPLOAD_DIR,
        bot.filename
      ),
      bot.original_name ||
        "bot.file"
    );
  }
);

// -------------------------
// HEALTH CHECK
// -------------------------

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "ELISY254",
      timestamp:
        new Date().toISOString()
    });
  }
);

// -------------------------
// FRONTEND
// -------------------------
//
// Use app.use instead of app.get("*")
// so this works with Express 5.

app.use(
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// -------------------------
// START SERVER
// -------------------------

app.listen(
  PORT,
  () => {
    console.log(
      `ELISY254 running on ${PORT}`
    );
  }
);

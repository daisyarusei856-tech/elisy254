const F = [
  ["dashboard", "⌂", "Dashboard", "Workspace overview"],
  ["bot_builder", "🤖", "Bot Builder", "Build and test bots"],
  ["auto_trades", "⚡", "Auto Trades", "Automation controls"],
  ["manual", "💹", "Manual Trading", "Manual contract workspace"],
  ["tradingview", "📊", "TradingView", "Charts"],
  ["bulk", "▦", "Bulk Trader", "Multiple contracts"],
  ["copy", "👥", "Copy Trading", "Copy workspace"],
  ["ai", "🧠", "AI Scanner", "AI analysis"],
  ["free", "🆓", "Free Bots", "Bot library"],
  ["analysis", "🛠", "Analysis Tools", "Market tools"],
  ["calculator", "🧮", "Calculator", "Calculator"],
  ["digits", "●", "Digit Analysis", "Live digit intelligence"]
];

let page = "dashboard";
let ticks = [];
let latest = null;
let symbol = "R_75";
let ws = null;
let authenticated = false;
let user = null;

function el(selector) {
  return document.querySelector(selector);
}

// ------------------------------------
// AUTHENTICATION
// ------------------------------------

async function checkAuth() {
  try {
    const response = await fetch("/api/config", {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      authenticated = false;
      return;
    }

    const config = await response.json();

    authenticated = !!config.authenticated;

    if (authenticated) {
      user = {
        provider: "deriv"
      };

      // IMPORTANT:
      // OAuth returned successfully, so open dashboard.
      page = "dashboard";
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    authenticated = false;
  }
}

// ------------------------------------
// NAVIGATION
// ------------------------------------

function nav() {
  const navEl = el("#nav");
  const bottomEl = el("#bottom");

  if (navEl) {
    navEl.innerHTML = F.map(
      f =>
        `<button class="nav ${
          page === f[0] ? "active" : ""
        }" onclick="go('${f[0]}')">
          ${f[1]} &nbsp; ${f[2]}
        </button>`
    ).join("");
  }

  if (bottomEl) {
    bottomEl.innerHTML = [
      F[0],
      F[7],
      F[1],
      F[3],
      ["menu", "☰", "Menu"]
    ]
      .map(
        f =>
          `<button class="${
            page === f[0] ? "active" : ""
          }"
          onclick="${
            f[0] === "menu"
              ? "toggleSide()"
              : `go('${f[0]}')`
          }">
            ${f[1]}<br>${f[2]}
          </button>`
      )
      .join("");
  }
}

function go(p) {
  page = p;

  const side = el("#side");

  if (side) {
    side.classList.remove("open");
  }

  nav();
  render();
}

function toggleSide() {
  const side = el("#side");

  if (side) {
    side.classList.toggle("open");
  }
}

// ------------------------------------
// DERIV LIVE TICKS
// ------------------------------------

function lastDigit(q) {
  const s = String(q);
  const m = s.match(/(\d)(?!.*\d)/);

  return m ? Number(m[1]) : null;
}

function connectTicks() {
  try {
    if (ws) {
      try {
        ws.close();
      } catch {}
    }

    ws = new WebSocket(
      "wss://api.derivws.com/trading/v1/options/ws/public"
    );

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          ticks: symbol,
          subscribe: 1
        })
      );
    };

    ws.onmessage = event => {
      try {
        const x = JSON.parse(event.data);

        if (
          x.msg_type === "tick" &&
          x.tick &&
          x.tick.quote !== undefined
        ) {
          const d = lastDigit(x.tick.quote);

          if (d !== null) {
            latest = d;

            ticks.push(d);

            if (ticks.length > 300) {
              ticks.shift();
            }

            render();
          }
        }
      } catch (error) {
        console.error(
          "Tick processing error:",
          error
        );
      }
    };

    ws.onerror = error => {
      console.error(
        "Deriv WebSocket error:",
        error
      );
    };

    ws.onclose = () => {
      setTimeout(
        connectTicks,
        2500
      );
    };
  } catch (error) {
    console.error(
      "WebSocket connection error:",
      error
    );

    setTimeout(
      connectTicks,
      2500
    );
  }
}

// ------------------------------------
// DIGIT ANALYSIS
// ------------------------------------

function digitsPanel() {
  const count = Array(10).fill(0);

  ticks.forEach(digit => {
    if (
      Number.isInteger(digit) &&
      digit >= 0 &&
      digit <= 9
    ) {
      count[digit]++;
    }
  });

  const order = [...Array(10).keys()].sort(
    (a, b) =>
      count[b] - count[a] ||
      a - b
  );

  const high =
    ticks.length > 0
      ? order[0]
      : null;

  const total =
    ticks.length || 1;

  return `
    <div class="panel">

      <div class="digits">

        ${order
          .map(
            (digit, index) => `
              <div
                class="d rank${index + 1} ${
                  latest === digit
                    ? "hit"
                    : ""
                }"
              >
                <span class="n">
                  ${digit}
                </span>

                <span class="r">
                  #${index + 1}
                  ·
                  ${(
                    (count[digit] /
                      total) *
                    100
                  ).toFixed(1)}%
                </span>
              </div>
            `
          )
          .join("")}

      </div>

      <div class="movement">

        LATEST DIGIT:
        <b>
          ${latest ?? "WAITING"}
        </b>

        &nbsp; · &nbsp;

        HIGH MOMENTUM:
        <b>
          ${high ?? "WAITING"}
        </b>

        &nbsp; · &nbsp;

        MOVEMENT:
        <b>
          ${
            ticks.length < 10
              ? "WAITING FOR DATA"
              : latest === high
              ? "ON COURSE"
              : "OFF COURSE"
          }
        </b>

      </div>

    </div>
  `;
}

// ------------------------------------
// DASHBOARD
// ------------------------------------

function dashboard() {
  return `
    <div class="welcome">

      <h1>
        Welcome back 👋
      </h1>

      <p class="muted">
        ELISY254 professional workspace
        · real public Deriv tick stream
      </p>

    </div>

    <div class="stats">

      <div class="stat">
        Connection
        <b style="color:#baff3d">
          LIVE
        </b>
      </div>

      <div class="stat">
        Market
        <b>
          ${symbol}
        </b>
      </div>

      <div class="stat">
        Latest digit
        <b>
          ${latest ?? "—"}
        </b>
      </div>

      <div class="stat">
        Ticks
        <b>
          ${ticks.length}
        </b>
      </div>

    </div>

    <div class="section">
      <h2>
        Trading tools
      </h2>

      <span class="pill">
        12 modules
      </span>
    </div>

    <div class="tools">

      ${F.slice(1)
        .map(
          f => `
            <button
              class="tool"
              onclick="go('${f[0]}')"
            >

              <div class="ico">
                ${f[1]}
              </div>

              <h3>
                ${f[2]}
              </h3>

              <p>
                ${f[3]}
              </p>

            </button>
          `
        )
        .join("")}

    </div>

    <div class="section">

      <h2>
        Digit Analysis
      </h2>

      <span class="pill">
        REAL TICKS
      </span>

    </div>

    ${digitsPanel()}
  `;
}

// ------------------------------------
// PAGE SHELL
// ------------------------------------

function pageShell(f, body) {
  return `
    <div class="welcome">

      <h1>
        ${f[2]}
      </h1>

      <p class="muted">
        ${f[3]}
      </p>

    </div>

    ${body}
  `;
}

// ------------------------------------
// RENDER
// ------------------------------------

function render() {
  const content = el("#content");

  if (!content) {
    return;
  }

  const f =
    F.find(x => x[0] === page) ||
    F[0];

  const title = el("#title");

  if (title) {
    title.textContent = f[2];
  }

  let contentHTML = "";

  if (page === "dashboard") {
    contentHTML = dashboard();
  }

  else if (page === "digits") {
    contentHTML = pageShell(
      f,
      digitsPanel()
    );
  }

  else if (page === "bot_builder") {
    contentHTML = pageShell(
      f,
      `
        <div class="panel">

          <div class="flow">

            ${
              [
                "LIVE MARKET",
                "TICK DATA",
                "ANALYSIS",
                "CONDITION",
                "SIGNAL",
                "RISK CHECK",
                "EXECUTION"
              ]
                .map(
                  (x, i) =>
                    `
                      <div class="step ${
                        i < 3
                          ? "active"
                          : ""
                      }">
                        ${x}
                      </div>
                    `
                )
                .join("")
            }

          </div>

          <div class="section">
            <h2>
              Bot controls
            </h2>
          </div>

          <div class="actions">

            <button class="action">
              Save Bot
            </button>

            <button class="action">
              Test Bot
            </button>

            <button
              class="action"
              onclick="go('free')"
            >
              Import / Free Bots
            </button>

          </div>

        </div>
      `
    );
  }

  else if (page === "ai") {
    contentHTML = pageShell(
      f,
      `
        <div class="panel">

          <h2>
            AI ANALYSIS
          </h2>

          <p class="muted">
            AI results are shown only
            when a real provider is
            configured. No fabricated
            AI signal is displayed.
          </p>

          <div class="movement">
            Current digit engine:
            real Deriv tick data
            · ${ticks.length}
            ticks received.
          </div>

        </div>
      `
    );
  }

  else if (page === "free") {
    contentHTML = pageShell(
      f,
      `<div id="bots" class="botadmin"></div>`
    );
  }

  else {
    contentHTML = pageShell(
      f,
      `
        <div class="panel">

          <h2>
            ${f[3]}
          </h2>

          <p class="muted">
            Production module shell.
            Account-scoped actions
            require authenticated
            Deriv authorization and
            explicit user confirmation.
          </p>

        </div>
      `
    );
  }

  content.innerHTML =
    contentHTML;

  if (page === "free") {
    loadBots();
  }
}

// ------------------------------------
// FREE BOTS
// ------------------------------------

async function loadBots() {
  try {
    const response =
      await fetch("/api/bots", {
        credentials: "include"
      });

    if (!response.ok) {
      throw new Error(
        "Unable to load bots"
      );
    }

    const bots =
      await response.json();

    const botsEl = el("#bots");

    if (!botsEl) {
      return;
    }

    botsEl.innerHTML =
      bots.length
        ? bots
            .map(
              bot => `
                <div class="panel">

                  <div
                    class="circle-preview"
                    style="background:${bot.color}"
                  >
                    ${
                      (bot.name || "B")
                        .slice(0, 1)
                        .toUpperCase()
                    }
                  </div>

                  <h3>
                    ${esc(bot.name)}
                  </h3>

                  <p class="muted">
                    ${esc(
                      bot.description
                    )}
                  </p>

                  ${
                    bot.filename
                      ? `
                        <a
                          class="action"
                          href="/api/bots/${bot.id}/file"
                        >
                          Download bot
                        </a>
                      `
                      : ""
                  }

                </div>
              `
            )
            .join("")
        : `
          <div class="panel">

            <h3>
              No free bots yet
            </h3>

            <p class="muted">
              Admin can publish bots
              from /admin.
            </p>

          </div>
        `;
  } catch (error) {
    console.error(
      "Free bot loading error:",
      error
    );

    const botsEl = el("#bots");

    if (botsEl) {
      botsEl.innerHTML = `
        <div class="panel">
          <h3>
            Unable to load free bots
          </h3>

          <p class="muted">
            Please try again later.
          </p>
        </div>
      `;
    }
  }
}

// ------------------------------------
// ESCAPE HTML
// ------------------------------------

function esc(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    m =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m])
  );
}

// ------------------------------------
// API TOKEN MODAL
// ------------------------------------

function tokenModal() {
  const modal = el("#modal");

  if (!modal) {
    return;
  }

  modal.className = "modal";

  modal.innerHTML = `
    <div class="modalbox">

      <h2>
        API token
      </h2>

      <p class="muted">
        Use your Deriv API token
        to authenticate. Never
        share your token with anyone.
      </p>

      <div class="field">

        <input
          id="apiTokenInput"
          type="password"
          placeholder="Deriv API token"
          autocomplete="off"
        >

      </div>

      <button
        class="primary"
        onclick="submitApiToken()"
      >
        Continue
      </button>

      <button
        class="action"
        onclick="closeModal()"
      >
        Cancel
      </button>

    </div>
  `;
}

function closeModal() {
  const modal = el("#modal");

  if (modal) {
    modal.className =
      "modal hidden";
  }
}

async function submitApiToken() {
  const input =
    el("#apiTokenInput");

  if (!input) {
    return;
  }

  const token =
    input.value.trim();

  if (!token) {
    alert(
      "Please enter your Deriv API token."
    );
    return;
  }

  // The current backend does not yet
  // expose a token-login endpoint.
  // Do not pretend the token was accepted.
  alert(
    "API token authentication is not yet connected to the backend."
  );
}

// ------------------------------------
// START APPLICATION
// ------------------------------------

async function startApp() {
  await checkAuth();

  nav();
  render();

  connectTicks();
}

startApp();

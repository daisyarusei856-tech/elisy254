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
let config = null;
let reconnectTimer = null;

/* =========================
   BASIC HELPERS
========================= */

function el(selector) {
  return document.querySelector(selector);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

/* =========================
   NAVIGATION
========================= */

function nav() {
  const navEl = el("#nav");
  const bottomEl = el("#bottom");

  if (navEl) {
    navEl.innerHTML = F.map(f => `
      <button
        class="nav ${page === f[0] ? "active" : ""}"
        onclick="go('${f[0]}')"
      >
        ${f[1]} &nbsp; ${f[2]}
      </button>
    `).join("");
  }

  if (bottomEl) {
    const mobileItems = [
      F[0],
      F[7],
      F[1],
      F[3],
      ["menu", "☰", "Menu"]
    ];

    bottomEl.innerHTML = mobileItems.map(f => `
      <button
        class="${page === f[0] ? "active" : ""}"
        onclick="${
          f[0] === "menu"
            ? "toggleSide()"
            : `go('${f[0]}')`
        }"
      >
        ${f[1]}<br>${f[2]}
      </button>
    `).join("");
  }
}

function go(p) {
  page = p;

  const side = el("#side");
  if (side) side.classList.remove("open");

  nav();
  render();
}

function toggleSide() {
  const side = el("#side");
  if (side) side.classList.toggle("open");
}

/* =========================
   DERIV TICK DATA
========================= */

function lastDigit(quote) {
  const s = String(quote ?? "");
  const match = s.match(/(\d)(?!.*\d)/);
  return match ? Number(match[1]) : null;
}

function connectTicks() {
  if (ws) {
    try {
      ws.close();
    } catch (_) {}
  }

  ws = new WebSocket(
    "wss://api.derivws.com/trading/v1/options/ws/public"
  );

  ws.onopen = () => {
    ws.send(JSON.stringify({
      ticks: symbol,
      subscribe: 1
    }));
  };

  ws.onmessage = event => {
    try {
      const data = JSON.parse(event.data);

      if (data.msg_type === "tick" && data.tick) {
        const digit = lastDigit(data.tick.quote);

        if (digit !== null) {
          latest = digit;

          ticks.push(digit);

          if (ticks.length > 300) {
            ticks.shift();
          }

          render();
        }
      }
    } catch (error) {
      console.error("Tick processing error:", error);
    }
  };

  ws.onerror = error => {
    console.error("Deriv WebSocket error:", error);
  };

  ws.onclose = () => {
    clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      connectTicks();
    }, 2500);
  };
}

/* =========================
   DIGIT ANALYSIS
========================= */

function getDigitStats() {
  const counts = Array(10).fill(0);

  for (const digit of ticks) {
    if (digit >= 0 && digit <= 9) {
      counts[digit]++;
    }
  }

  const total = ticks.length;

  const order = [...Array(10).keys()].sort((a, b) => {
    if (counts[b] !== counts[a]) {
      return counts[b] - counts[a];
    }

    return a - b;
  });

  return {
    counts,
    order,
    total
  };
}

function digitsPanel() {
  const {
    counts,
    order,
    total
  } = getDigitStats();

  const strongest = total > 0 ? order[0] : null;

  return `
    <div class="panel">

      <div class="digits">
        ${order.map((digit, index) => {

          const percentage =
            total > 0
              ? (counts[digit] / total * 100).toFixed(1)
              : "0.0";

          return `
            <div
              class="d rank${index + 1} ${
                latest === digit ? "hit" : ""
              }"
              title="Digit ${digit}"
            >
              <span class="n">${digit}</span>
              <span class="r">
                #${index + 1} · ${percentage}%
              </span>
            </div>
          `;
        }).join("")}
      </div>

      <div class="movement">
        LATEST DIGIT:
        <b>${latest ?? "WAITING"}</b>

        &nbsp; · &nbsp;

        HIGH MOMENTUM:
        <b>${total ? strongest : "WAITING"}</b>

        &nbsp; · &nbsp;

        MOVEMENT:
        <b>
          ${
            total < 10
              ? "WAITING FOR DATA"
              : latest === strongest
                ? "ON COURSE"
                : "OFF COURSE"
          }
        </b>
      </div>

      <div class="muted" style="margin-top:10px">
        ${total} live ticks analysed.
      </div>

    </div>
  `;
}

/* =========================
   DASHBOARD
========================= */

function dashboard() {
  return `
    <div class="welcome">
      <h1>Welcome back 👋</h1>

      <p class="muted">
        ELISY254 professional workspace ·
        real public Deriv tick stream
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
        <b>${esc(symbol)}</b>
      </div>

      <div class="stat">
        Latest digit
        <b>${latest ?? "—"}</b>
      </div>

      <div class="stat">
        Ticks
        <b>${ticks.length}</b>
      </div>

    </div>

    <div class="section">
      <h2>Trading tools</h2>
      <span class="pill">12 modules</span>
    </div>

    <div class="tools">

      ${F.slice(1).map(f => `
        <button
          class="tool"
          onclick="go('${f[0]}')"
        >
          <div class="ico">${f[1]}</div>

          <h3>${esc(f[2])}</h3>

          <p>${esc(f[3])}</p>
        </button>
      `).join("")}

    </div>

    <div class="section">
      <h2>Digit Analysis</h2>
      <span class="pill">REAL TICKS</span>
    </div>

    ${digitsPanel()}
  `;
}

/* =========================
   PAGE SHELL
========================= */

function pageShell(feature, body) {
  return `
    <div class="welcome">
      <h1>${esc(feature[2])}</h1>

      <p class="muted">
        ${esc(feature[3])}
      </p>
    </div>

    ${body}
  `;
}

/* =========================
   RENDER
========================= */

function render() {
  const feature =
    F.find(x => x[0] === page) || F[0];

  const title = el("#title");

  if (title) {
    title.textContent = feature[2];
  }

  let content = "";

  if (page === "dashboard") {

    content = dashboard();

  } else if (page === "digits") {

    content = pageShell(
      feature,
      digitsPanel()
    );

  } else if (page === "bot_builder") {

    content = pageShell(
      feature,
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
              ].map((step, index) => `
                <div class="step ${
                  index < 3 ? "active" : ""
                }">
                  ${step}
                </div>
              `).join("")
            }
          </div>

          <div class="section">
            <h2>Bot controls</h2>
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

  } else if (page === "ai") {

    content = pageShell(
      feature,
      `
        <div class="panel">

          <h2>AI ANALYSIS</h2>

          <p class="muted">
            AI results are shown only when a real
            provider is configured. No fabricated AI
            signal is displayed.
          </p>

          <div class="movement">
            Current digit engine:
            real Deriv tick data ·
            ${ticks.length} ticks received.
          </div>

        </div>
      `
    );

  } else if (page === "free") {

    content = pageShell(
      feature,
      `<div id="bots" class="botadmin"></div>`
    );

  } else {

    content = pageShell(
      feature,
      `
        <div class="panel">

          <h2>${esc(feature[3])}</h2>

          <p class="muted">
            Production module shell.
            Account-scoped actions require
            authenticated Deriv authorization
            and explicit user confirmation.
          </p>

        </div>
      `
    );
  }

  const contentEl = el("#content");

  if (contentEl) {
    contentEl.innerHTML = content;
  }

  if (page === "free") {
    loadBots();
  }
}

/* =========================
   FREE BOTS
========================= */

async function loadBots() {
  const container = el("#bots");

  if (!container) return;

  try {
    const response = await fetch(
      "/api/bots",
      {
        credentials: "include",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Bot request failed: ${response.status}`
      );
    }

    const bots = await response.json();

    if (!bots.length) {
      container.innerHTML = `
        <div class="panel">
          <h3>No free bots yet</h3>

          <p class="muted">
            Admin can publish bots from /admin.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML = bots.map(bot => `
      <div class="panel">

        <div
          class="circle-preview"
          style="background:${esc(bot.color || "#b9ff3d")}"
        >
          ${esc(
            (bot.name || "B")
              .slice(0, 1)
              .toUpperCase()
          )}
        </div>

        <h3>${esc(bot.name)}</h3>

        <p class="muted">
          ${esc(bot.description)}
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
    `).join("");

  } catch (error) {

    console.error(error);

    container.innerHTML = `
      <div class="panel">

        <h3>Unable to load free bots</h3>

        <p class="muted">
          Please try again.
        </p>

      </div>
    `;
  }
}

/* =========================
   API TOKEN MODAL
========================= */

function tokenModal() {
  const modal = el("#modal");

  if (!modal) return;

  modal.className = "modal";

  modal.innerHTML = `
    <div class="modalbox">

      <h2>API token</h2>

      <p class="muted">
        Enter your Deriv API token only when you
        intentionally want to authenticate with it.
        Never share your token with anyone.
      </p>

      <div class="field">

        <input
          id="apiTokenInput"
          type="password"
          autocomplete="off"
          placeholder="Deriv API token"
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
        style="margin-top:8px"
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
    modal.className = "modal hidden";
  }
}

/*
  IMPORTANT:
  This function does NOT pretend that token
  authentication works if there is no backend
  token-validation endpoint.
*/
async function submitApiToken() {
  const input = el("#apiTokenInput");

  if (!input || !input.value.trim()) {
    alert("Enter a Deriv API token.");
    return;
  }

  alert(
    "API-token authentication is not connected to a backend validation endpoint yet. Use Sign in with Deriv for the current live OAuth login."
  );
}

/* =========================
   AUTHENTICATION CHECK
========================= */

async function checkAuthentication() {
  try {

    const response = await fetch(
      "/api/config",
      {
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Config request failed: ${response.status}`
      );
    }

    const data = await response.json();

    config = data;

    authenticated = data.authenticated === true;

    console.log(
      "ELISY254 authentication:",
      authenticated
    );

    console.log(
      "ELISY254 config:",
      data
    );

    return authenticated;

  } catch (error) {

    console.error(
      "Authentication check failed:",
      error
    );

    authenticated = false;

    return false;
  }
}

/* =========================
   START APPLICATION
========================= */

async function startApp() {

  /*
    FIRST:
    Check the server session.

    This is the important part that fixes
    the OAuth -> landing page problem.
  */

  const loggedIn = await checkAuthentication();

  if (loggedIn) {

    /*
      User has already completed Deriv OAuth.
      Open Dashboard directly.
    */

    page = "dashboard";

  } else {

    /*
      No authenticated session.
      Keep the normal page state.
    */

    page = "dashboard";
  }

  nav();
  render();

  /*
    Start real Deriv public tick stream.
  */

  connectTicks();
}

/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    startApp();
  }
);

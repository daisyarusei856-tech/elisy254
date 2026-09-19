/* =========================================================
   ELISY254
   MAIN APPLICATION
   ========================================================= */


/* =========================================================
   MODULES
   ========================================================= */

const F = [

  [
    "dashboard",
    "⌂",
    "Dashboard",
    "Workspace overview"
  ],

  [
    "bot_builder",
    "🤖",
    "Bot Builder",
    "Build and test bots"
  ],

  [
    "auto_trades",
    "⚡",
    "Auto Trades",
    "Automation controls"
  ],

  [
    "manual",
    "💹",
    "Manual Trading",
    "Manual contract workspace"
  ],

  [
    "tradingview",
    "📊",
    "TradingView",
    "Charts"
  ],

  [
    "bulk",
    "▦",
    "Bulk Trader",
    "Multiple contracts"
  ],

  [
    "copy",
    "👥",
    "Copy Trading",
    "Copy workspace"
  ],

  [
    "ai",
    "🧠",
    "AI Scanner",
    "AI analysis"
  ],

  [
    "free",
    "🆓",
    "Free Bots",
    "Bot library"
  ],

  [
    "analysis",
    "🛠",
    "Analysis Tools",
    "Market tools"
  ],

  [
    "calculator",
    "🧮",
    "Calculator",
    "Calculator"
  ],

  [
    "digits",
    "●",
    "Digit Analysis",
    "Live digit intelligence"
  ]

];


/* =========================================================
   STATE
   ========================================================= */

let page = "dashboard";

let ticks = [];

let latest = null;

let symbol = "R_75";

let ws = null;

let reconnectTimer = null;

let authenticated = false;

let config = null;


/* =========================================================
   HELPERS
   ========================================================= */

function el(selector) {

  return document.querySelector(selector);

}


function esc(value) {

  return String(value ?? "").replace(
    /[&<>"']/g,
    function (m) {

      return {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

      }[m];

    }
  );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function nav() {

  const navElement =
    el("#nav");

  const bottomElement =
    el("#bottom");


  if (navElement) {

    navElement.innerHTML =
      F.map(function (f) {

        return `
          <button
            class="nav ${page === f[0] ? "active" : ""}"
            onclick="go('${f[0]}')"
          >
            ${f[1]}
            &nbsp;
            ${esc(f[2])}
          </button>
        `;

      }).join("");

  }


  if (bottomElement) {

    const mobileItems = [

      F[0],
      F[7],
      F[1],
      F[3],

      [
        "menu",
        "☰",
        "Menu"
      ]

    ];


    bottomElement.innerHTML =
      mobileItems.map(function (f) {

        if (f[0] === "menu") {

          return `
            <button
              onclick="toggleSide()"
            >
              ${f[1]}<br>
              ${f[2]}
            </button>
          `;

        }


        return `
          <button
            class="${page === f[0] ? "active" : ""}"
            onclick="go('${f[0]}')"
          >
            ${f[1]}<br>
            ${f[2]}
          </button>
        `;

      }).join("");

  }

}


function go(nextPage) {

  page = nextPage;

  const side =
    el("#side");

  if (side) {

    side.classList.remove("open");

  }

  nav();

  render();

}


function toggleSide() {

  const side =
    el("#side");

  if (side) {

    side.classList.toggle("open");

  }

}


/* =========================================================
   ACCOUNT
   ========================================================= */

function accountMenu() {

  const modal =
    el("#modal");

  const content =
    el("#modalContent");


  if (!modal || !content) {
    return;
  }


  content.innerHTML = `

    <h2>
      Deriv Account
    </h2>

    <p class="muted">
      Your Deriv account is connected through
      OAuth authentication.
    </p>

    <div class="movement">

      AUTHENTICATED:
      <b>YES</b>

    </div>

    <button
      class="primary"
      style="margin-top:15px"
      onclick="closeModal()"
    >
      Close
    </button>

  `;


  modal.classList.remove("hidden");

}


function closeModal() {

  const modal =
    el("#modal");

  if (modal) {

    modal.classList.add("hidden");

  }

}


/* =========================================================
   DERIV TICKS
   ========================================================= */

function lastDigit(quote) {

  const value =
    String(quote ?? "");


  const match =
    value.match(/(\d)(?!.*\d)/);


  return match
    ? Number(match[1])
    : null;

}


function connectTicks() {

  if (ws) {

    try {

      ws.close();

    }

    catch (_) {}

  }


  try {

    ws = new WebSocket(
      "wss://api.derivws.com/trading/v1/options/ws/public"
    );

  }

  catch (error) {

    console.error(
      "Unable to create WebSocket:",
      error
    );

    scheduleReconnect();

    return;

  }


  ws.onopen = function () {

    console.log(
      "ELISY254: Deriv tick stream connected"
    );


    updateConnection(
      "LIVE"
    );


    ws.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1
      })
    );

  };


  ws.onmessage = function (event) {

    try {

      const data =
        JSON.parse(event.data);


      if (
        data.msg_type === "tick" &&
        data.tick
      ) {

        const digit =
          lastDigit(data.tick.quote);


        if (digit !== null) {

          latest = digit;

          ticks.push(digit);


          if (ticks.length > 300) {

            ticks.shift();

          }


          render();

        }

      }

    }

    catch (error) {

      console.error(
        "Tick processing error:",
        error
      );

    }

  };


  ws.onerror = function (error) {

    console.error(
      "Deriv WebSocket error:",
      error
    );


    updateConnection(
      "RECONNECTING"
    );

  };


  ws.onclose = function () {

    console.log(
      "ELISY254: tick stream closed"
    );


    updateConnection(
      "RECONNECTING"
    );


    scheduleReconnect();

  };

}


function scheduleReconnect() {

  clearTimeout(
    reconnectTimer
  );


  reconnectTimer =
    setTimeout(
      function () {

        connectTicks();

      },
      2500
    );

}


function updateConnection(status) {

  const connectionText =
    el("#connectionText");


  if (connectionText) {

    connectionText.textContent =
      status;

  }


  const marketBadge =
    el("#marketBadge");


  if (marketBadge) {

    marketBadge.textContent =
      status;

  }

}


/* =========================================================
   DIGIT ANALYSIS
   ========================================================= */

function getDigitStats() {

  const counts =
    Array(10).fill(0);


  ticks.forEach(function (digit) {

    if (
      digit >= 0 &&
      digit <= 9
    ) {

      counts[digit]++;

    }

  });


  const total =
    ticks.length;


  const order =
    [...Array(10).keys()]
      .sort(function (a, b) {

        if (
          counts[b] !== counts[a]
        ) {

          return (
            counts[b] -
            counts[a]
          );

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

  const stats =
    getDigitStats();


  const counts =
    stats.counts;

  const order =
    stats.order;

  const total =
    stats.total;


  const strongest =
    total > 0
      ? order[0]
      : null;


  return `

    <div class="panel">

      <div class="digits">

        ${
          order.map(function (
            digit,
            index
          ) {

            const percentage =
              total > 0
                ? (
                    counts[digit] /
                    total *
                    100
                  ).toFixed(1)
                : "0.0";


            return `

              <div
                class="
                  d
                  rank${index + 1}
                  ${latest === digit ? "hit" : ""}
                "
              >

                <span class="n">
                  ${digit}
                </span>

                <span class="r">
                  #${index + 1}
                  ·
                  ${percentage}%
                </span>

              </div>

            `;

          }).join("")
        }

      </div>


      <div class="movement">

        LATEST DIGIT:

        <b>
          ${latest ?? "WAITING"}
        </b>

        &nbsp; · &nbsp;

        HIGH MOMENTUM:

        <b>
          ${total ? strongest : "WAITING"}
        </b>

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


      <div
        class="muted"
        style="margin-top:10px"
      >

        ${total}
        live ticks analysed.

      </div>

    </div>

  `;

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function dashboard() {

  return `

    <div class="welcome">

      <h1>
        Welcome back 👋
      </h1>

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

        <b>
          ${esc(symbol)}
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

      ${
        F.slice(1).map(function (f) {

          return `

            <button
              class="tool"
              onclick="go('${f[0]}')"
            >

              <div class="ico">
                ${f[1]}
              </div>

              <h3>
                ${esc(f[2])}
              </h3>

              <p>
                ${esc(f[3])}
              </p>

            </button>

          `;

        }).join("")
      }

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


/* =========================================================
   PAGE SHELL
   ========================================================= */

function pageShell(
  feature,
  body
) {

  return `

    <div class="welcome">

      <h1>
        ${esc(feature[2])}
      </h1>

      <p class="muted">
        ${esc(feature[3])}
      </p>

    </div>

    ${body}

  `;

}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

  /*
   * Never render the application if the user
   * is not authenticated.
   */

  if (
    window.ELISY_AUTHENTICATED === false
  ) {

    return;

  }


  const feature =
    F.find(function (item) {

      return item[0] === page;

    }) || F[0];


  const title =
    el("#title");


  if (title) {

    title.textContent =
      feature[2];

  }


  let content = "";


  if (page === "dashboard") {

    content =
      dashboard();

  }


  else if (page === "digits") {

    content =
      pageShell(
        feature,
        digitsPanel()
      );

  }


  else if (
    page === "bot_builder"
  ) {

    content =
      pageShell(
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
                ].map(function (
                  step,
                  index
                ) {

                  return `

                    <div
                      class="
                        step
                        ${index < 3 ? "active" : ""}
                      "
                    >
                      ${step}
                    </div>

                  `;

                }).join("")
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

    content =
      pageShell(
        feature,

        `

          <div class="panel">

            <h2>
              AI ANALYSIS
            </h2>

            <p class="muted">

              AI results are shown only when
              a real provider is configured.
              No fabricated AI signal is displayed.

            </p>


            <div class="movement">

              Current digit engine:

              real Deriv tick data ·

              ${ticks.length}
              ticks received.

            </div>

          </div>

        `
      );

  }


  else if (page === "free") {

    content =
      pageShell(
        feature,
        `<div id="bots"></div>`
      );

  }


  else {

    content =
      pageShell(
        feature,

        `

          <div class="panel">

            <h2>
              ${esc(feature[3])}
            </h2>

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


  const contentElement =
    el("#content");


  if (contentElement) {

    contentElement.innerHTML =
      content;

  }


  if (page === "free") {

    loadBots();

  }

}


/* =========================================================
   FREE BOTS
   ========================================================= */

async function loadBots() {

  const container =
    el("#bots");


  if (!container) {
    return;
  }


  try {

    const response =
      await fetch(
        "/api/bots",
        {
          credentials: "include",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Bot request failed: " +
        response.status
      );

    }


    const bots =
      await response.json();


    if (!bots.length) {

      container.innerHTML = `

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

      return;

    }


    container.innerHTML =
      bots.map(function (bot) {

        return `

          <div class="panel">

            <div
              class="circle-preview"
              style="
                background:${esc(
                  bot.color ||
                  "#b9ff3d"
                )}
              "
            >

              ${
                esc(
                  (
                    bot.name ||
                    "B"
                  )
                  .slice(0, 1)
                  .toUpperCase()
                )
              }

            </div>


            <h3>
              ${esc(bot.name)}
            </h3>


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

        `;

      }).join("");

  }

  catch (error) {

    console.error(
      "Free bot error:",
      error
    );


    container.innerHTML = `

      <div class="panel">

        <h3>
          Unable to load free bots
        </h3>

        <p class="muted">
          Please try again.
        </p>

      </div>

    `;

  }

}


/* =========================================================
   API TOKEN
   ========================================================= */

function tokenModal() {

  const modal =
    el("#modal");

  const content =
    el("#modalContent");


  if (!modal || !content) {
    return;
  }


  content.innerHTML = `

    <h2>
      API Token
    </h2>

    <p class="muted">

      API-token authentication requires
      server-side token validation.

      Your token should never be shared
      with another person.

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
      style="margin-top:12px"
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

  `;


  modal.classList.remove(
    "hidden"
  );

}


async function submitApiToken() {

  const input =
    el("#apiTokenInput");


  if (
    !input ||
    !input.value.trim()
  ) {

    alert(
      "Enter a Deriv API token."
    );

    return;

  }


  /*
   * Do not fake authentication.
   *
   * The current backend has OAuth
   * authentication implemented.
   *
   * Token authentication should be
   * connected to a real backend
   * validation endpoint before accepting
   * tokens.
   */

  alert(
    "API-token authentication is not connected to the backend yet. Please use Sign in with Deriv."
  );

}


/* =========================================================
   AUTHENTICATION CHECK
   ========================================================= */

async function checkAuthentication() {

  try {

    const response =
      await fetch(
        "/api/config?_=" +
        Date.now(),
        {
          method: "GET",

          credentials: "include",

          cache: "no-store",

          headers: {
            "Accept":
              "application/json",

            "Cache-Control":
              "no-cache"
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "Config request failed: " +
        response.status
      );

    }


    const data =
      await response.json();


    config =
      data;


    authenticated =
      data.authenticated === true;


    window.ELISY_CONFIG =
      data;


    window.ELISY_AUTHENTICATED =
      authenticated;


    console.log(
      "ELISY254 AUTH:",
      authenticated
    );


    return authenticated;

  }

  catch (error) {

    console.error(
      "Authentication check error:",
      error
    );


    authenticated = false;

    window.ELISY_AUTHENTICATED =
      false;


    return false;

  }

}


/* =========================================================
   START APPLICATION
   ========================================================= */

async function startApp() {

  /*
   * The index.html boot controller already checked
   * the session, but we check once more here so
   * app.js never assumes authentication.
   */

  const loggedIn =
    await checkAuthentication();


  if (!loggedIn) {

    /*
     * Keep application hidden.
     */

    const application =
      el("#applicationScreen");


    if (application) {

      application.classList.add(
        "screen-hidden"
      );

    }


    return;

  }


  /*
   * AUTHENTICATED
   *
   * Always open Dashboard.
   */

  page =
    "dashboard";


  const landing =
    el("#landingScreen");


  const application =
    el("#applicationScreen");


  if (landing) {

    landing.classList.add(
      "screen-hidden"
    );

  }


  if (application) {

    application.classList.remove(
      "screen-hidden"
    );

  }


  /*
   * Build application.
   */

  nav();

  render();


  /*
   * Connect to the real public
   * Deriv tick stream.
   */

  connectTicks();

}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    startApp
  );

}

else {

  startApp();

  }

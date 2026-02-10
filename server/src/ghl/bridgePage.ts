export function ghlBridgePage(opts: { postUrl: string }) {
  const postUrl = opts.postUrl;

  // The bookmarklet extracts authToken from the Vue store and POSTs it to the local server.
  // This is intentionally "best-effort" because GHL's frontend store shape changes.
  const bookmarkletJs =
    "javascript:void(" +
    "(function(){" +
    "try{" +
    "var app=document.querySelector('#app');" +
    "var vue=app&&app.__vue_app__;" +
    "if(!vue){alert('Not on a GHL page (no Vue app found)');return;}" +
    "var st=vue.config&&vue.config.globalProperties&&vue.config.globalProperties.$store&&vue.config.globalProperties.$store.state;" +
    "if(!st){alert('No store state found. Are you logged in?');return;}" +
    "var u=(st.auth&&st.auth.user)||{};" +
    "var authToken=u.authToken||'';" +
    "if(!authToken){alert('No authToken found. Are you logged in?');return;}" +
    // Best-effort location id discovery.
    "var locationId=u.locationId||" +
    "(st.location&&st.location.locationId)||" +
    "(st.location&&st.location.id)||" +
    "(st.locations&&st.locations.selectedLocationId)||" +
    "(st.selectedLocationId)||" +
    "'';" +
    "var d={authToken:authToken,companyId:u.companyId||'',userId:u.id||'',locationId:locationId||''};" +
    "fetch('" + postUrl + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})" +
    ".then(function(r){if(r.ok)alert('Token captured! You can close this tab.'); else r.text().then(function(t){alert('Error: '+t)})})" +
    ".catch(function(e){alert('Could not reach bridge server: '+e);});" +
    "}catch(e){alert('Bridge error: '+e);}" +
    "})()" +
    ")";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>MaxLevel Connect — GHL Token Bridge</title>
    <style>
      :root { --bg1:#0ea5e9; --bg2:#0f766e; --ink:#0f172a; --muted:#475569; --card: rgba(255,255,255,0.92); }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px;
        background: radial-gradient(900px 520px at 15% 10%, rgba(14,165,233,0.55), transparent 60%),
                    radial-gradient(900px 520px at 85% 10%, rgba(15,118,110,0.35), transparent 60%),
                    linear-gradient(135deg, #0b1220, #0b1b2a);
        color: white;
      }
      .card {
        width: 100%;
        max-width: 760px;
        border-radius: 18px;
        background: var(--card);
        color: var(--ink);
        border: 1px solid rgba(255,255,255,0.28);
        box-shadow: 0 30px 90px rgba(0,0,0,0.35);
        overflow: hidden;
      }
      header {
        padding: 18px 22px;
        background: linear-gradient(90deg, rgba(14,165,233,0.12), rgba(15,118,110,0.10));
        border-bottom: 1px solid rgba(15,23,42,0.08);
      }
      h1 { margin: 0; font-size: 18px; letter-spacing: -0.02em; }
      .sub { margin-top: 6px; font-size: 13px; color: var(--muted); line-height: 1.5; }
      main { padding: 20px 22px 24px; }
      .bookmarklet {
        display: inline-block;
        padding: 12px 16px;
        border-radius: 12px;
        font-weight: 800;
        letter-spacing: 0.01em;
        text-decoration: none;
        color: white;
        background: linear-gradient(135deg, var(--bg1), var(--bg2));
        box-shadow: 0 14px 40px rgba(14,165,233,0.25);
        cursor: grab;
        user-select: none;
      }
      .bookmarklet:active { cursor: grabbing; transform: translateY(1px); }
      .steps {
        margin-top: 14px;
        padding: 14px 16px;
        background: #f8fafc;
        border-radius: 14px;
        border: 1px solid rgba(15,23,42,0.08);
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        background: rgba(2,132,199,0.08);
        padding: 2px 6px;
        border-radius: 8px;
        color: #0e7490;
      }
      .note {
        margin-top: 14px;
        font-size: 12px;
        color: #64748b;
      }
      .status {
        margin-top: 14px;
        padding: 10px 12px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 13px;
        border: 1px solid rgba(15,23,42,0.10);
        background: #fff7ed;
        color: #9a3412;
      }
      .status.ok { background: #ecfdf5; color: #047857; }
    </style>
  </head>
  <body>
    <div class="card">
      <header>
        <h1>Connect GoHighLevel</h1>
        <div class="sub">
          This bridge captures your current session token from <strong>app.gohighlevel.com</strong> and stores it locally
          so MaxLevel can execute real workflows. Use only on accounts you own/admin.
        </div>
      </header>
      <main>
        <div>
          <div style="font-size:12px;color:#64748b;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Bookmarklet</div>
          <div style="margin-top:10px;">
            <a class="bookmarklet" href="${bookmarkletJs}">MaxLevel Capture Token</a>
          </div>
        </div>

        <div class="steps">
          <ol style="margin:0;padding-left:18px;">
            <li>Drag the button above to your bookmarks bar.</li>
            <li>Open <code>https://app.gohighlevel.com</code> and log in.</li>
            <li>Click the bookmarklet.</li>
            <li>Come back to MaxLevel and run the workflow.</li>
          </ol>
        </div>

        <div id="status" class="status">Waiting for token...</div>
        <div class="note">If you don’t see a success alert, check that your bookmarks bar is visible and you clicked the saved bookmark while on a GHL page.</div>
      </main>
    </div>

    <script>
      (function poll() {
        fetch('/api/integrations/ghl/status')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var el = document.getElementById('status');
            if (!el) return;
            if (d && d.connected) {
              el.className = 'status ok';
              el.textContent = 'Connected. You can close this tab.';
            } else {
              el.className = 'status';
              el.textContent = 'Waiting for token...';
            }
          })
          .catch(function(){});
        setTimeout(poll, 2000);
      })();
    </script>
  </body>
</html>`;
}


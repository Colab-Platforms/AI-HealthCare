// Pure HTML for the in-app WebView. Every dynamic value is escaped: HTML text
// via esc(), values inside <script> via jsonForScript() (no "</script>" break-out).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');

const jsonForScript = (v) => JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LS, '\\u2028')
    .replace(PS, '\\u2029');

const shell = ({ title, head = '', body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111;
         min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
  main { padding: 24px 16px; max-width: 420px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 15px; line-height: 1.5; opacity: .8; margin: 0 0 20px; }
  .btn { display: inline-block; border: 0; border-radius: 10px; padding: 14px 24px; font-size: 16px; font-weight: 600;
         background: #111; color: #fff; text-decoration: none; cursor: pointer; }
  @media (prefers-color-scheme: dark) { .btn { background: #eee; color: #111; } }
  .spinner { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid rgba(127,127,127,.3); border-top-color: currentColor;
             border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  [hidden] { display: none !important; }
</style>
${head}
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;

/**
 * Loads Fastrr's checkout JS and opens checkout straight away. If the automatic
 * start is blocked (some WebViews want a real tap), a button does the same.
 */
const renderCheckoutPage = ({ token, uiBaseUrl, fallbackUrl, amountText }) => shell({
    title: 'Checkout',
    head: `<link rel="stylesheet" href="${esc(uiBaseUrl)}/assets/styles/shopify.css">`,
    body: `
<div id="loading"><div class="spinner"></div><h1>Opening secure checkout…</h1><p>${esc(amountText)}</p></div>
<div id="manual" hidden><h1>Continue to payment</h1><p>${esc(amountText)}</p><button id="buyNow" class="btn" type="button">Continue</button></div>
<div id="failed" hidden><h1>Checkout could not load</h1><p>Please check your connection and try again.</p><button class="btn" type="button" onclick="location.reload()">Try again</button></div>
<script>
(function () {
  var TOKEN = ${jsonForScript(token)};
  var OPTS = ${jsonForScript({ fallbackUrl, isInitiatedFromApp: true })};
  function show(id) { ['loading', 'manual', 'failed'].forEach(function (x) { document.getElementById(x).hidden = x !== id; }); }
  function start(evt) {
    try { window.HeadlessCheckout.addToCart(evt, TOKEN, OPTS); return true; } catch (e) { return false; }
  }
  document.getElementById('buyNow').addEventListener('click', function (e) { if (!start(e)) show('failed'); });
  window.__onCheckoutJs = function () {
    if (!window.HeadlessCheckout) { show('failed'); return; }
    var evt; try { evt = new MouseEvent('click', { bubbles: true, cancelable: true }); } catch (e) { evt = document.createEvent('Event'); evt.initEvent('click', true, true); }
    if (!start(evt)) show('manual');
    // If Fastrr's UI hasn't taken over shortly, offer the button.
    setTimeout(function () { if (!document.getElementById('loading').hidden) show('manual'); }, 6000);
  };
  window.__onCheckoutJsError = function () { show('failed'); };
})();
</script>
<script src="${esc(uiBaseUrl)}/assets/js/channels/shopify.js" onload="window.__onCheckoutJs()" onerror="window.__onCheckoutJsError()"></script>`,
});

/**
 * Hands control back to the app via its deep link. The app should also catch
 * this URL in its WebView navigation delegate; the deep link is the backup.
 */
const renderReturnPage = ({ deepLink, title, message }) => shell({
    title,
    body: `
<h1>${esc(title)}</h1>
<p>${esc(message)}</p>
<a class="btn" href="${esc(deepLink)}">Back to app</a>
<script>
(function () { var L = ${jsonForScript(deepLink)}; setTimeout(function () { window.location.replace(L); }, 300); })();
</script>`,
});

const renderMessagePage = ({ title, message, deepLink = null }) => shell({
    title,
    body: `
<h1>${esc(title)}</h1>
<p>${esc(message)}</p>
${deepLink ? `<a class="btn" href="${esc(deepLink)}">Back to app</a>` : ''}`,
});

module.exports = { renderCheckoutPage, renderReturnPage, renderMessagePage, esc, jsonForScript };

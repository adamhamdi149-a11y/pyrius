/**
 * Hand-off page for the mobile app's Book button. Google Flights' booking redirect only accepts a form
 * POST, which an in-app browser can't send by itself, so the app opens this page with the redirect in
 * the URL fragment. The fragment never reaches the server; the page checks it is Google's booking
 * redirect, then submits the form, and the seller's own page loads with the itinerary.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Opening your booking · Pyrius</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090a0d;color:#f5f5f7;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
  .b{text-align:center;padding:24px;max-width:380px}
  .s{width:34px;height:34px;margin:0 auto 18px;border-radius:50%;border:3px solid #262730;border-top-color:#ff7628;animation:r .9s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  p{margin:0;color:#9899a6}
</style>
</head>
<body>
<div class="b"><div class="s"></div><p id="m">Opening the seller's booking page…</p></div>
<script>
(function () {
  var m = document.getElementById("m");
  try {
    var req = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    var u = new URL(req.url);
    if (u.protocol !== "https:" || u.hostname !== "www.google.com" || u.pathname.indexOf("/travel/clk") !== 0) throw new Error("not a booking link");
    var f = document.createElement("form");
    f.method = "POST";
    f.action = u.toString();
    (req.fields || []).forEach(function (kv) {
      var i = document.createElement("input");
      i.type = "hidden";
      i.name = String(kv[0]);
      i.value = String(kv[1]);
      f.appendChild(i);
    });
    document.body.appendChild(f);
    f.submit();
  } catch (e) {
    m.textContent = "This booking link didn't work. Go back to Pyrius and tap Book again.";
  }
})();
</script>
</body>
</html>`;

export function GET() {
  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

"use strict";

const http = require("http");
const util = require("./lib/util");
const server = require("prerender/lib/server");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const compression = require("compression");
const morgan = require("morgan");

server.init({
  chromeFlags: [ '--no-sandbox', '--headless', '--disable-gpu', '--remote-debugging-port=9222', '--hide-scrollbars' ],
});
server.onRequest = server.onRequest.bind(server);

morgan.token("request_id", function(req, res) {
  const rhdr = process.env.REQUEST_ID_HEADER;
  if (rhdr && req.headers[rhdr]) {
    return req.headers[rhdr];
  }
  return "unknown";
});

morgan.token("cache_type", function(req, res) {
  if (req.prerender) {
    return req.prerender.cacheHit ? "CACHE_HIT" : "CACHE_MISS";
  }
  return "-";
});

morgan.token("prerender_url", function(req, res) {
  return (req.prerender && req.prerender.url) || "-";
});

app.use(
  morgan(
    `:date[iso] method=:method status=:status url=:url prerender_url=:prerender_url cache_type=:cache_type timing=:response-time[0] referrer=":referrer" user_agent=":user-agent" request_id=:request_id`
  )
);
app.disable("x-powered-by");
app.use(compression());

app.get("/health", (req, res) => res.status(200).end());
app.get("*", server.onRequest);

//dont check content-type and just always try to parse body as json
app.post("*", bodyParser.json({ type: () => true }), server.onRequest);

app.use(function(err, req, res, next) {
  res.status(500).end();
  util.log(`Unhandled request error error=${err} stack=${err.stack}`);
});


server.use(require("prerender/lib/plugins/blockResources"));
server.use(require("prerender/lib/plugins/blacklist"));
server.use(require("prerender/lib/plugins/removeScriptTags"));
server.use(require("prerender/lib/plugins/httpHeaders"));
server.use(require('prerender-redis-cache'));

server.start();

process.on("SIGHUP", () => {
  server.gracefulBrowserRestart();
});

const port = process.env.PORT || 2888;
app.listen(port, () =>
  util.log(`Prerender server accepting requests on port ${port}`)
);

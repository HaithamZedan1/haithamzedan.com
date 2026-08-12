# haithamzedan.com

A personal site that publishes the same facts twice: as a page a person can read, and as structured data an AI agent can query. No framework, no build step for the site itself, no dependencies.

```
index.html            the site — bilingual AR/EN, live agent-inspector rail
llms.txt              index for agents
llms-full.txt         whole profile as one document (generated)
build.mjs             regenerates llms-full.txt from api/
robots.txt            explicitly allows named AI crawlers
sitemap.xml
api/                  the JSON endpoints — single source of truth
.well-known/mcp.json  MCP discovery manifest
mcp-server/server.mjs MCP server, stdio + streamable HTTP, zero deps
```

## The one rule

`api/*.json` is the source of truth. Everything else is derived from it or points at it.

When you change a fact:

1. Edit the relevant file in `api/`
2. Run `node build.mjs` to regenerate `llms-full.txt`
3. Update the matching copy in `index.html` (the HTML holds its own text so the page works without JS)
4. Restart the MCP server — it reads `api/` at boot

## Deploying on your VPS

Nginx server block:

```nginx
server {
    listen 443 ssl http2;
    server_name haithamzedan.com;

    root /var/www/haithamzedan.com;
    index index.html;

    # Agents need CORS to read the JSON from a browser context
    location /api/ {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=3600";
        default_type application/json;
    }

    location = /llms.txt      { default_type text/plain; add_header Access-Control-Allow-Origin "*" always; }
    location = /llms-full.txt { default_type text/plain; add_header Access-Control-Allow-Origin "*" always; }

    location /.well-known/ {
        add_header Access-Control-Allow-Origin "*" always;
        default_type application/json;
    }

    # MCP server runs behind the same domain
    location /mcp {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }

    location / { try_files $uri $uri/ =404; }
}
```

Keep the MCP server alive with systemd — `/etc/systemd/system/haitham-mcp.service`:

```ini
[Unit]
Description=Haitham Zedan MCP server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/haithamzedan.com/mcp-server
ExecStart=/usr/bin/node server.mjs --http --port 8787
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now haitham-mcp
```

## Testing it

```bash
# The JSON layer
curl https://haithamzedan.com/api/profile.json
curl https://haithamzedan.com/llms.txt

# The MCP layer
curl https://haithamzedan.com/mcp
curl -X POST https://haithamzedan.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -X POST https://haithamzedan.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"fraud"}}}'
```

Run the server locally over stdio to test it in an MCP client:

```bash
node mcp-server/server.mjs
```

## Before you go live

- Replace `haithamzedan.com` throughout (`index.html`, `robots.txt`, `sitemap.xml`) with your real domain.
- **Fill in the four certificate links.** `index.html` has four placeholders — search for `CERT_URL_`:
  - `CERT_URL_IBM_DEVOPS` — IBM Applied DevOps Engineering
  - `CERT_URL_META_BACKEND` — Meta Back-End Developer
  - `CERT_URL_IBM_FLUTTER` — IBM Flutter and Dart
  - `CERT_URL_LARAVEL` — Board Infinity, Mastering Laravel

  Coursera certificates live at `coursera.org/account/accomplishments/professional-cert/<ID>`; IBM badges are on Credly. Easiest source is your own LinkedIn "Licenses & certifications" section, where the credential URLs are already stored.
- Fill in the store URLs in `api/projects.json` — they're `null` right now. Two live apps is your strongest claim and an agent can't cite what isn't there.
- Decide whether your email belongs in public JSON (`api/profile.json`, `llms.txt`). Scrapers will find it; an alias is the alternative.

## Portrait

`assets/` holds three sizes generated from your original photo: 560px (hero, via srcset), 280px (mobile), 96px (nav avatar and favicon). To swap the photo, replace all three at the same dimensions — the HTML references them by filename.

## External links

`index.html` adds `target="_blank" rel="noopener noreferrer"` at runtime to every link that leaves the page. In-page anchors and `mailto:` stay in the same tab. Nothing to configure — the rule keys off `location.hostname`, so it keeps working after you change domains.

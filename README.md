# Landing Page

## Internal website analytics

The private analytics dashboard is available at `/analytics`. Public page views
are recorded automatically in a local SQLite database. Static files, API calls,
bots, admin pages, failed requests, and visitors with Do Not Track enabled are
not counted. Raw IP addresses are never stored.

The dashboard menu separates Overview, Engagement, Audience, and Security.
Reports support today, 7-day, 30-day, 90-day, current-month, and custom date
ranges, with comparisons against the immediately preceding period. The
selected section is kept in the URL hash so it can be bookmarked. Printing
includes every section, and CSV export includes the summary, pages, actions,
countries, and security activity for the selected range.

A visit groups activity until the visitor is inactive for 30 minutes. The
dashboard also records anonymous product views, inquiry/contact opens, chat
opens, support concerns, job views, application starts, and successful inquiry,
contact, and application submissions.
Form names, email addresses, phone numbers, messages, and uploaded files are
never copied into analytics.

Average visit duration counts active time while a public page is visible.
Engagement heartbeats stop after inactivity and while the page is hidden.
Bounce rate means a one-page visit with less than 10 seconds of active time and
no recorded action.

Country reporting stores only the two-letter country code. It first uses a
country header supplied by a trusted CDN or hosting proxy, then falls back to
the Country API in a background request. Raw IP addresses are never written to
the analytics database. Existing visits recorded before this feature remain
listed as `Unknown`.

The dashboard also reports known crawlers, suspected automation, and
suspicious-request signals separately from normal visitor analytics. It
recognizes scanner paths, HTTP 401/403 blocks, HTTP 429 rate limits, and
high-volume flagged traffic. Signals receive informational, warning, or
critical review priorities and explain which rule matched. Repeated identical
signals are aggregated by minute. Raw IP addresses and user-agent strings are
not stored; source counts use a salted one-way hash. These signals are useful
for spotting trends, but they are not proof that a request was a malicious
attack.

Only known public routes are included in traffic totals. Invalid routes and
soft-404 history are retained but marked non-reportable. A browser is
automatically excluded from visitor analytics after a successful analytics
administrator sign-in. Office IP addresses or CIDR ranges can also be excluded with
`ANALYTICS_INTERNAL_IPS`, using comma-separated values.

Configure these environment variables before using the dashboard:

```text
SECRET_KEY=replace-with-a-long-random-value
ANALYTICS_ADMIN_USERNAME=admin
ANALYTICS_ADMIN_PASSWORD_HASH=replace-with-a-werkzeug-password-hash
ANALYTICS_HASH_SALT=replace-with-a-separate-long-random-value
ANALYTICS_TIMEZONE=Asia/Manila
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_INTERNAL_IPS=
ANALYTICS_SECURITY_SPIKE_THRESHOLD=30
```

Country lookup is enabled by default with `https://api.country.is/{ip}`. To
disable the external fallback and use hosting/CDN country headers only, add an
empty `ANALYTICS_COUNTRY_LOOKUP_URL` environment variable.

Generate the password hash locally:

```powershell
.\.venv\Scripts\python.exe -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-password'))"
```

For development only, `ANALYTICS_ADMIN_PASSWORD` can be used instead of the
hashed password variable. The optional `ANALYTICS_DB_PATH` variable changes the
database location; it defaults to `instance/website_analytics.sqlite3`.

### Analytics database backup

For a consistent cPanel backup, stop or restart the Python application,
download `instance/website_analytics.sqlite3` through File Manager, and then
start the application again. If the application cannot be stopped, download
the database together with any matching `-wal` and `-shm` files. Keep analytics
backups outside the public web root and protect them like other administrative
data.

## Production security

Set these environment variables in the cPanel Python application:

```text
FLASK_ENV=production
CANONICAL_BASE_URL=https://www.qcstyro.com
SESSION_COOKIE_SECURE=true
FORCE_HTTPS=true
TRUSTED_PROXY_HOPS=1
HSTS_MAX_AGE=31536000
ANALYTICS_LOGIN_MAX_ATTEMPTS=5
ANALYTICS_LOGIN_WINDOW_SECONDS=900
ANALYTICS_LOGIN_LOCK_SECONDS=900
```

Also enable **Force HTTPS Redirect** for `qcstyro.com` and `www.qcstyro.com` in
cPanel's Domains screen. The hosting proxy may report an HTTP visitor to Flask
as an internal HTTPS request, so the web-server redirect is required in
addition to the application redirect.

`HSTS_INCLUDE_SUBDOMAINS` defaults to false. Enable it only after confirming
that every current and future subdomain supports HTTPS. Local HTTP development
can explicitly use `SESSION_COOKIE_SECURE=false`, `FORCE_HTTPS=false`, and
`TRUSTED_PROXY_HOPS=0`.

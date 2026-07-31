# Landing Page

## Internal website analytics

The private analytics dashboard is available at `/analytics`. Public page views
are recorded automatically in a local SQLite database. Static files, API calls,
bots, admin pages, failed requests, and visitors with Do Not Track enabled are
not counted. Raw IP addresses are never stored.

A visit groups activity until the visitor is inactive for 30 minutes. The
dashboard also records anonymous product views, inquiry/contact opens, chat and
jobs interest, and successful inquiry, contact, and application submissions.
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

Configure these environment variables before using the dashboard:

```text
SECRET_KEY=replace-with-a-long-random-value
ANALYTICS_ADMIN_USERNAME=admin
ANALYTICS_ADMIN_PASSWORD_HASH=replace-with-a-werkzeug-password-hash
ANALYTICS_HASH_SALT=replace-with-a-separate-long-random-value
ANALYTICS_TIMEZONE=Asia/Manila
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

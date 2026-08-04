# Microsoft OAuth2 Setup for the Email Client

Microsoft has disabled basic authentication for IMAP on Microsoft 365, so an M365 mailbox
(including GoDaddy-hosted M365) cannot be added with a username and password. It has to be
connected with OAuth2 instead. Gmail and other IMAP providers are unaffected and still use the
manual form.

You only have to do this once, and it produces two values for `.env.local`.

## 1. Register an app in Microsoft Entra ID

1. Go to <https://entra.microsoft.com> and sign in with your M365 admin account.
   - If that does not work, try <https://portal.azure.com> → Azure Active Directory → App
     registrations.
   - With GoDaddy-hosted M365, sign in with the `newsletter@lhmac.org` credentials.

2. **Identity → Applications → App registrations → New registration**

3. Fill in:
   - **Name**: `LHMAC Email Client`
   - **Supported account types**: *Accounts in any organizational directory* (multi-tenant)
   - **Redirect URI**: leave blank for now — step 5 adds them all together
   - Click **Register**

4. On the overview page, copy the **Application (client) ID**.

5. **Authentication → Add a platform → Web**, then add one redirect URI per environment you use:

   | Environment | Redirect URI |
   |---|---|
   | Local dev | `http://localhost:3000/api/email/oauth/callback` |
   | This server (LAN) | `http://YOUR_SERVER_IP:9080/api/email/oauth/callback` |
   | Production | `https://lhmac.info/api/email/oauth/callback` |

   These must match **byte for byte** — protocol, port, and no trailing slash. A mismatch gives
   `AADSTS50011: The redirect URI specified in the request does not match`.

   > Entra only accepts **https** redirect URIs, with `http://localhost` as the sole exception.
   > `http://lhmac.info/...` cannot be registered — it must be `https://`. The site already serves
   > HTTPS, so use that.

6. **Certificates & secrets → Client secrets → New client secret**
   - Description: `email-client`, Expiry: 24 months
   - Copy the **Value** immediately — it is never shown again. (Copy the *Value*, not the
     *Secret ID*.)

7. **API permissions → Add a permission → APIs my organization uses**, search for
   **Office 365 Exchange Online**, choose **Delegated permissions**, and add:
   - `IMAP.AccessAsUser.All`
   - `SMTP.SendAsApp` is *not* what you want — use `SMTP.Send`

   Then **Add a permission → Microsoft Graph → Delegated** and add:
   - `offline_access` (without this there is no refresh token and the connection dies after an hour)
   - `openid`, `email`, `profile`

   Click **Grant admin consent** if the button is available.

   > These scopes live under `https://outlook.office365.com/`, **not**
   > `https://graph.microsoft.com/`. Graph scopes do not work for IMAP XOAUTH2 — this is the most
   > common reason the connection fails with `AUTHENTICATE failed`.

## 2. Add the credentials

Put these in `.env.local`:

```
MICROSOFT_CLIENT_ID=<application (client) ID from step 4>
MICROSOFT_CLIENT_SECRET=<secret Value from step 6>
MICROSOFT_REDIRECT_URI=http://YOUR_SERVER_IP:9080/api/email/oauth/callback
```

`MICROSOFT_REDIRECT_URI` must be whichever row of the table above matches how you reach the site.
The settings page shows the value the server is currently sending, so you can compare it against
Azure without guessing.

Restart the app after editing: `sudo systemctl restart lhmac-site`.

## 3. Connect the mailbox

Admin → **Admin Email** → **Settings** → **Connect with Microsoft**. You will be sent to Microsoft
to sign in and consent, then returned to the settings page with the mailbox added and tested.

## How it behaves afterwards

- Access tokens last about an hour. The app refreshes them automatically before each sync, and the
  scheduler also refreshes every 30 minutes.
- Refresh tokens last ~90 days, and Microsoft may issue a replacement on each refresh — the app
  stores whichever it is given.
- If the refresh token is revoked (password change, admin action, 90 days idle), the mailbox is
  flagged and the settings page shows a **Reconnect** button. Sync stops for that mailbox until you
  reconnect; nothing else is affected.
- Tokens are encrypted at rest with the same AES-256-GCM key as everything else
  (`EMAIL_ENCRYPTION_KEY`).

## Troubleshooting

| Symptom | Cause |
|---|---|
| `AADSTS50011` redirect mismatch | `MICROSOFT_REDIRECT_URI` differs from Azure. Compare the value shown on the settings page. |
| `AADSTS65001` consent required | Admin consent not granted, or `prompt=consent` was skipped. Reconnect. |
| IMAP `AUTHENTICATE failed` after a successful sign-in | Graph scopes used instead of `outlook.office365.com` ones. |
| No refresh token returned | `offline_access` missing from the app registration. |
| `invalid_client` | Secret **ID** was copied instead of the secret **Value**, or the secret expired. |
| Mail **arrives** but nothing **sends** (`535 5.7.139 SmtpClientAuthentication is disabled`) | SMTP AUTH is off. See below — this is separate from IMAP and from OAuth. |

## Sending: SMTP AUTH has to be switched on separately

Reading mail working does **not** mean sending will. Microsoft 365 disables SMTP client
authentication by default, at both tenant and mailbox level, and the OAuth token alone does not
override it. A mailbox can sync perfectly over IMAP and still refuse every send.

Symptoms: the mailbox looks healthy, sync is current, but member welcome emails and blasts fail with
`535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant`.

Enable it in two places:

1. **Tenant** — Microsoft 365 admin centre → *Settings → Org settings → Modern authentication* →
   tick **Authenticated SMTP**.
2. **Mailbox** — in Exchange Online PowerShell:
   ```powershell
   Set-CASMailbox -Identity newsletter@lhmac.org -SmtpClientAuthenticationDisabled $false
   ```

Changes can take up to an hour to apply. Verify with **Admin → New Member Emails → Send test**,
which sends a sample welcome email and reports the exact SMTP error if it fails.

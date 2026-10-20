# Alertmanager Secrets

This directory contains external credentials for Alertmanager notification receivers (Slack webhook URLs and SMTP passwords).

## Security Notice: Never Commit Secrets!

All real secret files in this directory are git-ignored by the project's root `.gitignore`. Only this `README.md` and the `*.example` placeholder templates are tracked in git.

To verify that your secret files will never be tracked or committed:
```bash
git check-ignore alertmanager/secrets/slack_webhook_url alertmanager/secrets/smtp_password
```

---

## Slack Integration

1. Create an Incoming Webhook in your Slack workspace (https://api.slack.com/messaging/webhooks).
2. Create a file named `alertmanager/secrets/slack_webhook_url` containing only your webhook URL:
   ```text
   https://hooks.slack.com/your-workspace-token
   ```
   (No trailing newline or spaces).
3. In your `.env` file, set:
   ```env
   ALERTMANAGER_CONFIG=alertmanager.slack.example.yml
   ```
4. Restart Alertmanager:
   ```bash
   docker compose up -d alertmanager
   ```

---

## Email (SMTP) Integration

1. Obtain your SMTP server credentials from your provider (e.g., SendGrid, Mailgun, Amazon SES, or Gmail App Password).
2. Create a file named `alertmanager/secrets/smtp_password` containing only your SMTP password:
   ```text
   your_smtp_app_password_here
   ```
3. Update `alertmanager/alertmanager.email.example.yml` with your SMTP server (`smtp_smarthost`), sender address (`smtp_from`), recipient (`to`), and username (`smtp_auth_username`).
4. In your `.env` file, set:
   ```env
   ALERTMANAGER_CONFIG=alertmanager.email.example.yml
   ```
5. Restart Alertmanager:
   ```bash
   docker compose up -d alertmanager
   ```

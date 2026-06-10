# SPAM Purge

SPAM Purge is a self-hosted web application that instantly and permanently deletes emails from your Gmail SPAM folder, bypassing Google's standard 30-day countdown.

It runs 24/7 on an always-on VM (like Hetzner) as a systemd service, monitoring your spam folder and calling the Gmail API's `batchDelete` method to purge junk emails immediately as they arrive.

## Features

- 🕒 **Real-Time Automated Purging**: An active background scheduler deletes spam continuously around the clock.
- 📊 **Interactive Dashboard**: View real-time spam counts, historical deletion statistics, and logs.
- ⚡ **One-Click Manual Purge**: Instantly clear your spam folder on demand.
- 🔒 **Secure Google OAuth**: Authenticate directly with Google APIs using your own Google Cloud Developer credentials.
- 🛠️ **Automated Installer**: Set up the entire stack (Node, PostgreSQL, Caddy/Nginx) with a single command.

---

## Technical Stack

- **Monorepo Manager**: `pnpm` workspaces
- **Backend**: Node.js 24 + Express 5
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **API Client Generation**: Orval (OpenAPI code generation)
- **Bundler**: esbuild

---

## Self-Hosting (Ubuntu 22.04 / 24.04 VM)

### 1. One-Command Installation (Recommended)

On a fresh Ubuntu VM, run the following as `root`:

```bash
apt update && apt install -y git
git clone https://github.com/kmages/spam-purge.git /opt/spam-purge
cd /opt/spam-purge
sudo ./deploy/setup.sh
```

The installer (`deploy/setup.sh`) will guide you through:
1. Installing Node 24, PostgreSQL, and base packages.
2. Prompting you for your public domain name and Google OAuth client credentials.
3. Setting up the database and generating secure passwords.
4. Compiling the React frontend and Node backend.
5. Installing an always-on `spam-purge` systemd service.

### 2. Configure Google Cloud Console

To allow the application to connect to Gmail:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project, then configure your **OAuth consent screen** (set publishing status to "Testing" or "Production").
3. Enable the **Gmail API**.
4. Go to **Credentials** -> **Create Credentials** -> **OAuth client ID** (select "Web application").
5. Add the following to **Authorized redirect URIs**:
   `https://<your-domain>/api/auth/google/callback`
6. Copy the generated **Client ID** and **Client Secret** and use them during setup.

---

## Local Development

If you want to run the project locally or contribute, follow these steps:

### Prerequisites
- Node.js (version 24 or later)
- `pnpm` package manager: `corepack enable && corepack prepare pnpm@latest --activate`
- An active PostgreSQL database

### Run Dev Server
1. Clone the repository locally.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the sample environment file and fill in your values:
   ```bash
   cp deploy/spam-purge.env.example .env
   ```
4. Push the database schema to your local Postgres:
   ```bash
   pnpm --filter @workspace/db run push
   ```
5. Start the API server in development mode:
   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

### Other Commands
- **Full Typecheck**: `pnpm run typecheck`
- **Build Production Bundles**: `pnpm run build`
- **Regenerate API Hooks**: `pnpm --filter @workspace/api-spec run codegen`

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

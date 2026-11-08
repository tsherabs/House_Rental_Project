# CI/CD demonstration on an Ubuntu ARM64 VM

This setup keeps testing and image publishing on GitHub-hosted runners. Only the
manual deployment job runs inside your dedicated Ubuntu ARM64 VM. No GUI, inbound
SSH from GitHub, DEPLOY_HOST, or SSH deployment secrets are needed.

## 1. Prepare the VM

Install Docker Engine and the Docker Compose plugin using Docker's Ubuntu guide:
https://docs.docker.com/engine/install/ubuntu/
Use the installation supported for your Ubuntu release and ARM64 architecture.
The runner's Linux user must be able to run these commands without interactive sudo:

```bash
uname -m             # aarch64
docker info
docker compose version
```

Docker access gives the runner control of this VM. Use a dedicated demo VM and
trusted deployment code only; the pull-request verification job stays on GitHub's
runners. The VM needs outbound access to GitHub, GHCR, and Docker Hub.

## 2. Register a self-hosted runner

In the repository, open Settings → Actions → Runners → New self-hosted runner.
Choose Linux and ARM64, then follow GitHub's generated download and registration
commands inside the VM. Add the custom label `homefinder-deploy` when registering
(or afterwards in runner settings). Keep the default labels too:

```text
self-hosted, linux, ARM64, homefinder-deploy
```

Use a normal dedicated Linux user. Start the runner using the generated `run.sh`
command for a demo, or install its service following GitHub's instructions. Keep
the VM and runner online. Do not commit registration tokens.

Create a GitHub environment named `vm-demo` under Settings → Environments. Restrict
its deployment branches to `main` where your plan supports environment rules.
The workflow additionally checks `main` itself. No custom GHCR password is required:
it uses the job's temporary GITHUB_TOKEN with packages:read. If a package is private,
ensure its package settings grant this repository Actions read access.

## 3. Create the environment file inside the VM

As the **same Linux user that runs the Actions runner**:

```bash
mkdir -p "$HOME/house-rental"
chmod 700 "$HOME/house-rental"
umask 077
nano "$HOME/house-rental/.env"
```

Use this configuration, replacing the IP and both secret placeholders:

```dotenv
POSTGRES_PASSWORD=REPLACE_WITH_FIRST_RANDOM_HEX_SECRET
SESSION_SECRET=REPLACE_WITH_SECOND_RANDOM_HEX_SECRET
NODE_ENV=development
APP_ORIGIN=http://192.168.64.10:8080
CADDY_SITE=http://:80
BIND_HOST=0.0.0.0
HTTP_PORT=8080
HTTPS_PORT=8443
```

Generate each secret separately with `openssl rand -hex 32`. Do not change the
Postgres password after initialization without also updating the database role.
The example IP is illustrative: use `hostname -I` in the VM and choose an address
reachable from your laptop. Configure VM networking and its firewall to allow your
laptop to reach port 8080. Do not forward this HTTP demo to the public internet.

APP_ORIGIN must exactly match the origin you open in the browser, including port.
For example, if you use a VM port-forward on your laptop, use that browser-facing
address instead. A mismatch causes mutation requests to fail the CSRF check.
This is a private HTTP demo, so NODE_ENV=development is intentional. Public hosting
requires a domain, HTTPS, and the production settings in deployment.md. The smoke
check in this workflow targets the HTTP demo configuration.

The workflow copies Compose files into this directory. It leaves `.env` untouched
and uses the stable Compose project name `homefinder` so data volumes are reused.
The VM database is separate from your laptop's Docker database: existing accounts,
listings, and uploads are not copied to it.

## 4. Publish, then deploy

1. Commit and push these workflow changes and your application changes to `main`.
2. Wait for **House Rental CI + Docker Publish** to finish successfully, including
   **Publish tested AMD64 and ARM64 images to GHCR**. The publish job uses QEMU and
   Buildx to build both platforms. Existing older tags may contain only AMD64.
3. In Actions, select **House Rental CD - Deploy to Ubuntu ARM VM** → Run workflow
   → select `main`. The job deploys the exact SHA captured when you start it. If
   `main` has advanced since publishing, wait for that newer commit to publish first.
4. The VM runner logs into GHCR, pulls the matching images, starts PostgreSQL,
   runs migrations, updates API/web, waits for health, and checks the frontend and
   API through Caddy. It does not build the application on your VM.
5. Open the address in APP_ORIGIN, register demo accounts, and demonstrate the app.

To demonstrate delivery, make a small visible change, push it, show Verify and
Publish succeed, run Deploy, and refresh the website. This is continuous delivery
with a manual release step; deployment is not automatically triggered on push.

## Troubleshooting

- **Queued / waiting for runner:** the VM runner must be online and match all four labels.
- **Missing .env:** create it under the runner user's home, not root's or the checkout.
- **Permission denied accessing Docker:** give the runner user Docker access and restart
  its session/service so group changes take effect.
- **manifest unknown:** this exact commit's publish job has not completed successfully.
- **No matching ARM64 manifest:** publish again using the updated multi-platform workflow.
- **GHCR denied:** check the package's Actions access for this repository.
- **Page loads but saving/login returns 403:** verify APP_ORIGIN matches the browser URL.
- **Laptop cannot open the site:** check the VM IP, virtual network mode, firewall, and port 8080.

Deployment does not delete data volumes, but it does run schema migrations. There
is no automatic rollback. Back up important data before upgrading; a failed migration
or health check requires investigation. The GitHub run summary records the successful
image tags. Do not use `docker compose down -v` unless you intend to erase demo data.

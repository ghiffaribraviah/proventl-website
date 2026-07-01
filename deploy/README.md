# ProVenTL V2 Production Deploy

Production target:

```text
https://proventl.ghiffaribraviah.xyz
```

## VPS Layout

```bash
mkdir -p /opt/proventl/app /opt/proventl/model /opt/proventl/data /opt/proventl/env
```

Install runtime dependencies on the VPS:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git rsync
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the `docker` group.

## DNS

In Namecheap BasicDNS:

```text
Type: A Record
Host: proventl
Value: <VPS public IPv4>
TTL: Automatic
```

Open HTTP and HTTPS traffic on the VPS firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Clone

```bash
cd /opt/proventl
git clone https://github.com/ghiffaribraviah/proventl-website.git app
cd /opt/proventl/app
git checkout main
```

## Upload Artifacts

From your local repo:

```bash
rsync -av model/ <vps-user>@<vps-host>:/opt/proventl/model/
```

## Env

On the VPS:

```bash
cp /opt/proventl/app/deploy/.env.production.example /opt/proventl/env/proventl.env
nano /opt/proventl/env/proventl.env
```

Set:

```text
PROVENTL_DOMAIN=proventl.ghiffaribraviah.xyz
ACME_EMAIL=<email you control>
```

Keep the default `/app/model/...` and `/app/data` paths unless you also change
the volume mounts in `compose.prod.yml`.

## Start

```bash
cd /opt/proventl/app
docker compose -f compose.prod.yml up -d --build
```

For later V2 updates:

```bash
cd /opt/proventl/app
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose -f compose.prod.yml up -d --build
```

## Check

```bash
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs --tail=100 api
docker compose -f compose.prod.yml logs --tail=100 caddy
curl -fsS http://localhost/api/health/live
curl -fsS http://localhost/api/health/ready
curl -fsS https://proventl.ghiffaribraviah.xyz/api/health/ready
```

Open the app and run one single-target prediction and one batch prediction before
calling the deployment done.

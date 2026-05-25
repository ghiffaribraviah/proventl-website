# ProVenTL Production Deploy

Production target:

```text
https://proventl.ghiffaribraviah.xyz
```

## VPS Layout

```bash
mkdir -p /opt/proventl/app /opt/proventl/model /opt/proventl/data /opt/proventl/env
```

## DNS

In Namecheap BasicDNS:

```text
Type: A Record
Host: proventl
Value: <VPS public IPv4>
TTL: Automatic
```

## Clone

```bash
cd /opt/proventl
git clone https://github.com/ghiffaribraviah/proventl-website.git app
cd /opt/proventl/app
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

## Start

```bash
cd /opt/proventl/app
docker compose -f compose.prod.yml up -d --build
```

## Check

```bash
docker compose -f compose.prod.yml ps
curl -fsS http://localhost/api/health/live
curl -fsS http://localhost/api/health/ready
curl -fsS https://proventl.ghiffaribraviah.xyz/api/health/ready
```

Open the app and run one real prediction before calling the deployment done.

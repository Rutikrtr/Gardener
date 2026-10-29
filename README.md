# Smart Garden

Quotation, stage-wise billing, payments and plant-stock software for **Shivsai Garden Developers** (garden designer, dealer & contractor).

```
smart-garden/
  backend/   Node + Express + MongoDB Atlas API  -> AWS EC2
  frontend/  React + Vite                         -> Cloudflare Pages
```

## How it works (per project)

1. **Price List**: plants, trees, soil, manure, lawn, irrigation and services, with rates. `npm run seed` loads the items from the Joyville BOQ.
2. **Project**: create one per client site.
3. **Quotation**: a BOQ-style quotation (sections A–G, qty/unit/rate/amount/remark, GST). Mark it **Approved** when the client accepts.
4. **Stage Bills**: Stage 1, 2, … running bills. *Fill pending from quotation* pre-fills whatever hasn't been billed yet.
5. **Payments**: record each payment against a stage bill. Outstanding is calculated for you.
6. **Daily Usage**: log what was planted each day (e.g. 11th: 50 plants, 12th: the rest).
7. **Plant Stock**: per item, Quoted → Billed → Used → **In hand** (billed but not yet used, carries over to the next stage) → Left to bill. There's also a date-wise movement log with a running balance.
8. **Print / PDF**: each quotation and bill has a print view with the company letterhead.

Roles: **superadmin** (creates users) and **user**. The superadmin is created automatically on first start from `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.

## Local development

```bash
cd backend && cp .env.example .env   # fill MONGO_URI + JWT_SECRET
npm install && npm run seed && npm run dev
cd ../frontend && cp .env.example .env && npm install && npm run dev
```

## MongoDB Atlas
1. Create a free M0 cluster, then a database user.
2. Network Access: add your EC2 Elastic IP (and your own IP for local development).
3. Copy the connection string into `MONGO_URI` (database name `smart-garden`).

## Backend on AWS EC2 (Ubuntu 24.04)

```bash
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2
git clone https://github.com/Rutikrtr/Gardener.git && cd Gardener/backend
npm ci --omit=dev && cp .env.example .env && nano .env   # set MONGO_URI, JWT_SECRET, CORS_ORIGIN
npm run seed
pm2 start src/server.js --name smart-garden-api && pm2 save && pm2 startup
```

Nginx reverse proxy (`/etc/nginx/sites-available/default`):

```nginx
server {
  server_name api.yourdomain.com;
  location / { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d api.yourdomain.com
```

Security group: open 22 (your IP only), 80 and 443. You need HTTPS on the API, because a Cloudflare Pages site (https) can't call an http API.

Update: `git pull && cd backend && npm ci --omit=dev && pm2 restart smart-garden-api`

## Frontend on Cloudflare Pages
- Connect the GitHub repo → Framework preset **Vite**
- Root directory: `frontend` · Build command: `npm run build` · Output: `dist`
- Environment variable: `VITE_API_URL=https://api.yourdomain.com/api`
- `public/_redirects` already handles SPA routing.
- Add the Pages URL to `CORS_ORIGIN` in the backend `.env`, then run `pm2 restart smart-garden-api`.

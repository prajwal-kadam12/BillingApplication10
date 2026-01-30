# Step-by-Step Render Deployment Guide (Totally FREE)

Render sometimes asks for a credit card if you use the "Blueprint" method. To avoid this and deploy for **FREE without a card**, follow these manual steps:

### 1. Go to Render Dashboard
- Login to [Render.com](https://render.com/).

### 2. Create a New "Web Service"
- Click the **"New +"** button.
- Select **"Web Service"** (NOT Blueprint).

### 3. Connect your GitHub Repository
- Pick **`BillingApplication10`** from your repository list.

### 4. Configure the Settings (CRITICAL)
Fill in these details exactly:

- **Name**: `billing-system`
- **Region**: (Leave as default)
- **Branch**: `main`
- **Root Directory**: (Leave blank)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: Select **"Free"** (It should say $0/month).

### 5. Add Environment Variables
Scroll down to the "Environment Variables" section and click "Add Environment Variable":
- **Key**: `NODE_ENV`
- **Value**: `production`

### 6. Deploy!
- Click **"Create Web Service"**.

---

### Why this works:
- By selecting **"Web Service"** manually and picking the **"Free"** plan, Render usually does NOT ask for a credit card.
- Once the logs say "Live", use the URL provided.

**Note again**: Any data you add while testing on this link will be lost if the server sleeps or restarts, because the Free plan does not include a permanent disk. For testing, this is perfect!

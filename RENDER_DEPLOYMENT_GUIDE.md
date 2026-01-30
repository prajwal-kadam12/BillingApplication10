# Step-by-Step Render Deployment Guide

Follow these steps to deploy your application to Render.com. This will ensure your backend (API) works and your data is saved permanently.

### 1. Create a Render Account
- Go to [Render.com](https://render.com/) and Sign Up (recommended using GitHub).

### 2. Start a New Blueprint Deployment
- In your Render Dashboard, click the **"New +"** button (usually at the top right).
- Select **"Blueprint"** from the list.

### 3. Connect your GitHub Repository
- You will see a list of your GitHub repositories.
- Find **`BillingApplication10`** and click **"Connect"**.

### 4. Name your Service
- Give it a name like `billing-system`.
- Render will automatically detect the `render.yaml` file I created in your repository.
- Click **"Apply"**.

### 5. Wait for the Build to Finish
- You will see a black terminal screen showing the "Logs".
- It will say "Building...", then "Starting server...".
- Once it's done, you will see a green **"Live"** status at the top left.

### 6. Open your New App
- Just below the "Live" status, you will see your new URL (example: `https://billing-system-xxxx.onrender.com`).
- **Click this link.**

---

### Important Notes:
- **Discard Netlify**: Once this is live, stop using the Netlify link completely.
- **First Run**: The first time you open the Render app, my "seeding" logic will automatically copy your items and customers from GitHub to the server's disk.
- **Saving Data**: Any new items or customers you add on this Render link will be saved permanently.

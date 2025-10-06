# LabLIMS Animal Research - Railway Deployment Guide

## Quick Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare LabLIMS Animal Research for Railway deployment"
git push origin main
```

### 2. Create Railway Project
1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `animal-lims` repository

### 3. Add PostgreSQL Database
1. In your Railway project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a database and set `DATABASE_URL`

### 4. Configure Environment Variables
In Railway project settings, add these variables:

```env
# Required
DATABASE_URL=${DATABASE_URL}  # Auto-set by Railway PostgreSQL
NODE_ENV=production
JWT_SECRET=your_super_secure_jwt_secret_key_for_production

# Demo Mode Configuration (for production demo)
REACT_APP_DEMO_MODE=true
REACT_APP_DEMO_USERNAME=admin
REACT_APP_DEMO_PASSWORD=test123

# Demo URLs for navigation
REACT_APP_CLINICAL_DEMO_URL=https://clinical-demo.lablims.com
REACT_APP_ANIMAL_DEMO_URL=https://animal-demo.lablims.com
REACT_APP_MAIN_SITE_URL=https://lablims.com

# Optional
PORT=5000  # Railway sets this automatically
```

### 5. Set Build & Start Commands
Railway should auto-detect these, but verify:

**Build Command:**
```bash
npm install && cd client && npm install && npm run build
```

**Start Command:**
```bash
node server.js
```

### 6. Deploy!
Railway will automatically deploy when you push to `main` branch.

## Database Initialization

The database schema and demo data are automatically applied on first startup:
- Schema: `db/schema.sql`
- Migrations: `db/migrations/*.sql` (applied automatically)
- Demo Data: Load via `psql` or admin interface if desired

### Manual Schema Application (if needed)
If you need to manually apply the schema:

```bash
# Connect to Railway PostgreSQL
railway connect postgres

# Apply schema
\i db/schema.sql

# Apply migrations
\i db/migrations/add_missing_columns.sql
\i db/migrations/add_housing_hierarchy.sql

# Load demo data (optional)
\i db/demo-data.sql
```

## Post-Deployment

### Create Admin User
SSH into Railway container or use psql:
```bash
railway run node create-admin.js
```

Or use the provided test users from demo-data.sql:
- Username: `admin`
- Password: `test123`
- Role: `facility_manager`

### Verify Deployment
1. Check Railway logs for startup messages
2. Visit your Railway URL (e.g., `https://your-app.up.railway.app`)
3. With `REACT_APP_DEMO_MODE=true`, the system will auto-login
4. Verify demo features:
   - First-time visitor welcome modal appears
   - Demo banner shows at the top with links to other demo
   - Dashboard welcome card displays with feature highlights
   - Animals page loads with 21 sample animals
   - Housing dashboard shows hierarchical structure
   - Studies page shows 4 research studies
   - Measurements and charts are visible
   - Animal claiming system works
   - Navigation is streamlined (incomplete features hidden)

## Key Features to Demo

### Demo Experience Enhancements
- **Auto-Login**: When `REACT_APP_DEMO_MODE=true`, visitors are automatically logged in as Facility Manager
- **Welcome Modal**: First-time visitors see an interactive guide to all demo features
- **Demo Banner**: Always visible at top with role indicator and links to other demos
- **Welcome Card**: Dashboard features a gradient card highlighting the 5 core features
- **Streamlined Navigation**: Only complete, demo-ready features are shown in the sidebar

### Core Features

1. **Animal Management**
   - 21 sample animals across multiple species/strains
   - Availability status tracking
   - Housing assignments

2. **Housing Dashboard**
   - Hierarchical organization (Building → Room → Rack → Cage)
   - Occupancy tracking
   - 10 housing units with environmental data

3. **Animal Claiming System**
   - Available animals listing
   - Claim request workflow
   - Facility manager approval dashboard
   - 6 sample claims (2 pending, 4 approved)

4. **Experimental Studies**
   - 4 research studies with different statuses
   - Animal-to-study assignments
   - IACUC protocol tracking

5. **Measurements & Charts**
   - Weight tracking over time
   - 16 sample measurements
   - Visualization charts

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly in Railway
- Check that PostgreSQL service is running
- Review Railway deployment logs

### Build Failures
- Ensure both root and client `package.json` are committed
- Check that `client/build` directory is in `.gitignore`
- Verify Node.js version compatibility

### Missing Data
- Check if migrations ran successfully in logs
- Manually apply schema if needed (see above)
- Load demo-data.sql for sample content

## Environment Configuration

### Development (.env)
```env
DATABASE_URL=postgres://username@localhost:5432/lablims_animal_demo
JWT_SECRET=development_jwt_secret
NODE_ENV=development
PORT=5001
```

### Production (Railway)
```env
DATABASE_URL=<Railway PostgreSQL URL>
JWT_SECRET=<strong random string>
NODE_ENV=production
PORT=<Railway assigns automatically>
```

## Auto-Deploy Setup

Railway automatically deploys on push to `main`. To customize:

1. Go to Project Settings → Deployments
2. Configure branch: `main`
3. Enable "Auto-deploy"
4. Set health check path: `/api/health` (if endpoint exists)

## Monitoring

- **Logs**: View in Railway dashboard
- **Metrics**: CPU, Memory, Network usage in Railway
- **Database**: Monitor connections and queries in PostgreSQL service

## Scaling

Railway auto-scales based on usage. For custom scaling:
1. Go to Project Settings
2. Adjust resource limits
3. Configure horizontal scaling if needed

---

**Deployment Date**: 2025-10-06
**Version**: 1.0.0
**Status**: Production-ready with demo data

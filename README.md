# LabLIMS Animal Research

A modern web-based Laboratory Information Management System (LIMS) designed specifically for animal research facilities. Track studies, manage animal colonies, record measurements, and analyze longitudinal data.

## Features

- **Study Management** - Create and manage research studies with experimental groups
- **Animal Tracking** - Track individual animals, housing, and group assignments
- **Measurement Entry** - Bulk measurement entry with flexible filtering
- **Data Analysis** - Statistical analysis and visualization of longitudinal data
- **Sample Management** - Track biological samples with collection timelines
- **Group Management** - Organize animals into experimental groups (control, treatment, etc.)

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, Material-UI (MUI), Recharts
- **Authentication**: JWT-based auth with role-based access control

## Deployment on Railway

### Prerequisites
- Railway account
- GitHub repository

### Steps

1. **Create PostgreSQL Database on Railway**
   - Go to Railway dashboard
   - Create new project
   - Add PostgreSQL service
   - Note the connection string

2. **Deploy Application**
   - Connect your GitHub repository to Railway
   - Add environment variables (see below)
   - Railway will auto-detect Node.js and deploy

3. **Set Environment Variables**
   ```
   DATABASE_URL=<your-railway-postgres-url>
   JWT_SECRET=<generate-random-secret>
   NODE_ENV=production
   PORT=5000
   ```

4. **Initialize Database**
   - Database schema is automatically initialized on first startup
   - Demo data loads automatically in development mode
   - For production with demo data, set environment variable: `LOAD_DEMO_DATA=true`

### Building for Production

The application will build automatically on Railway. The build process:
1. Installs backend dependencies
2. Builds React frontend (`npm run build --prefix client`)
3. Serves static files from `client/build`

## Local Development

1. **Clone repository**
   ```bash
   git clone <your-repo-url>
   cd animal-lims
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Setup PostgreSQL database**
   ```bash
   createdb lablims_animal_demo
   # Schema and demo data will be automatically loaded on first startup
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

5. **Run development servers**
   ```bash
   npm run dev  # Runs both backend (port 5001) and frontend (port 3000)
   ```

## Default Admin User

When using demo data:
- **Email**: admin@example.com
- **Password**: admin123

**⚠️ Change this immediately in production!**

## License

MIT

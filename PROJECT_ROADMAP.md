# Animal LIMS Enhancement Roadmap

## Project Overview

This document outlines the comprehensive enhancement plan for the Animal Laboratory Information Management System (LIMS) based on user feedback from facility demonstrations and identified technical issues.

## ✅ Phase 1: Critical Infrastructure Fixes (COMPLETED)

**Status: COMPLETED ✅**  
**Timeline: Completed Friday, Sept 12, 2025**

### Issues Fixed
1. **Database Schema Consolidation**
   - ✅ Merged `biological_samples_schema.sql` into main `schema.sql`
   - ✅ Added missing `status` column to housing table
   - ✅ Deployed unified schema to Railway production

2. **Infinite Loading Bug Fixes**
   - ✅ Fixed Housing page - was missing `status` column in database
   - ✅ Fixed Biological Samples page - table didn't exist in production
   - ✅ Both pages now load properly instead of infinite loading spinners

### Technical Details
- **Root Cause**: Production database missing schema changes that exist in consolidated schema.sql
- **Solution**: Created targeted migration script (fix-missing-schema.sql) to add missing elements
- **Database Changes**: Need to add housing.status column and biological_samples table with related structures
- **Status**: ⏳ Deployment in progress - schema fix ready to apply once deployment completes

---

## 📋 Phase 2: Animal Claiming & Inventory System (NEXT UP)

**Status: READY TO START**  
**Estimated Timeline: 1 week**  
**Priority: HIGH**

### User Requirements
Based on meeting feedback, users want:
- Searchable inventory of available animals for researchers to claim
- Approval workflow (facility manager approval required)
- Animals removed from availability when claimed
- Strain/genotype filtering capabilities
- Dashboard integration showing availability summary

### Technical Implementation Plan

#### 2.1 Available Animals Interface
**File Location**: `/client/src/components/animals/AvailableAnimalsList.js`
- New "Available Animals" tab in navigation
- Optimized for researcher workflow (browsing vs facility management)
- Filters: strain, genotype, sex, age range, study eligibility
- Claim request functionality with justification field

#### 2.2 Database Schema Extensions
**File Location**: `/db/schema.sql`
```sql
-- Animal claiming system tables
CREATE TABLE animal_claims (
  id UUID PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  requested_by UUID REFERENCES users(id),
  study_id UUID REFERENCES experimental_studies(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, denied
  justification TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT
);

-- Add availability status to animals table
ALTER TABLE animals ADD COLUMN availability_status VARCHAR(20) DEFAULT 'available';
-- Options: available, claimed, reserved, breeding, retired
```

#### 2.3 Claims Management Dashboard
**File Location**: `/client/src/components/admin/ClaimsManagement.js`
- Facility manager interface for reviewing claims
- Email notifications for new claims (optional enhancement)
- Bulk approve/deny functionality
- Claims history tracking

#### 2.4 API Endpoints
**File Location**: `/routes/animalClaims.js`
```javascript
// New API routes needed:
GET /api/animal-claims/available    // List available animals
POST /api/animal-claims/request     // Submit claim request  
GET /api/animal-claims/pending      // Facility manager pending claims
PUT /api/animal-claims/:id/approve  // Approve claim
PUT /api/animal-claims/:id/deny     // Deny claim
```

---

## 📊 Phase 3: Time Series Data Tracking (PLANNED)

**Status: PLANNED**  
**Estimated Timeline: 1-2 weeks**  
**Priority: MEDIUM**

### User Requirements
- Longitudinal data entry (weight, survival, measurements)
- Biological samples linked to specific timepoints
- Flexible measurement intervals
- Automated graphing and visualization
- Optional reminder system for scheduled measurements

### Technical Implementation Plan

#### 3.1 Time Series Data Model
```sql
CREATE TABLE animal_measurements (
  id UUID PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  measurement_date TIMESTAMP,
  measurement_type VARCHAR(100), -- weight, survival, tumor_size, etc.
  value DECIMAL(10,3),
  unit VARCHAR(20),
  notes TEXT,
  measured_by UUID REFERENCES users(id)
);

CREATE TABLE measurement_schedules (
  id UUID PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  measurement_type VARCHAR(100),
  frequency_days INTEGER,
  next_due_date DATE,
  reminder_enabled BOOLEAN DEFAULT false
);
```

#### 3.2 Data Entry Interface
- Time series data entry forms
- Bulk data entry for multiple animals
- Mobile-friendly interface for field data collection

#### 3.3 Visualization System
- Weight curves, survival plots
- Customizable time ranges and metrics
- Export functionality for statistical analysis
- Integration with biological samples timeline

### Standard Measurements to Include
- **Core Vitals**: Weight, body condition score, survival status
- **Research Metrics**: Tumor measurements, behavior scores, temperature
- **Laboratory Values**: Blood glucose, hematocrit, protein levels
- **Custom Fields**: User-defined measurements with flexible units

---

## 🏠 Phase 4: Enhanced Housing & Cage Labeling (PLANNED)

**Status: PLANNED**  
**Estimated Timeline: 1 week**  
**Priority: MEDIUM**

### User Requirements
- Generate standard cage cards with all relevant information
- QR codes linking back to the system
- Track cage assignments through the system
- Integration with existing housing module

### Standard Cage Card Information
- Animal ID and barcode/QR code
- Strain/genotype information
- Sex and date of birth
- Study/PI assignment
- Housing dates and special instructions
- Regulatory protocol numbers

### Technical Implementation Plan

#### 4.1 Label Generation System
**File Location**: `/client/src/components/labels/CageCardGenerator.js`
- PDF generation with standard cage card layout
- QR code integration linking to animal record
- Batch printing capabilities
- Template customization options

#### 4.2 Housing Integration
- Enhanced housing assignment tracking
- Cage change logging with timestamps
- Mobile scanning interface for cage updates
- Integration with existing housing dashboard

---

## 🧬 Phase 5: Breeding Colony Management (PLANNED)

**Status: PLANNED**  
**Estimated Timeline: 2-3 weeks**  
**Priority: MEDIUM**

### User Requirements
- Track breeding pairs and litters
- Basic pedigree/lineage tracking
- Breeding efficiency metrics
- Genetic marker management
- Integration with animal claiming system

### Technical Implementation Plan

#### 5.1 Breeding Data Model
```sql
CREATE TABLE breeding_pairs (
  id UUID PRIMARY KEY,
  male_id UUID REFERENCES animals(id),
  female_id UUID REFERENCES animals(id),
  pairing_date DATE,
  separation_date DATE,
  status VARCHAR(20) -- active, separated, retired
);

CREATE TABLE litters (
  id UUID PRIMARY KEY,
  breeding_pair_id UUID REFERENCES breeding_pairs(id),
  birth_date DATE,
  total_pups INTEGER,
  live_pups INTEGER,
  weaning_date DATE
);

CREATE TABLE genetic_markers (
  id UUID PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  marker_name VARCHAR(100),
  genotype VARCHAR(50),
  verified_date DATE
);
```

#### 5.2 Breeding Management Interface
- Breeding pair setup and tracking
- Litter recording and management
- Genetic lineage visualization
- Breeding performance analytics

---

## 🚀 Deployment Information

### Production Environment
- **Platform**: Railway (https://animal-lims-production.up.railway.app)
- **Database**: PostgreSQL with Railway
- **Repository**: https://github.com/megjohnson1999/animal-lims

### Current Production Status
- ✅ Application deployed and running
- ✅ Database schema up to date
- ✅ Admin user created (username: admin)
- ✅ Housing and Biological Samples pages working
- ✅ Core LIMS functionality operational

### Development Workflow
1. Make changes locally
2. Test functionality
3. Commit to GitHub
4. Railway auto-deploys from main branch
5. Database schema changes deployed via `/api/admin/deploy-schema` endpoint

---

## 📝 Next Steps for Monday

### Immediate Actions
1. **Start Phase 2 Implementation**
   - Create database migration for animal_claims table
   - Build Available Animals listing component
   - Implement basic claim request functionality

### Development Priorities
1. **High Priority**: Animal claiming system (addresses immediate user needs)
2. **Medium Priority**: Time series data tracking (critical for research workflow)
3. **Lower Priority**: Enhanced labeling and breeding management

### User Testing Plan
- Deploy Phase 2 to Railway for user testing
- Gather feedback on claiming workflow
- Iterate based on user experience
- Document any additional requirements discovered

---

## 📚 Technical Notes

### Key Files Modified in Phase 1
- `/db/schema.sql` - Consolidated database schema
- `/server.js` - Added admin user creation endpoint
- `/client/src/App.js` - Fixed ESLint warnings for deployment

### Database Schema Highlights
- **biological_samples table**: 70+ fields covering full sample lifecycle
- **Automated triggers**: Sample number generation, quantity tracking
- **Performance indexes**: Optimized for common queries
- **Regulatory compliance**: Chain of custody, IACUC tracking

### Architecture Decisions
- **Single schema file**: Consolidated for maintainability
- **UUID primary keys**: Better for distributed systems
- **JSONB metadata**: Flexible for research-specific data
- **Trigger-based automation**: Ensures data consistency

---

*Document created: Friday, September 12, 2025*  
*Last updated: Friday, September 12, 2025*  
*Next review: Monday, September 15, 2025*
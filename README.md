# Diagsync — Medical Diagnostic Operations System

A multi-role diagnostic workflow operating system for medical labs.

## Phase 1 Covers
- Organization registration
- Individual staff accounts with roles
- Role-based access control (RBAC)
- Authentication (NextAuth v5 + JWT)
- Role-specific dashboards (Receptionist, Lab Scientist, Radiographer, MD, HRM)
- Staff availability toggle
- Audit logging
- Middleware-based route protection

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth v5
- **UI:** Tailwind CSS + Radix UI
- **Validation:** Zod + React Hook Form

---

## Setup Instructions

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:
```
DATABASE_URL="postgresql://username:password@localhost:5432/diag_ops"
AUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="https://diagsync.vercel.app"
```

To generate a secure AUTH_SECRET:
```bash
openssl rand -base64 32
```

### 3. Set up PostgreSQL database
Make sure PostgreSQL is running, then create the database:
```bash
createdb diag_ops
```
Or via psql:
```sql
CREATE DATABASE diag_ops;
```

### 4. Push database schema
```bash
npx prisma db push
```

### 5. Generate Prisma client
```bash
npx prisma generate
```

### 6. Seed the database (creates first org + super admin)
```bash
npm run db:seed
```

Default login after seeding:
- **Email:** superadmin@reenemedical.com
- **Password:** Admin@1234

> ⚠️ Change this password immediately after first login!

### 7. Start development server
```bash
npm run dev
```

Open [https://diagsync.vercel.app](https://diagsync.vercel.app)

---

## Roles & Dashboards

| Role | Dashboard Path | Can Do |
|------|---------------|--------|
| SUPER_ADMIN | /dashboard/hrm | Everything |
| HRM | /dashboard/hrm | Staff management, audit, operations |
| RECEPTIONIST | /dashboard/receptionist | Patient registration |
| LAB_SCIENTIST | /dashboard/lab-scientist | Lab tests, result entry |
| RADIOGRAPHER | /dashboard/radiographer | Imaging, radiology reports |
| MD | /dashboard/md | Review, approve, edit requests |

---

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx prisma studio    # Open database GUI
npx prisma db push   # Push schema changes
npm run db:seed      # Re-seed the database
```

---

## Phase 2 Next
- Test database (lab tests + radiology tests)
- Result templates
- Pricing
- Patient model
- Visit model


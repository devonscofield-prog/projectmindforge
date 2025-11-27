# Sales Performance Tracker

A role-based sales performance management application built with React, TypeScript, and Supabase.

## Project Info

**URL**: https://lovable.dev/projects/7147383f-fa7b-4ad5-8fca-cd94fb4039d8

## Features

- **Admin Dashboard**: View all teams, users, and system-wide metrics
- **Manager Dashboard**: Track team performance, coaching sessions, and rep details
- **Rep Dashboard**: Log activities, view personal performance, and track goals

## Technology Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Auth, Database, Edge Functions)

## Getting Started

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start the development server
npm run dev
```

## Demo/Seed Data

The project includes a seed function to populate the database with realistic demo data for testing.

### Running the Seed Script

The seed data can be loaded by calling the `seed-demo-data` edge function. You can do this via:

1. **Using the Supabase dashboard** - Navigate to Edge Functions and invoke `seed-demo-data`
2. **Using curl**:
   ```sh
   curl -X POST https://wuquclmippzuejqbcksl.supabase.co/functions/v1/seed-demo-data \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

### Test Credentials

After running the seed script, you can log in with these accounts:

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Admin** | `admin@example.com` | `Password123!` | Full access to all teams and data |
| **Manager (East)** | `manager.east@example.com` | `Password123!` | Enterprise East team only |
| **Manager (West)** | `manager.west@example.com` | `Password123!` | Enterprise West team only |
| **Rep (East)** | `rep.east.1@example.com` | `Password123!` | Own data only |
| **Rep (East)** | `rep.east.2@example.com` | `Password123!` | Own data only |
| **Rep (East)** | `rep.east.3@example.com` | `Password123!` | Own data only |
| **Rep (East)** | `rep.east.4@example.com` | `Password123!` | Own data only |
| **Rep (West)** | `rep.west.1@example.com` | `Password123!` | Own data only |
| **Rep (West)** | `rep.west.2@example.com` | `Password123!` | Own data only |
| **Rep (West)** | `rep.west.3@example.com` | `Password123!` | Own data only |
| **Rep (West)** | `rep.west.4@example.com` | `Password123!` | Own data only |

### Seed Data Contents

The seed script creates:

- **11 users** with proper auth accounts, profiles, and roles
- **2 teams**: Enterprise East and Enterprise West
- **Performance snapshots** for each rep (current and previous month)
- **Coaching sessions** (2-3 per rep with realistic notes)
- **Activity logs** (14 days of varied sales activities)

The seed script is **idempotent** - it can be run multiple times safely. It will update existing users and replace their associated data.

## Database Schema

### Core Tables

- `profiles` - User profile information
- `user_roles` - Role assignments (admin, manager, rep)
- `teams` - Team definitions with manager assignments
- `rep_performance_snapshots` - Monthly performance metrics
- `coaching_sessions` - Manager-rep coaching records
- `activity_logs` - Daily activity tracking

### Security

All tables are protected with Row-Level Security (RLS) policies:
- Admins can access all data
- Managers can only access their team's data
- Reps can only access their own data

## Development

### Edit with Lovable

Visit the [Lovable Project](https://lovable.dev/projects/7147383f-fa7b-4ad5-8fca-cd94fb4039d8) and start prompting.

### Edit Locally

Clone the repo and push changes. Changes will sync with Lovable automatically.

### Edit in GitHub

Navigate to files and use the edit button, or use GitHub Codespaces.

## Deployment

Open [Lovable](https://lovable.dev/projects/7147383f-fa7b-4ad5-8fca-cd94fb4039d8) and click Share → Publish.

## Custom Domain

Navigate to Project > Settings > Domains and click Connect Domain.

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

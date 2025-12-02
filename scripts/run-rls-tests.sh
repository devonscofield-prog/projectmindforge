#!/bin/bash

# RLS Test Runner Script
# This script sets up environment variables and runs Playwright RLS tests

# Supabase credentials (already available in your project)
export VITE_SUPABASE_URL="https://wuquclmippzuejqbcksl.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cXVjbG1pcHB6dWVqcWJja3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzUxMjUsImV4cCI6MjA3OTgxMTEyNX0.Aq-zlkfS6wpzpgpjO2zYPS5GMK_5iGRTbIyw_qRIQOI"

# Test user credentials (demo/seeded users)
export TEST_USER_EMAIL="rep.east.1@example.com"
export TEST_USER_PASSWORD="TestPassword123!"
export MANAGER_A_EMAIL="manager.east@example.com"
export MANAGER_A_PASSWORD="TestPassword123!"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="TestPassword123!"

# Service role key - IMPORTANT: Replace with your actual service role key
# You can find this in Lovable Cloud backend settings
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key-here}"

echo "🧪 Running RLS Security Tests..."
echo "📊 Testing Rep, Manager, and Admin access controls"
echo ""

# Run all RLS tests
npx playwright test e2e/*rls.spec.ts "$@"

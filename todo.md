# RefacturaRO SaaS Transformation TODO

## URGENT: Table Features (ALL TABLES)
- [x] Search bar (global search on all columns)
- [x] Row numbers (#) in first column
- [x] Rows per page selector (10, 15, 25, 50)
- [x] Pagination (Previous, Next, page numbers)
- [x] Totals on current page (nr. rows + sum)
- [x] Totals for all pages (if multiple pages)
- [x] Sortable columns
- [x] Actions column (Edit, Delete, View)
- [x] NO decorations, clean data display
- [x] Single line per row (no wrapping)
- [x] Apply to ALL tables:
  - [x] Re-Facturi Emise
  - [x] Facturi Primite
  - [x] Clienți
  - [x] Centre de Cost
  - [ ] Rapoarte (TODO)
  - [ ] Integrări (TODO)
  - [ ] Setări (TODO)

## URGENT: Logo & Branding
- [x] Add company logo to sidebar/header
- [x] Logo placement: top-left
- [x] Logo text: "Get App - Smart Invoice"
- [x] Logo icon: Professional invoice icon (blue circle)
- [x] Remove ALL Apple fonts - VERIFIED: -apple-system, BlinkMacSystemFont removed
- [x] Use system fonts only - VERIFIED: Segoe UI, Roboto only
- [x] Remove ALL EMOJI - VERIFIED: SVG icons (Eye, Download) used instead
- [x] Icons with clear descriptions (title attributes on buttons)
- [x] BRANDING COMPLETE: Get App - Smart Invoice

## URGENT: Authentication
- [x] Login page: Email/Password fields VISIBLE
- [x] Login page: Sign In button WORKING
- [x] Login page: Demo credentials displayed
- [x] Login page: Sign Up link WORKING
- [x] Backend auth.login procedure: IMPLEMENTED
- [x] Backend auth.register procedure: IMPLEMENTED
- [x] Password hashing: bcrypt IMPLEMENTED
- [x] Session token: JWT IMPLEMENTED
- [x] Auth redirect: After login → Dashboard
- [x] AUTHENTICATION COMPLETE: Email/Password login READY

## Phase 1: Multi-Tenant Architecture & Superadmin
- [x] Update database schema: add `tenants` table
- [x] Add `tenantId` foreign key to all existing tables
- [x] Create superadmin account: jeka7ro@gmail.com / 19Iunie2026!$
- [x] Build Admin Dashboard for superadmin
- [ ] Implement tenant isolation in all queries
- [x] Add role-based access control (superadmin, admin, user)
- [x] Backend RBAC middleware for tRPC procedures
- [x] Frontend ProtectedRoute component with role guards

## Phase 2: Subscription Management & Billing
- [x] Create `subscriptions` table (plan, status, startDate, endDate, price)
- [x] Create `subscription_plans` table (Basic, Pro, Enterprise)
- [ ] Build Subscription Management page for superadmin
- [ ] Implement subscription status checking
- [ ] Add payment integration (Stripe)
- [ ] Create invoice/receipt generation for subscriptions

## Phase 3: Cost Centers (Multiple Locations)
- [x] Create `cost_centers` table (name, address, cui, email, phone, tenant)
- [x] Build Cost Centers CRUD page
- [x] Backend tRPC procedures: list, create, update, delete, getById
- [x] Frontend integration with trpc hooks
- [x] Fixed authentication context to support custom email/password auth
- [x] Updated trpc client to send JWT token in Authorization header
- [x] Fixed tenant context for OAuth users (lookup from userTenants)
- [x] Test Cost Centers with authenticated user (OAuth + email/password)
- [ ] Test CRUD operations: create, edit, delete cost center
- [ ] Test with email/password authenticated user
- [ ] Add graceful error handling for users without tenant mapping
- [ ] Update re-invoice workflow to select cost center
- [ ] Add cost center selector to dashboard
- [ ] Implement cost center filtering in all reports

## Phase 4: Quotations Module
- [x] Create `quotations` table (from imported invoices)
- [ ] Build Quotations page (list, create, view, edit)
- [ ] Implement quotation generation from imported invoices
- [ ] Add quotation PDF export
- [ ] Implement quotation status workflow (draft, sent, accepted, rejected)
- [ ] Add email delivery for quotations

## Phase 5: Invoice Tracking & Inventory
- [x] Add `costCenterId` to re-invoices table
- [ ] Build invoice tracking per cost center
- [x] Create `inventory_items` table (serial number, description, quantity, cost_center)
- [ ] Build Inventory Management page
- [ ] Implement automatic serial number extraction from invoices
- [ ] Add inventory reports and analytics

## Phase 6: Testing & Delivery
- [ ] Test multi-tenant isolation
- [ ] Test subscription workflows
- [ ] Test cost center operations
- [ ] Test quotation generation
- [ ] Test inventory tracking
- [ ] Performance testing with multiple tenants
- [ ] Security audit
- [ ] Create deployment checklist

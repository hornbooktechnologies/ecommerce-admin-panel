# ecommerce-admin

JavaScript-only Next.js application for platform administrators, tenant teams,
and restricted marketplace vendors.

## Local setup

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

The API defaults to `http://localhost:4000`. Authentication uses a short-lived
access token held in memory and a rotating HTTP-only refresh cookie issued by
the API.

Application areas:

- `/platform` — SaaS platform operations
- `/admin` — tenant and store administration
- `/vendor` — merchant-restricted vendor operations

Implemented tenant tax route:

- `/admin/inventory` - warehouse balances, batch/expiry and serial traceability, and exact serialized warehouse transfers
- `/admin/settings/taxes` — GST registrations, HSN/SAC categories, and effective GST slabs
- `/admin/offers` — first-party/vendor seller offers, fulfillment terms, stock visibility, and INR price lists

Implemented platform tenant routes:

- `/platform/tenants` — live directory with search and status filters
- `/platform/tenants/new` — transactional tenant onboarding
- `/platform/tenants/[tenantId]` — structure, ownership, audit history, and lifecycle actions
- `/platform/tenants/[tenantId]/edit` — business identity settings

## Quality commands

```powershell
npm run lint
npm test
npm run build
```

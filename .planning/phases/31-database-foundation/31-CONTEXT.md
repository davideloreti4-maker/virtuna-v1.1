# Phase 25: Database Foundation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Supabase schema for all v1.6 features — deals, wallet transactions, creator profiles, enrollments, and affiliate tracking. This phase creates the data layer only; UI and business logic belong to later phases (26-30).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User delegated all schema decisions to Claude's best judgment. The following best practices will guide implementation:

**Data Granularity**
- Individual transaction records (not aggregated) for full audit trail
- Per-click affiliate tracking with reasonable metadata (timestamp, referrer, UTM params)
- Transaction history preserved indefinitely (soft deletes only)

**Wallet Balance Model**
- Single currency (USD) — multi-currency adds complexity without current need
- Balance stored as snapshot on each transaction (immutable ledger pattern)
- Pending and available balance as separate computed views
- Amounts stored as integers (cents) to avoid floating-point precision issues

**Deal Lifecycle States**
- Deals: `draft`, `active`, `paused`, `expired`, `archived`
- Enrollments: `applied`, `accepted`, `rejected`, `active`, `completed`, `cancelled`
- Status transitions tracked with timestamps for analytics

**Affiliate Attribution**
- Last-click attribution (standard industry practice, simpler to implement)
- 30-day cookie window for attribution
- Capture: click timestamp, referrer URL, UTM params, device type, user agent
- Conversion links back to originating click for full attribution chain

**General Schema Patterns**
- UUID primary keys for all tables
- `created_at` and `updated_at` on all tables
- Soft deletes via `deleted_at` where business logic requires history
- Foreign keys with appropriate cascade rules
- Indexes on frequently queried columns (user_id, status, created_at)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches based on Supabase best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-database-foundation*
*Context gathered: 2026-02-02*

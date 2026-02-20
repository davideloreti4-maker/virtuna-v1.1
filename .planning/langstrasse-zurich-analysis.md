# LangstrasseZurich.ch - Detailed Project Analysis & Critical Optimizations

**Date:** 2026-02-20
**Analyst:** David (Virtuna)
**Status:** Pre-development analysis

---

## 1. Project Brief Assessment

### What This Is
A local city guide app for the Langstrasse area (Kreis 3, 4, 5) in Zurich. It digitizes an existing community promotion project (6th edition) into a mobile-first web/app experience for discovering restaurants, bars, cafes, cultural venues, and events.

### What This Is NOT
This is NOT a Virtuna extension. It's a standalone product for a different market (local gastro/culture discovery vs. TikTok creator analytics). The codebases should be separate.

### Target Audience
1. **Local residents** (Kreis 3/4/5) looking for new spots
2. **Zurich visitors** wanting authentic non-tourist experiences
3. **Business owners** wanting local promotion
4. **Event organizers** wanting visibility

### Competitive Landscape (Zurich)
- **Google Maps** - generic, no curation
- **TripAdvisor/Yelp** - tourist-oriented, not hyper-local
- **Lunchgate.ch** - Swiss restaurant reservations
- **Ron Orp** - Zurich events newsletter
- **Tsri.ch** - Zurich local journalism
- **None** have a focused Langstrasse-only curated experience

**Key differentiator:** Curated, hyper-local, community-driven. This is the project's strength.

---

## 2. Critical Decision: Native App vs. PWA

### Recommendation: Progressive Web App (PWA) first, NOT a native app

**Reasoning:**

| Factor | Native App | PWA |
|--------|-----------|-----|
| Development cost | 2-3x (iOS + Android + backend) | 1x (single codebase) |
| App Store approval | Weeks, Apple review risk | Instant deployment |
| Updates | App Store review cycle | Instant |
| Discoverability | App Store search (weak for local) | Google search (strong for "Langstrasse Zurich") |
| Installation barrier | High (download from store) | Low (add to home screen, or just use browser) |
| Map integration | Native maps SDK | Google Maps JS API (excellent) |
| Push notifications | Yes | Yes (Web Push API) |
| Offline | Yes | Yes (Service Worker) |
| Maintenance | Ongoing per-platform | Single codebase |

**Critical insight:** For a LOCAL discovery project, SEO matters more than App Store presence. People search "restaurants Langstrasse Zurich" on Google, not in the App Store. A PWA with good SEO will outperform a native app in user acquisition for this use case.

**If the partner insists on "an app":** A PWA IS installable on both iOS and Android home screens. It looks and feels like a native app. For a content-focused app with maps, there is no functional difference.

---

## 3. Recommended Tech Stack

Given your existing expertise (Next.js, Supabase, Tailwind, Vercel):

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | You already know it. SSR/SSG for SEO. PWA-ready |
| **Database** | Supabase (new project) | You already know it. Free tier covers MVP easily |
| **Styling** | Tailwind CSS v4 | You already know it. But use a DIFFERENT design system (not Raycast) |
| **Maps** | Mapbox GL JS or Google Maps JS | See section 4 below |
| **Hosting** | Vercel | You already know it. Edge functions for Zurich users |
| **CMS** | Supabase + simple admin panel | NOT a headless CMS. Overkill for this. See section 5 |
| **Images** | Supabase Storage + Next.js Image | Optimized delivery |
| **Analytics** | Plausible or Umami (self-hosted) | Privacy-first (Swiss market cares about this) |
| **Auth** | None for MVP readers / Supabase Auth for admin | See section 6 |

### What NOT to use from Virtuna's stack
- **Three.js / @react-three** - No 3D needed
- **OpenAI / Google GenAI** - No AI needed for MVP
- **Recharts** - No complex data viz needed
- **Framer Motion** - Keep minimal. Simple CSS transitions suffice
- **Zustand** - Likely unnecessary. Server state + URL state is enough
- **Whop** - Different payment model needed (if any)

---

## 4. Critical: Map Provider Decision

### Option A: Mapbox GL JS (Recommended)
- Beautiful dark/custom map styles that match branding
- Cluster support for dense pin areas (Langstrasse IS dense)
- 50,000 free map loads/month (more than enough)
- Custom markers with category icons
- Smooth animations and gestures
- Full control over styling

### Option B: Google Maps JS API
- Users know the UX
- Street View integration
- 28,500 free map loads/month
- Less customizable styling
- Heavier bundle

### Why Mapbox wins here
The Langstrasse area is ~1.5km long. All pins will be VERY close together. You need:
- **Custom clustering** to prevent pin overlap
- **Category filtering** on the map (show only bars, only restaurants, etc.)
- **Custom styled markers** (not generic Google red pins)
- **Branding control** (dark map that matches app aesthetic)

Mapbox does all of this better than Google Maps for this specific use case.

---

## 5. Database Schema Design (Critical)

### Entities

```sql
-- Core location data
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- URL-friendly: "restaurant-casa-ferlin"
  name TEXT NOT NULL,
  description_de TEXT,                 -- German first
  description_en TEXT,                 -- English second
  category TEXT NOT NULL CHECK (category IN ('eat', 'drink', 'coffee', 'culture', 'nightlife')),
  subcategory TEXT,                    -- "italian", "cocktail-bar", "gallery"

  -- Location
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL CHECK (postal_code IN ('8003', '8004', '8005')),
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  kreis TEXT NOT NULL CHECK (kreis IN ('3', '4', '5')),

  -- Contact
  phone TEXT,
  website TEXT,
  instagram TEXT,

  -- Hours (JSONB for flexibility)
  opening_hours JSONB,                 -- {"mon": "11:00-23:00", "tue": "11:00-23:00", ...}

  -- Media
  cover_image_url TEXT,
  images TEXT[] DEFAULT '{}',

  -- Features
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  price_range INTEGER CHECK (price_range BETWEEN 1 AND 3),  -- 1=cheap, 2=mid, 3=expensive
  tags TEXT[] DEFAULT '{}',            -- ["outdoor-seating", "vegan-options", "live-music"]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for map queries
CREATE INDEX idx_locations_geo ON locations USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_locations_category ON locations(category);
CREATE INDEX idx_locations_kreis ON locations(kreis);
CREATE INDEX idx_locations_featured ON locations(is_featured) WHERE is_featured = true;
CREATE INDEX idx_locations_slug ON locations(slug);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,

  -- Timing
  start_date DATE NOT NULL,
  end_date DATE,                       -- NULL = single day event
  start_time TIME,
  end_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,                -- iCal RRULE format if recurring

  -- Location
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  custom_address TEXT,                 -- If not at a known location

  -- Details
  category TEXT CHECK (category IN ('eat', 'drink', 'coffee', 'culture', 'nightlife')),
  cover_image_url TEXT,
  external_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_featured ON events(is_featured) WHERE is_featured = true;

-- Admin users (for content management)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simple analytics (privacy-first)
CREATE TABLE location_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  referrer TEXT                        -- "map", "home", "category", "search"
);

CREATE INDEX idx_location_views_location ON location_views(location_id);
CREATE INDEX idx_location_views_date ON location_views(viewed_at);
```

### Critical Schema Decisions

1. **Bilingual from day one (de/en).** Zurich is multilingual. Adding i18n later is 10x harder than starting with it. Even if you only fill German content at launch, the columns are ready.

2. **PostGIS for spatial queries.** Supabase supports PostGIS. Use it. "Show locations within 500m of me" requires spatial indexing. Without PostGIS, you'd have to load ALL locations client-side and filter - wasteful.

3. **JSONB for opening hours.** Hours vary wildly (closed Monday, open late Saturday, lunch break Tuesday). A structured JSONB column is the right tradeoff between flexibility and queryability.

4. **Slugs, not IDs in URLs.** `/location/restaurant-casa-ferlin` is better for SEO than `/location/a1b2c3d4`. Generate slugs on insert.

5. **Tags array instead of boolean columns.** Don't add `has_outdoor_seating`, `has_vegan`, `has_wifi` as individual columns. Use a tags array. More flexible, no migrations needed when you add new tags.

---

## 6. Critical Optimizations

### 6.1 NO user auth for readers (MVP)

The brief doesn't mention user accounts, favorites, or reviews. Don't add them.

- No login wall = zero friction = more users
- Auth only for admin panel (content editors)
- If "favorites" are wanted later: use localStorage, no account needed
- If user accounts are wanted later: add Supabase Auth then

**Adding auth to an MVP content app is the #1 premature complexity mistake.**

### 6.2 Static Generation (SSG) for location pages

Location data changes rarely (maybe weekly). Use Next.js ISR (Incremental Static Regeneration):

```tsx
// app/location/[slug]/page.tsx
export const revalidate = 3600; // Revalidate every hour

export async function generateStaticParams() {
  const locations = await getLocations();
  return locations.map(l => ({ slug: l.slug }));
}
```

This means:
- Location pages load instantly (served from CDN)
- Zero database queries for page views
- Supabase free tier never gets stressed
- Perfect Lighthouse scores

### 6.3 Single API call for home screen

The home screen needs: featured locations, this week's events, and categories. Make this ONE server component query, not three separate API calls:

```sql
-- Featured locations + event count in one query
SELECT
  l.*,
  (SELECT COUNT(*) FROM events e
   WHERE e.location_id = l.id
   AND e.start_date >= CURRENT_DATE
   AND e.start_date <= CURRENT_DATE + INTERVAL '7 days'
  ) as events_this_week
FROM locations l
WHERE l.is_featured = true AND l.is_active = true
ORDER BY l.updated_at DESC
LIMIT 6;
```

### 6.4 Map performance: Load locations as GeoJSON, not individual fetches

```tsx
// WRONG: Fetch each location, render individual markers
locations.map(l => <Marker key={l.id} position={[l.lat, l.lng]} />)

// RIGHT: Fetch ALL locations as GeoJSON once, let Mapbox handle rendering
const geojson = await fetch('/api/locations/geojson');
map.addSource('locations', { type: 'geojson', data: geojson });
map.addLayer({ id: 'location-pins', type: 'symbol', source: 'locations' });
```

With ~100-200 locations in the Langstrasse area, a single GeoJSON load is under 50KB. Mapbox's WebGL renderer handles this natively with clustering. No React re-renders for map interactions.

### 6.5 Image optimization strategy

Restaurant/venue photos will be the heaviest assets. Strategy:

1. **Supabase Storage** for originals (uploaded by admin)
2. **Supabase Image Transformations** for resizing on the fly
3. **Next.js `<Image>`** with `sizes` prop for responsive loading
4. **WebP/AVIF format** via Next.js automatic optimization
5. **Blur placeholder** generated at build time for perceived performance

```tsx
<Image
  src={location.cover_image_url}
  alt={location.name}
  width={400}
  height={300}
  sizes="(max-width: 768px) 100vw, 50vw"
  placeholder="blur"
  blurDataURL={location.blur_hash}
/>
```

### 6.6 SEO is the primary acquisition channel

For a local discovery app, Google is how people find you. Critical SEO:

1. **Structured data (JSON-LD)** on every location page:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Restaurant",
     "name": "Casa Ferlin",
     "address": { "@type": "PostalAddress", "streetAddress": "..." },
     "geo": { "@type": "GeoCoordinates", "latitude": 47.37, "longitude": 8.53 },
     "openingHours": "Mo-Fr 11:00-23:00",
     "servesCuisine": "Italian"
   }
   ```

2. **Dynamic OG images** per location (Next.js `opengraph-image.tsx`)

3. **Sitemap** auto-generated from location slugs

4. **Local SEO keywords** in meta: "Restaurant Langstrasse", "Bar Kreis 4 Zurich", etc.

5. **Google Business Profile** for LangstrasseZurich.ch itself

### 6.7 Offline capability via Service Worker

Zurich has good connectivity, but for the "walking guide" use case, cache:
- The map tiles for the Langstrasse area
- Location list (GeoJSON)
- Images of favorited/viewed locations

Next.js + `next-pwa` or Serwist makes this straightforward.

---

## 7. MVP Feature Prioritization (What to Cut)

The brief lists 5 core features. Here's the priority order:

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Location list + detail pages | Core value. People need to find places |
| **P0** | Category filtering | Useless without filtering |
| **P0** | Map view with pins | Core UX for spatial discovery |
| **P1** | Events page | Important but can launch without it initially |
| **P1** | Featured/home screen | Can be a simple list initially |
| **P2** | Search | Filter by category first, full-text search later |
| **P2** | Route/directions button | Deep link to Google Maps is trivial |
| **P3** | Community/storytelling | Post-MVP. Content strategy needed first |

### What to explicitly NOT build for MVP
- User accounts / login
- Reviews / ratings
- Favorites (use localStorage if needed)
- Booking / reservations
- Push notifications
- Multi-language (launch German only, add English in v1.1)
- Dark mode / theme switching
- Social sharing (just use native share API)
- In-app messaging

---

## 8. Data Entry & Content Management

### Critical question: Who enters the ~100-200 locations?

Options:
1. **Manual entry via admin panel** - Build a simple CRUD admin
2. **Google Sheets import** - Partner maintains a spreadsheet, script imports it
3. **Google Places API enrichment** - Seed basic data, enrich with opening hours/photos

### Recommendation: Hybrid approach

1. Partner provides a Google Sheet with: name, address, category, Instagram, short description
2. Script geocodes addresses (Google Geocoding API or Nominatim for free)
3. Script pulls opening hours + photos from Google Places API
4. Import into Supabase
5. Admin panel for ongoing edits

**This saves weeks of manual data entry.** The Google Places API gives you:
- Verified opening hours
- Photos (with attribution)
- Phone numbers
- Website URLs
- Star ratings (for internal reference)

Cost: Google Places API gives $200/month free credit. Enriching 200 locations once costs ~$2.

---

## 9. Monetization Architecture (Build hooks now, monetize later)

Even though monetization is "later," build these hooks into the schema now:

```sql
-- Add to locations table:
listing_tier TEXT DEFAULT 'free' CHECK (listing_tier IN ('free', 'featured', 'premium')),
listing_expires_at TIMESTAMPTZ,
listing_paid_at TIMESTAMPTZ,

-- Featured listings appear:
-- "free" = normal listing
-- "featured" = appears in "Featured" section on home, highlighted on map
-- "premium" = featured + larger card + analytics dashboard for the business
```

This costs nothing to add now but saves a migration + data backfill later.

---

## 10. Project Structure (Recommended)

```
langstrasse-zurich/
├── src/
│   ├── app/
│   │   ├── (public)/              # No auth required
│   │   │   ├── page.tsx           # Home
│   │   │   ├── map/page.tsx       # Map view
│   │   │   ├── category/[slug]/page.tsx  # Category listing
│   │   │   ├── location/[slug]/page.tsx  # Location detail
│   │   │   ├── events/page.tsx    # Events listing
│   │   │   └── event/[slug]/page.tsx     # Event detail
│   │   ├── (admin)/               # Auth required
│   │   │   ├── admin/layout.tsx
│   │   │   ├── admin/locations/page.tsx
│   │   │   ├── admin/events/page.tsx
│   │   │   └── admin/analytics/page.tsx
│   │   ├── api/
│   │   │   ├── locations/geojson/route.ts
│   │   │   └── revalidate/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── LocationMarker.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── location/
│   │   │   ├── LocationCard.tsx
│   │   │   ├── LocationDetail.tsx
│   │   │   └── OpeningHours.tsx
│   │   ├── event/
│   │   │   ├── EventCard.tsx
│   │   │   └── EventList.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   ├── queries/
│   │   └── utils.ts
│   └── types/
│       └── database.types.ts
├── public/
│   ├── icons/                     # Category icons
│   └── manifest.json              # PWA manifest
├── supabase/
│   ├── migrations/
│   └── seed.sql                   # Initial location data
└── scripts/
    ├── import-from-sheets.ts      # Google Sheets importer
    └── enrich-from-google.ts      # Google Places enrichment
```

---

## 11. Cost Estimate (Monthly, Post-Launch)

| Service | Free Tier | Expected Cost |
|---------|-----------|---------------|
| Vercel (hosting) | 100GB bandwidth | $0 |
| Supabase (database) | 500MB, 50k auth users | $0 |
| Mapbox (maps) | 50k loads/month | $0 |
| Domain (langstrassezurich.ch) | - | ~CHF 15/year |
| Google Places API (one-time enrichment) | $200 credit/month | $0 |
| Supabase Storage (images) | 1GB free | $0 |
| **Total MVP** | | **~$0/month** |

The entire MVP can run on free tiers. This is a significant advantage of the PWA approach.

---

## 12. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Data quality** - stale hours, closed places | HIGH | Automated Google Places sync quarterly. "Report issue" button |
| **Content cold start** - empty app at launch | HIGH | Pre-populate 50+ locations before launch. Partner's existing contacts |
| **Low adoption** - nobody installs it | MEDIUM | PWA eliminates install barrier. SEO brings organic traffic |
| **Partner expectations** - "I want it like Uber Eats" | HIGH | Clear MVP scope document. Sign off on feature list BEFORE development |
| **Scope creep** - "can we also add reviews/booking/..." | HIGH | Strict MVP. Phase 2 backlog. Written agreement on MVP scope |
| **Maps API cost** - unexpected viral usage | LOW | Mapbox free tier is generous. Add billing alerts |
| **GDPR/Swiss data law compliance** | MEDIUM | No user tracking. Privacy-first analytics. Cookie banner if analytics used |

---

## 13. Actionable Next Steps

1. **Get the location data** - Ask partner for their existing list of businesses (spreadsheet)
2. **Agree on MVP scope** - Share this document. Get written sign-off on what's in/out
3. **Set up the project** - New repo, new Supabase project, new Vercel project
4. **Import & enrich data** - Script to geocode + enrich from Google Places
5. **Build location pages first** - Static pages with SEO are the foundation
6. **Add map view** - Mapbox + GeoJSON layer
7. **Add events** - Simple list, admin can add via panel
8. **PWA setup** - manifest.json, service worker, offline support
9. **Launch** - Domain, DNS, go live

---

## 14. Pricing Considerations for the Client

### What to charge

This is a client project (your partner's business). Pricing models:

**Option A: Fixed price + maintenance**
- MVP development: CHF X (based on your hourly rate)
- Monthly maintenance: CHF Y/month (hosting, updates, bug fixes)
- Content updates: included or CHF Z/update

**Option B: Revenue share**
- Reduced development fee
- Percentage of future "featured listing" revenue
- Risk: no revenue for months/years

**Option C: Equity/partnership**
- No development fee
- Ownership stake in LangstrasseZurich
- Risk: project may not monetize

**Recommendation:** Option A with a clear scope. Fixed price for MVP, monthly retainer for maintenance. Revenue share only if you believe in the long-term vision AND have it in a written contract.

---

## Summary

The LangstrasseZurich project is well-scoped for an MVP. The critical optimizations are:

1. **PWA, not native app** - saves 2-3x development cost, better for local SEO
2. **Mapbox over Google Maps** - better for dense urban area with custom styling
3. **SSG/ISR for location pages** - zero database load, instant page loads, perfect SEO
4. **No user auth for MVP** - zero friction for readers
5. **Bilingual schema from day one** - prevents painful migration later
6. **Google Places API enrichment** - automates 80% of data entry
7. **GeoJSON for map data** - single load, WebGL rendering, native clustering
8. **Monetization hooks in schema** - costs nothing now, saves work later
9. **Privacy-first analytics** - Swiss market demands it
10. **Clear MVP scope agreement** - biggest risk is scope creep, not technology

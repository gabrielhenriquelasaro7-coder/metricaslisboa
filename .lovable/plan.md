

# Instagram Dashboard: Data Fix and Visual Improvement

## Problem Summary

The sync successfully saves account info (12k followers) and 50 media items, but:
- All per-media metrics (reach, views, shares, saved) are **0** -- the insights API calls fail silently
- Daily insights table has **0 rows** -- the daily metrics API also fails silently
- Images show ugly gray bars due to `object-contain` in the grid
- The overall visualization looks sparse and incomplete

## Root Causes

1. **Meta Graph API v21 metric changes**: Some metric names (`accounts_engaged`, `total_interactions`, `follows_and_unfollows`) may not be available or require different parameters in the current API version. Errors are swallowed by try/catch blocks with no user feedback.
2. **Per-media insights failing**: The metrics `likes`, `comments`, `shares`, `saved`, `total_interactions` for individual media may require different names or the API call format may be wrong. Again, errors are silently caught.
3. **Image display**: Grid uses `object-contain` (shows full image with gray padding) instead of `object-cover` (fills square, crops edges).

## Plan

### 1. Fix Edge Function (`instagram-sync`)

**Daily Insights (Step 3):**
- Split the metrics request into smaller batches -- Meta API sometimes rejects when too many metrics are requested at once
- Use separate calls for basic metrics (`reach`, `impressions`, `profile_views`, `website_clicks`) and interaction metrics (`likes`, `comments`, `shares`, `saves`, `follows_and_unfollows`)
- Add detailed error logging with metric names so we can see exactly which metrics fail
- Add fallback: if combined request fails, try metrics individually

**Per-Media Insights (Step 6):**
- Add proper error logging with the specific media ID and error message
- Use fallback values from the basic media fields (`like_count`, `comments_count`) when insights API fails
- Handle the case where some metrics simply aren't available for older posts (API returns error for posts older than 2 years)

**General improvements:**
- Log all API responses (not just errors) so we can debug via function logs
- Return detailed sync report with counts of successful/failed insight fetches

### 2. Fix Image Grid (No More Gray Bars)

**`InstagramPostsGrid.tsx`:**
- Change from `object-contain bg-black/5` to `object-cover` in the grid thumbnails
- This fills the square completely, cropping edges naturally (standard Instagram behavior)
- Keep `object-contain` only in the detail modal where full image visibility matters

### 3. Improve Visualization

**`InstagramPage.tsx`:**
- Add a summary banner showing sync status (last sync date, media count, insights days)
- Show a warning when insights data is empty (guiding user to re-sync)

**`InstagramMetricsGrid.tsx`:**
- Add subtle animations on metric cards
- Show "last 30 days" label to clarify the time period
- Add visual indicator when a metric is 0 (dimmed styling)

**`InstagramPerformanceChart.tsx`:**
- Add area fill under lines for better visual appeal
- Add date range label in header
- Handle empty data state with a helpful message

**`InstagramPostsGrid.tsx`:**
- Add engagement rate per post (interactions / reach)
- Show post date overlay on thumbnails
- Better empty state design

**`InstagramDemographics.tsx`:**
- Add a note when demographics aren't available (requires 100+ followers -- this account has 12k so it should work after fixing the sync)

### 4. Files to Change

| File | Changes |
|------|---------|
| `supabase/functions/instagram-sync/index.ts` | Fix metric fetching with fallbacks, better logging |
| `src/components/instagram/InstagramPostsGrid.tsx` | `object-cover` for grid, date overlay, engagement rate |
| `src/components/instagram/InstagramMetricsGrid.tsx` | Period label, zero-state styling, animations |
| `src/components/instagram/InstagramPerformanceChart.tsx` | Area fill, empty state, date range |
| `src/components/instagram/InstagramDemographics.tsx` | Better empty state message |
| `src/pages/Instagram.tsx` | Sync status banner, warning for empty insights |
| `src/components/instagram/InstagramPostDetailModal.tsx` | Minor visual polish |
| `src/components/instagram/InstagramProfileHeader.tsx` | Add engagement rate badge |


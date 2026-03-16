

## Plan: Fix Auto-Selection of Project - Force Welcome Screen

### Problem
Multiple places in the code auto-select `projects[0]` as fallback when no project is selected, which defeats the Welcome screen. The main culprits:

1. **`DashboardLayout.tsx`** (lines 52-57) - Queries DB for first project and sets it in localStorage
2. **`useGoogleAdsData.tsx`** (line 159) - Falls back to `projects[0]`
3. **`Financial.tsx`** (line 109) - Falls back to `projects[0]`
4. **`WhatsApp.tsx`** (line 48) - Falls back to `projects[0]`
5. **`Clarity.tsx`** (lines 53-54) - Falls back to `projects[0]`

Additionally, the session persistence (`sessionStorage` vs `localStorage`) needs to change so projects are forgotten on new login but remembered during page refreshes within the same session.

### Changes

**1. `DashboardLayout.tsx`** - Remove auto-select logic (lines 52-57)
- Remove the block that queries projects and sets `selectedProjectId` when none exists
- If no project selected, just skip the import check

**2. `useGoogleAdsData.tsx`** (line 159) - Remove `|| projects[0]` fallback
- Change to: `projects.find(p => p.id === selectedProjectId) || null`

**3. `Financial.tsx`** (line 109) - Remove `|| projects[0]` fallback

**4. `WhatsApp.tsx`** (line 48) - Remove `|| projects[0]` fallback

**5. `Clarity.tsx`** (lines 53-54) - Remove `|| projects[0]` fallback

**6. Session-based persistence** - Use `sessionStorage` instead of `localStorage` for `selectedProjectId`
- This way: refreshing the page keeps the project, but closing browser/new login starts fresh
- Create a small utility to centralize `get/set/removeSelectedProjectId` using `sessionStorage`
- Update all 18+ files that reference `localStorage.getItem('selectedProjectId')` to use the utility

Wait -- actually using sessionStorage across all files is a large refactor. A simpler approach:

**Simpler approach**: Keep `localStorage` but ensure it's cleared on every fresh login (already done in `Auth.tsx` and `useAuth.tsx`). The real problem is the **auto-select fallbacks** that re-set it immediately after clearing.

### Final Plan (5 file edits)

1. **`DashboardLayout.tsx`** - Remove lines 52-57 (the auto-select block that queries projects and sets localStorage)

2. **`useGoogleAdsData.tsx`** line 159 - Change `|| projects[0]` to `|| null`

3. **`Financial.tsx`** line 109 - Change `|| projects[0]` to `|| null`

4. **`WhatsApp.tsx`** line 48 - Change `|| projects[0]` to `|| null`

5. **`Clarity.tsx`** lines 53-54 - Change `projects[0]` fallbacks to `null`

These changes ensure that when `selectedProjectId` is cleared on login, no code re-selects a project automatically, and the Dashboard Welcome screen will appear.


import { useState, useEffect, useCallback } from 'react';
import { useUserRole } from './useUserRole';

const TOUR_STORAGE_KEY = 'dashboard_tour_completed';
const GUEST_ONBOARDING_KEY = 'guestOnboardingComplete';
const TOUR_PENDING_KEY = 'tour_pending';

export function useTour() {
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const { isGuest, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Debug logs
    console.log('[useTour] roleLoading:', roleLoading, 'isGuest:', isGuest);
    console.log('[useTour] localStorage:', {
      tourCompleted: localStorage.getItem(TOUR_STORAGE_KEY),
      onboardingComplete: localStorage.getItem(GUEST_ONBOARDING_KEY),
      tourPending: localStorage.getItem(TOUR_PENDING_KEY),
    });

    // Wait for role to load
    if (roleLoading) {
      console.log('[useTour] Still loading role, waiting...');
      return;
    }

    // Check if tour has been completed before
    const completed = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    setTourCompleted(completed);

    if (completed) {
      console.log('[useTour] Tour already completed, not showing');
      return;
    }

    // Only show tour for guests
    if (!isGuest) {
      console.log('[useTour] User is not a guest, not showing tour');
      return;
    }

    // Check if user just came from guest onboarding OR if tour is pending
    const justOnboarded = localStorage.getItem(GUEST_ONBOARDING_KEY) === 'true';
    const tourPending = localStorage.getItem(TOUR_PENDING_KEY) === 'true';
    
    console.log('[useTour] Checking conditions:', { justOnboarded, tourPending, completed });

    // Show tour if just completed onboarding OR if tour is pending
    if (justOnboarded || tourPending) {
      console.log('[useTour] Conditions met, will show tour in 1 second');
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        console.log('[useTour] Showing tour now!');
        setShowTour(true);
        // Clear the pending flag (but keep onboarding complete)
        localStorage.removeItem(TOUR_PENDING_KEY);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      console.log('[useTour] Conditions not met for tour');
    }
  }, [isGuest, roleLoading]);

  const startTour = useCallback(() => {
    console.log('[useTour] startTour called');
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    console.log('[useTour] Tour completed');
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const skipTour = useCallback(() => {
    console.log('[useTour] Tour skipped');
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const resetTour = useCallback(() => {
    console.log('[useTour] Tour reset');
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.setItem(TOUR_PENDING_KEY, 'true');
    setTourCompleted(false);
  }, []);

  return {
    showTour,
    tourCompleted,
    startTour,
    completeTour,
    skipTour,
    resetTour,
  };
}

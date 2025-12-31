import { useState, useEffect, useCallback } from 'react';

const TOUR_STORAGE_KEY = 'dashboard_tour_completed';
const GUEST_ONBOARDING_KEY = 'guestOnboardingComplete';

export function useTour() {
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);

  useEffect(() => {
    // Check if tour has been completed before
    const completed = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    setTourCompleted(completed);

    // Check if user just came from guest onboarding
    const justOnboarded = localStorage.getItem(GUEST_ONBOARDING_KEY) === 'true';
    const tourPending = localStorage.getItem('tour_pending') === 'true';
    
    // Show tour if just completed onboarding OR if tour is pending and not completed
    if ((justOnboarded || tourPending) && !completed) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setShowTour(true);
        // Clear the pending flag
        localStorage.removeItem('tour_pending');
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const skipTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
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

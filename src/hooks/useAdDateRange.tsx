import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';

interface UseAdDateRangeResult {
  availableDateRange: { minDate: string; maxDate: string } | null;
  loading: boolean;
  suggestedDateRange: DateRange | undefined;
}

/**
 * Hook to fetch the available date range for an ad's metrics
 * This helps set the correct date range when viewing ad details
 */
export function useAdDateRange(adId: string | undefined): UseAdDateRangeResult {
  const [availableDateRange, setAvailableDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestedDateRange, setSuggestedDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!adId) {
      setLoading(false);
      return;
    }

    const fetchDateRange = async () => {
      setLoading(true);
      try {
        // Get min and max dates for this ad
        const { data, error } = await supabase
          .from('ads_daily_metrics')
          .select('date')
          .eq('ad_id', adId)
          .order('date', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const dates = data.map(d => d.date).sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          
          setAvailableDateRange({ minDate, maxDate });
          
          // Create suggested date range (from min to max date of available data)
          setSuggestedDateRange({
            from: new Date(minDate),
            to: new Date(maxDate),
          });
          
          console.log(`[useAdDateRange] Ad ${adId} has data from ${minDate} to ${maxDate}`);
        } else {
          setAvailableDateRange(null);
          setSuggestedDateRange(undefined);
          console.log(`[useAdDateRange] No data found for ad ${adId}`);
        }
      } catch (err) {
        console.error('[useAdDateRange] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDateRange();
  }, [adId]);

  return { availableDateRange, loading, suggestedDateRange };
}

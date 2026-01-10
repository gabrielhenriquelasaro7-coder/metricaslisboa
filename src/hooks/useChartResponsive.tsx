import * as React from "react";

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

export interface ChartResponsiveConfig {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Chart dimensions
  chartHeight: number;
  // Axis configuration
  xAxisFontSize: number;
  yAxisFontSize: number;
  xAxisTickCount: number;
  xAxisAngle: number;
  xAxisTextAnchor: "start" | "middle" | "end";
  // Data density
  maxDataPoints: number;
  // Dot/marker sizes
  dotRadius: number;
  activeDotRadius: number;
  strokeWidth: number;
  // Legend
  legendFontSize: number;
  legendWrapperStyle: React.CSSProperties;
  // Margins
  chartMargins: { top: number; right: number; bottom: number; left: number };
  // Tooltip
  tooltipFontSize: number;
  // Bar chart
  barRadius: [number, number, number, number];
  // Pie chart
  pieInnerRadius: number;
  pieOuterRadius: number;
}

export function useChartResponsive(): ChartResponsiveConfig {
  const [screenWidth, setScreenWidth] = React.useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  React.useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    // Debounce resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener("resize", debouncedResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const isMobile = screenWidth < MOBILE_BREAKPOINT;
  const isTablet = screenWidth >= MOBILE_BREAKPOINT && screenWidth < TABLET_BREAKPOINT;
  const isDesktop = screenWidth >= TABLET_BREAKPOINT;

  // Calculate responsive values based on screen size
  const config: ChartResponsiveConfig = React.useMemo(() => {
    if (isMobile) {
      return {
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        // Increased height for mobile
        chartHeight: 260,
        // Smaller fonts for mobile
        xAxisFontSize: 9,
        yAxisFontSize: 9,
        // Fewer ticks on mobile
        xAxisTickCount: 4,
        // Rotate labels on mobile for readability
        xAxisAngle: -45,
        xAxisTextAnchor: "end" as const,
        // Reduce data density on mobile
        maxDataPoints: 15,
        // Smaller markers
        dotRadius: 2,
        activeDotRadius: 4,
        strokeWidth: 1.5,
        // Legend
        legendFontSize: 10,
        legendWrapperStyle: { 
          paddingTop: '8px', 
          fontSize: '10px',
          display: 'flex',
          flexWrap: 'wrap' as const,
          justifyContent: 'center',
          gap: '4px'
        },
        // Tighter margins for mobile
        chartMargins: { top: 5, right: 5, bottom: 35, left: 0 },
        // Tooltip
        tooltipFontSize: 11,
        // Bar chart
        barRadius: [2, 2, 0, 0] as [number, number, number, number],
        // Pie chart
        pieInnerRadius: 30,
        pieOuterRadius: 50,
      };
    } else if (isTablet) {
      return {
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        chartHeight: 340,
        xAxisFontSize: 10,
        yAxisFontSize: 10,
        xAxisTickCount: 6,
        xAxisAngle: -30,
        xAxisTextAnchor: "end" as const,
        maxDataPoints: 30,
        dotRadius: 3,
        activeDotRadius: 5,
        strokeWidth: 2,
        legendFontSize: 11,
        legendWrapperStyle: { paddingTop: '12px', fontSize: '11px' },
        chartMargins: { top: 10, right: 15, bottom: 25, left: 0 },
        tooltipFontSize: 12,
        barRadius: [3, 3, 0, 0] as [number, number, number, number],
        pieInnerRadius: 35,
        pieOuterRadius: 60,
      };
    } else {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        chartHeight: 400,
        xAxisFontSize: 11,
        yAxisFontSize: 11,
        xAxisTickCount: 10,
        xAxisAngle: 0,
        xAxisTextAnchor: "middle" as const,
        maxDataPoints: 60,
        dotRadius: 4,
        activeDotRadius: 7,
        strokeWidth: 2.5,
        legendFontSize: 12,
        legendWrapperStyle: { paddingTop: '16px', fontSize: '12px' },
        chartMargins: { top: 10, right: 30, bottom: 0, left: 0 },
        tooltipFontSize: 13,
        barRadius: [4, 4, 0, 0] as [number, number, number, number],
        pieInnerRadius: 40,
        pieOuterRadius: 70,
      };
    }
  }, [isMobile, isTablet, isDesktop]);

  return config;
}

// Helper to sample data points for mobile
export function sampleDataForMobile<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  const sampled: T[] = [];
  
  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }
  
  // Always include the last data point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }
  
  return sampled;
}

// Helper to abbreviate labels for mobile
export function abbreviateLabel(label: string, maxLength: number = 6): string {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 1) + '…';
}

// Helper to format axis values compactly for mobile
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
  return value.toString();
}

export function formatCompactCurrency(value: number, currency: string = 'BRL'): string {
  if (value >= 1000000) {
    return (currency === 'USD' ? '$' : 'R$') + (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (currency === 'USD' ? '$' : 'R$') + (value / 1000).toFixed(0) + 'K';
  }
  return (currency === 'USD' ? '$' : 'R$') + value.toFixed(0);
}

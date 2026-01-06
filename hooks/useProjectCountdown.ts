'use client';

import { useState, useEffect, useMemo } from 'react';

export interface CountdownResult {
  isExpired: boolean;
  isStarted: boolean;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  formattedTime: string;
  percentageRemaining: number;
}

/**
 * Custom hook for calculating project countdown timer
 * @param startDate - Project start date in YYYY-MM-DD format
 * @param endDate - Project end date in YYYY-MM-DD format
 * @param updateInterval - How often to update in ms (default: 60000 = 1 minute)
 */
export function useProjectCountdown(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  updateInterval: number = 60000
): CountdownResult {
  const [now, setNow] = useState(() => new Date());

  // Update the current time at the specified interval
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return useMemo(() => {
    // Handle missing dates
    if (!startDate || !endDate) {
      return {
        isExpired: false,
        isStarted: false,
        timeRemaining: { days: 0, hours: 0, minutes: 0, seconds: 0 },
        formattedTime: '',
        percentageRemaining: 100,
      };
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    const currentTime = now.getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();

    // Check if project hasn't started yet
    const isStarted = currentTime >= startTime;

    // Check if project is expired
    const isExpired = currentTime > endTime;

    // Calculate time remaining until end
    const msRemaining = Math.max(0, endTime - currentTime);
    const totalDuration = endTime - startTime;

    // Calculate percentage remaining
    const percentageRemaining = totalDuration > 0
      ? Math.max(0, Math.min(100, (msRemaining / totalDuration) * 100))
      : 0;

    // Convert to days, hours, minutes, seconds
    const seconds = Math.floor((msRemaining / 1000) % 60);
    const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);
    const hours = Math.floor((msRemaining / (1000 * 60 * 60)) % 24);
    const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

    // Format the time remaining as a human-readable string
    let formattedTime = '';
    if (isExpired) {
      formattedTime = 'Expired';
    } else if (!isStarted) {
      const msUntilStart = startTime - currentTime;
      const daysUntilStart = Math.ceil(msUntilStart / (1000 * 60 * 60 * 24));
      formattedTime = daysUntilStart === 1 ? 'Starts tomorrow' : `Starts in ${daysUntilStart} days`;
    } else if (days > 0) {
      formattedTime = days === 1 ? '1 day left' : `${days} days left`;
    } else if (hours > 0) {
      formattedTime = hours === 1 ? '1 hour left' : `${hours} hours left`;
    } else if (minutes > 0) {
      formattedTime = minutes === 1 ? '1 minute left' : `${minutes} minutes left`;
    } else {
      formattedTime = 'Ending soon';
    }

    return {
      isExpired,
      isStarted,
      timeRemaining: { days, hours, minutes, seconds },
      formattedTime,
      percentageRemaining,
    };
  }, [startDate, endDate, now]);
}

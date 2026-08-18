export const getFormattedDateStr = (daysFromNow: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

export const calculateTripDurationAndSeason = (depDateStr: string, retDateStr: string) => {
  try {
    const dep = new Date(depDateStr + 'T00:00:00');
    const ret = new Date(retDateStr + 'T00:00:00');
    const diffTime = ret.getTime() - dep.getTime();
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const month = dep.getMonth();
    let season = 'Summer';
    if (month >= 2 && month <= 4) season = 'Spring';
    else if (month >= 5 && month <= 7) season = 'Summer';
    else if (month >= 8 && month <= 10) season = 'Autumn / Fall';
    else season = 'Winter';

    return { 
      diffDays, 
      season, 
      depFormatted: dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      retFormatted: ret.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
    };
  } catch (e) {
    return { diffDays: 7, season: 'Summer', depFormatted: depDateStr, retFormatted: retDateStr };
  }
};

export const getWaypointDisplayDay = (waypoints: any[], index: number): number => {
  let day = 1;
  for (let i = 0; i < index; i++) {
    const stay = waypoints[i].stayNights !== undefined && !isNaN(Number(waypoints[i].stayNights))
      ? Number(waypoints[i].stayNights)
      : 1;
    day += (stay > 0 ? stay : 1);
  }
  return day;
};

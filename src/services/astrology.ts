import { DateTime } from "luxon";
import { 
  Ecliptic, 
  GeoVector, 
  Body, 
  MakeTime
} from "astronomy-engine";

const DASHA_ORDER = [
  { planet: "Ketu", years: 7 },
  { planet: "Venus", years: 20 },
  { planet: "Sun", years: 6 },
  { planet: "Moon", years: 10 },
  { planet: "Mars", years: 7 },
  { planet: "Rahu", years: 18 },
  { planet: "Jupiter", years: 16 },
  { planet: "Saturn", years: 19 },
  { planet: "Mercury", years: 17 },
];

const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", 
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", 
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", 
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", 
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

// Standard Lahiri Ayanamsa at J2000.0 (January 1, 2000, 12:00 TT)
// Value: 23° 51' 25.532" = 23.857092222 degrees
const LAHIRI_AYANAMSA_J2000 = 23.857092222;

export function calculateDasha(dateStr: string, timeStr: string, timezone: string) {
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid date or time: ${dt.invalidReason}`);
  
  const utc = dt.toUTC();
  const time = MakeTime(utc.toJSDate());
  
  // astronomy-engine GeoVector returns J2000.0 mean equator/equinox coordinates.
  const moonVector = GeoVector(Body.Moon, time, true);
  const moonEcliptic = Ecliptic(moonVector);
  const tropicalLongJ2000 = moonEcliptic.elon;
  
  // Sidereal Longitude = Tropical Longitude (J2000) - Ayanamsa (J2000)
  let siderealLong = tropicalLongJ2000 - LAHIRI_AYANAMSA_J2000;
  
  while (siderealLong < 0) siderealLong += 360;
  while (siderealLong >= 360) siderealLong -= 360;
  
  // For UI display: Calculate Ayanamsa of Date
  const T = (time.tt - 2451545.0) / 36525.0;
  const precession = (5028.796 * T + 1.105 * T * T) / 3600.0;
  const ayanamsaOfDate = LAHIRI_AYANAMSA_J2000 + precession;
  
  const nakshatraSpan = 360 / 27;
  const totalNakshatras = siderealLong / nakshatraSpan;
  const nakshatraIndex = Math.floor(totalNakshatras);
  const fraction = totalNakshatras - nakshatraIndex;
  
  const dashaIndex = nakshatraIndex % 9;
  const currentDasha = DASHA_ORDER[dashaIndex];
  const remainingYears = (1 - fraction) * currentDasha.years;
  
  return {
    moonLong: siderealLong,
    tropicalLong: tropicalLongJ2000,
    ayanamsa: ayanamsaOfDate, // Show the date-specific value in UI
    nakshatra: NAKSHATRA_NAMES[nakshatraIndex],
    nakshatraIndex,
    dashaIndex,
    fraction,
    remainingYears,
    birthJD: time.tt
  };
}

// Standard year length for Dasha calculations in most modern Vedic software
const SOLAR_YEAR_DAYS = 365.2425;

function generateSubDashas(startJD: number, totalDurationYears: number, orderStartIndex: number, depth: number): any[] {
  if (depth === 0) return [];
  
  let currentJD = startJD;
  const subDashas = [];
  
  for (let i = 0; i < 9; i++) {
    const planet = DASHA_ORDER[(orderStartIndex + i) % 9];
    // Sub-dasha duration is proportional to the planet's years in the 120-year cycle.
    // Duration = (Mahadasha Years * Sub-planet Years) / 120
    const durationYears = (totalDurationYears * planet.years) / 120;
    const endJD = currentJD + (durationYears * SOLAR_YEAR_DAYS);
    
    const period = {
      planet: planet.planet,
      start: DateTime.fromJSDate(MakeTime(currentJD).date).toFormat('yyyy-MM-dd HH:mm:ss'),
      end: DateTime.fromJSDate(MakeTime(endJD).date).toFormat('yyyy-MM-dd HH:mm:ss'),
      startJD: currentJD,
      endJD: endJD,
      subDashas: depth > 1 ? generateSubDashas(currentJD, durationYears, (orderStartIndex + i) % 9, depth - 1) : []
    };
    
    subDashas.push(period);
    currentJD = endJD;
  }
  
  return subDashas;
}

export function generateDashaHierarchy(birthJD: number, dashaInfo: any) {
  const { dashaIndex, remainingYears } = dashaInfo;
  let currentJD = birthJD;
  const mahadashas = [];
  
  for (let i = 0; i < 9; i++) {
    const dashaIdx = (dashaIndex + i) % 9;
    const dasha = DASHA_ORDER[dashaIdx];
    const duration = i === 0 ? remainingYears : dasha.years;
    const endJD = currentJD + (duration * SOLAR_YEAR_DAYS);
    
    const mahadasha = {
      planet: dasha.planet,
      start: DateTime.fromJSDate(MakeTime(currentJD).date).toFormat('yyyy-MM-dd HH:mm:ss'),
      end: DateTime.fromJSDate(MakeTime(endJD).date).toFormat('yyyy-MM-dd HH:mm:ss'),
      startJD: currentJD,
      endJD: endJD,
      subDashas: generateSubDashas(currentJD, duration, dashaIdx, 4)
    };
    
    mahadashas.push(mahadasha);
    currentJD = endJD;
  }
  return mahadashas;
}

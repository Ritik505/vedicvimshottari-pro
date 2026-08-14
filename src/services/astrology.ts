import { DateTime } from "luxon";
import {
  SwissEphemeris,
  Planet,
  LunarPoint,
  SiderealMode,
  CalculationFlag,
} from "@swisseph/browser";

// ============================================================
// VIMSHOTTARI DASHA
// ============================================================

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
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

// ============================================================
// DASHA YEAR
// ============================================================

const SOLAR_YEAR_DAYS = 365.2425;

// ============================================================
// RASHI
// ============================================================

const RASHI_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const RASHI_SHORT_NAMES = [
  "Ar",
  "Ta",
  "Ge",
  "Ca",
  "Le",
  "Vi",
  "Li",
  "Sc",
  "Sg",
  "Cp",
  "Aq",
  "Pi",
];

// ============================================================
// CHARA KARAKA
// ============================================================

const CHARA_KARAKA_NAMES = [
  "Atmakaraka",
  "Amatyakaraka",
  "Bhratrikaraka",
  "Matrikaraka",
  "Putrakaraka",
  "Gnatikaraka",
  "Darakaraka",
];

// ============================================================
// TYPES
// ============================================================

export interface PlanetaryPosition {
  planet: string;

  // Tropical geocentric longitude.
  tropicalLongitude: number;

  // Lahiri sidereal geocentric longitude.
  siderealLongitude: number;

  // Rashi.
  sign: string;
  signShort: string;
  signIndex: number;

  // Degree inside the Rashi.
  degreeInSign: number;

  // DMS.
  degrees: number;
  minutes: number;
  seconds: number;

  formattedDegree: string;
}

export interface CharaKaraka {
  planet: string;
  karaka: string;
  degreeInSign: number;
  formattedDegree: string;
  sign: string;
}

// ============================================================
// SWISS EPHEMERIS SINGLETON
// ============================================================
//
// The browser implementation is WASM-based and must be initialized
// asynchronously.
//
// We initialize it once and reuse the same instance for every
// calculation.
//
// ============================================================

const swe = new SwissEphemeris();

let initializationPromise: Promise<void> | null = null;

async function getSwissEphemeris(): Promise<SwissEphemeris> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await swe.init();

      /*
       * Load the standard Swiss Ephemeris files.
       *
       * This gives us the Swiss Ephemeris calculation path rather
       * than only the built-in Moshier fallback.
       */
      await swe.loadStandardEphemeris();

      /*
       * Lahiri / Chitrapaksha.
       */
      swe.setSiderealMode(
        SiderealMode.Lahiri
      );
    })();
  }

  await initializationPromise;

  return swe;
}

// ============================================================
// NORMALIZE DEGREE
// ============================================================

function normalizeDegrees(
  value: number
): number {
  let result =
    value % 360;

  if (result < 0) {
    result += 360;
  }

  return result;
}

// ============================================================
// FORMAT DEGREE
// ============================================================

function formatDegree(
  degreeInSign: number
): {
  degrees: number;
  minutes: number;
  seconds: number;
  formattedDegree: string;
} {
  let value =
    Math.max(
      0,
      Math.min(
        29.999999999,
        degreeInSign
      )
    );

  let degrees =
    Math.floor(value);

  const minuteFloat =
    (value - degrees) * 60;

  let minutes =
    Math.floor(minuteFloat);

  let seconds =
    Math.round(
      (minuteFloat - minutes) * 60
    );

  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }

  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  if (degrees >= 30) {
    degrees = 29;
    minutes = 59;
    seconds = 59;
  }

  return {
    degrees,
    minutes,
    seconds,

    formattedDegree:
      `${String(degrees).padStart(2, "0")}° ` +
      `${String(minutes).padStart(2, "0")}' ` +
      `${String(seconds).padStart(2, "0")}"`,
  };
}

// ============================================================
// SIDEREAL LONGITUDE -> RASHI
// ============================================================

function getRashiFromLongitude(
  siderealLongitude: number
) {
  const normalized =
    normalizeDegrees(
      siderealLongitude
    );

  const signIndex =
    Math.floor(
      normalized / 30
    );

  const degreeInSign =
    normalized -
    signIndex * 30;

  const formatted =
    formatDegree(
      degreeInSign
    );

  return {
    sign:
      RASHI_NAMES[signIndex],

    signShort:
      RASHI_SHORT_NAMES[signIndex],

    signIndex,

    degreeInSign,

    degrees:
      formatted.degrees,

    minutes:
      formatted.minutes,

    seconds:
      formatted.seconds,

    formattedDegree:
      formatted.formattedDegree,
  };
}

// ============================================================
// TIME -> JULIAN DAY
// ============================================================
//
// User enters local date/time + timezone.
// We convert to UTC first.
//
// ============================================================

function getJulianDay(
  dateStr: string,
  timeStr: string,
  timezone: string
): {
  dt: DateTime;
  utc: DateTime;
  jd: number;
} {
  const dt =
    DateTime.fromISO(
      `${dateStr}T${timeStr}`,
      {
        zone: timezone,
      }
    );

  if (!dt.isValid) {
    throw new Error(
      `Invalid date or time: ${dt.invalidReason}`
    );
  }

  const utc =
    dt.toUTC();

  const sweDate =
    utc.toJSDate();

  /*
   * Julian day from the exact UTC instant.
   */
  const tempSwe =
    swe;

  const jd =
    tempSwe.dateToJulianDay(
      sweDate
    );

  return {
    dt,
    utc,
    jd,
  };
}

// ============================================================
// BUILD PLANET POSITION
// ============================================================

function buildPlanetPosition(
  planet: string,
  siderealLongitude: number,
  ayanamsa: number
): PlanetaryPosition {
  const sidereal =
    normalizeDegrees(
      siderealLongitude
    );

  /*
   * Because sidereal longitude was produced directly by
   * Swiss Ephemeris, add the same ayanamsa back to derive
   * the corresponding tropical longitude.
   */
  const tropical =
    normalizeDegrees(
      sidereal + ayanamsa
    );

  const rashi =
    getRashiFromLongitude(
      sidereal
    );

  return {
    planet,

    tropicalLongitude:
      tropical,

    siderealLongitude:
      sidereal,

    sign:
      rashi.sign,

    signShort:
      rashi.signShort,

    signIndex:
      rashi.signIndex,

    degreeInSign:
      rashi.degreeInSign,

    degrees:
      rashi.degrees,

    minutes:
      rashi.minutes,

    seconds:
      rashi.seconds,

    formattedDegree:
      rashi.formattedDegree,
  };
}

// ============================================================
// PLANET MAP
// ============================================================

const PLANETS: {
  name: string;
  body: Planet;
}[] = [
  {
    name: "Sun",
    body: Planet.Sun,
  },
  {
    name: "Moon",
    body: Planet.Moon,
  },
  {
    name: "Mars",
    body: Planet.Mars,
  },
  {
    name: "Mercury",
    body: Planet.Mercury,
  },
  {
    name: "Jupiter",
    body: Planet.Jupiter,
  },
  {
    name: "Venus",
    body: Planet.Venus,
  },
  {
    name: "Saturn",
    body: Planet.Saturn,
  },
];

// ============================================================
// SIDEREAL CALCULATION FLAGS
// ============================================================

const SIDEREAL_FLAGS =
  CalculationFlag.SwissEphemeris |
  CalculationFlag.Sidereal |
  CalculationFlag.Speed;

// ============================================================
// PLANETARY POSITIONS
// ============================================================
//
// ONE astronomical engine:
//
// Swiss Ephemeris
//   ↓
// geocentric calculation
//   ↓
// Lahiri sidereal mode
//   ↓
// sidereal longitude
//
// This same function is used by:
//
// - Planetary Degrees
// - Chara Karaka
//
// Moon used here is the SAME Swiss Ephemeris Moon used by Dasha.
//
// ============================================================

export async function calculatePlanetaryPositions(
  dateStr: string,
  timeStr: string,
  timezone: string
): Promise<PlanetaryPosition[]> {
  const engine =
    await getSwissEphemeris();

  const {
    jd,
  } =
    getJulianDay(
      dateStr,
      timeStr,
      timezone
    );

  /*
   * Make absolutely sure the sidereal mode is Lahiri.
   */
  engine.setSiderealMode(
    SiderealMode.Lahiri
  );

  /*
   * Swiss Ephemeris calculates the actual Lahiri ayanamsa
   * for this Julian day.
   */
  const ayanamsa =
    engine.getAyanamsa(
      jd
    );

  const positions:
    PlanetaryPosition[] = [];

  // ==========================================================
  // SUN ... SATURN
  // ==========================================================

  for (
    const {
      name,
      body,
    } of PLANETS
  ) {
    const position =
      engine.calculatePosition(
        jd,
        body,
        SIDEREAL_FLAGS
      );

    positions.push(
      buildPlanetPosition(
        name,
        position.longitude,
        ayanamsa
      )
    );
  }

  // ==========================================================
  // RAHU - MEAN NODE
  // ==========================================================

  /*
   * Mean Node is the traditional default used here.
   *
   * We deliberately do NOT calculate Rahu using a homemade
   * polynomial. Swiss Ephemeris calculates the node.
   */
  const rahuPosition =
    engine.calculatePosition(
      jd,
      LunarPoint.MeanNode,
      SIDEREAL_FLAGS
    );

  positions.push(
    buildPlanetPosition(
      "Rahu",
      rahuPosition.longitude,
      ayanamsa
    )
  );

  // ==========================================================
  // KETU
  // ==========================================================

  /*
   * Ketu is exactly opposite Rahu in this implementation.
   */
  const ketuLongitude =
    normalizeDegrees(
      rahuPosition.longitude +
        180
    );

  positions.push(
    buildPlanetPosition(
      "Ketu",
      ketuLongitude,
      ayanamsa
    )
  );

  return positions;
}

// ============================================================
// CHARA KARAKA
// ============================================================
//
// 7-Karaka scheme:
//
// Highest degree within sign -> Atmakaraka
// 2nd highest                -> Amatyakaraka
// 3rd                       -> Bhratrikaraka
// 4th                       -> Matrikaraka
// 5th                       -> Putrakaraka
// 6th                       -> Gnatikaraka
// Lowest                    -> Darakaraka
//
// Rahu/Ketu are displayed but excluded from the 7-karaka
// ranking.
//
// ============================================================

export function calculateCharaKarakas(
  positions: PlanetaryPosition[]
): CharaKaraka[] {
  const sevenPlanets =
    positions.filter(
      (
        position
      ) =>
        [
          "Sun",
          "Moon",
          "Mars",
          "Mercury",
          "Jupiter",
          "Venus",
          "Saturn",
        ].includes(
          position.planet
        )
    );

  const sorted =
    [...sevenPlanets].sort(
      (a, b) =>
        b.degreeInSign -
        a.degreeInSign
    );

  return sorted.map(
    (
      position,
      index
    ) => ({
      planet:
        position.planet,

      karaka:
        CHARA_KARAKA_NAMES[
          index
        ],

      degreeInSign:
        position.degreeInSign,

      formattedDegree:
        position.formattedDegree,

      sign:
        position.sign,
    })
  );
}

// ============================================================
// VIMSHOTTARI DASHA
// ============================================================
//
// Uses the SAME Swiss Ephemeris sidereal Moon longitude
// used by calculatePlanetaryPositions().
//
// Therefore there are no separate Moon calculations.
//
// ============================================================

export async function calculateDasha(
  dateStr: string,
  timeStr: string,
  timezone: string
) {
  const engine =
    await getSwissEphemeris();

  const {
    jd,
  } =
    getJulianDay(
      dateStr,
      timeStr,
      timezone
    );

  engine.setSiderealMode(
    SiderealMode.Lahiri
  );

  /*
   * Actual Lahiri ayanamsa from Swiss Ephemeris.
   */
  const ayanamsa =
    engine.getAyanamsa(
      jd
    );

  /*
   * SAME Moon calculation used everywhere:
   *
   * geocentric + sidereal + Lahiri
   */
  const moonPosition =
    engine.calculatePosition(
      jd,
      Planet.Moon,
      SIDEREAL_FLAGS
    );

  const siderealMoon =
    normalizeDegrees(
      moonPosition.longitude
    );

  // ==========================================================
  // NAKSHATRA
  // ==========================================================

  const nakshatraSpan =
    360 / 27;

  const totalNakshatras =
    siderealMoon /
    nakshatraSpan;

  const nakshatraIndex =
    Math.floor(
      totalNakshatras
    );

  /*
   * Fraction travelled through the current Nakshatra.
   */
  const fraction =
    totalNakshatras -
    nakshatraIndex;

  // ==========================================================
  // STARTING DASHA
  // ==========================================================

  const dashaIndex =
    nakshatraIndex % 9;

  const currentDasha =
    DASHA_ORDER[
      dashaIndex
    ];

  /*
   * Remaining part of the birth Nakshatra's lord.
   */
  const remainingYears =
    (1 - fraction) *
    currentDasha.years;

  /*
   * Tropical longitude reconstructed from the same
   * sidereal longitude + same Lahiri ayanamsa.
   */
  const tropicalMoon =
    normalizeDegrees(
      siderealMoon +
        ayanamsa
    );

  return {
    moonLong:
      siderealMoon,

    tropicalLong:
      tropicalMoon,

    ayanamsa,

    nakshatra:
      NAKSHATRA_NAMES[
        nakshatraIndex
      ],

    nakshatraIndex,

    dashaIndex,

    fraction,

    remainingYears,

    /*
     * Julian Day in UT.
     */
    birthJD:
      jd,
  };
}

// ============================================================
// JD -> UTC DATE STRING
// ============================================================

function formatJD(
  jd: number
): string {
  /*
   * Unix epoch:
   *
   * JD 2440587.5 = 1970-01-01 00:00:00 UTC
   */
  const millis =
    (
      jd -
      2440587.5
    ) *
    86400000;

  return DateTime
    .fromMillis(
      millis,
      {
        zone: "utc",
      }
    )
    .toFormat(
      "yyyy-MM-dd HH:mm:ss"
    );
}

// ============================================================
// SUB DASHA
// ============================================================

function generateSubDashas(
  startJD: number,
  totalDurationYears: number,
  orderStartIndex: number,
  depth: number
): any[] {
  if (depth === 0) {
    return [];
  }

  let currentJD =
    startJD;

  const subDashas:
    any[] = [];

  for (
    let i = 0;
    i < 9;
    i++
  ) {
    const planet =
      DASHA_ORDER[
        (
          orderStartIndex +
          i
        ) % 9
      ];

    /*
     * Standard Vimshottari proportional subdivision:
     *
     * Mahadasha duration × planet years / 120
     */
    const durationYears =
      (
        totalDurationYears *
        planet.years
      ) / 120;

    const endJD =
      currentJD +
      durationYears *
        SOLAR_YEAR_DAYS;

    const period = {
      planet:
        planet.planet,

      start:
        formatJD(
          currentJD
        ),

      end:
        formatJD(
          endJD
        ),

      startJD:
        currentJD,

      endJD,

      subDashas:
        depth > 1
          ? generateSubDashas(
              currentJD,
              durationYears,
              (
                orderStartIndex +
                i
              ) % 9,
              depth - 1
            )
          : [],
    };

    subDashas.push(
      period
    );

    currentJD =
      endJD;
  }

  return subDashas;
}

// ============================================================
// DASHA HIERARCHY
// ============================================================

export function generateDashaHierarchy(
  birthJD: number,
  dashaInfo: {
    dashaIndex: number;
    remainingYears: number;
  }
) {
  const {
    dashaIndex,
    remainingYears,
  } = dashaInfo;

  let currentJD =
    birthJD;

  const mahadashas:
    any[] = [];

  for (
    let i = 0;
    i < 9;
    i++
  ) {
    const dashaIdx =
      (
        dashaIndex +
        i
      ) % 9;

    const dasha =
      DASHA_ORDER[
        dashaIdx
      ];

    const duration =
      i === 0
        ? remainingYears
        : dasha.years;

    const endJD =
      currentJD +
      duration *
        SOLAR_YEAR_DAYS;

    const mahadasha = {
      planet:
        dasha.planet,

      start:
        formatJD(
          currentJD
        ),

      end:
        formatJD(
          endJD
        ),

      startJD:
        currentJD,

      endJD,

      subDashas:
        generateSubDashas(
          currentJD,
          duration,
          dashaIdx,
          4
        ),
    };

    mahadashas.push(
      mahadasha
    );

    currentJD =
      endJD;
  }

  return mahadashas;
}

// ============================================================
// OPTIONAL CLEANUP
// ============================================================

export function closeAstrologyEngine(): void {
  try {
    swe.close();
  } catch {
    // Ignore cleanup errors.
  }
}
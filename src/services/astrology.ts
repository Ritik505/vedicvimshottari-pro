import { DateTime } from "luxon";
import {
  SwissEphemeris,
  Planet,
  LunarPoint,
  SiderealMode,
  CalculationFlag,
  HouseSystem,
} from "@swisseph/browser";

export type LunarNodeType = "mean" | "true";

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

// ============================================================
// NAKSHATRAS
// ============================================================

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

const CHARA_KARAKA_NAMES_8 = [
  "Atmakaraka",
  "Amatyakaraka",
  "Bhratrikaraka",
  "Matrikaraka",
  "Pitrikaraka",
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

  // Planetary motion.
  longitudeSpeed: number;
  retrograde: boolean;

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
  effectiveDegree: number;
  formattedDegree: string;
  formattedEffectiveDegree: string;
  sign: string;
}

export interface KundliPlanet {
  planet: string;
  house: number;
  sign: string;
  signShort: string;
  signIndex: number;
  degreeInSign: number;
  formattedDegree: string;

  // Planetary motion.
  longitudeSpeed: number;
  retrograde: boolean;
}

export interface KundliHouse {
  house: number;
  sign: string;
  signShort: string;
  signIndex: number;
  planets: string[];
}

export interface KundliData {
  ascendantLongitude: number;
  ascendantSignIndex: number;
  ascendantSign: string;
  ascendantSignShort: string;
  ascendantDegree: number;
  ascendantFormattedDegree: string;
  houses: KundliHouse[];
  planets: KundliPlanet[];

  // Identifies the divisional chart.
  // D1 = Rashi, D9 = Navamsa.
  chartCode?: "D1" | "D9";
  chartName?: string;
}

// ============================================================
// SWISS EPHEMERIS SINGLETON
// ============================================================

const swe = new SwissEphemeris();

let initializationPromise: Promise<void> | null = null;

async function getSwissEphemeris(): Promise<SwissEphemeris> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await swe.init();

      /*
       * Load the standard Swiss Ephemeris files.
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
  ayanamsa: number,
  longitudeSpeed: number
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

    longitudeSpeed,

    retrograde:
      longitudeSpeed < 0,

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

export async function calculatePlanetaryPositions(
  dateStr: string,
  timeStr: string,
  timezone: string,
  nodeType: LunarNodeType = "true"
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
        ayanamsa,
        position.longitudeSpeed
      )
    );
  }

  // ==========================================================
  // RAHU
  // ==========================================================

  const rahuPoint =
    nodeType === "true"
      ? LunarPoint.TrueNode
      : LunarPoint.MeanNode;

  const rahuPosition =
    engine.calculatePosition(
      jd,
      rahuPoint,
      SIDEREAL_FLAGS
    );

  positions.push({
    ...buildPlanetPosition(
      "Rahu",
      rahuPosition.longitude,
      ayanamsa,
      rahuPosition.longitudeSpeed
    ),

    /*
     * Rahu is conventionally shown as retrograde in this app,
     * regardless of the instantaneous node speed returned.
     */
    retrograde: true,
  });

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

  positions.push({
    ...buildPlanetPosition(
      "Ketu",
      ketuLongitude,
      ayanamsa,
      rahuPosition.longitudeSpeed
    ),

    retrograde: true,
  });

  return positions;
}

// ============================================================
// LAGNA KUNDLI / D1 RASHI CHART
// ============================================================
//
// Uses the same Swiss Ephemeris instance and Lahiri sidereal
// calculations as the rest of the application.
//
// House model:
// - Whole Sign houses
// - House 1 = Ascendant sign
// - Each following house advances one Rashi
//
// ============================================================

export async function calculateKundli(
  dateStr: string,
  timeStr: string,
  timezone: string,
  latitude: number,
  longitude: number,
  nodeType: LunarNodeType = "true"
): Promise<KundliData> {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      "Invalid latitude. Latitude must be between -90 and 90."
    );
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Invalid longitude. Longitude must be between -180 and 180."
    );
  }

  const engine =
    await getSwissEphemeris();

  const { jd } =
    getJulianDay(
      dateStr,
      timeStr,
      timezone
    );

  engine.setSiderealMode(
    SiderealMode.Lahiri
  );

  const ayanamsa =
    engine.getAyanamsa(
      jd
    );

  /*
   * calculateHouses() returns the geometric/tropical Ascendant.
   */
  const houses =
    engine.calculateHouses(
      jd,
      latitude,
      longitude,
      HouseSystem.WholeSign
    );

  const ascendantSidereal =
    normalizeDegrees(
      houses.ascendant -
        ayanamsa
    );

  const ascendant =
    getRashiFromLongitude(
      ascendantSidereal
    );

  /*
   * Reuse the same geocentric sidereal planetary calculation
   * already used by Planetary Degrees and Chara Karakas.
   */
  const planetaryPositions =
    await calculatePlanetaryPositions(
      dateStr,
      timeStr,
      timezone,
      nodeType
    );

  const kundliPlanets:
    KundliPlanet[] =
    planetaryPositions.map(
      (position) => {
        /*
         * Whole-sign house:
         * Ascendant sign = House 1.
         */
        const house =
          (
            position.signIndex -
              ascendant.signIndex +
            12
          ) %
            12 +
          1;

        return {
          planet:
            position.planet,

          house,

          sign:
            position.sign,

          signShort:
            position.signShort,

          signIndex:
            position.signIndex,

          degreeInSign:
            position.degreeInSign,

          formattedDegree:
            position.formattedDegree,

          longitudeSpeed:
            position.longitudeSpeed,

          retrograde:
            position.retrograde,
        };
      }
    );

  const kundliHouses:
    KundliHouse[] =
    Array.from(
      { length: 12 },
      (_, index) => {

        const houseNumber =
          index + 1;

        const signIndex =
          (
            ascendant.signIndex +
            index
          ) % 12;

        return {
          house:
            houseNumber,

          sign:
            RASHI_NAMES[
              signIndex
            ],

          signShort:
            RASHI_SHORT_NAMES[
              signIndex
            ],

          signIndex,

          planets:
            kundliPlanets
              .filter(
                (planet) =>
                  planet.house ===
                  houseNumber
              )
              .map(
                (planet) =>
                  planet.planet
              ),
        };
      }
    );

  return {
    chartCode: "D1",
    chartName: "Rashi",

    ascendantLongitude:
      ascendantSidereal,

    ascendantSignIndex:
      ascendant.signIndex,

    ascendantSign:
      ascendant.sign,

    ascendantSignShort:
      ascendant.signShort,

    ascendantDegree:
      ascendant.degreeInSign,

    ascendantFormattedDegree:
      ascendant.formattedDegree,

    houses:
      kundliHouses,

    planets:
      kundliPlanets,
  };
}

// ============================================================
// NAVAMSA / D9 HELPERS
// ============================================================
//
// Standard Navamsa sign progression:
//
// Movable signs:
// Aries, Cancer, Libra, Capricorn
// → start from the same sign.
//
// Fixed signs:
// Taurus, Leo, Scorpio, Aquarius
// → start from the 9th sign from the sign.
//
// Dual signs:
// Gemini, Virgo, Sagittarius, Pisces
// → start from the 5th sign from the sign.
//
// Every Rashi has 9 Navamsas.
// Each Navamsa = 3°20' = 3 + 1/3 degrees.
//
// ============================================================

const NAVAMSA_SIZE =
  30 / 9;

function getNavamsaStartSignIndex(
  rashiIndex: number
): number {
  /*
   * Movable: Aries, Cancer, Libra, Capricorn
   */
  const movableSigns = [
    0, // Aries
    3, // Cancer
    6, // Libra
    9, // Capricorn
  ];

  /*
   * Fixed: Taurus, Leo, Scorpio, Aquarius
   */
  const fixedSigns = [
    1, // Taurus
    4, // Leo
    7, // Scorpio
    10, // Aquarius
  ];

  /*
   * Dual: Gemini, Virgo, Sagittarius, Pisces
   */
  const dualSigns = [
    2, // Gemini
    5, // Virgo
    8, // Sagittarius
    11, // Pisces
  ];

  if (
    movableSigns.includes(
      rashiIndex
    )
  ) {
    return rashiIndex;
  }

  if (
    fixedSigns.includes(
      rashiIndex
    )
  ) {
    return (
      rashiIndex + 8
    ) % 12;
  }

  if (
    dualSigns.includes(
      rashiIndex
    )
  ) {
    return (
      rashiIndex + 4
    ) % 12;
  }

  return rashiIndex;
}

function getNavamsaFromLongitude(
  siderealLongitude: number
) {
  const normalized =
    normalizeDegrees(
      siderealLongitude
    );

  const rashiIndex =
    Math.floor(
      normalized / 30
    );

  const degreeInRashi =
    normalized -
    rashiIndex * 30;

  /*
   * Which of the 9 Navamsas inside the Rashi?
   *
   * 0 through 8.
   */
  let navamsaIndexInRashi =
    Math.floor(
      degreeInRashi /
        NAVAMSA_SIZE
    );

  /*
   * Protect against floating point edge cases.
   */
  navamsaIndexInRashi =
    Math.max(
      0,
      Math.min(
        8,
        navamsaIndexInRashi
      )
    );

  const startingSign =
    getNavamsaStartSignIndex(
      rashiIndex
    );

  const navamsaSignIndex =
    (
      startingSign +
      navamsaIndexInRashi
    ) % 12;

  /*
   * Degree inside the particular Navamsa.
   *
   * Example:
   * 0°00'–3°20' of the Rashi
   * corresponds to 0°00'–30°00' of its D9 sign.
   */
  const degreeInsideNavamsa =
    degreeInRashi -
    navamsaIndexInRashi *
      NAVAMSA_SIZE;

  const navamsaDegreeInSign =
    degreeInsideNavamsa *
    9;

  const formatted =
    formatDegree(
      navamsaDegreeInSign
    );

  return {
    rashiIndex,

    degreeInRashi,

    navamsaIndexInRashi,

    navamsaSignIndex,

    sign:
      RASHI_NAMES[
        navamsaSignIndex
      ],

    signShort:
      RASHI_SHORT_NAMES[
        navamsaSignIndex
      ],

    degreeInNavamsaSign:
      navamsaDegreeInSign,

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
// BUILD WHOLE-SIGN DIVISIONAL CHART
// ============================================================
//
// This generic builder is used for D9 today and can later be
// reused for D2, D3, D10, D12, D16, D20, D24, D27, D30, D40,
// D45, D60, etc.
//
// ============================================================

function buildDivisionalChart(
  chartCode: "D9",
  chartName: string,
  ascendantSiderealLongitude: number,
  planetaryPositions: PlanetaryPosition[]
): KundliData {
  const ascendant =
    getNavamsaFromLongitude(
      ascendantSiderealLongitude
    );

  const divisionalPlanets:
    KundliPlanet[] =
    planetaryPositions.map(
      (position) => {

        const navamsa =
          getNavamsaFromLongitude(
            position.siderealLongitude
          );

        /*
         * Whole-sign house in the divisional chart:
         *
         * D9 Ascendant sign = House 1.
         */
        const house =
          (
            navamsa.navamsaSignIndex -
              ascendant.navamsaSignIndex +
            12
          ) %
            12 +
          1;

        return {
          planet:
            position.planet,

          house,

          sign:
            navamsa.sign,

          signShort:
            navamsa.signShort,

          signIndex:
            navamsa.navamsaSignIndex,

          degreeInSign:
            navamsa.degreeInNavamsaSign,

          formattedDegree:
            navamsa.formattedDegree,

          /*
           * Keep the source planet's movement.
           */
          longitudeSpeed:
            position.longitudeSpeed,

          retrograde:
            position.retrograde,
        };
      }
    );

  const divisionalHouses:
    KundliHouse[] =
    Array.from(
      { length: 12 },
      (_, index) => {

        const houseNumber =
          index + 1;

        const signIndex =
          (
            ascendant.navamsaSignIndex +
            index
          ) % 12;

        return {
          house:
            houseNumber,

          sign:
            RASHI_NAMES[
              signIndex
            ],

          signShort:
            RASHI_SHORT_NAMES[
              signIndex
            ],

          signIndex,

          planets:
            divisionalPlanets
              .filter(
                (planet) =>
                  planet.house ===
                  houseNumber
              )
              .map(
                (planet) =>
                  planet.planet
              ),
        };
      }
    );

  return {
    chartCode,

    chartName,

    ascendantLongitude:
      ascendantSiderealLongitude,

    ascendantSignIndex:
      ascendant.navamsaSignIndex,

    ascendantSign:
      ascendant.sign,

    ascendantSignShort:
      ascendant.signShort,

    ascendantDegree:
      ascendant.degreeInNavamsaSign,

    ascendantFormattedDegree:
      ascendant.formattedDegree,

    houses:
      divisionalHouses,

    planets:
      divisionalPlanets,
  };
}

// ============================================================
// NAVAMSA / D9 KUNDLI
// ============================================================
//
// Uses the exact same birth data and the same Swiss Ephemeris
// Lahiri sidereal positions as D1.
//
// D9 is NOT calculated from tropical positions.
//
// The following are calculated:
//
// 1. Sidereal Ascendant
// 2. Navamsa Ascendant
// 3. Navamsa sign for every planet
// 4. Whole-sign D9 houses
// 5. Planetary degrees inside D9 sign
// 6. Retrograde status
//
// ============================================================

export async function calculateNavamsa(
  dateStr: string,
  timeStr: string,
  timezone: string,
  latitude: number,
  longitude: number,
  nodeType: LunarNodeType = "true",
  existingPlanetaryPositions?: PlanetaryPosition[]
): Promise<KundliData> {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      "Invalid latitude. Latitude must be between -90 and 90."
    );
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Invalid longitude. Longitude must be between -180 and 180."
    );
  }

  const engine =
    await getSwissEphemeris();

  const { jd } =
    getJulianDay(
      dateStr,
      timeStr,
      timezone
    );

  engine.setSiderealMode(
    SiderealMode.Lahiri
  );

  const ayanamsa =
    engine.getAyanamsa(
      jd
    );

  // ==========================================================
  // D1 TROPICAL ASCENDANT
  // ==========================================================

  const houses =
    engine.calculateHouses(
      jd,
      latitude,
      longitude,
      HouseSystem.WholeSign
    );

  /*
   * Convert tropical Ascendant to Lahiri sidereal Ascendant.
   */
  const ascendantSidereal =
    normalizeDegrees(
      houses.ascendant -
        ayanamsa
    );

  // ==========================================================
  // PLANETS
  // ==========================================================

  /*
   * Reuse the already calculated positions when available.
   * This prevents a second Swiss Ephemeris planetary pass
   * during the normal workspace generation.
   */
  const planetaryPositions =
    existingPlanetaryPositions ??
    (await calculatePlanetaryPositions(
      dateStr,
      timeStr,
      timezone,
      nodeType
    ));

  // ==========================================================
  // BUILD D9
  // ==========================================================

  return buildDivisionalChart(
    "D9",
    "Navamsa",
    ascendantSidereal,
    planetaryPositions
  );
}

// ============================================================
// GENERIC NAVAMSA SIGN HELPER
// ============================================================
//
// Useful when a component needs only the D9 sign of a planet
// or longitude without building the entire D9 chart.
//
// ============================================================

export function getNavamsaPosition(
  siderealLongitude: number
) {
  const navamsa =
    getNavamsaFromLongitude(
      siderealLongitude
    );

  return {
    sign:
      navamsa.sign,

    signShort:
      navamsa.signShort,

    signIndex:
      navamsa.navamsaSignIndex,

    degreeInSign:
      navamsa.degreeInNavamsaSign,

    formattedDegree:
      navamsa.formattedDegree,

    navamsaNumber:
      navamsa.navamsaIndexInRashi + 1,
  };
}

// ============================================================
// CHARA KARAKA
// ============================================================
//
// 8-Karaka scheme:
// Highest degree within sign -> Atmakaraka
// 2nd highest                -> Amatyakaraka
// 3rd                        -> Bhratrikaraka
// 4th                        -> Matrikaraka
// 5th                        -> Pitrikaraka
// 6th                        -> Putrakaraka
// 7th                        -> Gnatikaraka
// Lowest                     -> Darakaraka
//
// Rahu uses reverse degree.
// Ketu is excluded.
//
// ============================================================

export function calculateCharaKarakas(
  positions: PlanetaryPosition[]
): CharaKaraka[] {

  const candidates =
    positions.filter(
      (position) =>
        [
          "Sun",
          "Moon",
          "Mars",
          "Mercury",
          "Jupiter",
          "Venus",
          "Saturn",
          "Rahu",
        ].includes(
          position.planet
        )
    );

  const ranked =
    candidates.map(
      (position) => {

        const effectiveDegree =
          position.planet ===
          "Rahu"
            ? 30 -
              position.degreeInSign
            : position.degreeInSign;

        return {
          position,
          effectiveDegree,
        };
      }
    );

  ranked.sort(
    (a, b) =>
      b.effectiveDegree -
      a.effectiveDegree
  );

  return ranked.map(
    (
      item,
      index
    ) => {

      const effectiveFormatted =
        formatDegree(
          item.effectiveDegree
        );

      return {
        planet:
          item.position
            .planet,

        karaka:
          CHARA_KARAKA_NAMES_8[
            index
          ],

        degreeInSign:
          item.position
            .degreeInSign,

        effectiveDegree:
          item.effectiveDegree,

        formattedDegree:
          item.position
            .formattedDegree,

        formattedEffectiveDegree:
          effectiveFormatted
            .formattedDegree,

        sign:
          item.position
            .sign,
      };
    }
  );
}

// ============================================================
// VIMSHOTTARI DASHA
// ============================================================
//
// Uses the SAME Swiss Ephemeris sidereal Moon longitude
// used by calculatePlanetaryPositions().
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
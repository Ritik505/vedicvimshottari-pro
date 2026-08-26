/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  MapPin,
  Calculator,
  Download,
  ChevronRight,
  ChevronDown,
  Moon,
  Sparkles,
  Info,
  AlertCircle,
  Loader2,
  Search,
  UserCheck,
  ShieldCheck,
  Columns2,
  RefreshCw,
} from "lucide-react";
import { DateTime } from "luxon";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  calculateDasha,
  generateDashaHierarchy,
  calculatePlanetaryPositions,
  calculateKundli,
  calculateCharaKarakas,
  type PlanetaryPosition,
  type CharaKaraka,
  type KundliData,
  type LunarNodeType,
} from "./services/astrology";

// ============================================================
// UTILITY
// ============================================================

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// TYPES
// ============================================================

interface DashaPeriod {
  planet: string;
  start: string;
  end: string;
  startJD: number;
  endJD: number;
  subDashas?: DashaPeriod[];
}

interface DashaLevelProps {
  period: DashaPeriod;
  level: number;
  isCurrent: (s: string, e: string) => boolean;
  onPathSelect?: (path: DashaPeriod[]) => void;
  ancestors?: DashaPeriod[];
}

interface AgeAntardashaMatch {
  mahadasha: string;
  antardasha: string;
  start: string;
  end: string;
}

type WorkspacePanel =
  | "details"
  | "kundli"
  | "dasha"
  | "planetary"
  | "drishti"
  | "dignity"
  | "age"
  | "degrees";

// ============================================================
// KUNDLI HELPERS
// ============================================================

const PLANET_ABBREVIATIONS: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

function getPlanetAbbreviation(planet: string): string {
  return PLANET_ABBREVIATIONS[planet] || planet.substring(0, 2);
}

function getPlanetRetrograde(
  planetaryPosition: any,
  planet: any
): boolean | null {
  if (typeof planetaryPosition?.retrograde === "boolean") {
    return planetaryPosition.retrograde;
  }

  if (typeof planetaryPosition?.isRetrograde === "boolean") {
    return planetaryPosition.isRetrograde;
  }

  if (typeof planet?.retrograde === "boolean") {
    return planet.retrograde;
  }

  if (typeof planet?.isRetrograde === "boolean") {
    return planet.isRetrograde;
  }

  return null;
}

// ============================================================
// RASHI NUMBER MAPPING
// ============================================================

const RASHI_NUMBERS: Record<string, number> = {
  Aries: 1,
  Taurus: 2,
  Gemini: 3,
  Cancer: 4,
  Leo: 5,
  Virgo: 6,
  Libra: 7,
  Scorpio: 8,
  Sagittarius: 9,
  Capricorn: 10,
  Aquarius: 11,
  Pisces: 12,
};

function getRashiNumber(sign: string): number | string {
  return RASHI_NUMBERS[sign] ?? sign;
}

// ============================================================
// PLANETARY PLACEMENT HELPERS
// ============================================================

const SIGN_LORDS: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

const NAKSHATRAS = [
  { name: "Ashwini", lord: "Ketu" },
  { name: "Bharani", lord: "Venus" },
  { name: "Krittika", lord: "Sun" },
  { name: "Rohini", lord: "Moon" },
  { name: "Mrigashira", lord: "Mars" },
  { name: "Ardra", lord: "Rahu" },
  { name: "Punarvasu", lord: "Jupiter" },
  { name: "Pushya", lord: "Saturn" },
  { name: "Ashlesha", lord: "Mercury" },
  { name: "Magha", lord: "Ketu" },
  { name: "Purva Phalguni", lord: "Venus" },
  { name: "Uttara Phalguni", lord: "Sun" },
  { name: "Hasta", lord: "Moon" },
  { name: "Chitra", lord: "Mars" },
  { name: "Swati", lord: "Rahu" },
  { name: "Vishakha", lord: "Jupiter" },
  { name: "Anuradha", lord: "Saturn" },
  { name: "Jyeshtha", lord: "Mercury" },
  { name: "Mula", lord: "Ketu" },
  { name: "Purva Ashadha", lord: "Venus" },
  { name: "Uttara Ashadha", lord: "Sun" },
  { name: "Shravana", lord: "Moon" },
  { name: "Dhanishtha", lord: "Mars" },
  { name: "Shatabhisha", lord: "Rahu" },
  { name: "Purva Bhadrapada", lord: "Jupiter" },
  { name: "Uttara Bhadrapada", lord: "Saturn" },
  { name: "Revati", lord: "Mercury" },
];

function getSignLord(sign: string): string {
  return SIGN_LORDS[sign] || "—";
}

function getNakshatraData(sign: string, degreeInSign: number) {
  const rashiNumber = RASHI_NUMBERS[sign];

  if (!rashiNumber || !Number.isFinite(degreeInSign)) {
    return {
      name: "—",
      lord: "—",
    };
  }

  const absoluteLongitude =
    (rashiNumber - 1) * 30 + degreeInSign;

  const normalized =
    ((absoluteLongitude % 360) + 360) % 360;

  const nakshatraSize = 360 / 27;

  const nakshatraIndex = Math.floor(
    normalized / nakshatraSize
  );

  return (
    NAKSHATRAS[
      Math.min(
        26,
        Math.max(0, nakshatraIndex)
      )
    ] || {
      name: "—",
      lord: "—",
    }
  );
}

// ============================================================
// BAALADI AVASTHA / STATE
// ============================================================

function getPlanetaryState(
  degreeInSign: number,
  sign: string
): string {
  const degree =
    ((degreeInSign % 30) + 30) % 30;

  const evenSign = [
    "Taurus",
    "Cancer",
    "Virgo",
    "Scorpio",
    "Capricorn",
    "Pisces",
  ].includes(sign);

  if (!evenSign) {
    if (degree < 6) return "Bala";
    if (degree < 12) return "Kumara";
    if (degree < 18) return "Yuva";
    if (degree < 24) return "Vriddha";
    return "Mrita";
  }

  if (degree < 6) return "Mrita";
  if (degree < 12) return "Vriddha";
  if (degree < 18) return "Yuva";
  if (degree < 24) return "Kumara";
  return "Bala";
}

// ============================================================
// PLANETARY STATUS / DIGNITY
// ============================================================

const PLANETARY_DIGNITY: Record<
  string,
  {
    own: string[];
    exalted: string[];
    debilitated: string;
  }
> = {
  Sun: {
    own: ["Leo"],
    exalted: ["Aries"],
    debilitated: "Libra",
  },
  Moon: {
    own: ["Cancer"],
    exalted: ["Taurus"],
    debilitated: "Scorpio",
  },
  Mars: {
    own: ["Aries", "Scorpio"],
    exalted: ["Capricorn"],
    debilitated: "Cancer",
  },
  Mercury: {
    own: ["Gemini", "Virgo"],
    exalted: ["Virgo"],
    debilitated: "Pisces",
  },
  Jupiter: {
    own: ["Sagittarius", "Pisces"],
    exalted: ["Cancer"],
    debilitated: "Capricorn",
  },
  Venus: {
    own: ["Taurus", "Libra"],
    exalted: ["Pisces"],
    debilitated: "Virgo",
  },
  Saturn: {
    own: ["Capricorn", "Aquarius"],
    exalted: ["Libra"],
    debilitated: "Aries",
  },
  Rahu: {
    own: ["Aquarius"],
    exalted: [],
    debilitated: "Scorpio",
  },
  Ketu: {
    own: ["Scorpio"],
    exalted: [],
    debilitated: "Taurus",
  },
};

const NATURAL_FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
  Rahu: ["Mercury", "Venus", "Saturn"],
  Ketu: ["Sun", "Mars", "Jupiter"],
};

const NATURAL_ENEMIES: Record<string, string[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
  Rahu: ["Sun", "Moon"],
  Ketu: ["Moon", "Venus"],
};

function getPlanetStatus(
  planet: string,
  sign: string
): string {
  const dignity = PLANETARY_DIGNITY[planet];

  if (!dignity) {
    return "—";
  }

  if (dignity.exalted.includes(sign)) {
    return "EXALTED";
  }

  if (dignity.debilitated === sign) {
    return "DEBILITATED";
  }

  if (dignity.own.includes(sign)) {
    if (
      planet === "Moon" &&
      sign === "Cancer"
    ) {
      return "MOOLTRIKONA";
    }

    return "OWNED";
  }

  const signLord = SIGN_LORDS[sign];

  if (
    signLord &&
    NATURAL_FRIENDS[planet]?.includes(signLord)
  ) {
    return "FRIENDLY";
  }

  if (
    signLord &&
    NATURAL_ENEMIES[planet]?.includes(signLord)
  ) {
    return "ENEMY";
  }

  return "—";
}

// ============================================================
// TRADITIONAL NORTH INDIAN KUNDLI GEOMETRY
// ============================================================

const NORTH_INDIAN_HOUSE_POLYGONS: Record<number, string> = {
  1: "50,0 75,25 50,50 25,25",
  2: "0,0 50,0 25,25",
  3: "0,0 0,50 25,25",
  4: "0,50 25,25 50,50 25,75",
  5: "0,50 0,100 25,75",
  6: "0,100 50,100 25,75",
  7: "50,100 75,75 50,50 25,75",
  8: "50,100 100,100 75,75",
  9: "100,50 100,100 75,75",
  10: "100,50 75,25 50,50 75,75",
  11: "100,0 100,50 75,25",
  12: "50,0 100,0 75,25",
};

// ============================================================
// TEXT POSITIONS
// ============================================================

const NORTH_INDIAN_TEXT_POSITIONS: Record<
  number,
  { x: number; y: number }
> = {
  1: { x: 50, y: 20 },
  2: { x: 32, y: 12 },
  3: { x: 13, y: 25 },
  4: { x: 18, y: 50 },
  5: { x: 13, y: 75 },
  6: { x: 32, y: 88 },
  7: { x: 50, y: 80 },
  8: { x: 68, y: 88 },
  9: { x: 87, y: 75 },
  10: { x: 82, y: 50 },
  11: { x: 87, y: 25 },
  12: { x: 68, y: 12 },
};

// ============================================================
// PLANET COLORS
// ============================================================

const PLANET_COLORS: Record<string, string> = {
  Sun: "#8B2F2F",
  Moon: "#2F5D8A",
  Mars: "#A9342C",
  Mercury: "#2E7758",
  Jupiter: "#9A6B21",
  Venus: "#9B4D73",
  Saturn: "#4D5666",
  Rahu: "#6C4B8B",
  Ketu: "#6A5A4A",
};

function getPlanetColor(planet: string): string {
  return PLANET_COLORS[planet] || "#624B38";
}

// ============================================================
// HOUSE MAPPING
// ============================================================

function getVisibleHouseNatalHouse(
  visibleHouse: number,
  startNatalHouse: number
): number {
  return (
    ((startNatalHouse - 1 + visibleHouse - 1) % 12) + 1
  );
}

// ============================================================
// DRISHTI / HOUSE LORDSHIP HELPERS
// ============================================================

const PLANET_DRISHTI_OFFSETS: Record<string, number[]> = {
  Sun: [7],
  Moon: [7],
  Mars: [4, 7, 8],
  Mercury: [7],
  Jupiter: [5, 7, 9],
  Venus: [7],
  Saturn: [3, 7, 10],
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mars: "♂",
  Mercury: "☿",
  Jupiter: "♃",
  Venus: "♀",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};

function getVisibleHouseFromNatalHouse(
  natalHouse: number,
  startNatalHouse: number
): number {
  return (
    ((natalHouse - startNatalHouse + 12) % 12) + 1
  );
}

function getAspectTargetHouse(
  occupiedNatalHouse: number,
  aspectFromPlanet: number,
  startNatalHouse: number
): number {
  const targetNatalHouse =
    ((occupiedNatalHouse - 1 + aspectFromPlanet - 1) %
      12) +
    1;

  return getVisibleHouseFromNatalHouse(
    targetNatalHouse,
    startNatalHouse
  );
}

function formatOrdinalHouseNumber(
  value: number
): string {
  const mod100 = value % 100;

  if (
    mod100 >= 11 &&
    mod100 <= 13
  ) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function getOwnedVisibleHouses(
  planet: string,
  kundli: KundliData,
  startNatalHouse: number
): number[] {
  if (
    planet === "Rahu" ||
    planet === "Ketu"
  ) {
    return [];
  }

  const ownedHouses: number[] = [];

  for (
    let visibleHouse = 1;
    visibleHouse <= 12;
    visibleHouse += 1
  ) {
    const natalHouse =
      getVisibleHouseNatalHouse(
        visibleHouse,
        startNatalHouse
      );

    const house =
      kundli.houses.find(
        (item: any) =>
          item.house === natalHouse
      );

    if (
      house &&
      getSignLord(house.sign) === planet
    ) {
      ownedHouses.push(visibleHouse);
    }
  }

  return ownedHouses;
}

// ============================================================
// NORTH INDIAN HOUSE LABEL
// ============================================================

function NorthIndianHouseLabel({
  houseNumber,
  natalHouseNumber,
  rashiNumber,
  planets,
  retrogradeByPlanet,
  selected,
  currentLagna,
}: {
  houseNumber: number;
  natalHouseNumber: number;
  rashiNumber: number | string;
  planets: string[];
  retrogradeByPlanet: Record<string, boolean>;
  selected: boolean;
  currentLagna: boolean;
}) {
  const position =
    NORTH_INDIAN_TEXT_POSITIONS[
      houseNumber
    ];

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: "24%",
      }}
    >
      <div className="text-[8px] sm:text-[9px] font-bold text-[#6B5A44]">
        H{houseNumber}
      </div>

      <div className="text-[10px] sm:text-xs font-extrabold text-[#1F647B] mt-0.5">
        {rashiNumber}
      </div>

      <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-1">
        {planets.length > 0 ? (
          planets.map((planet) => (
            <span
              key={planet}
              className="text-[11px] sm:text-sm font-extrabold leading-none"
              style={{
                color: getPlanetColor(planet),
              }}
            >
              {getPlanetAbbreviation(planet)}

              {retrogradeByPlanet[planet] && (
                <span
                  className="ml-0.5 text-[9px] sm:text-[11px] font-black"
                  aria-label="Retrograde"
                >
                  ℞
                </span>
              )}
            </span>
          ))
        ) : (
          <span className="text-[8px] sm:text-[9px] text-[#A39278]">
            —
          </span>
        )}
      </div>

      {currentLagna && (
        <div className="mt-1 inline-block rounded-full bg-[#8B2F2F]/10 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-[#8B2F2F]">
          Lagna
        </div>
      )}

      {natalHouseNumber !== houseNumber && (
        <div className="mt-0.5 text-[7px] sm:text-[8px] font-medium text-[#89765A]">
          Natal H{natalHouseNumber}
        </div>
      )}

      {selected && (
        <div className="mt-1 text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-[#8B2F2F]">
          Selected
        </div>
      )}
    </div>
  );
}

// ============================================================
// D1 KUNDLI CHART
// ============================================================

function D1KundliChart({
  kundli,
  onLagnaHouseChange,
}: {
  kundli: KundliData;
  onLagnaHouseChange?: (
    natalHouse: number
  ) => void;
}) {
  const [startNatalHouse, setStartNatalHouse] =
    useState(1);

  const [
    selectedVisibleHouse,
    setSelectedVisibleHouse,
  ] = useState<number | null>(null);

  const derivedView =
    startNatalHouse !== 1;

  const selectedNatalHouse =
    selectedVisibleHouse === null
      ? null
      : getVisibleHouseNatalHouse(
          selectedVisibleHouse,
          startNatalHouse
        );

  const selectedHouseData =
    selectedNatalHouse === null
      ? null
      : kundli.houses.find(
          (house) =>
            house.house === selectedNatalHouse
        );

  const currentLagnaHouse =
    kundli.houses.find(
      (house) =>
        house.house === startNatalHouse
    );

  const retrogradeByPlanet =
    Object.fromEntries(
      kundli.planets.map((planet) => [
        planet.planet,
        Boolean(planet.retrograde),
      ])
    ) as Record<string, boolean>;

  const applySelectedHouseAsLagna =
    () => {
      if (
        selectedVisibleHouse === null ||
        selectedNatalHouse === null
      ) {
        return;
      }

      setStartNatalHouse(
        selectedNatalHouse
      );

      onLagnaHouseChange?.(
        selectedNatalHouse
      );

      setSelectedVisibleHouse(null);
    };

  const restoreOriginalLagna = () => {
    setStartNatalHouse(1);
    onLagnaHouseChange?.(1);
    setSelectedVisibleHouse(null);
  };

  return (
    <div className="space-y-4">

      <div className="relative w-full max-w-[620px] mx-auto">

        <div className="relative aspect-square overflow-hidden rounded-sm border-[3px] border-[#765535] bg-[#F2E5CF] shadow-[0_12px_35px_rgba(78,51,26,0.18)]">

          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Traditional North Indian style D1 Rashi chart"
          >
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="#F2E5CF"
            />

            <rect
              x="1"
              y="1"
              width="98"
              height="98"
              fill="none"
              stroke="#765535"
              strokeWidth="0.85"
            />

            <polygon
              points="50,1 99,50 50,99 1,50"
              fill="#F5EAD7"
              stroke="#765535"
              strokeWidth="0.85"
            />

            <line
              x1="1"
              y1="1"
              x2="50"
              y2="50"
              stroke="#765535"
              strokeWidth="0.85"
            />

            <line
              x1="99"
              y1="1"
              x2="50"
              y2="50"
              stroke="#765535"
              strokeWidth="0.85"
            />

            <line
              x1="99"
              y1="99"
              x2="50"
              y2="50"
              stroke="#765535"
              strokeWidth="0.85"
            />

            <line
              x1="1"
              y1="99"
              x2="50"
              y2="50"
              stroke="#765535"
              strokeWidth="0.85"
            />

            {Array.from(
              { length: 12 },
              (_, index) => {
                const visibleHouse =
                  index + 1;

                const natalHouse =
                  getVisibleHouseNatalHouse(
                    visibleHouse,
                    startNatalHouse
                  );

                const isSelected =
                  selectedVisibleHouse ===
                  visibleHouse;

                return (
                  <polygon
                    key={visibleHouse}
                    points={
                      NORTH_INDIAN_HOUSE_POLYGONS[
                        visibleHouse
                      ]
                    }
                    fill={
                      isSelected
                        ? "#B8893F"
                        : "transparent"
                    }
                    fillOpacity={
                      isSelected ? 0.24 : 0
                    }
                    stroke={
                      isSelected
                        ? "#8B2F2F"
                        : "transparent"
                    }
                    strokeWidth={
                      isSelected ? 0.9 : 0
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedVisibleHouse(
                        visibleHouse
                      )
                    }
                    onMouseEnter={(event) => {
                      if (!isSelected) {
                        event.currentTarget.setAttribute(
                          "fill",
                          "#B8893F"
                        );

                        event.currentTarget.setAttribute(
                          "fill-opacity",
                          "0.09"
                        );
                      }
                    }}
                    onMouseLeave={(event) => {
                      if (!isSelected) {
                        event.currentTarget.setAttribute(
                          "fill",
                          "transparent"
                        );

                        event.currentTarget.setAttribute(
                          "fill-opacity",
                          "0"
                        );
                      }
                    }}
                    aria-label={`House ${visibleHouse}, natal house ${natalHouse}`}
                  />
                );
              }
            )}
          </svg>

          {Array.from(
            { length: 12 },
            (_, index) => {
              const visibleHouse =
                index + 1;

              const natalHouse =
                getVisibleHouseNatalHouse(
                  visibleHouse,
                  startNatalHouse
                );

              const house =
                kundli.houses.find(
                  (item) =>
                    item.house === natalHouse
                );

              if (!house) {
                return null;
              }

              return (
                <NorthIndianHouseLabel
                  key={visibleHouse}
                  houseNumber={visibleHouse}
                  natalHouseNumber={natalHouse}
                  rashiNumber={getRashiNumber(
                    house.sign
                  )}
                  planets={house.planets}
                  retrogradeByPlanet={
                    retrogradeByPlanet
                  }
                  selected={
                    selectedVisibleHouse ===
                    visibleHouse
                  }
                  currentLagna={
                    visibleHouse === 1
                  }
                />
              );
            }
          )}

          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">

            <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.18em] font-bold text-[#765535]">
              {derivedView
                ? "Derived Lagna"
                : "Lagna"}
            </div>

            <div className="text-lg sm:text-2xl font-extrabold text-[#8B2F2F]">
              {currentLagnaHouse
                ? getRashiNumber(
                    currentLagnaHouse.sign
                  )
                : ""}
            </div>

            <div className="mt-0.5 font-mono text-[9px] sm:text-[10px] font-semibold text-[#2F5D8A]">
              {derivedView
                ? `Natal H${startNatalHouse}`
                : kundli.ascendantFormattedDegree}
            </div>

          </div>

        </div>

      </div>

      <div className="rounded-2xl border border-[#B89A70] bg-[#F7EBD8] p-3 sm:p-4">

        {selectedVisibleHouse !== null ? (

          <div className="space-y-3">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

              <div>

                <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#765535]">
                  House Selected
                </p>

                <p className="mt-1 text-sm sm:text-base font-extrabold text-[#542F28]">

                  House{" "}
                  {selectedVisibleHouse}
                  {" · Rashi "}
                  {selectedHouseData
                    ? getRashiNumber(
                        selectedHouseData.sign
                      )
                    : ""}

                  {selectedNatalHouse !==
                    selectedVisibleHouse && (
                    <span className="text-xs font-semibold text-[#83705A]">
                      {" · Natal H"}
                      {selectedNatalHouse}
                    </span>
                  )}

                </p>

              </div>

              <p className="text-[11px] text-[#7D6A54]">
                This selection is the house you clicked.
              </p>

            </div>

            <div className="flex flex-col sm:flex-row gap-2">

              <button
                type="button"
                disabled={
                  selectedVisibleHouse === 1
                }
                onClick={
                  applySelectedHouseAsLagna
                }
                className={cn(
                  "flex-1 rounded-xl px-4 py-3 text-sm font-extrabold transition-all",
                  selectedVisibleHouse === 1
                    ? "cursor-not-allowed bg-[#E3D4BC] text-[#9B896F]"
                    : "bg-[#8B2F2F] text-[#FFF8ED] hover:bg-[#722525] shadow-sm"
                )}
              >
                {selectedVisibleHouse === 1
                  ? "House 1 is already the Lagna"
                  : `Start Kundli from House ${selectedVisibleHouse}`}
              </button>

              {derivedView && (
                <button
                  type="button"
                  onClick={
                    restoreOriginalLagna
                  }
                  className="rounded-xl border border-[#8B2F2F]/40 bg-[#FFF9EF] px-4 py-3 text-sm font-extrabold text-[#7A302D] hover:bg-white transition-all"
                >
                  Back to Original Lagna Kundli
                </button>
              )}

            </div>

          </div>

        ) : (

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div>

              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#765535]">
                Interactive Kundli
              </p>

              <p className="mt-1 text-sm text-[#66513B]">
                Click anywhere inside a house to select it.
              </p>

            </div>

            {derivedView && (
              <button
                type="button"
                onClick={
                  restoreOriginalLagna
                }
                className="rounded-xl border border-[#8B2F2F]/40 bg-[#FFF9EF] px-4 py-2.5 text-sm font-extrabold text-[#7A302D] hover:bg-white transition-all"
              >
                Back to Original Lagna Kundli
              </button>
            )}

          </div>

        )}

      </div>

    </div>
  );
}

// ============================================================
// PLANETARY MATURITY AGES
// ============================================================

const PLANET_MATURITY_AGES = [
  { planet: "Jupiter", age: 16 },
  { planet: "Sun", age: 22 },
  { planet: "Moon", age: 24 },
  { planet: "Venus", age: 25 },
  { planet: "Mars", age: 28 },
  { planet: "Mercury", age: 32 },
  { planet: "Saturn", age: 36 },
  { planet: "Rahu", age: 42 },
  { planet: "Ketu", age: 48 },
];

// ============================================================
// DASHA LEVEL COMPONENT
// ============================================================

const DashaLevel: React.FC<
  DashaLevelProps
> = ({
  period,
  level,
  isCurrent,
  onPathSelect,
  ancestors = [],
}) => {
  const [expanded, setExpanded] =
    useState(false);

  const active = isCurrent(
    period.start,
    period.end
  );

  const hasSubs =
    period.subDashas &&
    period.subDashas.length > 0;

  const levelNames = [
    "Mahadasha",
    "Antardasha",
    "Pratyantar",
    "Sookshma",
    "Prana",
  ];

  const levelColors = [
    "border-amber-500/50 bg-amber-500/5",
    "border-stone-700 bg-stone-900/40",
    "border-stone-800 bg-stone-950/30",
    "border-stone-800 bg-stone-950/20",
    "border-stone-900 bg-stone-950/10",
  ];

  const handleClick = () => {
    if (hasSubs) {
      setExpanded(!expanded);
    }

    onPathSelect?.([
      ...ancestors,
      period,
    ]);
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all mb-2 overflow-hidden cursor-pointer group",
        active
          ? "ring-1 ring-amber-500/30"
          : "opacity-90",
        levelColors[level] ||
          "border-stone-900"
      )}
    >

      <button
        type="button"
        onClick={handleClick}
        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/5 transition-colors text-left"
      >

        <div className="flex items-center justify-between gap-3">

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">

            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                active
                  ? "bg-amber-500 text-black"
                  : "bg-stone-800 text-stone-400"
              )}
            >
              {period.planet
                .substring(0, 2)
                .toUpperCase()}
            </div>

            <div className="flex items-center gap-2 min-w-0">

              <span
                className={cn(
                  "font-semibold text-[17px] sm:text-lg",
                  active
                    ? "text-white"
                    : "text-stone-300"
                )}
              >
                {period.planet}
              </span>

              <span className="text-[14px] sm:text-sm text-stone-400 font-medium whitespace-nowrap">
                {levelNames[level]}
              </span>

              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              )}

            </div>

          </div>

          {hasSubs &&
            (expanded ? (
              <ChevronDown className="w-4 h-4 text-stone-600 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-stone-600 shrink-0" />
            ))}

        </div>

        <div className="mt-3 sm:mt-2 pl-10 sm:pl-11">

          <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-2">

            <span className="text-[13px] sm:text-base text-stone-200 font-mono font-semibold leading-6">
              {period.start}
            </span>

            <span className="hidden sm:inline text-stone-600">
              -
            </span>

            <span className="text-[13px] sm:text-base text-stone-200 font-mono font-semibold leading-6">
              {period.end}
            </span>

          </div>

        </div>

      </button>

      <AnimatePresence>

        {expanded && hasSubs && (

          <motion.div
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: "auto",
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            className="px-2 sm:px-3 pb-3 pt-1 border-t border-stone-800/50"
          >

            {period.subDashas?.map(
              (sub, idx) => (
                <DashaLevel
                  key={idx}
                  period={sub}
                  level={level + 1}
                  isCurrent={isCurrent}
                  onPathSelect={
                    onPathSelect
                  }
                  ancestors={[
                    ...ancestors,
                    period,
                  ]}
                />
              )
            )}

          </motion.div>

        )}

      </AnimatePresence>

    </div>
  );
};

// ============================================================
// APP
// ============================================================

export default function App() {

  const [dob, setDob] =
    useState("1990-01-01");

  const [tob, setTob] =
    useState("12:00:00");

  const [location, setLocation] =
    useState("New Delhi, India");

  const [timezone, setTimezone] =
    useState("Asia/Kolkata");

  const [latitude, setLatitude] =
    useState("28.6139");

  const [longitude, setLongitude] =
    useState("77.2090");

  const [targetAge, setTargetAge] =
    useState("");

  const [
    activeLagnaNatalHouse,
    setActiveLagnaNatalHouse,
  ] = useState(1);

  const [loading, setLoading] =
    useState(false);

  const [nodeType, setNodeType] =
    useState<LunarNodeType>("true");

  const [result, setResult] =
    useState<{
      info: any;
      dashas: DashaPeriod[];
      planetaryPositions: PlanetaryPosition[];
      charaKarakas: CharaKaraka[];
      kundli: KundliData;
    } | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedPath, setSelectedPath] =
    useState<DashaPeriod[]>([]);

  const [ageDashaResult, setAgeDashaResult] =
    useState<{
      age: string;
      startDateStr: string;
      endDateStr: string;
      matches: AgeAntardashaMatch[];
    } | null>(null);

  // ==========================================================
  // WORKSPACE
  // ==========================================================

  const [activePanel, setActivePanel] =
    useState<WorkspacePanel>("details");

  const [splitScreen, setSplitScreen] =
    useState(false);

  const [splitLeftPanel, setSplitLeftPanel] =
    useState<WorkspacePanel>("kundli");

  const [splitRightPanel, setSplitRightPanel] =
    useState<WorkspacePanel>("dasha");

  const workspacePanels: {
    id: WorkspacePanel;
    label: string;
  }[] = [
    {
      id: "details",
      label: "Details",
    },
    {
      id: "kundli",
      label: "Kundli",
    },
    {
      id: "dasha",
      label: "Dasha Hierarchy",
    },
    {
      id: "planetary",
      label: "Planetary Placement",
    },
    {
      id: "drishti",
      label: "Drishti & Lordship",
    },
    {
      id: "dignity",
      label: "Dignity",
    },
    {
      id: "age",
      label: "Age Dasha",
    },
    {
      id: "degrees",
      label: "Degrees & Karaka",
    },
  ];

  // ==========================================================
  // AGE
  // ==========================================================

  const getCurrentAgeInYearsMonthsDays = (
    birthDateStr: string
  ) => {
    if (!birthDateStr) {
      return null;
    }

    const birth =
      DateTime.fromISO(
        birthDateStr
      );

    const now =
      DateTime.now();

    if (
      !birth.isValid ||
      birth > now
    ) {
      return null;
    }

    const diff =
      now.diff(
        birth,
        [
          "years",
          "months",
          "days",
        ]
      ).toObject();

    return {
      years: Math.floor(
        diff.years || 0
      ),
      months: Math.floor(
        diff.months || 0
      ),
      days: Math.floor(
        diff.days || 0
      ),
    };
  };

  // ==========================================================
  // WHATSAPP
  // ==========================================================

  const openWhatsApp = () => {
    const phoneNumber =
      "919818966252";

    const message =
      encodeURIComponent(
        `Hello Ritik ji,

I would like to book a detailed personal horoscope consultation.

Here are my birth details:

 Date of Birth: ${dob}
 Time of Birth: ${tob}
 Location: ${location}

Please share your consultation fees and availability.

Thank you!`
      );

    const url =
      `https://wa.me/${phoneNumber}?text=${message}`;

    window.open(
      url,
      "_blank"
    );
  };

  // ==========================================================
  // PRASHAN KUNDLI
  // ==========================================================

  const handlePrashanKundli = () => {
    const now =
      DateTime.now().setZone(
        timezone
      );

    if (!now.isValid) {
      setError(
        "Unable to determine the current date and time."
      );
      return;
    }

    setDob(
      now.toFormat(
        "yyyy-MM-dd"
      )
    );

    setTob(
      now.toFormat(
        "HH:mm:ss"
      )
    );

    setResult(null);
    setError(null);
    setSelectedPath([]);
    setAgeDashaResult(null);
    setActivePanel("details");
    setSplitScreen(false);
  };

  // ==========================================================
  // CALCULATE
  // ==========================================================

  const handleCalculate = async (
    selectedNodeType: LunarNodeType = nodeType
  ) => {

    setActiveLagnaNatalHouse(1);
    setLoading(true);
    setError(null);
    setSelectedPath([]);
    setAgeDashaResult(null);

    try {

      const dashaInfo =
        await calculateDasha(
          dob,
          tob,
          timezone
        );

      const hierarchy =
        generateDashaHierarchy(
          dashaInfo.birthJD,
          dashaInfo
        );

      const planetaryPositions =
        await calculatePlanetaryPositions(
          dob,
          tob,
          timezone,
          selectedNodeType
        );

      const charaKarakas =
        calculateCharaKarakas(
          planetaryPositions
        );

      const kundli =
        await calculateKundli(
          dob,
          tob,
          timezone,
          Number(latitude),
          Number(longitude),
          selectedNodeType
        );

      setResult({
        info: dashaInfo,
        dashas: hierarchy,
        planetaryPositions,
        charaKarakas,
        kundli,
      });

      setActivePanel("details");
      setSplitScreen(false);

    } catch (err: any) {

      setError(
        err?.message ||
          "Calculation failed."
      );

    } finally {

      setLoading(false);

    }
  };

  // ==========================================================
  // AGE DASHA
  // ==========================================================

  const handleCalculateAgeDasha = (
    ageOverride?: number
  ) => {

    if (!result) {
      return;
    }

    const ageToUse =
      ageOverride !== undefined
        ? ageOverride
        : Number(targetAge);

    if (
      isNaN(ageToUse) ||
      ageToUse < 0
    ) {
      return;
    }

    const ageNum =
      Math.floor(
        ageToUse
      );

    const birthDateTime =
      DateTime.fromISO(
        `${dob}T${tob}`,
        {
          zone: timezone,
        }
      );

    const yearStartDT =
      birthDateTime.plus({
        years: ageNum,
      });

    const yearEndDT =
      birthDateTime.plus({
        years: ageNum + 1,
      });

    const yearStartStr =
      yearStartDT.toFormat(
        "yyyy-MM-dd HH:mm:ss"
      );

    const yearEndStr =
      yearEndDT.toFormat(
        "yyyy-MM-dd HH:mm:ss"
      );

    const foundMatches:
      AgeAntardashaMatch[] = [];

    for (
      const md of result.dashas
    ) {

      if (!md.subDashas) {
        continue;
      }

      for (
        const ad of md.subDashas
      ) {

        if (
          ad.start < yearEndStr &&
          ad.end > yearStartStr
        ) {

          foundMatches.push({
            mahadasha:
              md.planet,
            antardasha:
              ad.planet,
            start:
              ad.start,
            end:
              ad.end,
          });

        }

      }

    }

    setAgeDashaResult({
      age:
        ageNum.toString(),
      startDateStr:
        yearStartDT.toFormat(
          "dd MMM yyyy"
        ),
      endDateStr:
        yearEndDT.toFormat(
          "dd MMM yyyy"
        ),
      matches:
        foundMatches,
    });

  };

  // ==========================================================
  // HEALTH
  // ==========================================================

  const checkHealth = () => {
    alert(
      "Astrology engine is active. 5-level Dasha hierarchy enabled."
    );
  };

  // ============================================================
  // PDF AUTHOR STAMP
  // ============================================================

  const drawRitikVermaStamp = (
    doc: jsPDF,
    x: number,
    y: number,
    radius = 18
  ) => {

    doc.setDrawColor(
      120,
      75,
      35
    );

    doc.setLineWidth(0.8);

    doc.circle(
      x,
      y,
      radius,
      "S"
    );

    doc.setDrawColor(
      145,
      95,
      45
    );

    doc.setLineWidth(
      0.35
    );

    doc.circle(
      x,
      y,
      radius - 2.5,
      "S"
    );

    doc.setFont(
      "times",
      "bold"
    );

    doc.setFontSize(7);

    doc.setTextColor(
      120,
      75,
      35
    );

    doc.text(
      "RITIK VERMA",
      x,
      y + 2,
      {
        align: "center",
      }
    );

    doc.setFont(
      "times",
      "bold"
    );

    doc.setFontSize(7);

    doc.setTextColor(
      110,
      70,
      35
    );

    doc.text(
      "Vedic Vimshottari",
      x,
      y - 8,
      {
        align: "center",
      }
    );

    doc.setFont(
      "times",
      "bold"
    );

    doc.setFontSize(7);

    doc.setTextColor(
      110,
      70,
      35
    );

    doc.text(
      "Astrologer",
      x,
      y + 10,
      {
        align: "center",
      }
    );

    doc.setFontSize(6);

    doc.text(
      "•",
      x - 11,
      y + 1.8,
      {
        align: "center",
      }
    );

    doc.text(
      "•",
      x + 11,
      y + 1.8,
      {
        align: "center",
      }
    );
  };

  // ============================================================
  // PDF HELPERS
  // ============================================================

  const addPdfSectionTitle = (
    doc: jsPDF,
    title: string,
    y: number
  ) => {

    doc.setFontSize(14);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      184,
      134,
      11
    );

    doc.text(
      title,
      14,
      y
    );

    doc.setDrawColor(
      184,
      134,
      11
    );

    doc.setLineWidth(
      0.35
    );

    doc.line(
      14,
      y + 2.5,
      196,
      y + 2.5
    );

    return y + 9;
  };

  // ============================================================
  // DRAW KUNDLI PDF
  // ============================================================

  const drawKundliPDF = (
    doc: jsPDF,
    kundli: KundliData,
    planetaryPositions: PlanetaryPosition[],
    startY: number
  ) => {

    const x = 35;
    const y = startY;
    const size = 140;
    const centerX =
      x + size / 2;
    const centerY =
      y + size / 2;

    const point = (
      px: number,
      py: number
    ) => ({
      x:
        x +
        (px / 100) *
          size,
      y:
        y +
        (py / 100) *
          size,
    });

    const drawSegment = (
      a: [number, number],
      b: [number, number]
    ) => {

      const p1 =
        point(a[0], a[1]);

      const p2 =
        point(b[0], b[1]);

      doc.line(
        p1.x,
        p1.y,
        p2.x,
        p2.y
      );
    };

    doc.setFillColor(
      248,
      242,
      230
    );

    doc.setDrawColor(
      118,
      85,
      53
    );

    doc.setLineWidth(
      0.9
    );

    doc.rect(
      x,
      y,
      size,
      size,
      "FD"
    );

    doc.setLineWidth(
      0.75
    );

    drawSegment(
      [50, 1],
      [99, 50]
    );

    drawSegment(
      [99, 50],
      [50, 99]
    );

    drawSegment(
      [50, 99],
      [1, 50]
    );

    drawSegment(
      [1, 50],
      [50, 1]
    );

    drawSegment(
      [1, 1],
      [50, 50]
    );

    drawSegment(
      [99, 1],
      [50, 50]
    );

    drawSegment(
      [99, 99],
      [50, 50]
    );

    drawSegment(
      [1, 99],
      [50, 50]
    );

    Object.values(
      NORTH_INDIAN_HOUSE_POLYGONS
    ).forEach((poly) => {

      const pts =
        poly
          .split(" ")
          .map((pair) => {

            const [
              px,
              py,
            ] =
              pair
                .split(",")
                .map(Number);

            return [
              px,
              py,
            ] as [
              number,
              number
            ];
          });

      for (
        let i = 0;
        i < pts.length;
        i += 1
      ) {

        const a =
          pts[i];

        const b =
          pts[
            (i + 1) %
              pts.length
          ];

        const isOuter =
          (a[0] === 0 &&
            b[0] === 0) ||
          (a[0] === 100 &&
            b[0] === 100) ||
          (a[1] === 0 &&
            b[1] === 0) ||
          (a[1] === 100 &&
            b[1] === 100);

        if (!isOuter) {
          drawSegment(a, b);
        }

      }

    });

    const houseTextPositions =
      NORTH_INDIAN_TEXT_POSITIONS;

    const normalHouseByNumber =
      new Map(
        kundli.houses.map(
          (house: any) => [
            house.house,
            house,
          ]
        )
      );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      107,
      90,
      68
    );

    for (
      let houseNumber = 1;
      houseNumber <= 12;
      houseNumber += 1
    ) {

      const house =
        normalHouseByNumber.get(
          houseNumber
        ) as any;

      if (!house) {
        continue;
      }

      const pos =
        houseTextPositions[
          houseNumber
        ];

      const hp =
        point(
          pos.x,
          pos.y
        );

      const rashiNumber =
        getRashiNumber(
          house.sign
        );

      const planets =
        Array.isArray(
          house.planets
        )
          ? house.planets
          : [];

      doc.setFontSize(7);

      doc.setTextColor(
        107,
        90,
        68
      );

      doc.text(
        `H${houseNumber}`,
        hp.x,
        hp.y - 3,
        {
          align: "center",
        }
      );

      doc.setFontSize(10);

      doc.setTextColor(
        31,
        100,
        123
      );

      doc.text(
        String(
          rashiNumber
        ),
        hp.x,
        hp.y + 3,
        {
          align: "center",
        }
      );

      if (
        planets.length > 0
      ) {

        doc.setFontSize(7.5);

        doc.setTextColor(
          55,
          55,
          55
        );

        const retrogradeByPlanet =
          Object.fromEntries(
            (
              kundli.planets ||
              []
            ).map(
              (planet: any) => {

                const planetaryPosition =
                  planetaryPositions.find(
                    (item: any) =>
                      item.planet ===
                      planet.planet
                  );

                return [
                  planet.planet,
                  getPlanetRetrograde(
                    planetaryPosition,
                    planet
                  ) === true,
                ];
              }
            )
          ) as Record<
            string,
            boolean
          >;

          const planetLabels =
  planets.map(
    (planet: string) =>
      retrogradeByPlanet[planet]
        ? `(${getPlanetAbbreviation(planet)})`
        : getPlanetAbbreviation(planet)
  );

        doc.text(
          planetLabels.join(
            "  "
          ),
          hp.x,
          hp.y + 8,
          {
            align: "center",
          }
        );

      }

    }

    doc.setFontSize(7);

    doc.setTextColor(
      118,
      85,
      53
    );

    doc.text(
      "Lagna",
      centerX,
      centerY - 3,
      {
        align: "center",
      }
    );

    doc.setFontSize(13);

    doc.setTextColor(
      139,
      47,
      47
    );

    doc.text(
      String(
        getRashiNumber(
          kundli.ascendantSign
        )
      ),
      centerX,
      centerY + 4,
      {
        align: "center",
      }
    );

    doc.setFontSize(7);

    doc.setTextColor(
      47,
      93,
      138
    );

    doc.text(
      kundli.ascendantFormattedDegree ||
        "",
      centerX,
      centerY + 10,
      {
        align: "center",
      }
    );

    return y + size;
  };

  // ============================================================
  // EXPORT PDF
  // ============================================================

  const exportPDF = async () => {

    if (!result) {
      return;
    }

    const doc =
      new jsPDF({
        orientation:
          "portrait",
        unit: "mm",
        format: "a4",
      });

    let yPosition = 16;

    const addFooter = () => {

      const pageCount =
        doc.getNumberOfPages();

      for (
        let i = 1;
        i <= pageCount;
        i++
      ) {

        doc.setPage(i);

        doc.setFontSize(8);

        doc.setTextColor(
          120
        );

        doc.text(
          "© 2026 Vedic Vimshottari™. Developed by Ritik Verma. All rights reserved.",
          105,
          290,
          {
            align: "center",
          }
        );

        doc.text(
          `Page ${i} of ${pageCount}`,
          200,
          290,
          {
            align: "right",
          }
        );

        if (
          i === pageCount
        ) {

          drawRitikVermaStamp(
            doc,
            172,
            260,
            18
          );

        }

      }

    };

    const ensureRoom = (
      requiredHeight: number
    ) => {

      if (
        yPosition +
          requiredHeight >
        278
      ) {

        doc.addPage();

        yPosition = 16;

      }

    };

    // ------------------------------------------------------------
    // REPORT HEADER
    // ------------------------------------------------------------

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(20);

    doc.setTextColor(
      184,
      134,
      11
    );

    doc.text(
      "Vedic Vimshottari",
      105,
      yPosition,
      {
        align: "center",
      }
    );

    yPosition += 7;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    doc.setTextColor(100);

    doc.text(
      `Generated on: ${DateTime.now().toLocaleString(
        DateTime.DATETIME_MED
      )}`,
      105,
      yPosition,
      {
        align: "center",
      }
    );

    yPosition += 9;

    doc.setFontSize(10);

    doc.setTextColor(30);

    const timezoneLabel: Record<
      string,
      string
    > = {
      "Asia/Kolkata":
        "India (IST)",
      "America/New_York":
        "New York (EST/EDT)",
      "Europe/London":
        "London (GMT/BST)",
      UTC: "UTC",
    };

    const selectedTimezoneLabel =
      timezoneLabel[
        timezone
      ] ?? timezone;

    doc.text(
      `Birth Date: ${dob} ${tob}`,
      14,
      yPosition
    );

    yPosition += 5.5;

    doc.text(
      `Timezone: ${selectedTimezoneLabel}`,
      14,
      yPosition
    );

    yPosition += 5.5;

    doc.text(
      `Latitude: ${Number(
        latitude
      ).toFixed(4)}°`,
      14,
      yPosition
    );

    yPosition += 5.5;

    doc.text(
      `Longitude: ${Number(
        longitude
      ).toFixed(4)}°`,
      14,
      yPosition
    );

    // ------------------------------------------------------------
    // 1. KUNDLI FIRST
    // ------------------------------------------------------------

    yPosition += 8;

    yPosition =
      addPdfSectionTitle(
        doc,
        "Lagna Kundli",
        yPosition
      );

    ensureRoom(150);

    yPosition =
      drawKundliPDF(
        doc,
        result.kundli,
        result.planetaryPositions,
        yPosition
      ) + 7;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.setTextColor(90);

    doc.text(
      `Lagna: Rashi ${getRashiNumber(
        result.kundli
          .ascendantSign
      )} · ${result.kundli.ascendantFormattedDegree}`,
      105,
      yPosition,
      {
        align: "center",
      }
    );

    // ------------------------------------------------------------
    // 2. PLANETARY PLACEMENT
    // ------------------------------------------------------------

    yPosition += 11;

    ensureRoom(55);

    yPosition =
      addPdfSectionTitle(
        doc,
        "Planetary Placement",
        yPosition
      );

    const planetaryRows =
      result.kundli.planets.map(
        (planet: any) => {

          const planetaryPosition =
            result.planetaryPositions.find(
              (item) =>
                item.planet ===
                planet.planet
            ) as any;

          const degreeInSign =
            planetaryPosition?.degreeInSign ??
            0;

          const nakshatra =
            getNakshatraData(
              planet.sign,
              degreeInSign
            );

          const signLord =
            getSignLord(
              planet.sign
            );

          const state =
            getPlanetaryState(
              degreeInSign,
              planet.sign
            );

          const status =
            getPlanetStatus(
              planet.planet,
              planet.sign
            );

          const retrograde =
            getPlanetRetrograde(
              planetaryPosition,
              planet
            ) === true;

          return [
            planet.planet,
            planet.sign,
            signLord,
            nakshatra.name,
            nakshatra.lord,
            planet.formattedDegree ||
              `${degreeInSign.toFixed(
                2
              )}°`,
              retrograde
               ? "Yes"
               : "No",
            planet.house,
            state,
            status,
          ];
        }
      );

    autoTable(doc, {
      startY: yPosition,

      head: [
        [
          "Planet",
          "Sign",
          "Sign Lord",
          "Nakshatra",
          "Naksh Lord",
          "Degree",
          "Retro",
          "House",
          "State",
          "Sign Status",
        ],
      ],

      body: planetaryRows,

      theme: "grid",

      styles: {
        fontSize: 7,
        cellPadding: 2.2,
        textColor: [
          35,
          35,
          35,
        ],
        lineColor: [
          210,
          205,
          195,
        ],
        lineWidth: 0.2,
      },

      headStyles: {
        fillColor: [
          70,
          55,
          40,
        ],
        textColor: [
          255,
          250,
          240,
        ],
        fontStyle:
          "bold",
        fontSize: 6.8,
      },

      alternateRowStyles: {
        fillColor: [
          250,
          247,
          240,
        ],
      },

      margin: {
        left: 10,
        right: 10,
      },

    });

    yPosition =
      (
        doc as any
      ).lastAutoTable?.finalY ||
      yPosition;

    yPosition += 10;

    // ------------------------------------------------------------
    // 3. CHARA KARAKA RANKING
    // ------------------------------------------------------------

    ensureRoom(55);

    yPosition =
      addPdfSectionTitle(
        doc,
        "Chara Karaka Ranking",
        yPosition
      );

    const currentKarakas =
      result.charaKarakas.map(
        (item, index) => [
          index + 1,
          item.karaka,
          item.planet,
          getRashiNumber(
            item.sign
          ),
          item.formattedDegree,
          item.planet ===
          "Rahu"
            ? item.formattedEffectiveDegree ||
              "—"
            : "—",
        ]
      );

    autoTable(doc, {
      startY: yPosition,

      head: [
        [
          "Rank",
          "Chara Karaka",
          "Planet",
          "Rashi",
          "Degree",
          "Effective Degree",
        ],
      ],

      body: currentKarakas,

      theme: "grid",

      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [
          35,
          35,
          35,
        ],
        lineColor: [
          210,
          205,
          195,
        ],
        lineWidth: 0.2,
      },

      headStyles: {
        fillColor: [
          70,
          55,
          40,
        ],
        textColor: [
          255,
          250,
          240,
        ],
        fontStyle:
          "bold",
        fontSize: 7,
      },

      alternateRowStyles: {
        fillColor: [
          250,
          247,
          240,
        ],
      },

      margin: {
        left: 22,
        right: 22,
      },

    });

    yPosition =
      (
        doc as any
      ).lastAutoTable?.finalY ||
      yPosition;

    yPosition += 10;

    // ------------------------------------------------------------
    // 4. TRUE NODE
    // 5. MEAN NODE
    // ------------------------------------------------------------

    const truePositions =
      await calculatePlanetaryPositions(
        dob,
        tob,
        timezone,
        "true"
      );

    const meanPositions =
      await calculatePlanetaryPositions(
        dob,
        tob,
        timezone,
        "mean"
      );

    const trueKarakas =
      calculateCharaKarakas(
        truePositions
      );

    const meanKarakas =
      calculateCharaKarakas(
        meanPositions
      );

    const addNodeKarakaTable = (
      title: string,
      karakas: CharaKaraka[]
    ) => {

      ensureRoom(55);

      yPosition =
        addPdfSectionTitle(
          doc,
          title,
          yPosition
        );

      const rows =
        karakas.map(
          (
            item,
            index
          ) => [
            index + 1,
            item.karaka,
            item.planet,
            getRashiNumber(
              item.sign
            ),
            item.formattedDegree,
            item.planet ===
            "Rahu"
              ? item.formattedEffectiveDegree ||
                "—"
              : "—",
          ]
        );

      autoTable(doc, {
        startY: yPosition,

        head: [
          [
            "Rank",
            "Chara Karaka",
            "Planet",
            "Rashi",
            "Degree",
            "Effective Degree",
          ],
        ],

        body: rows,

        theme: "grid",

        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [
            35,
            35,
            35,
          ],
          lineColor: [
            210,
            205,
            195,
          ],
          lineWidth: 0.2,
        },

        headStyles: {
          fillColor: [
            70,
            55,
            40,
          ],
          textColor: [
            255,
            250,
            240,
          ],
          fontStyle:
            "bold",
          fontSize: 7,
        },

        alternateRowStyles: {
          fillColor: [
            250,
            247,
            240,
          ],
        },

        margin: {
          left: 22,
          right: 22,
        },

      });

      yPosition =
        (
          doc as any
        ).lastAutoTable?.finalY ||
        yPosition;

      yPosition += 10;
    };

    addNodeKarakaTable(
      "Chara Karaka Ranking — True Node",
      trueKarakas
    );

    addNodeKarakaTable(
      "Chara Karaka Ranking — Mean Node",
      meanKarakas
    );

    // ------------------------------------------------------------
    // 6. DASHA
    // ------------------------------------------------------------

    yPosition += 2;

    result.dashas.forEach(
      (md) => {

        if (
          yPosition > 250
        ) {

          doc.addPage();

          yPosition = 20;

        }

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(14);

        doc.setTextColor(
          184,
          134,
          11
        );

        doc.text(
          `${md.planet} Mahadasha (${md.start} — ${md.end})`,
          20,
          yPosition
        );

        yPosition += 8;

        const antardashaData =
          md.subDashas?.map(
            (ad: any) => [
              ad.planet,
              ad.start,
              ad.end,
            ]
          ) || [];

        autoTable(doc, {
          startY:
            yPosition,

          head: [
            [
              "Antardasha Lord",
              "Start Time",
              "End Time",
            ],
          ],

          body:
            antardashaData,

          theme: "grid",

          styles: {
            fontSize: 8,
          },

          headStyles: {
            fillColor: [
              184,
              134,
              11,
            ],
            textColor: [
              255,
              255,
              255,
            ],
            fontStyle:
              "bold",
          },

          margin: {
            left: 20,
            right: 20,
          },

          didDrawPage:
            (data) => {
              yPosition =
                data.cursor
                  ?.y ||
                20;
            },

        });

        yPosition =
          (
            doc as any
          ).lastAutoTable?.finalY ||
          yPosition;

        yPosition += 12;

      }
    );

    addFooter();

    doc.save(
      `Vedic_vimshottari_${dob}.pdf`
    );
  };

  // ==========================================================
  // CURRENT DASHA
  // ==========================================================

  const isCurrent = (
    start: string,
    end: string
  ) => {

    const now =
      DateTime.now()
        .setZone(
          timezone
        )
        .toFormat(
          "yyyy-MM-dd HH:mm:ss"
        );

    return (
      now >= start &&
      now <= end
    );
  };

  // ==========================================================
  // WORKSPACE PANEL RENDERER
  // ==========================================================

  const renderWorkspacePanel = (
    panel: WorkspacePanel
  ) => {

    // ========================================================
    // DETAILS
    // ========================================================

    if (panel === "details") {

      return (
        <div className="max-w-5xl mx-auto space-y-5">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">

                  <Calculator className="w-5 h-5 text-amber-500" />

                </div>

                <div>

                  <h2 className="text-xl font-semibold text-white">
                    Birth Details
                  </h2>

                  <p className="text-xs text-stone-500 mt-1">
                    Calculation parameters used for this chart.
                  </p>

                </div>

              </div>

            </div>

            <div className="p-5 sm:p-7">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Date of Birth
                  </p>

                  <div className="flex items-center gap-3 mt-2">

                    <Calendar className="w-4 h-4 text-amber-500" />

                    <span className="font-mono text-white">
                      {dob}
                    </span>

                  </div>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Time of Birth
                  </p>

                  <div className="flex items-center gap-3 mt-2">

                    <Clock className="w-4 h-4 text-amber-500" />

                    <span className="font-mono text-white">
                      {tob}
                    </span>

                  </div>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Timezone
                  </p>

                  <p className="text-white font-medium mt-2">

                    {timezone ===
                    "Asia/Kolkata"
                      ? "India (IST)"
                      : timezone ===
                        "America/New_York"
                        ? "New York (EST/EDT)"
                        : timezone ===
                          "Europe/London"
                          ? "London (GMT/BST)"
                          : "UTC"}

                  </p>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Location
                  </p>

                  <div className="flex items-center gap-3 mt-2">

                    <MapPin className="w-4 h-4 text-amber-500" />

                    <span className="text-white">
                      {location}
                    </span>

                  </div>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Latitude
                  </p>

                  <p className="font-mono text-white mt-2">
                    {Number(
                      latitude
                    ).toFixed(4)}
                    °
                  </p>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Longitude
                  </p>

                  <p className="font-mono text-white mt-2">
                    {Number(
                      longitude
                    ).toFixed(4)}
                    °
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">

                <button
                  type="button"
                  onClick={
                    handlePrashanKundli
                  }
                  className="rounded-xl border border-amber-500/20 bg-stone-950 hover:bg-stone-900 text-amber-400 font-semibold py-3 flex items-center justify-center gap-2"
                >

                  <Clock className="w-4 h-4" />

                  Prashan Kundli

                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCalculate()
                  }
                  disabled={loading}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 flex items-center justify-center gap-2"
                >

                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}

                  Refresh Workspace

                </button>

              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">

                  <AlertCircle className="w-5 h-5 shrink-0" />

                  <p className="text-sm">
                    {error}
                  </p>

                </div>
              )}

            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">

              <p className="text-[9px] uppercase tracking-widest text-stone-600">
                Nakshatra
              </p>

              <p className="text-lg font-semibold text-white mt-2">
                {result?.info.nakshatra}
              </p>

            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">

              <p className="text-[9px] uppercase tracking-widest text-stone-600">
                Moon Longitude
              </p>

              <p className="text-lg font-semibold text-white mt-2">
                {result?.info.moonLong.toFixed(
                  4
                )}
                °
              </p>

            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">

              <p className="text-[9px] uppercase tracking-widest text-stone-600">
                Lahiri Ayanamsa
              </p>

              <p className="text-lg font-semibold text-white mt-2">
                {result?.info.ayanamsa.toFixed(
                  4
                )}
                °
              </p>

            </div>

          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">

            <div className="flex gap-3">

              <Info className="w-5 h-5 text-amber-500 shrink-0" />

              <div>

                <h3 className="text-sm font-semibold text-amber-500">
                  Ayanamsa
                </h3>

                <p className="text-xs text-stone-500 mt-1">

                  Calculations use the{" "}

                  <strong className="text-stone-300">
                    Lahiri (Chitra Paksha)
                  </strong>{" "}

                  Ayanamsa as standard.

                </p>

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={checkHealth}
            className="w-full bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-xl py-3 text-xs text-stone-400"
          >
            Check Backend Connection
          </button>

          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">

            <button
              type="button"
              onClick={
                openWhatsApp
              }
              className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center gap-2"
            >

              <Sparkles className="w-4 h-4" />

              Book Personal Horoscope Consultation

            </button>

          </div>

        </div>
      );
    }

    // ========================================================
    // KUNDLI
    // ========================================================

    if (panel === "kundli") {

      return (
        <div className="max-w-6xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <div className="flex items-center gap-2">

                    <Sparkles className="w-5 h-5 text-amber-500" />

                    <h2 className="text-lg font-semibold text-white">
                      Lagna Kundli
                    </h2>

                  </div>

                  <p className="text-xs text-stone-500 mt-1">
                    D1 Rashi Chart · Lahiri Sidereal · Whole Sign
                  </p>

                </div>

                <span className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] uppercase tracking-widest text-amber-400 font-semibold">
                  D1 Rashi
                </span>

              </div>

            </div>

            <div className="p-4 sm:p-7">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Lagna / Ascendant
                  </p>

                  <div className="flex items-baseline gap-2 mt-1">

                    <span className="text-xl font-semibold text-white">
                      Rashi{" "}
                      {getRashiNumber(
                        result!.kundli
                          .ascendantSign
                      )}
                    </span>

                    <span className="font-mono text-amber-400">
                      {result!.kundli
                        .ascendantFormattedDegree}
                    </span>

                  </div>

                </div>

                <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                  <p className="text-[9px] uppercase tracking-widest text-stone-600">
                    Birth Coordinates
                  </p>

                  <p className="font-mono text-sm text-stone-300 mt-2">

                    {Number(
                      latitude
                    ).toFixed(4)}
                    °,
                    {" "}
                    {Number(
                      longitude
                    ).toFixed(4)}
                    °

                  </p>

                </div>

              </div>

              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-2 sm:p-5 overflow-hidden">

                <D1KundliChart
                  kundli={
                    result!.kundli
                  }
                  onLagnaHouseChange={
                    setActiveLagnaNatalHouse
                  }
                />

              </div>

            </div>

          </div>

        </div>
      );
    }

    // ========================================================
    // DASHA
    // ========================================================

    if (panel === "dasha") {

      return (
        <div className="max-w-6xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

              <div>

                <h2 className="text-lg font-semibold text-white">
                  Dasha Hierarchy
                </h2>

                <p className="text-xs text-stone-500 mt-1">
                  Complete 5-level Vimshottari Dasha hierarchy.
                </p>

              </div>

              <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">
                MD → AD → PD → SD → PrD
              </span>

            </div>

            <div className="p-3 sm:p-6 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">

              {result!.dashas.map(
                (
                  md,
                  idx
                ) => (

                  <DashaLevel
                    key={idx}
                    period={md}
                    level={0}
                    isCurrent={
                      isCurrent
                    }
                    onPathSelect={
                      setSelectedPath
                    }
                    ancestors={[]}
                  />

                )
              )}

            </div>

          </div>

          {selectedPath.length >
            0 && (

            <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">

              <p className="text-[9px] uppercase tracking-widest text-amber-500 font-bold mb-2">
                Selected Dasha Sequence
              </p>

              <div className="flex flex-wrap items-center gap-2 text-sm text-white">

                {selectedPath.map(
                  (
                    period,
                    index
                  ) => (

                    <React.Fragment
                      key={
                        index
                      }
                    >

                      <span className="font-semibold">

                        {
                          period.planet
                        }

                        <span className="text-[9px] text-stone-600 ml-1">
                          {
                            [
                              "MD",
                              "AD",
                              "PD",
                              "SD",
                              "PrD",
                            ][index]
                          }
                        </span>

                      </span>

                      {index <
                        selectedPath.length -
                          1 && (
                        <ChevronRight className="w-4 h-4 text-stone-700" />
                      )}

                    </React.Fragment>

                  )
                )}

              </div>

              <p className="text-[10px] text-stone-600 mt-2">

                {
                  selectedPath[
                    selectedPath.length -
                      1
                  ]?.start
                }

                {" — "}

                {
                  selectedPath[
                    selectedPath.length -
                      1
                  ]?.end
                }

              </p>

            </div>

          )}

        </div>
      );
    }

    // ========================================================
    // PLANETARY
    // ========================================================

    if (
      panel === "planetary"
    ) {

      return (
        <div className="max-w-7xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <h2 className="text-lg font-semibold text-white">
                Planetary Placement
              </h2>

              <p className="text-xs text-stone-500 mt-1">
                Sign, sign lord, Nakshatra, degree, retrograde, house, state and sign status.
              </p>

            </div>

            <div className="p-4 sm:p-6">

              <div className="overflow-x-auto rounded-xl border border-stone-800">

                <table className="w-full min-w-[1150px] text-xs">

                  <thead>

                    <tr className="bg-stone-950 border-b border-stone-800">

                      {[
                        "Planet",
                        "Sign",
                        "Sign Lord",
                        "Nakshatra",
                        "Naksh Lord",
                        "Degree",
                        "Retro",
                        "House",
                        "State",
                        "Sign Status",
                      ].map(
                        (
                          header
                        ) => (

                          <th
                            key={
                              header
                            }
                            className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500"
                          >
                            {header}
                          </th>

                        )
                      )}

                    </tr>

                  </thead>

                  <tbody>

                    {result!.kundli.planets.map(
                      (
                        planet: any
                      ) => {

                        const planetaryPosition =
                          result!.planetaryPositions.find(
                            (
                              item
                            ) =>
                              item.planet ===
                              planet.planet
                          ) as any;

                        const degreeInSign =
                          planetaryPosition?.degreeInSign ??
                          0;

                        const nakshatra =
                          getNakshatraData(
                            planet.sign,
                            degreeInSign
                          );

                        const signLord =
                          getSignLord(
                            planet.sign
                          );

                        const state =
                          getPlanetaryState(
                            degreeInSign,
                            planet.sign
                          );

                        const status =
                          getPlanetStatus(
                            planet.planet,
                            planet.sign
                          );

                        const retrograde =
                          getPlanetRetrograde(
                            planetaryPosition,
                            planet
                          );

                        return (

                          <tr
                            key={
                              planet.planet
                            }
                            className="border-b border-stone-800/60 hover:bg-white/[0.025] transition-colors"
                          >

                            <td className="px-3 py-3 text-white font-semibold">
                              {
                                planet.planet
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                planet.sign
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                signLord
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                nakshatra.name
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                nakshatra.lord
                              }
                            </td>

                            <td className="px-3 py-3 font-mono text-amber-400 font-semibold">
                              {
                                planet.formattedDegree
                              }
                            </td>

                            <td
                              className={cn(
                                "px-3 py-3 font-bold",
                                retrograde ===
                                  true
                                  ? "text-amber-400"
                                  : "text-stone-600"
                              )}
                            >
                              {retrograde ===
                              true
                                ? "℞"
                                : "—"}
                            </td>

                            <td className="px-3 py-3 text-amber-400 font-bold">
                              {
                                planet.house
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                state
                              }
                            </td>

                            <td
                              className={cn(
                                "px-3 py-3 font-semibold whitespace-nowrap",
                                status ===
                                  "EXALTED" &&
                                  "text-emerald-400",
                                status ===
                                  "DEBILITATED" &&
                                  "text-red-500",
                                status ===
                                  "ENEMY" &&
                                  "text-red-400",
                                status ===
                                  "FRIENDLY" &&
                                  "text-sky-400",
                                (status ===
                                  "OWNED" ||
                                  status ===
                                    "MOOLTRIKONA") &&
                                  "text-amber-400"
                              )}
                            >
                              {
                                status
                              }
                            </td>

                          </tr>

                        );

                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        </div>
      );
    }

    // ========================================================
    // DRISHTI
    // ========================================================

    if (
      panel === "drishti"
    ) {

      return (
        <div className="max-w-6xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              <div>

                <h2 className="text-lg font-semibold text-white">
                  Planetary Drishti &amp; House Lordship
                </h2>

                <p className="text-xs text-stone-500 mt-1">
                  Planetary aspects and owned houses using the current Lagna.
                </p>

              </div>

              <span className="w-fit px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] uppercase tracking-widest text-amber-400 font-semibold">

                {activeLagnaNatalHouse ===
                1
                  ? "Natal Lagna"
                  : `Derived Lagna · Natal H${activeLagnaNatalHouse}`}

              </span>

            </div>

            <div className="p-4 sm:p-6">

              <div className="overflow-x-auto rounded-xl border border-stone-800">

                <table className="w-full min-w-[760px] text-xs">

                  <thead>

                    <tr className="border-b border-stone-800 bg-stone-950">

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Planet
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Placed House
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Drishti On House
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Owns House
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {result!.kundli.planets.map(
                      (
                        planet: any
                      ) => {

                        const occupiedNatalHouse =
                          Number(
                            planet.house
                          );

                        const placedVisibleHouse =
                          Number.isFinite(
                            occupiedNatalHouse
                          )
                            ? getVisibleHouseFromNatalHouse(
                                occupiedNatalHouse,
                                activeLagnaNatalHouse
                              )
                            : null;

                        const aspectOffsets =
                          PLANET_DRISHTI_OFFSETS[
                            planet.planet
                          ] || [7];

                        const drishtiText =
                          Number.isFinite(
                            occupiedNatalHouse
                          )
                            ? aspectOffsets
                                .map(
                                  (
                                    aspectFromPlanet
                                  ) => {

                                    const targetHouse =
                                      getAspectTargetHouse(
                                        occupiedNatalHouse,
                                        aspectFromPlanet,
                                        activeLagnaNatalHouse
                                      );

                                    return `${formatOrdinalHouseNumber(
                                      aspectFromPlanet
                                    )} → H${targetHouse}`;

                                  }
                                )
                                .join(
                                  ", "
                                )
                            : "—";

                        const ownedHouses =
                          getOwnedVisibleHouses(
                            planet.planet,
                            result!.kundli,
                            activeLagnaNatalHouse
                          );

                        return (

                          <tr
                            key={
                              planet.planet
                            }
                            className="border-b border-stone-800/60 hover:bg-white/[0.025]"
                          >

                            <td className="px-3 py-3 text-white font-semibold">

                              <span className="inline-flex items-center gap-2">

                                <span className="text-base text-amber-400 w-5 text-center">

                                  {
                                    PLANET_SYMBOLS[
                                      planet
                                        .planet
                                    ] ||
                                    "•"
                                  }

                                </span>

                                {
                                  planet.planet
                                }

                              </span>

                            </td>

                            <td className="px-3 py-3 text-amber-400 font-bold">
                              {placedVisibleHouse
                                ? `H${placedVisibleHouse}`
                                : "—"}
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {
                                drishtiText
                              }
                            </td>

                            <td className="px-3 py-3 text-stone-300">
                              {ownedHouses.length >
                              0
                                ? ownedHouses
                                    .map(
                                      (
                                        house
                                      ) =>
                                        `H${house}`
                                    )
                                    .join(
                                      ", "
                                    )
                                : "—"}
                            </td>

                          </tr>

                        );

                      }
                    )}

                  </tbody>

                </table>

              </div>

              <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-stone-500">

                <span className="text-amber-400 font-semibold">
                  Drishti rule:
                </span>{" "}

                Sun, Moon, Mercury and Venus → 7th;
                Mars → 4th, 7th, 8th;
                Jupiter → 5th, 7th, 9th;
                Saturn → 3rd, 7th, 10th;
                Rahu and Ketu → 5th, 7th, 9th as configured for this app.

              </div>

            </div>

          </div>

        </div>
      );
    }

    // ========================================================
    // DIGNITY
    // ========================================================

    if (
      panel === "dignity"
    ) {

      const dignityRows = [
        [
          "Sun",
          "Aries (1)",
          "Libra (7)",
          "Leo (5)",
        ],
        [
          "Moon",
          "Taurus (2)",
          "Scorpio (8)",
          "Cancer (4)",
        ],
        [
          "Mars",
          "Capricorn (10)",
          "Cancer (4)",
          "Aries (1), Scorpio (8)",
        ],
        [
          "Mercury",
          "Virgo (6)",
          "Pisces (12)",
          "Gemini (3), Virgo (6)",
        ],
        [
          "Jupiter",
          "Cancer (4)",
          "Capricorn (10)",
          "Sagittarius (9), Pisces (12)",
        ],
        [
          "Venus",
          "Pisces (12)",
          "Virgo (6)",
          "Taurus (2), Libra (7)",
        ],
        [
          "Saturn",
          "Libra (7)",
          "Aries (1)",
          "Capricorn (10), Aquarius (11)",
        ],
        [
          "Rahu",
          "Taurus (2)",
          "Scorpio (8)",
          "—",
        ],
        [
          "Ketu",
          "Scorpio (8)",
          "Taurus (2)",
          "—",
        ],
      ];

      return (
        <div className="max-w-6xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <h2 className="text-lg font-semibold text-white">
                Planetary Dignity Reference
              </h2>

              <p className="text-xs text-stone-500 mt-1">
                Exalted, debilitated and own-sign reference.
              </p>

            </div>

            <div className="p-4 sm:p-6">

              <div className="overflow-x-auto rounded-xl border border-stone-800">

                <table className="w-full min-w-[780px] text-xs">

                  <thead>

                    <tr className="border-b border-stone-800 bg-stone-950">

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Planet
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Exalted (Uchcha)
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Debilitated (Neecha)
                      </th>

                      <th className="text-left px-3 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Own Sign (Swa Rashi)
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {dignityRows.map(
                      (
                        [
                          planet,
                          exalted,
                          debilitated,
                          ownSign,
                        ]
                      ) => (

                        <tr
                          key={
                            planet
                          }
                          className="border-b border-stone-800/60 hover:bg-white/[0.025]"
                        >

                          <td className="px-3 py-3 text-white font-semibold">

                            <span className="inline-flex items-center gap-2">

                              <span className="text-base text-amber-400 w-5 text-center">

                                {
                                  PLANET_SYMBOLS[
                                    planet
                                  ] ||
                                  "•"
                                }

                              </span>

                              {
                                planet
                              }

                            </span>

                          </td>

                          <td className="px-3 py-3 text-stone-300">
                            {
                              exalted
                            }
                          </td>

                          <td className="px-3 py-3 text-stone-300">
                            {
                              debilitated
                            }
                          </td>

                          <td className="px-3 py-3 text-stone-300">
                            {
                              ownSign
                            }
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        </div>
      );
    }

    // ========================================================
    // AGE DASHA
    // ========================================================

    if (
      panel === "age"
    ) {

      const currentAge =
        getCurrentAgeInYearsMonthsDays(
          dob
        );

      return (
        <div className="max-w-6xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <div className="flex items-center gap-2">

                <Search className="w-5 h-5 text-amber-500" />

                <div>

                  <h2 className="text-lg font-semibold text-white">
                    Check Dasha By Age
                  </h2>

                  <p className="text-xs text-stone-500 mt-1">
                    Find the active Mahadasha and Antardasha for a specific age.
                  </p>

                </div>

              </div>

            </div>

            <div className="p-5 sm:p-7">

              {currentAge && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs mb-4">

                  <span className="text-stone-500">
                    Current Age:
                  </span>

                  <span className="font-bold text-white">

                    {currentAge.years}
                    {" "}yrs{" "}

                    {currentAge.months}
                    {" "}mos{" "}

                    {currentAge.days}
                    {" "}days

                  </span>

                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    targetAge
                  }
                  onChange={(
                    e
                  ) =>
                    setTargetAge(
                      e.target.value
                    )
                  }
                  placeholder="Enter age e.g. 25"
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
                />

                <button
                  type="button"
                  onClick={() =>
                    handleCalculateAgeDasha()
                  }
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center gap-2"
                >

                  <UserCheck className="w-4 h-4" />

                  Find Age Dasha

                </button>

              </div>

              {ageDashaResult && (

                <div className="mt-5 space-y-3">

                  <div className="text-xs uppercase tracking-widest text-amber-500 font-semibold">

                    Active Dasha Window for Age{" "}

                    {
                      ageDashaResult.age
                    }

                    {" · "}

                    {
                      ageDashaResult.startDateStr
                    }

                    {" — "}

                    {
                      ageDashaResult.endDateStr
                    }

                  </div>

                  {ageDashaResult.matches.map(
                    (
                      item,
                      idx
                    ) => (

                      <div
                        key={
                          idx
                        }
                        className="bg-stone-950 border border-stone-800 rounded-xl p-4"
                      >

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="text-stone-500 text-xs">
                            Mahadasha
                          </span>

                          <span className="text-amber-400 font-semibold">
                            {
                              item.mahadasha
                            }
                          </span>

                          <ChevronRight className="w-4 h-4 text-stone-700" />

                          <span className="text-stone-500 text-xs">
                            Antardasha
                          </span>

                          <span className="text-amber-400 font-semibold">
                            {
                              item.antardasha
                            }
                          </span>

                        </div>

                        <p className="font-mono text-xs text-stone-500 mt-2">

                          {
                            item.start
                          }

                          {" — "}

                          {
                            item.end
                          }

                        </p>

                      </div>

                    )
                  )}

                </div>

              )}

              {ageDashaResult &&
                ageDashaResult.matches.length ===
                  0 && (

                  <div className="mt-4 p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-500">
                    No matching Antardasha was found for this age range.
                  </div>

                )}

              <div className="border-t border-stone-800 mt-7 pt-6">

                <div className="flex items-center gap-2 mb-4">

                  <ShieldCheck className="w-4 h-4 text-amber-500" />

                  <h3 className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
                    Planetary Maturity Ages
                  </h3>

                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">

                  {PLANET_MATURITY_AGES.map(
                    (
                      item
                    ) => (

                      <button
                        key={
                          item.planet
                        }
                        type="button"
                        onClick={() => {

                          setTargetAge(
                            item.age.toString()
                          );

                          handleCalculateAgeDasha(
                            item.age
                          );

                        }}
                        className="bg-stone-950 border border-stone-800 hover:border-amber-500/40 hover:bg-amber-500/5 rounded-xl p-3 text-center transition-all"
                      >

                        <div className="text-[10px] text-stone-500">
                          {
                            item.planet
                          }
                        </div>

                        <div className="text-sm font-bold text-amber-400 mt-1">
                          {
                            item.age
                          }
                          {" "}yrs
                        </div>

                      </button>

                    )
                  )}

                </div>

              </div>

            </div>

          </div>

        </div>
      );
    }

    // ========================================================
    // DEGREES
    // ========================================================

    if (
      panel === "degrees"
    ) {

      return (
        <div className="max-w-7xl mx-auto">

          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden">

            <div className="p-5 sm:p-7 border-b border-stone-800">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                <div>

                  <h2 className="text-lg font-semibold text-white">
                    Planetary Degrees &amp; Chara Karaka
                  </h2>

                  <p className="text-xs text-stone-500 mt-1">
                    Sidereal positions for Jaimini Chara Karaka analysis.
                  </p>

                </div>

                <div className="flex rounded-xl border border-stone-800 bg-stone-950 p-1">

                  <button
                    type="button"
                    onClick={() => {

                      setNodeType(
                        "mean"
                      );

                      void handleCalculate(
                        "mean"
                      );

                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-semibold transition-all",
                      nodeType ===
                        "mean"
                        ? "bg-stone-800 text-white"
                        : "text-stone-500"
                    )}
                  >
                    Mean Node
                  </button>

                  <button
                    type="button"
                    onClick={() => {

                      setNodeType(
                        "true"
                      );

                      void handleCalculate(
                        "true"
                      );

                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-semibold transition-all",
                      nodeType ===
                        "true"
                        ? "bg-amber-500 text-black"
                        : "text-stone-500"
                    )}
                  >
                    True Node
                  </button>

                </div>

              </div>

            </div>

            <div className="p-4 sm:p-6">

              <div className="overflow-x-auto rounded-xl border border-stone-800">

                <table className="w-full min-w-[700px] text-xs">

                  <thead>

                    <tr className="bg-stone-950 border-b border-stone-800">

                      <th className="text-left px-4 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Planet
                      </th>

                      <th className="text-left px-4 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Sidereal Longitude
                      </th>

                      <th className="text-left px-4 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Rashi
                      </th>

                      <th className="text-left px-4 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Degree in Sign
                      </th>

                      <th className="text-left px-4 py-3 text-[9px] uppercase tracking-widest text-stone-500">
                        Chara Karaka
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {result!.planetaryPositions.map(
                      (
                        planet
                      ) => {

                        const karaka =
                          result!.charaKarakas.find(
                            (
                              item
                            ) =>
                              item.planet ===
                              planet.planet
                          );

                        return (

                          <tr
                            key={
                              planet.planet
                            }
                            className="border-b border-stone-800/60"
                          >

                            <td className="px-4 py-4 text-white font-semibold">
                              {
                                planet.planet
                              }
                            </td>

                            <td className="px-4 py-4 font-mono text-stone-300">
                              {planet.siderealLongitude.toFixed(
                                4
                              )}
                              °
                            </td>

                            <td className="px-4 py-4 text-white font-semibold">
                              {getRashiNumber(
                                planet.sign
                              )}
                            </td>

                            <td className="px-4 py-4">

                              <div className="flex flex-col">

                                <span className="font-mono text-amber-400 font-semibold">
                                  {
                                    planet.formattedDegree
                                  }
                                </span>

                                <span className="text-[9px] text-stone-600">
                                  {planet.degreeInSign.toFixed(
                                    4
                                  )}
                                  °
                                </span>

                              </div>

                            </td>

                            <td className="px-4 py-4">

                              {karaka ? (

                                <div>

                                  <div className="text-amber-400 font-semibold">
                                    {
                                      karaka.karaka
                                    }
                                  </div>

                                  <div className="text-[9px] text-stone-600 mt-1">
                                    {
                                      karaka.formattedDegree
                                    }
                                  </div>

                                  {planet.planet ===
                                    "Rahu" && (

                                    <div className="text-[9px] text-stone-600">
                                      CK:{" "}
                                      {
                                        karaka.formattedEffectiveDegree
                                      }
                                    </div>

                                  )}

                                </div>

                              ) : planet.planet ===
                                "Ketu" ? (

                                <span className="text-[9px] text-stone-600">
                                  Not used in 8-Karaka
                                </span>

                              ) : null}

                            </td>

                          </tr>

                        );

                      }
                    )}

                  </tbody>

                </table>

              </div>

              <div className="border-t border-stone-800 mt-7 pt-6">

                <div className="flex items-center justify-between mb-4">

                  <div>

                    <h3 className="text-sm font-semibold text-white">
                      Chara Karaka Ranking
                    </h3>

                    <p className="text-[10px] text-stone-600 mt-1">
                      Highest value → lowest value
                    </p>

                  </div>

                  <span className="text-[9px] uppercase tracking-widest text-amber-500 font-semibold">
                    8 Karakas
                  </span>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                  {result!.charaKarakas.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={
                          item.karaka
                        }
                        className={cn(
                          "bg-stone-950 border rounded-2xl p-4",
                          index === 0
                            ? "border-amber-500/40 bg-amber-500/[0.03]"
                            : "border-stone-800"
                        )}
                      >

                        <div className="flex items-center justify-between">

                          <span className="text-[9px] text-stone-600">
                            #
                            {index + 1}
                          </span>

                          {index ===
                            0 && (
                            <span className="text-[8px] uppercase tracking-widest text-amber-500 font-bold">
                              Highest
                            </span>
                          )}

                        </div>

                        <p className="text-[10px] text-stone-500 mt-3">
                          {
                            item.karaka
                          }
                        </p>

                        <p className="text-sm font-semibold text-white mt-1">
                          {
                            item.planet
                          }
                        </p>

                        <p className="font-mono text-amber-400 text-sm mt-2">
                          {
                            item.formattedDegree
                          }
                        </p>

                        {item.planet ===
                          "Rahu" && (
                          <p className="text-[9px] text-stone-600 mt-1">
                            CK:{" "}
                            {
                              item.formattedEffectiveDegree
                            }
                          </p>
                        )}

                        <p className="text-[9px] text-stone-600 mt-1">
                          Rashi{" "}
                          {
                            getRashiNumber(
                              item.sign
                            )
                          }
                        </p>

                      </div>

                    )
                  )}

                </div>

              </div>

              <div className="mt-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">

                <div className="flex items-start gap-3">

                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />

                  <p className="text-[10px] text-stone-500 leading-relaxed">

                    This implementation uses the 8-Karaka scheme:
                    Atmakaraka, Amatyakaraka, Bhratrikaraka,
                    Matrikaraka, Pitrikaraka, Putrakaraka,
                    Gnatikaraka and Darakaraka. Rahu is included
                    using its reverse degree. Ketu is not included.

                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>
      );
    }

    return null;
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="min-h-screen bg-[#0a0a0a] text-stone-200 font-sans selection:bg-amber-500/30">

      <div className="fixed inset-0 overflow-hidden pointer-events-none">

        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-amber-900/10 rounded-full blur-[120px]" />

        <div className="absolute top-1/2 -right-32 w-[450px] h-[450px] bg-stone-800/20 rounded-full blur-[120px]" />

      </div>

      <div className="relative">

        {/* ====================================================
            BEFORE CALCULATION
        ==================================================== */}

        {!result ? (

          <motion.main
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="min-h-screen flex items-center justify-center px-4 py-10"
          >

            <div className="w-full max-w-4xl">

              {/* HEADER */}

              <div className="text-center mb-8">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 border border-stone-800 mb-5">

                  <Sparkles className="w-4 h-4 text-amber-500" />

                  <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-semibold">
                    Professional Astrology Suite
                  </span>

                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-white">

                  Vedic{" "}

                  <span className="text-amber-500">
                    Vimshottari
                  </span>

                </h1>

                <p className="text-stone-500 mt-3 text-sm sm:text-base">
                  High-precision Dasha calculations.
                  Accurate to the second.
                </p>

                <p className="text-stone-600 text-xs mt-1">
                  by Ritik Verma
                </p>

              </div>

              {/* BIRTH DETAILS */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="bg-stone-900/70 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden"
              >

                <div className="px-5 sm:px-8 py-5 border-b border-stone-800">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">

                      <Calculator className="w-5 h-5 text-amber-500" />

                    </div>

                    <div>

                      <h2 className="text-lg font-semibold text-white">
                        Birth Details
                      </h2>

                      <p className="text-xs text-stone-500 mt-0.5">
                        Enter birth information to generate the astrology workspace.
                      </p>

                    </div>

                  </div>

                </div>

                <div className="p-5 sm:p-8">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* DATE */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Date of Birth
                      </label>

                      <div className="relative">

                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />

                        <input
                          type="date"
                          value={
                            dob
                          }
                          onChange={(
                            e
                          ) =>
                            setDob(
                              e.target.value
                            )
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />

                      </div>

                    </div>

                    {/* TIME */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Time of Birth
                      </label>

                      <div className="relative">

                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />

                        <input
                          type="time"
                          step="1"
                          value={
                            tob
                          }
                          onChange={(
                            e
                          ) =>
                            setTob(
                              e.target.value
                            )
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />

                      </div>

                    </div>

                    {/* TIMEZONE */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Timezone
                      </label>

                      <select
                        value={
                          timezone
                        }
                        onChange={(
                          e
                        ) =>
                          setTimezone(
                            e.target.value
                          )
                        }
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500/50 appearance-none"
                      >

                        <option value="Asia/Kolkata">
                          India (IST)
                        </option>

                        <option value="America/New_York">
                          New York (EST/EDT)
                        </option>

                        <option value="Europe/London">
                          London (GMT/BST)
                        </option>

                        <option value="UTC">
                          UTC
                        </option>

                      </select>

                    </div>

                    {/* LOCATION */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Location
                      </label>

                      <div className="relative">

                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />

                        <input
                          type="text"
                          value={
                            location
                          }
                          onChange={(
                            e
                          ) =>
                            setLocation(
                              e.target.value
                            )
                          }
                          placeholder="City, Country"
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:outline-none focus:border-amber-500/50"
                        />

                      </div>

                    </div>

                    {/* LATITUDE */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Latitude
                      </label>

                      <input
                        type="number"
                        step="0.0001"
                        value={
                          latitude
                        }
                        onChange={(
                          e
                        ) =>
                          setLatitude(
                            e.target.value
                          )
                        }
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500/50"
                      />

                    </div>

                    {/* LONGITUDE */}

                    <div className="space-y-2">

                      <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">
                        Longitude
                      </label>

                      <input
                        type="number"
                        step="0.0001"
                        value={
                          longitude
                        }
                        onChange={(
                          e
                        ) =>
                          setLongitude(
                            e.target.value
                          )
                        }
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500/50"
                      />

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7">

                    <button
                      type="button"
                      onClick={
                        handlePrashanKundli
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl py-3.5 bg-stone-800 hover:bg-stone-700 border border-amber-500/30 text-amber-400 font-bold transition-all flex items-center justify-center gap-2"
                    >

                      <Clock className="w-4 h-4" />

                      Prashan Kundli

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCalculate()
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                    >

                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Calculator className="w-4 h-4" />
                      )}

                      {loading
                        ? "Generating Workspace..."
                        : "Generate Workspace"}

                    </button>

                  </div>

                  {/* ERROR */}

                  {error && (

                    <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">

                      <AlertCircle className="w-5 h-5 shrink-0" />

                      <p className="text-sm">
                        {
                          error
                        }
                      </p>

                    </div>

                  )}

                </div>

              </motion.div>

              {/* AYANAMSA */}

              <div className="mt-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">

                <div className="flex items-center gap-2 mb-2">

                  <Info className="w-4 h-4 text-amber-500" />

                  <span className="text-xs uppercase tracking-widest font-semibold text-amber-500">
                    Ayanamsa
                  </span>

                </div>

                <p className="text-xs text-stone-500 leading-relaxed">

                  Calculations use the{" "}

                  <strong className="text-stone-300">
                    Lahiri (Chitra Paksha)
                  </strong>{" "}

                  Ayanamsa as standard.

                </p>

              </div>

            </div>

          </motion.main>

        ) : (

          /* =================================================
             WORKSPACE
          ================================================= */

          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="min-h-screen"
          >

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-stone-800">

              <div className="max-w-[1600px] mx-auto px-3 sm:px-5">

                <div className="h-16 flex items-center justify-between gap-3">

                  {/* BRAND */}


                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">

  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">

    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />

  </div>

  <div className="min-w-0">

    <h1 className="text-[12px] sm:text-sm font-semibold text-white whitespace-nowrap leading-tight">

      Vedic{" "}

      <span className="text-amber-500">
        Vimshottari
      </span>

    </h1>

    <p className="text-[7px] sm:text-[9px] uppercase tracking-[0.12em] sm:tracking-widest text-stone-600 whitespace-nowrap mt-0.5">
      Astrology Workspace
    </p>

  </div>

</div>

                  {/* BUTTONS */}

                  <div className="flex items-center gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setSplitScreen(
                          !splitScreen
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                        splitScreen
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                      )}
                    >

                      <Columns2 className="w-4 h-4" />

                      <span className="hidden sm:inline">
                        {splitScreen
                          ? "Single Screen"
                          : "Split Screen"}
                      </span>

                    </button>

                    <button
                      type="button"
                      onClick={
                        exportPDF
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
                    >

                      <Download className="w-4 h-4" />

                      <span className="hidden sm:inline">
                        PDF
                      </span>

                    </button>

                  </div>

                </div>

                {/* NAV */}

                {!splitScreen && (

                  <div className="overflow-x-auto border-t border-stone-800/70">

                    <div className="flex items-center gap-1 py-2 min-w-max">

                      {workspacePanels.map(
                        (
                          panel
                        ) => (

                          <button
                            key={
                              panel.id
                            }
                            type="button"
                            onClick={() =>
                              setActivePanel(
                                panel.id
                              )
                            }
                            className={cn(
                              "px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all",
                              activePanel ===
                                panel.id
                                ? "bg-amber-500 text-black"
                                : "text-stone-500 hover:bg-stone-900 hover:text-stone-200"
                            )}
                          >
                            {
                              panel.label
                            }
                          </button>

                        )
                      )}

                    </div>

                  </div>

                )}

              </div>

            </header>

            {/* =================================================
                CONTENT
            ================================================= */}

            <main className="max-w-[1600px] mx-auto px-3 sm:px-5 py-5 sm:py-7">

              {!splitScreen ? (

                <motion.div
                  key={
                    activePanel
                  }
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="min-h-[calc(100vh-130px)]"
                >

                  {renderWorkspacePanel(
                    activePanel
                  )}

                </motion.div>

              ) : (

                <div className="space-y-4">

                  {/* SPLIT SELECTORS */}

                  <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-4">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                      <div>

                        <label className="block text-[9px] uppercase tracking-widest text-stone-600 mb-1.5">
                          Left Panel
                        </label>

                        <select
                          value={
                            splitLeftPanel
                          }
                          onChange={(
                            e
                          ) =>
                            setSplitLeftPanel(
                              e.target.value as WorkspacePanel
                            )
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
                        >

                          {workspacePanels.map(
                            (
                              panel
                            ) => (

                              <option
                                key={
                                  panel.id
                                }
                                value={
                                  panel.id
                                }
                              >
                                {
                                  panel.label
                                }
                              </option>

                            )
                          )}

                        </select>

                      </div>

                      <div>

                        <label className="block text-[9px] uppercase tracking-widest text-stone-600 mb-1.5">
                          Right Panel
                        </label>

                        <select
                          value={
                            splitRightPanel
                          }
                          onChange={(
                            e
                          ) =>
                            setSplitRightPanel(
                              e.target.value as WorkspacePanel
                            )
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
                        >

                          {workspacePanels.map(
                            (
                              panel
                            ) => (

                              <option
                                key={
                                  panel.id
                                }
                                value={
                                  panel.id
                                }
                              >
                                {
                                  panel.label
                                }
                              </option>

                            )
                          )}

                        </select>

                      </div>

                    </div>

                  </div>

                  {/* SPLIT CONTENT */}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

                    {/* LEFT */}

                    <div className="bg-stone-950/40 border border-stone-800 rounded-2xl overflow-hidden">

                      <div className="px-4 py-3 border-b border-stone-800">

                        <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">

                          {
                            workspacePanels.find(
                              (
                                item
                              ) =>
                                item.id ===
                                splitLeftPanel
                            )?.label
                          }

                        </span>

                      </div>

                      <div className="p-3 max-h-[calc(100vh-165px)] overflow-y-auto custom-scrollbar">

                        {renderWorkspacePanel(
                          splitLeftPanel
                        )}

                      </div>

                    </div>

                    {/* RIGHT */}

                    <div className="bg-stone-950/40 border border-stone-800 rounded-2xl overflow-hidden">

                      <div className="px-4 py-3 border-b border-stone-800">

                        <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">

                          {
                            workspacePanels.find(
                              (
                                item
                              ) =>
                                item.id ===
                                splitRightPanel
                            )?.label
                          }

                        </span>

                      </div>

                      <div className="p-3 max-h-[calc(100vh-165px)] overflow-y-auto custom-scrollbar">

                        {renderWorkspacePanel(
                          splitRightPanel
                        )}

                      </div>

                    </div>

                  </div>

                </div>

              )}

            </main>

          </motion.div>

        )}

      </div>

            {/* ========================================================
          FOOTER
      ======================================================== */}

      <footer className="relative mt-16 sm:mt-24 py-12 sm:py-16 bg-gradient-to-b from-transparent to-stone-950 border-t border-amber-500/10">

        <div className="max-w-6xl mx-auto px-4 text-center">

          <div className="inline-block px-4 py-1 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs uppercase tracking-widest">
            Professional Astrology Engine
          </div>

          <h3 className="text-xl text-white font-light mb-3">

            Vedic
            <span className="text-amber-500">
              Vimshottari
            </span>

          </h3>

          <p className="text-stone-400 text-sm">

            © 2026 Vedic Vimshottari™.
            Developed by{" "}

            <span className="text-white font-medium">
              Ritik Verma
            </span>

            . All rights reserved.

          </p>

          <p className="text-stone-600 text-xs mt-3">
            High-precision Lahiri Ayanamsa based Dasha Calculations.
          </p>

        </div>

      </footer>

    </div>
  );
}
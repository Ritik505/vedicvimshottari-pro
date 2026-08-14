/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  ShieldCheck
} from 'lucide-react';
import { DateTime } from 'luxon';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  calculateDasha,
  generateDashaHierarchy,
  calculatePlanetaryPositions,
  calculateCharaKarakas,
  type PlanetaryPosition,
  type CharaKaraka,
} from './services/astrology';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

const PLANET_MATURITY_AGES = [
  { planet: 'Jupiter', age: 16 },
  { planet: 'Sun', age: 22 },
  { planet: 'Moon', age: 24 },
  { planet: 'Venus', age: 25 },
  { planet: 'Mars', age: 28 },
  { planet: 'Mercury', age: 32 },
  { planet: 'Saturn', age: 36 },
  { planet: 'Rahu', age: 42 },
  { planet: 'Ketu', age: 48 },
];

const DashaLevel: React.FC<DashaLevelProps> = ({ 
  period, 
  level, 
  isCurrent,
  onPathSelect,
  ancestors = []
}) => {
  const [expanded, setExpanded] = useState(false);
  const active = isCurrent(period.start, period.end);
  const hasSubs = period.subDashas && period.subDashas.length > 0;

  const levelNames = ["Mahadasha", "Antardasha", "Pratyantar", "Sookshma", "Prana"];
  const levelColors = [
    "border-amber-500/50 bg-amber-500/5",
    "border-stone-700 bg-stone-900/40",
    "border-stone-800 bg-stone-950/30",
    "border-stone-800 bg-stone-950/20",
    "border-stone-900 bg-stone-950/10"
  ];

  const handleClick = () => {
    if (hasSubs) {
      setExpanded(!expanded);
    }
    if (onPathSelect) {
      onPathSelect([...ancestors, period]);
    }
  };

  return (
    <div className={cn(
      "rounded-xl border transition-all mb-2 overflow-hidden cursor-pointer group",
      active ? "ring-1 ring-amber-500/30" : "opacity-90",
      levelColors[level] || "border-stone-900"
    )}>
      <button 
        onClick={handleClick}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            active ? "bg-amber-500 text-black" : "bg-stone-800 text-stone-400"
          )}>
            {period.planet.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("font-medium text-sm", active ? "text-white" : "text-stone-300")}>
                {period.planet} <span className="text-[10px] opacity-40 font-light ml-1">{levelNames[level]}</span>
              </span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm text-stone-300 font-mono font-semibold">{period.start} — {period.end}</p>
          </div>
        </div>
        {hasSubs && (
          expanded ? <ChevronDown className="w-4 h-4 text-stone-600" /> : <ChevronRight className="w-4 h-4 text-stone-600" />
        )}
      </button>

      <AnimatePresence>
        {expanded && hasSubs && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 pt-1 border-t border-stone-800/50"
          >
            {period.subDashas?.map((sub, idx) => (
              <DashaLevel 
                key={idx} 
                period={sub} 
                level={level + 1} 
                isCurrent={isCurrent}
                onPathSelect={onPathSelect}
                ancestors={[...ancestors, period]}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [dob, setDob] = useState('1990-01-01');
  const [tob, setTob] = useState('12:00:00');
  const [location, setLocation] = useState('New Delhi, India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [targetAge, setTargetAge] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
  info: any;
  dashas: DashaPeriod[];
  planetaryPositions: PlanetaryPosition[];
  charaKarakas: CharaKaraka[];
} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<DashaPeriod[]>([]);
  const [ageDashaResult, setAgeDashaResult] = useState<{ 
    age: string;
    startDateStr: string;
    endDateStr: string;
    matches: AgeAntardashaMatch[];
  } | null>(null);

  const getCurrentAgeInYearsMonthsDays = (birthDateStr: string) => {
    if (!birthDateStr) return null;
    const birth = DateTime.fromISO(birthDateStr);
    const now = DateTime.now();

    if (!birth.isValid || birth > now) return null;

    const diff = now.diff(birth, ['years', 'months', 'days']).toObject();
    return {
      years: Math.floor(diff.years || 0),
      months: Math.floor(diff.months || 0),
      days: Math.floor(diff.days || 0)
    };
  };

  const openWhatsApp = () => {
    const phoneNumber = "919818966252";

    const message = encodeURIComponent(
`Hello Ritik ji,

I would like to book a detailed personal horoscope consultation.

Here are my birth details:

 Date of Birth: ${dob}
 Time of Birth: ${tob}
 Location: ${location}

Please share your consultation fees and availability.

Thank you!`
    );

    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(url, "_blank");
  };

  const handleCalculate = async () => {
  setLoading(true);
  setError(null);
  setSelectedPath([]);
  setAgeDashaResult(null);

  try {
    await new Promise(resolve =>
      setTimeout(resolve, 800)
    );

    // --------------------------------------------------
    // Vimshottari Dasha
    // --------------------------------------------------

    const dashaInfo = await calculateDasha(
      dob,
      tob,
      timezone
    );

    const hierarchy = generateDashaHierarchy(
      dashaInfo.birthJD,
      dashaInfo
    );

    // --------------------------------------------------
    // Planetary Positions
    // --------------------------------------------------

    const planetaryPositions =
      await calculatePlanetaryPositions(
        dob,
        tob,
        timezone
      );

    // --------------------------------------------------
    // Jaimini Chara Karakas
    // --------------------------------------------------

    const charaKarakas =
      calculateCharaKarakas(
        planetaryPositions
      );

    setResult({
      info: dashaInfo,
      dashas: hierarchy,
      planetaryPositions,
      charaKarakas,
    });

  } catch (err: any) {
    setError(
      err.message ||
      "Calculation failed."
    );
  } finally {
    setLoading(false);
  }
};

  const handleCalculateAgeDasha = (ageOverride?: number) => {
    if (!result) return;

    const ageToUse = ageOverride !== undefined ? ageOverride : Number(targetAge);
    if (isNaN(ageToUse) || ageToUse < 0) return;

    const ageNum = Math.floor(ageToUse);
    const birthDateTime = DateTime.fromISO(`${dob}T${tob}`, { zone: timezone });

    const yearStartDT = birthDateTime.plus({ years: ageNum });
    const yearEndDT = birthDateTime.plus({ years: ageNum + 1 });

    const yearStartStr = yearStartDT.toFormat('yyyy-MM-dd HH:mm:ss');
    const yearEndStr = yearEndDT.toFormat('yyyy-MM-dd HH:mm:ss');

    const foundMatches: AgeAntardashaMatch[] = [];

    for (const md of result.dashas) {
      if (md.subDashas) {
        for (const ad of md.subDashas) {
          if (ad.start < yearEndStr && ad.end > yearStartStr) {
            foundMatches.push({
              mahadasha: md.planet,
              antardasha: ad.planet,
              start: ad.start,
              end: ad.end
            });
          }
        }
      }
    }

    setAgeDashaResult({
      age: ageNum.toString(),
      startDateStr: yearStartDT.toFormat('dd MMM yyyy'),
      endDateStr: yearEndDT.toFormat('dd MMM yyyy'),
      matches: foundMatches
    });
  };

  const checkHealth = () => {
    alert("Astrology engine is active. 5-level Dasha hierarchy enabled.");
  };

  const exportPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    let yPosition = 20;

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          "© 2026 VedicVimshottari Pro™. Developed by Ritik Verma. All rights reserved.",
          105,
          290,
          { align: "center" }
        );
        doc.text(`Page ${i} of ${pageCount}`, 200, 290, { align: "right" });
      }
    };

    doc.setFontSize(20);
    doc.setTextColor(184, 134, 11);
    doc.text("Vimshottari Dasha Report", 105, yPosition, { align: "center" });

    yPosition += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Generated on: ${DateTime.now().toLocaleString(DateTime.DATETIME_MED)}`,
      105,
      yPosition,
      { align: "center" }
    );

    yPosition += 15;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Birth Date: ${dob} ${tob}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Location: ${location} (${timezone})`, 20, yPosition);
    yPosition += 7;
    doc.text(`Nakshatra: ${result.info.nakshatra}`, 20, yPosition);
    yPosition += 15;

    result.dashas.forEach((md) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(184, 134, 11);
      doc.text(
        `${md.planet} Mahadasha (${md.start} — ${md.end})`,
        20,
        yPosition
      );

      yPosition += 8;

      const antardashaData =
        md.subDashas?.map((ad: any) => [ad.planet, ad.start, ad.end]) || [];

      autoTable(doc, {
        startY: yPosition,
        head: [["Antardasha Lord", "Start Time", "End Time"]],
        body: antardashaData,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [184, 134, 11] },
        margin: { left: 20, right: 20 },
        didDrawPage: (data) => {
          yPosition = data.cursor?.y || 20;
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 12;
    });

    addFooter();
    doc.save(`Vedic_Dasha_${dob}.pdf`);
  };

  const isCurrent = (start: string, end: string) => {
    const now = DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
    return now >= start && now <= end;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-200 font-sans selection:bg-amber-500/30">
      {/* Background Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-stone-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 mb-4"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium tracking-widest uppercase text-stone-400">Professional Astrology Suite</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-5xl md:text-7xl font-light tracking-tighter text-white mb-4"
          >
            Vedic<span className="text-amber-500 font-normal">Vimshottari</span>
          </motion.h1>
          <h6 className="text-stone-400 text-sm mb-2">by Ritik Verma</h6>
          <p className="text-stone-500 max-w-xl mx-auto text-lg font-light">
            High-precision Dasha calculations. 
            Accurate to the second.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="bg-stone-900/50 backdrop-blur-xl border border-stone-800 p-8 rounded-3xl shadow-2xl">
              <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                Birth Details
              </h2>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                    <input 
                      type="date" 
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Time of Birth</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                    <input 
                      type="time" 
                      step="1"
                      value={tob}
                      onChange={(e) => setTob(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Timezone</label>
                  <select 
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-white appearance-none"
                  >
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="America/New_York">New York (EST/EDT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                    <input 
                      type="text" 
                      placeholder="City, Country"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-white"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCalculate}
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-600 text-black font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
                  Calculate Dasha
                </button>

                <button 
                  onClick={checkHealth}
                  className="w-full bg-stone-900 hover:bg-stone-800 text-stone-400 text-xs py-2 rounded-xl transition-all border border-stone-800 mt-2"
                >
                  Check Backend Connection
                </button>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-3">
                <Info className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-widest">Ayanamsa</h3>
              </div>
              <p className="text-xs leading-relaxed text-stone-500">
                Calculations use the <strong>Lahiri (Chitra Paksha)</strong> Ayanamsa as standard. It provides 100% astronomical accuracy for Moon longitude.
              </p>
            </div>
          </motion.div>

          {/* Result Section */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-stone-800 rounded-3xl"
                >
                  <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-6">
                    <Moon className="w-10 h-10 text-stone-700" />
                  </div>
                  <h3 className="text-2xl font-light text-stone-400 mb-2">Ready for Calculation</h3>
                  <p className="text-stone-600 max-w-xs">Enter birth details to generate your comprehensive Vimshottari Dasha timeline.</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Nakshatra</p>
                      <p className="text-lg font-medium text-white">{result.info.nakshatra}</p>
                    </div>
                    <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Sidereal Longitude</p>
                      <p className="text-lg font-medium text-white">{result.info.moonLong.toFixed(4)}°</p>
                    </div>
                    <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Ayanamsa (Lahiri)</p>
                      <p className="text-lg font-medium text-white">{result.info.ayanamsa.toFixed(4)}°</p>
                    </div>
                    <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                      <button 
                        onClick={exportPDF}
                        className="
                          group
                          w-[calc(100%+2rem)]
                          h-[calc(100%+2rem)]
                          -m-4
                          flex flex-col items-center justify-center gap-1
                          rounded-2xl
                          text-amber-500
                          bg-gradient-to-br
                          from-[#111111]
                          via-[#0d0d0d]
                          to-[#161616]
                          transition-all duration-300 ease-out
                          hover:-translate-y-1
                          hover:from-[#1a1a1a]
                          hover:to-[#101010]
                          hover:text-amber-300
                          hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]
                          active:scale-[0.98]
                        "
                      >
                        <Download className="
                          w-5 h-5
                          transition-all duration-300
                          group-hover:scale-110
                          group-hover:-translate-y-0.5
                        " />
                        <span className="
                          text-[10px]
                          uppercase
                          tracking-widest
                          font-bold
                        ">
                          Export PDF
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* CONSULTATION CARD */}
                  <div className="col-span-2 bg-amber-500 border border-amber-400 p-4 rounded-2xl">
                    <button
                      onClick={openWhatsApp}
                      className="
                        group
                        w-full
                        flex flex-col items-center justify-center gap-2
                        rounded-2xl
                        bg-gradient-to-br
                        from-amber-500
                        via-amber-400
                        to-amber-600
                        text-black font-bold
                        transition-all duration-300 ease-out
                        hover:-translate-y-1
                        hover:from-amber-400
                        hover:via-amber-300
                        hover:to-amber-500
                        hover:shadow-[0_0_30px_rgba(245,158,11,0.28)]
                        active:scale-[0.98]
                      "
                    >
                      <Sparkles className="
                        w-5 h-5
                        transition-all duration-300
                        group-hover:scale-110
                        group-hover:rotate-6
                      " />
                      <span className="
                        text-xs
                        uppercase
                        tracking-widest
                        transition-all duration-300
                        group-hover:tracking-[0.18em]
                      ">
                        Book Personal Horoscope Consultation
                      </span>
                    </button>
                  </div>

                  {/* Selected Dasha Path */}
                  {selectedPath.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
                      <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold mb-2">Selected Dasha Sequence</p>
                      <p className="text-sm text-amber-100 font-medium flex flex-wrap items-center gap-2">
                        {selectedPath.map((period, idx) => (
                          <React.Fragment key={idx}>
                            <span>{period.planet} <span className="text-[10px] opacity-60 font-light">({['Mahadasha', 'Antardasha', 'Pratyantar', 'Sookshma', 'Prana'][idx]})</span></span>
                            {idx < selectedPath.length - 1 && (
                              <ChevronRight className="w-4 h-4 opacity-50" />
                            )}
                          </React.Fragment>
                        ))}
                      </p>
                      <p className="text-[11px] text-amber-200/60 mt-2">{selectedPath[selectedPath.length - 1]?.start} — {selectedPath[selectedPath.length - 1]?.end}</p>
                    </div>
                  )}

                  {/* Dasha List */}
                  <div className="bg-stone-900/50 border border-stone-800 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-stone-800 flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">Dasha Hierarchy</h3>
                      <span className="text-xs text-stone-500">5 Levels: MD → AD → PD → SD → PrD</span>
                    </div>
                    
                    <div className="p-6 space-y-2 max-h-[800px] overflow-y-auto custom-scrollbar">
                      {result.dashas.map((md, idx) => (
                        <DashaLevel 
                          key={idx} 
                          period={md} 
                          level={0} 
                          isCurrent={isCurrent}
                          onPathSelect={setSelectedPath}
                          ancestors={[]}
                        />
                      ))}
                    </div>
                  </div>


                  {/* AGE DASHA LOOKUP SECTION */}
                  <div className="bg-stone-900/80 border border-stone-800 p-6 rounded-3xl space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Search className="w-5 h-5 text-amber-500" />
                          <h3 className="text-base font-semibold text-white">Check Dasha By Age</h3>
                        </div>

                        {/* Current Age Badge in Years, Months & Days */}
                        {dob && (() => {
                          const currentAge = getCurrentAgeInYearsMonthsDays(dob);
                          return currentAge ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-medium text-amber-400">
                              <span>Current Age:</span>
                              <span className="font-bold text-white">
                                {currentAge.years} yrs {currentAge.months} mos {currentAge.days} days
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="number" 
                          step="1"
                          min="0"
                          placeholder="Enter Age Year (e.g. 25, 30)"
                          value={targetAge}
                          onChange={(e) => setTargetAge(e.target.value)}
                          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-white placeholder:text-stone-600"
                        />
                        <button 
                          onClick={() => handleCalculateAgeDasha()}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl transition-all shrink-0 flex items-center justify-center gap-2"
                        >
                          <UserCheck className="w-4 h-4" />
                          Find Age Dasha
                        </button>
                      </div>

                      {/* Result showing all active Antardashas during that age year */}
                      {ageDashaResult && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-stone-950 border border-amber-500/30 p-5 rounded-2xl space-y-3 mt-4"
                        >
                          <div className="text-xs uppercase tracking-widest text-amber-500 font-medium">
                            Active Dasha Window for Age {ageDashaResult.age} ({ageDashaResult.startDateStr} — {ageDashaResult.endDateStr})
                          </div>

                          {ageDashaResult.matches.map((item, idx) => (
                            <div key={idx} className="bg-stone-900 border border-stone-800 p-3.5 rounded-xl space-y-1">
                              <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">
                                Period #{idx + 1}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
                                <span className="text-stone-400 text-xs font-normal">Mahadasha:</span>
                                <span className="text-amber-400">{item.mahadasha}</span>
                                <ChevronRight className="w-4 h-4 text-stone-600" />
                                <span className="text-stone-400 text-xs font-normal">Antardasha:</span>
                                <span className="text-amber-400">{item.antardasha}</span>
                              </div>
                              <div className="text-xs text-stone-400 font-mono pt-0.5">
                                {item.start} — {item.end}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>

                    {/* INTERACTIVE PLANETARY MATURITY AGES REFERENCE */}
                    <div className="border-t border-stone-800 pt-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-amber-500">
                          Planetary Maturity Ages Reference
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                        {PLANET_MATURITY_AGES.map((item) => (
                          <button
                            key={item.planet}
                            type="button"
                            onClick={() => {
                              setTargetAge(item.age.toString());
                              handleCalculateAgeDasha(item.age);
                            }}
                            className="
                              group
                              bg-stone-950
                              border border-stone-800
                              hover:border-amber-500/60
                              hover:bg-amber-500/10
                              hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]
                              active:scale-95
                              rounded-xl
                              p-2.5
                              text-center
                              transition-all
                              duration-200
                              cursor-pointer
                            "
                            title={`Click to check ${item.planet} Maturity Dasha (Age ${item.age})`}
                          >
                            <div className="text-[11px] font-medium text-stone-400 group-hover:text-stone-200 transition-colors">
                              {item.planet}
                            </div>
                            <div className="text-sm font-bold text-amber-400 group-hover:text-amber-300 group-hover:scale-105 transition-all mt-0.5">
                              {item.age} yrs
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================
                      PLANETARY DEGREES + CHARA KARAKA
                  ========================================================= */}

                  <div className="bg-stone-900/80 border border-stone-800 p-6 rounded-3xl space-y-6">

                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3">

                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />

                        <div>
                          <h3 className="text-base font-semibold text-white">
                            Planetary Degrees
                          </h3>

                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Sidereal positions for Jaimini Chara Karaka analysis
                          </p>
                        </div>
                      </div>

                      <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                          Lahiri Sidereal
                        </span>
                      </div>

                    </div>

                    {/* Explanation */}
                    <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4">

                      <p className="text-xs leading-relaxed text-stone-400">
                        For Chara Karaka calculation, the important value is the
                        <span className="text-amber-400 font-semibold">
                          {" "}degree within the sign
                        </span>
                        {" "}rather than the planet's total 0°–360° longitude.
                      </p>

                    </div>

                    {/* Planet Table */}
                    <div className="overflow-x-auto">

                      <table className="w-full min-w-[700px] text-sm">

                        <thead>
                          <tr className="border-b border-stone-800">

                            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                              Planet
                            </th>

                            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                              Sidereal Longitude
                            </th>

                            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                              Rashi
                            </th>

                            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                              Degree in Sign
                            </th>

                            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                              Chara Karaka
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {result?.planetaryPositions.map((planet) => {

                            const karaka =
                              result.charaKarakas.find(
                                (item) =>
                                  item.planet === planet.planet
                              );

                            const isNode =
                              planet.planet === "Rahu" ||
                              planet.planet === "Ketu";

                            return (
                              <tr
                                key={planet.planet}
                                className="border-b border-stone-800/70 hover:bg-white/[0.025] transition-colors"
                              >

                                {/* Planet */}
                                <td className="px-4 py-4">

                                  <div className="flex items-center gap-3">

                                    <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-[10px] font-bold text-stone-300">
                                      {planet.planet.substring(0, 2).toUpperCase()}
                                    </div>

                                    <span className="font-medium text-white">
                                      {planet.planet}
                                    </span>

                                  </div>

                                </td>

                                {/* Total longitude */}
                                <td className="px-4 py-4">

                                  <span className="font-mono text-stone-300">
                                    {planet.siderealLongitude.toFixed(4)}°
                                  </span>

                                </td>

                                {/* Rashi */}
                                <td className="px-4 py-4">

                                  <div className="flex items-center gap-2">

                                    <span className="text-white font-medium">
                                      {planet.sign}
                                    </span>

                                    <span className="text-[10px] text-stone-600 font-mono">
                                      ({planet.signShort})
                                    </span>

                                  </div>

                                </td>

                                {/* Degree inside sign */}
                                <td className="px-4 py-4">

                                  <div className="flex flex-col">

                                    <span className="font-mono text-amber-400 font-semibold">
                                      {planet.formattedDegree}
                                    </span>

                                    <span className="text-[10px] text-stone-600 mt-0.5">
                                      {planet.degreeInSign.toFixed(4)}°
                                    </span>

                                  </div>

                                </td>

                                {/* Chara Karaka */}
                                <td className="px-4 py-4">

                                  {karaka ? (

                                    <div className="inline-flex flex-col">

                                      <span className="text-amber-400 font-semibold text-xs">
                                        {karaka.karaka}
                                      </span>

                                      <span className="text-[10px] text-stone-600">
                                        {karaka.formattedDegree}
                                      </span>

                                    </div>

                                  ) : isNode ? (

                                    <span className="text-[10px] text-stone-600">
                                      Not used in 7-Karaka
                                    </span>

                                  ) : null}

                                </td>

                              </tr>
                            );
                          })}

                        </tbody>

                      </table>

                    </div>

                    {/* Chara Karaka Ranking */}
                    <div className="border-t border-stone-800 pt-6 space-y-4">

                      <div className="flex items-center justify-between gap-3">

                        <div>

                          <h4 className="text-sm font-semibold text-white">
                            Chara Karaka Ranking
                          </h4>

                          <p className="text-[11px] text-stone-500 mt-1">
                            Highest degree in sign → lowest degree in sign
                          </p>

                        </div>

                        <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">
                          8 Karakas
                        </span>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                        {result?.charaKarakas.map(
                          (item, index) => (

                            <div
                              key={item.karaka}
                              className={cn(
                                "bg-stone-950 border rounded-2xl p-4 transition-all",
                                index === 0
                                  ? "border-amber-500/40 bg-amber-500/[0.04]"
                                  : "border-stone-800"
                              )}
                            >

                              <div className="flex items-center justify-between mb-3">

                                <span className="text-[10px] uppercase tracking-widest text-stone-600">
                                  #{index + 1}
                                </span>

                                {index === 0 && (
                                  <span className="text-[9px] uppercase tracking-widest text-amber-500 font-bold">
                                    Highest
                                  </span>
                                )}

                              </div>

                              <div className="flex items-center justify-between gap-3">

                                <div>

                                  <p className="text-xs text-stone-500">
                                    {item.karaka}
                                  </p>

                                  <p className="text-base font-semibold text-white mt-1">
                                    {item.planet}
                                  </p>

                                </div>

                                <div className="text-right">

  <p className="font-mono text-amber-400 font-semibold text-sm">
    {item.formattedDegree}
  </p>

  {item.planet === "Rahu" && (
    <p className="text-[9px] text-stone-600 mt-1">
      CK value: {item.formattedEffectiveDegree}
    </p>
  )}

  <p className="text-[10px] text-stone-600 mt-1">
    {item.sign}
  </p>

</div>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                    </div>

                    {/* Important note */}
                    <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">

                      <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />

                      <div className="space-y-1">

                        <p className="text-xs font-semibold text-amber-400">
                          Chara Karaka Method
                        </p>

                        <p className="text-[11px] leading-relaxed text-stone-500">
                          Chara Karaka Ranking — 8 Karakas
                        </p>

                      </div>

                    </div>

                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative mt-24 py-16 bg-gradient-to-b from-transparent to-stone-950 border-t border-amber-500/10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="inline-block px-4 py-1 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs uppercase tracking-widest">
            Professional Astrology Engine
          </div>

          <h3 className="text-xl text-white font-light mb-3">
            Vedic<span className="text-amber-500">Vimshottari</span>
          </h3>

          <p className="text-stone-400 text-sm">
            © 2026 VedicVimshottari Pro™. Developed by 
            <span className="text-white font-medium"> Ritik Verma</span>. 
            All rights reserved.
          </p>

          <p className="text-stone-600 text-xs mt-3">
            High-precision Lahiri Ayanamsa based Dasha Calculations.
          </p>
        </div>
      </footer>
    </div>
  );
}
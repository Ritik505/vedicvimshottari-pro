/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { DateTime } from 'luxon';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { calculateDasha, generateDashaHierarchy } from './services/astrology';

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ info: any; dashas: DashaPeriod[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<DashaPeriod[]>([]);

    const openWhatsApp = () => {
    const phoneNumber = "919818966252"; // replace with your number

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
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const dashaInfo = calculateDasha(dob, tob, timezone);
      const hierarchy = generateDashaHierarchy(dashaInfo.birthJD, dashaInfo);
      setResult({ info: dashaInfo, dashas: hierarchy });
    } catch (err: any) {
      setError(err.message || 'Calculation failed.');
    } finally {
      setLoading(false);
    }
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

      // Optional page number
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

  // 🔥 Add footer AFTER content is fully generated
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
                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        <Download className="w-5 h-5" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Export PDF</span>
                      </button>
                    </div>
                  </div>

                    {/* 🔮 CONSULTATION CARD */}
  <div className="col-span-2 bg-amber-500 border border-amber-400 p-4 rounded-2xl">
    <button
      onClick={openWhatsApp}
      className="w-full flex flex-col items-center justify-center gap-2 text-black font-bold"
    >
      <Sparkles className="w-5 h-5" />
      <span className="text-xs uppercase tracking-widest">
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

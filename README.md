# Vedic Vimshottari Pro™
### High-Precision 5-Level Dasha Astrology Engine

Vedic Vimshottari Pro™ is a professional-grade astronomical and astrological engine engineered for high-precision Vimshottari Dasha calculations down to the second. Built on authentic Vedic astrology principles using the Lahiri (Chitra Paksha) Ayanamsa, this application provides multi-level Dasha hierarchies, age-based period lookups, interactive planetary maturity references, and consultation-ready PDF report generation.

---

## Key Features & Functionalities

- **5-Level Dasha Hierarchy Engine**
  Calculates the complete 120-year Vimshottari Dasha breakdown down to 5 distinct depth levels:
  1. Mahadasha
  2. Antardasha
  3. Pratyantar Dasha
  4. Sookshma Dasha
  5. Prana Dasha

- **Precision Astronomical Computation**
  - High-accuracy sidereal Moon longitude calculations.
  - Standardized Lahiri (Chitra Paksha) Ayanamsa integration.
  - Timezone-aware date and time processing via Luxon.
  - Balance of Dasha calculated precisely from birth Nakshatra position.

- **Check Dasha By Age (Age-Based Lookup)**
  - Enter any age (e.g., 25, 30, 40) to instantly query all active Mahadasha and Antardasha periods for that specific birth year window.
  - Displays accurate start and end date ranges corresponding to the selected age.

- **Interactive Planetary Maturity Ages Reference**
  - Features quick-reference cards for traditional Vedic planetary maturity ages:
    - Jupiter: 16 years
    - Sun: 22 years
    - Moon: 24 years
    - Venus: 25 years
    - Mars: 28 years
    - Mercury: 32 years
    - Saturn: 36 years
    - Rahu: 42 years
    - Ketu: 48 years
  - Fully interactive button interface: Clicking any maturity age card automatically populates the Age Dasha input and executes the calculation immediately.

- **Professional PDF Report Export**
  - Exports a clean, multi-page PDF report containing birth metadata, Nakshatra information, Moon position, and complete Mahadasha/Antardasha tables.
  - Uses `jspdf` and `jspdf-autotable` with built-in pagination, headers, and copyright footers.

- **Direct WhatsApp Consultation Integration**
  - Embedded booking link configured to launch WhatsApp directly with pre-formatted user birth parameters for personal consultation bookings.

- **Selected Dasha Sequence Inspector**
  - Interactive breadcrumb tracking showing the exact hierarchical path clicked by the user.

- **Modern SaaS-Grade Interface**
  - Built with TailwindCSS and Framer Motion (`motion/react`) for fluid animated transitions, interactive state feedback, dark mode design, and responsive layout scaling.

---

## Technology Stack

- **Frontend Framework:** React 18 / 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling & UI:** TailwindCSS, clsx, tailwind-merge
- **Animations:** Motion (`motion/react`)
- **Icons:** Lucide React
- **Date & Time Processing:** Luxon
- **PDF Generation:** jsPDF, jsPDF-AutoTable

---

## What This Application Calculates

The underlying engine executes astronomical computations using the following methodology:

1. **Birth Time Conversion:** Converts user-input date, time, location, and timezone into Julian Days (JD).
2. **Moon Position Calculation:** Computes sidereal Moon longitude adjusted for Lahiri Ayanamsa.
3. **Nakshatra & Balance Calculation:** Determines the birth Nakshatra, its ruling planet, and the remaining balance of the initial Mahadasha at the moment of birth.
4. **Sub-Period Proportions:** Recursively divides period durations based on the classical 120-year Vimshottari proportion rule across all 5 hierarchical levels.

---

## Project Structure

```text
src/
├── components/       # Reusable UI elements
├── services/
│   └── astrology.ts  # Astronomical & Dasha calculation engine
├── App.tsx           # Main application interface and state coordinator
├── main.tsx          # React application entry point
└── index.css         # Global styles and Tailwind configuration

```

---


## Calculation & Astronomical Standards

- **Ayanamsa:** Lahiri (Chitra Paksha) Ayanamsa used as standard.
- **Dasha System:** Traditional Vimshottari 120-year planetary cycle sequence (Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury).
- **Time Division:** Precise time-bound sub-period divisions mapped to exact calendar start and end dates.

---

## Developer & Copyright Information

**Developed By:** Ritik Verma  
*Astrology Software Developer*

**Copyright:** © 2026 VedicVimshottari Pro™. All rights reserved.

---

## License

This project is proprietary software. Unauthorized copying, distribution, or commercial exploitation of this source code is strictly prohibited.
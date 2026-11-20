# Building Layout Math: IES Photometric & IRC Framing Equations

Zero-dependency engineering reference formulas and JavaScript/Node.js solvers for residential and light-commercial **IES ceiling lighting layouts** and **2024 IRC deck, stair railing, and fence framing schedules**.

- **GitHub Pages Field Guide**: [https://kaiyilu.github.io/building-layout-math/](https://kaiyilu.github.io/building-layout-math/)
- **Run CLI Demo**: `node formulas.mjs` (Node.js 18+, zero external packages)

---

## 1. IES Zonal Cavity & Ceiling Fixture Grid Formulas

Basic square-footage lumen rules ignore ceiling cavity absorption, wall reflectance, and beam spread. The **Illuminating Engineering Society (IES)** Zonal Cavity method models effective workplane illuminance in foot-candles ($\text{fc}$) or lux:

### Room Cavity Ratio ($\text{RCR}$)
$$\text{RCR} = \frac{5 \cdot h_{\text{rc}} \cdot (L + W)}{L \cdot W}$$

Where:
- $L, W$ = Room length and width (ft)
- $h_{\text{rc}} = H_{\text{ceiling}} - H_{\text{workplane}}$ = Cavity mounting height above workplane (typically $2.5\text{ ft}$ desk/living, $3.0\text{ ft}$ kitchen island or garage workbench)

### Required Fixture Count ($N$)
$$N = \left\lceil \frac{E_{\text{target}} \cdot (L \cdot W)}{\Phi_{\text{lumens}} \cdot \text{CU} \cdot \text{LLF}} \right\rceil$$

- **Spacing-to-Mounting-Height ($\text{S/MH}$) Check**: Keep center-to-center pitch $S \le 1.2 \times h_{\text{rc}}$ for $90^\circ\text{–}110^\circ$ recessed wafers, or $S \le 1.4 \times h_{\text{rc}}$ for wide linear shop strips. Wall offset defaults to $S / 2$ to prevent dark drywall corners.
- **Ceiling Fan Strobe Clearance**: When a center paddle fan of diameter $D_{\text{fan}}$ is installed, maintain radial center-to-center clearance $r \ge \frac{D_{\text{fan}}}{2} + 24\text{ in}$ (ideally $30\text{ in}$) outside spinning blade tips to eliminate helicopter-style shadow strobing.
- **Overhead Garage Door Track Occlusion**: Roll-up sectional doors rest $8\text{–}10\text{ ft}$ into the bay when open; shift center-bay linear LED strips forward into the clear hood/workbench zone rather than centering over the open door panel.
- **High-Bay Beam Crossover ($16\text{–}40\text{ ft}$ Ceilings)**: Workplane cone diameter is $D_{\text{beam}} = 2 \cdot h_{\text{rc}} \cdot \tan(\theta_{\text{beam}} / 2)$. Above $24\text{ ft}$ mounting height, step down from $110^\circ\text{–}120^\circ$ wide UFO optics to $90^\circ$ medium or $60^\circ$ aisle-rack optics ($S \le 1.0 \times h_{\text{rc}}$) to maintain mid-bay beam crossover without upper-rack glare.

### Interactive 2D Photometric Blueprint Tools
- **[Lighting Layout Calculator](https://lightinglayoutcalculator.com/)** — Live 2D foot-candle heatmap, IES Zonal Cavity solver, and 1:1 SVG ceiling drill schedule.
- **[Garage Lighting Layout Calculator](https://lightinglayoutcalculator.com/garage-lighting-layout-calculator/)** — 4ft/8ft LED strip & hex pod planner with open roll-up door track occlusion checks.
- **[Recessed Lighting Layout Calculator](https://lightinglayoutcalculator.com/recessed-lighting-layout-calculator/)** — 4" & 6" canless wafer spacing, 16" OC joist bay alerts, and ceiling fan strobe buffer push.
- **[Commercial LED Lighting Layout Calculator](https://lightinglayoutcalculator.com/led-lighting-layout-calculator/)** — High-bay UFO & 2×4 troffer grid planner with uniformity ratio ($\text{Min/Avg}$) and $\text{W/ft}^2$ power density.
- **[High-Bay Lighting Calculator](https://lightinglayoutcalculator.com/high-bay-lighting-calculator/)** — 16–40 ft warehouse, pole barn & gym UFO high-bay beam crossover, aisle S/MH ratio, and circuit load planner.

---

## 2. 2024 IRC R312.1.3 Guardrail, Stair Spindle & R507.5 Framing Math

Under the **International Residential Code (IRC Section R312.1.3)**, open guardrail infill must prevent passage of a **4-inch ($102\text{ mm}$) sphere**, while the triangular throat formed by a stair tread, riser, and bottom rail must block a **6-inch ($152\text{ mm}$) sphere**.

### Equal-Gap Baluster Count & Zero-Drift Running Hook-Tape Marks
Given clear inside post-to-post span $L_{\text{clear}}$, actual picket thickness $w$ (e.g. $1.50\text{ in}$ for nominal $2\times 2$ wood, $0.75\text{ in}$ for round aluminum), and safe target max gap $g_{\max} \le 3.75\text{ in}$:

$$N = \left\lceil \frac{L_{\text{clear}} - g_{\max}}{w + g_{\max}} \right\rceil, \qquad g = \frac{L_{\text{clear}} - N \cdot w}{N + 1}$$

Leading-edge hook-tape mark for picket $i \in \{1 \dots N\}$ pulled continuously from inside left post ($0"$):

$$x_i = g + (i - 1)(g + w)$$

### Angled Stair Rake Cosine Projection
For unit step rise $R$ and tread run $T$, stair rake angle $\theta = \arctan(R / T)$:
- **Sloped Rail Footprint of Plumb Spindle**: $w_{\text{sloped}} = \dfrac{w}{\cos\theta}$
- **Sloped Bottom-Rail Tape Mark**: $s_i = \dfrac{x_i}{\cos\theta}$
- **Miter Saw Plumb Cut Bevel**: $\theta^\circ$ (complementary angle $90^\circ - \theta^\circ$)

### Structural Deck Beams (IRC R507.5) & Equalized Fence Bays
- **Max Beam Cantilever Overhang**: $L_{\text{cantilever}} \le \dfrac{L_{\text{span}}}{4}$ at each end of a drop beam.
- **Footing Soil Bearing Diameter**: $D_{\text{tube}} \ge 2 \sqrt{\dfrac{P_{\text{load}}}{\pi \cdot \text{PSF}_{\text{soil}}}}$ rounded up to standard SonoTube sizes ($12", 14", 16", 18", 20", 24"$).
- **Post-Hole Concrete Displacement**: Subtract embedded $4\times 4$ ($3.5"\times 3.5"$) or $6\times 6$ ($5.5"\times 5.5"$) post volume and $4"$ drainage gravel base before dividing net cubic feet by $0.375\text{ ft}^3$ ($50\text{-lb}$ fast-set) or $0.60\text{ ft}^3$ ($80\text{-lb}$ mix).

### Interactive 2D Carpentry & Framing Blueprint Tools
- **[Baluster Spacing Calculator](https://balusterspacingcalculator.com/)** — Live 2D guardrail elevation, IRC 4" sphere inspection overlay, and $1/16"$ running carpenter hook-tape table.
- **[Spindle Spacing Calculator](https://balusterspacingcalculator.com/spindle-spacing-calculator/)** — Angled stair rake handrail & shoe-rail diagonal tape marks, miter saw plumb angles, and IRC 6" triangle checks.
- **[Deck Post Spacing Calculator](https://balusterspacingcalculator.com/deck-post-spacing-calculator/)** — 2024 IRC Table R507.5 wet-service beam spans, $L/4$ cantilever verification, and SonoTube pier footing schedules.
- **[Deck Footing Calculator](https://balusterspacingcalculator.com/deck-footing-calculator/)** — 2024 IRC Table R507.3.1 SonoTube, square pad & flared bell-bottom footing sizes, frost-line cross-sections, and 80-lb bag counts.
- **[Fence Post Spacing Calculator](https://balusterspacingcalculator.com/fence-post-spacing-calculator/)** — Equalized bay solver (zero corner stub panels), inline walk/drive gate deductions, and concrete bag tallies.

---

## 3. IRC R404.4 & NCMA Retaining Wall, Gravel Compaction & CMU Core-Fill Math

Earth-retaining walls require strict separation between dense-graded footing aggregate and open-graded backfill stone, plus mandatory below-grade base embedment:

- **Minimum Buried Toe Embedment**: $d_{\text{embed}} = \max(6\text{ in},\; 0.10 \cdot H_{\text{exposed}})$, rounded up to whole courses.
- **Compacted Trench Road Base ($3/4"$ Minus Crusher Run)**: Multiply trench geometry by $1.15$ vibratory plate compaction shrinkage and convert at $1.40\text{ short tons/yd}^3$ ($2,800\text{ lbs/yd}^3$).
- **Clean Drainage Chimney ($\#57$ Washed Angular Stone)**: Zero-fines stone column ($12"$ min width) around a $4"$ perforated toe drain wrapped in non-woven geotextile, converted at $1.30\text{ short tons/yd}^3$ ($2,600\text{ lbs/yd}^3$).
- **IRC R404.4 Permit & Geogrid Trigger**: Triggered when total height from bottom of footing pad to top of cap exceeds $48\text{ in}$ ($4.0\text{ ft}$) or supports sloped/driveway surcharges; minimum geogrid embedment $L_g \ge \max(4.0\text{ ft},\; 0.70 H)$.
- **ASTM C90 $8\times 8\times 16$ CMU Core Grout**: $0.235\text{ ft}^3/\text{block}$ ($100\%$ solid grouted) plus $3.2\times 80\text{-lb}$ Type S face-shell mortar bags per $100$ blocks.

### Interactive 2D Hardscape, Timber & Masonry Takeoff Tools
- **[Retaining Wall Block Calculator](https://retainingwallblockcalculator.com/)** — Live 2D structural cross-section & course elevation, buried starter course math, cap stones, pallets, and geogrid tiebacks.
- **[Retaining Wall Gravel Calculator](https://retainingwallblockcalculator.com/retaining-wall-gravel-calculator/)** — Two-zone crusher run vs. washed `#57` drainage stone tonnage and bulk dump vs. 50-lb bag break-even.
- **[Timber Retaining Wall Calculator](https://retainingwallblockcalculator.com/timber-retaining-wall-calculator/)** — Actual $5.5"$ milled $6\times 6$ & $7\times 9$ railroad tie courses, T-deadman anchor plan, $36"$ `#4` rebar pins, and galvanized spikes.
- **[CMU Block Fill Calculator](https://retainingwallblockcalculator.com/cmu-block-fill-calculator/)** — $6"\text{–}12"$ concrete block core grout cubic yards, $80\text{-lb}$ bag counts, bond beams, Type S mortar, and rebar sticks.

---

## Quick Usage

```bash
git clone https://github.com/kaiyilu/building-layout-math.git
cd building-layout-math
node formulas.mjs
```

## License

Released under the [MIT License](./LICENSE).

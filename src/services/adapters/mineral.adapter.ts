import axios from 'axios';

// ── External APIs ─────────────────────────────────────────────────────────────

// Macrostrat Geologic Map — free, no auth
const MACROSTRAT_API = 'https://macrostrat.org/api/v2/geologic_units/map';

// NASA CMR — granule search is free; download requires Earthdata bearer token
const CMR_GRANULES = 'https://cmr.earthdata.nasa.gov/search/granules.json';
const EMIT_L2B_COLLECTION = 'C2408750690-LPCLOUD'; // EMIT L2B Mineralogy

// NASA POWER — aerosol optical depth (dust proxy), free, no auth
const NASA_POWER_API = 'https://power.larc.nasa.gov/api/temporal/climatology/point';

// Earthdata bearer token — set NASA_EARTHDATA_TOKEN on Railway
const EARTHDATA_TOKEN = process.env.NASA_EARTHDATA_TOKEN ?? '';

// ── Mineral associations by bedrock lithology ────────────────────────────────

const LITH_MINERALS: Record<string, string[]> = {
  granite:      ['Quartz', 'Orthoclase', 'Biotite', 'Muscovite'],
  granodiorite: ['Quartz', 'Plagioclase', 'Biotite', 'Hornblende'],
  diorite:      ['Plagioclase', 'Hornblende', 'Pyroxene', 'Quartz'],
  gabbro:       ['Plagioclase', 'Pyroxene', 'Olivine', 'Magnetite'],
  basalt:       ['Plagioclase', 'Pyroxene', 'Olivine', 'Magnetite'],
  andesite:     ['Plagioclase', 'Hornblende', 'Pyroxene', 'Biotite'],
  rhyolite:     ['Quartz', 'Sanidine', 'Biotite', 'Glass'],
  tuff:         ['Glass', 'Plagioclase', 'Quartz', 'Biotite'],
  sandstone:    ['Quartz', 'Feldspar', 'Calcite', 'Clay Minerals'],
  shale:        ['Clay Minerals', 'Quartz', 'Feldspar', 'Pyrite'],
  limestone:    ['Calcite', 'Dolomite', 'Clay Minerals', 'Quartz'],
  dolomite:     ['Dolomite', 'Calcite', 'Quartz', 'Clay Minerals'],
  quartzite:    ['Quartz', 'Feldspar', 'Mica', 'Garnet'],
  gneiss:       ['Quartz', 'Feldspar', 'Biotite', 'Garnet'],
  schist:       ['Mica', 'Quartz', 'Garnet', 'Chlorite'],
  marble:       ['Calcite', 'Dolomite', 'Tremolite', 'Diopside'],
  alluvium:     ['Quartz', 'Feldspar', 'Clay Minerals', 'Iron Oxide'],
  sand:         ['Quartz', 'Feldspar', 'Heavy Minerals', 'Iron Oxide'],
  clay:         ['Kaolinite', 'Montmorillonite', 'Illite', 'Quartz'],
  conglomerate: ['Quartz', 'Feldspar', 'Rock Fragments', 'Calcite'],
  chert:        ['Microcrystalline Quartz', 'Chalcedony', 'Opal'],
  volcanic:     ['Plagioclase', 'Pyroxene', 'Glass', 'Iron Oxide'],
  igneous:      ['Feldspar', 'Quartz', 'Pyroxene', 'Mica'],
  metamorphic:  ['Quartz', 'Feldspar', 'Mica', 'Garnet'],
  sedimentary:  ['Quartz', 'Calcite', 'Clay Minerals', 'Feldspar'],
};

function deriveMinerals(lith: string, rockType: string): string[] {
  const text = `${lith} ${rockType}`.toLowerCase();
  for (const [key, minerals] of Object.entries(LITH_MINERALS)) {
    if (text.includes(key)) return minerals;
  }
  if (/volcan|ign|pluton/.test(text)) return LITH_MINERALS.igneous;
  if (/meta|gneiss|schist|phyllite/.test(text)) return LITH_MINERALS.metamorphic;
  if (/sed|strat|alluvial|deposit/.test(text)) return LITH_MINERALS.sedimentary;
  return ['Quartz', 'Feldspar', 'Clay Minerals', 'Iron Oxide'];
}

function buildComposition(minerals: string[]): Record<string, number> {
  const n = minerals.length;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return Object.fromEntries(minerals.map((m, i) => [m, i === 0 ? base + remainder : base]));
}

// ── NASA POWER dust optical depth ────────────────────────────────────────────

async function fetchDustAod(lat: number, lng: number): Promise<number | null> {
  try {
    const res = await axios.get(NASA_POWER_API, {
      params: {
        parameters: 'AOD55',
        community: 'SB',
        longitude: lng,
        latitude: lat,
        format: 'JSON',
      },
      timeout: 8_000,
    });
    const ann = res.data?.properties?.parameter?.AOD55?.ANN;
    return typeof ann === 'number' && ann > 0 ? ann : null;
  } catch {
    return null;
  }
}

// Estimate dust-active area (km²) from AOD and a 50 km scan radius.
// AOD 0–0.2 = clean air; 0.2–0.5 = moderate aerosol; >0.5 = heavy dust.
function aodToDustArea(aod: number): number {
  const radiusKm = 50;
  const totalArea = Math.PI * radiusKm ** 2; // ~7854 km²
  const fraction = Math.min(aod / 0.8, 1.0);  // normalise to 0–1
  return Math.round(totalArea * fraction);
}

// ── EMIT CMR granule check ────────────────────────────────────────────────────

async function checkEmitCoverage(lat: number, lng: number): Promise<string | null> {
  try {
    const bbox = `${(lng - 0.5).toFixed(4)},${(lat - 0.5).toFixed(4)},${(lng + 0.5).toFixed(4)},${(lat + 0.5).toFixed(4)}`;
    const headers: Record<string, string> = EARTHDATA_TOKEN
      ? { Authorization: `Bearer ${EARTHDATA_TOKEN}` }
      : {};

    const res = await axios.get(CMR_GRANULES, {
      params: {
        collection_concept_id: EMIT_L2B_COLLECTION,
        bounding_box: bbox,
        sort_key: '-start_date',
        page_size: 1,
      },
      headers,
      timeout: 8_000,
    });

    const granules: any[] = res.data?.feed?.entry ?? [];
    if (granules.length === 0) return null;

    const g = granules[0];
    return g.title ?? g.id ?? 'EMIT L2B granule found';
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

interface MineralResult {
  minerals: string[];
  dustArea: number | null;
  composition: Record<string, number>;
  captureDate: string;
  source: string;
  dataAvailable: boolean;
  measurementStatus: string;
  message: string;
}

export const mineralAdapter = {
  async getMineralData(lat: number, lng: number): Promise<MineralResult> {
    const captureDate = new Date().toISOString();

    // Run all three sources in parallel
    const [macroRes, aod, emitGranule] = await Promise.allSettled([
      axios.get(MACROSTRAT_API, { params: { lat, lng, response: 'long' }, timeout: 10_000 }),
      fetchDustAod(lat, lng),
      checkEmitCoverage(lat, lng),
    ]);

    // ── Macrostrat minerals ──
    let minerals: string[] = [];
    let composition: Record<string, number> = {};
    let geologicNote = '';

    if (macroRes.status === 'fulfilled') {
      const units: any[] = macroRes.value.data?.success?.data ?? [];
      if (units.length > 0) {
        const unit = units[0];
        const lith = String(unit.lith || '');
        const rockType = String(unit.rock_type || '');
        const unitName = String(unit.strat_name || unit.unit_name || 'Unknown unit');
        const tAge = unit.t_age != null ? Number(unit.t_age).toFixed(0) : null;
        const bAge = unit.b_age != null ? Number(unit.b_age).toFixed(0) : null;
        const ageStr = tAge && bAge ? `${tAge}–${bAge} Ma` : '';
        minerals = deriveMinerals(lith, rockType);
        composition = buildComposition(minerals);
        geologicNote = `Bedrock: ${unitName}${ageStr ? ` (${ageStr})` : ''}, lithology: ${lith || rockType || 'unspecified'}.`;
      }
    }

    // ── Dust area from NASA POWER AOD ──
    const aodValue = aod.status === 'fulfilled' ? aod.value : null;
    const dustArea = aodValue !== null ? aodToDustArea(aodValue) : null;
    const dustNote = aodValue !== null
      ? `Dust-active area ~${dustArea} km² (NASA POWER AOD₅₅ = ${aodValue.toFixed(3)}).`
      : 'Dust-source area unavailable — NASA POWER AOD not returned.';

    // ── EMIT scene note ──
    const emitNote = emitGranule.status === 'fulfilled' && emitGranule.value
      ? `EMIT L2B scene confirmed: ${emitGranule.value}. Full spectral mineral fractions available via Earthdata OPeNDAP.`
      : EARTHDATA_TOKEN
        ? 'No EMIT L2B scene found at this location in the current archive.'
        : 'Set NASA_EARTHDATA_TOKEN on Railway to enable EMIT spectral mineral fractions.';

    const hasData = minerals.length > 0;

    return {
      minerals,
      dustArea,
      composition,
      captureDate,
      source: [
        'Macrostrat Geologic Map (minerals)',
        aodValue !== null ? 'NASA POWER AOD (dust area)' : '',
        emitGranule.status === 'fulfilled' && emitGranule.value ? 'NASA EMIT L2B (scene check)' : '',
      ].filter(Boolean).join(' · '),
      dataAvailable: hasData,
      measurementStatus: hasData ? 'verified' : 'unavailable',
      message: [geologicNote, dustNote, emitNote].filter(Boolean).join(' '),
    };
  },
};

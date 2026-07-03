const BASE_URL =
  "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized";

const BRAND_SLUG_MAP: Record<string, string> = {
  acura: "acura",
  "alfa romeo": "alfa-romeo",
  "aston martin": "aston-martin",
  audi: "audi",
  bmw: "bmw",
  byd: "byd",
  cadillac: "cadillac",
  "caoa chery": "chery",
  "caoa chery/chery": "chery",
  chana: "chana",
  changan: "changan",
  chery: "chery",
  chrysler: "chrysler",
  "citroën": "citroen",
  citroen: "citroen",
  daewoo: "daewoo",
  daihatsu: "daihatsu",
  dodge: "dodge",
  ferrari: "ferrari",
  fiat: "fiat",
  ford: "ford",
  foton: "foton",
  gac: "gac-group",
  geely: "geely",
  "gm - chevrolet": "chevrolet",
  chevrolet: "chevrolet",
  "great wall": "great-wall",
  gwm: "great-wall",
  hafei: "hafei",
  haval: "haval",
  honda: "honda",
  hyundai: "hyundai",
  isuzu: "isuzu",
  iveco: "iveco",
  jac: "jac",
  jaecoo: "jaecoo",
  jaguar: "jaguar",
  jeep: "jeep",
  jetour: "jetour",
  kia: "kia",
  "kia motors": "kia",
  lada: "lada",
  lamborghini: "lamborghini",
  "land rover": "land-rover",
  leapmotor: "leapmotor",
  lexus: "lexus",
  lifan: "lifan",
  lincoln: "lincoln",
  lotus: "lotus",
  mahindra: "mahindra",
  maserati: "maserati",
  mazda: "mazda",
  mclaren: "mclaren",
  "mercedes-benz": "mercedes-benz",
  mg: "mg",
  mini: "mini",
  mitsubishi: "mitsubishi",
  nissan: "nissan",
  omoda: "omoda",
  peugeot: "peugeot",
  plymouth: "plymouth",
  pontiac: "pontiac",
  porsche: "porsche",
  ram: "ram",
  renault: "renault",
  "rolls-royce": "rolls-royce",
  rover: "rover",
  saab: "saab",
  saturn: "saturn",
  seat: "seat",
  smart: "smart",
  ssangyong: "ssangyong",
  subaru: "subaru",
  suzuki: "suzuki",
  toyota: "toyota",
  troller: "troller",
  volvo: "volvo",
  "vw - volkswagen": "volkswagen",
  volkswagen: "volkswagen",
  zeekr: "zeekr",
  dongfeng: "dongfeng",
  dfsk: "dfsk",
  "man": "man",
  scania: "scania",

  // Motos — filippofilip95
  triumph: "triumph",
  ktm: "ktm",
  // honda, suzuki, bmw, lifan already covered above

  // Motos — simple-icons (SVG monocromático hospedado no jsDelivr)
  ducati: "__simpleicons__ducati",
  husqvarna: "__simpleicons__husqvarna",
  vespa: "__simpleicons__vespa",
};

const SIMPLE_ICONS_BASE = "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons";

export function getBrandLogoUrl(brandName: string): string | null {
  if (!brandName) return null;
  const normalized = brandName.toLowerCase().trim();
  const slug = BRAND_SLUG_MAP[normalized];
  if (!slug) return null;
  if (slug.startsWith("__simpleicons__")) {
    const icon = slug.replace("__simpleicons__", "");
    return `${SIMPLE_ICONS_BASE}/${icon}.svg`;
  }
  return `${BASE_URL}/${slug}.png`;
}

export function isSimpleIconsUrl(url: string): boolean {
  return url.includes("simple-icons") || url.endsWith(".svg");
}

const FALLBACK_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#6366F1",
  "#D97706",
  "#059669",
];

export function getBrandColor(brandName: string): string {
  if (!brandName) return FALLBACK_COLORS[0];
  let hash = 0;
  for (let i = 0; i < brandName.length; i++) {
    hash = brandName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

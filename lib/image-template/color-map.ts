// Pemetaan nama warna (Bahasa Indonesia, sesuai konvensi products.warna di
// katalog Deera) ke hex approx — dipakai HANYA untuk swatch dekoratif di
// poster Instagram (bukan data warna yang dijual ke pelanggan sbg jaminan
// warna persis). Kalau nama tidak dikenali, fallback ke abu netral —
// bukan mengarang warna acak.
const COLOR_MAP: Record<string, string> = {
  HITAM: "#1A1A1A",
  PUTIH: "#F5F5F0",
  IVORY: "#F0EAD6",
  KREM: "#D7CCC8",
  CREAM: "#D7CCC8",
  NUDE: "#D2B48C",
  MERAH: "#B3261E",
  "MERAH MARUN": "#7B241C",
  MARUN: "#7B241C",
  MAROON: "#7B241C",
  BURGUNDY: "#800020",
  PINK: "#E091A6",
  "DUSTY PINK": "#D8A7B1",
  FUCHSIA: "#C2185B",
  MAGENTA: "#C2185B",
  HIJAU: "#2E7D32",
  "HIJAU TOSCA": "#00897B",
  TOSCA: "#00897B",
  SAGE: "#8FBC8F",
  SALEM: "#8FBC8F",
  EMERALD: "#046307",
  ZAITUN: "#6B6B2A",
  OLIVE: "#6B6B2A",
  BIRU: "#1565C0",
  "BIRU DONGKER": "#1A237E",
  DONGKER: "#1A237E",
  NAVY: "#1A237E",
  TERACOTTA: "#C1502E",
  TERRACOTTA: "#C1502E",
  COKLAT: "#6D4C41",
  COKELAT: "#6D4C41",
  MOCHA: "#8D6E63",
  TAN: "#C19A6B",
  ABU: "#9E9E9E",
  "ABU-ABU": "#9E9E9E",
  "ABU MUDA": "#BDBDBD",
  "ABU TUA": "#616161",
  GREY: "#9E9E9E",
  GRAY: "#9E9E9E",
  KUNING: "#F4C430",
  MUSTARD: "#D4AC0D",
  GOLD: "#CAB170",
  UNGU: "#6A4C93",
  LILAC: "#B39DDB",
  LAVENDER: "#B39DDB",
  ORANGE: "#E8720C",
  PEACH: "#FFCBA4",
  SILVER: "#C0C0C0",
};

const FALLBACK_HEX = "#B8AFA0";

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

export function warnaToHex(warna: string): string {
  const key = normalize(warna);
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  const found = Object.keys(COLOR_MAP).find((k) => key.includes(k) || k.includes(key));
  return found ? COLOR_MAP[found] : FALLBACK_HEX;
}

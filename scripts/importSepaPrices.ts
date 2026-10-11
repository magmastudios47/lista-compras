import fs from 'fs';
import path from 'path';
import { singularizeIngredient } from '../src/lib/normalizer';

export interface PriceReferenceRecord {
  normalized_name: string;
  zone: string;
  price_per_unit: number;
  unit: string;
  date: string;
  source: string;
  sample_count: number;
  confidence: 'alta' | 'media' | 'baja';
}

export interface ParseOptions {
  dataDir?: string;
  zoneName?: string;
  allowedLocalities?: string[];
}

/**
 * Parsea un archivo CSV simple considerando encabezados
 */
export function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Extrae la unidad estándar y el factor multiplicador del campo presentacion de SEPA
 * Ejemplos:
 * "500 g" -> { targetUnit: 'kg', factor: 0.5 } => precio_kg = precio / 0.5
 * "900 ml" -> { targetUnit: 'l', factor: 0.9 } => precio_l = precio / 0.9
 * "1 l" -> { targetUnit: 'l', factor: 1.0 }
 * "6 un" -> { targetUnit: 'unidad', factor: 6 } => precio_un = precio / 6
 */
export function parsePresentation(presentation: string): { targetUnit: string; factor: number } {
  const p = presentation.toLowerCase().trim();

  // Litros / Mililitros
  const mlMatch = p.match(/(\d+(?:\.\d+)?)\s*ml/);
  if (mlMatch) {
    const ml = parseFloat(mlMatch[1]);
    return { targetUnit: 'l', factor: ml / 1000 };
  }
  const lMatch = p.match(/(\d+(?:\.\d+)?)\s*l/);
  if (lMatch) {
    return { targetUnit: 'l', factor: parseFloat(lMatch[1]) };
  }

  // Gramos / Kilos
  const gMatch = p.match(/(\d+(?:\.\d+)?)\s*g/);
  if (gMatch) {
    const g = parseFloat(gMatch[1]);
    return { targetUnit: 'kg', factor: g / 1000 };
  }
  const kgMatch = p.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) {
    return { targetUnit: 'kg', factor: parseFloat(kgMatch[1]) };
  }

  // Unidades
  const unMatch = p.match(/(\d+)\s*(?:un|u)/);
  if (unMatch) {
    return { targetUnit: 'unidad', factor: parseInt(unMatch[1], 10) };
  }

  return { targetUnit: 'unidad', factor: 1.0 };
}

/**
 * Mapeo de descripción comercial de SEPA al producto genérico normalizado de nuestro catálogo
 */
export function mapSepaProductToCatalog(description: string, category: string): string | null {
  const desc = description.toLowerCase();

  if (desc.includes('leche entera')) return 'leche';
  if (desc.includes('arroz largo fino') || desc.includes('arroz')) return 'arroz';
  if (desc.includes('fideo') || desc.includes('tallarin') || desc.includes('tirabuzon')) return 'fideos';
  if (desc.includes('aceite de girasol') || desc.includes('aceite')) return 'aceite';
  if (desc.includes('harina de trigo') || desc.includes('harina 000') || desc.includes('harina')) return 'harina';
  if (desc.includes('azucar')) return 'azucar';
  if (desc.includes('yerba mate') || desc.includes('yerba')) return 'yerba';
  if (desc.includes('pure de tomate') || desc.includes('tomate')) return 'pure de tomate';
  if (desc.includes('huevo')) return 'huevos';
  if (desc.includes('manteca')) return 'manteca';
  if (desc.includes('nalga')) return 'nalga';
  if (desc.includes('carne picada')) return 'carne picada';
  if (desc.includes('papa')) return 'papa';
  if (desc.includes('cebolla')) return 'cebolla';

  return null;
}

/**
 * Calcula la mediana de una lista de números, descartando valores atípicos evidentes (outliers)
 */
export function calculateMedianDiscardingOutliers(values: number[]): { median: number; validCount: number } {
  if (values.length === 0) return { median: 0, validCount: 0 };
  if (values.length === 1) return { median: Math.round(values[0] * 100) / 100, validCount: 1 };

  // Paso 1: Ordenar
  const sorted = [...values].sort((a, b) => a - b);

  // Mediana preliminar
  const mid = Math.floor(sorted.length / 2);
  const rawMedian = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Paso 2: Si hay al menos 3 valores, filtrar valores aberrantes (> 3x mediana o < 0.25x mediana)
  let filtered = sorted;
  if (sorted.length >= 3 && rawMedian > 0) {
    filtered = sorted.filter((val) => val <= rawMedian * 3 && val >= rawMedian * 0.25);
    if (filtered.length === 0) filtered = sorted; // Resguardo
  }

  // Paso 3: Mediana final sobre valores filtrados
  const fMid = Math.floor(filtered.length / 2);
  const finalMedian =
    filtered.length % 2 !== 0 ? filtered[fMid] : (filtered[fMid - 1] + filtered[fMid]) / 2;

  return {
    median: Math.round(finalMedian * 100) / 100,
    validCount: filtered.length,
  };
}

/**
 * Importador principal SEPA
 */
export function processSepaDataset(options: ParseOptions = {}): PriceReferenceRecord[] {
  const dataDir = options.dataDir || path.resolve(process.cwd(), 'data', 'sepa-sample');
  const zoneName = options.zoneName || 'Junín de los Andes y alrededores';
  const allowedLocalities = options.allowedLocalities || [
    'Junin de los Andes',
    'San Martin de los Andes',
  ];

  const sucursalesPath = path.join(dataDir, 'sucursales.csv');
  const productosPath = path.join(dataDir, 'productos.csv');
  const preciosPath = path.join(dataDir, 'precios.csv');

  if (!fs.existsSync(sucursalesPath) || !fs.existsSync(productosPath) || !fs.existsSync(preciosPath)) {
    throw new Error(`No se encontraron los archivos CSV requeridos en: ${dataDir}`);
  }

  const sucursalesRows = parseCsv(fs.readFileSync(sucursalesPath, 'utf8'));
  const productosRows = parseCsv(fs.readFileSync(productosPath, 'utf8'));
  const preciosRows = parseCsv(fs.readFileSync(preciosPath, 'utf8'));

  // 1. Filtrar sucursales de la zona
  const validSucursalIds = new Set<string>();
  sucursalesRows.forEach((suc) => {
    const loc = (suc.localidad || '').trim();
    if (allowedLocalities.some((al) => loc.toLowerCase().includes(al.toLowerCase()))) {
      validSucursalIds.add(suc.id_sucursal);
    }
  });

  // 2. Indexar productos por id_producto
  const productMap = new Map<string, { catalogName: string; targetUnit: string; factor: number; category: string }>();
  productosRows.forEach((prod) => {
    const catalogName = mapSepaProductToCatalog(prod.descripcion, prod.categoria);
    if (catalogName) {
      const { targetUnit, factor } = parsePresentation(prod.presentacion);
      productMap.set(prod.id_producto, {
        catalogName,
        targetUnit,
        factor: factor > 0 ? factor : 1.0,
        category: prod.categoria,
      });
    }
  });

  // 3. Filtrar precios vigentes de las sucursales de la zona y normalizar precio por unidad
  // Agrupamiento por: `${catalogName}__${targetUnit}`
  const groupedPrices = new Map<string, { prices: number[]; category: string; date: string }>();

  preciosRows.forEach((pr) => {
    if (!validSucursalIds.has(pr.id_sucursal)) return;

    const prodInfo = productMap.get(pr.id_producto);
    if (!prodInfo) return;

    const rawPrice = parseFloat(pr.precio_unitario);
    if (isNaN(rawPrice) || rawPrice <= 0) return;

    // Normalizar a precio por unidad estándar (ej. precio por kg = rawPrice / factor)
    const unitPrice = rawPrice / prodInfo.factor;
    const groupKey = `${prodInfo.catalogName}__${prodInfo.targetUnit}`;

    if (!groupedPrices.has(groupKey)) {
      groupedPrices.set(groupKey, { prices: [], category: prodInfo.category, date: pr.fecha_vigencia || '2026-10-11' });
    }

    groupedPrices.get(groupKey)!.prices.push(unitPrice);
  });

  // 4. Calcular medianas, descartar outliers y asignar confianza honesta
  const results: PriceReferenceRecord[] = [];

  groupedPrices.forEach((group, key) => {
    const [catalogName, unit] = key.split('__');
    const { median, validCount } = calculateMedianDiscardingOutliers(group.prices);

    if (validCount === 0 || median <= 0) return;

    // Asignar nivel de confianza honesto
    let confidence: 'alta' | 'media' | 'baja' = 'media';
    if (group.category === 'carniceria' || group.category === 'verduleria') {
      confidence = 'baja'; // Frescos varían según corte y estación
    } else if (validCount >= 3) {
      confidence = 'alta'; // Envasados con 3 o más muestras
    }

    results.push({
      normalized_name: catalogName,
      zone: zoneName,
      price_per_unit: median,
      unit,
      date: group.date,
      source: 'SEPA',
      sample_count: validCount,
      confidence,
    });
  });

  return results.sort((a, b) => a.normalized_name.localeCompare(b.normalized_name));
}

// Ejecución CLI si se llama directamente
if (process.argv[1] && process.argv[1].endsWith('importSepaPrices.ts')) {
  try {
    const records = processSepaDataset();
    const outputPath = path.resolve(process.cwd(), 'data', 'reference_prices.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf8');
    console.log(`✅ Importación SEPA exitosa: ${records.length} productos procesados.`);
    console.log(`📁 Guardado en: ${outputPath}`);
  } catch (err: any) {
    console.error('❌ Error ejecutando importador SEPA:', err.message);
    process.exit(1);
  }
}

import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    priceBase: 10.0,
    pricePremium: 20.0,
    mpFeePercentage: 0.10, // 10% comisión e impuestos
    monthsToCover: 12, // 12 meses (1 año de uso continuo)
    maxIaBudgetPercentage: 0.40, // Máximo 40% del ingreso neto para IA
    // Costo por crédito medido (1 crédito = 1 receta con Flash-Lite)
    costPerCreditLite2026: 0.000285, // USD
    costPerCreditLite2027: 0.000570, // USD (duplicado en 2027)
    // Costo por crédito medido con Flash completo
    costPerCreditFlash2026: 0.002438, // USD
    costPerCreditFlash2027: 0.004876, // USD
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fee' && args[i + 1]) {
      options.mpFeePercentage = parseFloat(args[++i]);
    } else if (args[i] === '--months' && args[i + 1]) {
      options.monthsToCover = parseInt(args[++i], 10);
    } else if (args[i] === '--budget-pct' && args[i + 1]) {
      options.maxIaBudgetPercentage = parseFloat(args[++i]);
    }
  }

  return options;
}

export function calculateQuotas(opts = parseArgs()) {
  const netBase = opts.priceBase * (1 - opts.mpFeePercentage);
  const netPremium = opts.pricePremium * (1 - opts.mpFeePercentage);

  const monthlyIaBase = (netBase * opts.maxIaBudgetPercentage) / opts.monthsToCover;
  const monthlyIaPremium = (netPremium * opts.maxIaBudgetPercentage) / opts.monthsToCover;

  return {
    netBase,
    netPremium,
    monthlyIaBase,
    monthlyIaPremium,
    // Escenarios de créditos máximos seguros
    base: {
      lite2026: Math.floor(monthlyIaBase / opts.costPerCreditLite2026),
      lite2027: Math.floor(monthlyIaBase / opts.costPerCreditLite2027),
      flash2026: Math.floor(monthlyIaBase / opts.costPerCreditFlash2026),
      flash2027: Math.floor(monthlyIaBase / opts.costPerCreditFlash2027),
      recommended: 50, // 50 créditos/mes (~1.6 consultas/día)
    },
    premium: {
      lite2026: Math.floor(monthlyIaPremium / opts.costPerCreditLite2026),
      lite2027: Math.floor(monthlyIaPremium / opts.costPerCreditLite2027),
      flash2026: Math.floor(monthlyIaPremium / opts.costPerCreditFlash2026),
      flash2027: Math.floor(monthlyIaPremium / opts.costPerCreditFlash2027),
      recommended: 150, // 150 créditos/mes (5 consultas/día o 18 menús semanales)
    },
  };
}

function main() {
  const opts = parseArgs();
  const res = calculateQuotas(opts);

  console.log('\n========================================================================');
  console.log('       CALCULADORA DE CUOTAS Y CRÉDITOS SEGUROS - LISTA COMPARS         ');
  console.log('========================================================================');
  console.log(`Parámetros:`);
  console.log(`- Comisión MP + Impuestos:    ${(opts.mpFeePercentage * 100).toFixed(0)}%`);
  console.log(`- Meses a cubrir:             ${opts.monthsToCover} meses`);
  console.log(`- Presupuesto máx para IA:    ${(opts.maxIaBudgetPercentage * 100).toFixed(0)}% del ingreso neto`);
  console.log(`- Precio Base:                US$ ${opts.priceBase.toFixed(2)} (Neto: US$ ${res.netBase.toFixed(2)})`);
  console.log(`- Precio Premium:             US$ ${opts.pricePremium.toFixed(2)} (Neto: US$ ${res.netPremium.toFixed(2)})`);
  console.log(`- Presupuesto mensual IA Base:    US$ ${res.monthlyIaBase.toFixed(4)} / mes`);
  console.log(`- Presupuesto mensual IA Premium: US$ ${res.monthlyIaPremium.toFixed(4)} / mes`);

  console.log('\n------------------------------------------------------------------------');
  console.log('PLAN BASE (US$ 10.00 pago único):');
  console.log(`- Con Flash-Lite (Tarifas 2026):     Máximo seguro: ${res.base.lite2026} créditos/mes`);
  console.log(`- Con Flash-Lite (Tarifas 2027 2x):  Máximo seguro: ${res.base.lite2027} créditos/mes`);
  console.log(`- Con Flash estándar (Tarifas 2026): Máximo seguro: ${res.base.flash2026} créditos/mes`);
  console.log(`- Con Flash estándar (Tarifas 2027): Máximo seguro: ${res.base.flash2027} créditos/mes`);
  console.log(`=> RECOMENDACIÓN PLAN BASE:           ${res.base.recommended} créditos/mes`);
  console.log(`   (Costo anual en 2027 con Flash-Lite: US$ ${(res.base.recommended * 12 * opts.costPerCreditLite2027).toFixed(2)} = solo el 3.8% del ingreso neto)`);

  console.log('\n------------------------------------------------------------------------');
  console.log('PLAN PREMIUM (US$ 20.00 pago único):');
  console.log(`- Con Flash-Lite (Tarifas 2026):     Máximo seguro: ${res.premium.lite2026} créditos/mes`);
  console.log(`- Con Flash-Lite (Tarifas 2027 2x):  Máximo seguro: ${res.premium.lite2027} créditos/mes`);
  console.log(`- Con Flash estándar (Tarifas 2026): Máximo seguro: ${res.premium.flash2026} créditos/mes`);
  console.log(`- Con Flash estándar (Tarifas 2027): Máximo seguro: ${res.premium.flash2027} créditos/mes`);
  console.log(`=> RECOMENDACIÓN PLAN PREMIUM:        ${res.premium.recommended} créditos/mes`);
  console.log(`   (Costo anual en 2027 con Flash-Lite: US$ ${(res.premium.recommended * 12 * opts.costPerCreditLite2027).toFixed(2)} = solo el 5.7% del ingreso neto)`);

  console.log('\n========================================================================\n');
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('calc-quotas')) {
  main();
}

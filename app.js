/* ==========================================================================
   THE BAKER'S PRICING LAB — app.js
   All data, calculation, storage and rendering logic.
   No frameworks, no build step, no network calls. Everything stays local.
   ========================================================================== */

/* ==========================================================================
   1. CONFIGURATION / REFERENCE DATA
   ========================================================================== */

const LS_KEYS = {
  recipes: 'bpl.recipes.v1',
  library: 'bpl.library.v1',
  settings: 'bpl.settings.v1',
  draft: 'bpl.draft.v1',
  seeded: 'bpl.seeded.v1'
};

const CATEGORIES = ['Cake', 'Cupcakes', 'Cookies', 'Cake Pops', 'Brownies / Bars', 'Bread / Pastry', 'Candy / Confections', 'Other'];

const YIELD_UNITS = [
  { value: 'items', label: 'items' },
  { value: 'servings', label: 'servings' },
  { value: 'dozen', label: 'dozen' },
  { value: 'boxes', label: 'boxes' },
  { value: 'custom', label: 'custom…' }
];

// Unit conversion table. Only units within the same "cat" can convert to one another.
// base = how many of the category's base unit (grams for weight, mL for volume, each for count) one unit equals.
const UNIT_INFO = {
  oz:   { cat: 'weight', base: 28.3495, label: 'oz' },
  lb:   { cat: 'weight', base: 453.592, label: 'lb' },
  g:    { cat: 'weight', base: 1,       label: 'g' },
  kg:   { cat: 'weight', base: 1000,    label: 'kg' },
  tsp:  { cat: 'volume', base: 4.92892, label: 'tsp' },
  tbsp: { cat: 'volume', base: 14.7868, label: 'tbsp' },
  floz: { cat: 'volume', base: 29.5735, label: 'fl oz' },
  cup:  { cat: 'volume', base: 236.588, label: 'cup' },
  pint: { cat: 'volume', base: 473.176, label: 'pint' },
  quart:{ cat: 'volume', base: 946.353, label: 'quart' },
  mL:   { cat: 'volume', base: 1,       label: 'mL' },
  L:    { cat: 'volume', base: 1000,    label: 'L' },
  each: { cat: 'count',  base: 1,       label: 'each' }
};
const UNIT_GROUPS = [
  { label: 'Weight', units: ['oz', 'lb', 'g', 'kg'] },
  { label: 'Volume', units: ['tsp', 'tbsp', 'floz', 'cup', 'pint', 'quart', 'mL', 'L'] },
  { label: 'Count', units: ['each'] }
];

const LABOR_CATEGORIES = [
  { key: 'shopping', label: 'Shopping / ingredient prep' },
  { key: 'mixing', label: 'Mixing / preparation' },
  { key: 'baking', label: 'Baking' },
  { key: 'decorating', label: 'Active decorating' },
  { key: 'cooling', label: 'Cooling / waiting (active labor)' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'cleanup', label: 'Cleanup' },
  { key: 'admin', label: 'Administrative / customer communication' }
];

const OVERHEAD_CATEGORIES = [
  { key: 'electricity', label: 'Electricity / Gas' },
  { key: 'water', label: 'Water' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'licenses', label: 'Licenses / Permits' },
  { key: 'website', label: 'Website' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'software', label: 'Software' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'equipment', label: 'Equipment replacement' },
  { key: 'rent', label: 'Kitchen rent' },
  { key: 'storage', label: 'Storage' },
  { key: 'other', label: 'Other' }
];

const PACKAGING_PRESETS = ['Cake box', 'Cupcake box', 'Cake-pop stick', 'Treat bag', 'Ribbon', 'Label', 'Baking paper', 'Cupcake liner', 'Cake board', 'Piping bag', 'Disposable gloves', 'Insert/card', 'Delivery packaging', 'Other'];

const ROUNDING_STYLES = [
  { value: 'exact', label: 'Exact (no rounding)' },
  { value: '0.25', label: 'Nearest $0.25' },
  { value: '0.50', label: 'Nearest $0.50' },
  { value: '1.00', label: 'Nearest $1.00' },
  { value: 'psych', label: 'Psychological (.95 / .99)' }
];

/* ==========================================================================
   2. UTILITIES
   ========================================================================== */

const U = {
  num(v) {
    if (v === '' || v === null || v === undefined) return 0;
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  },
  clampPct(v, max = 99.9) {
    const n = U.num(v);
    if (n < 0) return 0;
    if (n > max) return max;
    return n;
  },
  fmt$(n) {
    if (!isFinite(n)) n = 0;
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2);
  },
  fmtPct(n, digits = 1) {
    if (!isFinite(n)) n = 0;
    return n.toFixed(digits) + '%';
  },
  fmtNum(n, digits = 2) {
    if (!isFinite(n)) n = 0;
    return n.toFixed(digits).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  },
  id() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  // Title Case for ingredient names ("all-purpose flour" -> "All-Purpose Flour"),
  // keeping small connector words lowercase when they're not the first word
  // ("Cream of Tartar", not "Cream Of Tartar").
  TITLE_CASE_MINOR_WORDS: new Set(['of', 'and', 'the', 'a', 'an', 'in', 'with', 'for', 'or']),
  toTitleCase(str) {
    const words = String(str || '').trim().split(/\s+/).filter(Boolean);
    return words.map((word, i) => word.split('-').map(seg => {
      if (!seg) return seg;
      const lower = seg.toLowerCase();
      const bareWord = lower.replace(/[^a-z]/g, '');
      if (i > 0 && U.TITLE_CASE_MINOR_WORDS.has(bareWord)) return lower;
      // Capitalize the first letter wherever it falls, so leading
      // punctuation ("(single" -> "(Single") or digits ("1:1") stay intact.
      return lower.replace(/[a-z]/, c => c.toUpperCase());
    }).join('-')).join(' ');
  },
  escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  todayStr() {
    const d = new Date();
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  },
  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
};

/* ==========================================================================
   3. CALCULATION ENGINE
   All formulas live here so nothing is duplicated or drifts. Internal math
   always uses full (unrounded) precision; rounding happens only at display
   time or for the deliberate "recommended price" rounding step.
   ========================================================================== */

const CALC = {

  /** Convert a quantity between two units. Returns null if units are in
   *  different measurement families (e.g. weight vs. volume) since that
   *  conversion depends on ingredient density and cannot be done safely. */
  convert(qty, fromUnit, toUnit) {
    const f = UNIT_INFO[fromUnit], t = UNIT_INFO[toUnit];
    if (!f || !t) return null;
    if (f.cat !== t.cat) return null;
    return (qty * f.base) / t.base;
  },

  /** Cost of a single ingredient line, in the recipe's currency.
   *  Formula: pricePerPackageUnit × recipeQtyConvertedToPackageUnit × wasteFactor
   *  wasteFactor accounts for ingredient-specific trim/spoilage: if 10% of
   *  this ingredient is wasted, you must buy/use ~11.1% more than the
   *  recipe calls for to end up with the amount actually needed. */
  ingredientCost(ing) {
    const price = U.num(ing.purchasePrice);
    const pkgQty = U.num(ing.packageQty);
    const recipeQty = U.num(ing.recipeQty);
    const waste = U.clampPct(ing.wastePct, 95);

    if (pkgQty <= 0 || price < 0) {
      return { cost: 0, error: false, incomplete: true, message: 'Enter a purchase price and package quantity.' };
    }
    const converted = CALC.convert(recipeQty, ing.recipeUnit, ing.packageUnit);
    if (converted === null) {
      return {
        cost: 0,
        error: true,
        incomplete: false,
        message: `"${ing.packageUnit}" and "${ing.recipeUnit}" can't be converted automatically (one is weight, the other is volume). Enter both quantities using the same measurement family, or convert manually.`
      };
    }
    const pricePerPackageUnit = price / pkgQty;
    const wasteFactor = 1 / (1 - waste / 100);
    const cost = pricePerPackageUnit * converted * wasteFactor;
    return { cost, error: false, incomplete: false, message: '' };
  },

  /** Cost of a single packaging/consumable line for the whole batch.
   *  Formula: (purchasePrice ÷ quantityPurchased) × quantityUsedPerBatch
   *  "Direct cost" mode simply pins quantityPurchased to 1. */
  packagingCost(item) {
    const price = U.num(item.purchasePrice);
    const pkgQty = item.directMode ? 1 : U.num(item.packageQty) || 1;
    const used = U.num(item.qtyUsedPerBatch);
    return (price / pkgQty) * used;
  },

  /** Active labor hours + cost. Cooling/waiting time only counts if the
   *  baker explicitly says it required their active attention. */
  labor(laborState) {
    const minutes = laborState.minutes || {};
    let totalMinutes = 0;
    LABOR_CATEGORIES.forEach(cat => {
      const m = U.num(minutes[cat.key]);
      if (cat.key === 'cooling' && !laborState.includeCooling) return;
      totalMinutes += m;
    });
    const totalHours = totalMinutes / 60;
    const wage = U.num(laborState.hourlyWage);
    const laborCost = totalHours * wage;
    return { totalMinutes, totalHours, laborCost, wage };
  },

  /** Overhead allocated to this single batch. Two modes so a brand-new
   *  baker isn't forced to build a full monthly budget on day one. */
  overhead(oh, ctx) {
    const mode = oh.mode || 'simple';
    if (mode === 'simple') {
      const pct = U.clampPct(oh.simplePct, 100);
      const base = ctx.ingredientCost + ctx.packagingCost + ctx.laborCost;
      return { cost: base * (pct / 100), monthlyTotal: 0, warning: null };
    }
    // Advanced: sum monthly business expenses, then allocate a slice to this batch.
    let monthlyTotal = 0;
    OVERHEAD_CATEGORIES.forEach(c => { monthlyTotal += U.num(oh.monthly && oh.monthly[c.key]); });
    const basis = oh.allocationBasis || 'orders';
    let cost = 0, warning = null;
    if (basis === 'orders') {
      const orders = U.num(oh.monthlyOrders);
      if (orders > 0) cost = monthlyTotal / orders;
      else warning = 'Enter expected monthly orders (or switch allocation basis) so overhead can be spread across batches.';
    } else {
      const hours = U.num(oh.monthlyHours);
      if (hours > 0 && ctx.laborHours > 0) cost = (monthlyTotal / hours) * ctx.laborHours;
      else warning = 'Enter expected monthly production hours (and batch labor time) so overhead can be allocated by hour.';
    }
    return { cost, monthlyTotal, warning };
  },

  /** General business-buffer allowance, layered on top of ingredient/
   *  packaging/labor/overhead — separate from any ingredient-specific
   *  waste % so the two never double-count the same risk. */
  buffer(bufferState, baseCost) {
    const b = bufferState || {};
    const pct = U.clampPct(b.productionWastePct) + U.clampPct(b.failedBatchPct) + U.clampPct(b.samplesPct) + U.clampPct(b.ingredientBufferPct);
    return { pct, amount: baseCost * (pct / 100) };
  },

  /** Round a calculated price into a commercially practical number.
   *  Always rounds UP (or to psychological .99) so a "recommended" price
   *  never falls below the sustainable price it was derived from. */
  roundPrice(value, style) {
    if (!isFinite(value) || value <= 0) return 0;
    const EPS = 1e-9;
    switch (style) {
      case '0.25': return Math.ceil((value - EPS) / 0.25) * 0.25;
      case '0.50': return Math.ceil((value - EPS) / 0.5) * 0.5;
      case '1.00': return Math.ceil(value - EPS);
      case 'psych': {
        let candidate = Math.floor(value) + 0.99;
        if (candidate < value - EPS) candidate += 1;
        return candidate;
      }
      case 'exact':
      default:
        return value;
    }
  },

  /** Full computation for a recipe. Returns every number the UI needs plus
   *  a list of dynamically-generated, plain-language warnings/insights. */
  computeAll(recipe) {
    const warnings = [];
    const yieldQty = U.num(recipe.yieldQty);
    const yieldValid = yieldQty > 0;
    const safeYield = yieldValid ? yieldQty : 1;
    const unitLabel = CALC.yieldUnitLabel(recipe, false);
    const unitLabelPlural = CALC.yieldUnitLabel(recipe, true);

    // ---- Ingredients ----
    const ingredientsDetailed = (recipe.ingredients || []).map(ing => {
      const r = CALC.ingredientCost(ing);
      return Object.assign({}, ing, r);
    });
    const ingredientCost = ingredientsDetailed.reduce((s, i) => s + i.cost, 0);
    const hasUnitErrors = ingredientsDetailed.some(i => i.error);

    // ---- Packaging ----
    const packagingDetailed = (recipe.packaging || []).map(p => Object.assign({}, p, { cost: CALC.packagingCost(p) }));
    const packagingCost = packagingDetailed.reduce((s, p) => s + p.cost, 0);

    // ---- Labor ----
    const labor = CALC.labor(recipe.labor || {});

    // ---- Overhead ----
    const overheadResult = CALC.overhead(recipe.overhead || {}, { ingredientCost, packagingCost, laborCost: labor.laborCost, laborHours: labor.totalHours });
    const overheadCost = overheadResult.cost;

    // ---- Buffer (general waste/contingency allowance) ----
    const preBufferCost = ingredientCost + packagingCost + labor.laborCost + overheadCost;
    const bufferResult = CALC.buffer(recipe.buffer, preBufferCost);

    // ---- True batch cost (production side, before selling/transaction fees) ----
    const trueBatchCostCore = preBufferCost + bufferResult.amount;
    const costPerUnit = trueBatchCostCore / safeYield;

    // ---- Fees (percentage-of-price + fixed-per-order) ----
    const fees = recipe.fees || {};
    const feePctTotal = U.clampPct(U.num(fees.paymentPct) + U.num(fees.platformPct) + U.num(fees.commissionPct), 95);
    const itemsPerOrder = Math.max(U.num(fees.itemsPerOrder) || 1, 0.0001);
    const fixedFeePerOrder = U.num(fees.paymentFixed) + U.num(fees.delivery) + U.num(fees.otherPerOrder);
    const fixedFeePerUnit = fixedFeePerOrder / itemsPerOrder;

    // ---- Pricing engine ----
    // Cost floor: price with zero business profit (still covers labor, since
    // labor is already a cost above — this is a break-even, not "safe", price).
    const feeDenomFloor = Math.max(1 - feePctTotal / 100, 0.05);
    const costFloor = (costPerUnit + fixedFeePerUnit) / feeDenomFloor;

    const pricing = recipe.pricing || {};
    const targetMarginPct = U.clampPct(pricing.targetMarginPct, 95);
    let marginDenom = 1 - feePctTotal / 100 - targetMarginPct / 100;
    let marginCapped = false;
    if (marginDenom < 0.05) { marginDenom = 0.05; marginCapped = true; }
    // Correct margin math: price × (1 − fee% − margin%) = cost + fixed fees
    const sustainablePrice = (costPerUnit + fixedFeePerUnit) / marginDenom;

    const roundingStyle = pricing.roundingStyle || 'psych';
    const recommendedPrice = CALC.roundPrice(sustainablePrice, roundingStyle);

    const premiumPct = U.num(pricing.premiumPct);
    const premiumPrice = CALC.roundPrice(recommendedPrice * (1 + premiumPct / 100), roundingStyle);

    // ---- Effective price used for "current state" displays ----
    const currentPrice = recipe.currentPrice != null && recipe.currentPrice !== '' ? U.num(recipe.currentPrice) : null;
    const activePrice = currentPrice != null ? currentPrice : recommendedPrice;

    function economicsAtPrice(price) {
      const feeAmount = (feePctTotal / 100) * price + fixedFeePerUnit;
      const totalCostPerUnit = costPerUnit + feeAmount;
      const profitPerUnit = price - totalCostPerUnit;
      const marginPct = price > 0 ? (profitPerUnit / price) * 100 : 0;
      const markupPct = costPerUnit > 0 ? ((price - costPerUnit) / costPerUnit) * 100 : 0;
      return { price, feeAmount, totalCostPerUnit, profitPerUnit, marginPct, markupPct };
    }

    const atCurrent = currentPrice != null ? economicsAtPrice(currentPrice) : null;
    const atRecommended = economicsAtPrice(recommendedPrice);
    const atActive = economicsAtPrice(activePrice);

    // ---- Dashboard (batch-level, using activePrice) ----
    const revenuePerBatch = activePrice * safeYield;
    const totalCostPerBatch = atActive.totalCostPerUnit * safeYield;
    const profitPerBatch = revenuePerBatch - totalCostPerBatch;
    const laborHours = labor.totalHours;
    const revenuePerLaborHour = laborHours > 0 ? revenuePerBatch / laborHours : null;
    const profitPerLaborHour = laborHours > 0 ? profitPerBatch / laborHours : null;
    const variableCostPerUnit = ingredientCost / safeYield + packagingCost / safeYield + (feePctTotal / 100) * activePrice + fixedFeePerUnit;
    const fixedCostPerBatch = labor.laborCost + overheadCost + bufferResult.amount;
    const contribution = activePrice - variableCostPerUnit;
    const breakEvenUnits = contribution > 0 ? fixedCostPerBatch / contribution : null;

    // ---- "Where does my money go" breakdown, at recommended price ----
    const moneyBreakdown = (() => {
      const ing = ingredientCost / safeYield;
      const pkg = packagingCost / safeYield;
      const lab = labor.laborCost / safeYield;
      const ovh = overheadCost / safeYield + bufferResult.amount / safeYield;
      const feeAmt = atRecommended.feeAmount;
      const profit = atRecommended.profitPerUnit;
      const total = recommendedPrice || 1;
      const rows = [
        { key: 'ingredients', label: 'Ingredients', amount: ing, color: 'var(--chart-1)' },
        { key: 'packaging', label: 'Packaging', amount: pkg, color: 'var(--chart-2)' },
        { key: 'labor', label: 'Labor', amount: lab, color: 'var(--chart-3)' },
        { key: 'overhead', label: 'Overhead & buffer', amount: ovh, color: 'var(--chart-4)' },
        { key: 'fees', label: 'Selling / transaction fees', amount: feeAmt, color: 'var(--chart-5)' },
        { key: 'profit', label: 'Business profit', amount: profit, color: 'var(--chart-6)' }
      ];
      rows.forEach(r => { r.pct = total > 0 ? (r.amount / total) * 100 : 0; });
      return { rows, total: recommendedPrice };
    })();

    // ---- Price-per-format ----
    const formats = (recipe.formats && recipe.formats.length ? recipe.formats : CALC.defaultFormats(recipe)).map(f => ({
      id: f.id, label: f.label, mult: U.num(f.mult),
      price: CALC.roundPrice(recommendedPrice * U.num(f.mult), roundingStyle)
    }));
    const pricePerBatch = recommendedPrice * safeYield;

    // ---- Health check ----
    const health = CALC.healthCheck({
      hasCurrentPrice: currentPrice != null,
      atActive, activePrice, costPerUnit, targetMarginPct, sustainablePrice,
      laborHours, profitPerBatch: activePrice != null ? (activePrice - atActive.totalCostPerUnit) * safeYield : null,
      unitLabel
    });

    // ---- Smart warnings ----
    if (labor.totalMinutes === 0 && U.num((recipe.labor || {}).hourlyWage) >= 0) {
      warnings.push({ level: 'warn', text: 'Your labor cost is currently $0.00. Are you sure you want to price this without compensating your time?' });
    }
    if (!yieldValid) {
      warnings.push({ level: 'danger', text: 'Your recipe yield is missing or zero — enter how many ' + (unitLabelPlural || 'items') + ' this batch makes so per-item cost can be calculated.' });
    }
    if (currentPrice != null && atCurrent && atCurrent.profitPerUnit < 0) {
      warnings.push({ level: 'danger', text: `Your current price (${U.fmt$(currentPrice)}) is below your calculated true cost per ${unitLabel} (${U.fmt$(costPerUnit + fixedFeePerUnit)}, before selling fees). Each sale is currently losing money.` });
    }
    if (hasUnitErrors) {
      warnings.push({ level: 'danger', text: 'One or more ingredients use units that can\'t be converted automatically (weight vs. volume). Their cost is currently counted as $0 until you fix the units — see the Ingredients tab.' });
    }
    const costShareBase = ingredientCost + packagingCost + labor.laborCost + overheadCost || 1;
    const packagingShare = (packagingCost / costShareBase) * 100;
    if (packagingShare >= 20) {
      warnings.push({ level: 'info', text: `Packaging represents about ${packagingShare.toFixed(0)}% of your total cost. You may want to review packaging choices.` });
    }
    const shareEntries = [
      ['Ingredients', ingredientCost], ['Packaging', packagingCost], ['Labor', labor.laborCost], ['Overhead', overheadCost]
    ].sort((a, b) => b[1] - a[1]);
    if (shareEntries[0][1] > 0 && shareEntries[0][0] === 'Labor') {
      warnings.push({ level: 'info', text: 'Labor is your largest cost category — small changes in prep or decorating time have an outsized effect on your true cost.' });
    }
    if (marginCapped) {
      warnings.push({ level: 'danger', text: 'Your target margin plus selling fees add up to more than is mathematically possible from a single price. Lower your target margin or reduce transaction fees.' });
    }
    if (overheadResult.warning) warnings.push({ level: 'info', text: overheadResult.warning });

    return {
      yieldQty, yieldValid, safeYield, unitLabel, unitLabelPlural,
      ingredientsDetailed, ingredientCost, hasUnitErrors,
      packagingDetailed, packagingCost,
      labor, overheadCost, overheadResult,
      buffer: bufferResult,
      trueBatchCostCore, costPerUnit,
      feePctTotal, fixedFeePerUnit, fixedFeePerOrder, itemsPerOrder,
      costFloor, sustainablePrice, recommendedPrice, premiumPrice, marginCapped,
      currentPrice, activePrice, atCurrent, atRecommended, atActive,
      revenuePerBatch, totalCostPerBatch, profitPerBatch, laborHours,
      revenuePerLaborHour, profitPerLaborHour, breakEvenUnits,
      moneyBreakdown, formats, pricePerBatch,
      health, warnings, targetMarginPct
    };
  },

  yieldUnitLabel(recipe, plural) {
    const map = { items: ['item', 'items'], servings: ['serving', 'servings'], dozen: ['dozen', 'dozen'], boxes: ['box', 'boxes'] };
    if (recipe.yieldUnit === 'custom') {
      const c = (recipe.yieldCustomLabel || 'unit').trim() || 'unit';
      return c;
    }
    const pair = map[recipe.yieldUnit] || ['item', 'items'];
    return plural ? pair[1] : pair[0];
  },

  defaultFormats(recipe) {
    if (recipe.yieldUnit === 'items' || recipe.yieldUnit === 'servings') {
      return [{ id: 'f1', label: 'Each', mult: 1 }, { id: 'f2', label: '6-pack', mult: 6 }, { id: 'f3', label: 'Dozen', mult: 12 }];
    }
    if (recipe.yieldUnit === 'dozen') {
      return [{ id: 'f1', label: 'Half Dozen', mult: 0.5 }, { id: 'f2', label: 'Dozen', mult: 1 }, { id: 'f3', label: '2 Dozen', mult: 2 }];
    }
    return [{ id: 'f1', label: 'Per ' + CALC.yieldUnitLabel(recipe, false), mult: 1 }];
  },

  /** Rule-based, plain-language pricing health assessment. Never shames the
   *  user — always explains the "why" using their own numbers. */
  healthCheck(ctx) {
    if (!ctx.hasCurrentPrice) {
      return { status: 'NO-PRICE', label: 'Add your current price for a health check', message: 'Enter your current selling price on the Recipe tab to see how it compares to your calculated costs.', suggestion: null };
    }
    const price = ctx.activePrice;
    const profitPerUnit = ctx.atActive.profitPerUnit;
    const marginPct = ctx.atActive.marginPct;
    const profitPerHour = ctx.laborHours > 0 && ctx.profitPerBatch != null ? ctx.profitPerBatch / ctx.laborHours : null;

    let status, label;
    if (profitPerUnit < 0) {
      status = 'LOSING'; label = 'Losing Money';
    } else if (marginPct < 5) {
      status = 'COST-ONLY'; label = 'Cost-Only Pricing';
    } else if (profitPerHour != null && profitPerHour < 5) {
      status = 'UNDERPAYING'; label = 'Underpaying Yourself';
    } else if (marginPct < ctx.targetMarginPct - 5) {
      status = 'THIN'; label = 'Thin Margin';
    } else {
      status = 'HEALTHY'; label = 'Healthy Price';
    }

    let message = `Your current price of ${U.fmt$(price)} per ${ctx.unitLabel} `;
    if (profitPerUnit < 0) {
      message += `does not cover your full calculated cost — you are losing about ${U.fmt$(Math.abs(profitPerUnit))} per ${ctx.unitLabel} sold.`;
    } else {
      message += `covers ingredients, packaging, labor and overhead, and generates about ${U.fmt$(profitPerUnit)} in business profit per ${ctx.unitLabel} (a ${U.fmtPct(marginPct)} margin).`;
    }
    if (profitPerHour != null && profitPerUnit >= 0) {
      message += ` At your current production time, that's approximately ${U.fmt$(profitPerHour)} of business profit per working hour, on top of the wage you already built into labor cost.`;
    }
    let suggestion = null;
    if (status !== 'HEALTHY' && ctx.sustainablePrice > 0) {
      suggestion = `A price of approximately ${U.fmt$(ctx.sustainablePrice)} per ${ctx.unitLabel} would achieve your selected ${U.fmtPct(ctx.targetMarginPct)} margin target.`;
    }
    return { status, label, message, suggestion };
  }
};

/* ==========================================================================
   4. DATA MODEL — factories & storage
   ========================================================================== */

function newIngredientRow() {
  return { id: U.id(), name: '', purchasePrice: '', packageQty: '', packageUnit: 'oz', recipeQty: '', recipeUnit: 'oz', wastePct: '', libraryId: null };
}
function newPackagingRow() {
  return { id: U.id(), name: '', purchasePrice: '', packageQty: '1', qtyUsedPerBatch: '1', directMode: true };
}
function emptyMinutes() {
  const m = {}; LABOR_CATEGORIES.forEach(c => m[c.key] = ''); return m;
}
function emptyMonthly() {
  const m = {}; OVERHEAD_CATEGORIES.forEach(c => m[c.key] = ''); return m;
}

function newRecipe(name) {
  return {
    id: U.id(),
    name: name || 'Untitled Recipe',
    category: 'Cake',
    yieldQty: 12,
    yieldUnit: 'items',
    yieldCustomLabel: '',
    currentPrice: '',
    ingredients: [newIngredientRow()],
    packaging: [],
    labor: { hourlyWage: 20, includeCooling: false, minutes: emptyMinutes() },
    overhead: { mode: 'simple', simplePct: 10, monthly: emptyMonthly(), allocationBasis: 'orders', monthlyOrders: '', monthlyHours: '' },
    fees: { paymentPct: '', paymentFixed: '', platformPct: '', commissionPct: '', delivery: '', otherPerOrder: '', itemsPerOrder: 1 },
    buffer: { productionWastePct: '', failedBatchPct: '', samplesPct: '', ingredientBufferPct: '' },
    pricing: { targetMarginPct: 30, roundingStyle: 'psych', premiumPct: 20 },
    formats: [],
    updatedAt: Date.now()
  };
}

const STORE = {
  readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
  getRecipes() { return STORE.readJSON(LS_KEYS.recipes, []); },
  saveRecipes(list) { return STORE.writeJSON(LS_KEYS.recipes, list); },
  getLibrary() { return STORE.readJSON(LS_KEYS.library, []); },
  saveLibrary(list) { return STORE.writeJSON(LS_KEYS.library, list); },
  getSettings() { return STORE.readJSON(LS_KEYS.settings, { mode: 'quick' }); },
  saveSettings(s) { return STORE.writeJSON(LS_KEYS.settings, s); },
  getDraft() { return STORE.readJSON(LS_KEYS.draft, null); },
  saveDraft(r) { return STORE.writeJSON(LS_KEYS.draft, r); }
};

// Starter ingredient library. Prices are researched, representative US
// grocery estimates (not a live feed — a static app can't stay connected to
// real-time pricing) meant purely as an editable starting point; every
// price, package size and unit here can be changed to match what a baker
// actually pays. Names are pre-formatted in Title Case per house style.
const STARTER_LIBRARY = [
  // Flours
  ['All-Purpose Flour', 4.50, 5, 'lb'],
  ['Bread Flour', 5.50, 5, 'lb'],
  ['Cake Flour', 4.25, 2, 'lb'],
  ['Whole Wheat Flour', 4.75, 5, 'lb'],
  ['Gluten-Free 1:1 Baking Flour', 7.50, 3, 'lb'],
  // Sugars
  ['Granulated Sugar', 3.50, 4, 'lb'],
  ['Light Brown Sugar', 3.25, 2, 'lb'],
  ['Dark Brown Sugar', 3.25, 2, 'lb'],
  ['Powdered Sugar', 3.00, 2, 'lb'],
  ['Turbinado Sugar', 4.50, 2, 'lb'],
  // Fats & oils
  ['Unsalted Butter', 4.50, 16, 'oz'],
  ['Salted Butter', 4.25, 16, 'oz'],
  ['Vegetable Shortening', 4.00, 20, 'oz'],
  ['Vegetable Oil', 5.50, 48, 'floz'],
  ['Canola Oil', 5.75, 48, 'floz'],
  ['Coconut Oil', 8.00, 16, 'oz'],
  // Dairy & eggs
  ['Large Eggs', 4.00, 12, 'each'],
  ['Egg Whites (Carton)', 4.50, 16, 'floz'],
  ['Whole Milk', 4.00, 4, 'quart'],
  ['Buttermilk', 3.50, 1, 'quart'],
  ['Heavy Cream', 4.50, 1, 'pint'],
  ['Sour Cream', 2.50, 16, 'oz'],
  ['Cream Cheese', 2.50, 8, 'oz'],
  ['Plain Greek Yogurt', 4.50, 32, 'oz'],
  // Leaveners & salt
  ['Baking Soda', 1.00, 16, 'oz'],
  ['Baking Powder', 3.50, 8, 'oz'],
  ['Active Dry Yeast', 7.50, 4, 'oz'],
  ['Instant Yeast', 7.50, 4, 'oz'],
  ['Table Salt', 1.00, 26, 'oz'],
  ['Kosher Salt', 3.50, 3, 'lb'],
  // Spices & flavorings
  ['Ground Cinnamon', 4.00, 2.5, 'oz'],
  ['Ground Nutmeg', 5.00, 2, 'oz'],
  ['Pure Vanilla Extract', 8.00, 4, 'floz'],
  ['Imitation Vanilla Extract', 4.00, 8, 'floz'],
  ['Almond Extract', 6.00, 2, 'floz'],
  ['Lemon Extract', 5.50, 2, 'floz'],
  ['Espresso Powder', 9.00, 2, 'oz'],
  // Chocolate & cocoa
  ['Unsweetened Cocoa Powder', 4.50, 8, 'oz'],
  ['Semi-Sweet Chocolate Chips', 4.92, 12, 'oz'],
  ['Milk Chocolate Chips', 4.50, 11.5, 'oz'],
  ['White Chocolate Chips', 4.75, 12, 'oz'],
  ['Dark Chocolate Chunks', 5.25, 10, 'oz'],
  ['Candy Melts', 5.50, 12, 'oz'],
  // Boxed mixes (brand-name staples)
  ['Betty Crocker Super Moist Cake Mix', 2.50, 15.25, 'oz'],
  ['Duncan Hines Classic Cake Mix', 2.50, 15.25, 'oz'],
  ['Pillsbury Moist Supreme Cake Mix', 2.25, 15.25, 'oz'],
  ['Betty Crocker Fudge Brownie Mix', 2.75, 18.3, 'oz'],
  ['Duncan Hines Chewy Fudge Brownie Mix', 3.00, 18.3, 'oz'],
  ['Ghirardelli Double Chocolate Brownie Mix', 5.50, 19, 'oz'],
  ['Betty Crocker Sugar Cookie Mix', 3.00, 17.5, 'oz'],
  // Frostings
  ['Betty Crocker Rich & Creamy Vanilla Frosting', 3.99, 16, 'oz'],
  ['Betty Crocker Rich & Creamy Chocolate Frosting', 3.99, 16, 'oz'],
  ['Pillsbury Creamy Supreme Frosting', 3.79, 16, 'oz'],
  // Mix-ins & decorating
  ['Rainbow Sprinkles', 3.50, 3.5, 'oz'],
  ['Gel Food Coloring (Single Bottle)', 3.50, 1, 'each'],
  ['Marshmallow Fluff', 3.50, 7.5, 'oz'],
  ['Mini Marshmallows', 2.00, 10, 'oz'],
  ['Shredded Sweetened Coconut', 3.00, 7, 'oz'],
  // Pantry & mix-ins
  ['Creamy Peanut Butter', 4.50, 16, 'oz'],
  ['Graham Cracker Crumbs', 3.50, 14, 'oz'],
  ['Old-Fashioned Rolled Oats', 4.00, 42, 'oz'],
  ['Cornstarch', 2.50, 16, 'oz'],
  ['Sliced Almonds', 5.50, 8, 'oz'],
  ['Chopped Walnuts', 6.00, 8, 'oz'],
  ['Chopped Pecans', 7.00, 8, 'oz']
];

function seedLibraryIfNeeded() {
  if (localStorage.getItem(LS_KEYS.seeded)) return;
  const existing = STORE.getLibrary();
  if (existing.length === 0) {
    STORE.saveLibrary(STARTER_LIBRARY.map(([name, purchasePrice, packageQty, packageUnit]) => ({
      id: U.id(), name: U.toTitleCase(name), purchasePrice, packageQty, packageUnit
    })));
  }
  localStorage.setItem(LS_KEYS.seeded, '1');
}

/* ==========================================================================
   5. APPLICATION STATE
   ========================================================================== */

const state = {
  recipe: null,
  savedSnapshot: null,     // JSON string of the recipe as last explicitly saved
  activeTab: 'setup',
  activeToolTab: 'simulator',
  mode: 'quick',           // 'quick' | 'full'
  result: null,
  simPrice: null,
  simPriceIsCustom: false, // once true, the simulator stops tracking the recommended price
  discountPct: 10,
  inflationPct: 10,
  wholesalePrice: '',
  wholesaleRetail: '',
  wholesaleMinMargin: 35,
  order: { qty: 1, price: '', customLaborHours: '', delivery: '', discountPct: 0 }
};

function isDirty() {
  if (!state.savedSnapshot) return true;
  return JSON.stringify(state.recipe) !== state.savedSnapshot;
}

/* ==========================================================================
   7. MASTER RECOMPUTE / RENDER ORCHESTRATION
   ========================================================================== */

function recompute() {
  state.result = CALC.computeAll(state.recipe);
}

function renderAll() {
  recompute();
  renderRecipeSelect();
  renderSaveStatus();
  renderSummaryStrip();
  renderSetup();
  renderIngredients();
  renderPackaging();
  renderLabor();
  renderLaborSummary();
  renderCosts();
  renderCostsSummary();
  renderPricing();
  renderResults();
  renderTools();
  renderLibraryTab();
}

/** Lighter refresh used on every keystroke: recompute + update computed
 *  output areas, but never rebuild table rows (would drop focus/caret). */
function renderComputedOnly() {
  recompute();
  renderSaveStatus();
  renderSummaryStrip();
  updateIngredientCostCells();
  updatePackagingCostCells();
  renderLaborSummary();
  renderCostsSummary();
  renderResults();
  renderTools();
}
function updateIngredientCostCells() {
  const detailed = state.result.ingredientsDetailed;
  qsa('#ingredientTbody tr[data-id]').forEach(tr => {
    const idx = state.recipe.ingredients.findIndex(i => i.id === tr.dataset.id);
    if (idx === -1) return;
    const d = detailed[idx];
    const cell = tr.querySelector('.calc-cost');
    if (cell) cell.textContent = U.fmt$(d.cost);
    tr.classList.toggle('row-error', !!d.error);
    const msgEl = tr.querySelector('.row-error-text');
    if (msgEl) {
      msgEl.hidden = !d.error;
      msgEl.textContent = d.error ? '⚠️ ' + d.message : '';
    }
  });
}
function updatePackagingCostCells() {
  const detailed = state.result.packagingDetailed;
  qsa('#packagingTbody tr[data-id]').forEach(tr => {
    const idx = state.recipe.packaging.findIndex(p => p.id === tr.dataset.id);
    if (idx === -1) return;
    const cell = tr.querySelector('.calc-cost');
    if (cell) cell.textContent = U.fmt$(detailed[idx].cost);
  });
}
function renderTools() {
  const tab = state.activeToolTab;
  if (tab === 'simulator') renderSimulator();
  else if (tab === 'discount') renderDiscount();
  else if (tab === 'inflation') renderInflation();
  else if (tab === 'wholesale') renderWholesale();
  else if (tab === 'order') renderOrderCalc();
}

/* ==========================================================================
   8. EVENT WIRING
   ========================================================================== */

const persistDraft = U.debounce(() => STORE.saveDraft(state.recipe), 400);
function onFieldChanged() {
  state.recipe.updatedAt = Date.now();
  persistDraft();
  renderComputedOnly();
}

function setActiveTab(tab) {
  state.activeTab = tab;
  qsa('.tab-panel').forEach(p => p.hidden = p.id !== 'panel-' + tab);
  qsa('.tabs [role="tab"]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
  if (tab === 'library') renderLibraryTab();
  if (tab === 'tools') renderTools();
  window.scrollTo({ top: el('mainRegion').offsetTop - 8, behavior: 'smooth' });
}

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  el('modeQuickBtn').setAttribute('aria-pressed', mode === 'quick' ? 'true' : 'false');
  el('modeFullBtn').setAttribute('aria-pressed', mode === 'full' ? 'true' : 'false');
  const settings = STORE.getSettings(); settings.mode = mode; STORE.saveSettings(settings);
  if (mode === 'quick' && (state.activeTab === 'tools')) setActiveTab('setup');
}

function loadRecipeIntoState(recipe) {
  state.recipe = recipe;
  state.savedSnapshot = STORE.getRecipes().some(r => r.id === recipe.id) ? JSON.stringify(recipe) : null;
  state.simPrice = null;
  state.simPriceIsCustom = false;
  STORE.saveDraft(recipe);
  renderAll();
}

function wireEvents() {
  // Tabs. Roving tabindex means only the active tab is normally Tab-reachable,
  // so arrow keys (the standard ARIA tabs pattern) must move focus between them.
  const tabButtons = qsa('.tabs [role="tab"]');
  tabButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      const visible = tabButtons.filter(b => b.offsetParent !== null);
      const idx = visible.indexOf(btn);
      let next = null;
      if (e.key === 'ArrowRight') next = visible[(idx + 1) % visible.length];
      else if (e.key === 'ArrowLeft') next = visible[(idx - 1 + visible.length) % visible.length];
      else if (e.key === 'Home') next = visible[0];
      else if (e.key === 'End') next = visible[visible.length - 1];
      if (next) { e.preventDefault(); setActiveTab(next.dataset.tab); next.focus(); }
    });
  });
  qsa('.tool-tabs button').forEach(btn => btn.addEventListener('click', () => {
    state.activeToolTab = btn.dataset.tool;
    qsa('.tool-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    qsa('.tool-panel').forEach(p => p.hidden = p.id !== 'tool-' + btn.dataset.tool);
    renderTools();
  }));

  // Mode toggle
  el('modeQuickBtn').addEventListener('click', () => setMode('quick'));
  el('modeFullBtn').addEventListener('click', () => setMode('full'));

  // Recipe bar
  el('recipeSelect').addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) { loadRecipeIntoState(newRecipe()); return; }
    const rec = STORE.getRecipes().find(r => r.id === id);
    if (rec) loadRecipeIntoState(JSON.parse(JSON.stringify(rec)));
  });
  el('newRecipeBtn').addEventListener('click', () => {
    if (isDirty() && !confirm('Start a new recipe? Unsaved changes to the current recipe will be lost unless you save first.')) return;
    loadRecipeIntoState(newRecipe());
  });
  el('saveRecipeBtn').addEventListener('click', () => {
    if (!state.recipe.name || !state.recipe.name.trim()) {
      const name = prompt('Name this recipe:', 'Untitled Recipe');
      if (name === null) return;
      state.recipe.name = name.trim() || 'Untitled Recipe';
    }
    const list = STORE.getRecipes();
    const idx = list.findIndex(r => r.id === state.recipe.id);
    state.recipe.updatedAt = Date.now();
    if (idx >= 0) list[idx] = state.recipe; else list.push(state.recipe);
    STORE.saveRecipes(list);
    state.savedSnapshot = JSON.stringify(state.recipe);
    renderRecipeSelect(); renderSaveStatus(); renderLibraryTab();
  });
  el('renameRecipeBtn').addEventListener('click', () => {
    const name = prompt('Rename recipe:', state.recipe.name);
    if (name === null || !name.trim()) return;
    state.recipe.name = name.trim();
    onFieldChanged(); renderSetup(); renderRecipeSelect();
    const list = STORE.getRecipes();
    const idx = list.findIndex(r => r.id === state.recipe.id);
    if (idx >= 0) { list[idx] = state.recipe; STORE.saveRecipes(list); state.savedSnapshot = JSON.stringify(state.recipe); renderSaveStatus(); }
  });
  el('duplicateRecipeBtn').addEventListener('click', () => {
    const copy = JSON.parse(JSON.stringify(state.recipe));
    copy.id = U.id(); copy.name = state.recipe.name + ' (Copy)'; copy.updatedAt = Date.now();
    const list = STORE.getRecipes(); list.push(copy); STORE.saveRecipes(list);
    loadRecipeIntoState(copy);
  });
  el('deleteRecipeBtn').addEventListener('click', () => {
    const list = STORE.getRecipes();
    const idx = list.findIndex(r => r.id === state.recipe.id);
    if (idx === -1) { alert('This recipe has not been saved yet.'); return; }
    if (!confirm(`Delete "${state.recipe.name}"? This can't be undone.`)) return;
    list.splice(idx, 1); STORE.saveRecipes(list);
    loadRecipeIntoState(newRecipe());
  });
  el('exportRecipeBtn').addEventListener('click', exportRecipe);
  el('importRecipeInput').addEventListener('change', importRecipe);
  el('printReportBtn').addEventListener('click', () => { renderPrintReport(); window.print(); });

  // ---- Setup tab ----
  el('f-name').addEventListener('input', e => { state.recipe.name = e.target.value; onFieldChanged(); });
  el('f-category').addEventListener('change', e => { state.recipe.category = e.target.value; onFieldChanged(); });
  el('f-yieldQty').addEventListener('input', e => { state.recipe.yieldQty = e.target.value; onFieldChanged(); });
  el('f-yieldUnit').addEventListener('change', e => {
    state.recipe.yieldUnit = e.target.value;
    state.recipe.formats = [];
    el('f-yieldCustomWrap').hidden = e.target.value !== 'custom';
    onFieldChanged();
  });
  el('f-yieldCustomLabel').addEventListener('input', e => { state.recipe.yieldCustomLabel = e.target.value; onFieldChanged(); });
  el('f-currentPrice').addEventListener('input', e => { state.recipe.currentPrice = e.target.value; onFieldChanged(); });

  // ---- Ingredients tab ----
  el('addIngredientBtn').addEventListener('click', () => {
    state.recipe.ingredients.push(newIngredientRow());
    onFieldChanged(); renderIngredients();
  });
  function handleIngredientFieldEvent(e) {
    const field = e.target.dataset.field; if (!field) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    const ing = state.recipe.ingredients.find(i => i.id === id); if (!ing) return;
    ing[field] = e.target.value;
    onFieldChanged();
  }
  // Bound to both events: modern browsers fire 'input' for <select> too, but
  // binding 'change' as well keeps unit dropdowns reliable everywhere.
  el('ingredientTbody').addEventListener('input', handleIngredientFieldEvent);
  el('ingredientTbody').addEventListener('change', handleIngredientFieldEvent);
  // Enforce Title Case on ingredient names once the baker finishes typing.
  el('ingredientTbody').addEventListener('blur', e => {
    if (e.target.dataset.field !== 'name') return;
    e.target.value = U.toTitleCase(e.target.value);
    handleIngredientFieldEvent(e);
  }, true);
  el('ingredientTbody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    const idx = state.recipe.ingredients.findIndex(i => i.id === id);
    if (btn.dataset.action === 'del') { state.recipe.ingredients.splice(idx, 1); }
    else if (btn.dataset.action === 'dup') { const copy = Object.assign({}, state.recipe.ingredients[idx], { id: U.id() }); state.recipe.ingredients.splice(idx + 1, 0, copy); }
    else if (btn.dataset.action === 'save-lib') {
      const ing = state.recipe.ingredients[idx];
      if (!ing.name.trim()) { alert('Give this ingredient a name before saving it to your library.'); return; }
      ing.name = U.toTitleCase(ing.name);
      const lib = STORE.getLibrary();
      const libItem = { id: U.id(), name: ing.name, purchasePrice: U.num(ing.purchasePrice), packageQty: U.num(ing.packageQty), packageUnit: ing.packageUnit };
      lib.push(libItem); STORE.saveLibrary(lib);
      ing.libraryId = libItem.id;
      renderLibraryDatalist(); renderLibraryQuickAdd();
      el('saveStatus').textContent = 'Saved "' + ing.name + '" to your ingredient library';
      setTimeout(renderSaveStatus, 2000);
      return;
    }
    onFieldChanged(); renderIngredients();
  });
  el('libraryQuickAddBtn').addEventListener('click', () => {
    const id = el('libraryQuickSelect').value; if (!id) return;
    const item = STORE.getLibrary().find(l => l.id === id); if (!item) return;
    state.recipe.ingredients.push({ id: U.id(), name: item.name, purchasePrice: item.purchasePrice, packageQty: item.packageQty, packageUnit: item.packageUnit, recipeQty: '', recipeUnit: item.packageUnit, wastePct: '', libraryId: item.id });
    el('libraryQuickSelect').value = '';
    onFieldChanged(); renderIngredients();
  });

  // ---- Packaging tab ----
  el('addPackagingBtn').addEventListener('click', () => { state.recipe.packaging.push(newPackagingRow()); onFieldChanged(); renderPackaging(); });
  el('packagingTbody').addEventListener('input', e => {
    const field = e.target.dataset.field; if (!field) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    const p = state.recipe.packaging.find(x => x.id === id); if (!p) return;
    p[field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (field === 'directMode') { onFieldChanged(); renderPackaging(); return; }
    onFieldChanged();
  });
  el('packagingTbody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    const idx = state.recipe.packaging.findIndex(p => p.id === id);
    if (btn.dataset.action === 'del') state.recipe.packaging.splice(idx, 1);
    else if (btn.dataset.action === 'dup') { const copy = Object.assign({}, state.recipe.packaging[idx], { id: U.id() }); state.recipe.packaging.splice(idx + 1, 0, copy); }
    onFieldChanged(); renderPackaging();
  });

  // ---- Labor tab ----
  el('f-wage').addEventListener('input', e => { state.recipe.labor.hourlyWage = e.target.value; onFieldChanged(); });
  el('f-includeCooling').addEventListener('change', e => { state.recipe.labor.includeCooling = e.target.checked; onFieldChanged(); });
  LABOR_CATEGORIES.forEach(cat => {
    ['h', 'm'].forEach(unit => {
      const input = el('labor-' + unit + '-' + cat.key);
      if (input) input.addEventListener('input', () => { state.recipe.labor.minutes[cat.key] = laborMinutesFromInputs(cat.key); onFieldChanged(); });
    });
  });

  // ---- Costs tab: overhead ----
  qsa('input[name="overheadMode"]').forEach(radio => radio.addEventListener('change', e => {
    state.recipe.overhead.mode = e.target.value;
    el('overheadSimplePanel').hidden = e.target.value !== 'simple';
    el('overheadAdvancedPanel').hidden = e.target.value !== 'advanced';
    onFieldChanged();
  }));
  el('f-overheadSimplePct').addEventListener('input', e => { state.recipe.overhead.simplePct = e.target.value; onFieldChanged(); });
  OVERHEAD_CATEGORIES.forEach(c => {
    const input = el('oh-' + c.key);
    if (input) input.addEventListener('input', e => { state.recipe.overhead.monthly[c.key] = e.target.value; onFieldChanged(); });
  });
  qsa('input[name="allocationBasis"]').forEach(radio => radio.addEventListener('change', e => {
    state.recipe.overhead.allocationBasis = e.target.value;
    el('allocByOrders').hidden = e.target.value !== 'orders';
    el('allocByHours').hidden = e.target.value !== 'hours';
    onFieldChanged();
  }));
  el('f-monthlyOrders').addEventListener('input', e => { state.recipe.overhead.monthlyOrders = e.target.value; onFieldChanged(); });
  el('f-monthlyHours').addEventListener('input', e => { state.recipe.overhead.monthlyHours = e.target.value; onFieldChanged(); });

  // ---- Costs tab: fees ----
  [['f-paymentPct', 'paymentPct'], ['f-paymentFixed', 'paymentFixed'], ['f-platformPct', 'platformPct'], ['f-commissionPct', 'commissionPct'], ['f-delivery', 'delivery'], ['f-otherPerOrder', 'otherPerOrder'], ['f-itemsPerOrder', 'itemsPerOrder']].forEach(([elemId, field]) => {
    el(elemId).addEventListener('input', e => { state.recipe.fees[field] = e.target.value; onFieldChanged(); });
  });

  // ---- Costs tab: buffer ----
  [['f-productionWastePct', 'productionWastePct'], ['f-failedBatchPct', 'failedBatchPct'], ['f-samplesPct', 'samplesPct'], ['f-ingredientBufferPct', 'ingredientBufferPct']].forEach(([elemId, field]) => {
    el(elemId).addEventListener('input', e => { state.recipe.buffer[field] = e.target.value; onFieldChanged(); });
  });

  // ---- Pricing tab ----
  function syncMargin(v) { state.recipe.pricing.targetMarginPct = v; el('f-targetMargin').value = v; el('f-targetMarginRange').value = v; onFieldChanged(); }
  el('f-targetMargin').addEventListener('input', e => syncMargin(e.target.value));
  el('f-targetMarginRange').addEventListener('input', e => syncMargin(e.target.value));
  el('f-roundingStyle').addEventListener('change', e => { state.recipe.pricing.roundingStyle = e.target.value; onFieldChanged(); });
  el('f-premiumPct').addEventListener('input', e => { state.recipe.pricing.premiumPct = e.target.value; onFieldChanged(); });
  el('addFormatBtn').addEventListener('click', () => {
    if (!state.recipe.formats || !state.recipe.formats.length) state.recipe.formats = CALC.defaultFormats(state.recipe).map(f => Object.assign({}, f, { id: U.id() }));
    state.recipe.formats.push({ id: U.id(), label: 'Custom', mult: 1 });
    onFieldChanged(); renderFormatsEditor();
  });
  el('formatsEditorList').addEventListener('input', e => {
    const field = e.target.dataset.field; if (!field) return;
    const row = e.target.closest('.format-row'); const id = row.dataset.id;
    const f = state.recipe.formats.find(x => x.id === id); if (!f) return;
    f[field] = e.target.value; onFieldChanged();
  });
  el('formatsEditorList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="del-format"]'); if (!btn) return;
    const row = btn.closest('.format-row'); const id = row.dataset.id;
    state.recipe.formats = state.recipe.formats.filter(f => f.id !== id);
    onFieldChanged(); renderFormatsEditor();
  });

  // ---- Tools tab ----
  el('simRange').addEventListener('input', e => { state.simPrice = U.num(e.target.value); state.simPriceIsCustom = true; el('simPriceInput').value = state.simPrice; renderSimulator(); });
  el('simPriceInput').addEventListener('input', e => { state.simPrice = U.num(e.target.value); state.simPriceIsCustom = true; el('simRange').value = state.simPrice; renderSimulator(); });
  el('simResetBtn').addEventListener('click', () => { state.simPriceIsCustom = false; renderSimulator(); });

  qsa('input[name="discountPreset"]').forEach(r => r.addEventListener('change', e => { if (e.target.value !== 'custom') { state.discountPct = U.num(e.target.value); el('discountCustom').value = ''; renderDiscount(); } }));
  el('discountCustom').addEventListener('input', e => { if (e.target.value !== '') { state.discountPct = U.num(e.target.value); qsa('input[name="discountPreset"]').forEach(r => r.checked = r.value === 'custom'); renderDiscount(); } });

  qsa('input[name="inflationPreset"]').forEach(r => r.addEventListener('change', e => { if (e.target.value !== 'custom') { state.inflationPct = U.num(e.target.value); el('inflationCustom').value = ''; renderInflation(); } }));
  el('inflationCustom').addEventListener('input', e => { if (e.target.value !== '') { state.inflationPct = U.num(e.target.value); qsa('input[name="inflationPreset"]').forEach(r => r.checked = r.value === 'custom'); renderInflation(); } });

  el('f-wholesalePrice').addEventListener('input', e => { state.wholesalePrice = e.target.value; renderWholesale(); });
  el('f-wholesaleRetail').addEventListener('input', e => { state.wholesaleRetail = e.target.value; renderWholesale(); });
  el('f-wholesaleMinMargin').addEventListener('input', e => { state.wholesaleMinMargin = U.num(e.target.value); renderWholesale(); });

  ['qty', 'price', 'customLaborHours', 'delivery', 'discountPct'].forEach(field => {
    el('order-' + field).addEventListener('input', e => { state.order[field] = e.target.value; renderOrderCalc(); });
  });

  // ---- Library tab ----
  function handleLibraryFieldEvent(e) {
    const field = e.target.dataset.field; if (!field) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    const lib = STORE.getLibrary(); const item = lib.find(l => l.id === id); if (!item) return;
    item[field] = e.target.value; STORE.saveLibrary(lib);
    renderLibraryDatalist(); renderLibraryQuickAdd();
  }
  el('libraryTable').addEventListener('input', handleLibraryFieldEvent);
  el('libraryTable').addEventListener('change', handleLibraryFieldEvent);
  el('libraryTable').addEventListener('blur', e => {
    if (e.target.dataset.field !== 'name') return;
    e.target.value = U.toTitleCase(e.target.value);
    handleLibraryFieldEvent(e);
  }, true);
  el('libraryTable').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const tr = e.target.closest('tr[data-id]'); const id = tr.dataset.id;
    if (btn.dataset.action === 'del-lib') {
      if (!confirm('Remove this ingredient from your library? Recipes that already used it keep their own saved values.')) return;
      STORE.saveLibrary(STORE.getLibrary().filter(l => l.id !== id));
      renderLibraryTab(); renderLibraryDatalist(); renderLibraryQuickAdd();
    } else if (btn.dataset.action === 'add-to-recipe') {
      const item = STORE.getLibrary().find(l => l.id === id); if (!item) return;
      state.recipe.ingredients.push({ id: U.id(), name: item.name, purchasePrice: item.purchasePrice, packageQty: item.packageQty, packageUnit: item.packageUnit, recipeQty: '', recipeUnit: item.packageUnit, wastePct: '', libraryId: item.id });
      onFieldChanged(); renderIngredients();
      alert(`Added "${item.name}" to the current recipe's ingredient list.`);
    }
  });
  el('savedRecipesList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const card = btn.closest('.recipe-card'); const id = card.dataset.id;
    const list = STORE.getRecipes();
    const idx = list.findIndex(r => r.id === id);
    if (btn.dataset.action === 'load-recipe') { if (idx >= 0) loadRecipeIntoState(JSON.parse(JSON.stringify(list[idx]))); }
    else if (btn.dataset.action === 'rename-recipe') {
      const name = prompt('Rename recipe:', list[idx].name); if (!name) return;
      list[idx].name = name.trim(); list[idx].updatedAt = Date.now(); STORE.saveRecipes(list);
      if (state.recipe.id === id) { state.recipe.name = list[idx].name; state.savedSnapshot = JSON.stringify(state.recipe); renderSetup(); renderSaveStatus(); }
      renderLibraryTab(); renderRecipeSelect();
    } else if (btn.dataset.action === 'dup-recipe') {
      const copy = JSON.parse(JSON.stringify(list[idx])); copy.id = U.id(); copy.name += ' (Copy)'; copy.updatedAt = Date.now();
      list.push(copy); STORE.saveRecipes(list); renderLibraryTab(); renderRecipeSelect();
    } else if (btn.dataset.action === 'del-recipe') {
      if (!confirm(`Delete "${list[idx].name}"? This can't be undone.`)) return;
      const wasCurrent = state.recipe.id === id;
      list.splice(idx, 1); STORE.saveRecipes(list);
      if (wasCurrent) loadRecipeIntoState(newRecipe()); else { renderLibraryTab(); renderRecipeSelect(); }
    }
  });
}

/* ---- Export / Import ---- */
function exportRecipe() {
  const data = JSON.stringify(state.recipe, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (state.recipe.name || 'recipe').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'recipe';
  a.href = url; a.download = `${safeName}.bakerspricinglab.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importRecipe(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !Array.isArray(data.ingredients)) throw new Error('shape');
      data.id = U.id(); data.updatedAt = Date.now();
      const list = STORE.getRecipes(); list.push(data); STORE.saveRecipes(list);
      loadRecipeIntoState(data);
      alert(`Imported "${data.name || 'recipe'}" and saved it to My Recipes.`);
    } catch (err) {
      alert('That file doesn\'t look like a valid Baker\'s Pricing Lab recipe export.');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   9. INIT
   ========================================================================== */

function buildStaticTables() {
  el('laborTbody').innerHTML = LABOR_CATEGORIES.map(c =>
    `<tr><td data-label="Activity">${c.label}</td>
      <td data-label="Hours"><input type="number" min="0" step="1" id="labor-h-${c.key}" aria-label="${c.label} hours"></td>
      <td data-label="Minutes"><input type="number" min="0" max="59" step="1" id="labor-m-${c.key}" aria-label="${c.label} minutes"></td></tr>`
  ).join('');
  el('overheadMonthlyGrid').innerHTML = OVERHEAD_CATEGORIES.map(c =>
    `<div class="field"><label for="oh-${c.key}">${c.label}</label><div class="input-prefix">$<input type="number" min="0" step="1" id="oh-${c.key}"></div></div>`
  ).join('');
}

function init() {
  seedLibraryIfNeeded();
  buildStaticTables();
  const settings = STORE.getSettings();
  setMode(settings.mode === 'full' ? 'full' : 'quick');

  const draft = STORE.getDraft();
  state.recipe = draft || newRecipe();
  state.savedSnapshot = STORE.getRecipes().some(r => r.id === state.recipe.id) ? JSON.stringify(state.recipe) : null;

  wireEvents();
  setActiveTab('setup');
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

/* ==========================================================================
   6. RENDER HELPERS
   ========================================================================== */

function unitOptionsHtml(selected) {
  return UNIT_GROUPS.map(g => `<optgroup label="${g.label}">${g.units.map(u => `<option value="${u}" ${u === selected ? 'selected' : ''}>${UNIT_INFO[u].label}</option>`).join('')}</optgroup>`).join('');
}

function el(id) { return document.getElementById(id); }
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

/* ---- Recipe selector / bar ---- */
function renderRecipeSelect() {
  const list = STORE.getRecipes();
  const sel = el('recipeSelect');
  const current = state.recipe.id;
  sel.innerHTML = `<option value="">— Unsaved / New Recipe —</option>` +
    list.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${U.escapeHtml(r.name)}</option>`).join('');
  if (!list.find(r => r.id === current)) sel.value = '';
}
function renderSaveStatus() {
  const dirty = isDirty();
  const onList = STORE.getRecipes().some(r => r.id === state.recipe.id);
  const s = el('saveStatus');
  if (!onList) s.textContent = dirty ? 'Not saved yet' : 'Not saved yet';
  else s.textContent = dirty ? 'Unsaved changes' : 'Saved';
  s.className = dirty ? 'save-status dirty' : 'save-status clean';
}

/* ---- Summary strip ---- */
function renderSummaryStrip() {
  const r = state.result, rec = state.recipe;
  const unit = r.unitLabel;
  el('summaryStrip').innerHTML = `
    <div class="sum-item"><span class="sum-label">True cost / ${U.escapeHtml(unit)}</span><span class="sum-value">${U.fmt$(r.costPerUnit + r.fixedFeePerUnit)}</span></div>
    <div class="sum-item"><span class="sum-label">Recommended price</span><span class="sum-value sum-accent">${U.fmt$(r.recommendedPrice)}</span></div>
    <div class="sum-item"><span class="sum-label">Target margin</span><span class="sum-value">${U.fmtPct(r.targetMarginPct)}</span></div>
    <div class="sum-item"><span class="sum-label">Business profit / hr</span><span class="sum-value">${r.profitPerLaborHour != null ? U.fmt$(r.profitPerLaborHour) : '—'}</span></div>
    <div class="sum-item health-chip status-${r.health.status}"><span class="chip-dot" aria-hidden="true"></span>${U.escapeHtml(r.health.label)}</div>
  `;
}

/* ---- Setup tab ---- */
function renderSetup() {
  const r = state.recipe;
  el('f-name').value = r.name === 'Untitled Recipe' ? '' : r.name;
  el('f-category').innerHTML = CATEGORIES.map(c => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('');
  el('f-yieldQty').value = r.yieldQty;
  el('f-yieldUnit').innerHTML = YIELD_UNITS.map(u => `<option value="${u.value}" ${u.value === r.yieldUnit ? 'selected' : ''}>${u.label}</option>`).join('');
  el('f-yieldCustomLabel').value = r.yieldCustomLabel || '';
  el('f-yieldCustomWrap').hidden = r.yieldUnit !== 'custom';
  el('f-currentPrice').value = r.currentPrice;
}

/* ---- Ingredients tab ---- */
function ingredientRowHtml(ing, calc) {
  const errCls = calc && calc.error ? 'row-error' : '';
  const errMsg = calc && calc.error ? calc.message : '';
  return `<tr data-id="${ing.id}" class="${errCls}">
    <td data-label="Ingredient">
      <input type="text" list="libraryNames" data-field="name" value="${U.escapeHtml(ing.name)}" placeholder="e.g. Flour" aria-label="Ingredient name">
      <div class="row-error-text" ${errMsg ? '' : 'hidden'}>⚠️ ${U.escapeHtml(errMsg)}</div>
    </td>
    <td data-label="Purchase price"><div class="input-prefix">$<input type="number" min="0" step="0.01" inputmode="decimal" data-field="purchasePrice" value="${ing.purchasePrice}" aria-label="Purchase price"></div></td>
    <td data-label="Package qty"><input type="number" min="0" step="0.01" inputmode="decimal" data-field="packageQty" value="${ing.packageQty}" aria-label="Package quantity"></td>
    <td data-label="Package unit"><select data-field="packageUnit" aria-label="Package unit">${unitOptionsHtml(ing.packageUnit)}</select></td>
    <td data-label="Recipe qty"><input type="number" min="0" step="0.01" inputmode="decimal" data-field="recipeQty" value="${ing.recipeQty}" aria-label="Recipe quantity used"></td>
    <td data-label="Recipe unit"><select data-field="recipeUnit" aria-label="Recipe unit">${unitOptionsHtml(ing.recipeUnit)}</select></td>
    <td data-label="Waste %" class="full-only"><div class="input-suffix"><input type="number" min="0" max="95" step="1" inputmode="decimal" data-field="wastePct" value="${ing.wastePct}" aria-label="Waste percent">%</div></td>
    <td data-label="Cost" class="calc-cost">${calc ? U.fmt$(calc.cost) : '$0.00'}</td>
    <td data-label="Actions" class="row-actions">
      <button type="button" class="icon-btn" data-action="save-lib" title="Save to ingredient library" aria-label="Save to ingredient library">📥</button>
      <button type="button" class="icon-btn" data-action="dup" title="Duplicate row" aria-label="Duplicate ingredient">⧉</button>
      <button type="button" class="icon-btn danger" data-action="del" title="Delete row" aria-label="Delete ingredient">✕</button>
    </td>
  </tr>`;
}
function renderIngredients() {
  const r = state.recipe;
  const detailed = state.result.ingredientsDetailed;
  el('ingredientTbody').innerHTML = r.ingredients.map((ing, i) => ingredientRowHtml(ing, detailed[i])).join('') ||
    `<tr><td colspan="9" class="empty-row">No ingredients yet. Click "Add Ingredient" to start.</td></tr>`;
  renderLibraryDatalist();
  renderLibraryQuickAdd();
}
function renderLibraryDatalist() {
  const lib = STORE.getLibrary();
  el('libraryNames').innerHTML = lib.map(l => `<option value="${U.escapeHtml(l.name)}">`).join('');
}
function renderLibraryQuickAdd() {
  const lib = STORE.getLibrary();
  el('libraryQuickSelect').innerHTML = `<option value="">Choose a saved ingredient…</option>` + lib.map(l => `<option value="${l.id}">${U.escapeHtml(l.name)} — ${U.fmt$(l.purchasePrice)} / ${l.packageQty}${UNIT_INFO[l.packageUnit] ? UNIT_INFO[l.packageUnit].label : l.packageUnit}</option>`).join('');
}

/* ---- Packaging tab ---- */
function packagingRowHtml(p, cost) {
  return `<tr data-id="${p.id}">
    <td data-label="Item"><input type="text" list="packagingPresets" data-field="name" value="${U.escapeHtml(p.name)}" placeholder="e.g. Cake box" aria-label="Packaging item name"></td>
    <td data-label="Mode" class="mode-cell"><label class="tiny-check"><input type="checkbox" data-field="directMode" ${p.directMode ? 'checked' : ''}> I know the cost per batch</label></td>
    <td data-label="${p.directMode ? 'Cost' : 'Package price'}"><div class="input-prefix">$<input type="number" min="0" step="0.01" data-field="purchasePrice" value="${p.purchasePrice}" aria-label="Price"></div></td>
    <td data-label="Package qty" class="${p.directMode ? 'is-disabled' : ''}"><input type="number" min="0" step="0.01" data-field="packageQty" value="${p.packageQty}" ${p.directMode ? 'disabled' : ''} aria-label="Quantity purchased"></td>
    <td data-label="Used / batch"><input type="number" min="0" step="0.01" data-field="qtyUsedPerBatch" value="${p.qtyUsedPerBatch}" aria-label="Quantity used per batch"></td>
    <td data-label="Batch cost" class="calc-cost">${U.fmt$(cost)}</td>
    <td data-label="Actions" class="row-actions">
      <button type="button" class="icon-btn" data-action="dup" title="Duplicate row" aria-label="Duplicate packaging item">⧉</button>
      <button type="button" class="icon-btn danger" data-action="del" title="Delete row" aria-label="Delete packaging item">✕</button>
    </td>
  </tr>`;
}
function renderPackaging() {
  const r = state.recipe;
  const detailed = state.result.packagingDetailed;
  el('packagingTbody').innerHTML = r.packaging.map((p, i) => packagingRowHtml(p, detailed[i].cost)).join('') ||
    `<tr><td colspan="7" class="empty-row">No packaging or consumables added yet.</td></tr>`;
}

/* ---- Labor tab ---- */
function renderLabor() {
  const r = state.recipe;
  el('f-wage').value = r.labor.hourlyWage;
  el('f-includeCooling').checked = !!r.labor.includeCooling;
  LABOR_CATEGORIES.forEach(cat => {
    const total = U.num(r.labor.minutes[cat.key]);
    const h = Math.floor(total / 60), m = Math.round(total % 60);
    const hEl = el('labor-h-' + cat.key), mEl = el('labor-m-' + cat.key);
    if (hEl) hEl.value = h || '';
    if (mEl) mEl.value = m || '';
  });
}
function laborMinutesFromInputs(key) {
  const h = U.num(el('labor-h-' + key).value);
  const m = U.num(el('labor-m-' + key).value);
  return h * 60 + m;
}
function renderLaborSummary() {
  const r = state.result;
  el('laborSummary').innerHTML = `
    <div class="metric"><span>Total active labor time</span><strong>${U.fmtNum(r.labor.totalHours, 2)} hrs</strong></div>
    <div class="metric"><span>Labor cost for this batch</span><strong>${U.fmt$(r.labor.laborCost)}</strong></div>
    <div class="metric"><span>Effective compensation / hr (at active price)</span><strong>${r.profitPerLaborHour != null ? U.fmt$(r.labor.wage + r.profitPerLaborHour) : '—'}</strong></div>
  `;
}

/* ---- Costs tab (overhead + fees + buffer) ---- */
function renderCosts() {
  const r = state.recipe;
  qsa('input[name="overheadMode"]').forEach(radio => radio.checked = radio.value === r.overhead.mode);
  el('f-overheadSimplePct').value = r.overhead.simplePct;
  el('overheadSimplePanel').hidden = r.overhead.mode !== 'simple';
  el('overheadAdvancedPanel').hidden = r.overhead.mode !== 'advanced';
  OVERHEAD_CATEGORIES.forEach(c => { const e = el('oh-' + c.key); if (e) e.value = r.overhead.monthly[c.key]; });
  qsa('input[name="allocationBasis"]').forEach(radio => radio.checked = radio.value === r.overhead.allocationBasis);
  el('f-monthlyOrders').value = r.overhead.monthlyOrders;
  el('f-monthlyHours').value = r.overhead.monthlyHours;
  el('allocByOrders').hidden = r.overhead.allocationBasis !== 'orders';
  el('allocByHours').hidden = r.overhead.allocationBasis !== 'hours';

  el('f-paymentPct').value = r.fees.paymentPct;
  el('f-paymentFixed').value = r.fees.paymentFixed;
  el('f-platformPct').value = r.fees.platformPct;
  el('f-commissionPct').value = r.fees.commissionPct;
  el('f-delivery').value = r.fees.delivery;
  el('f-otherPerOrder').value = r.fees.otherPerOrder;
  el('f-itemsPerOrder').value = r.fees.itemsPerOrder;

  el('f-productionWastePct').value = r.buffer.productionWastePct;
  el('f-failedBatchPct').value = r.buffer.failedBatchPct;
  el('f-samplesPct').value = r.buffer.samplesPct;
  el('f-ingredientBufferPct').value = r.buffer.ingredientBufferPct;
}
function renderCostsSummary() {
  const r = state.result;
  el('overheadResultLine').textContent = `Overhead allocated to this batch: ${U.fmt$(r.overheadCost)}`;
  el('bufferResultLine').textContent = `Buffer allowance (${U.fmtPct(r.buffer.pct)} of production cost): ${U.fmt$(r.buffer.amount)}`;
  el('feesResultLine').textContent = `Estimated fees at recommended price: ${U.fmt$(r.atRecommended.feeAmount)} per ${r.unitLabel} (${U.fmtPct(r.feePctTotal)} + ${U.fmt$(r.fixedFeePerUnit)} fixed)`;
}

/* ---- Tools tab: Price Simulator ---- */
function renderSimulator() {
  const r = state.result;
  // Follow the recommended price live until the baker deliberately types or
  // drags their own value — otherwise this would silently freeze at
  // whatever the recommended price happened to be on the first render.
  if (!state.simPriceIsCustom) state.simPrice = r.recommendedPrice;
  const price = state.simPrice;
  const rangeMax = Math.max(r.recommendedPrice * 3, r.costPerUnit * 3, 10);
  el('simRange').min = 0;
  el('simRange').max = rangeMax.toFixed(2);
  el('simRange').step = 0.05;
  el('simRange').value = price;
  el('simPriceInput').value = price;

  const feeAmount = (r.feePctTotal / 100) * price + r.fixedFeePerUnit;
  const totalCostPerUnit = r.costPerUnit + feeAmount;
  const profitPerUnit = price - totalCostPerUnit;
  const revenue = price * r.safeYield;
  const totalCost = totalCostPerUnit * r.safeYield;
  const profitBatch = revenue - totalCost;
  const margin = price > 0 ? (profitPerUnit / price) * 100 : 0;
  const perHour = r.laborHours > 0 ? profitBatch / r.laborHours : null;
  const belowCost = price < totalCostPerUnit;

  el('simOutput').innerHTML = `
    ${belowCost ? `<p class="warn-text">⚠️ This price is below your true cost per ${r.unitLabel} (${U.fmt$(totalCostPerUnit)}). You would lose money on every sale.</p>` : ''}
    <div class="sim-grid">
      <div class="metric-card"><span>Revenue / batch</span><strong>${U.fmt$(revenue)}</strong></div>
      <div class="metric-card"><span>Profit / batch</span><strong class="${profitBatch<0?'neg':''}">${U.fmt$(profitBatch)}</strong></div>
      <div class="metric-card"><span>Profit margin</span><strong class="${margin<0?'neg':''}">${U.fmtPct(margin)}</strong></div>
      <div class="metric-card"><span>Profit / ${r.unitLabel}</span><strong class="${profitPerUnit<0?'neg':''}">${U.fmt$(profitPerUnit)}</strong></div>
      <div class="metric-card"><span>Business profit / labor hr</span><strong>${perHour != null ? U.fmt$(perHour) : '—'}</strong></div>
    </div>`;
}

/* ---- Tools tab: Discount Checker ---- */
function renderDiscount() {
  const r = state.result;
  const original = r.currentPrice != null ? r.currentPrice : r.recommendedPrice;
  const pct = state.discountPct;
  const discounted = original * (1 - pct / 100);

  function econ(price) {
    const fee = (r.feePctTotal / 100) * price + r.fixedFeePerUnit;
    const profit = price - r.costPerUnit - fee;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { price, profit, margin };
  }
  const before = econ(original), after = econ(discounted);
  const extraUnits = after.profit > 0 ? (before.profit / after.profit) - 1 : null;
  const belowCost = discounted < (r.costPerUnit + ((r.feePctTotal / 100) * discounted + r.fixedFeePerUnit));

  el('discountOutput').innerHTML = `
    <div class="compare-grid">
      <div></div><div class="col-head">Before</div><div class="col-head">After ${pct}% off</div>
      <div>Price</div><div>${U.fmt$(before.price)}</div><div>${U.fmt$(after.price)}</div>
      <div>Profit / ${r.unitLabel}</div><div>${U.fmt$(before.profit)}</div><div class="${after.profit<0?'neg':''}">${U.fmt$(after.profit)}</div>
      <div>Margin</div><div>${U.fmtPct(before.margin)}</div><div class="${after.margin<0?'neg':''}">${U.fmtPct(after.margin)}</div>
    </div>
    <p>${extraUnits != null ? `To earn the <em>same total profit</em> as one full-price sale, you'd need to sell about <strong>${(1+extraUnits).toFixed(2)}×</strong> as many units at this discounted price (${extraUnits*100 >= 0 ? '+' + (extraUnits*100).toFixed(0) + '% more units' : ''}).` : 'At this discount, profit per unit is zero or negative — no volume of extra sales recovers the lost profit.'}</p>
    ${belowCost ? `<p class="warn-text">⚠️ This discounted price falls below your true cost — this order would lose money.</p>` : ''}
  `;
}

/* ---- Tools tab: Inflation Stress Test ---- */
function renderInflation() {
  const rec = state.recipe, r = state.result;
  const pct = state.inflationPct;
  const inflatedIngredientCost = r.ingredientCost * (1 + pct / 100);
  const newProd = inflatedIngredientCost + r.packagingCost + r.labor.laborCost + r.overheadCost;
  const newBuffer = newProd * (r.buffer.pct / 100);
  const newTrue = newProd + newBuffer;
  const newCostPerUnit = newTrue / r.safeYield;
  const marginDenom = Math.max(1 - r.feePctTotal / 100 - r.targetMarginPct / 100, 0.05);
  const newSustainable = (newCostPerUnit + r.fixedFeePerUnit) / marginDenom;
  const priceNow = r.currentPrice != null ? r.currentPrice : r.recommendedPrice;
  const feeAtNow = (r.feePctTotal / 100) * priceNow + r.fixedFeePerUnit;
  const newProfit = priceNow - newCostPerUnit - feeAtNow;
  const newMargin = priceNow > 0 ? (newProfit / priceNow) * 100 : 0;

  el('inflationOutput').innerHTML = `
    <div class="compare-grid">
      <div></div><div class="col-head">Today</div><div class="col-head">+${pct}% ingredients</div>
      <div>Batch cost</div><div>${U.fmt$(r.trueBatchCostCore)}</div><div>${U.fmt$(newTrue)}</div>
      <div>Cost / ${r.unitLabel}</div><div>${U.fmt$(r.costPerUnit)}</div><div>${U.fmt$(newCostPerUnit)}</div>
      <div>Profit at ${U.fmt$(priceNow)}</div><div>${U.fmt$(r.atActive.profitPerUnit)}</div><div class="${newProfit<0?'neg':''}">${U.fmt$(newProfit)}</div>
      <div>Margin at ${U.fmt$(priceNow)}</div><div>${U.fmtPct(r.atActive.marginPct)}</div><div class="${newMargin<0?'neg':''}">${U.fmtPct(newMargin)}</div>
      <div>Required sustainable price</div><div>${U.fmt$(r.sustainablePrice)}</div><div>${U.fmt$(newSustainable)}</div>
    </div>
    <p class="fine-note">This tests ingredient price increases only — packaging, labor and overhead are held constant.</p>
  `;
}

/* ---- Tools tab: Wholesale Mode ---- */
function renderWholesale() {
  const r = state.result;
  const wp = U.num(state.wholesalePrice);
  const retail = U.num(state.wholesaleRetail);
  const minMargin = state.wholesaleMinMargin;
  const profit = wp - r.costPerUnit;
  const margin = wp > 0 ? (profit / wp) * 100 : 0;
  const retailerMargin = retail > 0 && wp > 0 ? ((retail - wp) / retail) * 100 : null;
  const minMarginDenom = Math.max(1 - minMargin / 100, 0.05);
  const minWholesale = r.costPerUnit / minMarginDenom;

  el('wholesaleOutput').innerHTML = `
    <div class="sim-grid">
      <div class="metric-card"><span>Wholesale revenue / ${r.unitLabel}</span><strong>${wp ? U.fmt$(wp) : '—'}</strong></div>
      <div class="metric-card"><span>Wholesale profit / ${r.unitLabel}</span><strong class="${profit<0?'neg':''}">${wp ? U.fmt$(profit) : '—'}</strong></div>
      <div class="metric-card"><span>Wholesale margin</span><strong class="${margin<0?'neg':''}">${wp ? U.fmtPct(margin) : '—'}</strong></div>
      <div class="metric-card"><span>Retailer's margin at your suggested retail</span><strong>${retailerMargin != null ? U.fmtPct(retailerMargin) : '—'}</strong></div>
      <div class="metric-card"><span>Min. wholesale price for ${U.fmtNum(minMargin)}% margin</span><strong>${U.fmt$(minWholesale)}</strong></div>
    </div>
    <p class="fine-note">⚠️ Wholesale economics depend heavily on your production scale and actual costs at higher volume — these numbers use this recipe's current costs, not a universal wholesale rule.</p>
  `;
}

/* ---- Tools tab: Order Profit Calculator ---- */
function renderOrderCalc() {
  const r = state.result;
  const o = state.order;
  const qty = Math.max(U.num(o.qty), 0);
  const price = o.price !== '' ? U.num(o.price) : r.recommendedPrice;
  const discount = U.clampPct(o.discountPct);
  const netPrice = price * (1 - discount / 100);
  const revenue = netPrice * qty;
  const ingredientTotal = (r.ingredientCost / r.safeYield) * qty;
  const packagingTotal = (r.packagingCost / r.safeYield) * qty;
  const overheadTotal = (r.overheadCost / r.safeYield + r.buffer.amount / r.safeYield) * qty;
  const laborHours = o.customLaborHours !== '' ? U.num(o.customLaborHours) : (r.labor.totalHours / r.safeYield) * qty;
  const laborTotal = laborHours * r.labor.wage;
  const feeTotal = (r.feePctTotal / 100) * revenue + r.fixedFeePerUnit * Math.ceil(qty / Math.max(r.itemsPerOrder,1));
  const delivery = U.num(o.delivery);
  const orderCost = ingredientTotal + packagingTotal + overheadTotal + laborTotal + feeTotal + delivery;
  const profit = revenue - orderCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const profitPerHour = laborHours > 0 ? profit / laborHours : null;

  el('orderOutput').innerHTML = `
    <div class="sim-grid">
      <div class="metric-card"><span>Order revenue</span><strong>${U.fmt$(revenue)}</strong></div>
      <div class="metric-card"><span>Order cost</span><strong>${U.fmt$(orderCost)}</strong></div>
      <div class="metric-card"><span>Estimated profit</span><strong class="${profit<0?'neg':''}">${U.fmt$(profit)}</strong></div>
      <div class="metric-card"><span>Margin</span><strong class="${margin<0?'neg':''}">${U.fmtPct(margin)}</strong></div>
      <div class="metric-card"><span>Total labor hours</span><strong>${U.fmtNum(laborHours,2)}</strong></div>
      <div class="metric-card"><span>Profit / labor hour</span><strong>${profitPerHour != null ? U.fmt$(profitPerHour) : '—'}</strong></div>
    </div>
    ${netPrice < (orderCost/Math.max(qty,1)) ? `<p class="warn-text">⚠️ This order's per-unit price is below cost.</p>` : ''}
  `;
}

/* ---- Library tab ---- */
function renderLibraryTab() {
  const lib = STORE.getLibrary();
  el('libraryTable').innerHTML = lib.length ? lib.map(l => `
    <tr data-id="${l.id}">
      <td data-label="Name"><input type="text" data-field="name" value="${U.escapeHtml(l.name)}" aria-label="Ingredient name"></td>
      <td data-label="Price"><div class="input-prefix">$<input type="number" min="0" step="0.01" data-field="purchasePrice" value="${l.purchasePrice}" aria-label="Price"></div></td>
      <td data-label="Package qty"><input type="number" min="0" step="0.01" data-field="packageQty" value="${l.packageQty}" aria-label="Package quantity"></td>
      <td data-label="Unit"><select data-field="packageUnit" aria-label="Package unit">${unitOptionsHtml(l.packageUnit)}</select></td>
      <td data-label="Actions" class="row-actions">
        <button type="button" class="btn btn-small" data-action="add-to-recipe">Add to recipe</button>
        <button type="button" class="icon-btn danger" data-action="del-lib" aria-label="Delete from library">✕</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="5" class="empty-row">Your ingredient library is empty. Save ingredients from the Ingredients tab (📥) to build it.</td></tr>`;

  const recipes = STORE.getRecipes();
  el('savedRecipesList').innerHTML = recipes.length ? recipes.map(rp => `
    <div class="recipe-card ${rp.id === state.recipe.id ? 'active' : ''}" data-id="${rp.id}">
      <div class="recipe-card-main">
        <strong>${U.escapeHtml(rp.name)}</strong>
        <span class="recipe-meta">${U.escapeHtml(rp.category)} · updated ${new Date(rp.updatedAt).toLocaleDateString()}</span>
      </div>
      <div class="recipe-card-actions">
        <button type="button" class="btn btn-small" data-action="load-recipe">Load</button>
        <button type="button" class="btn btn-small" data-action="rename-recipe">Rename</button>
        <button type="button" class="btn btn-small" data-action="dup-recipe">Duplicate</button>
        <button type="button" class="btn btn-small danger" data-action="del-recipe">Delete</button>
      </div>
    </div>`).join('') : `<p class="fine-note">No saved recipes yet. Use "Save" in the bar above to save your current recipe.</p>`;
}

/* ---- Print report ---- */
function renderPrintReport() {
  const r = state.result, rec = state.recipe;
  el('printReport').innerHTML = `
    <div class="print-header">
      <h1>The Baker's Pricing Lab — Pricing Report</h1>
      <p>${U.escapeHtml(rec.name || 'Untitled Recipe')} · ${U.escapeHtml(rec.category)} · ${U.todayStr()}</p>
    </div>
    <h2>Yield</h2>
    <p>${U.fmtNum(r.yieldQty)} ${r.unitLabelPlural}</p>
    <h2>Cost Breakdown</h2>
    <table class="print-table">
      <tr><td>Ingredients</td><td>${U.fmt$(r.ingredientCost)}</td></tr>
      <tr><td>Packaging</td><td>${U.fmt$(r.packagingCost)}</td></tr>
      <tr><td>Labor</td><td>${U.fmt$(r.labor.laborCost)}</td></tr>
      <tr><td>Overhead</td><td>${U.fmt$(r.overheadCost)}</td></tr>
      <tr><td>Waste / buffer</td><td>${U.fmt$(r.buffer.amount)}</td></tr>
      <tr class="total"><td>TOTAL TRUE BATCH COST</td><td>${U.fmt$(r.trueBatchCostCore)}</td></tr>
      <tr class="total"><td>TRUE COST PER ${r.unitLabel.toUpperCase()}</td><td>${U.fmt$(r.costPerUnit)}</td></tr>
    </table>
    <h2>Pricing Recommendation</h2>
    <table class="print-table">
      <tr><td>Cost Floor (no profit)</td><td>${U.fmt$(r.costFloor)}</td></tr>
      <tr><td>Sustainable Price (${U.fmtPct(r.targetMarginPct)} margin)</td><td>${U.fmt$(r.sustainablePrice)}</td></tr>
      <tr class="total"><td>Recommended Selling Price</td><td>${U.fmt$(r.recommendedPrice)}</td></tr>
      <tr><td>Premium / Custom Reference</td><td>${U.fmt$(r.premiumPrice)}</td></tr>
    </table>
    ${r.currentPrice != null ? `<h2>Current Price Comparison</h2><p>Current price: ${U.fmt$(r.currentPrice)} — Profit/${r.unitLabel}: ${U.fmt$(r.atCurrent.profitPerUnit)} (${U.fmtPct(r.atCurrent.marginPct)} margin)</p>` : ''}
    <h2>Profitability Metrics</h2>
    <table class="print-table">
      <tr><td>Revenue per batch</td><td>${U.fmt$(r.revenuePerBatch)}</td></tr>
      <tr><td>Profit per batch</td><td>${U.fmt$(r.profitPerBatch)}</td></tr>
      <tr><td>Profit margin</td><td>${U.fmtPct(r.atActive.marginPct)}</td></tr>
      <tr><td>Markup</td><td>${U.fmtPct(r.atActive.markupPct)}</td></tr>
      <tr><td>Active labor hours</td><td>${U.fmtNum(r.laborHours,2)}</td></tr>
      <tr><td>Business profit per labor hour</td><td>${r.profitPerLaborHour != null ? U.fmt$(r.profitPerLaborHour) : '—'}</td></tr>
    </table>
    <p class="print-disclaimer">This report is provided for educational and business-planning purposes. Costs, taxes, regulations, market conditions and business circumstances vary. Pricing recommendations are estimates based on the information you enter and are not financial, tax or legal advice.</p>
  `;
}

/* ---- Pricing & Results tab ---- */
function renderPricing() {
  const r = state.recipe;
  el('f-targetMargin').value = r.pricing.targetMarginPct;
  el('f-targetMarginRange').value = r.pricing.targetMarginPct;
  el('f-roundingStyle').innerHTML = ROUNDING_STYLES.map(s => `<option value="${s.value}" ${s.value === r.pricing.roundingStyle ? 'selected' : ''}>${s.label}</option>`).join('');
  el('f-premiumPct').value = r.pricing.premiumPct;
  renderFormatsEditor();
}
function renderFormatsEditor() {
  const r = state.recipe;
  if (!r.formats || !r.formats.length) r.formats = CALC.defaultFormats(r).map(f => Object.assign({}, f, { id: U.id() }));
  const formats = r.formats;
  el('formatsEditorList').innerHTML = formats.map(f => `
    <div class="format-row" data-id="${f.id}">
      <input type="text" data-field="label" value="${U.escapeHtml(f.label)}" aria-label="Format name" placeholder="Label">
      <input type="number" min="0.01" step="0.01" data-field="mult" value="${f.mult}" aria-label="Multiple of base unit" placeholder="× units">
      <button type="button" class="icon-btn danger" data-action="del-format" aria-label="Remove format">✕</button>
    </div>`).join('');
}
function renderResults() {
  const r = state.result;
  const rec = state.recipe;

  // True batch cost breakdown
  el('trueCostBreakdown').innerHTML = [
    ['Ingredients', r.ingredientCost],
    ['Packaging', r.packagingCost],
    ['Labor', r.labor.laborCost],
    ['Overhead', r.overheadCost],
    ['Waste / business buffer', r.buffer.amount]
  ].map(([label, amt]) => `<div class="breakdown-row"><span>${label}</span><span>${U.fmt$(amt)}</span></div>`).join('') +
    `<div class="breakdown-row total"><span>TOTAL TRUE BATCH COST</span><span>${U.fmt$(r.trueBatchCostCore)}</span></div>
     <div class="breakdown-row"><span>÷ Yield (${U.fmtNum(r.yieldQty)} ${r.unitLabelPlural})</span><span></span></div>
     <div class="breakdown-row total accent"><span>TRUE COST PER ${r.unitLabel.toUpperCase()}</span><span>${U.fmt$(r.costPerUnit)}</span></div>
     <p class="fine-note">Selling/transaction fees aren't fixed dollar costs — they scale with your price. See the estimate below and the full picture in "Where does my money go."</p>
     <div class="breakdown-row"><span>Est. selling/transaction fees (at recommended price)</span><span>${U.fmt$(r.atRecommended.feeAmount)}</span></div>`;

  // Recommended price levels
  el('priceLevels').innerHTML = `
    <div class="price-card floor">
      <h4>Cost Floor</h4>
      <div class="price-big">${U.fmt$(r.costFloor)}</div>
      <p>The minimum price that approximately covers your calculated business costs, including your labor wage.</p>
      <p class="warn-text">⚠️ This is not a recommended selling price — at this level the business has little or no operating profit.</p>
    </div>
    <div class="price-card sustainable">
      <h4>Sustainable Price</h4>
      <div class="price-big">${U.fmt$(r.sustainablePrice)}</div>
      <p>The exact price required to hit your ${U.fmtPct(r.targetMarginPct)} target profit margin.</p>
    </div>
    <div class="price-card recommended">
      <h4>Recommended Selling Price</h4>
      <div class="price-big">${U.fmt$(r.recommendedPrice)}</div>
      <p>Sustainable price rounded to a commercially practical amount (${ROUNDING_STYLES.find(s=>s.value===rec.pricing.roundingStyle).label}). Never rounded below the sustainable price.</p>
    </div>
    <div class="price-card premium full-only">
      <h4>Premium / Custom Reference</h4>
      <div class="price-big">${U.fmt$(r.premiumPrice)}</div>
      <p>A scenario price with a ${U.fmtNum(rec.pricing.premiumPct)}% premium for custom design, rush orders, or difficult flavors — not an industry standard.</p>
    </div>
  `;

  // Price per format
  el('priceFormatsOut').innerHTML = r.formats.map(f => `<div class="format-out"><span>${U.escapeHtml(f.label)}</span><strong>${U.fmt$(f.price)}</strong></div>`).join('') +
    `<div class="format-out batch"><span>Per Batch (${U.fmtNum(r.yieldQty)} ${r.unitLabelPlural})</span><strong>${U.fmt$(r.pricePerBatch)}</strong></div>`;

  // Where does my money go
  renderMoneyChart(r.moneyBreakdown, r.recommendedPrice);

  // Health check
  const h = r.health;
  el('healthCheckCard').innerHTML = `
    <div class="health-pill status-${h.status}"><span class="chip-dot" aria-hidden="true"></span>${U.escapeHtml(h.label)}</div>
    <p>${U.escapeHtml(h.message)}</p>
    ${h.suggestion ? `<p class="suggestion">💡 ${U.escapeHtml(h.suggestion)}</p>` : ''}
  `;

  // Dashboard
  el('dashboardGrid').innerHTML = [
    ['Revenue per batch', U.fmt$(r.revenuePerBatch)],
    ['Total cost per batch', U.fmt$(r.totalCostPerBatch)],
    ['Profit per batch', U.fmt$(r.profitPerBatch)],
    ['Profit margin', U.fmtPct(r.atActive.marginPct)],
    ['Markup', U.fmtPct(r.atActive.markupPct)],
    ['Cost per ' + r.unitLabel, U.fmt$(r.costPerUnit)],
    ['Profit per ' + r.unitLabel, U.fmt$(r.atActive.profitPerUnit)],
    ['Active labor hours', U.fmtNum(r.laborHours, 2)],
    ['Revenue per labor hour', r.revenuePerLaborHour != null ? U.fmt$(r.revenuePerLaborHour) : '—'],
    ['Business profit per labor hour', r.profitPerLaborHour != null ? U.fmt$(r.profitPerLaborHour) : '—'],
    ['Break-even units', r.breakEvenUnits != null ? U.fmtNum(r.breakEvenUnits, 1) : '—']
  ].map(([label, val]) => `<div class="metric-card"><span>${label}</span><strong>${val}</strong></div>`).join('');

  // Warnings
  renderWarnings();
}
function renderWarnings() {
  const r = state.result;
  const box = el('warningsList');
  if (!r.warnings.length) { box.innerHTML = `<p class="fine-note">No smart warnings right now — your numbers look internally consistent.</p>`; return; }
  box.innerHTML = r.warnings.map(w => `<div class="warning-item level-${w.level}"><span class="warn-icon" aria-hidden="true">${w.level === 'danger' ? '⛔' : w.level === 'warn' ? '⚠️' : 'ℹ️'}</span><span>${U.escapeHtml(w.text)}</span></div>`).join('');
}

/* ---- Money donut/bar chart (pure SVG, no libraries) ---- */
function renderMoneyChart(breakdown, total) {
  const rows = breakdown.rows;
  const size = 160, r = 60, cx = 80, cy = 80, circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = rows.filter(row => row.amount > 0).map(row => {
    const frac = total > 0 ? row.amount / total : 0;
    const dash = frac * circumference;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${row.color}" stroke-width="26" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"><title>${U.escapeHtml(row.label)}: ${U.fmt$(row.amount)} (${row.pct.toFixed(1)}%)</title></circle>`;
    offset += dash;
    return seg;
  }).join('');
  el('moneyDonut').innerHTML = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Cost and profit breakdown of the recommended selling price" width="${size}" height="${size}">
    ${segments}
    <circle cx="${cx}" cy="${cy}" r="${r - 20}" fill="var(--surface)"></circle>
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="donut-total">${U.fmt$(total)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-caption">per ${U.escapeHtml(state.result.unitLabel)}</text>
  </svg>`;
  el('moneyLegend').innerHTML = rows.map(row => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${row.color}" aria-hidden="true"></span>
      <span class="legend-label">${row.label}</span>
      <span class="legend-amt">${U.fmt$(row.amount)}</span>
      <span class="legend-pct">${row.pct.toFixed(1)}%</span>
    </div>`).join('');
}



export const productSetupSteps = ["Basics", "Variants & price", "Images", "Stock", "Review"];

export function productSetupProblems(form, variants, allowedTypes) {
  const errors = [], add = (step, field, message) => errors.push({ step, field, message });
  if (!allowedTypes.some(type => type.vertical === form.vertical)) add(0, "vertical", "Choose a product type enabled for this tenant.");
  if (!/^[A-Z0-9][A-Z0-9_-]{1,59}$/.test(form.productCode.trim())) add(0, "productCode", "Use 2–60 letters, numbers, hyphens or underscores for the product code.");
  if (form.name.trim().length < 2) add(0, "name", "Enter a product name with at least two characters.");
  if (!/^[A-Z]{2}$/.test(form.countryOfOrigin.trim())) add(0, "countryOfOrigin", "Enter a two-letter country code, such as IN.");
  const names = form.customFields.map(field => field.label.trim().toLocaleLowerCase("en-IN"));
  if (new Set(names).size !== names.length) add(0, "customFields", "Give each additional specification a unique name.");
  if (!variants.length || variants.length > 100) add(1, "variants", "Create between 1 and 100 variants.");
  const skus = new Set();
  for (const variant of variants) {
    const field = name => `variant:${variant.key}:${name}`, sku = variant.sku.trim().toUpperCase();
    if (sku.length < 2 || sku.length > 100) add(1, field("sku"), `${variant.name}: SKU must contain 2–100 characters.`);
    else if (skus.has(sku)) add(1, field("sku"), `${variant.name}: use a unique SKU for every variant.`);
    skus.add(sku);
    for (const [key, label] of [["listPrice", "MRP"], ["salePrice", "selling price"]]) {
      if (!String(variant[key]).trim() || !Number.isFinite(Number(variant[key])) || Number(variant[key]) <= 0) add(1, field(key), `${variant.name}: enter a ${label} greater than zero.`);
    }
    if (Number(variant.salePrice) > Number(variant.listPrice)) add(1, field("salePrice"), `${variant.name}: selling price cannot exceed MRP.`);
    if (variant.costPrice !== "" && (!Number.isFinite(Number(variant.costPrice)) || Number(variant.costPrice) < 0)) add(1, field("costPrice"), `${variant.name}: cost cannot be negative.`);
  }
  if (form.vertical === "GROCERY" && form.soldByWeight) {
    if (!Number.isFinite(Number(form.weightStep)) || Number(form.weightStep) <= 0) add(1, "weightStep", "Enter a weight step greater than zero.");
    if (form.minimumWeight !== "" && form.maximumWeight !== "" && Number(form.minimumWeight) > Number(form.maximumWeight)) add(1, "maximumWeight", "Maximum weight cannot be less than minimum weight.");
  }
  return errors;
}

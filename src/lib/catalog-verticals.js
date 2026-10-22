export const catalogVerticalOptions = Object.freeze([
  { code: "GENERAL", label: "General", name: "General merchandise", hint: "Standard quantity-tracked merchandise." },
  { code: "GROCERY", label: "Grocery", name: "Grocery & fresh", hint: "Batch, expiry, substitutions, and variable-weight controls." },
  { code: "ELECTRONICS", label: "Electronics", name: "Electronics", hint: "Serial-number and warranty controls." },
  { code: "CLOTHING", label: "Clothing", name: "Clothing & apparel", hint: "Colour, size, and exchange controls." }
]);

export const catalogVerticalByCode = Object.freeze(Object.fromEntries(
  catalogVerticalOptions.map((item) => [item.code, item])
));


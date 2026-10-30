import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const dark = css.match(/\[data-theme="dark"\] \{([^}]+)\}/)[1];
const tokens = Object.fromEntries([...dark.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(match => [match[1], match[2]]));
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(tokens[a]), luminance(tokens[b])].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
test("dark surfaces, actions, navigation and status labels have readable contrast", () => {
  for (const [foreground, background] of [["ink", "surface"], ["muted", "surface"], ["faint", "surface"],
    ["action-ink", "action"], ["action-ink", "action-hover"], ["sidebar-ink", "sidebar-active"],
    ["sidebar-muted", "sidebar"], ["accent", "accent-soft"], ["danger", "danger-soft"],
    ["warning", "warning-soft"], ["positive", "positive-soft"], ["avatar-ink", "avatar-bg"],
    ["icon-warm", "icon-warm-soft"], ["icon-plum", "icon-plum-soft"], ["icon-teal", "icon-teal-soft"], ["icon-olive", "icon-olive-soft"]]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground}/${background} must reach 4.5:1`);
  }
  assert.ok(contrast("line-strong", "surface") >= 3, "Control outlines remain visible");
});
test("dark brand chrome has no legacy gold shimmer or gold primary override", () => {
  assert.doesNotMatch(css, /gold-button-sheen|gold-nav-sheen|#d6ad5c|#c8973f|#f1d183|#b69560/i);
  assert.match(css, /\[data-theme="dark"\] \.button-primary \{\s*color: var\(--action-ink\);\s*background: var\(--action\)/);
});

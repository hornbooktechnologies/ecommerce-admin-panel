"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ inverse = false }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("commerce-theme");
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const nextTheme = saved || preferred;
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const applyTheme = () => {
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("commerce-theme", nextTheme);
      setTheme(nextTheme);
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(applyTheme);
      return;
    }

    applyTheme();
  }

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={`icon-button${inverse ? " icon-button-inverse" : ""}`}
      onClick={toggleTheme}
      type="button"
    >
      <Icon aria-hidden="true" size={17} />
    </button>
  );
}

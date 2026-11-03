"use client";

import { useEffect, useState } from "react";

/**
 * 图表主题色（M3）：Recharts 的 SVG 描边/刻度不接受 CSS 变量，
 * 因此按当前主题给出具体色值；深色取值与 globals.css 的 token 对齐
 * （grid = --border #3b3b3b、tooltip 底 = --card #232323、文字 = --foreground #e8e8e8）。
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  legend: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
}

const LIGHT_CHART_THEME: ChartTheme = {
  grid: "#eeeeee",
  axis: "#9d9d9d",
  legend: "#6d6d6d",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e2e2",
  tooltipText: "#333333",
  tooltipLabel: "#6d6d6d",
};

const DARK_CHART_THEME: ChartTheme = {
  grid: "#3b3b3b",
  axis: "#9d9d9d",
  legend: "#b8b8b8",
  tooltipBg: "#232323",
  tooltipBorder: "#3b3b3b",
  tooltipText: "#e8e8e8",
  tooltipLabel: "#b8b8b8",
};

/** 跟随 <html class="dark">（主题切换即时生效） */
export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark ? DARK_CHART_THEME : LIGHT_CHART_THEME;
}

/** 窄屏（默认 <400px，覆盖 375/390 机型） */
export function useIsNarrow(maxWidth = 400): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidth]);

  return narrow;
}

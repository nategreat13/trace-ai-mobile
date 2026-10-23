export const THEME_KEY = "trace-points:theme";

/**
 * Runs inline in <head> before first paint, so night-time visitors never see a
 * white flash. Keep it dependency-free; it's stringified into the page.
 */
export const THEME_SCRIPT = `(function(){try{var k="${THEME_KEY}";var p=localStorage.getItem(k)||"system";var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var d=p==="dark"||(p==="system"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light";};a();m.addEventListener("change",function(){p=localStorage.getItem(k)||"system";a();});}catch(e){}})();`;


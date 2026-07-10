/* Shelfie theme toggle — persistent, respects system default, no flash.
   The no-flash <head> snippet sets data-theme before paint; this wires the button. */
(function () {
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("shelfie-theme", t); } catch (e) {}
  }
  function current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
  window.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      apply(current() === "dark" ? "light" : "dark");
    });
  });
})();

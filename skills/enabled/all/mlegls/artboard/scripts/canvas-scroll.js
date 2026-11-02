// Shared by the canvas and each standalone frame page: restore the scroll positions the capture recorded.
function restoreScroll() {
  for (const element of document.querySelectorAll("[data-scroll]")) {
    const [top, left] = element.dataset.scroll.split(",").map(Number);
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}

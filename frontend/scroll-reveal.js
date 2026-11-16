const widgets =
  ".left-column > .paper:not(.directory), .right-column > .paper, main.column > .paper, main.column .grid-two > .paper, #entries > .paper, #documents > .paper, #anime-list > .paper, #timeline > .paper, #home-posts > .paper";

export function observeScrollReveal(root) {
  const win = root.ownerDocument.defaultView;
  if (!win.IntersectionObserver) return () => {};
  const preference = win.matchMedia("(prefers-reduced-motion: reduce)");
  let intersection, mutation;
  function stop() {
    intersection?.disconnect();
    mutation?.disconnect();
    root
      .querySelectorAll("[data-scroll-reveal]")
      .forEach((node) => node.removeAttribute("data-scroll-reveal"));
  }
  function start() {
    stop();
    if (preference.matches) return;
    const seen = new WeakSet();
    intersection = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.dataset.scrollReveal = "visible";
            intersection.unobserve(entry.target);
          }
      },
      { threshold: 0, rootMargin: "0px 0px -24px 0px" },
    );
    function observe(node) {
      if (seen.has(node)) return;
      seen.add(node);
      // Skip the reader: transforms would move its fixed speech highlights.
      if (
        node.closest(".reader") ||
        node.hidden ||
        !node.getClientRects().length ||
        node.getBoundingClientRect().top < win.innerHeight
      )
        return;
      node.dataset.scrollReveal = "waiting";
      intersection.observe(node);
    }
    function scan(node) {
      if (node.nodeType !== 1) return;
      if (node.matches(widgets)) observe(node);
      node.querySelectorAll(widgets).forEach(observe);
    }
    scan(root);
    mutation = new win.MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(scan);
    });
    mutation.observe(root, { childList: true, subtree: true });
  }
  start();
  preference.addEventListener("change", start);
  return () => {
    stop();
    preference.removeEventListener("change", start);
  };
}

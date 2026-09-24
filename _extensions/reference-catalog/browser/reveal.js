// The URL names the containing slide; the query identifies the precise object.
(() => {
  const revealTarget = () => {
    const id = new URL(location.href).searchParams.get("qrc-target");
    const target = id && document.getElementById(id);
    if (!target || !window.Reveal) return;
    const section = target.closest("section.slide");
    if (!section) return;
    const position = Reveal.getIndices(section);
    Reveal.slide(position.h, position.v);
    const fragment = target.closest(".fragment");
    if (fragment) {
      const index = Number(fragment.getAttribute("data-fragment-index"));
      if (Number.isFinite(index)) Reveal.navigateFragment(index);
    }
    target.scrollIntoView({ block: "nearest" });
  };
  if (window.Reveal?.isReady()) revealTarget();
  else window.Reveal?.on("ready", revealTarget);
})();

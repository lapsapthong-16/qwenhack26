"use client";

import { useEffect } from "react";

const revealTargets = [
  ".state-section h2",
  ".section-kicker",
  ".state-row",
  ".state-link",
  ".panel-copy",
  ".panel-art",
  ".artifact-art",
  ".artifact-copy",
  ".workflow-meta",
  ".workflow-section h2",
  ".workflow-card",
  ".workflow-cta",
  ".evidence-copy",
  ".quote-stack article",
  ".plans-meta",
  ".plans-copy",
  ".use-card",
  ".final-copy",
  ".dossier-art",
].join(",");

export default function ScrollReveal() {
  useEffect(() => {
    const root = document.querySelector(".home-page");
    const targets = Array.from(document.querySelectorAll<HTMLElement>(revealTargets));

    targets.forEach((target) => target.classList.add("scroll-reveal"));
    requestAnimationFrame(() => root?.classList.add("reveal-ready"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return null;
}

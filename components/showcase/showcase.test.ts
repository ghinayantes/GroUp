import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HeroMedia from "./HeroMedia";

describe("HeroMedia", () => {
  it("tanpa URL video menampilkan gambar cadangan", () => {
    const html = renderToStaticMarkup(createElement(HeroMedia, {}, createElement("img", { src: "/hero.jpg", alt: "Lapak sayur" })));
    expect(html).toContain("<img");
    expect(html).not.toContain("<video");
  });

  it("dengan URL video: autoplay muted loop playsInline, poster, dan tombol jeda", () => {
    const html = renderToStaticMarkup(createElement(HeroMedia, { videoUrl: "https://cdn.test/demo.mp4", posterUrl: "https://cdn.test/poster.jpg" }, createElement("img")));
    for (const attribute of ["autoplay", "muted", "loop", "playsinline"]) expect(html.toLowerCase()).toContain(`${attribute}=""`);
    expect(html).toContain("poster=\"https://cdn.test/poster.jpg\"");
    expect(html).toContain("Jeda video");
    expect(html).not.toContain("<img");
  });
});

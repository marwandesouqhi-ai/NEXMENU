import { useEffect } from "react";
import { buildMetaTags, type SeoOptions } from "./seo";

export function useSeo(options: SeoOptions) {
  const { title, description, canonicalUrl, image, ogType, twitterCard, jsonLd } = options;

  useEffect(() => {
    // 1. Update Document Title
    document.title = title;

    // 2. Canonical URL Link Tag
    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!canonicalTag) {
        canonicalTag = document.createElement("link");
        canonicalTag.rel = "canonical";
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.href = canonicalUrl;
    } else if (canonicalTag) {
      canonicalTag.remove();
    }

    // 3. Meta Tags (OG, Twitter, Description)
    const tags = buildMetaTags({
      title,
      description,
      canonicalUrl,
      image,
      ogType,
      twitterCard,
      jsonLd,
    });
    const createdElements: HTMLMetaElement[] = [];

    tags.forEach((tag) => {
      const selector = tag.property
        ? `meta[property="${tag.property}"]`
        : `meta[name="${tag.name}"]`;
      let metaEl = document.querySelector<HTMLMetaElement>(selector);

      if (!metaEl) {
        metaEl = document.createElement("meta");
        if (tag.property) metaEl.setAttribute("property", tag.property);
        if (tag.name) metaEl.setAttribute("name", tag.name);
        document.head.appendChild(metaEl);
        createdElements.push(metaEl);
      }
      metaEl.content = tag.content;
    });

    // 4. JSON-LD Structured Data
    let jsonLdScript = document.getElementById("nexmenu-jsonld") as HTMLScriptElement | null;
    if (jsonLd) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement("script");
        jsonLdScript.id = "nexmenu-jsonld";
        jsonLdScript.type = "application/ld+json";
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(jsonLd, null, 2);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }

    // Cleanup: remove temporary meta/jsonld if desired
    return () => {
      // keep basic title or clean up json-ld
    };
  }, [title, description, canonicalUrl, image, ogType, twitterCard, jsonLd]);
}


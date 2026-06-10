module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("css");

  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  );

  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // FAQPage + Article JSON-LD from frontmatter (single source of truth, no body parsing)
  eleventyConfig.addFilter("guideJsonLd", (data) => {
    const blocks = [];
    blocks.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: data.title,
      description: data.description,
      dateModified: new Date(data.updated).toISOString().slice(0, 10),
      author: { "@type": "Organization", name: "North Texas Home Costs" },
    });
    if (Array.isArray(data.faqs) && data.faqs.length >= 2) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: data.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    return JSON.stringify(blocks);
  });

  eleventyConfig.addCollection("guides", (api) =>
    api.getFilteredByGlob("guides/*.md").sort((a, b) => (a.data.title || "").localeCompare(b.data.title || ""))
  );

  return {
    dir: { input: ".", includes: "_includes", output: "_site" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
};

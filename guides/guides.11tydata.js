// Directory data for all guides.
// NOTE: this is a .js data file (not guides.json) on purpose: with
// markdownTemplateEngine: false, Eleventy does NOT render template syntax in
// markdown frontmatter/data permalinks, so "/guides/{{ page.fileSlug }}/"
// would be emitted literally. A computed permalink sidesteps that while
// keeping markdown bodies free of template processing.
module.exports = {
  layout: "guide.njk",
  eleventyComputed: {
    // Respect an explicit frontmatter permalink (e.g. guides/index.njk -> /guides/)
    permalink: (data) => data.permalink || `/guides/${data.page.fileSlug}/`,
  },
};

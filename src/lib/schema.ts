// Shared schema.org (JSON-LD) builders, so the same entity is described
// identically wherever it appears.

const PERSONAL_SITE = 'https://peter-langkafel.de';

/**
 * Person markup for Peter Langkafel, used on pages that show the author
 * trust block.
 *
 * TODO: add `sameAs: [<LinkedIn URL>]` once the real profile URL is known
 * (same open item as the LINKEDIN_URL placeholder in ContactCta.astro).
 * Deliberately omitted until then rather than pointing at a placeholder.
 */
export function personSchema(site: URL | undefined) {
  const origin = site?.toString().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Peter Langkafel',
    honorificPrefix: 'Prof. Dr. med.',
    honorificSuffix: 'MBA',
    jobTitle: 'Arzt, Professor für Digital Health und Gründer',
    url: PERSONAL_SITE,
    ...(origin ? { image: `${origin}/img/peter-langkafel.webp` } : {}),
    worksFor: {
      '@type': 'Organization',
      name: 'Health AI Assurance',
      ...(origin ? { url: origin } : {}),
    },
  };
}

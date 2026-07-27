// The project's public identity, in one place.
//
// Name, domain, and the URLs derived from them were spelled out at eighty-five
// call sites across the client, the build scripts, the server, the bot, and the
// desktop shell. That is fine while a project has one name forever and a bad
// place to be during a rebrand: every one of those is a chance to leave the old
// name in a page title, a sitemap entry, or a JSON-LD block where nobody looks.
//
// The DOMAIN below is still the upstream one. It is deliberately not guessed:
// pointing a sitemap and a set of JSON-LD identifiers at a domain that does not
// resolve is worse than pointing them at one that does, so it stays until the
// real domain exists and then changes HERE, once.
//
// Kept dependency-free (no imports, no `import.meta`) so build scripts, the
// Discord bot, and the Node-side tools can all read the same constants as the
// browser client.

/** Display name, as a player sees it. */
export const BRAND_NAME = 'Claudenarok Online';

/** Package / repository / slug form. */
export const BRAND_SLUG = 'claudenarok';

/** The public site's host. STILL THE UPSTREAM DOMAIN: see the header. Changing
 *  this one line moves the sitemap, every canonical URL, and the SEO graph. */
export const BRAND_DOMAIN = 'worldofclaudecraft.com';

/** Canonical origin, no trailing slash. */
export const SITE_ORIGIN = `https://${BRAND_DOMAIN}`;

/** Canonical site URL, with the trailing slash the SEO block wants. */
export const SITE_URL = `${SITE_ORIGIN}/`;

/** Where desktop release artifacts are published. */
export const DESKTOP_UPDATE_HOST = `https://updates.${BRAND_DOMAIN}/desktop`;

/** The community invite. STILL UPSTREAM'S: it is someone else's server, so it
 *  is the one link here that is actively wrong rather than merely unchanged,
 *  and it should move the moment SpiritVale has a server of its own. */
export const DISCORD_INVITE = 'https://discord.com/invite/worldofclaudecraft';

/** The desktop deep-link scheme, registered by the Electron shell. Changing it
 *  means changing the shell's protocol registration in the same breath, or a
 *  browser hands the login code to a scheme nothing answers. */
export const DESKTOP_URL_SCHEME = 'worldofclaudecraft';

/** Social profiles, for the site's SEO graph. The repository is ours; the rest
 *  are still upstream's, like the Discord invite: they point at someone else's
 *  accounts and should be emptied or replaced rather than quietly inherited. */
export const SOCIAL_LINKS: readonly string[] = [
  'https://github.com/idkspvp/claudenarok',
  DISCORD_INVITE,
  'https://www.youtube.com/@WoClaudeCraft',
  'https://x.com/WoClaudecraft',
  'https://www.instagram.com/worldofclaudecraft/',
  'https://www.tiktok.com/@worldofclaudecraft',
  'https://www.reddit.com/r/WorldofClaudecraft/',
];

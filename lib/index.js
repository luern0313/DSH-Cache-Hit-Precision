/**
 * Host half of dsh-cache-hit-precision.
 *
 * The plugin has no host-side behavior; this empty apply exists so the package
 * can be listed as a normal loader entry.  The browser half ships through
 * exports["./client"] and the package.json `dsh.client` declaration.
 */
function apply() {}

export { apply };

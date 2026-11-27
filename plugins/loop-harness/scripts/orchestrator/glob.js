const SPECIAL = /[.+^${}()|[\]\\]/g;

const TOKENS = {
  '**/': '(?:.*/)?',
  '**': '.*',
  '*': '[^/]*',
  '?': '[^/]',
};

export const globToRegExp = (glob) => {
  const source = glob
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((part) => TOKENS[part] ?? part.replace(SPECIAL, '\\$&'))
    .join('');
  return new RegExp(`^${source}$`);
};

export const matchesAny = (path, globs) => globs.some((glob) => globToRegExp(glob).test(path));

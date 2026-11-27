const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}]/u;
const ALLOWED = new Set(['©', '®', '™']);

export const findEmoji = (text) => {
  const pattern = new RegExp(EMOJI.source, 'gu');
  return [...text.matchAll(pattern)]
    .filter((match) => !ALLOWED.has(match[0]))
    .map((match) => ({ index: match.index, char: match[0] }));
};

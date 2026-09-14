// Comparison-only filtering; display text and original token offsets stay intact.
const common = new Set(
  "a an the and or of to in on for by with as is are was were be been this that these those it its from at into through across study research paper thesis chapter section purpose aim aims objectives result results conclusion introduction methodology significant significance academic investigation investigate investigates work presents present".split(
    " ",
  ),
);
export function isLowInformation(words: string[]) {
  const distinct = new Set(words);
  const informative = new Set(
    words.filter((w) => w.length > 3 && !common.has(w)),
  );
  return words.length < 8 || distinct.size < 5 || informative.size < 3;
}

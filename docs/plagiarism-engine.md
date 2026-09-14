# Explainable similarity detection

ThesisGuard detects **textual similarity**, not academic misconduct. Every percentage is evidence for human review. DeepSeek does not calculate, modify, or validate the numerical score.

## 1. Preprocessing and positions

An uploaded PDF or DOCX is parsed in Node. Image-only or encrypted PDFs produce clear errors; OCR is not silently implied. We retain extracted original text for display and a separate NFKC Unicode-normalized, lowercase representation for comparisons. Punctuation becomes separators and consecutive whitespace collapses. Tokens keep their original character offsets so highlighted excerpts correspond to actual submitted text. Display text does not have its stop words removed.

The section detector recognizes standalone References, Bibliography, and Works Cited headings, optionally with numeric prefixes. The default eligible region ends at the first matching heading. This conservative heuristic can misidentify an unusual heading, and does not perform structural PDF analysis. Reference-only matches are stored and labeled excluded.

Quote and citation flags recognize common straight/curly double quotation marks, author-year parentheses, and bracketed numbered citations. Nearby context is considered. These are heuristics, not a check that a cited source supports the statement. Quoted and cited overlaps stay visible and counted unless they are in excluded references; a citation flag is not an automatic judgment of correct attribution.

## 2. Chunks and candidate selection

Documents are indexed in 120-word chunks with 30 words of overlap. Chunks shorter than eight words are omitted. Their original text, normalized text, word counts, and fingerprints are stored once. A GIN index on the fingerprint array supports candidate filtering without parsing every stored thesis again.

Only approved theses are repository candidates. The submitted thesis and other work by the same student are excluded to avoid counting a student's revision as an external source. This deliberately omits self-overlap and should be discussed as an institutional policy limitation. Candidate batches have a 400-chunk database limit, with a report warning if reached. Selected documents are subsequently compared using their stored original text; overlapping chunks are never concatenated into fictional passages.

## 3. N-grams

An n-gram is a consecutive sequence of n words. For words `[a,b,c,d]`, 3-grams are `a b c` and `b c d`. We use five-word grams as exact phrase anchors. A source-side inverted index maps each gram to its positions. For each matching anchor, comparison extends word-by-word to the longest contiguous equal span. At least eight words and five distinct words are required for an exact match.

Repeated source anchors are bounded to 30 positions per gram to avoid pathological repeated boilerplate. This can reduce recall in highly repetitive documents. Exact spans are case-insensitive and ignore punctuation differences while preserving the original excerpt.

## 4. Jaccard similarity

For sets A and B:

`J(A,B) = |A ∩ B| / |A ∪ B|`

The empty-set convention in this implementation is zero. Jaccard measures shared features, not the proportion of an entire thesis copied. The lexical passage qualification step uses word bigram sets, with a minimum Jaccard score of 0.62, to require substantial shared word order.

## 5. Cosine similarity

Each passage is represented by a term-frequency vector. Cosine is:

`cos(A,B) = (A · B) / (||A|| × ||B||)`

The zero-vector convention is zero. A lexical match also requires cosine at least 0.85. Vocabulary overlap alone is insufficient: candidate windows need exact five-word anchors and strong bigram overlap. Windows are 24–32 words. These educational thresholds are implementation parameters, separate from an institution's review-warning thresholds. They are not calibrated claims of universal detection accuracy.

## 6. Fingerprinting and winnowing

Each five-word gram is hashed with unsigned 32-bit FNV-1a. This is a compact educational fingerprint, not a cryptographic integrity guarantee. Hash collisions are possible; direct text comparison verifies candidates before scoring.

Winnowing slides a window of four hashes over the hash sequence and selects the rightmost minimum. A minimum repeated in the next window is emitted only once for its position. Fingerprint sets deduplicate values for storage. With n=5 and a window of 4, sufficiently long exact sequences tend to share representative hashes; the classic detection threshold is n+w−1 = 8 words when both contexts and tokenization satisfy the algorithm's assumptions. Fingerprints narrow the search; they do not directly establish copying or determine the report percentage.

## 7. External discovery

The query selector considers sufficiently long distinctive sentences before the references section. It ranks uncommon longer words, removes duplicate queries, and avoids citation-heavy, quoted, low-information, or already internally explained passages. Queries contain up to fourteen words. Default caps are fifteen public web queries and ten academic queries per scan. The academic title query counts within the ten-query cap.

Tavily basic search is the default; Brave uses the same interface when explicitly selected. OpenAlex reconstructs available abstracts from inverted indexes and retains authors, DOI, publication year, journal, open-access status and available links. Search results are candidate discovery, never a similarity percentage.

Public HTML may be retrieved with bounded safe-fetch and parsed with Cheerio. Available OpenAlex open-access PDF links may be retrieved and parsed. Failures retain honest snippet/abstract coverage labels. Only real returned source metadata and actual source excerpts enter the report. Third-party full text is not persisted in the evidence tables.

## 8. Matched-span scoring

Each qualified match is a half-open word interval `[start,end)` in the submitted document. Excluded matches are removed. Remaining intervals are clipped to eligible submitted words, sorted, and merged. Adjacent or overlapping intervals form one union.

`Similarity Score = 100 × matched eligible words / eligible words`

The result is rounded to two decimal places; an empty eligible document yields zero. For 100 eligible words, repository span `[0,30)` and web span `[20,40)` cover 40 distinct words: overall 40%, repository 30%, web 20%. Overall is **not** 50%. Source contributions overlap and therefore need not add up to overall.

Lexical windows represent approximate coverage, rather than an assertion that every individual token in a qualified window was copied. The UI identifies lexical versus exact matches and their strength. Scores are deterministic and reproducible for the same submitted text, source texts, and settings; search-engine results can change over time.

## 9. AI prevention guidance

The strongest eligible matches, capped at twenty, are sent as short excerpt pairs to DeepSeek's OpenAI-compatible endpoint. The system instruction treats source text as untrusted data and prohibits source invention, score calculation, and evasion advice. Zod validates the returned JSON enum, indexes, and length bounds. Invalid indexes are discarded. AI text cannot create a matching source or alter the coverage calculation.

Guidance asks students to verify sources, use accurate quotation and attribution, and write from understanding. If unavailable, a generic academic-integrity message is clearly labeled as general guidance, and the report remains usable.

## 10. Evaluation and limitations

Unit tests cover normalization, offsets, n-grams, Jaccard, cosine, hashes, rightmost-minimum winnowing, interval union, exclusions, identical/unrelated texts, query selection, provider contracts, failure isolation, and actual PDF/DOCX extraction. PostgreSQL tests execute the migration and exercise RLS. These correctness tests are not a benchmark against a labeled plagiarism corpus.

The engine cannot access every private academic database, all paywalled publications, or Turnitin's proprietary student-paper collection. It may miss sophisticated paraphrases, translations, images, equations, reordered arguments, or source material absent from available searches. Search snippets and abstracts provide partial coverage. Common-phrase filtering and reference detection are heuristic. No semantic embedding model or proprietary plagiarism database is claimed. Institutions should validate thresholds on their own sample corpus before using them for routine review.

# Narrative sources and extraction

`fir`, `criminal-history`, `intel-report`, and `surveillance-report` accept
`caseId`, UTC `date`, and original `text`, with optional `sourceReliability`
(A–F) and `informationCredibility` (integer or string 1–6). Supplied malformed
grades are row errors. Omitted grades are unassessed. Batches retain independent
row errors, duplicate detection, a 500-row maximum, and 10,000-character texts.

Explicit Instagram, Telegram, Twitter/X, and Facebook handle context produces
SocialHandle entities. The hard key is platform plus lowercase handle; Twitter
and X share a platform key. Bare handles are ignored and UPI identifiers remain
accounts. Hindi person cues require two to four words ending at punctuation,
end of text, or a known grammatical terminator. These limited rules may miss
names or misclassify bounded prose; they are not a general Hindi NER model.

Python extraction offsets refer to original Unicode code points. EngineClient
checks each raw span and converts it once to Java/JavaScript UTF-16 offsets
before persistence, including when emoji precedes the evidence. Devanagari
digit normalization preserves one-to-one source positions. Explicit account
cues take precedence over phone-shaped numbers.

Node and edge `properties.support` contain `level`, `recordCount`,
`sourceKindCount`, `minimumExtractionConfidence`, `credibilityAssessed`,
`lowCredibility`, and `explanation`. Repeated spans from one source record
count once. High requires two records, two kinds, confidence at least 0.9,
all grades assessed, and no low credibility. Medium requires two records,
confidence at least 0.8, and no low credibility. Otherwise support is Low.
E/F reliability or 5/6 credibility is low. Support measures these inputs and
does not represent a probability of truth or a finding of guilt.

Run `python intelligence/evaluate_multilingual.py` for separate synthetic
Hindi/Hinglish exact type/start/end metrics. The six fixtures are implementation
checks, not held-out evidence of general accuracy. Frozen held-out samples and
results remain unchanged. `/quality` exposes these metrics under
`multilingualSynthetic` separately from held-out results.

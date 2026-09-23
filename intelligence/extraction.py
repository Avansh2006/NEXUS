import re
import spacy

NLP = spacy.blank('en')
RULER = NLP.add_pipe('entity_ruler')
RULER.add_patterns([
    {'label': 'Location', 'pattern': f'Navapur Sector {i}'} for i in range(1, 10)
] + [{'label': 'Location', 'pattern': 'Navapur Exchange'},
     {'label': 'Organization', 'pattern': 'Veyra Services'}])

PATTERNS = [
    ('Phone', r'\bSYN-PHONE-\d{3}\b'),
    ('Account', r'\bSYN-ACCOUNT-\d{3}\b'),
    ('Phone', r'(?<![\w\d])(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)'),
    ('Vehicle', r'\b(?:[A-Z]{2}[ -]?\d{2}[ -]?[A-Z]{1,3}[ -]?\d{4})\b'),
    ('Account', r'\b[a-zA-Z0-9._-]+@[a-zA-Z][a-zA-Z0-9.-]+\b'),
    ('IFSC', r'\b[A-Z]{4}0[A-Z0-9]{6}\b'),
    ('Amount', r'\b(?:INR|Rs\.?)\s?\d[\d,]*(?:\.\d{1,2})?\b'),
]
PERSON = re.compile(r'\b(accused|co-accused|complainant|witness|arrested|aaropi|shikayatkarta|gawah|naamzad)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})', re.I)
ACCOUNT = re.compile(r'\b(?:account(?:\s+number)?|khata(?:\s+sankhya)?|खाता(?:\s+संख्या)?)\s*[:#]?\s*(\d{9,18})\b', re.I)

SOCIAL = re.compile(r'\b(instagram|telegram|twitter|facebook|x)\s*(?:handle|username)?\s*[:=]?\s*(@[A-Za-z0-9_][A-Za-z0-9_.]{0,63})(?![\w@])', re.I)
HINDI_PERSON = re.compile(r'(?:^|[\s,;।])(आरोपी|अभियुक्त|शिकायतकर्ता|गवाह)\s+([\u0900-\u0963]+(?:\s+[\u0900-\u0963]+){1,3}?)(?=\s*(?:[,;।:]|$)|\s+(?:ने|का|की|को|से|द्वारा|निवासी)(?:\s|$))')

DEVANAGARI_DIGITS = str.maketrans('०१२३४५६७८९', '0123456789')


def normalize(kind, raw):
    raw_norm = raw.translate(DEVANAGARI_DIGITS)
    if kind == 'Phone' and not raw_norm.startswith('SYN-'):
        digits = re.sub(r'\D', '', raw_norm)
        return '+91' + digits[-10:]
    if kind == 'Vehicle':
        return re.sub(r'[ -]', '', raw_norm).upper()
    return raw_norm.strip().lower() if kind in ('Person', 'Account') and not raw_norm.startswith('SYN-') else raw.strip()


def extract(text, record_id=''):
    entities = []
    search_text = text.translate(DEVANAGARI_DIGITS)
    def add(kind, start, end, confidence=1.0, role=''):
        if any(start < e['end'] and end > e['start'] for e in entities):
            return
        raw = text[start:end]
        entities.append(dict(type=kind, raw=raw, start=start, end=end, confidence=confidence,
                             normalized=normalize(kind, raw), role=role, sourceRecordId=record_id))
    # Explicit account context wins over a phone-shaped 10-digit number.
    for match in ACCOUNT.finditer(search_text):
        add('Account', match.start(1), match.end(1))
    for match in SOCIAL.finditer(search_text):
        before = len(entities)
        add('SocialHandle', match.start(2), match.end(2), .95)
        if len(entities) > before:
            platform = match.group(1).lower()
            entities[-1]['normalized'] = ('twitter' if platform == 'x' else platform) + ':' + match.group(2)[1:].lower()
    for kind, pattern in PATTERNS:
        for match in re.finditer(pattern, search_text):
            add(kind, match.start(), match.end())
    for match in PERSON.finditer(text):
        # Stop at separators; capitalization is checked independently of cue case.
        raw = match.group(2)
        words = re.findall(r'[A-Z][a-z]+', raw)
        if len(words) >= 2 and ' '.join(words) == raw:
            add('Person', match.start(2), match.end(2), .86, match.group(1).lower())
    for match in HINDI_PERSON.finditer(text):
        if not set(match.group(2).split()) & {'में', 'है', 'रहता', 'गांव', 'और', 'बयान', 'दिया'}:
            role = 'accused' if match.group(1) in ('आरोपी', 'अभियुक्त') else 'witness' if match.group(1) == 'गवाह' else 'complainant'
            add('Person', match.start(2), match.end(2), .86, role)
    for ent in NLP(text).ents:
        add(ent.label_, ent.start_char, ent.end_char, .95)
    return sorted(entities, key=lambda e: (e['start'], e['type']))

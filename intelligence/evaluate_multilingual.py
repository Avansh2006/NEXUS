"""Separate synthetic cue/span evaluation; never modifies held-out evaluation data."""
import json
from pathlib import Path
from extraction import extract


def evaluate():
    samples = json.loads(Path(__file__).with_name('multilingual_samples.json').read_text(encoding='utf-8'))
    tp = fp = fn = 0
    for sample in samples:
        expected = {(e['type'], e['start'], e['end']) for e in sample['entities']}
        actual = {(e['type'], e['start'], e['end']) for e in extract(sample['text'])}
        tp += len(expected & actual)
        fp += len(actual - expected)
        fn += len(expected - actual)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    return dict(samples=len(samples), truePositives=tp, falsePositives=fp, falseNegatives=fn,
                strictPrecision=precision, strictRecall=recall,
                strictF1=2*precision*recall/(precision+recall) if precision+recall else 0,
                scope='Separate synthetic Hindi/Hinglish cue fixtures; not held-out or general multilingual accuracy')


if __name__ == '__main__':
    print(json.dumps(evaluate(), ensure_ascii=False, indent=2))

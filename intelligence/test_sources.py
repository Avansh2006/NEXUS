from extraction import extract


def test_social_context_does_not_consume_upi():
    entities = extract('Instagram handle @Demo.User; Telegram: @Demo.User; UPI demo@bank; @unbound')
    assert [(e['raw'], e['normalized']) for e in entities if e['type'] == 'SocialHandle'] == [('@Demo.User', 'instagram:demo.user'), ('@Demo.User', 'telegram:demo.user')]
    assert [e['raw'] for e in entities if e['type'] == 'Account'] == ['demo@bank']


def test_hindi_explicit_boundaries_and_offsets():
    text = '🔎 आरोपी रवि कुमार, खाता संख्या ९८७६५४३२१०; गवाह सीमा देवी ने बयान दिया।'
    entities = extract(text)
    assert [(e['type'], e['raw']) for e in entities] == [('Person', 'रवि कुमार'), ('Account', '९८७६५४३२१०'), ('Person', 'सीमा देवी')]
    assert all(text[e['start']:e['end']] == e['raw'] for e in entities)
    assert not [e for e in extract('आरोपी गांव में रहता है') if e['type'] == 'Person']


def test_quality_reads_heldout_results_beside_configured_demo(tmp_path, monkeypatch):
    from app import quality
    import json
    demo = tmp_path / 'demo'
    demo.mkdir()
    (demo / 'gold.json').write_text('[]', encoding='utf-8')
    evaluation = tmp_path / 'eval'
    evaluation.mkdir()
    (evaluation / 'evaluation_results.json').write_text(json.dumps({'test': {'samples': 3, 'strict': {'precision': .75}}}), encoding='utf-8')
    monkeypatch.setenv('DEMO_DIR', str(demo))
    result = quality()
    assert result['heldoutTest']['samples'] == 3
    assert result['heldoutTest']['strictPrecision'] == .75

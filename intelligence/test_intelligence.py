import copy
import pytest
from fastapi.testclient import TestClient
from app import app, quality
from extraction import extract, normalize
from analysis import analyze


def node(n, kind='Phone', cases=None, label=None):
    return dict(id=n,type=kind,label=label or n,properties=dict(caseIds=cases or [],evidenceIds=['e-'+n]))


def edge(a,b,kind, cases=None,times=None):
    return dict(id=f'{a}-{kind}-{b}',source=a,target=b,type=kind,
                properties=dict(caseIds=cases or [],evidenceIds=[f'ev-{a}-{b}'],
                                events=[dict(timestamp=t,amount=100,evidenceId=f'ev-{a}-{b}') for t in (times or [])]))


def has_rule(nodes,edges,rule):
    return [a for a in analyze(dict(nodes=nodes,edges=edges))['alerts'] if a['ruleId']==rule]


def test_extract_spans_and_normalization():
    text='Accused Aariv Veylan; phone SYN-PHONE-001; account SYN-ACCOUNT-001.'
    entities=extract(text,'record')
    assert {e['type'] for e in entities} == {'Person','Phone','Account'}
    assert all(text[e['start']:e['end']]==e['raw'] and e['sourceRecordId']=='record' for e in entities)
    assert normalize('Phone','+91 9876543210')==normalize('Phone','9876543210')=='+919876543210'
    assert not extract('Phone 12345 is incomplete.')
    assert extract('Account 9876543210.')[0]['type']=='Account'


def test_gold_metrics():
    result=quality()
    assert result['samples']==18
    assert result['precision']>=.95 and result['recall']>=.95


@pytest.mark.parametrize('kind,rule', [('Phone','R1'),('Account','R2')])
def test_shared_identifiers_positive_negative_and_suppression(kind,rule):
    ns=[node('x',kind,['a','b'],'SYN-PHONE-999'),node('p1','Person',['a']),node('p2','Person',['b'])]
    es=[edge('p1','x','USES'),edge('p2','x','USES')]
    alerts=has_rule(ns,es,rule)
    assert len(alerts)==1 and alerts[0]['suppressed']
    assert alerts[0]['evidenceIds'] and '2' in alerts[0]['explanation']
    assert not has_rule([node('x',kind,['a']),node('p1','Person',['a'])],es[:1],rule)


def test_bridge_positive_negative():
    ns=[node(str(i)) for i in range(8)]
    es=[edge(str(a),str(b),'CALLED') for group in (range(4),range(4,8)) for a in group for b in group if a<b]+[edge('3','4','CALLED')]
    assert has_rule(ns,es,'R3')
    assert not has_rule(ns,[],'R3')


def test_financial_rules_and_negative():
    ns=[node(str(i),'Account') for i in range(5)]
    times=['2026-09-01T10:00:00Z','2026-09-01T10:05:00Z','2026-09-01T10:10:00Z']
    es=[edge(str(i),'3','TRANSFERRED_TO',times=times[:1]) for i in range(3)]+[edge('3','4','TRANSFERRED_TO',times=times)]
    alerts=has_rule(ns,es,'R4')
    assert any('Fan-in: 3' in a['explanation'] for a in alerts)
    assert any('3 transfers' in a['explanation'] for a in alerts)
    assert any('Rapid pass-through' in a['explanation'] for a in alerts)
    assert not has_rule(ns,es[:1],'R4')


def test_repeated_colocation_positive_negative():
    ns=[node('a'),node('b'),node('loc','Location')]
    times=['2026-09-01T10:00:00Z','2026-09-02T10:00:00Z']
    es=[edge('a','loc','SEEN_AT',times=times),edge('b','loc','SEEN_AT',times=times)]
    assert has_rule(ns,es,'R5')
    one=copy.deepcopy(es)
    one[1]['properties']['events']=one[1]['properties']['events'][:1]
    assert not has_rule(ns,one,'R5')


def test_repeated_coaccusation_positive_negative():
    ns=[node('a','Person'),node('b','Person')]
    assert has_rule(ns,[edge('a','b','CO_ACCUSED',['A','B'])],'R6')
    assert not has_rule(ns,[edge('a','b','CO_ACCUSED',['A'])],'R6')


def test_determinism_and_empty():
    g=dict(nodes=[node('a'),node('b')],edges=[edge('a','b','CALLED')])
    assert analyze(g)==analyze(g)
    assert analyze(dict(nodes=[],edges=[]))['metrics']==[]
    assert analyze(dict(nodes=[node('a')],edges=[]))['metrics'][0]['degree']==0


def test_case_links_exclude_public_identifiers():
    g=dict(nodes=[node('a','Phone',['A','B']),node('public','Phone',['A','C'],'SYN-PHONE-999')],edges=[])
    result=analyze(g)
    assert len(result['caseLinks'])==1
    assert result['caseLinks'][0]['caseIds']==['A','B']
    assert result['counts']['casesLinked']==2


def test_api_contract():
    client=TestClient(app)
    assert client.get('/health').status_code==200
    assert client.post('/extract',json={'text':'No data'}).json()=={'entities':[]}
    assert client.post('/extract',json={'text':'x'*10001}).status_code==422
    assert client.post('/analyze',json={'nodes':[],'edges':[]}).status_code==200

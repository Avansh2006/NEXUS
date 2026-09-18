"""Black-box API and seeded ground-truth rehearsal. Run against a clean local demo."""
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = os.getenv('NEXUS_API', 'http://127.0.0.1:8081/api')
ROOT = Path(__file__).resolve().parents[1]


def request(path, body=None, expected=200, content_type='application/json'):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(BASE+path,data=data,headers={'Content-Type':content_type})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw=response.read().decode()
            assert response.status==expected,(path,response.status,raw)
            return json.loads(raw) if 'json' in response.headers.get('Content-Type','') else raw
    except urllib.error.HTTPError as e:
        result=json.loads(e.read())
        assert e.code==expected,(path,e.code,result)
        assert set(result)=={'error'} and 'message' in result['error']
        return result


def main():
    truth=json.loads((ROOT/'data/demo/ground_truth.json').read_text())
    request('/demo/reset',{})
    assert request('/graph')['nodes']==[]
    started=time.perf_counter()
    result=request('/demo/load',{})
    load_time=time.perf_counter()-started
    assert sum(x['accepted'] for x in result.values())==truth['records']
    graph=request('/graph')
    assert not graph['analyzed']
    names={n['id']:n for n in graph['nodes']}
    for label in (truth['sharedPhone'],truth['sharedAccount']):
        nodes=[n for n in graph['nodes'] if n['label']==label]
        assert len(nodes)==1
        assert set(truth['linkedCases'])<=set(nodes[0]['properties']['caseIds'])
    assert len([n for n in graph['nodes'] if n['label']==truth['distinctName']])==2
    assert any({names[s['left']]['label'],names[s['right']]['label']}==set(truth['variantNames']) for s in graph['suggestions'])
    ev={e['id']:e for e in graph['evidence']}
    source_ids={r['id'] for r in graph['records']}
    assert all(e['recordId'] in source_ids for e in ev.values())
    assert all(n['properties']['evidenceIds'] for n in graph['nodes'])
    assert all(set(e['properties']['evidenceIds'])<=ev.keys() for e in graph['edges'])
    started=time.perf_counter()
    analysis=request('/analyze',{})
    analysis_time=time.perf_counter()-started
    assert set(truth['expectedRules'])<={a['ruleId'] for a in analysis['alerts']}
    assert analysis==request('/analyze',{}),'Analysis must be deterministic'
    public=next(n for n in graph['nodes'] if n['label']==truth['publicPhone'])
    assert any(a['suppressed'] and public['id'] in a['entityIds'] for a in analysis['alerts'])
    assert all(a['evidenceIds'] and set(a['evidenceIds'])<=ev.keys() for a in analysis['alerts'])
    assert any('Fan-in' in a['explanation'] for a in analysis['alerts'])
    assert any('Rapid pass-through' in a['explanation'] for a in analysis['alerts'])
    phone=next(n for n in graph['nodes'] if n['label']==truth['sharedPhone'])
    account=next(n for n in graph['nodes'] if n['label']==truth['sharedAccount'])
    nid=phone['id']
    for endpoint in ['/entities/'+nid,'/network/'+nid+'?hops=2','/entities/search?q=SYN-PHONE-001','/clusters','/influencers','/suspicious-patterns','/timeline/'+nid,'/link-suggestions','/quality','/audit','/health']:
        assert request(endpoint) is not None
    path=request('/paths?from='+nid+'&to='+account['id'])
    assert path['nodeIds'][0]==nid and path['nodeIds'][-1]==account['id'] and path['edges']
    report=request('/reports',{})
    assert 'PROTOTYPE' in report and 'Supporting evidence' in report and 'SYN-PHONE-001' in report
    duplicates=request('/demo/load',{})
    assert sum(x['duplicates'] for x in duplicates.values())==truth['records']
    assert sum(x['accepted'] for x in duplicates.values())==0
    # JSON and CSV variants deduplicate after canonicalization.
    csv=(ROOT/'data/demo/transactions.csv').read_text()
    result=request('/data/transactions',{'format':'csv','content':csv})
    assert result['duplicates']==51
    bad=request('/data/transactions',{'records':[{'caseId':'BAD','from':'SYN-ACCOUNT-001','to':'SYN-ACCOUNT-002','amount':-1,'timestamp':'2026-09-01T00:00:00Z'},{}]})
    assert len(bad['errors'])==2 and bad['accepted']==0
    for endpoint in ['/entities/missing','/network/missing','/timeline/missing','/paths?from=missing&to='+nid]:
        request(endpoint,expected=404)
    request('/network/'+nid+'?hops=3',expected=400)
    request('/data/fir',{'records':[]},expected=400)
    request('/reports',{'graphImage':'javascript:alert(1)'},expected=400)
    # Review and undo must leave exactly the original graph and evidence.
    suggestion=graph['suggestions'][0]
    merged=request('/link-suggestions/'+suggestion['id']+'/accept',{})
    assert len(merged['nodes'])==len(graph['nodes'])-1
    restored=request('/link-suggestions/'+suggestion['id']+'/reject',{})
    assert restored['nodes']==graph['nodes'] and restored['edges']==graph['edges']
    assert not restored['analyzed']
    quality=request('/quality')
    # Finish on the exact pitch state after a final clean reset/load/analyze/report.
    request('/demo/reset',{})
    request('/demo/load',{})
    final=request('/analyze',{})
    assert final==analysis
    report=request('/reports',{})
    artifacts=ROOT/'artifacts';artifacts.mkdir(exist_ok=True)
    (artifacts/'NEXUS-investigation-report.html').write_text(report,encoding='utf-8')
    summary=dict(status='passed',records=truth['records'],nodes=len(graph['nodes']),edges=len(graph['edges']),evidence=len(ev),
                 rules=sorted({a['ruleId'] for a in analysis['alerts']}),alerts=len(analysis['alerts']),
                 suppressed=sum(a['suppressed'] for a in analysis['alerts']),loadSeconds=round(load_time,3),analysisSeconds=round(analysis_time,3),quality=quality)
    (artifacts/'verification.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))


if __name__=='__main__':
    main()

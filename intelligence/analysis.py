"""Descriptive graph rules. Every alert cites only the evidence that supports it."""
import hashlib
import json
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from pathlib import Path

import networkx as nx

RULES = json.loads(Path(__file__).with_name('rules.json').read_text())


def analyze(payload, rules=None):
    cfg = rules or RULES
    nodes = {n['id']: n for n in sorted(payload['nodes'], key=lambda n: n['id'])}
    edges = sorted(payload['edges'], key=lambda e: e['id'])
    graph = nx.Graph()
    graph.add_nodes_from(nodes)
    graph.add_edges_from((e['source'], e['target']) for e in edges if e['source'] != e['target'])
    communities = list(nx.community.louvain_communities(graph, seed=cfg['seed'])) if graph.number_of_edges() else [{n} for n in graph]
    communities = sorted((sorted(c) for c in communities), key=lambda c: c[0])
    membership = {n: i for i, c in enumerate(communities) for n in c}
    degree, between = nx.degree_centrality(graph), nx.betweenness_centrality(graph)
    max_b = max(between.values(), default=0) or 1
    max_c = max((len(n.get('properties', {}).get('caseIds', [])) for n in nodes.values()), default=0) or 1
    metrics = []
    for nid, node in nodes.items():
        d = degree[nid] if len(nodes) > 1 else 0
        b = between[nid] / max_b
        c = len(node.get('properties', {}).get('caseIds', [])) / max_c
        w = cfg['influence_weights']
        metrics.append(dict(entityId=nid, degree=round(d, 6), betweenness=round(b, 6),
                            caseComponent=round(c, 6), influence=round(100*(w['degree']*d+w['betweenness']*b+w['cases']*c), 2),
                            community=membership[nid]))
    alerts = []
    incident = defaultdict(list)
    for e in edges:
        incident[e['source']].append(e)
        incident[e['target']].append(e)
    def emit(rule, ids, supporting, explanation, suppressed=False):
        ids = sorted(set(ids))
        ev = sorted({x for e in supporting for x in e.get('properties', {}).get('evidenceIds', [])})
        digest = hashlib.sha256((rule+'|'+','.join(ids)+'|'+explanation).encode()).hexdigest()[:16]
        alerts.append(dict(id=digest, ruleId=rule, entityIds=ids, evidenceIds=ev, explanation=explanation, suppressed=suppressed))
    for nid, node in nodes.items():
        props = node.get('properties', {})
        cases = props.get('caseIds', [])
        related = incident[nid]
        persons = {e['source'] if e['target'] == nid else e['target'] for e in related
                   if e['type'] in ('USES', 'OWNS')}
        persons = {p for p in persons if nodes[p]['type'] == 'Person'}
        person_cases = {c for p in persons for c in nodes[p].get('properties', {}).get('caseIds', [])}
        if node['type'] == 'Phone' and len(person_cases) >= cfg['shared_cases']:
            suppressed = node['label'] in cfg['public_identifiers']
            emit('R1', [nid, *persons], related,
                 f"{node['label']} links {len(persons)} people across {len(person_cases)} cases." +
                 (' Suppressed — public/service number; shared use is expected.' if suppressed else ' Review source records before drawing conclusions.'), suppressed)
        if node['type'] == 'Account' and (len(persons) >= cfg['shared_persons'] or len(cases) >= cfg['shared_cases']):
            suppressed = node['label'] in cfg['public_identifiers']
            emit('R2', [nid, *persons], related, f"{node['label']} is linked to {len(persons)} people and {len(cases)} cases." +
                 (' Suppressed — public/service number.' if suppressed else ' Shared account is a lead for review.'), suppressed)
        neighbor_communities = {membership[n] for n in graph.neighbors(nid)}
        if len(neighbor_communities) >= 2 and between[nid] >= cfg['bridge_betweenness']:
            emit('R3', [nid], related, f"{node['label']} connects {len(neighbor_communities)} communities; normalized betweenness is {between[nid]:.4f}.")
    incoming, outgoing = defaultdict(list), defaultdict(list)
    for e in edges:
        if e['type'] != 'TRANSFERRED_TO':
            continue
        incoming[e['target']].append(e)
        outgoing[e['source']].append(e)
        events = e.get('properties', {}).get('events', [])
        if len(events) >= cfg['repeated_transfers']:
            emit('R4', [e['source'], e['target']], [e], f'{len(events)} transfers occurred between the same pair of accounts.')
    for target, es in sorted(incoming.items()):
        senders = {e['source'] for e in es}
        if len(senders) >= cfg['fan_in_senders']:
            emit('R4', [target, *senders], es, f'Fan-in: {len(senders)} distinct accounts sent {sum(len(e["properties"].get("events", [])) for e in es)} transfers to {nodes[target]["label"]}.')
        pairs, support = 0, []
        for ein in es:
            for eout in outgoing[target]:
                for a in ein['properties'].get('events', []):
                    for b in eout['properties'].get('events', []):
                        delta = (datetime.fromisoformat(b['timestamp'].replace('Z', '+00:00')) - datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00'))).total_seconds()/60
                        if 0 <= delta <= cfg['pass_through_minutes']:
                            pairs += 1
                            support.extend([ein, eout])
        if pairs:
            emit('R4', [target], support, f'Rapid pass-through: {pairs} incoming/outgoing transfer pairs within {cfg["pass_through_minutes"]} minutes. Timing alone does not establish the origin of funds.')
    at_location = defaultdict(list)
    for e in edges:
        if e['type'] == 'SEEN_AT':
            at_location[e['target']].append(e)
    for loc, es in sorted(at_location.items()):
        for a, b in combinations(es, 2):
            if a['source'] == b['source']:
                continue
            windows = set()
            for x in a['properties'].get('events', []):
                for y in b['properties'].get('events', []):
                    tx = datetime.fromisoformat(x['timestamp'].replace('Z', '+00:00')).timestamp()
                    ty = datetime.fromisoformat(y['timestamp'].replace('Z', '+00:00')).timestamp()
                    if abs(tx-ty) <= cfg['colocation_minutes']*60:
                        windows.add(int(min(tx,ty)//(cfg['colocation_minutes']*60)))
            if len(windows) >= cfg['colocation_windows']:
                emit('R5', [loc, a['source'], b['source']], [a,b], f'Repeated co-location: 2 entities at {nodes[loc]["label"]} in {len(windows)} distinct overlapping {cfg["colocation_minutes"]}-minute windows.')
    for e in edges:
        if e['type'] == 'CO_ACCUSED' and len(e['properties'].get('caseIds', [])) >= cfg['shared_cases']:
            emit('R6', [e['source'], e['target']], [e], f'The same 2 people are co-accused in {len(e["properties"]["caseIds"])} cases. This is a record relationship, not a finding of guilt.')
    return dict(metrics=sorted(metrics, key=lambda m: (-m['influence'],m['entityId'])),
                alerts=sorted(alerts,key=lambda a:(a['ruleId'], a['id'])),
                communities=[dict(id=i, entityIds=c) for i,c in enumerate(communities)],
                counts=dict(records=len(payload.get('records', [])), entities=len(nodes), relationships=len(edges),
                            casesLinked=len({c for n in nodes.values() if n['type'] in ('Phone','Account') and n['label'] not in cfg['public_identifiers'] and len(n.get('properties',{}).get('caseIds',[]))>1 for c in n['properties']['caseIds']})))

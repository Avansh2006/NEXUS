"""Descriptive graph rules. Every alert cites only the evidence that supports it."""
import hashlib
import json
import time
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from pathlib import Path

import networkx as nx

RULES = json.loads(Path(__file__).with_name('rules.json').read_text())


def analyze(payload, rules=None):
    t_start = time.perf_counter()
    cfg = rules or RULES
    nodes = {n['id']: n for n in sorted(payload['nodes'], key=lambda n: n['id'])}
    edges = sorted(payload['edges'], key=lambda e: e['id'])
    graph = nx.Graph()
    graph.add_nodes_from(nodes)
    graph.add_edges_from((e['source'], e['target']) for e in edges if e['source'] != e['target'])
    
    t_comm_start = time.perf_counter()
    communities = list(nx.community.louvain_communities(graph, seed=cfg['seed'])) if graph.number_of_edges() else [{n} for n in graph]
    communities = sorted((sorted(c) for c in communities), key=lambda c: c[0])
    membership = {n: i for i, c in enumerate(communities) for n in c}
    t_comm = time.perf_counter() - t_comm_start

    t_metrics_start = time.perf_counter()
    degree = nx.degree_centrality(graph)
    n_count = len(graph)
    if n_count > 500:
        k_samples = min(n_count, max(50, int(n_count**0.5 * 5)))
        between = nx.betweenness_centrality(graph, k=k_samples, seed=cfg['seed'])
        between_mode = f"approximate (k={k_samples})"
    else:
        between = nx.betweenness_centrality(graph)
        between_mode = "exact"
        k_samples = n_count
    articulation = set(nx.articulation_points(graph))
    t_metrics = time.perf_counter() - t_metrics_start

    max_b = max(between.values(), default=0) or 1
    max_c = max((len(n.get('properties', {}).get('caseIds', [])) for n in nodes.values()), default=0) or 1
    metrics = []
    metrics_by_id = {}
    for nid, node in nodes.items():
        d = degree[nid] if len(nodes) > 1 else 0
        b = between[nid] / max_b
        c = len(node.get('properties', {}).get('caseIds', [])) / max_c
        w = cfg['influence_weights']
        inf = round(100*(w['degree']*d+w['betweenness']*b+w['cases']*c), 2)
        ntype = node.get('type')
        case_count = len(node.get('properties', {}).get('caseIds', []))
        tactical_role = 'HIGH_ACTIVITY_NODE'
        role_title = 'High-Activity Node'
        role_criteria = f"Degree={d}, Normalized Betweenness={b:.3f}, Cases={case_count}, Influence={inf}"
        role_hypothesis = "Pattern hypothesis — for investigator review."
        if ntype == 'Person':
            if case_count >= 2 and b >= 0.05 and inf >= 25:
                tactical_role = 'CENTRAL_HUB'
                role_title = 'Central Hub (bridge pattern)'
                role_criteria = f"Cases={case_count} (>=2), Betweenness={b:.3f} (>=0.05), Influence={inf} (>=25)"
            elif nid in articulation or b >= cfg.get('bridge_betweenness', 0.04):
                tactical_role = 'CROSS_CLUSTER_BROKER'
                role_title = 'Cross-Cluster Broker Pattern'
                role_criteria = f"Betweenness={b:.3f} (>={cfg.get('bridge_betweenness', 0.04)}) or Articulation Point"
            elif inf >= 20:
                tactical_role = 'HIGH_ACTIVITY_NODE'
                role_title = 'High-Activity Node'
                role_criteria = f"Influence={inf} (>=20)"
            else:
                tactical_role = 'ASSOCIATE_NODE'
                role_title = 'Associated Node'
        elif ntype == 'Account':
            tactical_role = 'FINANCIAL_NODE'
            role_title = 'Financial Account'
        elif ntype == 'Phone':
            if case_count >= 2:
                tactical_role = 'OUTBOUND_HUB'
                role_title = 'Outbound Communication Hub'
                role_criteria = f"Cases={case_count} (>=2)"
            else:
                tactical_role = 'COMMUNICATION_NODE'
                role_title = 'Communication Node'
        elif ntype == 'Vehicle':
            tactical_role = 'TRANSPORT_ASSET'
            role_title = 'Transport Asset'
        elif ntype == 'Organization':
            tactical_role = 'BUSINESS_ENTITY'
            role_title = 'Business Entity (unverified)'
        elif ntype == 'Location':
            tactical_role = 'LOCATION_NEXUS'
            role_title = 'Location Nexus'

        m_dict = dict(entityId=nid, degree=round(d, 6), betweenness=round(b, 6),
                      caseComponent=round(c, 6), influence=inf,
                      community=membership[nid],
                      tacticalRole=tactical_role,
                      roleTitle=role_title,
                      roleCriteria=role_criteria,
                      roleHypothesis=role_hypothesis)
        metrics.append(m_dict)
        metrics_by_id[nid] = m_dict
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
            emit('R1', [nid, *persons], [e for e in related if e['type'] in ('USES','CONNECTED_TO_CASE')],
                 f"{node['label']} links {len(persons)} people across {len(person_cases)} cases." +
                 (' Suppressed — public/service number; shared use is expected.' if suppressed else ' Review source records before drawing conclusions.'), suppressed)
        if node['type'] == 'Account' and (len(persons) >= cfg['shared_persons'] or len(cases) >= cfg['shared_cases']):
            suppressed = node['label'] in cfg['public_identifiers']
            emit('R2', [nid, *persons], [e for e in related if e['type'] in ('OWNS','USES','CONNECTED_TO_CASE')], f"{node['label']} is linked to {len(persons)} people and {len(cases)} cases." +
                 (' Suppressed — public/service number.' if suppressed else ' Shared account is a lead for review.'), suppressed)
        neighbor_communities = {membership[n] for n in graph.neighbors(nid)}
        if len(neighbor_communities) >= 2 and (nid in articulation or between[nid] >= cfg['bridge_betweenness']):
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
            if target in metrics_by_id:
                metrics_by_id[target]['tacticalRole'] = 'PASS_THROUGH_ACCOUNT'
                metrics_by_id[target]['roleTitle'] = 'Pass-Through Account Pattern'
                metrics_by_id[target]['roleCriteria'] = f"Fan-in: {len(senders)} senders (>={cfg['fan_in_senders']})"
                metrics_by_id[target]['roleHypothesis'] = 'Pattern hypothesis — for investigator review. Account holders may be unwitting participants or victims.'
            emit('R4', [target, *senders], es, f'Fan-in: {len(senders)} distinct accounts sent {sum(len(e["properties"].get("events", [])) for e in es)} transfers to {nodes[target]["label"]}.')
        pairs, support = 0, []
        for ein in es:
            for eout in outgoing[target]:
                for a in ein['properties'].get('events', []):
                    for b in eout['properties'].get('events', []):
                        delta = (datetime.fromisoformat(b['timestamp'].replace('Z', '+00:00')) - datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00'))).total_seconds()/60
                        if 0 <= delta <= cfg['pass_through_minutes']:
                            pairs += 1
                            support.append({'properties': {'evidenceIds': [a['evidenceId'], b['evidenceId']]}})
        if pairs:
            if target in metrics_by_id:
                metrics_by_id[target]['tacticalRole'] = 'PASS_THROUGH_ACCOUNT'
                metrics_by_id[target]['roleTitle'] = 'Pass-Through Account Pattern'
                metrics_by_id[target]['roleCriteria'] = f"Rapid pass-through: {pairs} pairs within {cfg['pass_through_minutes']}m"
                metrics_by_id[target]['roleHypothesis'] = 'Pattern hypothesis — for investigator review. Account holders may be unwitting participants or victims.'
            emit('R4', [target], support, f'Rapid pass-through: {pairs} incoming/outgoing transfer pairs within {cfg["pass_through_minutes"]} minutes. Timing alone does not establish the origin of funds.')
    tx_graph = nx.DiGraph()
    tx_lookup = defaultdict(list)
    for e in edges:
        if e['type'] == 'TRANSFERRED_TO':
            tx_graph.add_edge(e['source'], e['target'])
            tx_lookup[(e['source'], e['target'])].append(e)
    if tx_graph.number_of_nodes() >= 3:
        try:
            cycles = [c for c in nx.simple_cycles(tx_graph) if 3 <= len(c) <= 5]
            for cyc in sorted(cycles, key=lambda c: (len(c), c[0])):
                cyc_nodes = list(cyc)
                support = [e for i in range(len(cyc_nodes)) for e in tx_lookup.get((cyc_nodes[i], cyc_nodes[(i+1)%len(cyc_nodes)]), [])]
                names = ' -> '.join(nodes[n]['label'] for n in cyc_nodes)
                emit('R7', cyc_nodes, support, f'Circular fund transaction loop detected across {len(cyc_nodes)} accounts: {names} -> {nodes[cyc_nodes[0]]["label"]}. Closed transaction cycles represent a round-tripping transfer pattern for review.')
        except Exception:
            pass
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
    links = defaultdict(list)
    for nid, n in nodes.items():
        if n['type'] in ('Phone', 'Account') and n['label'] not in cfg['public_identifiers']:
            for pair in combinations(sorted(n.get('properties', {}).get('caseIds', [])), 2):
                links[pair].append(nid)
    case_links = []
    for pair, ids in sorted(links.items()):
        support = sorted({eid for nid in ids for eid in nodes[nid]['properties'].get('evidenceIds', [])})
        case_links.append(dict(caseIds=list(pair), entityIds=sorted(ids), evidenceIds=support,
                               explanation=f'{pair[0]} and {pair[1]} share {len(ids)} non-public phone/account identifiers. Review the underlying records; cases are not automatically merged.'))
    telemetry = dict(
        nodeCount=len(nodes),
        edgeCount=len(edges),
        betweennessMode=between_mode,
        kSamples=k_samples,
        communityCount=len(communities),
    )
    if cfg.get('include_timing', False):
        t_total = time.perf_counter() - t_start
        telemetry['computationTimeMs'] = round(t_total * 1000, 2)
        telemetry['breakdownMs'] = dict(
            communities=round(t_comm * 1000, 2),
            centrality=round(t_metrics * 1000, 2)
        )
    return dict(metrics=sorted(metrics, key=lambda m: (-m['influence'],m['entityId'])),
                alerts=sorted(alerts,key=lambda a:(a['ruleId'], a['id'])),
                caseLinks=case_links,
                communities=[dict(id=i, entityIds=c) for i,c in enumerate(communities)],
                telemetry=telemetry,
                counts=dict(records=len(payload.get('records', [])), entities=len(nodes), relationships=len(edges),
                            casesLinked=len({c for n in nodes.values() if n['type'] in ('Phone','Account') and n['label'] not in cfg['public_identifiers'] and len(n.get('properties',{}).get('caseIds',[]))>1 for c in n['properties']['caseIds']})))

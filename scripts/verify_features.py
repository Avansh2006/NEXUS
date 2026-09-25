"""Authenticated synthetic feature checks; never resets data or controls services.

Run prepare against an already loaded demo, restart services externally, then run
verify-persistence. Stop only the intelligence service externally for
verify-unavailable, restart it, then run verify-recovered.
"""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'artifacts' / 'azure' / 'workflow-state.json'
BASE = os.environ.get('NEXUS_API', 'http://127.0.0.1:8081/api').rstrip('/')


def check(condition, message):
    if not condition:
        raise AssertionError(message)


class Client:
    def __init__(self, role):
        password = os.environ.get('NEXUS_' + role.upper() + '_PASSWORD')
        if not password:
            raise RuntimeError('Missing NEXUS_' + role.upper() + '_PASSWORD')
        self.token = None
        result, _ = self.call('/auth/login', {'username': role, 'password': password})
        self.token = result['token']

    def call(self, path, body=None, expected=200, raw=False, timeout=60):
        """Retry only rejected 429 requests, twice; never retry ambiguous writes."""
        headers = {'Accept': '*/*'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        data = None
        if body is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        for attempt in range(3):
            request = urllib.request.Request(BASE + path, data=data, headers=headers)
            try:
                response = urllib.request.urlopen(request, timeout=timeout)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                status, response_headers, payload = response.code, response.headers, response.read()
            if status == 429 and attempt < 2:
                try:
                    delay = int(response_headers.get('Retry-After', '1'))
                except ValueError:
                    delay = 1
                check(0 <= delay <= 60, 'Rate-limit delay exceeds bounded retry budget')
                print('Rate limited; retrying rejected request in bounded interval.', flush=True)
                time.sleep(max(1, delay) + 1)
                continue
            check(status == expected, f'{path.split("?")[0]}: expected HTTP {expected}, received {status}')
            check(bool(response_headers.get('X-Request-ID')), 'Missing response request ID')
            return (payload.decode('utf-8') if raw else json.loads(payload)), response_headers
        raise AssertionError('Retry budget exhausted')

    def get(self, path, timeout=60):
        return self.call(path, timeout=timeout)[0]

    def post(self, path, body, expected=200):
        return self.call(path, body, expected)[0]


def entity_path(entity_id, suffix):
    return '/entities/' + urllib.parse.quote(entity_id, safe='') + '/' + suffix


def verify_exports(viewer, graph, special_case):
    exports = {}
    for name in ('nodes.csv', 'edges.csv', 'graph.graphml'):
        content, headers = viewer.call('/exports/' + name, raw=True)
        check(name in headers.get('Content-Disposition', ''), 'Export filename missing')
        check(('graphml+xml' if name.endswith('graphml') else 'text/csv') in headers.get('Content-Type', ''), 'Wrong export content type')
        exports[name] = content
    nodes = list(csv.DictReader(io.StringIO(exports['nodes.csv'])))
    edges = list(csv.DictReader(io.StringIO(exports['edges.csv'])))
    check(len(nodes) == len(graph['nodes']) and len(edges) == len(graph['edges']), 'CSV row counts differ from full graph')
    original_nodes = {n['id']: n for n in graph['nodes']}
    special = next(n for n in nodes if original_nodes[n['id']]['label'] == special_case)
    check(special['label'] == "'" + special_case, 'CSV formula/quote/newline escaping failed')
    for row in nodes + edges:
        json.loads(row['evidenceIds'])
        json.loads(row['recordIds'])
        support = json.loads(row['support'])
        check(support['level'] in ('Low', 'Medium', 'High'), 'CSV support metadata missing')
        json.loads(row['properties'])
    ns = {'g': 'http://graphml.graphdrawing.org/xmlns'}
    xml = ET.fromstring(exports['graph.graphml'])
    keys = {element.attrib['id'] for element in xml.findall('g:key', ns)}
    check(all(element.attrib['key'] in keys for element in xml.findall('.//g:data', ns)), 'GraphML contains undeclared keys')
    check(len(xml.findall('.//g:node', ns)) == len(nodes), 'GraphML node count incorrect')
    check(any(e.text == special_case for e in xml.findall('.//g:data[@key="label"]', ns)), 'GraphML text escaping failed')
    node_ids = {e.attrib['id'] for e in xml.findall('.//g:node', ns)}
    check(all(e.attrib['source'] in node_ids and e.attrib['target'] in node_ids for e in xml.findall('.//g:edge', ns)), 'GraphML contains dangling edges')


def prepare():
    admin, investigator, viewer = Client('admin'), Client('investigator'), Client('viewer')
    graph = admin.get('/graph')
    check(bool(graph['nodes']) and bool(graph['records']), 'Load the synthetic demo before prepare')
    target = next(n['id'] for n in graph['nodes'] if n['type'] != 'Case')
    for path, body in [(entity_path(target, 'notes'), {'text': 'forbidden'}), (entity_path(target, 'watchlist'), {'watched': True}), ('/analyze', {})]:
        viewer.post(path, body, 403)
    investigator.post('/demo/reset', {}, 403)
    viewer.call('/diagnostics', expected=403)
    investigator.call('/diagnostics', expected=403)
    check(admin.get('/diagnostics')['status'] == 'ok', 'Diagnostics not healthy before testing')
    investigator.post(entity_path('missing-feature-test-id', 'notes'), {'text': 'unknown'}, 404)
    investigator.post(entity_path(target, 'notes'), {'text': ' '}, 400)
    investigator.post(entity_path(target, 'notes'), {'text': 'x' * 4001}, 400)
    viewer.post('/what-if/remove', {'entityIds': []}, 400)
    viewer.post('/what-if/remove', {'entityIds': ['missing-feature-test-id']}, 400)

    marker = 'feature-' + uuid.uuid4().hex[:12]
    special_case = '=' + marker + ' "<&\ncase'
    narrative = '🔎 आरोपी रवि कुमार, खाता संख्या ९८७६५४३२१०; गवाह सीमा देवी ने बयान दिया। Instagram handle @Feature.User; UPI feature@bank; phone SYN-PHONE-080.'
    record = {'caseId': special_case, 'date': '2026-09-23T00:00:00Z', 'text': narrative, 'sourceReliability': 'A', 'informationCredibility': 1}
    invalid = dict(record, informationCredibility=9)
    result = investigator.post('/data/intel-report', {'records': [invalid]})
    check(result['accepted'] == 0 and len(result['errors']) == 1, 'Invalid supplied grade accepted')
    for kind in ('intel-report', 'surveillance-report', 'criminal-history'):
        result = investigator.post('/data/' + kind, {'records': [record]})
        check(result['accepted'] == 1 and not result['errors'], 'Narrative ingestion failed: ' + kind)
    investigator.post('/analyze', {})
    graph = investigator.get('/graph')
    source_ids = [r['id'] for r in graph['records'] if r['payload'].get('caseId') == special_case]
    check(len(source_ids) == 3, 'New source records not retained')
    check(any(n['type'] == 'SocialHandle' for n in graph['nodes']), 'Social handle extraction missing')
    check(any(n['type'] == 'Person' and n['label'] == 'रवि कुमार' for n in graph['nodes']), 'Hindi extraction missing')
    source_evidence = [e for e in graph['evidence'] if e['recordId'] in source_ids and e.get('start') is not None]
    check(bool(source_evidence), 'Narrative evidence spans missing')
    utf16 = narrative.encode('utf-16-le')
    check(all(utf16[e['start'] * 2:e['end'] * 2].decode('utf-16-le') == e['raw'] for e in source_evidence), 'Non-BMP/Hindi evidence offsets corrupted')
    support_keys = {'level', 'recordCount', 'sourceKindCount', 'minimumExtractionConfidence', 'credibilityAssessed', 'lowCredibility', 'explanation'}
    check(all(support_keys <= item['properties']['support'].keys() for item in graph['nodes'] + graph['edges']), 'Support field contract incomplete')
    check(any(n['properties']['support']['sourceKindCount'] >= 3 for n in graph['nodes'] if n['type'] == 'SocialHandle'), 'Independent source-kind support not counted')

    note = investigator.post(entity_path(target, 'notes'), {'text': marker})
    check(note['author'] == 'investigator' and note['entityId'] == target, 'Note author/entity attribution incorrect')
    investigator.post(entity_path(target, 'watchlist'), {'watched': True})
    investigator.post(entity_path(target, 'watchlist'), {'watched': True})
    check(investigator.get('/watchlist').count(target) == 1, 'Watchlist is not idempotent')
    check(target not in viewer.get('/watchlist'), 'Watchlist leaked between users')
    alerts = graph['analysis']['alerts']
    check(bool(alerts), 'Analyzed demo has no alerts for triage test')
    alert_id = alerts[0]['id']
    old = next((t for t in investigator.get('/workflow')['triage'] if t['alertId'] == alert_id), None)
    version = old['version'] if old else 0
    path = '/alerts/' + urllib.parse.quote(alert_id, safe='') + '/triage'
    triage = investigator.post(path, {'status': 'Under Review', 'version': version})
    check(triage['version'] == version + 1 and triage['author'] == 'investigator', 'Triage version/author incorrect')
    investigator.post(path, {'status': 'Verified', 'version': version}, 409)
    investigator.post(path, {'status': 'unsupported', 'version': version + 1}, 400)
    investigator.post('/alerts/missing-feature-test-id/triage', {'status': 'New', 'version': 0}, 404)
    before = viewer.get('/graph')
    simulation = viewer.post('/what-if/remove', {'entityIds': [target]})
    check(simulation['removedEntityIds'] == [target], 'Simulation did not report selected entity')
    check(all(k in simulation[part] for part in ('before', 'after') for k in ('components', 'largestComponent', 'isolatedNodes')), 'Simulation metric contract incomplete')
    check(viewer.get('/graph') == before, 'Simulation mutated persisted graph')
    verify_exports(viewer, graph, special_case)
    check(admin.get('/audit/verify')['valid'], 'Audit chain invalid')
    check(any(a['action'] == 'note:create' and a['userId'] == 'investigator' for a in admin.get('/audit')), 'Workflow audit attribution absent')
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({'marker': marker, 'entityId': target, 'noteId': note['id'], 'triage': triage, 'sourceIds': source_ids}, indent=2), encoding='utf-8')
    print('prepare PASS: role boundaries, narratives, evidence spans/support, workflow, exports, simulation, audit, diagnostics; persistence markers saved.', flush=True)


def persistence():
    state = json.loads(STATE.read_text(encoding='utf-8'))
    client = Client('investigator')
    workflow = client.get('/workflow')
    notes = client.get(entity_path(state['entityId'], 'notes'))
    check(any(n['id'] == state['noteId'] and n['text'] == state['marker'] for n in notes), 'Note did not survive restart')
    check(any(n['id'] == state['noteId'] for n in workflow['notes']), 'Workflow note absent after restart')
    check(state['entityId'] in workflow['watchlist'], 'Watchlist did not survive restart')
    check(state['triage'] in workflow['triage'], 'Triage did not survive restart unchanged')
    check(set(state['sourceIds']) <= {r['id'] for r in client.get('/graph')['records']}, 'Source graph did not survive restart')
    check(client.get('/audit/verify')['valid'], 'Audit chain invalid after restart')
    print('verify-persistence PASS: notes, per-user watchlist, triage, sources and audit survived restart.', flush=True)


def recovered_diagnostics(client, timeout=30):
    """Wait for the authenticated API's service path, not container-local health."""
    started = time.monotonic()
    polls = 0
    while True:
        elapsed = time.monotonic() - started
        if elapsed >= timeout:
            print(f'Recovery timeout: {polls} diagnostics polls, {elapsed:.2f}s elapsed.', flush=True)
            raise AssertionError('Intelligence did not recover through authenticated API within 30 seconds')
        diagnostics = client.get('/diagnostics', timeout=max(0.001, timeout - elapsed))
        polls += 1
        elapsed = time.monotonic() - started
        check(diagnostics['database']['status'] == 'ok', 'Database unavailable during intelligence recovery')
        if diagnostics['intelligence']['status'] == 'ok' and diagnostics['status'] == 'ok':
            print(f'Recovery convergence: {polls} diagnostics polls, {elapsed:.2f}s elapsed.', flush=True)
            return diagnostics
        if elapsed >= timeout:
            print(f'Recovery timeout: {polls} diagnostics polls, {elapsed:.2f}s elapsed.', flush=True)
            raise AssertionError('Intelligence did not recover through authenticated API within 30 seconds')
        time.sleep(min(1, timeout - elapsed))


def availability(recovered):
    client = Client('admin')
    diagnostics = recovered_diagnostics(client) if recovered else client.get('/diagnostics')
    check(diagnostics['database']['status'] == 'ok', 'Database unavailable during intelligence availability test')
    check(diagnostics['intelligence']['status'] == ('ok' if recovered else 'unavailable'), 'Unexpected intelligence status')
    check(diagnostics['status'] == ('ok' if recovered else 'degraded'), 'Overall diagnostic status incorrect')
    quality, headers = client.call('/quality', expected=200 if recovered else 503)
    if not recovered:
        check(quality['error']['code'] == 'ENGINE_UNAVAILABLE', 'Unavailable error contract incorrect')
    check(bool(headers.get('X-Request-ID')), 'Quality response missing request ID')
    print(('verify-recovered' if recovered else 'verify-unavailable') + ' PASS: diagnostics, quality response and request ID checked.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('prepare', 'verify-persistence', 'verify-unavailable', 'verify-recovered'), default='prepare')
    phase = parser.parse_args().phase
    try:
        if phase == 'prepare':
            prepare()
        elif phase == 'verify-persistence':
            persistence()
        else:
            availability(phase == 'verify-recovered')
    except (AssertionError, RuntimeError) as error:
        print(f'{phase} FAIL: {error}', file=sys.stderr)
        return 1
    except Exception as error:
        # Do not expose request objects, response bodies, passwords, or tokens.
        print(f'{phase} FAIL: {type(error).__name__}; request was not retried.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

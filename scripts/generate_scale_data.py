"""Scale synthetic data generator and benchmark suite for NEXUS.
Generates realistic multi-community criminal syndicate networks at 1k, 10k, and 50k scales.
Evaluates graph construction, Louvain community detection, exact vs sampled betweenness, and memory footprint.
"""
import argparse
import json
import math
import random
import sys
import time
import tracemalloc
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import networkx as nx
from intelligence.analysis import analyze

SCALES = {
    '1k': {'cases': 50, 'nodes_target': 1200, 'edges_target': 3200},
    '10k': {'cases': 300, 'nodes_target': 10000, 'edges_target': 35000},
    '50k': {'cases': 1200, 'nodes_target': 50000, 'edges_target': 195000},
}

FIRST_NAMES = [
    'Aariv', 'Mira', 'Dev', 'Rivan', 'Isha', 'Karan', 'Siddharth', 'Ananya',
    'Vikram', 'Pooja', 'Rohan', 'Neha', 'Kabir', 'Aditi', 'Arjun', 'Sanya',
    'Varun', 'Kavya', 'Nikhil', 'Tanvi', 'Rahul', 'Simran', 'Sameer', 'Priya'
]
LAST_NAMES = [
    'Veylan', 'Solven', 'Neral', 'Kesh', 'Torven', 'Bhati', 'Sharma', 'Verma',
    'Patel', 'Reddy', 'Mehta', 'Nair', 'Chopra', 'Malhotra', 'Gupta', 'Singh',
    'Yadav', 'Deshmukh', 'Joshi', 'Bose', 'Banerjee', 'Rao', 'Iyer', 'Menon'
]
CRIMES = [
    'Investment scam', 'Cyber fraud', 'Loan-app harassment', 'SIM-swap fraud',
    'Pass-through money laundering', 'Identity theft', 'Vehicle theft', 'Extortion'
]


def generate_scale_network(scale_name='1k', seed=42):
    random.seed(seed)
    cfg = SCALES.get(scale_name, SCALES['1k'])
    num_cases = cfg['cases']
    target_nodes = cfg['nodes_target']
    target_edges = cfg['edges_target']

    nodes = []
    edges = []
    records = []

    # 1. Generate Case Nodes
    cases = [f"SCALE-CASE-{i+1:04d}" for i in range(num_cases)]
    for c in cases:
        nodes.append({
            "id": f"case-{c.lower()}",
            "type": "Case",
            "label": c,
            "properties": {"caseIds": [c], "crimeType": random.choice(CRIMES)}
        })

    # 2. Shared Syndicate Core (High-betweenness hubs and money laundering bridges)
    core_hubs_count = max(3, num_cases // 15)
    hub_phones = [f"SYN-PHONE-HUB-{i+1:03d}" for i in range(core_hubs_count)]
    hub_accounts = [f"SYN-ACCOUNT-HUB-{i+1:03d}" for i in range(core_hubs_count)]

    for p in hub_phones:
        associated_cases = random.sample(cases, k=min(len(cases), random.randint(3, max(4, num_cases // 5))))
        nodes.append({
            "id": f"phone-{p.lower()}",
            "type": "Phone",
            "label": p,
            "properties": {"caseIds": associated_cases, "evidenceIds": [f"ev-{p}-1"]}
        })
        for c in associated_cases:
            edges.append({
                "id": f"edge-conn-{p}-{c}",
                "source": f"phone-{p.lower()}",
                "target": f"case-{c.lower()}",
                "type": "CONNECTED_TO_CASE",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })

    for a in hub_accounts:
        associated_cases = random.sample(cases, k=min(len(cases), random.randint(3, max(4, num_cases // 5))))
        nodes.append({
            "id": f"account-{a.lower()}",
            "type": "Account",
            "label": a,
            "properties": {"caseIds": associated_cases, "evidenceIds": [f"ev-{a}-1"]}
        })
        for c in associated_cases:
            edges.append({
                "id": f"edge-conn-{a}-{c}",
                "source": f"account-{a.lower()}",
                "target": f"case-{c.lower()}",
                "type": "CONNECTED_TO_CASE",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })

    # 3. Generate Cell Communities (Suspects, phones, accounts, locations per case)
    current_node_count = len(nodes)
    remaining_nodes = max(10, target_nodes - current_node_count)
    nodes_per_case = max(2, remaining_nodes // num_cases)

    suspect_nodes_by_case = {}
    phone_nodes_by_case = {}
    account_nodes_by_case = {}

    seq = 1
    for c in cases:
        suspect_nodes_by_case[c] = []
        phone_nodes_by_case[c] = []
        account_nodes_by_case[c] = []

        # Local suspects
        for _ in range(max(1, nodes_per_case // 3)):
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            pid = f"person-scale-{seq:05d}"
            seq += 1
            nodes.append({
                "id": pid,
                "type": "Person",
                "label": name,
                "properties": {"caseIds": [c], "evidenceIds": [f"ev-p-{seq}"]}
            })
            suspect_nodes_by_case[c].append(pid)
            edges.append({
                "id": f"edge-accused-{pid}-{c}",
                "source": pid,
                "target": f"case-{c.lower()}",
                "type": "ACCUSED_IN",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })

        # Local phones
        for _ in range(max(1, nodes_per_case // 3)):
            ph = f"SYN-PHONE-{seq:05d}"
            ph_id = f"phone-scale-{seq:05d}"
            seq += 1
            nodes.append({
                "id": ph_id,
                "type": "Phone",
                "label": ph,
                "properties": {"caseIds": [c], "evidenceIds": [f"ev-ph-{seq}"]}
            })
            phone_nodes_by_case[c].append(ph_id)
            edges.append({
                "id": f"edge-ph-{ph_id}-{c}",
                "source": ph_id,
                "target": f"case-{c.lower()}",
                "type": "CONNECTED_TO_CASE",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })

        # Local accounts
        for _ in range(max(1, nodes_per_case // 3)):
            acc = f"SYN-ACCOUNT-{seq:05d}"
            acc_id = f"account-scale-{seq:05d}"
            seq += 1
            nodes.append({
                "id": acc_id,
                "type": "Account",
                "label": acc,
                "properties": {"caseIds": [c], "evidenceIds": [f"ev-acc-{seq}"]}
            })
            account_nodes_by_case[c].append(acc_id)
            edges.append({
                "id": f"edge-acc-{acc_id}-{c}",
                "source": acc_id,
                "target": f"case-{c.lower()}",
                "type": "CONNECTED_TO_CASE",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })

    # 4. Generate Intra-case and Inter-case Call and Transaction Edges
    edge_seq = 1
    for c in cases:
        suspects = suspect_nodes_by_case[c]
        phones = phone_nodes_by_case[c]
        accounts = account_nodes_by_case[c]

        # Link suspects to phones
        for s in suspects:
            if phones:
                target_p = random.choice(phones)
                edges.append({
                    "id": f"edge-call-{edge_seq:06d}",
                    "source": s,
                    "target": target_p,
                    "type": "COMMUNICATED_WITH",
                    "properties": {"caseIds": [c], "evidenceIds": []}
                })
                edge_seq += 1

        # Link suspects to accounts
        for s in suspects:
            if accounts:
                target_a = random.choice(accounts)
                edges.append({
                    "id": f"edge-tx-{edge_seq:06d}",
                    "source": s,
                    "target": target_a,
                    "type": "TRANSFERRED_TO",
                    "properties": {"caseIds": [c], "evidenceIds": []}
                })
                edge_seq += 1

        # Connect cell to syndicate hubs
        hub_p = f"phone-{random.choice(hub_phones).lower()}"
        hub_a = f"account-{random.choice(hub_accounts).lower()}"
        if phones:
            edges.append({
                "id": f"edge-hub-call-{edge_seq:06d}",
                "source": random.choice(phones),
                "target": hub_p,
                "type": "CALLED",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })
            edge_seq += 1
        if accounts:
            edges.append({
                "id": f"edge-hub-tx-{edge_seq:06d}",
                "source": random.choice(accounts),
                "target": hub_a,
                "type": "TRANSFERRED_TO",
                "properties": {"caseIds": [c], "evidenceIds": []}
            })
            edge_seq += 1

    # Add extra random power-law edges to reach target_edges
    all_node_ids = [n['id'] for n in nodes if n['type'] != 'Case']
    while len(edges) < target_edges and len(all_node_ids) > 1:
        u, v = random.sample(all_node_ids, 2)
        edges.append({
            "id": f"edge-random-{edge_seq:06d}",
            "source": u,
            "target": v,
            "type": "TRANSACTED_WITH",
            "properties": {"caseIds": ["SYN-SYNDICATE-SCALE"], "evidenceIds": []}
        })
        edge_seq += 1

    return {
        "nodes": nodes,
        "edges": edges,
        "records": records
    }


def run_benchmark(scale_name='1k'):
    print(f"\n=======================================================")
    print(f" NEXUS SCALE BENCHMARK: {scale_name.upper()}")
    print(f"=======================================================")

    tracemalloc.start()
    t0 = time.perf_counter()
    graph_data = generate_scale_network(scale_name)
    gen_time = time.perf_counter() - t0
    gen_mem = tracemalloc.get_traced_memory()[1] / (1024 * 1024)
    tracemalloc.stop()

    n_nodes = len(graph_data['nodes'])
    n_edges = len(graph_data['edges'])
    print(f"  Nodes: {n_nodes:,}")
    print(f"  Edges: {n_edges:,}")
    print(f"  Generation Time: {gen_time*1000:.1f} ms (Peak RAM: {gen_mem:.1f} MB)")

    # Test Exact vs Sampled Betweenness Centrality
    G = nx.Graph()
    G.add_nodes_from(n['id'] for n in graph_data['nodes'])
    G.add_edges_from((e['source'], e['target']) for e in graph_data['edges'] if e['source'] != e['target'])

    print(f"\n  --- Centrality & Graph Algorithm Benchmarks ---")
    # 1. Degree Centrality
    t_deg = time.perf_counter()
    deg = nx.degree_centrality(G)
    deg_time = (time.perf_counter() - t_deg) * 1000
    print(f"  - Degree Centrality:              {deg_time:.2f} ms")

    # 2. Louvain Communities
    t_louv = time.perf_counter()
    comms = list(nx.community.louvain_communities(G, seed=42))
    louv_time = (time.perf_counter() - t_louv) * 1000
    print(f"  - Louvain Community Detection:    {louv_time:.2f} ms ({len(comms)} communities)")

    # 3. Sampled Betweenness Centrality (NEXUS Engine k-sampling)
    k_val = min(len(G), max(50, int(len(G)**0.5 * 5)))
    t_samp = time.perf_counter()
    samp_between = nx.betweenness_centrality(G, k=k_val, seed=42)
    samp_time = (time.perf_counter() - t_samp) * 1000
    print(f"  - Sampled Betweenness (k={k_val}):      {samp_time:.2f} ms")

    # 4. Exact Betweenness (Only on 1k scale to prevent timeouts)
    exact_time = None
    if n_nodes <= 1500:
        t_exact = time.perf_counter()
        exact_between = nx.betweenness_centrality(G)
        exact_time = (time.perf_counter() - t_exact) * 1000
        speedup = exact_time / max(0.1, samp_time)
        print(f"  - Exact Betweenness (k={n_nodes}):     {exact_time:.2f} ms")
        print(f"  --> Centrality Speedup:           {speedup:.1f}x faster with k-sampling")
    else:
        est_exact_s = (n_nodes * n_edges) / 10_000_000
        print(f"  - Exact Betweenness (O(V*E)):     SKIPPED (Est. {est_exact_s:.1f} s on {n_nodes} nodes)")

    # 5. Full NEXUS analyze() Pipeline
    tracemalloc.start()
    t_pipe = time.perf_counter()
    from intelligence.analysis import RULES
    test_rules = dict(RULES, include_timing=True)
    analysis_res = analyze(graph_data, rules=test_rules)
    pipe_time = (time.perf_counter() - t_pipe) * 1000
    pipe_mem = tracemalloc.get_traced_memory()[1] / (1024 * 1024)
    tracemalloc.stop()

    print(f"\n  --- Full NEXUS Intelligence Pipeline ---")
    print(f"  - Total Pipeline Latency:         {pipe_time:.2f} ms")
    print(f"  - Peak Memory Consumption:        {pipe_mem:.2f} MB")
    print(f"  - Communities Identified:         {len(analysis_res['communities'])}")
    print(f"  - Influential Pattern Leads:      {len(analysis_res['metrics'])}")
    print(f"  - Centrality Mode:                {analysis_res['telemetry']['betweennessMode']}")

    return {
        'scale': scale_name,
        'nodes': n_nodes,
        'edges': n_edges,
        'genTimeMs': gen_time * 1000,
        'louvainMs': louv_time,
        'sampledBetweenMs': samp_time,
        'exactBetweenMs': exact_time,
        'fullPipelineMs': pipe_time,
        'peakMemoryMb': pipe_mem
    }


def main():
    parser = argparse.ArgumentParser(description="NEXUS Scale Data Generator & Benchmark")
    parser.add_argument('--scale', choices=['1k', '10k', '50k'], default='1k', help="Scale size")
    parser.add_argument('--benchmark', action='store_true', help="Run benchmark suite")
    parser.add_argument('--benchmark-all', action='store_true', help="Benchmark 1k, 10k, and 50k scales")
    parser.add_argument('--output', type=str, default=None, help="Save generated network to JSON file")
    args = parser.parse_args()

    if args.benchmark_all:
        results = []
        for s in ['1k', '10k', '50k']:
            results.append(run_benchmark(s))
        print("\n=======================================================")
        print(" SUMMARY BENCHMARK TABLE")
        print("=======================================================")
        print(f"{'Scale':<8} | {'Nodes':<8} | {'Edges':<8} | {'Louvain':<10} | {'Sampled B.':<12} | {'Full Pipeline':<14} | {'RAM':<8}")
        print("-" * 75)
        for r in results:
            exact_str = f"{r['exactBetweenMs']:.1f}ms" if r['exactBetweenMs'] else "N/A (O(VE))"
            print(f"{r['scale']:<8} | {r['nodes']:<8} | {r['edges']:<8} | {r['louvainMs']:<7.1f}ms | {r['sampledBetweenMs']:<9.1f}ms | {r['fullPipelineMs']:<11.1f}ms | {r['peakMemoryMb']:<5.1f}MB")
        return

    if args.benchmark:
        run_benchmark(args.scale)
        return

    net = generate_scale_network(args.scale)
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(net, indent=2), encoding='utf-8')
        print(f"Saved {args.scale} network ({len(net['nodes'])} nodes, {len(net['edges'])} edges) to {out_path}")
    else:
        print(f"Generated {args.scale} network: {len(net['nodes'])} nodes, {len(net['edges'])} edges")


if __name__ == '__main__':
    main()

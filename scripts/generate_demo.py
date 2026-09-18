"""Reproducible fictional data. SYN prefixes deliberately cannot route to real users."""
import csv
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'demo'


def generate():
    random.seed(42)
    ROOT.mkdir(parents=True, exist_ok=True)
    names = ['Aariv Veylan', 'Mira Solven', 'Dev Neral', 'Rivan Kesh', 'Rivan Kesh', 'Isha Torven']
    crimes = ['Investment scam', 'Fake-job fraud', 'Loan-app harassment', 'SIM-swap fraud', 'Vehicle theft', 'Decoy inquiry']
    firs, cdr, transactions = [], [], []
    for i, (name, crime) in enumerate(zip(names, crimes), 1):
        case = f'NXS-{i:03}'
        phone = 'SYN-PHONE-001' if i <= 3 else f'SYN-PHONE-{i:03}'
        account = 'SYN-ACCOUNT-001' if i <= 3 else f'SYN-ACCOUNT-{i:03}'
        text = (f'SYNTHETIC TRAINING RECORD. Case {case}. Accused {name}; phone {phone}; '
                f'account {account}; location Navapur Sector {i}; organization Veyra Services. '
                'Public service SYN-PHONE-999 is a fictional courier helpdesk. ')
        if i == 2:
            text += 'Co-accused Aariv Veylan; phone SYN-PHONE-001. '
        if i <= 2:
            text += 'Co-accused Lio Marven; phone SYN-PHONE-020. '
        if i == 3:
            text += 'Witness Aariv Veylan; phone SYN-PHONE-001. '
        if i == 4:
            text += 'Witness Aariv Veylan; phone SYN-PHONE-044. '
        if i == 5:
            text += 'Vehicle ZZ00NX0001. '
        if i == 6:
            text += 'Witness Aariv Veylen; phone SYN-PHONE-061. '
        firs.append(dict(caseId=case, text=text, date=f'2026-09-{i+1:02}T09:00:00Z', crimeType=crime))
        for j in range(10):
            cdr.append(dict(caseId=case, **{'from': phone, 'to': f'SYN-PHONE-{100+i*10+j:03}'},
                            timestamp=f'2026-09-{i+1:02}T{10+j//6:02}:{j%6*10:02}:00Z',
                            duration=random.randint(20, 360), location=f'Navapur Sector {i}'))
        for j in range(8):
            transactions.append(dict(caseId=case, **{'from': f'SYN-ACCOUNT-{100+i*10+j:03}', 'to': account},
                                     timestamp=f'2026-09-{i+1:02}T12:{j:02}:00Z', amount=1000+j*250))
    for i in range(3):
        transactions.append(dict(caseId='NXS-001', **{'from': 'SYN-ACCOUNT-001', 'to': 'SYN-ACCOUNT-900'},
                                 timestamp=f'2026-09-02T12:{10+i:02}:00Z', amount=3000))
    # Same pair co-located on two distinct windows, not just repeated rows.
    for day in (2, 3):
        for phone in ('SYN-PHONE-001', 'SYN-PHONE-020'):
            cdr.append(dict(caseId='NXS-001', **{'from': phone, 'to': 'SYN-PHONE-800'},
                            timestamp=f'2026-09-{day:02}T15:00:00Z', duration=60, location='Navapur Exchange'))
    payload = dict(fir=firs, cdr=cdr, transactions=transactions)
    (ROOT / 'dataset.json').write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    for kind, rows in payload.items():
        (ROOT / f'{kind}.json').write_text(json.dumps(rows, indent=2) + '\n', encoding='utf-8')
        if kind != 'fir':
            with (ROOT / f'{kind}.csv').open('w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
    truth = dict(sharedPhone='SYN-PHONE-001', sharedAccount='SYN-ACCOUNT-001',
                 linkedCases=['NXS-001', 'NXS-002', 'NXS-003'], publicPhone='SYN-PHONE-999',
                 distinctName='Rivan Kesh', variantNames=['Aariv Veylan', 'Aariv Veylen'],
                 expectedRules=['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], records=sum(map(len, payload.values())))
    (ROOT / 'ground_truth.json').write_text(json.dumps(truth, indent=2) + '\n', encoding='utf-8')
    # Independently specified labels, including negatives, punctuation and role variation.
    samples = [
        ('Accused Aariv Veylan; phone SYN-PHONE-001.', [('Person','Aariv Veylan'),('Phone','SYN-PHONE-001')]),
        ('Witness Mira Solven; account SYN-ACCOUNT-003.', [('Person','Mira Solven'),('Account','SYN-ACCOUNT-003')]),
        ('Complainant Dev Neral; vehicle ZZ00NX0001.', [('Person','Dev Neral'),('Vehicle','ZZ00NX0001')]),
        ('Seen at Navapur Exchange.', [('Location','Navapur Exchange')]),
        ('Veyra Services used SYN-ACCOUNT-900.', [('Organization','Veyra Services'),('Account','SYN-ACCOUNT-900')]),
        ('No identifiers were provided.', []),
        ('Phone 12345 is incomplete.', []),
        ('A date 2026-09-02 is not an account.', []),
        ('Co-accused Lio Marven; phone SYN-PHONE-020.', [('Person','Lio Marven'),('Phone','SYN-PHONE-020')]),
        ('Witness Aariv Veylen; location Navapur Sector 6.', [('Person','Aariv Veylen'),('Location','Navapur Sector 6')]),
        ('SYN-PHONE-001 called SYN-PHONE-999.', [('Phone','SYN-PHONE-001'),('Phone','SYN-PHONE-999')]),
        ('SYN-ACCOUNT-001 paid SYN-ACCOUNT-900.', [('Account','SYN-ACCOUNT-001'),('Account','SYN-ACCOUNT-900')]),
        ('Accused Rivan Kesh; phone SYN-PHONE-004.', [('Person','Rivan Kesh'),('Phone','SYN-PHONE-004')]),
        ('Accused Rivan Kesh; phone SYN-PHONE-005.', [('Person','Rivan Kesh'),('Phone','SYN-PHONE-005')]),
        ('Vehicle ZZ00NX0001 at Navapur Sector 5.', [('Vehicle','ZZ00NX0001'),('Location','Navapur Sector 5')]),
        ('Witness Isha Torven; Veyra Services.', [('Person','Isha Torven'),('Organization','Veyra Services')]),
        ('Amount INR 1,250.00 is alleged.', [('Amount','INR 1,250.00')]),
        ('UPI demo@synthetic.invalid is fictional.', [('Account','demo@synthetic.invalid')]),
    ]
    gold = []
    for i, (text, labels) in enumerate(samples):
        gold.append(dict(id=f'gold-{i:02}', text=text, entities=[dict(type=t, raw=s, start=text.index(s), end=text.index(s)+len(s)) for t,s in labels]))
    (ROOT / 'gold.json').write_text(json.dumps(gold, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {truth["records"]} records and {len(gold)} gold FIRs')


if __name__ == '__main__':
    generate()

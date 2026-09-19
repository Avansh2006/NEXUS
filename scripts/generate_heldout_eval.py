"""Generate heldout development and test evaluation datasets with realistic police variations."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEV_DIR = ROOT / 'data' / 'eval' / 'heldout_dev'
TEST_DIR = ROOT / 'data' / 'eval' / 'heldout_test'


def make_dev_firs():
    firs = []
    # 1. Delhi Police - standard format with phone & person
    t = "DELHI POLICE · PS CONNAUGHT PLACE · FIR 104/2026. Complainant Ramesh Gupta states that accused Vikram Malhotra contacted him via phone +91 98101 23456 demanding cash. Transferred from account 918273645102."
    firs.append({
        "id": "dev-001",
        "state": "Delhi Police",
        "noiseTypes": ["spaced_phone", "standard"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Ramesh Gupta", "start": t.index("Ramesh Gupta"), "end": t.index("Ramesh Gupta") + len("Ramesh Gupta")},
            {"type": "Person", "raw": "Vikram Malhotra", "start": t.index("Vikram Malhotra"), "end": t.index("Vikram Malhotra") + len("Vikram Malhotra")},
            {"type": "Phone", "raw": "+91 98101 23456", "start": t.index("+91 98101 23456"), "end": t.index("+91 98101 23456") + len("+91 98101 23456")},
            {"type": "Account", "raw": "918273645102", "start": t.index("918273645102"), "end": t.index("918273645102") + len("918273645102")}
        ]
    })

    # 2. Maharashtra Police - Hinglish cues & Devanagari numerals
    t = "MAHARASHTRA POLICE · PS BANDRA WEST · प्रथम खबरी अहवाल. Shikayatkarta Sunita Deshmukh registered complaint against aaropi Rajesh Varma. Aaropi used phone ९८२१०१२३४५ and vehicle MH-02-AB-1234 near Navapur Sector 1."
    firs.append({
        "id": "dev-002",
        "state": "Maharashtra Police",
        "noiseTypes": ["hinglish_cues", "devanagari_digits"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Sunita Deshmukh", "start": t.index("Sunita Deshmukh"), "end": t.index("Sunita Deshmukh") + len("Sunita Deshmukh")},
            {"type": "Person", "raw": "Rajesh Varma", "start": t.index("Rajesh Varma"), "end": t.index("Rajesh Varma") + len("Rajesh Varma")},
            {"type": "Phone", "raw": "९८२१०१२३४५", "start": t.index("९८२१०१२३४५"), "end": t.index("९८२१०१२३४५") + len("९८२१०१२३४५")},
            {"type": "Vehicle", "raw": "MH-02-AB-1234", "start": t.index("MH-02-AB-1234"), "end": t.index("MH-02-AB-1234") + len("MH-02-AB-1234")},
            {"type": "Location", "raw": "Navapur Sector 1", "start": t.index("Navapur Sector 1"), "end": t.index("Navapur Sector 1") + len("Navapur Sector 1")}
        ]
    })

    # 3. Karnataka Police - OCR confusion with 'O' for 0 in account
    t = "KARNATAKA STATE POLICE · PS INDIRANAGAR · FIR 402/2026. Accused Karthik Hegde instructed beneficiary deposit into account 4521O9823451 at Veyra Services branch."
    firs.append({
        "id": "dev-003",
        "state": "Karnataka Police",
        "noiseTypes": ["ocr_noise_letter_o"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Karthik Hegde", "start": t.index("Karthik Hegde"), "end": t.index("Karthik Hegde") + len("Karthik Hegde")},
            {"type": "Account", "raw": "4521O9823451", "start": t.index("4521O9823451"), "end": t.index("4521O9823451") + len("4521O9823451")},
            {"type": "Organization", "raw": "Veyra Services", "start": t.index("Veyra Services"), "end": t.index("Veyra Services") + len("Veyra Services")}
        ]
    })

    # 4. UP Police - Hinglish and multiple witnesses
    t = "UTTAR PRADESH POLICE · PS HAZRATGANJ LUCKNOW · Gawah Amit Srivastava observed accused Deepak Pandey fleeing in vehicle UP-32-CD-5678 after receiving call on 9415012345."
    firs.append({
        "id": "dev-004",
        "state": "UP Police",
        "noiseTypes": ["hinglish_cues", "standard_phone"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Amit Srivastava", "start": t.index("Amit Srivastava"), "end": t.index("Amit Srivastava") + len("Amit Srivastava")},
            {"type": "Person", "raw": "Deepak Pandey", "start": t.index("Deepak Pandey"), "end": t.index("Deepak Pandey") + len("Deepak Pandey")},
            {"type": "Vehicle", "raw": "UP-32-CD-5678", "start": t.index("UP-32-CD-5678"), "end": t.index("UP-32-CD-5678") + len("UP-32-CD-5678")},
            {"type": "Phone", "raw": "9415012345", "start": t.index("9415012345"), "end": t.index("9415012345") + len("9415012345")}
        ]
    })

    # 5. Delhi Police - Phone with OCR 'l' for 1
    t = "DELHI POLICE · PS KASHMERE GATE · Complainant Mohan Lal reports that accused Sanjay Singhania called from 98l0234567 demanding Rs. 50,000 extortion money."
    firs.append({
        "id": "dev-005",
        "state": "Delhi Police",
        "noiseTypes": ["ocr_noise_letter_l"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Mohan Lal", "start": t.index("Mohan Lal"), "end": t.index("Mohan Lal") + len("Mohan Lal")},
            {"type": "Person", "raw": "Sanjay Singhania", "start": t.index("Sanjay Singhania"), "end": t.index("Sanjay Singhania") + len("Sanjay Singhania")},
            {"type": "Phone", "raw": "98l0234567", "start": t.index("98l0234567"), "end": t.index("98l0234567") + len("98l0234567")},
            {"type": "Amount", "raw": "Rs. 50,000", "start": t.index("Rs. 50,000"), "end": t.index("Rs. 50,000") + len("Rs. 50,000")}
        ]
    })

    # 6. Maharashtra Police - Multi-hop phone and account
    t = "MAHARASHTRA POLICE · PS CYBER CRIME CELL PUNE. Accused Pradeep Kulkarni collected funds in account number 201928374651 and forwarded calls to SYN-PHONE-002."
    firs.append({
        "id": "dev-006",
        "state": "Maharashtra Police",
        "noiseTypes": ["synthetic_token", "account_label"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Pradeep Kulkarni", "start": t.index("Pradeep Kulkarni"), "end": t.index("Pradeep Kulkarni") + len("Pradeep Kulkarni")},
            {"type": "Account", "raw": "201928374651", "start": t.index("201928374651"), "end": t.index("201928374651") + len("201928374651")},
            {"type": "Phone", "raw": "SYN-PHONE-002", "start": t.index("SYN-PHONE-002"), "end": t.index("SYN-PHONE-002") + len("SYN-PHONE-002")}
        ]
    })

    # 7. Karnataka Police - Location and Organization
    t = "KARNATAKA POLICE · PS KORAMANGALA · Accused Vinay Bhat operated courier delivery from Navapur Exchange using vehicle KA-01-MJ-9912 registered under Veyra Services."
    firs.append({
        "id": "dev-007",
        "state": "Karnataka Police",
        "noiseTypes": ["standard_format"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Vinay Bhat", "start": t.index("Vinay Bhat"), "end": t.index("Vinay Bhat") + len("Vinay Bhat")},
            {"type": "Location", "raw": "Navapur Exchange", "start": t.index("Navapur Exchange"), "end": t.index("Navapur Exchange") + len("Navapur Exchange")},
            {"type": "Vehicle", "raw": "KA-01-MJ-9912", "start": t.index("KA-01-MJ-9912"), "end": t.index("KA-01-MJ-9912") + len("KA-01-MJ-9912")},
            {"type": "Organization", "raw": "Veyra Services", "start": t.index("Veyra Services"), "end": t.index("Veyra Services") + len("Veyra Services")}
        ]
    })

    # 8. UP Police - Devanagari khata sankhya
    t = "UP POLICE · PS NOIDA SECTOR 20 · Shikayatkarta Rahul Verma transferred INR 75000 to khata sankhya १०२९३८४७५६१२ of accused Nitin Tyagi."
    firs.append({
        "id": "dev-008",
        "state": "UP Police",
        "noiseTypes": ["devanagari_account", "hinglish_cues"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Rahul Verma", "start": t.index("Rahul Verma"), "end": t.index("Rahul Verma") + len("Rahul Verma")},
            {"type": "Amount", "raw": "INR 75000", "start": t.index("INR 75000"), "end": t.index("INR 75000") + len("INR 75000")},
            {"type": "Account", "raw": "१०२९३८४७५६१२", "start": t.index("१०२९३८४७५६१२"), "end": t.index("१०२९३८४७५६१२") + len("१०२९३८४७५६१२")},
            {"type": "Person", "raw": "Nitin Tyagi", "start": t.index("Nitin Tyagi"), "end": t.index("Nitin Tyagi") + len("Nitin Tyagi")}
        ]
    })

    # 9. Delhi Police - Irregular dashed phone format
    t = "DELHI POLICE · PS DWARKA NORTH · Witness Kavita Mehra confirmed co-accused Manoj Tiwari operated number 98-1111-2233 during the transaction."
    firs.append({
        "id": "dev-009",
        "state": "Delhi Police",
        "noiseTypes": ["irregular_phone_dashes"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Kavita Mehra", "start": t.index("Kavita Mehra"), "end": t.index("Kavita Mehra") + len("Kavita Mehra")},
            {"type": "Person", "raw": "Manoj Tiwari", "start": t.index("Manoj Tiwari"), "end": t.index("Manoj Tiwari") + len("Manoj Tiwari")},
            {"type": "Phone", "raw": "98-1111-2233", "start": t.index("98-1111-2233"), "end": t.index("98-1111-2233") + len("98-1111-2233")}
        ]
    })

    # 10. Maharashtra Police - Arrested suspect and location
    t = "MAHARASHTRA POLICE · PS THANE CRIME · Arrested Suresh Parab at Navapur Sector 4 with vehicle MH-04-XY-8821 and phone 9820543210."
    firs.append({
        "id": "dev-010",
        "state": "Maharashtra Police",
        "noiseTypes": ["standard_format"],
        "text": t,
        "entities": [
            {"type": "Person", "raw": "Suresh Parab", "start": t.index("Suresh Parab"), "end": t.index("Suresh Parab") + len("Suresh Parab")},
            {"type": "Location", "raw": "Navapur Sector 4", "start": t.index("Navapur Sector 4"), "end": t.index("Navapur Sector 4") + len("Navapur Sector 4")},
            {"type": "Vehicle", "raw": "MH-04-XY-8821", "start": t.index("MH-04-XY-8821"), "end": t.index("MH-04-XY-8821") + len("MH-04-XY-8821")},
            {"type": "Phone", "raw": "9820543210", "start": t.index("9820543210"), "end": t.index("9820543210") + len("9820543210")}
        ]
    })

    # Helper to build entity dicts safely
    def mk(t, typ, raw):
        idx = t.index(raw)
        return {"type": typ, "raw": raw, "start": idx, "end": idx + len(raw)}

    # 11-22 Dev FIRs
    t = "DELHI POLICE · PS HAUZ KHAS · Complainant Arvind Joshi was defrauded by accused Pankaj Bansal who gave account 301928475610."
    firs.append({
        "id": "dev-011", "state": "Delhi Police", "noiseTypes": ["standard"], "text": t,
        "entities": [mk(t, "Person", "Arvind Joshi"), mk(t, "Person", "Pankaj Bansal"), mk(t, "Account", "301928475610")]
    })
    t = "KARNATAKA POLICE · PS WHITEFIELD · Complainant Priya Raman sent payment to fastpay@okaxis managed by accused Harish Gowda."
    firs.append({
        "id": "dev-012", "state": "Karnataka Police", "noiseTypes": ["upi_id"], "text": t,
        "entities": [mk(t, "Person", "Priya Raman"), mk(t, "Account", "fastpay@okaxis"), mk(t, "Person", "Harish Gowda")]
    })
    t = "MAHARASHTRA POLICE · PS DADAR · Gawah Sachin Shinde identified aaropi Mahesh Patil escaping towards Navapur Sector 2."
    firs.append({
        "id": "dev-013", "state": "Maharashtra Police", "noiseTypes": ["hinglish_cues"], "text": t,
        "entities": [mk(t, "Person", "Sachin Shinde"), mk(t, "Person", "Mahesh Patil"), mk(t, "Location", "Navapur Sector 2")]
    })
    t = "UP POLICE · PS VARANASI CANTT · Shikayatkarta Alok Pandey reported harassment call from मोबाईल ७०११२२३३४४ by accused Rakesh Yadav."
    firs.append({
        "id": "dev-014", "state": "UP Police", "noiseTypes": ["devanagari_phone"], "text": t,
        "entities": [mk(t, "Person", "Alok Pandey"), mk(t, "Phone", "७०११२२३३४४"), mk(t, "Person", "Rakesh Yadav")]
    })
    t = "DELHI POLICE · PS ROHINI · Accused Tarun Kapoor requested wire transfer to account 502918273645 with IFSC SBIN0001234."
    firs.append({
        "id": "dev-015", "state": "Delhi Police", "noiseTypes": ["ifsc_account"], "text": t,
        "entities": [mk(t, "Person", "Tarun Kapoor"), mk(t, "Account", "502918273645"), mk(t, "IFSC", "SBIN0001234")]
    })
    t = "KARNATAKA POLICE · PS JAYANAGAR · Witness Deepa Rao noted getaway vehicle KA05NB4455 operated by accused Naveen Kumar."
    firs.append({
        "id": "dev-016", "state": "Karnataka Police", "noiseTypes": ["vehicle_unspaced"], "text": t,
        "entities": [mk(t, "Person", "Deepa Rao"), mk(t, "Vehicle", "KA05NB4455"), mk(t, "Person", "Naveen Kumar")]
    })
    t = "MAHARASHTRA POLICE · PS ANDHERI · Accused Nilesh Rane contacted victim using 9867012345 and directed money to SYN-ACCOUNT-005."
    firs.append({
        "id": "dev-017", "state": "Maharashtra Police", "noiseTypes": ["multiple_entities"], "text": t,
        "entities": [mk(t, "Person", "Nilesh Rane"), mk(t, "Phone", "9867012345"), mk(t, "Account", "SYN-ACCOUNT-005")]
    })
    t = "UP POLICE · PS AGRA SADAR · Naamzad Ravi Chaurasia collected Rs 120000 under extortion threat at Navapur Sector 3."
    firs.append({
        "id": "dev-018", "state": "UP Police", "noiseTypes": ["naamzad_accused"], "text": t,
        "entities": [mk(t, "Person", "Ravi Chaurasia"), mk(t, "Amount", "Rs 120000"), mk(t, "Location", "Navapur Sector 3")]
    })
    t = "DELHI POLICE · PS SAKET · Complainant Varun Nair spotted accused Gaurav Seth near Navapur Sector 5 driving DL 01 AB 9012."
    firs.append({
        "id": "dev-019", "state": "Delhi Police", "noiseTypes": ["ocr_broken_word"], "text": t,
        "entities": [mk(t, "Person", "Varun Nair"), mk(t, "Person", "Gaurav Seth"), mk(t, "Location", "Navapur Sector 5"), mk(t, "Vehicle", "DL 01 AB 9012")]
    })
    t = "KARNATAKA POLICE · PS ELECTRONIC CITY · Accused Chetan Murthy coordinated hawala dispatch via Veyra Services logistics hub."
    firs.append({
        "id": "dev-020", "state": "Karnataka Police", "noiseTypes": ["org_entity"], "text": t,
        "entities": [mk(t, "Person", "Chetan Murthy"), mk(t, "Organization", "Veyra Services")]
    })
    t = "MAHARASHTRA POLICE · PS KALYAN · Complainant Geeta Kadam reported suspicious calls from 98200-55443 by accused Bala Salvi."
    firs.append({
        "id": "dev-021", "state": "Maharashtra Police", "noiseTypes": ["phone_hyphenated"], "text": t,
        "entities": [mk(t, "Person", "Geeta Kadam"), mk(t, "Phone", "98200-55443"), mk(t, "Person", "Bala Salvi")]
    })
    t = "UP POLICE · PS GORAKHPUR KOTWALI · Gawah Ashok Mishra testified that co-accused Shivam Dubey parked UP-53-EF-1122 outside the bank."
    firs.append({
        "id": "dev-022", "state": "UP Police", "noiseTypes": ["mixed_cues"], "text": t,
        "entities": [mk(t, "Person", "Ashok Mishra"), mk(t, "Person", "Shivam Dubey"), mk(t, "Vehicle", "UP-53-EF-1122")]
    })
    return firs


def make_test_firs():
    firs = []
    def mk(t, typ, raw):
        idx = t.index(raw)
        return {"type": typ, "raw": raw, "start": idx, "end": idx + len(raw)}

    # 22 FROZEN Held-Out Test FIRs across Indian states with realistic noise
    t = "DELHI POLICE · PS CHANAKYAPURI · FIR 88/2026. Accused mohit sharma operated clandestine call center using phone +91 98710 54321."
    firs.append({
        "id": "test-001", "state": "Delhi Police", "noiseTypes": ["mixed_case_person"], "text": t,
        "entities": [mk(t, "Person", "mohit sharma"), mk(t, "Phone", "+91 98710 54321")]
    })
    t = "MAHARASHTRA POLICE · PS WORLI · प्रथम खबरी अहवाल. Shikayatkarta Meena Joshi paid INR 45000 to aaropi Sanjay Kulkarni via account ८९०१२३४५६७८९."
    firs.append({
        "id": "test-002", "state": "Maharashtra Police", "noiseTypes": ["devanagari_digits"], "text": t,
        "entities": [mk(t, "Person", "Meena Joshi"), mk(t, "Amount", "INR 45000"), mk(t, "Person", "Sanjay Kulkarni"), mk(t, "Account", "८९०१२३४५६७८९")]
    })
    t = "KARNATAKA POLICE · PS MALLESHWARAM · Accused Rohan Deshpande instructed victim to transfer cash to account 7182O3948512 at Navapur Exchange."
    firs.append({
        "id": "test-003", "state": "Karnataka Police", "noiseTypes": ["ocr_noise_letter_o"], "text": t,
        "entities": [mk(t, "Person", "Rohan Deshpande"), mk(t, "Account", "7182O3948512"), mk(t, "Location", "Navapur Exchange")]
    })
    t = "UP POLICE · PS ALAMBAGH LUCKNOW · Gawah Rohit Soni overheard accused Anil Tiwari negotiating ransom on phone ८१२३४५६७८९."
    firs.append({
        "id": "test-004", "state": "UP Police", "noiseTypes": ["devanagari_phone"], "text": t,
        "entities": [mk(t, "Person", "Rohit Soni"), mk(t, "Person", "Anil Tiwari"), mk(t, "Phone", "८१२३४५६७८९")]
    })
    t = "DELHI POLICE · PS LAJPAT NAGAR · Complainant Neha Gupta stated accused Ajay Verma called repeatedly from 98l9012345 demanding extortion."
    firs.append({
        "id": "test-005", "state": "Delhi Police", "noiseTypes": ["ocr_noise_letter_l"], "text": t,
        "entities": [mk(t, "Person", "Neha Gupta"), mk(t, "Person", "Ajay Verma"), mk(t, "Phone", "98l9012345")]
    })
    t = "MAHARASHTRA POLICE · PS COLABA · Arrested accused Vijay More with fake identity card at Navapur Sector 6."
    firs.append({
        "id": "test-006", "state": "Maharashtra Police", "noiseTypes": ["standard"], "text": t,
        "entities": [mk(t, "Person", "Vijay More"), mk(t, "Location", "Navapur Sector 6")]
    })
    t = "KARNATAKA POLICE · PS DOOMLUR · Accused Kiran Nayak used transport vehicle KA-03-HA-8899 contracted by Veyra Services."
    firs.append({
        "id": "test-007", "state": "Karnataka Police", "noiseTypes": ["org_vehicle"], "text": t,
        "entities": [mk(t, "Person", "Kiran Nayak"), mk(t, "Vehicle", "KA-03-HA-8899"), mk(t, "Organization", "Veyra Services")]
    })
    t = "UP POLICE · PS KANPUR KOTWALI · Shikayatkarta Manoj Shukla deposited Rs. 90,000 into khata 601928374829 for accused Brijesh Yadav."
    firs.append({
        "id": "test-008", "state": "UP Police", "noiseTypes": ["hinglish_khata"], "text": t,
        "entities": [mk(t, "Person", "Manoj Shukla"), mk(t, "Amount", "Rs. 90,000"), mk(t, "Account", "601928374829"), mk(t, "Person", "Brijesh Yadav")]
    })
    t = "DELHI POLICE · PS KAROL BAGH · Complainant Suraj Mal informed that accused Vicky Oberoi rang from (011) 2574 8899 threatening bodily harm."
    firs.append({
        "id": "test-009", "state": "Delhi Police", "noiseTypes": ["parentheses_phone"], "text": t,
        "entities": [mk(t, "Person", "Suraj Mal"), mk(t, "Person", "Vicky Oberoi"), mk(t, "Phone", "(011) 2574 8899")]
    })
    t = "MAHARASHTRA POLICE · PS CHEMBUR · Witness Pooja Shinde saw accused Dilip Sawant in vehicle MH03BQ7711 near Navapur Sector 7."
    firs.append({
        "id": "test-010", "state": "Maharashtra Police", "noiseTypes": ["vehicle_unspaced"], "text": t,
        "entities": [mk(t, "Person", "Pooja Shinde"), mk(t, "Person", "Dilip Sawant"), mk(t, "Vehicle", "MH03BQ7711"), mk(t, "Location", "Navapur Sector 7")]
    })
    t = "KARNATAKA POLICE · PS MARATHAHALLI · Complainant Sandeep Rao wired funds to account 802918374619 controlled by accused Prakash Hegde."
    firs.append({
        "id": "test-011", "state": "Karnataka Police", "noiseTypes": ["standard"], "text": t,
        "entities": [mk(t, "Person", "Sandeep Rao"), mk(t, "Account", "802918374619"), mk(t, "Person", "Prakash Hegde")]
    })
    t = "DELHI POLICE · PS PASCHIM VIHAR · Accused Rakesh Chopra demanded digital payment at chopra.secure@icici from complainant Lalit Batra."
    firs.append({
        "id": "test-012", "state": "Delhi Police", "noiseTypes": ["upi_id"], "text": t,
        "entities": [mk(t, "Person", "Rakesh Chopra"), mk(t, "Account", "chopra.secure@icici"), mk(t, "Person", "Lalit Batra")]
    })
    t = "UP POLICE · PS MEERUT SADAR · Naamzad Monu Tyagi fled scene in vehicle UP-15-GH-3344 after taking Rs. 35,000."
    firs.append({
        "id": "test-013", "state": "UP Police", "noiseTypes": ["naamzad_hinglish"], "text": t,
        "entities": [mk(t, "Person", "Monu Tyagi"), mk(t, "Vehicle", "UP-15-GH-3344"), mk(t, "Amount", "Rs. 35,000")]
    })
    t = "MAHARASHTRA POLICE · PS BORIVALI · Shikayatkarta Deepali Mane transferred money into khata ९०१९२८३७४६५१ of accused Santosh Salunkhe."
    firs.append({
        "id": "test-014", "state": "Maharashtra Police", "noiseTypes": ["devanagari_account"], "text": t,
        "entities": [mk(t, "Person", "Deepali Mane"), mk(t, "Account", "९०१९२८३७४६५१"), mk(t, "Person", "Santosh Salunkhe")]
    })
    t = "KARNATAKA POLICE · PS HSR LAYOUT · Accused Girish Bhat transferred illicit cut to SYN-ACCOUNT-006 at Navapur Sector 8."
    firs.append({
        "id": "test-015", "state": "Karnataka Police", "noiseTypes": ["synthetic_account"], "text": t,
        "entities": [mk(t, "Person", "Girish Bhat"), mk(t, "Account", "SYN-ACCOUNT-006"), mk(t, "Location", "Navapur Sector 8")]
    })
    t = "DELHI POLICE · PS GREATER KAILASH · Witness Tanvi Suri reported that accused Gaurav Bajaj called from 98110 99887 demanding extortion."
    firs.append({
        "id": "test-016", "state": "Delhi Police", "noiseTypes": ["phone_spaced"], "text": t,
        "entities": [mk(t, "Person", "Tanvi Suri"), mk(t, "Person", "Gaurav Bajaj"), mk(t, "Phone", "98110 99887")]
    })
    t = "UP POLICE · PS ALLAHABAD CIVIL LINES · Accused Shailendra Singh deposited extortion amount in account 401928374652."
    firs.append({
        "id": "test-017", "state": "UP Police", "noiseTypes": ["standard"], "text": t,
        "entities": [mk(t, "Person", "Shailendra Singh"), mk(t, "Account", "401928374652")]
    })
    t = "MAHARASHTRA POLICE · PS KURLA · Gawah Nitin Jadhav stated co-accused Bablu Khan drove vehicle MH-01-ZA-5566 near Navapur Sector 9."
    firs.append({
        "id": "test-018", "state": "Maharashtra Police", "noiseTypes": ["hinglish_gawah"], "text": t,
        "entities": [mk(t, "Person", "Nitin Jadhav"), mk(t, "Person", "Bablu Khan"), mk(t, "Vehicle", "MH-01-ZA-5566"), mk(t, "Location", "Navapur Sector 9")]
    })
    t = "KARNATAKA POLICE · PS RAJAJINAGAR · Accused Anand Murthy requested wire to account 501928374610 with IFSC HDFC0001234."
    firs.append({
        "id": "test-019", "state": "Karnataka Police", "noiseTypes": ["ifsc_account"], "text": t,
        "entities": [mk(t, "Person", "Anand Murthy"), mk(t, "Account", "501928374610"), mk(t, "IFSC", "HDFC0001234")]
    })
    t = "DELHI POLICE · PS PATEL NAGAR · Complainant Raman Nanda stated that accusedAlok Gupta escaped on vehicle DL-04-CD-9012."
    firs.append({
        "id": "test-020", "state": "Delhi Police", "noiseTypes": ["ocr_broken_word"], "text": t,
        "entities": [mk(t, "Person", "Raman Nanda"), mk(t, "Person", "Alok Gupta"), mk(t, "Vehicle", "DL-04-CD-9012")]
    })
    t = "MAHARASHTRA POLICE · PS MALAD · Accused Hemant Desai received instructions on 9820123456 and called 9820987654."
    firs.append({
        "id": "test-021", "state": "Maharashtra Police", "noiseTypes": ["multiple_phones"], "text": t,
        "entities": [mk(t, "Person", "Hemant Desai"), mk(t, "Phone", "9820123456"), mk(t, "Phone", "9820987654")]
    })
    t = "UP POLICE · PS JHANSI KOTWALI · Accused Ramakant Shukla contacted Veyra Services branch office using phone 9450012345."
    firs.append({
        "id": "test-022", "state": "UP Police", "noiseTypes": ["org_phone"], "text": t,
        "entities": [mk(t, "Person", "Ramakant Shukla"), mk(t, "Organization", "Veyra Services"), mk(t, "Phone", "9450012345")]
    })
    return firs


def main():
    DEV_DIR.mkdir(parents=True, exist_ok=True)
    TEST_DIR.mkdir(parents=True, exist_ok=True)

    dev_firs = make_dev_firs()
    test_firs = make_test_firs()

    for item in dev_firs:
        # Validate span slices in ground truth
        for ent in item['entities']:
            actual = item['text'][ent['start']:ent['end']]
            assert actual == ent['raw'], f"Mismatch in {item['id']}: expected {ent['raw']!r} got {actual!r}"
        (DEV_DIR / f"{item['id']}.json").write_text(json.dumps(item, indent=2, ensure_ascii=False), encoding='utf-8')

    for item in test_firs:
        # Validate span slices in ground truth
        for ent in item['entities']:
            actual = item['text'][ent['start']:ent['end']]
            assert actual == ent['raw'], f"Mismatch in {item['id']}: expected {ent['raw']!r} got {actual!r}"
        (TEST_DIR / f"{item['id']}.json").write_text(json.dumps(item, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f"Generated {len(dev_firs)} dev FIRs in {DEV_DIR}")
    print(f"Generated {len(test_firs)} test FIRs in {TEST_DIR}")


if __name__ == '__main__':
    main()

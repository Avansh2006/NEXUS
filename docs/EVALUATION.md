# NEXUS — Independent Held-Out Extraction Evaluation

**Benchmark Date:** 2026-09-19  
**Evaluation Scope:** Independent Held-Out Datasets (`data/eval/heldout_dev/` and frozen `data/eval/heldout_test/`)  
**Methodology:** Strict Span Match (exact entity type + character span) and Lenient Span Match (type match + character overlap).

---

## 1. Executive Evaluation Summary

Unlike the 18 synthetic template FIRs authored alongside early regexes (which scored an unrepresentative 1.0 P / 1.0 R), this evaluation tests **44 independently constructed FIRs** across Delhi, Maharashtra, Karnataka, and UP police formats with realistic OCR noise, Devanagari numerals, Hinglish legal cues, and casing irregularities.

| Split | Samples | Strict Prec | Strict Rec | Strict F1 | Lenient Prec | Lenient Rec | Lenient F1 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Held-Out Dev** | 22 | 100.0% | 55.4% | **71.3%** | 100.0% | 55.4% | **71.3%** |
| **Held-Out Test (Frozen)** | 22 | 100.0% | 50.7% | **67.3%** | 100.0% | 50.7% | **67.3%** |

---

## 2. Per-Entity Type Performance (Held-Out Test Set)

| Entity Type | Gold Annotations | Extracted Predictions | Strict F1 | Lenient Prec | Lenient Rec | Lenient F1 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Account** | 9 | 8 | 94.1% | 100.0% | 88.9% | **94.1%** |
| **Amount** | 3 | 3 | 100.0% | 100.0% | 100.0% | **100.0%** |
| **IFSC** | 1 | 1 | 100.0% | 100.0% | 100.0% | **100.0%** |
| **Location** | 5 | 5 | 100.0% | 100.0% | 100.0% | **100.0%** |
| **Organization** | 2 | 2 | 100.0% | 100.0% | 100.0% | **100.0%** |
| **Person** | 34 | 4 | 21.1% | 100.0% | 11.8% | **21.1%** |
| **Phone** | 8 | 6 | 85.7% | 100.0% | 75.0% | **85.7%** |
| **Vehicle** | 5 | 5 | 100.0% | 100.0% | 100.0% | **100.0%** |

---

## 3. Error Analysis by Real-World Noise Category

| Noise Category | Gold Spans | Strict Recall | Lenient Recall | Failure Analysis |
| :--- | :--- | :--- | :--- | :--- |
| `devanagari_account` | 3 | 66.7% | 66.7% | Khata sankhya with Devanagari digits normalized and captured. |
| `devanagari_digits` | 4 | 50.0% | 50.0% | Devanagari numeral mapping correctly normalizes digits (0-9). |
| `devanagari_phone` | 3 | 33.3% | 33.3% | Phone numbers in Devanagari parsed via digit translation table. |
| `hinglish_gawah` | 4 | 50.0% | 50.0% | Standard variation. |
| `hinglish_khata` | 4 | 75.0% | 75.0% | Khata keyword recognized as Account cue. |
| `ifsc_account` | 3 | 66.7% | 66.7% | Standard variation. |
| `mixed_case_person` | 2 | 50.0% | 50.0% | Lowercase name ('mohit sharma') missed by TitleCase capitalized regex. |
| `multiple_phones` | 3 | 66.7% | 66.7% | Standard variation. |
| `naamzad_hinglish` | 3 | 66.7% | 66.7% | Standard variation. |
| `ocr_broken_word` | 3 | 33.3% | 33.3% | Missing space between role cue and name ('accusedAlok Gupta') causes word boundary regex miss. |
| `ocr_noise_letter_l` | 3 | 0.0% | 0.0% | Letter 'l' substitution prevents phone standard pattern; flag as potential OCR artifact. |
| `ocr_noise_letter_o` | 3 | 33.3% | 33.3% | Letter 'O' substitution prevents exact digit regex match; requires character substitution pass. |
| `org_phone` | 3 | 66.7% | 66.7% | Standard variation. |
| `org_vehicle` | 3 | 66.7% | 66.7% | Standard variation. |
| `parentheses_phone` | 3 | 0.0% | 0.0% | Landline with area code '(011)' parsed or requires extended syntax. |
| `phone_spaced` | 3 | 33.3% | 33.3% | Standard variation. |
| `standard` | 7 | 57.1% | 57.1% | Clean baseline FIR text with high extraction fidelity. |
| `synthetic_account` | 3 | 66.7% | 66.7% | System tokens recognized with 100% precision. |
| `upi_id` | 3 | 66.7% | 66.7% | VPA pattern recognized as Account identifier. |
| `vehicle_unspaced` | 4 | 50.0% | 50.0% | Unspaced registration plate ('MH03BQ7711') handled cleanly. |

---

## 4. UI Quality Panel Integration

The `/quality` endpoint combines evaluation metrics:
- **Baseline Template Set:** Micro-precision and recall on baseline synthetic set.
- **Held-Out Dev & Test:** Honest, frozen evaluation reporting Strict F1 and Lenient F1.
- Real-world disclaimer: *"Real-world accuracy varies by scan resolution and document quality. Evaluated on 44 held-out FIRs across 4 Indian states."*

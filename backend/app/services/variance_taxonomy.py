from __future__ import annotations

from dataclasses import dataclass

from app.models.enums import Severity, VarianceStatus


@dataclass(frozen=True)
class VarianceDefinition:
    code: str
    title: str
    severity: Severity
    default_action: str
    allowed_resolution_statuses: tuple[VarianceStatus, ...]


COMMON_ALLOWED_RESOLUTIONS = (
    VarianceStatus.MATCHED,
    VarianceStatus.EXPLAINED,
    VarianceStatus.EXPECTED_LATER,
    VarianceStatus.IGNORED,
)

VARIANCE_DEFINITIONS: dict[str, VarianceDefinition] = {
    # Run integrity and scope
    "RUN-001": VarianceDefinition("RUN-001", "Missing/ambiguous pay date", Severity.BLOCKER, "Require pay date/pay period confirmation and rerun.", COMMON_ALLOWED_RESOLUTIONS),
    "RUN-002": VarianceDefinition("RUN-002", "Pay period overlap / duplicate run identifier", Severity.WARNING, "Mark as possible duplicate run and require reviewer decision.", COMMON_ALLOWED_RESOLUTIONS),
    "RUN-003": VarianceDefinition("RUN-003", "Source coverage mismatch", Severity.BLOCKER, "Request missing dataset or enforce configured run type.", COMMON_ALLOWED_RESOLUTIONS),
    "RUN-004": VarianceDefinition("RUN-004", "Multi-currency detected within run", Severity.BLOCKER, "Require explicit FX mode/policy or reject import.", COMMON_ALLOWED_RESOLUTIONS),

    # Payroll expected vs bank actual
    "BNK-001": VarianceDefinition("BNK-001", "Missing net pay withdrawal(s)", Severity.BLOCKER, "Show missing cash list and candidate matches outside window.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-002": VarianceDefinition("BNK-002", "Net pay amount mismatch (single withdrawal)", Severity.BLOCKER, "Show delta and suggest split-match candidates.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-003": VarianceDefinition("BNK-003", "Split withdrawals sum to net pay (one-to-many)", Severity.WARNING, "Suggest match group and require explicit confirmation.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-004": VarianceDefinition("BNK-004", "Partial payment", Severity.BLOCKER, "Show remaining expected value and suggest additional withdrawals.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-005": VarianceDefinition("BNK-005", "Overpayment", Severity.BLOCKER, "Flag overpayment and require explanation or correction.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-006": VarianceDefinition("BNK-006", "Withdrawal outside date window", Severity.WARNING, "Allow per-run window override with audit logging.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-007": VarianceDefinition("BNK-007", "Paid from unexpected bank account", Severity.WARNING, "Associate account or flag exception.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-008": VarianceDefinition("BNK-008", "Reversal/returned payroll payment detected", Severity.BLOCKER, "Create payment incident and require correction plan.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-009": VarianceDefinition("BNK-009", "Bank fees mixed into payroll payment", Severity.WARNING, "Classify fee separately and exclude from net pay matching.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-010": VarianceDefinition("BNK-010", "Unidentified payroll-related withdrawals", Severity.WARNING, "Route to unallocated payroll cash queue.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-011": VarianceDefinition("BNK-011", "Duplicate withdrawals", Severity.BLOCKER, "Require manual allocation/explanation.", COMMON_ALLOWED_RESOLUTIONS),
    "BNK-012": VarianceDefinition("BNK-012", "Staged payroll payments", Severity.WARNING, "Create staged payment policy with reviewer approval.", COMMON_ALLOWED_RESOLUTIONS),

    # Payroll expected vs GL posted
    "GL-001": VarianceDefinition("GL-001", "Missing payroll journal in GL", Severity.BLOCKER, "Request GL export including journal or mark not posted yet.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-002": VarianceDefinition("GL-002", "Unbalanced GL journal", Severity.BLOCKER, "Block close until corrected journal export is provided.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-003": VarianceDefinition("GL-003", "Journal totals mismatch vs payroll expected", Severity.BLOCKER, "Show mismatched bucket and require adjustment.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-004": VarianceDefinition("GL-004", "Net pay control posting mismatch", Severity.BLOCKER, "Show sign/amount delta and require correction.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-005": VarianceDefinition("GL-005", "Tax authority liability mismatch", Severity.BLOCKER, "Require mapping review or payroll export correction.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-006": VarianceDefinition("GL-006", "Employer contributions mismatch", Severity.WARNING, "Highlight line mismatch and require classification.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-007": VarianceDefinition("GL-007", "Pension liability mismatch", Severity.WARNING, "Allow expected-later if paid separately, else reconcile.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-008": VarianceDefinition("GL-008", "Other deductions mismatch", Severity.WARNING, "Bucket as other deductions and require explanation beyond threshold.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-009": VarianceDefinition("GL-009", "Posting to suspense/clearing accounts detected", Severity.WARNING, "Require account mapping or correction.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-010": VarianceDefinition("GL-010", "Duplicate payroll journal", Severity.BLOCKER, "Require reversal evidence or void confirmation.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-011": VarianceDefinition("GL-011", "Reversal journal detected", Severity.WARNING, "Link reversal to original and require reviewer note.", COMMON_ALLOWED_RESOLUTIONS),
    "GL-012": VarianceDefinition("GL-012", "Journal posted to wrong period", Severity.WARNING, "Allow close with note if policy allows, else require correction.", COMMON_ALLOWED_RESOLUTIONS),

    # Bank vs GL consistency
    "X-001": VarianceDefinition("X-001", "Bank outflow exists but GL cash/clearing entry missing", Severity.WARNING, "Prompt cashbook posting validation.", COMMON_ALLOWED_RESOLUTIONS),
    "X-002": VarianceDefinition("X-002", "GL cash/clearing movement exists but bank withdrawal missing", Severity.BLOCKER, "Confirm execution status and request correct bank export.", COMMON_ALLOWED_RESOLUTIONS),
    "X-003": VarianceDefinition("X-003", "Bank amount ties payroll but GL does not", Severity.BLOCKER, "Direct reviewer to accounting posting correction.", COMMON_ALLOWED_RESOLUTIONS),
    "X-004": VarianceDefinition("X-004", "Single bank withdrawal covers multiple payroll runs", Severity.WARNING, "Allocate across runs and save policy if recurrent.", COMMON_ALLOWED_RESOLUTIONS),

    # Timing and expected-later logic
    "TIME-001": VarianceDefinition("TIME-001", "Liability payment expected later", Severity.INFO, "Auto-classify expected later and include due date.", COMMON_ALLOWED_RESOLUTIONS),
    "TIME-002": VarianceDefinition("TIME-002", "Liability payment overdue", Severity.WARNING, "Raise overdue liability with escalation.", COMMON_ALLOWED_RESOLUTIONS),
    "TIME-003": VarianceDefinition("TIME-003", "Off-cycle run detected", Severity.WARNING, "Tag off-cycle and segregate in reporting.", COMMON_ALLOWED_RESOLUTIONS),
    "TIME-004": VarianceDefinition("TIME-004", "Prior-period adjustment detected", Severity.WARNING, "Require reviewer note and supporting evidence.", COMMON_ALLOWED_RESOLUTIONS),

    # Currency, sign, rounding
    "CUR-001": VarianceDefinition("CUR-001", "Currency mismatch across sources", Severity.BLOCKER, "Require explicit conversion policy or reject.", COMMON_ALLOWED_RESOLUTIONS),
    "CUR-002": VarianceDefinition("CUR-002", "FX conversion variance", Severity.WARNING, "Show FX delta and require policy handling.", COMMON_ALLOWED_RESOLUTIONS),
    "SIGN-001": VarianceDefinition("SIGN-001", "Sign inversion / debit-credit swap", Severity.BLOCKER, "Fix transformation mapping and rerun.", COMMON_ALLOWED_RESOLUTIONS),
    "ROUND-001": VarianceDefinition("ROUND-001", "Rounding delta exceeds tolerance", Severity.WARNING, "Show rounding source and require mapping/payroll adjustment.", COMMON_ALLOWED_RESOLUTIONS),
}


def get_definition(code: str) -> VarianceDefinition:
    definition = VARIANCE_DEFINITIONS.get(code)
    if definition is None:
        raise KeyError(f"Unknown variance code: {code}")
    return definition

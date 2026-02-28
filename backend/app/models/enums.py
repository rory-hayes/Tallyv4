from __future__ import annotations

from enum import Enum


class FirmRole(str, Enum):
    ADMIN = "Admin"
    PREPARER = "Preparer"
    REVIEWER = "Reviewer"


class SourceFileType(str, Enum):
    BANK = "Bank"
    GL = "GL"
    PAYROLL = "Payroll"


class RunStatus(str, Enum):
    TIED = "Tied"
    NOT_TIED = "NotTied"
    NEEDS_REVIEW = "NeedsReview"


class Severity(str, Enum):
    BLOCKER = "BLOCKER"
    WARNING = "WARNING"
    INFO = "INFO"


class VarianceStatus(str, Enum):
    OPEN = "Open"
    MATCHED = "Matched"
    EXPLAINED = "Explained"
    EXPECTED_LATER = "ExpectedLater"
    IGNORED = "Ignored"
    APPROVED = "Approved"
    CLOSED = "Closed"


class ApprovalStatus(str, Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class MappingScope(str, Enum):
    CLIENT = "Client"
    FIRM = "Firm"


class SchemaType(str, Enum):
    BANK_TRANSACTIONS = "BankTransactions"
    GL_JOURNAL_LINES = "GLJournalLines"
    PAYROLL_EXPECTED = "PayrollExpected"


class CountryPack(str, Enum):
    UK = "UK"
    IE = "IE"

from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from dateutil import parser as date_parser
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import BankTransaction, JournalLine, MappingTemplate, PayrollSummary, SourceFile
from app.models.enums import MappingScope, SchemaType, SourceFileType
from app.services.file_parsers import ParsedFile, parse_container
from app.services.storage import storage_service

SCHEMA_REQUIRED_FIELDS: dict[SchemaType, tuple[str, ...]] = {
    SchemaType.BANK_TRANSACTIONS: ("posting_date", "amount", "description"),
    SchemaType.GL_JOURNAL_LINES: ("journal_date", "account_code", "debit", "credit"),
    SchemaType.PAYROLL_EXPECTED: ("pay_date", "net_pay_total", "gross_total"),
}

SCHEMA_SYNONYMS: dict[SchemaType, dict[str, tuple[str, ...]]] = {
    SchemaType.BANK_TRANSACTIONS: {
        "posting_date": ("date", "posting date", "transaction date", "dtposted"),
        "amount": ("amount", "value", "trnamt", "money out", "money in"),
        "description": ("description", "memo", "payee", "name"),
        "reference": ("reference", "ref", "fitid", "id"),
        "currency": ("currency", "ccy"),
        "account_id": ("account", "account id", "sort code"),
    },
    SchemaType.GL_JOURNAL_LINES: {
        "journal_date": ("date", "journal date", "posting date"),
        "account_code": ("account", "account code", "nominal", "ledger"),
        "debit": ("debit", "dr"),
        "credit": ("credit", "cr"),
        "journal_id": ("journal", "journal id", "entry id"),
        "memo": ("memo", "description", "narrative"),
    },
    SchemaType.PAYROLL_EXPECTED: {
        "pay_date": ("pay date", "payment date", "date"),
        "gross_total": ("gross", "gross total", "gross pay"),
        "net_pay_total": ("net", "net pay", "net total"),
        "employer_taxes": ("employer tax", "employer ni", "prsi employer"),
        "employee_taxes": ("employee tax", "paye", "employee ni", "prsi employee", "usc"),
        "pension": ("pension", "retirement"),
        "fees": ("fees", "processing fee"),
    },
}

SOURCE_TO_SCHEMA = {
    SourceFileType.BANK: SchemaType.BANK_TRANSACTIONS,
    SourceFileType.GL: SchemaType.GL_JOURNAL_LINES,
    SourceFileType.PAYROLL: SchemaType.PAYROLL_EXPECTED,
}


class ImportValidationError(Exception):
    pass


def _normalize_header(header: str) -> str:
    return header.strip().lower()


def _parse_date(value: Any, *, date_format: str | None = None) -> date:
    if value is None:
        raise ValueError("missing date")
    text = str(value).strip()
    if not text:
        raise ValueError("missing date")
    if date_format:
        from datetime import datetime

        return datetime.strptime(text, date_format).date()
    return date_parser.parse(text, dayfirst=True).date()


def _parse_decimal(
    value: Any,
    *,
    decimal_separator: str = ".",
    thousands_separator: str = ",",
) -> Decimal:
    if value is None:
        raise ValueError("missing amount")

    text = str(value).strip()
    if not text:
        raise ValueError("missing amount")

    text = (
        text.replace("GBP", "")
        .replace("EUR", "")
        .replace("£", "")
        .replace("€", "")
        .replace(" ", "")
        .replace("\u00a0", "")
    )

    if thousands_separator:
        text = text.replace(thousands_separator, "")
    if decimal_separator != ".":
        text = text.replace(decimal_separator, ".")

    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"invalid amount: {value}") from exc


def _lookup_column(headers: list[str], candidates: tuple[str, ...]) -> tuple[str | None, float]:
    normalized = {header: _normalize_header(header) for header in headers}
    candidate_set = {_normalize_header(candidate) for candidate in candidates}

    for header, normalized_header in normalized.items():
        if normalized_header in candidate_set:
            return header, 0.98

    for header, normalized_header in normalized.items():
        if any(candidate in normalized_header for candidate in candidate_set):
            return header, 0.92

    return None, 0.0


def detect_schema(parsed: ParsedFile, source_type: SourceFileType | None = None) -> tuple[SchemaType | None, float, list[str]]:
    headers = parsed.headers
    if not headers:
        return None, 0.0, ["No headers found"]

    if source_type and source_type in SOURCE_TO_SCHEMA:
        schema = SOURCE_TO_SCHEMA[source_type]
        scores = []
        reasons: list[str] = []
        for field, candidates in SCHEMA_SYNONYMS[schema].items():
            column, confidence = _lookup_column(headers, candidates)
            if column:
                reasons.append(f"Detected {field} from '{column}'")
            scores.append(confidence)
        return schema, round(sum(scores) / max(len(scores), 1), 4), reasons

    schema_scores: dict[SchemaType, float] = {}
    schema_reasons: dict[SchemaType, list[str]] = defaultdict(list)

    for schema, synonyms in SCHEMA_SYNONYMS.items():
        scores: list[float] = []
        for field, candidates in synonyms.items():
            column, confidence = _lookup_column(headers, candidates)
            if column:
                schema_reasons[schema].append(f"{field} matched with '{column}'")
            scores.append(confidence)
        schema_scores[schema] = sum(scores) / max(len(scores), 1)

    best_schema = max(schema_scores, key=schema_scores.get)
    best_score = round(schema_scores[best_schema], 4)

    if best_score < 0.35:
        return None, best_score, ["Could not confidently infer schema"]

    return best_schema, best_score, schema_reasons[best_schema]


def suggest_mapping(parsed: ParsedFile, schema_type: SchemaType) -> tuple[dict[str, Any], float, dict[str, bool]]:
    headers = parsed.headers
    mapping: dict[str, Any] = {}
    confidences: list[float] = []
    required_fields = SCHEMA_REQUIRED_FIELDS[schema_type]
    required_status: dict[str, bool] = {}

    for field, candidates in SCHEMA_SYNONYMS[schema_type].items():
        column, confidence = _lookup_column(headers, candidates)
        if column is not None:
            mapping[field] = column
        confidences.append(confidence)
        if field in required_fields:
            required_status[field] = column is not None

    # Support bank files with separate money in/out columns.
    if schema_type == SchemaType.BANK_TRANSACTIONS and "amount" not in mapping:
        money_in, _ = _lookup_column(headers, ("money in", "credit", "deposit"))
        money_out, _ = _lookup_column(headers, ("money out", "debit", "withdrawal"))
        if money_in and money_out:
            mapping["amount"] = {"in": money_in, "out": money_out, "mode": "in_minus_out"}
            required_status["amount"] = True
            confidences.append(0.94)

    confidence = round(sum(confidences) / max(len(confidences), 1), 4)
    return mapping, confidence, required_status


def _extract_value(mapping: Any, row: dict[str, Any], *, transforms: dict[str, Any]) -> Any:
    if isinstance(mapping, dict) and mapping.get("mode") == "in_minus_out":
        in_val = _parse_decimal(
            row.get(mapping["in"], "0"),
            decimal_separator=transforms.get("decimal_separator", "."),
            thousands_separator=transforms.get("thousands_separator", ","),
        )
        out_val = _parse_decimal(
            row.get(mapping["out"], "0"),
            decimal_separator=transforms.get("decimal_separator", "."),
            thousands_separator=transforms.get("thousands_separator", ","),
        )
        return in_val - out_val

    if isinstance(mapping, str):
        return row.get(mapping)

    return None


def header_fingerprint(headers: list[str]) -> str:
    normalized = "|".join(_normalize_header(header) for header in headers)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def validate_and_persist_source(db: Session, source_file: SourceFile) -> dict[str, Any]:
    if source_file.schema_type is None or source_file.mapping_json is None:
        raise ImportValidationError("Schema and mapping must be configured before validation.")

    content = storage_service.read_bytes(source_file.storage_key)
    parsed = parse_container(content, source_file.container_type)
    mapping = source_file.mapping_json
    transforms = source_file.transformations_json or {}

    rows = parsed.rows
    failures = 0
    normalized_rows: list[dict[str, Any]] = []

    for idx, row in enumerate(rows, start=1):
        try:
            if source_file.schema_type == SchemaType.BANK_TRANSACTIONS:
                posting_date = _parse_date(_extract_value(mapping.get("posting_date"), row, transforms=transforms), date_format=transforms.get("date_format"))
                amount_raw = _extract_value(mapping.get("amount"), row, transforms=transforms)
                amount = amount_raw if isinstance(amount_raw, Decimal) else _parse_decimal(amount_raw, decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ","))
                description = str(_extract_value(mapping.get("description"), row, transforms=transforms) or "").strip()
                if not description:
                    raise ValueError("missing description")
                normalized_rows.append(
                    {
                        "posting_date": posting_date,
                        "amount": amount,
                        "description": description,
                        "reference": _extract_value(mapping.get("reference"), row, transforms=transforms),
                        "currency": _extract_value(mapping.get("currency"), row, transforms=transforms),
                        "account_id": _extract_value(mapping.get("account_id"), row, transforms=transforms),
                        "row_index": idx,
                        "raw_payload": row,
                    }
                )
            elif source_file.schema_type == SchemaType.GL_JOURNAL_LINES:
                journal_date = _parse_date(_extract_value(mapping.get("journal_date"), row, transforms=transforms), date_format=transforms.get("date_format"))
                account_code = str(_extract_value(mapping.get("account_code"), row, transforms=transforms) or "").strip()
                debit = _parse_decimal(_extract_value(mapping.get("debit"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ","))
                credit = _parse_decimal(_extract_value(mapping.get("credit"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ","))
                if not account_code:
                    raise ValueError("missing account code")
                normalized_rows.append(
                    {
                        "journal_date": journal_date,
                        "account_code": account_code,
                        "debit": debit,
                        "credit": credit,
                        "journal_id": _extract_value(mapping.get("journal_id"), row, transforms=transforms),
                        "memo": _extract_value(mapping.get("memo"), row, transforms=transforms),
                        "tracking": _extract_value(mapping.get("tracking"), row, transforms=transforms),
                        "currency": _extract_value(mapping.get("currency"), row, transforms=transforms),
                        "row_index": idx,
                        "raw_payload": row,
                    }
                )
            else:
                pay_date = _parse_date(_extract_value(mapping.get("pay_date"), row, transforms=transforms), date_format=transforms.get("date_format"))
                gross_total = _parse_decimal(_extract_value(mapping.get("gross_total"), row, transforms=transforms), decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ","))
                net_pay_total = _parse_decimal(_extract_value(mapping.get("net_pay_total"), row, transforms=transforms), decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ","))
                normalized_rows.append(
                    {
                        "pay_date": pay_date,
                        "gross_total": gross_total,
                        "net_pay_total": net_pay_total,
                        "employer_taxes": _parse_decimal(_extract_value(mapping.get("employer_taxes"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ",")),
                        "employee_taxes": _parse_decimal(_extract_value(mapping.get("employee_taxes"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ",")),
                        "pension": _parse_decimal(_extract_value(mapping.get("pension"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ",")),
                        "fees": _parse_decimal(_extract_value(mapping.get("fees"), row, transforms=transforms) or "0", decimal_separator=transforms.get("decimal_separator", "."), thousands_separator=transforms.get("thousands_separator", ",")),
                        "currency": _extract_value(mapping.get("currency"), row, transforms=transforms),
                        "raw_payload": row,
                    }
                )
        except Exception:
            failures += 1

    row_count = len(rows)
    parsed_ok = len(normalized_rows)
    failure_rate = (failures / row_count) if row_count else 0.0

    blockers: list[str] = []
    warnings: list[str] = []
    if row_count == 0:
        blockers.append("No data rows detected")

    if failure_rate > 0.01:
        blockers.append(f"Parse failures exceed threshold ({failure_rate:.2%} > 1.00%)")
    elif failure_rate > 0:
        warnings.append(f"Parse failures detected ({failure_rate:.2%})")

    if source_file.schema_type == SchemaType.GL_JOURNAL_LINES and normalized_rows:
        debit_sum = sum((row["debit"] for row in normalized_rows), Decimal("0"))
        credit_sum = sum((row["credit"] for row in normalized_rows), Decimal("0"))
        if (debit_sum - credit_sum).copy_abs() > Decimal("0.01"):
            blockers.append("Journal is unbalanced (debits != credits)")

    if blockers:
        return {
            "row_count": row_count,
            "parsed_ok": parsed_ok,
            "parsed_failed": failures,
            "failure_rate": round(failure_rate, 6),
            "blockers": blockers,
            "warnings": warnings,
        }

    if source_file.schema_type == SchemaType.BANK_TRANSACTIONS:
        db.execute(delete(BankTransaction).where(BankTransaction.source_file_id == source_file.id))
        for row in normalized_rows:
            db.add(
                BankTransaction(
                    run_id=source_file.run_id,
                    source_file_id=source_file.id,
                    posting_date=row["posting_date"],
                    amount=row["amount"],
                    description=row["description"],
                    reference=row.get("reference"),
                    currency=row.get("currency"),
                    account_id=row.get("account_id"),
                    row_index=row["row_index"],
                    raw_payload=row["raw_payload"],
                )
            )
    elif source_file.schema_type == SchemaType.GL_JOURNAL_LINES:
        db.execute(delete(JournalLine).where(JournalLine.source_file_id == source_file.id))
        for row in normalized_rows:
            db.add(
                JournalLine(
                    run_id=source_file.run_id,
                    source_file_id=source_file.id,
                    journal_date=row["journal_date"],
                    journal_id=row.get("journal_id"),
                    account_code=row["account_code"],
                    debit=row["debit"],
                    credit=row["credit"],
                    memo=row.get("memo"),
                    tracking=row.get("tracking"),
                    currency=row.get("currency"),
                    row_index=row["row_index"],
                    raw_payload=row["raw_payload"],
                )
            )
    else:
        db.execute(delete(PayrollSummary).where(PayrollSummary.source_file_id == source_file.id))
        gross = sum((row["gross_total"] for row in normalized_rows), Decimal("0"))
        net = sum((row["net_pay_total"] for row in normalized_rows), Decimal("0"))
        employer_taxes = sum((row["employer_taxes"] for row in normalized_rows), Decimal("0"))
        employee_taxes = sum((row["employee_taxes"] for row in normalized_rows), Decimal("0"))
        pension = sum((row["pension"] for row in normalized_rows), Decimal("0"))
        fees = sum((row["fees"] for row in normalized_rows), Decimal("0"))
        pay_date = normalized_rows[0]["pay_date"]

        db.add(
            PayrollSummary(
                run_id=source_file.run_id,
                source_file_id=source_file.id,
                pay_date=pay_date,
                gross_total=gross,
                net_pay_total=net,
                employer_taxes=employer_taxes,
                employee_taxes=employee_taxes,
                pension=pension,
                fees=fees,
                currency=(normalized_rows[0].get("currency") or "").upper() or None,
                raw_payload={"row_count": len(normalized_rows)},
            )
        )

    return {
        "row_count": row_count,
        "parsed_ok": parsed_ok,
        "parsed_failed": failures,
        "failure_rate": round(failure_rate, 6),
        "blockers": blockers,
        "warnings": warnings,
    }


def detect_schema_for_source(source_file: SourceFile) -> tuple[SchemaType | None, float, list[str], ParsedFile]:
    content = storage_service.read_bytes(source_file.storage_key)
    parsed = parse_container(content, source_file.container_type)
    schema, confidence, reasons = detect_schema(parsed, source_type=source_file.source_type)
    return schema, confidence, reasons, parsed


def map_columns_for_source(
    source_file: SourceFile,
    parsed: ParsedFile,
    provided_mapping: dict[str, Any] | None,
) -> tuple[SchemaType, dict[str, Any], float, dict[str, bool], bool]:
    if source_file.schema_type is None:
        raise ImportValidationError("Schema type is required before mapping")

    suggested_mapping, suggested_confidence, required_status = suggest_mapping(parsed, source_file.schema_type)
    if provided_mapping:
        merged = suggested_mapping | provided_mapping
    else:
        merged = suggested_mapping

    required_fields = SCHEMA_REQUIRED_FIELDS[source_file.schema_type]
    blocked = False
    confidence = suggested_confidence
    for field in required_fields:
        present = field in merged and merged[field] not in (None, "")
        required_status[field] = present
        if not present:
            blocked = True

    if provided_mapping:
        confidence = max(suggested_confidence, 0.95)

    if confidence < 0.90:
        blocked = True

    return source_file.schema_type, merged, round(confidence, 4), required_status, blocked


def persist_mapping_template(
    db: Session,
    *,
    source_file: SourceFile,
    client_id: str,
    name: str,
    scope: MappingScope,
    parsed_headers: list[str],
) -> MappingTemplate:
    if source_file.schema_type is None or source_file.mapping_json is None:
        raise ImportValidationError("Schema and mapping are required before saving template")

    template = MappingTemplate(
        client_id=client_id,
        name=name,
        scope=scope,
        schema_type=source_file.schema_type,
        source_type=source_file.source_type,
        header_fingerprint=header_fingerprint(parsed_headers),
        mapping_json=source_file.mapping_json,
        transformations_json=source_file.transformations_json or {},
    )
    db.add(template)
    return template

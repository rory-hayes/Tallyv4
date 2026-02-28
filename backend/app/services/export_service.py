from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from decimal import Decimal

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.models import ExportPack, Run, SourceFile, User, Variance
from app.services.storage import storage_service


def _format_money(value: Decimal | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}"


def _build_summary_pdf(run: Run, variances: list[Variance]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, 800, "Tally Reconciliation Pack")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, 784, f"Run ID: {run.id}")
    pdf.drawString(40, 770, f"Status: {run.status.value}")
    pdf.drawString(40, 756, f"Pay Date: {run.pay_date.isoformat()}")
    pdf.drawString(40, 742, f"Rule Version: {run.rule_version}")

    y = 712
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(40, y, "Variances")
    y -= 16

    pdf.setFont("Helvetica", 9)
    for variance in variances[:30]:
        line = f"{variance.code} [{variance.severity.value}] {variance.status.value} amount={_format_money(variance.amount)}"
        pdf.drawString(40, y, line[:110])
        y -= 12
        if y < 60:
            pdf.showPage()
            y = 800
            pdf.setFont("Helvetica", 9)

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _build_variance_csv(variances: list[Variance]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["variance_id", "code", "severity", "status", "amount", "default_action", "explanation"])
    for variance in variances:
        writer.writerow(
            [
                variance.id,
                variance.code,
                variance.severity.value,
                variance.status.value,
                _format_money(variance.amount),
                variance.default_action,
                variance.explanation or "",
            ]
        )
    return output.getvalue().encode("utf-8")


def _build_evidence_log(run: Run, source_files: list[SourceFile], variances: list[Variance]) -> bytes:
    payload = {
        "run_id": run.id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rule_version": run.rule_version,
        "status": run.status.value,
        "source_files": [
            {
                "id": source_file.id,
                "type": source_file.source_type.value,
                "name": source_file.original_name,
                "sha256": source_file.sha256_hash,
                "uploaded_at": source_file.upload_timestamp.isoformat(),
            }
            for source_file in source_files
        ],
        "variance_count": len(variances),
        "variances": [
            {
                "id": variance.id,
                "code": variance.code,
                "severity": variance.severity.value,
                "status": variance.status.value,
                "approved_by": variance.approved_by,
                "approved_at": variance.approved_at.isoformat() if variance.approved_at else None,
            }
            for variance in variances
        ],
    }
    return json.dumps(payload, indent=2).encode("utf-8")


def generate_export_pack(db: Session, run: Run, actor: User | None) -> ExportPack:
    source_files = db.query(SourceFile).filter(SourceFile.run_id == run.id).order_by(SourceFile.upload_timestamp.asc()).all()
    variances = db.query(Variance).filter(Variance.run_id == run.id).order_by(Variance.created_at.asc()).all()

    summary_pdf = _build_summary_pdf(run, variances)
    variance_csv = _build_variance_csv(variances)
    evidence_log = _build_evidence_log(run, source_files, variances)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("summary.pdf", summary_pdf)
        archive.writestr("variances.csv", variance_csv)
        archive.writestr("evidence-log.json", evidence_log)

    source_hashes = "|".join(source_file.sha256_hash for source_file in source_files)
    fingerprint_raw = f"{run.id}|{run.rule_version}|{source_hashes}"
    reproducibility_fingerprint = hashlib.sha256(fingerprint_raw.encode("utf-8")).hexdigest()

    key = f"exports/{run.id}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.zip"
    storage_key, checksum = storage_service.save_bytes(zip_buffer.getvalue(), key=key)

    export_pack = ExportPack(
        run_id=run.id,
        storage_key=storage_key,
        checksum=checksum,
        format="zip",
        reproducibility_fingerprint=reproducibility_fingerprint,
        created_by=actor.id if actor else None,
    )
    db.add(export_pack)
    return export_pack

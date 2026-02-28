from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    ApprovalStatus,
    CountryPack,
    FirmRole,
    MappingScope,
    RunStatus,
    SchemaType,
    Severity,
    SourceFileType,
    VarianceStatus,
)


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Firm(Base):
    __tablename__ = "firms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    clients: Mapped[list[Client]] = relationship("Client", back_populates="firm", cascade="all, delete-orphan")
    memberships: Mapped[list[FirmMembership]] = relationship(
        "FirmMembership", back_populates="firm", cascade="all, delete-orphan"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    memberships: Mapped[list[FirmMembership]] = relationship(
        "FirmMembership", back_populates="user", cascade="all, delete-orphan"
    )


class FirmMembership(Base):
    __tablename__ = "firm_memberships"
    __table_args__ = (UniqueConstraint("firm_id", "user_id", name="uq_firm_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    firm_id: Mapped[str] = mapped_column(String(36), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[FirmRole] = mapped_column(Enum(FirmRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    firm: Mapped[Firm] = relationship("Firm", back_populates="memberships")
    user: Mapped[User] = relationship("User", back_populates="memberships")


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    firm_id: Mapped[str] = mapped_column(String(36), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_pack: Mapped[CountryPack] = mapped_column(Enum(CountryPack), nullable=False, default=CountryPack.UK)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    firm: Mapped[Firm] = relationship("Firm", back_populates="clients")
    runs: Mapped[list[Run]] = relationship("Run", back_populates="client", cascade="all, delete-orphan")
    templates: Mapped[list[MappingTemplate]] = relationship(
        "MappingTemplate", back_populates="client", cascade="all, delete-orphan"
    )


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    pay_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    pay_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    pay_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    country_pack: Mapped[CountryPack] = mapped_column(Enum(CountryPack), nullable=False)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), nullable=False, default=RunStatus.NEEDS_REVIEW)
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False, default="v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    client: Mapped[Client] = relationship("Client", back_populates="runs")
    source_files: Mapped[list[SourceFile]] = relationship("SourceFile", back_populates="run", cascade="all, delete-orphan")
    bank_transactions: Mapped[list[BankTransaction]] = relationship(
        "BankTransaction", back_populates="run", cascade="all, delete-orphan"
    )
    payroll_summaries: Mapped[list[PayrollSummary]] = relationship(
        "PayrollSummary", back_populates="run", cascade="all, delete-orphan"
    )
    journal_lines: Mapped[list[JournalLine]] = relationship("JournalLine", back_populates="run", cascade="all, delete-orphan")
    variances: Mapped[list[Variance]] = relationship("Variance", back_populates="run", cascade="all, delete-orphan")
    approvals: Mapped[list[Approval]] = relationship("Approval", back_populates="run", cascade="all, delete-orphan")


class SourceFile(Base):
    __tablename__ = "source_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    source_type: Mapped[SourceFileType] = mapped_column(Enum(SourceFileType), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    container_type: Mapped[str] = mapped_column(String(20), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    upload_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    uploader_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    schema_type: Mapped[SchemaType | None] = mapped_column(Enum(SchemaType), nullable=True)
    schema_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    mapping_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    mapping_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    transformations_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    validation_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    run: Mapped[Run] = relationship("Run", back_populates="source_files")


class MappingTemplate(Base):
    __tablename__ = "mapping_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[MappingScope] = mapped_column(Enum(MappingScope), default=MappingScope.CLIENT, nullable=False)
    schema_type: Mapped[SchemaType] = mapped_column(Enum(SchemaType), nullable=False)
    source_type: Mapped[SourceFileType] = mapped_column(Enum(SourceFileType), nullable=False)
    header_fingerprint: Mapped[str] = mapped_column(String(512), nullable=False)
    mapping_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    transformations_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    client: Mapped[Client] = relationship("Client", back_populates="templates")


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    source_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False)
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    run: Mapped[Run] = relationship("Run", back_populates="bank_transactions")


class PayrollSummary(Base):
    __tablename__ = "payroll_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    source_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False)
    pay_date: Mapped[date] = mapped_column(Date, nullable=False)
    gross_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    net_pay_total: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    employer_taxes: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    employee_taxes: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    pension: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    fees: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    run: Mapped[Run] = relationship("Run", back_populates="payroll_summaries")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    source_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False)
    journal_date: Mapped[date] = mapped_column(Date, nullable=False)
    journal_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_code: Mapped[str] = mapped_column(String(128), nullable=False)
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    memo: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tracking: Mapped[str | None] = mapped_column(String(255), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    run: Mapped[Run] = relationship("Run", back_populates="journal_lines")


class MatchGroup(Base):
    __tablename__ = "match_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    match_type: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    links: Mapped[list[MatchGroupLink]] = relationship("MatchGroupLink", back_populates="match_group", cascade="all, delete-orphan")


class MatchGroupLink(Base):
    __tablename__ = "match_group_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    match_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("match_groups.id", ondelete="CASCADE"), nullable=False
    )
    record_type: Mapped[str] = mapped_column(String(32), nullable=False)
    record_id: Mapped[str] = mapped_column(String(36), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    match_group: Mapped[MatchGroup] = relationship("MatchGroup", back_populates="links")


class Variance(Base):
    __tablename__ = "variances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)
    status: Mapped[VarianceStatus] = mapped_column(Enum(VarianceStatus), nullable=False, default=VarianceStatus.OPEN)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    trigger_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    default_action: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    run: Mapped[Run] = relationship("Run", back_populates="variances")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    firm_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("firms.id", ondelete="SET NULL"), nullable=True)
    client_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("runs.id", ondelete="SET NULL"), nullable=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.DRAFT)
    submitted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped[Run] = relationship("Run", back_populates="approvals")


class ExportPack(Base):
    __tablename__ = "export_packs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    format: Mapped[str] = mapped_column(String(20), nullable=False, default="zip")
    reproducibility_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    token: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

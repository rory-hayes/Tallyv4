from __future__ import annotations

from app.models.enums import VarianceStatus


ALLOWED_TRANSITIONS: dict[VarianceStatus, set[VarianceStatus]] = {
    VarianceStatus.OPEN: {
        VarianceStatus.MATCHED,
        VarianceStatus.EXPLAINED,
        VarianceStatus.EXPECTED_LATER,
        VarianceStatus.IGNORED,
    },
    VarianceStatus.MATCHED: {VarianceStatus.APPROVED, VarianceStatus.CLOSED},
    VarianceStatus.EXPLAINED: {VarianceStatus.APPROVED, VarianceStatus.CLOSED},
    VarianceStatus.EXPECTED_LATER: {VarianceStatus.APPROVED, VarianceStatus.CLOSED},
    VarianceStatus.IGNORED: {VarianceStatus.APPROVED},
    VarianceStatus.APPROVED: {VarianceStatus.CLOSED},
    VarianceStatus.CLOSED: set(),
}


def can_transition(current: VarianceStatus, target: VarianceStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def enforce_transition(
    *,
    current: VarianceStatus,
    target: VarianceStatus,
    allow_ignore: bool,
) -> None:
    if target == VarianceStatus.IGNORED and not allow_ignore:
        raise ValueError("Ignored status requires explicit policy enablement.")

    if not can_transition(current, target):
        raise ValueError(f"Invalid variance status transition: {current} -> {target}")

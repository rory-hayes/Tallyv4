import pytest

from app.models.enums import VarianceStatus
from app.services.variance_state_machine import enforce_transition


def test_open_to_matched_allowed() -> None:
    enforce_transition(current=VarianceStatus.OPEN, target=VarianceStatus.MATCHED, allow_ignore=False)


def test_ignored_requires_policy() -> None:
    with pytest.raises(ValueError):
        enforce_transition(current=VarianceStatus.OPEN, target=VarianceStatus.IGNORED, allow_ignore=False)


def test_invalid_transition_rejected() -> None:
    with pytest.raises(ValueError):
        enforce_transition(current=VarianceStatus.MATCHED, target=VarianceStatus.OPEN, allow_ignore=True)

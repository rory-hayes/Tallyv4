from app.services.variance_taxonomy import VARIANCE_DEFINITIONS


def test_taxonomy_has_expected_count() -> None:
    assert len(VARIANCE_DEFINITIONS) == 40


def test_taxonomy_contains_all_required_prefixes() -> None:
    codes = set(VARIANCE_DEFINITIONS.keys())
    assert any(code.startswith("RUN-") for code in codes)
    assert any(code.startswith("BNK-") for code in codes)
    assert any(code.startswith("GL-") for code in codes)
    assert any(code.startswith("X-") for code in codes)
    assert any(code.startswith("TIME-") for code in codes)
    assert "CUR-001" in codes
    assert "SIGN-001" in codes
    assert "ROUND-001" in codes

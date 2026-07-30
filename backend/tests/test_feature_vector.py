import pytest
from sentinel_backend.features.vector import FeatureVector, FEATURE_COLUMNS


def test_feature_vector_to_array_order():
    """to_array() must match FEATURE_COLUMNS order exactly — this is the
    model input contract; any drift causes silent shape mismatches."""
    v = FeatureVector(
        pid=1, ppid=0, comm="test",
        window_start_ns=0, window_end_ns=5_000_000_000,
        num_execve=10, num_distinct_children=2, num_file_opens=5,
        num_file_renames=3, num_file_deletes=1, num_distinct_files_touched=7,
        num_connect=4, num_distinct_dest_ips=2, num_setuid=0,
        syscall_rate=8.5,
    )
    arr = v.to_array()

    assert len(arr) == len(FEATURE_COLUMNS)
    for i, col in enumerate(FEATURE_COLUMNS):
        assert arr[i] == float(getattr(v, col)), (
            f"Mismatch at index {i}: FEATURE_COLUMNS[{i}]={col}, "
            f"expected {getattr(v, col)}, got {arr[i]}"
        )


def test_feature_vector_all_fields_present():
    """Ensure every FEATURE_COLUMNS entry maps to a real FeatureVector field."""
    v = FeatureVector(
        pid=1, ppid=0, comm="test",
        window_start_ns=0, window_end_ns=1_000_000_000,
        num_execve=0, num_distinct_children=0, num_file_opens=0,
        num_file_renames=0, num_file_deletes=0, num_distinct_files_touched=0,
        num_connect=0, num_distinct_dest_ips=0, num_setuid=0,
        syscall_rate=0.0,
    )
    for col in FEATURE_COLUMNS:
        assert hasattr(v, col), f"FeatureVector missing attribute: {col}"


def test_feature_vector_to_array_type():
    """All elements in to_array() must be floats (model contract)."""
    v = FeatureVector(
        pid=1, ppid=0, comm="test",
        window_start_ns=0, window_end_ns=2_000_000_000,
        num_execve=1, num_distinct_children=0, num_file_opens=2,
        num_file_renames=0, num_file_deletes=0, num_distinct_files_touched=2,
        num_connect=0, num_distinct_dest_ips=0, num_setuid=0,
        syscall_rate=0.5,
    )
    for val in v.to_array():
        assert isinstance(val, float)

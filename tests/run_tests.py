"""Run independent integration suites, stopping at the first failure."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for suite in ('smoke_test.py', 'v2_features_test.py', 'nickname_filter_test.py', 'online_test.py'):
    print(f'Running {suite}', flush=True)
    subprocess.run([sys.executable, str(root / 'tests' / suite)], cwd=root, check=True, timeout=90)

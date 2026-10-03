"""Compatibility entry point; configuration is resolved by the Node checker."""
import subprocess, sys
from pathlib import Path
sys.exit(subprocess.call(['node',str(Path(__file__).with_suffix('.mjs')),*sys.argv[1:]]))

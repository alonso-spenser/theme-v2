"""Read-only mall salt check. Connection details must be explicitly configured."""
import os, re, sys, subprocess
try:
    salt = sys.argv[1]
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9]{5}', salt):
        raise ValueError('Invalid salt')
    env = os.environ.copy()
    env['MYSQL_PWD'] = os.environ['THEME_DB_PASSWORD']
    result = subprocess.run([os.environ.get('THEME_MYSQL_BIN','mysql'), '-h', os.environ.get('THEME_DB_HOST','127.0.0.1'), '-P', os.environ.get('THEME_DB_PORT','3306'), '-u', os.environ['THEME_DB_USER'], '--batch', '--raw', '--skip-column-names'], input=f"SELECT EXISTS(SELECT 1 FROM mall.theme_section WHERE salt='{salt}');", text=True, capture_output=True, env=env, check=True)
    value=result.stdout.strip()
    if value not in ('0','1'): raise ValueError('Invalid response')
    print(value)
except Exception:
    print('Database salt check failed; configure THEME_DB_USER, THEME_DB_PASSWORD and THEME_MYSQL_BIN.', file=sys.stderr)
    sys.exit(1)

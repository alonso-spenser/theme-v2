#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
    echo 'Run with sudo; the administrator password is entered only in your terminal.' >&2
    exit 1
fi
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET=/etc/nginx/conf.d/theme.conf
# nginx.conf includes conf.d/*, so backups must live outside that directory.
mkdir -p /etc/nginx/theme-backups
BACKUP="/etc/nginx/theme-backups/theme.conf-$(date +%Y%m%d%H%M%S)"
cp "$TARGET" "$BACKUP"
cp "$DIR/theme.conf" "$TARGET"
if /opt/homebrew/bin/nginx -t; then
    if /opt/homebrew/bin/nginx -s reload; then
        echo "Switched www.theme.com to theme-v2. Backup: $BACKUP"
        exit 0
    fi
fi
cp "$BACKUP" "$TARGET"
/opt/homebrew/bin/nginx -t && /opt/homebrew/bin/nginx -s reload
echo 'Switch failed; old configuration restored.' >&2
exit 1

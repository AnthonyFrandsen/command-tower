#!/bin/sh
set -e

# npm-generated bin shims check `[ -x "$basedir/node" ]` and exec that path
# directly, bypassing PATH. When node_modules was installed on a Windows host,
# node_modules/.bin/node is a symlink to a Windows PE binary (from the 'node'
# npm package) that Linux cannot execute. Re-pointing it to the container's
# real node makes all npm bin shims work correctly.
REAL_NODE=$(readlink -f /usr/local/bin/node)
DOTBIN_NODE=/workspace/node_modules/.bin/node

if [ -e "$DOTBIN_NODE" ]; then
    CURRENT=$(readlink -f "$DOTBIN_NODE" 2>/dev/null || echo "")
    if [ "$CURRENT" != "$REAL_NODE" ]; then
        ln -sf "$REAL_NODE" "$DOTBIN_NODE" 2>/dev/null || \
            printf 'Warning: could not fix %s; npm scripts may fail\n' "$DOTBIN_NODE" >&2
    fi
fi

exec "$@"

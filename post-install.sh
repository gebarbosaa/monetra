#!/bin/sh
set -e

# Check if we're in a git repository
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Running git commands..."
    git config blame.ignoreRevsFile .git-blame-ignore-revs
else
    echo "Not in a git repository, skipping git commands."
fi

# Images that skip the patches/ directory (backend) have neither the patched
# packages nor a reason to run this. Vercel may omit devDependencies during
# install, so prefer the lockfile-installed binary and use a pinned npx
# fallback when it is not present.
if [ -d patches ]; then
    if [ -x node_modules/.bin/patch-package ]; then
        node_modules/.bin/patch-package
    else
        npx --yes --package=patch-package@8.0.1 patch-package
    fi
fi

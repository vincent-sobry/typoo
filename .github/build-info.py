"""Write build info into index.html at deploy time.

Usage: python3 build-info.py <git checkout dir> <index.html to change>
Replaces the line marked /*@BUILD@*/ with the version (newest tag),
the last merged PR (number + title), the short commit SHA and the build time.
"""
import datetime, json, re, subprocess, sys

repo, target = sys.argv[1], sys.argv[2]

def git(*args):
    try:
        return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=True).stdout.strip()
    except subprocess.CalledProcessError:
        return ""

# Version = newest release tag, plus the number of commits since it that are not in
# that release ("v1.1+3"). git describe is not used: on dev, the newest tag sits on a
# main merge commit that dev may not contain.
tag = (git("tag", "--list", "v*", "--sort=-v:refname").splitlines() or [""])[0]
if tag:
    ahead = git("rev-list", "--count", f"{tag}..HEAD") or "0"
    version = tag if ahead == "0" else f"{tag}+{ahead}"
else:
    version = ""

info = {
    "version": version,
    "sha": git("rev-parse", "--short", "HEAD"),
    "date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
# Last merge commit from a PR: subject "Merge pull request #8 from ...", body = PR title.
merge = git("log", "-1", "--merges", "--grep=^Merge pull request #", "--format=%s%n%b")
m = re.match(r"Merge pull request #(\d+)", merge)
if m:
    info["pr"] = m.group(1)
    title = merge.split("\n", 1)[1].strip().split("\n")[0] if "\n" in merge else ""
    if title:
        info["prTitle"] = title

js = json.dumps(info, ensure_ascii=False).replace("</", "<\\/")
html = open(target, encoding="utf-8").read()
new, n = re.subn(r"^const BUILD = .*?/\*@BUILD@\*/$", lambda _: f"const BUILD = {js}; /*@BUILD@*/", html, flags=re.M)
if n != 1:
    sys.exit(f"build-info: marker not found in {target}")
open(target, "w", encoding="utf-8").write(new)
print(f"build-info {target}: {js}")

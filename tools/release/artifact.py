"""Read release metadata without extracting archives or executing package code."""
import email.parser
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile
import tomllib
import zipfile


def inspect(kind, filename):
    path = Path(filename)
    if kind == "pyproject":
        project = tomllib.loads(path.read_text())["project"]
        return {"name": project["name"], "version": project["version"]}
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if kind == "npm":
        pattern = r"package/package\.json"
    else:
        pattern = r"[^/]+\.dist-info/METADATA" if path.suffix == ".whl" else r"[^/]+/PKG-INFO"
    if path.suffix == ".whl":
        with zipfile.ZipFile(path) as archive:
            entries = [entry for entry in archive.infolist() if re.fullmatch(pattern, entry.filename)]
            if len(entries) != 1 or entries[0].file_size > 1024 * 1024:
                raise ValueError("Missing, duplicate or oversized artifact metadata")
            text = archive.read(entries[0]).decode("utf8")
    else:
        with tarfile.open(path, "r:gz") as archive:
            entries = [entry for entry in archive if re.fullmatch(pattern, entry.name)]
            if len(entries) != 1 or not entries[0].isfile() or entries[0].size > 1024 * 1024:
                raise ValueError("Missing, duplicate or oversized artifact metadata")
            text = archive.extractfile(entries[0]).read().decode("utf8")
    metadata = json.loads(text) if kind == "npm" else email.parser.Parser().parsestr(text)
    return {"name": metadata["name" if kind == "npm" else "Name"],
            "version": metadata["version" if kind == "npm" else "Version"],
            "sha256": digest}


if __name__ == "__main__":
    print(json.dumps(inspect(*sys.argv[1:])))

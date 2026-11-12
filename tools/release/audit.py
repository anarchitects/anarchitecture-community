"""Inspect retained release archives without extracting or executing their contents."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile
import zipfile
import fnmatch


def audit(filename):
    path = Path(filename)
    files = {}
    if path.suffix == ".whl":
        with zipfile.ZipFile(path) as archive:
            for entry in archive.infolist():
                if not entry.is_dir():
                    if entry.file_size > 64 * 1024 * 1024 or entry.filename in files:
                        raise ValueError("Oversized or duplicate archive entry")
                    if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                        raise ValueError("Archive symlink")
                    files[entry.filename] = archive.read(entry)
    else:
        with tarfile.open(path, "r:gz") as archive:
            for entry in archive:
                if entry.isdir():
                    continue
                if not entry.isfile() or entry.size > 64 * 1024 * 1024:
                    raise ValueError("Unsupported archive entry")
                if entry.name in files:
                    raise ValueError("Duplicate archive entry")
                files[entry.name] = archive.extractfile(entry).read()
    for name in files:
        if PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts or "\\" in name:
            raise ValueError("Unsafe archive path")
    result = {"inventory": [{"path": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                            for name, data in sorted(files.items())]}
    if "package/package.json" in files:
        result["manifest"] = json.loads(files["package/package.json"])
        result["readme"] = hashlib.sha256(files["package/README.md"]).hexdigest()
        if not any(name.lower() in ("package/license", "package/license.md", "package/license.txt") for name in files):
            raise ValueError("Missing packaged license")
        license_files = [data for name, data in files.items() if name.lower() in ("package/license", "package/license.md", "package/license.txt")]
        if len(license_files) != 1:
            raise ValueError("Ambiguous packaged license")
        result["license"] = hashlib.sha256(license_files[0]).hexdigest()
        if result["manifest"].get("name", "").startswith("@anarchitects/editorjs-"):
            for name in files:
                if "/src/" in name or "/test/" in name or name.endswith((".tsbuildinfo", ".spec.js", ".test.js")):
                    raise ValueError("Development file in consumer archive")
        for collection in ("dependencies", "optionalDependencies", "peerDependencies"):
            for value in result["manifest"].get(collection, {}).values():
                if value.startswith(("workspace:", "file:", "link:")):
                    raise ValueError("Unpublishable local dependency protocol")
        def exported(value):
            if isinstance(value, str):
                target = "package/" + value.removeprefix("./")
                if not any(fnmatch.fnmatchcase(name, target) for name in files):
                    raise ValueError("Missing exported file: " + value)
            elif isinstance(value, list):
                for item in value:
                    exported(item)
            elif isinstance(value, dict):
                for condition, item in value.items():
                    # Repository-only source condition is not a consumer export.
                    if condition != "@anarchitecture-community/source":
                        exported(item)
        for field in ("main", "module", "types", "style", "sass", "exports", "bin"):
            if field in result["manifest"]:
                exported(result["manifest"][field])
    runtime = [json.loads(data) for name, data in files.items() if name.endswith("/runtime_manifest.json")]
    if runtime:
        if len(runtime) != 1:
            raise ValueError("Ambiguous runtime manifest")
        result["runtime"] = runtime[0]
    return result


if __name__ == "__main__":
    print(json.dumps(audit(sys.argv[1])))

import io, tarfile, urllib.request
from pathlib import Path

VERSION = "0.28.2"  # check the releases page and update this
URL = f"https://github.com/pyodide/pyodide/releases/download/{VERSION}/pyodide-core-{VERSION}.tar.bz2"
DEST = Path(__file__).resolve().parent.parent / "extension" / "vendor"

DEST.mkdir(parents=True, exist_ok=True)
print(f"Downloading {URL}")
data = urllib.request.urlopen(URL).read()
print(f"Got {len(data) // 1024} KB, extracting…")
with tarfile.open(fileobj=io.BytesIO(data), mode="r:bz2") as tar:
    tar.extractall(DEST, filter = "data")
print(f"Done -> {DEST / 'pyodide'}")
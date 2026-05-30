import io
import sys

import zstandard


def main() -> int:
    path = sys.argv[1]
    limit = int(sys.argv[2])
    written = 0
    decompressor = zstandard.ZstdDecompressor()

    with open(path, "rb") as source:
        with decompressor.stream_reader(source) as reader:
            text = io.TextIOWrapper(reader, encoding="utf-8", errors="ignore")
            while written < limit:
                chunk = text.read(min(65536, limit - written))
                if not chunk:
                    break
                sys.stdout.write(chunk)
                written += len(chunk.encode("utf-8", errors="ignore"))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

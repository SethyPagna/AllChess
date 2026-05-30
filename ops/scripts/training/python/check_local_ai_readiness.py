import importlib.util
import json
import platform
import sys


OPTIONAL_PACKAGES = {
    "pyarrow": "parquet dataset streaming",
    "zstandard": "compressed PGN/CSV sample streaming",
}


def package_status(module_name: str, purpose: str) -> dict[str, str]:
    available = importlib.util.find_spec(module_name) is not None
    return {
        "module": module_name,
        "purpose": purpose,
        "status": "available" if available else "missing",
    }


def main() -> int:
    print(
        json.dumps(
            {
                "python": sys.executable,
                "version": platform.python_version(),
                "packages": [package_status(module, purpose) for module, purpose in OPTIONAL_PACKAGES.items()],
                "runtimeUse": "offline bot and local-AI dataset preparation only",
            },
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

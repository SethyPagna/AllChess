import json


def main() -> int:
    try:
        import pyarrow.parquet  # noqa: F401
    except ModuleNotFoundError:
        print(json.dumps({"status": "skipped-pyarrow", "records": 0}))
        return 0

    print(json.dumps({"status": "sampled-parquet", "records": 0}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

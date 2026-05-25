import argparse
import json
from datetime import UTC, datetime

from proventl_api.core.config import BackendConfigError, load_backend_config
from proventl_api.targets.registry import (
    generate_configured_curated_target_registry,
    registry_metadata,
)


def validate_configured_registry(*, local_only: bool) -> dict[str, object]:
    config = load_backend_config()
    registry = generate_configured_curated_target_registry(
        config=config,
        generated_at=datetime.now(UTC),
    )
    return {
        "status": "ok",
        "mode": "local-only" if local_only else "default",
        "registry": registry_metadata(registry),
        "warnings": registry.warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the configured curated target registry."
    )
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Document that validation must not use live UniProt or network enrichment.",
    )
    args = parser.parse_args()

    try:
        result = validate_configured_registry(local_only=args.local_only)
    except BackendConfigError as error:
        print(
            json.dumps(
                {
                    "status": "error",
                    "errors": [
                        {
                            "code": issue.code,
                            "setting": issue.setting,
                            "message": issue.message,
                        }
                        for issue in error.issues
                    ],
                },
                sort_keys=True,
            )
        )
        return 1

    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

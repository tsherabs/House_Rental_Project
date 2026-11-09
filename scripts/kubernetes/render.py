#!/usr/bin/env python3
"""Render only non-secret deployment inputs; no third-party Python dependencies."""
import argparse
from pathlib import Path
import re


def render(output, image_base, image_tag, job):
    if not re.fullmatch(r"ghcr\.io/[a-z0-9_.-]+/[a-z0-9_./-]+", image_base):
        raise ValueError("IMAGE_BASE must be a lowercase GHCR namespace")
    if not re.fullmatch(r"sha-[0-9a-f]{40}", image_tag):
        raise ValueError("IMAGE_TAG must identify a full commit SHA")
    if not re.fullmatch(r"homefinder-migrate-[a-z0-9-]{1,40}", job):
        raise ValueError("Invalid migration Job name")
    replacements = {
        "__API_IMAGE__": f"{image_base}-api:{image_tag}",
        "__WEB_IMAGE__": f"{image_base}-web:{image_tag}",
        "__MIGRATION_JOB__": job,
    }
    source = Path(__file__).resolve().parents[2] / "deployment/kubernetes"
    output.mkdir(parents=True, exist_ok=True)
    for file in source.glob("*.yaml"):
        content = file.read_text()
        for key, value in replacements.items():
            content = content.replace(key, value)
        (output / file.name).write_text(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("image_base")
    parser.add_argument("image_tag")
    parser.add_argument("job")
    args = parser.parse_args()
    render(args.output, args.image_base, args.image_tag, args.job)

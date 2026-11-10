#!/usr/bin/env python3
"""Export Murty-185 measured ROI-mean responses for Compass univariate compare.

Matches Cortex-Core defaults: neurotypical subjects p1–p4; for each image and ROI,
concatenate L/R hemisphere voxels, mean within subject, then average across subjects.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import pickle
from pathlib import Path

import numpy as np

DEFAULT_PICKLE = Path(
    "/research/ruolin/playground/cross_dataset_mean_roi_correlation/"
    "data/murty185/data_murty185/data_murty185/all_data.pickle"
)
SUBJECTS = ("p1", "p2", "p3", "p4")
ROI_MAP = {
    "ffa": ("lffa", "rffa"),
    "ppa": ("lppa", "rppa"),
    "eba": ("leba", "reba"),
}


def export(pickle_path: Path, out_dir: Path) -> dict:
    data = pickle.load(pickle_path.open("rb"))
    n = 185
    means = {roi: np.zeros(n, dtype=np.float64) for roi in ROI_MAP}
    for sid in SUBJECTS:
        if sid not in data:
            raise SystemExit(f"Missing subject {sid} in {pickle_path}")
        for roi, parts in ROI_MAP.items():
            missing = [part for part in parts if part not in data[sid]]
            if missing:
                raise SystemExit(f"{sid} missing {missing}")
            per_image = []
            for index in range(n):
                voxels = np.concatenate(
                    [np.asarray(data[sid][part][index], dtype=np.float64) for part in parts]
                )
                per_image.append(float(np.mean(voxels)))
            means[roi] += np.asarray(per_image, dtype=np.float64)
    for roi in ROI_MAP:
        means[roi] /= len(SUBJECTS)

    rows = [
        {
            "image_name": f"image_{index + 1:03d}.png",
            "ffa": float(means["ffa"][index]),
            "ppa": float(means["ppa"][index]),
            "eba": float(means["eba"][index]),
        }
        for index in range(n)
    ]
    csv_path = out_dir / "murty185_human_roi_means.csv"
    with csv_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["image_name", "ffa", "ppa", "eba"])
        writer.writeheader()
        writer.writerows(rows)

    raw = csv_path.read_bytes()
    manifest = {
        "schemaVersion": 1,
        "artifact": "murty185-human-roi-means",
        "stimulusSet": "Murty-185",
        "responseKind": "measured_fmri_roi_mean",
        "subjects": list(SUBJECTS),
        "subjectPolicy": "neurotypical_p1_p4_average_matching_cortex_core_default",
        "roiAggregation": (
            "concatenate_hemisphere_voxels_then_mean_per_image_then_mean_across_subjects"
        ),
        "rois": list(ROI_MAP),
        "imageCount": n,
        "sourcePickle": str(pickle_path),
        "sourcePickleSha256": hashlib.sha256(pickle_path.read_bytes()).hexdigest(),
        "csv": csv_path.name,
        "csvSha256": hashlib.sha256(raw).hexdigest(),
    }
    manifest_path = out_dir / "murty185_human_roi_means.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pickle", type=Path, default=DEFAULT_PICKLE)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "public" / "data",
    )
    args = parser.parse_args()
    manifest = export(args.pickle, args.out_dir)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()

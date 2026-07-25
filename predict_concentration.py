#!/usr/bin/env python3
"""Predict sample concentration from a raw TXT and calibration equations."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from calibration_core import (
    calculate_signal_statistics,
    load_calibration_bundle,
    predict_concentrations_from_bundle,
)
from decode_and_pack import parse_frames_from_file


OUTPUT_FIELDS = [
    "sample",
    "calibration_mode",
    "n_frames",
    "mean_integrated_counts",
    "within_file_frame_sd",
    "model",
    "equation",
    "predicted_concentration_ug_ml",
    "candidate_concentrations_ug_ml",
    "status",
    "calibration_min_ug_ml",
    "calibration_max_ug_ml",
]


def validate_distinct_paths(
    sample_path: Path,
    models_path: Path,
    output_path: Path,
) -> None:
    paths = [
        Path(sample_path),
        Path(models_path),
        Path(output_path),
    ]
    resolved_paths = {
        path.resolve()
        for path in paths
    }
    if len(resolved_paths) != 3:
        raise ValueError(
            "Sample TXT, calibration JSON, and output paths "
            "must differ."
        )

    for index, first_path in enumerate(paths):
        if not first_path.exists():
            continue
        for second_path in paths[index + 1:]:
            if (
                second_path.exists()
                and first_path.samefile(second_path)
            ):
                raise ValueError(
                    "Sample TXT, calibration JSON, and output "
                    "paths must differ."
                )


def build_prediction_rows(
    sample_path: Path,
    bundle: dict,
    statistics: dict,
) -> list[dict]:
    results = predict_concentrations_from_bundle(
        signal=statistics["mean_integrated_counts"],
        bundle=bundle,
    )
    calibration_min, calibration_max = bundle[
        "valid_concentration_range_ug_ml"
    ]

    rows = []
    for result in results:
        predicted = result["predicted_concentration_ug_ml"]
        candidates = result[
            "candidate_concentrations_ug_ml"
        ]
        rows.append(
            {
                "sample": sample_path.name,
                "calibration_mode": bundle["calibration_mode"],
                "n_frames": statistics["n_frames"],
                "mean_integrated_counts": statistics[
                    "mean_integrated_counts"
                ],
                "within_file_frame_sd": statistics[
                    "sd_integrated_counts"
                ],
                "model": result["model"],
                "equation": result["equation"],
                "predicted_concentration_ug_ml": (
                    "" if predicted is None else predicted
                ),
                "candidate_concentrations_ug_ml": ";".join(
                    f"{value:.12g}" for value in candidates
                ),
                "status": result["status"],
                "calibration_min_ug_ml": calibration_min,
                "calibration_max_ug_ml": calibration_max,
            }
        )

    return rows


def write_prediction_csv(
    output_path: Path,
    rows: list[dict],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=OUTPUT_FIELDS,
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Predict concentration from a raw fluorescence TXT "
            "using exported calibration equations."
        )
    )
    parser.add_argument(
        "--txt",
        type=Path,
        required=True,
        help="Raw TXT file for the unknown sample.",
    )
    parser.add_argument(
        "--models",
        type=Path,
        required=True,
        help="model_equations.json from either comparison script.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("prediction_results.csv"),
        help="CSV output path.",
    )
    args = parser.parse_args()

    try:
        validate_distinct_paths(
            args.txt,
            args.models,
            args.out,
        )
    except ValueError as error:
        raise SystemExit(str(error)) from error

    if not args.txt.is_file():
        raise SystemExit(f"Sample TXT does not exist: {args.txt}")
    if not args.models.is_file():
        raise SystemExit(
            f"Calibration JSON does not exist: {args.models}"
        )

    bundle = load_calibration_bundle(args.models)
    histograms = parse_frames_from_file(args.txt)
    if histograms.shape[0] == 0:
        raise SystemExit(
            f"No valid decoded frames were found in {args.txt}."
        )

    settings = bundle["signal_processing"]
    statistics = calculate_signal_statistics(
        histograms,
        window_start=settings["window_start"],
        window_end=settings["window_end"],
        n_bins=settings["n_bins"],
        background_start=settings["background_start"],
    )
    rows = build_prediction_rows(
        sample_path=args.txt,
        bundle=bundle,
        statistics=statistics,
    )
    write_prediction_csv(args.out, rows)

    print(f"Sample: {args.txt.name}")
    print(
        "Mean integrated signal: "
        f"{statistics['mean_integrated_counts']:.6g}"
    )
    print(
        "Calibration range: "
        f"{bundle['valid_concentration_range_ug_ml'][0]:g} to "
        f"{bundle['valid_concentration_range_ug_ml'][1]:g} ug/mL"
    )
    print()

    for row in rows:
        candidates = (
            row["candidate_concentrations_ug_ml"]
            or "unavailable"
        )
        print(
            f"{row['model']}: {candidates} ug/mL "
            f"[{row['status']}]"
        )

    print(f"\nSaved predictions to: {args.out}")


if __name__ == "__main__":
    main()

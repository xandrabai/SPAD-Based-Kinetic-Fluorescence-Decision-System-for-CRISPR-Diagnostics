/**
 * ============================================================
 *  Configuration — placeholder values, update here only
 * ============================================================
 * These values gate when a real-time concentration prediction
 * is considered statistically reliable enough to display.
 * Referenced by predictionConfidence.js — do not hard-code
 * these numbers anywhere else in the application.
 */

// nM. Temporary placeholder — will be replaced with the actual qPCR threshold.
export const QPCR_THRESHOLD_CONCENTRATION = 10.0;

export const P_VALUE_THRESHOLD = 0.05;
export const CONFIDENCE_LEVEL = 0.95;

export const MIN_SAMPLES_FOR_PREDICTION = 10;
export const MIN_SAMPLES_FOR_DECISION = 20;

import { payloadForConcentration } from './spadPayloadEncoder';

const REPLAY_CONCENTRATIONS = [
  49, 50, 51, 50, 49, 51, 50, 49, 51, 50,
  ...Array(14).fill(70),
];

export function replayEnabled(search = window.location.search) {
  return new URLSearchParams(search).get('replay') === 'positive';
}

export function startPositiveReplay(onPayload, onComplete) {
  let index = 0;
  const timer = window.setInterval(() => {
    onPayload(payloadForConcentration(REPLAY_CONCENTRATIONS[index]));
    index += 1;
    if (index >= REPLAY_CONCENTRATIONS.length) {
      window.clearInterval(timer);
      onComplete?.();
    }
  }, 2_000);
  return () => window.clearInterval(timer);
}

// Retour sensoriel du scanner : à l'entrée d'une salle, l'organisateur ne regarde pas
// toujours l'écran. Vibration (mobiles Android) + bip court (aigu = OK, grave = refus).

let audioContext = null;

function beep(frequency, duration, delay = 0) {
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(audioContext.destination);
    const start = audioContext.currentTime + delay;
    oscillator.start(start);
    oscillator.stop(start + duration);
  } catch {
    /* audio indisponible : on ignore */
  }
}

export function signalScan(ok) {
  if (ok) {
    navigator.vibrate?.(80);
    beep(880, 0.12);
  } else {
    navigator.vibrate?.([60, 60, 60]);
    beep(220, 0.15);
    beep(220, 0.15, 0.2);
  }
}

/**
 * detecteurParole.js — détection réelle d'activité vocale via Web Audio API.
 *
 * Volontairement séparé de tout état WebRTC/UI : ce module observe un
 * MediaStream (local ou distant) et déclenche onChange(true/false)
 * quand le niveau sonore dépasse un seuil, avec un court délai avant
 * de revenir à "silencieux" pour éviter le clignotement entre les mots.
 */
export function creerDetecteurParole(stream, onChange, options = {}) {
  const seuil = options.seuil ?? 20;
  const delaiRetourCalmeMs = options.delaiRetourCalmeMs ?? 400;

  const AudioContextClasse = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClasse();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const donnees = new Uint8Array(analyser.frequencyBinCount);
  let enTrainDeParler = false;
  let dernierPic = 0;
  let idAnimation;

  function boucle() {
    analyser.getByteFrequencyData(donnees);
    const moyenne = donnees.reduce((a, b) => a + b, 0) / donnees.length;

    if (moyenne > seuil) {
      dernierPic = Date.now();
      if (!enTrainDeParler) {
        enTrainDeParler = true;
        onChange(true);
      }
    } else if (enTrainDeParler && Date.now() - dernierPic > delaiRetourCalmeMs) {
      enTrainDeParler = false;
      onChange(false);
    }

    idAnimation = requestAnimationFrame(boucle);
  }
  boucle();

  return function arreter() {
    cancelAnimationFrame(idAnimation);
    source.disconnect();
    audioCtx.close();
  };
}

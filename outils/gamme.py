# gamme.py — La tonalité du morceau, mesurée (4 octobre 2026, nuit : « analyse
# la gamme du morceau, parce que j'en ai aucune idée »). Décode le MP3 (ffmpeg),
# mesure l'accordage (écart des pics au La 440), calcule un chromagramme
# accordé (énergie par classe de hauteur, 60–2000 Hz), le corrèle aux profils
# de Krumhansl-Kessler (24 tonalités) et sort la basse dominante de chaque
# mesure (85 BPM). Résultat du 4 octobre 2026 : mi mineur / sol majeur
# (0,818 / 0,815), La 440 +3 cents, basse do-si-la-sol.
#   python3 outils/gamme.py [fichier.mp3]
import subprocess, sys
import numpy as np
fichier = sys.argv[1] if len(sys.argv) > 1 else "public/assets/jai-un-pote.mp3"
sr = 22050
x = np.frombuffer(subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", fichier, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32)
N, H = 16384, 4096
win = np.hanning(N).astype(np.float32)
freqs = np.fft.rfftfreq(N, 1 / sr)
noms = ["do", "do♯", "ré", "ré♯", "mi", "fa", "fa♯", "sol", "sol♯", "la", "la♯", "si"]
nfr = (len(x) - N) // H
specs, devs, wts = [], [], []
for i in range(nfr):
    mag = np.abs(np.fft.rfft(x[i * H:i * H + N] * win))
    specs.append(mag)
    m = mag[1:-1]
    for p in np.where((m > mag[:-2]) & (m > mag[2:]) & (m > 0.02 * m.max()))[0] + 1:
        if not 80 <= freqs[p] <= 1500: continue
        a, b, c = np.log(mag[p - 1] + 1e-9), np.log(mag[p] + 1e-9), np.log(mag[p + 1] + 1e-9)
        f = (p + 0.5 * (a - c) / (a - 2 * b + c)) * sr / N
        mid = 69 + 12 * np.log2(f / 440)
        devs.append(mid - np.round(mid)); wts.append(mag[p])
h, bords = np.histogram(np.array(devs) * 100, bins=50, range=(-50, 50), weights=np.array(wts))
ecart = bords[np.argmax(h)] + 1
print(f"accordage : {ecart:+.0f} cents par rapport au La 440")
specs = np.array(specs)
midi = 69 + 12 * np.log2(np.maximum(freqs, 1e-6) / (440 * 2 ** (ecart / 1200)))
pc, dev = np.round(midi).astype(int) % 12, np.abs(midi - np.round(midi))
sel = (freqs >= 60) & (freqs <= 2000) & (dev < 0.25)
chroma = np.array([specs[:, sel][:, pc[sel] == k].sum() for k in range(12)]); chroma /= chroma.max()
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
res = sorted([(np.corrcoef(chroma, np.roll(maj, k))[0, 1], noms[k] + " majeur") for k in range(12)] + [(np.corrcoef(chroma, np.roll(mnr, k))[0, 1], noms[k] + " mineur") for k in range(12)], reverse=True)
print("notes :", " ".join(f"{noms[i]} {chroma[i]:.2f}" for i in np.argsort(-chroma)))
print("tonalités :", ", ".join(f"{n} {c:.3f}" for c, n in res[:4]))
selb = (freqs >= 35) & (freqs <= 160) & (dev < 0.25)
mes = 4 * 60 / 85
basse = []
for b in range(int(len(x) / sr / mes)):
    a0, a1 = int(b * mes * sr / H), int((b + 1) * mes * sr / H)
    if a1 > nfr: break
    eb = (specs[a0:a1][:, selb] ** 2).sum(0)
    basse.append(noms[int(np.argmax([eb[pc[selb] == k].sum() for k in range(12)]))])
print("basse par mesure :", " ".join(basse))

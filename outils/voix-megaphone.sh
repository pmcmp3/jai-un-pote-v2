#!/usr/bin/env bash
# voix-megaphone.sh — Un vocal enregistré au téléphone → cri de marchand au
# mégaphone dans une halle, prêt pour le jeu (4 octobre 2026, nuit : « optimise
# le son, effet mégaphone, fondu d'entrée et de sortie »).
#
#   ./outils/voix-megaphone.sh <vocal.m4a> <sortie.mp3> [début_s=0.8] [fin_s=5.95]
#
# Chaîne : coupe (début/fin de la voix, sans le clic du mémo vocal) → passe-haut
# 140 Hz (souffle, plosives) → compresseur 4:1 → légère saturation (le haut-
# parleur du mégaphone) → bande 520 Hz – 3,2 kHz à pente raide + bosse à
# 1,7 kHz (le pavillon) → déclic d'allumage et d'extinction → réverbération de
# halle (réponse impulsionnelle synthétique, 1,3 s, 22 ms de pré-délai) →
# fondus → −16 LUFS → MP3 mono 80 kbps. Vérifié à l'oreille… de Whisper : la
# transcription du résultat est exacte mot pour mot.
set -euo pipefail
ENTREE="$1"; SORTIE="$2"; DEBUT="${3:-0.8}"; FIN="${4:-5.95}"
TMP="$(mktemp -d)"
DUREE=$(python3 -c "print(round($FIN - $DEBUT, 3))")
FONDU=$(python3 -c "print(round($FIN - $DEBUT + 0.45, 3))")
COUPE=$(python3 -c "print(round($FIN - $DEBUT + 1.35, 3))")
CLIC2=$(python3 -c "print(int(($FIN - $DEBUT - 0.13) * 1000))")
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-6.9*t/1.3)':s=48000:d=1.5" \
  -af "highpass=f=250,lowpass=f=4500,adelay=22,volume=0.5" "$TMP/ir.wav"
ffmpeg -hide_banner -loglevel error -y -i "$ENTREE" -i "$TMP/ir.wav" \
  -f lavfi -i "aevalsrc='if(lt(t,0.006),(random(0)*2-1)*0.8*(1-t/0.006),0)+0.45*sin(2*PI*190*t)*exp(-t*140)':s=48000:d=0.09" \
  -f lavfi -i "aevalsrc='if(lt(t,0.005),(random(0)*2-1)*0.5*(1-t/0.005),0)+0.3*sin(2*PI*170*t)*exp(-t*160)':s=48000:d=0.08" \
  -filter_complex "\
[0:a]atrim=start=$DEBUT:end=$FIN,asetpts=PTS-STARTPTS,aresample=48000,highpass=f=140:poles=2,acompressor=threshold=0.1:ratio=4:attack=4:release=90:makeup=2,\
highpass=f=300:poles=2,volume=10dB,asoftclip=type=tanh,volume=-7dB[vs];\
[3:a]adelay=$CLIC2[c2];\
[vs][2:a][c2]amix=inputs=3:normalize=0:duration=first,\
highpass=f=520:poles=2,highpass=f=520:poles=2,lowpass=f=3200:poles=2,lowpass=f=3200:poles=2,equalizer=f=1700:t=q:w=1.0:g=6,apad=pad_dur=1.4[v];\
[v]asplit[d][w];[w][1:a]afir=irnorm=2[wr];[d][wr]amix=inputs=2:weights='1 0.3':normalize=0,\
afade=t=in:st=0:d=0.004,afade=t=out:st=$FONDU:d=0.9,atrim=end=$COUPE,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=44100" -ac 1 "$TMP/voix.wav"
ffmpeg -hide_banner -loglevel error -y -i "$TMP/voix.wav" -c:a libmp3lame -b:a 80k -ac 1 -ar 44100 "$SORTIE"
rm -rf "$TMP"
echo "→ $SORTIE ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SORTIE") s)"

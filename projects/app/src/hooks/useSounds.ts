import { useEffect, useRef } from "react";
import { Audio, AVPlaybackSource } from "expo-av";

// ── Drop your .mp3 files into src/assets/sounds/ and uncomment ───────────
// import likeSfx    from "../assets/sounds/like.mp3";
// import passSfx   from "../assets/sounds/pass.mp3";
// import saveSfx   from "../assets/sounds/save.mp3";
// import undoSfx   from "../assets/sounds/undo.mp3";
// import badgeSfx  from "../assets/sounds/badge.mp3";

type SoundKey = "like" | "pass" | "save" | "undo" | "badge";

const SOURCES: Partial<Record<SoundKey, AVPlaybackSource>> = {
  // like:  likeSfx,
  // pass:  passSfx,
  // save:  saveSfx,
  // undo:  undoSfx,
  // badge: badgeSfx,
};

export function useSounds() {
  const sounds = useRef<Partial<Record<SoundKey, Audio.Sound>>>({});

  useEffect(() => {
    // Respect the device ringer/silent switch
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });

    // Preload all available sounds
    const load = async () => {
      for (const [key, source] of Object.entries(SOURCES) as [SoundKey, AVPlaybackSource][]) {
        try {
          const { sound } = await Audio.Sound.createAsync(source, { volume: 1.0 });
          sounds.current[key] = sound;
        } catch (e) {
          // Sound file missing — silently skip
        }
      }
    };

    load();

    return () => {
      // Unload all sounds on unmount
      for (const sound of Object.values(sounds.current)) {
        sound?.unloadAsync();
      }
    };
  }, []);

  const play = async (key: SoundKey) => {
    const sound = sounds.current[key];
    if (!sound) return;
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Ignore playback errors (e.g. silent mode)
    }
  };

  return { play };
}

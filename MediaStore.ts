/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { PlainSettings } from "@api/Settings";
import { proxyLazyWebpack } from "@webpack";
import { Flux, FluxDispatcher, Toasts } from "@webpack/common";

import { LoopStatus, MediaPlayerSettings, PlaybackInfo, TrackInfo } from "./types";
import { Native } from "./utils";

export const MediaStore = proxyLazyWebpack(() => {
    const { Store } = Flux;

    class MediaStore extends Store {
        public positionMilli = 0;
        public volume = 0; // 0-100
        public _start = 0;

        public track: TrackInfo | null = null;
        public isPlaying = false;
        public shuffle = false;
        public repeat: LoopStatus = "None";
        public isDirty = false;

        // TODO: do we even need this since we are local?
        public isSettingPosition = false;


        public start() {
            Native.startPlayerctlListener(PlainSettings.plugins.MediaPlayerControls.mediaPlayerSettings as MediaPlayerSettings).then(() => {
                console.log("[VencordMediaPlayerControls] Media listener started");
            }).catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to start media listener", e);
                this.onPlayerctlNotFound();
            });
        }

        public stop() {
            Native.killPlayerctl().catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to stop media listener", e);
            });
        }

        /**
         * Handles playback status changes from the main process.
         * @param playbackInfo The updated playback information.
         */
        public onPlaybackInfoChanged(playbackInfo: PlaybackInfo) {
            this.track = playbackInfo.trackInfo;
            this.volume = playbackInfo.volume * 100; // convert to 0-100
            this.repeat = playbackInfo.loopStatus;
            this.shuffle = playbackInfo.shuffle;
            this.isPlaying = playbackInfo.playbackStatus === "Playing";
            this.position = playbackInfo.positionMilli;
            this.isSettingPosition = false;

            // Because this seems to do nothing, we use isDirty flag
            this.isDirty = true;
            this.emitChange(); // TODO: does this do anything then?
        }

        // Need to keep track of this manually
        public get position(): number {
            let pos = this.positionMilli;
            if (this.isPlaying) {
                pos += Date.now() - this._start;
            }
            return pos;
        }

        public set position(p: number) {
            this.positionMilli = p;
            this._start = Date.now();
        }

        markClean() {
            this.isDirty = false;
        }

        setShuffle(state: boolean) {
            Native.callPlayerctl("SetShuffle", state ? "On" : "Off").then(() => {
                this.shuffle = state;
                this.emitChange();
            });
        }

        seek(posMs: number) {
            if (this.isSettingPosition) {
                return Promise.resolve();
            }

            this.isSettingPosition = true;
            // playerctl expects position in seconds, but we use milliseconds internally for better precision
            return Native.callPlayerctl("Seek", posMs / 1000).catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to seek:", e);
            }).finally(() => {
                this.isSettingPosition = false;
            });
        }

        prev() {
            Native.callPlayerctl("Previous").catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to go to previous track:", e);
            });
        }

        setPlaying(playing: boolean) {
            if (playing) {
                Native.callPlayerctl("Play").catch((e: any) => {
                    console.error("[VencordMediaPlayerControls] Failed to play:", e);
                });
            } else {
                Native.callPlayerctl("Pause").catch((e: any) => {
                    console.error("[VencordMediaPlayerControls] Failed to pause:", e);
                });
            }
        }

        next() {
            Native.callPlayerctl("Next").catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to go to next track:", e);
            });
        }

        setRepeat(state: LoopStatus) {
            Native.callPlayerctl("SetLoopStatus", state).catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to set repeat mode:", e);
            });
        }

        setVolume(volume: number) {
            Native.callPlayerctl("SetVolume", volume / 100).then(() => {
                this.volume = volume;
                this.emitChange();
            }).catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to set volume:", e);
            });
        }

        openExternal(path: string) {
            Native.openExternal(path).catch((e: any) => {
                console.error("[VencordMediaPlayerControls] Failed to open external link:", e);
            });
        }

        onPlayerctlNotFound() {
            setTimeout(() => {
                Toasts.show({
                    id: Toasts.genId(),
                    message: "playerctl not found! Please install playerctl and make sure it is on your PATH for the media player controls plugin to work.",
                    type: Toasts.Type.FAILURE,
                    options: {
                        position: Toasts.Position.BOTTOM,
                        duration: 10000,
                    },
                });
            }, 5000);
        }
    }

    return new MediaStore(FluxDispatcher, {
        // idk what to put here
        // https://github.com/Vendicated/Vencord/blob/main/src/plugins/spotifyControls/SpotifyStore.ts
    });
});

// export const MediaStore = new MediaStoreImpl();

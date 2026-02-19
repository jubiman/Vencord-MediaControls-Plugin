/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PlaybackStatus = "Playing" | "Paused" | "Stopped" | "Unknown";
export type LoopStatus = "None" | "Track" | "Playlist";
export type ShuffleArg = "On" | "Off" | "Toggle";
export type PlayerctlMetadata = {
    title: string;
    artist: string;
    album: string;
    url: string;
    length: number; // in microseconds (since that's what we get from playerctl, at least for Elisa)
    artUrl?: string;
    trackid?: string;
    player: string; // The name of the media player, e.g. "spotify", "elisa", etc. This is useful for determining how to handle the metadata, since different players may have different quirks
};
export type TrackInfo = {
    title: string;
    artist: string;
    album: string;
    url: string; // URL to the track, if available, possibly URI encoded, could have protocol prefix like file://
    lengthMilli: number;
    cover: string; // Could be either a URL or a base64-encoded image, depending on whether the cover is embedded or not
    trackid: string;
};
export type PlaybackInfo = {
    trackInfo: TrackInfo;
    shuffle: boolean;
    loopStatus: LoopStatus;
    playbackStatus: PlaybackStatus;
    volume: number; // 0.0 - 1.0
    positionMilli: number;
};

export enum MediaPlayer {
    Strawberry = "strawberry",
    Amarok = "amarok",
    Elisa = "elisa",
    Unknown = "unknown",
    // Add more players here as needed
}

export type MediaPlayerSetting = {
    enabled: boolean;
    priority: number;
};
export type MediaPlayerSettings = Record<MediaPlayer, MediaPlayerSetting>;

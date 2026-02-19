/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * This Media Player Controls plugin is very inspired (based on) the Spotify Controls plugin, so most of the credit goes to them.
 *
 * For now, I have only rewritten the spotify parts to work with the Elisa media player on Linux.
 * In the future I might add support for other media players and platforms as well.
 * I probably won't be adding this to VCS until I do plan on working on those features though.
 */

import { definePluginSettings, PlainSettings, Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { Span } from "@components/Span";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Checkbox, TextInput, Toasts } from "@webpack/common";

import hoverOnlyStyle from "./hoverOnly.css?managed";
import { MediaStore } from "./MediaStore";
import { Player } from "./PlayerComponent";
import { LoopStatus, MediaPlayerSettings, PlaybackInfo } from "./types";
import { Native, Svg2 } from "./utils";

function toggleHoverControls(value: boolean) {
    (value ? enableStyle : disableStyle)(hoverOnlyStyle);
}

interface MediaPlayerSettingProps {
    playerName: string;
}

const RemoveIcon = Svg2("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v10zM18 4h-2.5l-.71-.71c-.18-.18-.44-.29-.7-.29H9.91c-.26 0-.52.11-.7.29L8.5 4H6c-.55 0-1 .45-1 1s.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1z", "remove");
const UpArrow = Svg2("M13 19V7.83l4.88 4.88c.39.39 1.03.39 1.42 0 .39-.39.39-1.02 0-1.41l-6.59-6.59c-.39-.39-1.02-.39-1.41 0l-6.6 6.58c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L11 7.83V19c0 .55.45 1 1 1s1-.45 1-1z", "uparrow");
const DownArrow = Svg2("M11 5v11.17l-4.88-4.88c-.39-.39-1.03-.39-1.42 0-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0l6.59-6.59c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L13 16.17V5c0-.55-.45-1-1-1s-1 .45-1 1z", "downarrow");

function MediaPlayerSetting({ playerName }: MediaPlayerSettingProps) {
    const { mediaPlayerSettings } = settings.use(["mediaPlayerSettings"]);
    const playerSettings = mediaPlayerSettings[playerName];

    if (!playerSettings) return null;

    return (
        <div key={playerName}
             style={{
                 display: "grid",
                 gridTemplateColumns: "1fr 80px 116px",
                 gap: "10px",
                 alignItems: "center",
             }}
        >
            <Span style={{
                textTransform: "capitalize",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}>
                {playerName}
            </Span>
            <div style={{ display: "flex", justifySelf: "center", alignItems: "center" }}>
                <Checkbox value={playerSettings.enabled} onChange={(_, value) => {
                    settings.store.mediaPlayerSettings[playerName] = {
                        ...playerSettings,
                        enabled: value,
                    };
                }} align={"center"}/>
            </div>
            {/* TODO: add first and last buttons for maniacs that have too many players? */}
            <div style={{
                display: "flex",
                justifySelf: "end",
                justifyContent: "flex-end",
                alignItems: "end",
                gap: "10px"
            }}>
                <Button size="iconOnly" onClick={() => {
                    // Move this player up in the priority list by swapping its priority with the player that is currently above it (if any)
                    const otherPlayerName = Object.keys(mediaPlayerSettings).find(otherName => {
                        const otherSettings = mediaPlayerSettings[otherName];
                        return otherSettings.priority === playerSettings.priority - 1;
                    });

                    console.log("[VencordMediaPlayerControls] Moving player up:", playerName, "other player:", otherPlayerName);

                    if (!otherPlayerName) return;

                    settings.store.mediaPlayerSettings[otherPlayerName] = {
                        ...mediaPlayerSettings[otherPlayerName],
                        priority: mediaPlayerSettings[otherPlayerName].priority + 1,
                    };

                    settings.store.mediaPlayerSettings[playerName] = {
                        ...playerSettings,
                        priority: playerSettings.priority - 1,
                    };

                    console.log("[VencordMediaPlayerControls] Updated settings:", settings.store.mediaPlayerSettings);
                }} variant="primary" disabled={playerSettings.priority === 0} title="Move Priority Up">
                    <UpArrow/>
                </Button>
                <Button size="iconOnly" onClick={() => {
                    delete settings.store.mediaPlayerSettings[playerName];
                }} variant="dangerPrimary">
                    <RemoveIcon/>
                </Button>
                <Button size="iconOnly" onClick={() => {
                    // Move this player down in the priority list by swapping its priority with the player that is currently below it (if any)
                    const otherPlayerName = Object.keys(mediaPlayerSettings).find(otherName => {
                        const otherSettings = mediaPlayerSettings[otherName];
                        return otherSettings.priority === playerSettings.priority + 1;
                    });

                    console.log("[VencordMediaPlayerControls] Moving player down:", playerName, "other player:", otherPlayerName);

                    if (!otherPlayerName) return;

                    settings.store.mediaPlayerSettings[otherPlayerName] = {
                        ...mediaPlayerSettings[otherPlayerName],
                        priority: mediaPlayerSettings[otherPlayerName].priority - 1,
                    };

                    settings.store.mediaPlayerSettings[playerName] = {
                        ...playerSettings,
                        priority: playerSettings.priority + 1,
                    };

                    console.log("[VencordMediaPlayerControls] Updated settings:", settings.store.mediaPlayerSettings);
                }} variant="primary" disabled={playerSettings.priority === Object.keys(mediaPlayerSettings).length - 1} title="Move Priority Down">
                    <DownArrow/>
                </Button>
            </div>
        </div>
    );
}

function parseInputAndAddPlayer(input: HTMLInputElement) {
    const playerName = input.value.trim().toLowerCase();
    if (!playerName) return;

    if (playerName in (settings.store.mediaPlayerSettings as MediaPlayerSettings)) {
        Toasts.show({
            id: Toasts.genId(),
            message: `Player "${playerName}" already exists!`,
            type: Toasts.Type.FAILURE,
            options: {
                position: Toasts.Position.BOTTOM,
            },
        });
        return;
    }

    input.value = "";

    settings.store.mediaPlayerSettings[playerName] = {
        enabled: true,
        priority: Object.keys(settings.store.mediaPlayerSettings).length, // put it at the end of the list by default
    };
}

const MediaPlayerSettingsComponent = ErrorBoundary.wrap(() => {
    const { mediaPlayerSettings } = settings.use(["mediaPlayerSettings"]);

    const sortedPlayerNames = Object.keys(mediaPlayerSettings).sort((a, b) => {
        const priorityA = mediaPlayerSettings[a].priority;
        const priorityB = mediaPlayerSettings[b].priority;

        return priorityA - priorityB;
    });

    return (
        <SettingsSection name="Media Player Settings"
                         description="Add/remove and enable/disable media players that you want the plugin to detect.">
            {/* TODO: *insert playerctl filepicker here* (incase it is not on PATH) */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 116px",
                gap: "10px",
                alignItems: "center",
                marginTop: "10px",
            }}>
                <Span style={{ display: "flex", justifyContent: "flex-start" }} weight="semibold">Media Player</Span>
                <Span style={{
                    display: "flex",
                    justifyContent: "center"
                }}>Enabled</Span>
                <Span style={{ display: "flex", justifyContent: "center" }}>Actions</Span>
            </div>
            {sortedPlayerNames.map(playerName => (
                <MediaPlayerSetting key={playerName} playerName={playerName}/>
            ))}
            <Span>Please note that these player names should be the MPRIS interface name! e.g.
                org.mpris.MediaPlayer2.<b>strawberry</b> (case <b>in</b>sensitive)</Span>
            <div style={{ display: "grid", gap: "10px", marginTop: "10px", gridTemplateColumns: "1fr 44px" }}>
                <TextInput placeholder="e.g. 'spotify', 'vlc', 'elisa' etc." onKeyUp={e => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const input = e.currentTarget as HTMLInputElement;
                        parseInputAndAddPlayer(input);
                    }
                }} style={{ flex: "1 1 auto", minWidth: 0 }}/>
                <Button onClick={() => {
                    // TODO: is there a better way to do this?
                    const input = document.querySelector("input[placeholder=\"e.g. 'spotify', 'vlc', 'elisa' etc.\"]") as HTMLInputElement;
                    parseInputAndAddPlayer(input);
                }} size="iconOnly" title="Add Media Player" style={{
                    height: "44px",
                    width: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    justifySelf: "end",
                }}>
                    {/* TODO make this an enter icon? */}
                    <UpArrow />
                </Button>
            </div>
            <Button variant={"positive"} onClick={() => {
                Native.updatePlayerctlSettings(PlainSettings.plugins.MediaPlayerControls.mediaPlayerSettings as MediaPlayerSettings).then(() => {
                    Toasts.show({
                        id: Toasts.genId(),
                        message: "Settings applied!",
                        type: Toasts.Type.SUCCESS,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                }).catch((e: any) => {
                    console.error("Failed to update playerctl settings", e);
                    Toasts.show({
                        id: Toasts.genId(),
                        message: "Failed to update media player settings! Please check the console for more details.",
                        type: Toasts.Type.FAILURE,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                });
            }}>
                Apply Changes (no restart required)
            </Button>
        </SettingsSection>
    );
});

const settings = definePluginSettings({
    hoverControls: {
        description: "Show controls on hover",
        type: OptionType.BOOLEAN,
        default: false,
    },
    previousButtonRestartsTrack: {
        type: OptionType.BOOLEAN,
        description: "Restart currently playing track when pressing the previous button if playtime is >3s",
        default: true
    },
    mediaPlayerSettings: {
        type: OptionType.COMPONENT,
        default: {
            // TODO: should default be filled? probably with more than 1 player at least, but idk if enabled (and what to do about priority)
            strawberry: {
                enabled: false,
                priority: 0,
            }
        } as MediaPlayerSettings, // media player name (e.g. "strawberry", "elisa" etc.) -> settings for that media player
        component: MediaPlayerSettingsComponent,
    },
});

export default definePlugin({
    name: "MediaPlayerControls",
    description: "Adds controls for a local media player above the account panel",
    authors: [Devs.Ven, Devs.afn, Devs.KraXen72, Devs.Av32000, Devs.nin0dev, {
        name: "Jubiman",
        id: 151990643684540416n
    }],
    requiresRestart: true,
    settings,
    patches: [
        {
            find: ".WIDGETS_RTC_UPSELL_COACHMARK),",
            replacement: {
                // react.jsx)(AccountPanel, { ..., showTaglessAccountPanel: blah })
                match: /(?<=\i\.jsxs?\)\()(\i),{(?=[^}]*?userTag:\i,occluded:)/,
                // react.jsx(WrapperComponent, { VencordOriginal: AccountPanel, ...
                replace: "$self.PanelWrapper,{VencordOriginal:$1,"
            }
        },
    ],
    start() {
        // Start the playerctl listener
        MediaStore.start();

        // Start the modal
        toggleHoverControls(Settings.plugins.MediaPlayerControls.hoverControls);
    },

    // fixme: this method is never called for some reason.
    stop() {
        MediaStore.stop();
    },

    onPlaybackStatusChanged(status: string, positionMilli: number) {
        MediaStore.isPlaying = status === "Playing";
        MediaStore.position = positionMilli;
        MediaStore.emitChange();
    },

    onPlaybackInfoChanged(playbackInfo: PlaybackInfo) {
        MediaStore.onPlaybackInfoChanged(playbackInfo);
    },

    onPositionChanged(positionMilli: number) {
        MediaStore.position = positionMilli;
        MediaStore.emitChange();
    },

    onShuffleChanged(shuffle: boolean) {
        MediaStore.shuffle = shuffle;
        MediaStore.emitChange();
    },

    onLoopStatusChanged(loopStatus: LoopStatus) {
        MediaStore.repeat = loopStatus;
        MediaStore.emitChange();
    },

    onVolumeChanged(volume: number) {
        MediaStore.volume = volume;
        MediaStore.emitChange();
    },

    onPlayerctlNotFound() {
        MediaStore.onPlayerctlNotFound();
    },

    PanelWrapper({ VencordOriginal, ...props }) {
        return (
            <>
                <ErrorBoundary
                    fallback={() => (
                        <div className="vc-mediaplayer-fallback">
                            <p>Failed to render Media Player Modal :(</p>
                            <p>Check the console for errors</p>
                        </div>
                    )}
                >
                    <Player/>
                </ErrorBoundary>

                <VencordOriginal {...props} />
            </>
        );
    },

    // used by native to debug in the web console, which has some nicer debugging feature support (like not printing [object Object] for objects)
    debugLog(...args: any[]) {
        console.log("[VencordMediaPlayerControls] [NativeDebugLog]", ...args);
    }
});

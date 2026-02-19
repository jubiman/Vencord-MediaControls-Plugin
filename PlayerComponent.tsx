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

import "./mediaStyles.css";

import { Settings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { CopyIcon, ImageIcon, LinkIcon, OpenExternalIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { debounce } from "@shared/debounce";
import { copyWithToast, openImageModal } from "@utils/discord";
import { classes } from "@utils/misc";
import { ContextMenuApi, FluxDispatcher, Menu, React, useEffect, useState, useStateFromStores } from "@webpack/common";

import { MediaStore } from "./MediaStore";
import { SeekBar } from "./SeekBar";
import { TrackInfo } from "./types";
import { cl, Svg } from "./utils";


function msToHuman(ms: number) {
    const minutes = ms / 1000 / 60;
    const m = Math.floor(minutes);
    const s = Math.floor((minutes - m) * 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// KraXen's icons :yesyes:
// from https://fonts.google.com/icons?icon.style=Rounded&icon.set=Material+Icons
// older material icon style, but still really good
const PlayButton = Svg("M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z", "play");
const PauseButton = Svg("M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z", "pause");
const SkipPrev = Svg("M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z", "previous");
const SkipNext = Svg("M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z", "next");
const Repeat = Svg("M7 7h10v1.79c0 .45.54.67.85.35l2.79-2.79c.2-.2.2-.51 0-.71l-2.79-2.79c-.31-.31-.85-.09-.85.36V5H6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1V7zm10 10H7v-1.79c0-.45-.54-.67-.85-.35l-2.79 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.31.31.85.09.85-.36V19h11c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1s-1 .45-1 1v3z", "repeat");
const Shuffle = Svg("M10.59 9.17L6.12 4.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.46 4.46 1.42-1.4zm4.76-4.32l1.19 1.19L4.7 17.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L17.96 7.46l1.19 1.19c.31.31.85.09.85-.36V4.5c0-.28-.22-.5-.5-.5h-3.79c-.45 0-.67.54-.36.85zm-.52 8.56l-1.41 1.41 3.13 3.13-1.2 1.2c-.31.31-.09.85.36.85h3.79c.28 0 .5-.22.5-.5v-3.79c0-.45-.54-.67-.85-.35l-1.19 1.19-3.13-3.14z", "shuffle");

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cl("button")}
            {...props}
        >
            {props.children}
        </button>
    );
}

function CopyContextMenu({ name, type, path }: { type: string; name: string; path: string; }) {
    return (
        <Menu.Menu
            navId="vc-media-menu"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label={`Media ${type} Menu`}
        >
            <Menu.MenuItem
                id="vc-media-copy-name"
                label={`Copy ${type} Name`}
                action={() => copyWithToast(name)}
                icon={CopyIcon}
            />
            <Menu.MenuItem
                id="vc-media-copy-link"
                label={`Copy ${type} Link`}
                // action={() => copyWithToast("https://open.media.com" + path)}
                action={() => copyWithToast(path)}
                icon={LinkIcon}
            />
            <Menu.MenuItem
                id="vc-media-open"
                label={`Open ${type} in File Explorer`}
                action={() => MediaStore.openExternal(path)}
                icon={OpenExternalIcon}
            />
        </Menu.Menu>
    );
}

function Controls() {
    const [isPlaying, shuffle, repeat] = useStateFromStores(
        [MediaStore],
        () => [MediaStore.isPlaying, MediaStore.shuffle, MediaStore.repeat]
    );

    const [nextRepeat, repeatClassName] = (() => {
        switch (repeat) {
            case "None": return ["Playlist", "repeat-off"] as const;
            case "Playlist": return ["Track", "repeat-context"] as const;
            case "Track": return ["None", "repeat-track"] as const;
            default: throw new Error(`Invalid repeat state ${repeat}`);
        }
    })();

    // the 1 is using position absolute so it does not make the button jump around
    return (
        <Flex className={cl("button-row")} gap="0">
            <Button
                className={classes(cl("button"), cl("shuffle"), cl(shuffle ? "shuffle-on" : "shuffle-off"))}
                onClick={() => MediaStore.setShuffle(!shuffle)}
            >
                <Shuffle />
            </Button>
            <Button onClick={() => {
                Settings.plugins.MediaPlayerControls.previousButtonRestartsTrack && MediaStore.position > 3000 ? MediaStore.seek(0) : MediaStore.prev();
            }}>
                <SkipPrev />
            </Button>
            <Button onClick={() => MediaStore.setPlaying(!isPlaying)}>
                {isPlaying ? <PauseButton /> : <PlayButton />}
            </Button>
            <Button onClick={() => MediaStore.next()}>
                <SkipNext />
            </Button>
            <Button
                className={classes(cl("button"), cl("repeat"), cl(repeatClassName))}
                onClick={() => MediaStore.setRepeat(nextRepeat)}
                style={{ position: "relative" }}
            >
                {repeat === "Track" && <span className={cl("repeat-1")}>1</span>}
                <Repeat />
            </Button>
        </Flex>
    );
}

const seek = debounce((v: number) => {
    MediaStore.seek(v);
});

function MediaSeekBar() {
    const { lengthMilli } = MediaStore.track!;

    const [storePosition, isSettingPosition, isPlaying, isDirty] = useStateFromStores(
        [MediaStore],
        () => [MediaStore.positionMilli, MediaStore.isSettingPosition, MediaStore.isPlaying, MediaStore.isDirty]
    );

    const [position, setPosition] = useState(storePosition);

    useEffect(() => {
        MediaStore.markClean();
        if (isPlaying && !isSettingPosition) {
            setPosition(MediaStore.position);
            const interval = setInterval(() => {
                setPosition(p => p + 1000);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [storePosition, isSettingPosition, isPlaying, isDirty]);

    const onChange = (v: number) => {
        if (isSettingPosition) return;
        setPosition(v);
        seek(v);
    };


    return (
        <div id={cl("progress-bar")}>
            <Span
                size="xs"
                weight="medium"
                className={cl("progress-time") + " " + cl("time-left")}
                aria-label="Progress"
            >
                {msToHuman(position)}
            </Span>
            <SeekBar
                initialValue={position}
                minValue={0}
                maxValue={lengthMilli}
                onValueChange={onChange}
                asValueChanges={onChange}
                onValueRender={msToHuman}
            />
            <Span
                size="xs"
                weight="medium"
                className={cl("progress-time") + " " + cl("time-right")}
                aria-label="Total Duration"
            >
                {msToHuman(lengthMilli)}
            </Span>
        </div>
    );
}


function AlbumContextMenu({ track }: { track: TrackInfo; }) {
    const volume = useStateFromStores([MediaStore], () => MediaStore.volume);

    return (
        <Menu.Menu
            navId="media-album-menu"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="Media Album Menu"
        >
            <Menu.MenuItem
                key="open-album"
                id="open-album"
                label="Open Album"
                action={() => MediaStore.openExternal(track.url)}
                icon={OpenExternalIcon}
            />
            <Menu.MenuItem
                key="view-cover"
                id="view-cover"
                label="View Album Cover"
                // trolley
                action={() => {
                    const image = {
                        // TODO: probably dynamically get this or smth
                        //   im just trying to copy this from SpotifyControls, but the data we have is slightly different...
                        //   It might be worth it to retrieve this info as we get it earlier in the pipeline and embed it
                        //   (when we will also have to possibly decode an embedded image from playerctl metadata)
                        width: 3000,
                        height: 3000,
                        url: track.cover,
                    };
                    openImageModal(image);
                }}
                icon={ImageIcon}
            />
            <Menu.MenuControlItem
                id="media-volume"
                key="media-volume"
                label="Volume"
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        {...props}
                        ref={ref}
                        value={volume}
                        minValue={0}
                        maxValue={100}
                        onChange={debounce((v: number) => MediaStore.setVolume(v))}
                    />
                )}
            />
        </Menu.Menu>
    );
}

// TODO: probably improve this a bit, see todo where this is called from
function makeLinkProps(type: "Song" | "Artist" | "Album", condition: unknown, name: string, path: string) {
    if (!condition) return {};

    return {
        role: "link",
        onClick: () => MediaStore.openExternal(path),
        onContextMenu: e =>
            ContextMenuApi.openContextMenu(e, () => <CopyContextMenu type={type} name={name} path={path} />)
    } satisfies React.HTMLAttributes<HTMLElement>;
}

function Info({ track }: { track: TrackInfo; }) {
    // const img = track?.album?.image;
    const img = track?.cover ? {
        url: track.cover,
        width: 3000,
        height: 3000,
    } : undefined;

    const [coverExpanded, setCoverExpanded] = useState(false);

    const i = (
        <>
            {img && (
                <img
                    id={cl("album-image")}
                    src={img.url}
                    alt="Album Image"
                    onClick={() => setCoverExpanded(!coverExpanded)}
                    onContextMenu={e => {
                        ContextMenuApi.openContextMenu(e, () => <AlbumContextMenu track={track} />);
                    }}
                />
            )}
        </>
    );

    if (coverExpanded && img)
        return (
            <div id={cl("album-expanded-wrapper")}>
                {i}
            </div>
        );

    // TODO: for now these all have links to open locally, maybe in the future it might be good to make this work with separate urls.
    //    maybe it could even fetch data from LastFM/MusicBrainz (option?) for the users that want it (opt-in)
    return (
        <div id={cl("info-wrapper")}>
            {i}
            <div id={cl("titles")}>
                <Paragraph
                    weight="semibold"
                    id={cl("song-title")}
                    className={cl("ellipoverflow")}
                    title={track.title}
                    {...makeLinkProps("Song", track.trackid, track.title, track.url)}
                >
                    {track.title}
                </Paragraph>
                 {track.artist && (
                    <Paragraph className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>by&nbsp;</span>
                        <React.Fragment key={track.artist}>
                            <span
                                className={cl("artist")}
                                style={{ fontSize: "inherit" }}
                                title={track.artist}
                                {...makeLinkProps("Artist", track.artist, track.artist, track.url)}
                            >
                                {track.artist}
                            </span>
                        </React.Fragment>
                    </Paragraph>
                 )}
                {/* old SpotifyControls code for artists, might be worth readding if we can get artists info from playerctl metadata in the future */}
                {/* {track.artists.some(a => a.name) && (*/}
                {/*    <Paragraph className={cl(["ellipoverflow", "secondary-song-info"])}>*/}
                {/*        <span className={cl("song-info-prefix")}>by&nbsp;</span>*/}
                {/*        {track.artists.map((a, i) => (*/}
                {/*            <React.Fragment key={a.name}>*/}
                {/*                <span*/}
                {/*                    className={cl("artist")}*/}
                {/*                    style={{ fontSize: "inherit" }}*/}
                {/*                    title={a.name}*/}
                {/*                    {...makeLinkProps("Artist", a.id, a.name, `/artist/${a.id}`)}*/}
                {/*                >*/}
                {/*                    {a.name}*/}
                {/*                </span>*/}
                {/*                {i !== track.artists.length - 1 && <span className={cl("comma")}>{", "}</span>}*/}
                {/*            </React.Fragment>*/}
                {/*        ))}*/}
                {/*    </Paragraph>*/}
                {/* )}*/}
                {track.album && (
                    <Paragraph className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>on&nbsp;</span>
                        <span
                            id={cl("album-title")}
                            className={cl("album")}
                            style={{ fontSize: "inherit" }}
                            title={track.album}
                            {...makeLinkProps("Album", track.album, track.album, track.url)}
                        >
                            {track.album}
                        </span>
                    </Paragraph>
                )}
            </div>
        </div>
    );
}

// TODO: kinda globally, but I have replaced all mentions to `track.id` to `track.trackid`, but track.trackid is a bad metric
//    for local players, as it might be missing/non-constant. At least in Elisa, it just refers to the number in the current tracklist (playlist).
//    We should probably find a better unique identifier for tracks coming from playerctl metadata.
export function Player() {
    const track = useStateFromStores(
        [MediaStore],
        () => MediaStore.track,
        null,
        (prev, next) => prev?.trackid ? (prev.trackid === next?.trackid) : prev?.title === next?.title
    );

    const isPlaying = useStateFromStores([MediaStore], () => MediaStore.isPlaying);
    const [shouldHide, setShouldHide] = useState(false);

    // Hide player after 5 minutes of inactivity

    React.useEffect(() => {
        setShouldHide(false);
        if (!isPlaying) {
            const timeout = setTimeout(() => setShouldHide(true), 1000 * 60 * 5);
            return () => clearTimeout(timeout);
        }
    }, [isPlaying]);

    if (!track || shouldHide)
        return null;

    const exportTrackImageStyle = {
        "--vc-mctrls-track-image": `url(${track?.cover || ""})`,
    } as React.CSSProperties;

    return (
        <div id={cl("player")} style={exportTrackImageStyle}>
            <Info track={track} />
            <MediaSeekBar />
            <Controls />
        </div>
    );
}

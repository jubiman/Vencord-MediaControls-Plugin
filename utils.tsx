/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { PluginNative } from "@utils/types";

export const cl = classNameFactory("vc-mctrls-");

export const Native = VencordNative.pluginHelpers.MediaPlayerControls as PluginNative<typeof import("./native")>;

export function Svg(path: string, label: string) {
    return () => (
        <svg
            className={cl("button-icon", label)}
    height="24"
    width="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-label={label}
    focusable={false}
    >
    <path d={path} />
    </svg>
);
}

export function Svg2(path: string, label: string) {
    return () => (
        <svg
            className={cl("button-icon", label)}
            height="24"
            width="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label={label}
            focusable={false}
        >
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d={path} />
        </svg>
    );
}

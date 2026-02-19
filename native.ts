/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * This file handles the native media player controls for the Media Player Controls plugin.
 * It interfaces with Playerctl to control media playback on Linux systems.
 *
 * Maybe extended in the future to support other platforms and media players.
 * This is still not well tested, especially with multiple media players running.
 */
import { ChildProcess, execFile } from "child_process";
import { IpcMainInvokeEvent, shell } from "electron";
import { readFile } from "fs/promises";

import {
    LoopStatus, MediaPlayer, MediaPlayerSettings, PlaybackInfo, PlaybackStatus,
    PlayerctlMetadata,
    ShuffleArg,
    TrackInfo
} from "./types";

// Leaving this empty will result in Could not execute command: Command not recognized:
// while having --player= has the correct behavior of listening to all players
let playersArg = "--player=";
const metadataFormatArg = "title:{{xesam:title}}\nartist:{{xesam:artist}}\nalbum:{{xesam:album}}\nurl:{{xesam:url}}\nlength:{{mpris:length}}\nartUrl:{{mpris:artUrl}}\ntrackid:{{mpris:trackid}}\nplayer:{{playerName}}";

// TODO: allow custom placeholder image?
const placeholder = "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjY0IiB2aWV3Qm94PSIwIDAgNjQgNjQiIHdpZHRoPSI2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+PHJhZGlhbEdyYWRpZW50IGlkPSJhIiBjeD0iMjEuMTY2NjY4IiBjeT0iMjgwLjA2NjAxNiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHI9IjEyLjY5OTk5NiI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMzEzNDM3Ii8+PHN0b3Agb2Zmc2V0PSIuOTc5MTY2ODciIHN0b3AtY29sb3I9IiMzMTM0MzciIHN0b3Atb3BhY2l0eT0iLjQ5ODAzOSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzMxMzQzNyIgc3RvcC1vcGFjaXR5PSIwIi8+PC9yYWRpYWxHcmFkaWVudD48bGluZWFyR3JhZGllbnQgaWQ9ImIiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMjEuNjk1ODMzIiB4Mj0iMjEuNjk1ODMzIiB5MT0iMjkyLjUwMjA4NSIgeTI9IjI2Ny42MzEyNjUiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2M2Y2RkMSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2UwZTVlNyIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJjIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjI5LjYzMzMzNCIgeDI9IjI5LjYzMzMzNCIgeTE9IjI4Mi43MTI1NDQiIHkyPSIyNzguNDc5MjA0Ij48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNjY2MiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNjY2MiIHN0b3Atb3BhY2l0eT0iMCIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJkIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjQuNzYyNTAxIiB4Mj0iNC43NjI1MDEiIHkxPSIyOTIuNzY2NzIyIiB5Mj0iMjY3LjM2NjczMiI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTk3Y2YxIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMjBiY2ZhIi8+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgaWQ9ImUiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMy45Njg3NTEiIHgyPSI4LjIwMjA4MiIgeTE9IjI2OS4yMTg3MzciIHkyPSIyNzMuNDUxOTk5Ij48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyOTJjMmYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3Atb3BhY2l0eT0iMCIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJmIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjEwLjk5OTk5IiB4Mj0iMTAuOTk5OTkiIHkxPSIxNyIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzdjYmFmOCIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y0ZmNmZiIvPjwvbGluZWFyR3JhZGllbnQ+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMS45MjQxMjMgMCAwIDEuOTY4NTAzOSAuNDE4MTg1IC01MTkuMzEyMzEpIj48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMi4zODEyNTEpIj48cGF0aCBkPSJtMjEuMTY2NjY3IDI3Ni4zNjIzOGEzLjcwNDIxMjkgMy43MDQyMTI5IDAgMCAwIC0zLjcwNDIxMiAzLjcwNDI4IDMuNzA0MjEyOSAzLjcwNDIxMjkgMCAwIDAgMy43MDQyMTIgMy43MDQyOCAzLjcwNDIxMjkgMy43MDQyMTI5IDAgMCAwIDMuNzA0MjEzLTMuNzA0MjggMy43MDQyMTI5IDMuNzA0MjEyOSAwIDAgMCAtMy43MDQyMTMtMy43MDQyOHptMCAyLjcwMTAzYTEuMDAzMjIzMiAxLjAwMzIyMzIgMCAwIDEgMS4wMDMyMjggMS4wMDMyNSAxLjAwMzIyMzIgMS4wMDMyMjMyIDAgMCAxIC0xLjAwMzIyOCAxLjAwMzI1IDEuMDAzMjIzMiAxLjAwMzIyMzIgMCAwIDEgLTEuMDAzMjI3LTEuMDAzMjUgMS4wMDMyMjMyIDEuMDAzMjIzMiAwIDAgMSAxLjAwMzIyNy0xLjAwMzI1eiIgZmlsbC1vcGFjaXR5PSIuMTU2ODYzIi8+PHBhdGggZD0ibTIxLjE2NjY2NyAyNjcuMzY2NjZhMTIuNjk5OTk2IDEyLjY5OTk5NiAwIDAgMCAtMTIuNzAwMDAxMSAxMi43IDEyLjY5OTk5NiAxMi42OTk5OTYgMCAwIDAgMTIuNzAwMDAxMSAxMi43IDEyLjY5OTk5NiAxMi42OTk5OTYgMCAwIDAgMTIuNzAwMDAxLTEyLjcgMTIuNjk5OTk2IDEyLjY5OTk5NiAwIDAgMCAtMTIuNzAwMDAxLTEyLjd6bTAgOS4yNjA0MmEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIDMuNDM5NTg0IDMuNDM5NTggMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtMy40Mzk1ODQgMy40Mzk1OSAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0zLjQzOTU4My0zLjQzOTU5IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgMy40Mzk1ODMtMy40Mzk1OHoiIGZpbGw9InVybCgjYSkiLz48cGF0aCBkPSJtMjEuMTY2NjY3IDI2Ny42MzEyNWExMi40MzU0MTIgMTIuNDM1NDEyIDAgMCAwIC0xMi40MzU0MTgxIDEyLjQzNTQxIDEyLjQzNTQxMiAxMi40MzU0MTIgMCAwIDAgMTIuNDM1NDE4MSAxMi40MzU0MiAxMi40MzU0MTIgMTIuNDM1NDEyIDAgMCAwIDEyLjQzNTQxNy0xMi40MzU0MiAxMi40MzU0MTIgMTIuNDM1NDEyIDAgMCAwIC0xMi40MzU0MTctMTIuNDM1NDF6bTAgOC45OTU4M2EzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMjg5OTA0LjAxNDUgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjI4OTkwNC0uMDE0NXptLjI4OTkwNS4wMTQ1YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xNzcyNS4wMjE3IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xNzcyNS0uMDIxN3ptLS43NTcwNTkuMDIxN2EzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTY2OTE1LjAyNDggMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjE2NjkxNS0uMDI0OHptMS4xMDEyMjQuMDI0OGEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMTcyMDgzLjAzODggMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjE3MjA4My0uMDM4OHptLTEuNDQwMjIyLjAzODhhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjE1NzA5Ni4wNDAzIDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xNTcwOTYtLjA0MDN6bTEuNzY5NDAxLjA0MDNhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjE3MjA4My4wNTY4IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xNzIwODMtLjA1Njh6bS0yLjA5ODU4LjA1NjhhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjE1NjU3OS4wNTY4IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xNTY1NzktLjA1Njh6bTIuNDI3MjQyLjA1NjhhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjE1NzYxNC4wNzA4IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xNTc2MTQtLjA3MDh6bS0yLjc0MTQzNS4wNzA4YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xNTUwMjkuMDc1NCAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMTU1MDI5LS4wNzU0em0zLjA1NDA3OC4wNzU0YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xNDMxNDQuMDgxNiAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTQzMTQ0LS4wODE2em0tMy4zNTIyNTEuMDgxNmEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTUzOTk1LjA5NDYgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjE1Mzk5NS0uMDk0NnptMy42NDkzOS4wOTQ2YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xMzQ4NzYuMDk2NiAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTM0ODc2LS4wOTY2em0tMy45MzgyNjEuMDk2NmEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTM3OTc2LjEwNDM4IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xMzc5NzYtLjEwNDM4em00LjIxMTExMy4xMDQzOGEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMTMyODA4LjExNjc5IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xMzI4MDgtLjExNjc5em0tNC40ODE4OTcuMTE2NzlhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjEyMzUwNy4xMTQ3MiAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMTIzNTA3LS4xMTQ3MnptNC43MzgyMTIuMTE0NzJhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjExNDcyMi4xMjM1MSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMTE0NzIyLS4xMjM1MXptLTQuOTc2NDQxLjEyMzUxYTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4xMTY3ODguMTMyODEgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjExNjc4OC0uMTMyODF6bTUuMjA3OTUxLjEzMjgxYTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgIC4xMDQzODcuMTM3OTggMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjEwNDM4Ny0uMTM3OTh6bS01LjQyOTEyNi4xMzc5OGEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDk2NjMuMTM0ODcgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA5NjYzLS4xMzQ4N3ptNS42MzAxNDguMTM0ODdhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA5NDU3LjE1NCAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDk0NTctLjE1NHptLTUuODIxMzUxLjE1NGEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDgxNjUuMTQzMTQgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA4MTY1LS4xNDMxNHptNS45OTc1NjcuMTQzMTRhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA3NTQ1LjE1NTAzIDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4wNzU0NS0uMTU1MDN6bS02LjE1NDY2My4xNTUwM2EzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDcwOC4xNTc2MSAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMDcwOC0uMTU3NjF6bTMuMTE1MDU1LjEyNjYxYTEuMzIyOTE2NSAxLjMyMjkxNjUgMCAwIDEgMS4zMjI5MTcgMS4zMjI5MSAxLjMyMjkxNjUgMS4zMjI5MTY1IDAgMCAxIC0xLjMyMjkxNyAxLjMyMjkyIDEuMzIyOTE2NSAxLjMyMjkxNjUgMCAwIDEgLTEuMzIyOTE2LTEuMzIyOTIgMS4zMjI5MTY1IDEuMzIyOTE2NSAwIDAgMSAxLjMyMjkxNi0xLjMyMjkxem0zLjE4NTg1My4wMzFhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA1Njg0LjE1NjU4IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4wNTY4NC0uMTU2NTh6bS02LjQyODU0OS4xNTY1OGEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDU2ODQuMTcyMDkgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA1Njg0LS4xNzIwOXptNi41NDIyMzcuMTcyMDlhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjA0MDMxLjE1NzA5IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgLS4wNDAzMS0uMTU3MDl6bS02LjYzOTM4OC4xNTcwOWEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDM4NzYuMTcyMDggMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjAzODc2LS4xNzIwOHptNi43MTg0NTMuMTcyMDhhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjAyNDguMTY2OTIgMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjAyNDgtLjE2Njkyem0tNi43ODIwMTUuMTY2OTJhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAtLjAyMTcuMTc3MjUgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAgLjAyMTctLjE3NzI1em02LjgyODUyMy4xNzcyNWEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxICAuMDE0NDcuMjg5OSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwIC0uMDE0NDctLjI4OTl6bS02Ljg2NDY5Ny4yODk5YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4wMTQ0Ny4yODk5MSAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDE0NDctLjI4OTkxem02Ljg2NDY5Ny4yODk5MWEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDIxNy4xNzcyNSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMDIxNy0uMTc3MjV6bS02LjgyODUyMy4xNzcyNWEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMDI0OC4xNjY5MSAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDI0OC0uMTY2OTF6bTYuNzgyMDE1LjE2NjkxYTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4wMzg3Ni4xNzIwOSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMDM4NzYtLjE3MjA5em0tNi43MTg0NTMuMTcyMDlhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjA0MDMxLjE1NzA5IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4wNDAzMS0uMTU3MDl6bTYuNjM5Mzg4LjE1NzA5YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4wNTY4NC4xNzIwOSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMDU2ODQtLjE3MjA5em0tNi41NDIyMzcuMTcyMDlhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjA1Njg0LjE1NjU3IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4wNTY4NC0uMTU2NTd6bTYuNDI4NTQ5LjE1NjU3YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4wNzA4LjE1NzYyIDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4wNzA4LS4xNTc2MnptLTYuMzAwOTA4LjE1NzYyYTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4wNzU0NS4xNTUwMyAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDc1NDUtLjE1NTAzem02LjE1NDY2My4xNTUwM2EzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDgxNjUuMTQzMTQgMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjA4MTY1LS4xNDMxNHptLTUuOTk3NTY3LjE0MzE0YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4wOTQ1Ny4xNTQgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjA5NDU3LS4xNTR6bTUuODIxMzUxLjE1NGEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMDk2NjMuMTM0ODcgMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjA5NjYzLS4xMzQ4N3ptLTUuNjMwMTQ4LjEzNDg3YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xMDQzODcuMTM3OTggMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjEwNDM4Ny0uMTM3OTh6bTUuNDI5MTI2LjEzNzk4YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xMTY3ODguMTMyODEgMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjExNjc4OC0uMTMyODF6bS01LjIwNzk1MS4xMzI4MWEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMTE0NzIyLjEyMzUgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjExNDcyMi0uMTIzNXptNC45NzY0NDEuMTIzNWEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTIzNTA3LjExNDcyIDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xMjM1MDctLjExNDcyem0tNC43MzgyMTIuMTE0NzJhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjEzMjgwOC4xMTY3OSAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTMyODA4LS4xMTY3OXptNC40ODE4OTcuMTE2NzlhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjEzNzk3Ni4xMDQzOSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMTM3OTc2LS4xMDQzOXptLTQuMjExMTEzLjEwNDM5YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xMzQ4NzYuMDk2NiAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTM0ODc2LS4wOTY2em0zLjkzODI2MS4wOTY2YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xNTM5OTUuMDk0NiAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMTUzOTk1LS4wOTQ2em0tMy42NDkzOS4wOTQ2YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xNDMxNDQuMDgxNiAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTQzMTQ0LS4wODE2em0zLjM1MjI1MS4wODE2YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xNTUwMjkuMDc1NCAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMTU1MDI5LS4wNzU0em0tMy4wNTQwNzguMDc1NGEzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMTU3NjE0LjA3MDggMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjE1NzYxNC0uMDcwOHptMi43NDE0MzUuMDcwOGEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTU2NTc5LjA1NjggMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjE1NjU3OS0uMDU2OHptLTIuNDI3MjQyLjA1NjhhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjE3MjA4My4wNTY4IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xNzIwODMtLjA1Njh6bTIuMDk4NTguMDU2OGEzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0uMTU3MDk2LjA0MDMgMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjE1NzA5Ni0uMDQwM3ptLTEuNzY5NDAxLjA0MDNhMy40Mzk1ODMyIDMuNDM5NTgzMiAwIDAgMCAgLjE3MjA4My4wMzg4IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xNzIwODMtLjAzODh6bTEuNDQwMjIyLjAzODhhMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAtLjE2NjkxNS4wMjQ4IDMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xNjY5MTUtLjAyNDh6bS0xLjEwMTIyNC4wMjQ4YTMuNDM5NTgzMiAzLjQzOTU4MzIgMCAwIDAgIC4xNzcyNS4wMjE3IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4xNzcyNS0uMDIxN3ptLjc1NzA1OS4wMjE3YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLS4yODk5MDUuMDE0NSAzLjQzOTU4MzIgMy40Mzk1ODMyIDAgMCAwICAuMjg5OTA1LS4wMTQ1eiIgZmlsbD0idXJsKCNiKSIvPjxwYXRoIGQ9Im0yMS4xNjY2NjcgMjY4LjE2MDQxYTExLjkwNjI0NSAxMS45MDYyNDUgMCAwIDAgLTExLjkwNjI1MTQgMTEuOTA2MjUgMTEuOTA2MjQ1IDExLjkwNjI0NSAwIDAgMCAxMS45MDYyNTE0IDExLjkwNjI1IDExLjkwNjI0NSAxMS45MDYyNDUgMCAwIDAgMTEuOTA2MjUxLTExLjkwNjI1IDExLjkwNjI0NSAxMS45MDYyNDUgMCAwIDAgLTExLjkwNjI1MS0xMS45MDYyNXptMCA4LjQ2NjY3YTMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgMy40Mzk1ODQgMy40Mzk1OCAzLjQzOTU3ODEgMy40Mzk1NzgxIDAgMCAxIC0zLjQzOTU4NCAzLjQzOTU5IDMuNDM5NTc4MSAzLjQzOTU3ODEgMCAwIDEgLTMuNDM5NTgzLTMuNDM5NTkgMy40Mzk1NzgxIDMuNDM5NTc4MSAwIDAgMSAzLjQzOTU4My0zLjQzOTU4em0wIC43OTM3NWEyLjY0NTgyODIgMi42NDU4MjgyIDAgMCAwIC0yLjY0NTgzMyAyLjY0NTgzIDIuNjQ1ODI4MiAyLjY0NTgyODIgMCAwIDAgMi42NDU4MzMgMi42NDU4NCAyLjY0NTgyODIgMi42NDU4MjgyIDAgMCAwIDIuNjQ1ODM0LTIuNjQ1ODQgMi42NDU4MjgyIDIuNjQ1ODI4MiAwIDAgMCAtMi42NDU4MzQtMi42NDU4M3ptMCAxLjMyMjkyYTEuMzIyOTExNSAxLjMyMjkxMTUgMCAwIDEgMS4zMjI5MTcgMS4zMjI5MSAxLjMyMjkxMTUgMS4zMjI5MTE1IDAgMCAxIC0xLjMyMjkxNyAxLjMyMjkyIDEuMzIyOTExNSAxLjMyMjkxMTUgMCAwIDEgLTEuMzIyOTE2LTEuMzIyOTIgMS4zMjI5MTE1IDEuMzIyOTExNSAwIDAgMSAxLjMyMjkxNi0xLjMyMjkxeiIgZmlsbD0iIzMxMzQzNyIvPjxwYXRoIGQ9Im0yOC44Mzk1ODQgMjc4LjQ3OTIxdi41MjkxNiAxLjY2MDM3Yy0uMDc4MDUtLjA0NTMtLjE2NzUtLjA3MjktLjI2NDU4NC0uMDcyOS0uMjkzMTU3IDAtLjUyOTE2Ni4yMzYwMS0uNTI5MTY2LjUyOTE3cy4yMzYwMDkuNTI5MTcuNTI5MTY2LjUyOTE3LjUyOTE2Ny0uMjM2MDEuNTI5MTY3LS41MjkxN3YtMS41ODc1aDEuODUyMDgzdi42MDIwM2MtLjA3ODA1LS4wNDUzLS4xNjc1LS4wNzI5LS4yNjQ1ODMtLjA3MjktLjI5MzE1NyAwLS41MjkxNjcuMjM2MDEtLjUyOTE2Ny41MjkxNiAwIC4yOTMxNi4yMzYwMS41MjkxNy41MjkxNjcuNTI5MTdzLjUyOTE2Ny0uMjM2MDEuNTI5MTY3LS41MjkxN3YtMi4xMTY2NmgtMi4zODEyNXptLjI2NDU4My41MjkxNmgxLjg1MjA4M3YuMjY0NTloLTEuODUyMDgzeiIgZmlsbD0idXJsKCNjKSIvPjxnIGZpbGw9IiM0YzUwNTMiPjxwYXRoIGQ9Im0yNi44MjIxMzMgMjcwLjI3MTA4Yy0uNTc3OTI3LS4zMzM1NC0xLjE3NDc3My0uNTk4MDQtMS43Nzk3NTYtLjgxOTQ0bC0yLjA2MjY1NiA1LjU3NzIzYy4yOTQ0NDMuMTA3MzYuNTg0NzM3LjIzNTQ0Ljg2NTg0Ni4zOTc4Mi4yODExMDguMTYyMS41Mzc4MzIuMzQ5MjQuNzc3NDk4LjU1MDg2bDMuNzk4NjIzLTQuNTc0NzhjLS40OTQyNTgtLjQxMzE2LTEuMDIxNjI1LS43OTc4OS0xLjU5OTU1NS0xLjEzMTY5eiIvPjxwYXRoIGQ9Im0xNS41MTEyIDI4OS44NjIyNWMtLjU3NzkzLS4zMzM4LTEuMTA1MzIyLS43MTgyOC0xLjU5OTU1OS0xLjEzMTY4bDMuNzk4NjI3LTQuNTc0NzhjLjIzOTY2Ni4yMDE2NC40OTYzOS4zODg3Mi43Nzc0NzMuNTUwODUuMjgxMTA5LjE2MjI4LjU3MTQwNS4yOTExNC44NjU4NzEuMzk3ODNsLTIuMDYyNjU2IDUuNTc3MjNjLS42MDQ5ODMtLjIyMTQtMS4yMDE4NTEtLjQ4NTkxLTEuNzc5NzU2LS44MTk0NXoiLz48ZyBmaWxsLW9wYWNpdHk9Ii4xOTc3NCI+PHBhdGggZD0ibTEzLjE2ODYwNiAyODguMDY0NmMtLjQ3MTg2OS0uNDcxNzItLjg4MTY5OS0uOTc5NzktMS4yNTIxNjYtMS41MDY3OWw0Ljg1MzI3Ny0zLjQzNjA0Yy4xNzkyNS4yNTY4OC4zNzg4NjkuNTAzOTQuNjA4NDAyLjczMzQ0LjIyOTUwNy4yMjk1MS40NzY1NjIuNDI5MjIuNzMzMzY4LjYwODQxbC0zLjQzNTgzOCA0Ljg1MzI1Yy0uNTI3MDc5LS4zNzAzOS0xLjAzNTE3MS0uNzgwMy0xLjUwNzA0My0xLjI1MjI3eiIvPjxwYXRoIGQ9Im0zMC45NjIyMjMgMjc0LjQxMTEyYy0uMzMzNjY5LS41Nzc4NS0uNzE4MzczLTEuMTA1MjQtMS4xMzE1ODEtMS41OTk0bC00LjU3NDkwNSAzLjc5ODUyYy4yMDE2NDMuMjM5NzcuMzg4NjQ3LjQ5NjM3LjU1MDkyOC43Nzc1NS4xNjIzNDQuMjgxMTguMjkxMTQyLjU3MTQ1LjM5Nzg1MS44NjU4Mmw1LjU3NzE1Ni0yLjA2MjczYy0uMjIxNC0uNjA0ODgtLjQ4NTc4MS0xLjIwMTY1LS44MTk0NDktMS43Nzk3NnoiLz48cGF0aCBkPSJtMTEuMzcxMDg1IDI4NS43MjIyMWMtLjMzMzY0NC0uNTc4MTEtLjU5ODAyMy0xLjE3NDg4LS44MTk0MjQtMS43Nzk3Nmw1LjU3NzEzMS0yLjA2MjczYy4xMDY2OTMuMjk0MzcuMjM1NTcuNTg0ODkuMzk3ODc2Ljg2NTgyLjE2MjMyNi4yODExOC4zNDkyNjEuNTM3NzkuNTUwOTAzLjc3NzU1bC00LjU3NDg4IDMuNzk4NTNjLS40MTMyMzMtLjQ5NDE3LS43OTc5MzUtMS4wMjE1Ni0xLjEzMTYwNi0xLjU5OTQxeiIvPjwvZz48L2c+PHBhdGggZD0ibTgwIDUyYTEyIDEyIDAgMCAwIC0xMiAxMiAxMiAxMiAwIDAgMCAxMiAxMiAxMiAxMiAwIDAgMCAxMi0xMiAxMiAxMiAwIDAgMCAtMTItMTJ6bTAgMWExMSAxMSAwIDAgMSAxMSAxMSAxMSAxMSAwIDAgMSAtMTEgMTEgMTEgMTEgMCAwIDEgLTExLTExIDExIDExIDAgMCAxIDExLTExeiIgZmlsbC1vcGFjaXR5PSIuMDc4NDMxIiB0cmFuc2Zvcm09Im1hdHJpeCguMjY0NTgzMzQgMCAwIC4yNjQ1ODMzNCAtLjAwMDAwMSAyNjMuMTMzMzMpIi8+PC9nPjxwYXRoIGQ9Im0yLjM4MTI0ODUgMjY3LjM2NjY2djI1LjRoMjUuNDAwMDAwNXYtMTAuODQ3OTFoLTIuMzgxMjVjLTEuMDI2MDU0IDAtMS44NTIwODMtLjgyNjAzLTEuODUyMDgzLTEuODUyMDkgMC0xLjAyNjA1LjgyNjAyOS0xLjg1MjA4IDEuODUyMDgzLTEuODUyMDhoMi4zODEyNXYtMTAuODQ3OTJ6IiBmaWxsPSJ1cmwoI2QpIi8+PHBhdGggZD0ibTUuMjE0MTUwOCAyNjkuMjk2MjUtLjM3NDEzOC4zNzQxNCAyLjExNjY2NzEgMi4xMTY2Ny0uMDc3NTIuMDc3NSAyLjkxMDQxNzIgMi45MTA0MmguMTU1MDI5Ljc0ODI3NDkuMTU1MDI4di0xLjU4NzVsLTEuMzIyOTE1Mi0xLjMyMjkyLTEuMzIyOTE3LTEuMzIyOTEtLjg3MTI2NS44NzEyNi0yLjExNjY2Ny0yLjExNjY3em0tLjU2NzkyNCAxLjYyNjI2LS41NjEyMDYuNTYxMjEgMS40NTUyMDggMS40NTUyMS0uMzU4MTE3LjM1ODExIDEuNDc3OTQ1IDEuNDc3OTVoMS44MzkxNjUxeiIgZmlsbD0idXJsKCNlKSIgb3BhY2l0eT0iLjIiLz48cGF0aCBkPSJtNyAzYy0uNTU0IDAtMSAuNDQ2LTEgMXMgLjQ0NiAxIDEgMSAxLS40NDYgMS0xLS40NDYtMS0xLTF6bTcgMC0yIDIgMyAzLTMgMyAyIDIgMy0zIDItMnptLTkuNSA2Yy0uODMxIDAtMS41LjY2OS0xLjUgMS41cy42NjkgMS41IDEuNSAxLjUgMS41LS42NjkgMS41LTEuNS0uNjY5LTEuNS0xLjUtMS41em00LjUgNmMtMS4xMDggMC0yIC44OTItMiAycyAuODkyIDIgMiAyIDItLjg5MiAyLTItLjg5Mi0yLTItMnoiIGZpbGw9InVybCgjZikiIHRyYW5zZm9ybT0ibWF0cml4KC4yNjQ1ODMzNCAwIDAgLjI2NDU4MzM0IDMuMTc1MDAxIDI2OC40MjQ5OTcpIi8+PHBhdGggZD0ibTI3LjUxNjY2NiAyNjcuMzY2NjZ2MTAuNTgzMzRoLTIuMzgxMjVjLTEuMDI2MDU0IDAtMS44NTIwODMuODI2MDItMS44NTIwODMgMS44NTIwOCAwIC41ODA2My4yNjQ5ODcgMS4wOTcwMS42ODA1NzggMS40MzYwOS0uMjYwMTI3LS4zMTg4Mi0uNDE1OTk1LS43MjYwOC0uNDE1OTk1LTEuMTcxNTEgMC0xLjAyNjA1LjgyNjAyOS0xLjg1MjA4IDEuODUyMDgzLTEuODUyMDhoMi4zODEyNXYtMTAuODQ3OTJ6bTAgMTQuNTUyMDl2MTAuMzM5OTFoLTI1LjEzNTQxNzNsLS4wMDAwMDAyLjUwOGgyNS40MDAwMDA1di0xMC44NDc5MXoiIGZpbGwtb3BhY2l0eT0iLjMxMzcyNSIvPjxwYXRoIGQ9Im0yLjM4MTI0ODUgMjY3LjM2NjY2LjAwMDAwMDIuNTA4aDI1LjEzNTQxNzN2LS41MDh6bTIxLjE3MzM4NTUgMTIuODMyM2MtLjAwMzEuMDQzOS0uMDA2Ny4wODc2LS4wMDY3LjEzMjI5IDAgMS4wMjYwNS44MjYwMjkgMS44NTIwOCAxLjg1MjA4MyAxLjg1MjA4aDIuMzgxMjV2LS4yNjQ1OGgtMi4zODEyNWMtLjk4MTMxNyAwLTEuNzc3NjEzLS43NTYzLTEuODQ1MzY1LTEuNzE5Nzl6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4yMzUyOTQiLz48L2c+PC9zdmc+";

function updatePlayerArg(mediaPlayerSettings: MediaPlayerSettings) {
    const sortedPlayers = Object.entries(mediaPlayerSettings)
        .filter(([_, setting]) => setting.enabled)
        .sort(([ka, a], [kb, b]) => {
            const val = a.priority - b.priority;
            if (val === 0) {
                // if equal sort alphabetically
                return ka.localeCompare(kb);
            }
            return val;
        }).map(([key, _]) => key);
    const oldPlayersArg = playersArg;
    if (sortedPlayers.length > 0) {
        playersArg = "--player=" + sortedPlayers.join(",");
    }
    return oldPlayersArg !== playersArg;
}

async function debugLog(e: IpcMainInvokeEvent, ...args: any[]) {
    await e.sender.executeJavaScript(
        `void Vencord.Plugins.plugins.MediaPlayerControls.debugLog(${args.map(a => JSON.stringify(a)).join(", ")});`
    );
}

function runPlayerctlCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile("playerctl", [playersArg, ...args], { maxBuffer: undefined }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

function parseMetadata(metadataLines: string[]): PlayerctlMetadata {
    const metadata: Record<string, any> = {};
    for (const line of metadataLines) {
        const [key, ...rest] = line.split(":");

        if (key === "length") {
            metadata[key] = parseInt(rest.join(":"), 10) / 1000; // in milliseconds
            continue;
        }
        metadata[key] = rest.join(":");
    }

    // Try converting the player to a known player, if possible
    if (metadata.player)
        metadata.player = Object.values(MediaPlayer).find(p => p.toLowerCase() === metadata.player.toLowerCase()) || MediaPlayer.Unknown;
    return metadata as PlayerctlMetadata;
}

// Define backend API for playerctl for easier interaction
const PlayerctlInterface = {
    // Cursed ass typescript
    statusListener: undefined as ChildProcess | undefined,
    seekListener: undefined as ChildProcess | undefined,
    shuffleListener: undefined as ChildProcess | undefined,
    loopListener: undefined as ChildProcess | undefined,
    volumeListener: undefined as ChildProcess | undefined,
    metadataListener: undefined as ChildProcess | undefined,
    currentPlayer: MediaPlayer.Unknown,

    async GetMetadata(): Promise<PlayerctlMetadata> {
        const metadataStr = await runPlayerctlCommand(["metadata", "--format", metadataFormatArg]);
        return parseMetadata(metadataStr.split("\n"));
    },
    async Play(): Promise<void> {
        // if (PlayerctlInterface.currentPlayer === MediaPlayers.Strawberry)
        //     // workaround for the fact strawberry doesn't adhere to the MPRIS specification
        //     await PlayerctlInterface.PlayPause();
        // else
        await runPlayerctlCommand(["play"]);
    },
    async Pause(): Promise<void> {
        // if (PlayerctlInterface.currentPlayer === MediaPlayers.Strawberry)
        //     // workaround for the fact strawberry doesn't adhere to the MPRIS specification
        //     await PlayerctlInterface.PlayPause();
        // else
        await runPlayerctlCommand(["pause"]);
    },
    async PlayPause(): Promise<void> {
        await runPlayerctlCommand(["play-pause"]);
    },
    async Next(): Promise<void> {
        await runPlayerctlCommand(["next"]);
    },
    async Previous(): Promise<void> {
        await runPlayerctlCommand(["previous"]);
    },
    async Seek(offsetSeconds: number): Promise<void> {
        await runPlayerctlCommand(["position", `+${offsetSeconds}`]);
    },
    /**
     * Get position in milliseconds
     */
    async GetPosition(): Promise<number> {
        const positionStr = await runPlayerctlCommand(["position"]);
        const positionSeconds = parseFloat(positionStr);
        return positionSeconds * 1000;
    },
    /**
     * Set position in milliseconds
     * @param positionMilli Position in milliseconds
     */
    async SetPosition(positionMilli: number): Promise<void> {
        const positionSeconds = positionMilli / 1_000;
        await runPlayerctlCommand(["position", `${positionSeconds}`]);
    },
    /**
     * Set position delta in milliseconds
     * @param deltaMilli Delta in milliseconds
     */
    async SetPositionDelta(deltaMilli: number): Promise<void> {
        const deltaSeconds = deltaMilli / 1_000;
        const sign = deltaSeconds >= 0 ? "+" : "-";
        await runPlayerctlCommand(["position", `${deltaSeconds}${sign}`]);
    },
    /**
     * Get loop status, can be "None", "Track" or "Playlist"
     */
    async GetLoopStatus(): Promise<LoopStatus> {
        const status = await runPlayerctlCommand(["loop"]);
        return status as LoopStatus;
    },
    async SetLoopStatus(status: LoopStatus): Promise<void> {
        await runPlayerctlCommand(["loop", status]);
    },
    async GetPlaybackStatus(): Promise<PlaybackStatus> {
        const status = await runPlayerctlCommand(["status"]);
        return status as PlaybackStatus;
    },
    async GetShuffle(): Promise<boolean> {
        const shuffle = await runPlayerctlCommand(["shuffle"]);
        return shuffle === "On";
    },
    /**
     * Set shuffle mode
     * @param shuffle Can be "On", "Off" or "Toggle"
     */
    async SetShuffle(shuffle: ShuffleArg): Promise<void> {
        await runPlayerctlCommand(["shuffle", shuffle]);
    },
    /**
     * Get volume (0.0 - 1.0)
     */
    async GetVolume(): Promise<number> {
        const volumeStr = await runPlayerctlCommand(["volume"]);
        return parseFloat(volumeStr);
    },
    /**
     * Set volume (0.0 - 1.0)
     * @param volume Volume level between 0.0 and 1.0 or delta+/− (e.g. 0.1+, 0.2-)
     */
    async SetVolume(volume: string): Promise<void> {
        await runPlayerctlCommand(["volume", volume]);
    },

    /**
     * Create a PlaybackInfo object and emit it to the frontend. This is used to update the playback info in the frontend when there are changes in the playerctl listeners.
     * @param e IpcMainInvokeEvent to send the playback info back to the frontend
     * @param status Optional playback status to include in the emitted info. If not provided, it will be fetched from playerctl.
     * @param metadata Optional metadata to include in the emitted info. If not provided, it will be fetched from playerctl.
     */
    async createPlaybackInfoAndEmit(e: IpcMainInvokeEvent, { status, metadata}: {
        status?: PlaybackStatus,
        metadata?: PlayerctlMetadata
    } = {}) {
        if (!metadata) metadata = await this.GetMetadata();
        if (!status) status = await this.GetPlaybackStatus();

        // If metadata has a file:// URL, read the contents and encode it as base64
        // placeholder image data
        let cover = placeholder;
        if (metadata.artUrl && metadata.artUrl.startsWith("file://")) {
            const filePath = decodeURIComponent(metadata.artUrl.replace("file://", ""));
            try {
                const imageData = await readFile(filePath);
                const base64Data = imageData.toString("base64");
                // Guess mime type from file extension
                // TODO: is there a better way to do this?
                let mimeType = "image/png";
                if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
                    mimeType = "image/jpeg";
                } else if (filePath.endsWith(".gif")) {
                    mimeType = "image/gif";
                }
                cover = `data:${mimeType};base64,${base64Data}`;
            } catch (e) {
                console.error("Failed to read cover art file:", e);
            }
        } else if (metadata.artUrl) {
            cover = metadata.artUrl;
        }

        const trackInfo: TrackInfo = {
            title: metadata.title ?? "Unknown Title",
            artist: metadata.artist ?? "Unknown Artist",
            album: metadata.album ?? "Unknown Album",
            url: metadata.url ?? "",
            lengthMilli: metadata.length ?? 0,
            cover: cover,
            trackid: metadata.trackid ?? "",
        };

        const shuffle = await PlayerctlInterface.GetShuffle();
        const loopStatus = await PlayerctlInterface.GetLoopStatus();
        const volume = await PlayerctlInterface.GetVolume();
        const position = await PlayerctlInterface.GetPosition();

        const playbackInfo: PlaybackInfo = {
            trackInfo: trackInfo,
            shuffle: shuffle,
            loopStatus: loopStatus,
            volume: volume,
            positionMilli: position,
            playbackStatus: status as PlaybackStatus,
        };

        // Webframe hack to send to browser, which is where the plugin code runs
        // which doesn't have access to ipcMain or other native/electron modules
        // Big thanks to vending.machine for helping me figure this out (more like literally telling me how)
        // In the future there might be a better way to do this, especially since Vesktop already has an API for this.
        // https://discord.com/channels/1015060230222131221/1032770730703716362/1468684830828134555
        await e.sender.executeJavaScript(
            `void Vencord.Plugins.plugins.MediaPlayerControls.onPlaybackInfoChanged(${JSON.stringify(playbackInfo)});`
        );
    },

    SetCurrentPlayer(e: IpcMainInvokeEvent, player: MediaPlayer): void {
        PlayerctlInterface.currentPlayer = player;
        if (player === MediaPlayer.Strawberry && !this.metadataListener) {
            // Strawberry doesn't update metadata on playback status changes, so we need to listen for metadata changes as well
            this.metadataListener = execFile("playerctl", [playersArg, "--follow", "metadata", "--format", metadataFormatArg]);
            this.metadataListener.stdout?.on("data", async (data: Buffer) => {
                const metadata = parseMetadata(data.toString().split("\n"));
                // Strawberry specific: we are guaranteed to get a 2nd update with the cover art url,
                // so we ignore the first update which doesn't have it. This prevents us from having to handle the cover art twice in the frontend.
                // And also solves the issue where the frontend doesn't listen to the 2nd update...
                if (!metadata.artUrl) return;
                await this.createPlaybackInfoAndEmit(e, { metadata });
            });
        } else if (player !== MediaPlayer.Strawberry && this.metadataListener) {
            this.metadataListener.kill();
            this.metadataListener = undefined;
        }
    },

    /**
     * Starts the playerctl listener to emit events on playback changes.
     */
    async Start(e: IpcMainInvokeEvent, mediaPlayerSettings: MediaPlayerSettings): Promise<void> {
        // Check if playerctl is installed
        // spawn playerctl and if it exits with code 127, it's not installed
        const exists = await new Promise((resolve, reject) => {
            execFile("playerctl", ["--version"], (error: Error | null, _o: string, _e: string) => {
                if (error) {
                    if ((error as any).code === 127) {
                        resolve(false);
                    } else {
                        reject(error);
                    }
                    return;
                }
                resolve(true);
            });
        });

        if (!exists) {
            console.error("playerctl is not installed. Please install it to use the media player controls plugin.");
            await e.sender.executeJavaScript(
                "void Vencord.Plugins.plugins.MediaPlayerControls.onPlayerctlNotFound();"
            );
            return;
        }

        if (updatePlayerArg(mediaPlayerSettings)) {
            await debugLog(e, "Player settings changed, restarting listeners with new playerArg:", playersArg);
            return await this.Restart(e, mediaPlayerSettings);
        }
        if (this.statusListener || this.seekListener || this.shuffleListener || this.loopListener || this.volumeListener) {
            console.warn("[VencordMediaPlayerControls] Playerctl listeners already running");
            await debugLog(e, "Playerctl listeners already running, sending current playback info");

            // send the current data since it will probably have been restarted
            return await this.createPlaybackInfoAndEmit(e);
        }

        await debugLog(e, "[VencordMediaPlayerControls] Starting playerctl listeners with playerArg:", playersArg);

        // Using playerctl --follow to listen for changes in metadata and playback status
        this.statusListener = execFile("playerctl", [playersArg, "--follow", "status"]);
        // Note: if you click and drag the seek button (at least in amarok,elisa), this will flood the stdout with data.
        // After some testing it seems to handle fine, but can lag if you do it for too long.
        this.seekListener = execFile("playerctl", [playersArg, "--follow", "position"]);
        this.shuffleListener = execFile("playerctl", [playersArg, "--follow", "shuffle"]);
        this.loopListener = execFile("playerctl", [playersArg, "--follow", "loop"]);
        this.volumeListener = execFile("playerctl", [playersArg, "--follow", "volume"]);

        if (this.statusListener.stdout === null ||
            this.seekListener.stdout === null ||
            this.shuffleListener.stdout === null ||
            this.loopListener.stdout === null ||
            this.volumeListener.stdout === null) {
            throw new Error("Failed to start playerctl listeners");
        }

        // TODO: strawberry doesn't seem to change playback status on switching song, if we chose to use metadata listener:
        //    it sends updates twice: first time the artUrl is either the embedded or the file url, then it changes to /tmp/strawberry-cover-<hash>.<ext>
        //    so maybe we ignore the first update? this would allow us to completely ignore handling cover at since we are guaranteed to have a file.
        //    we could also do nothing and just update twice. Shouldn't be too big of a problem, right? RIGHT??
        this.statusListener.stdout.on("data", async (data: Buffer) => {
            const status = data.toString().trim() as PlaybackStatus;
            // TODO: add more exceptions when they arise
            if (PlayerctlInterface.currentPlayer === MediaPlayer.Strawberry) {
                const position = await PlayerctlInterface.GetPosition();
                await e.sender.executeJavaScript(
                    `void Vencord.Plugins.plugins.MediaPlayerControls.onPlaybackStatusChanged("${status}", ${position});`
                );
                return;
            }

            const metadata = await PlayerctlInterface.GetMetadata();
            await this.createPlaybackInfoAndEmit(e, { status, metadata });

            this.SetCurrentPlayer(e, metadata.player as MediaPlayer);
        });

        this.seekListener.stdout.on("data", (chunk: Buffer) => {
            const positionStr = chunk.toString().trim();
            const position = parseInt(positionStr, 10) * 1000; // convert to milliseconds
            if (isNaN(position)) return;

            // Webframe hack to send to browser
            e.sender.executeJavaScript(
                `void Vencord.Plugins.plugins.MediaPlayerControls.onPositionChanged(${position});`
            );
        });

        this.shuffleListener.stdout.on("data", (chunk: Buffer) => {
            const shuffleStr = chunk.toString().trim();
            const shuffle = shuffleStr === "true";

            // Webframe hack to send to browser
            e.sender.executeJavaScript(
                `void Vencord.Plugins.plugins.MediaPlayerControls.onShuffleChanged(${shuffle});`
            );
        });

        this.loopListener.stdout.on("data", (chunk: Buffer) => {
            const loopStatus = chunk.toString().trim() as LoopStatus;
            // fsr only this one sends an empty line when players close, which crashes the frontend...
            if (!["None", "Track", "Playlist"].includes(loopStatus)) return;

            // Webframe hack to send to browser
            e.sender.executeJavaScript(
                `void Vencord.Plugins.plugins.MediaPlayerControls.onLoopStatusChanged(${loopStatus});`
            );
        });

        this.volumeListener.stdout.on("data", (chunk: Buffer) => {
            const volumeStr = chunk.toString().trim();
            const volume = parseFloat(volumeStr) * 100;
            e.sender.executeJavaScript(
                `void Vencord.Plugins.plugins.MediaPlayerControls.onVolumeChanged(${volume});`
            );
        });

        // Failsafe
        process.on("exit", () => {
            PlayerctlInterface.Kill();
        });
    },

    Kill() {
        if (this.statusListener) {
            this.statusListener.kill();
            this.statusListener = undefined;
        }
        if (this.seekListener) {
            this.seekListener.kill();
            this.seekListener = undefined;
        }
        if (this.shuffleListener) {
            this.shuffleListener.kill();
            this.shuffleListener = undefined;
        }
        if (this.loopListener) {
            this.loopListener.kill();
            this.loopListener = undefined;
        }
        if (this.volumeListener) {
            this.volumeListener.kill();
            this.volumeListener = undefined;
        }
        if (this.metadataListener) {
            this.metadataListener.kill();
            this.metadataListener = undefined;
        }
    },

    async Restart(e: IpcMainInvokeEvent, mediaPlayerSettings: MediaPlayerSettings) {
        this.Kill();
        await this.Start(e, mediaPlayerSettings);
    }
};

export async function killPlayerctl(_: IpcMainInvokeEvent) {
    PlayerctlInterface.Kill();
}

export async function openExternal(_: IpcMainInvokeEvent, filePath: string) {
    // remove file:// if it exists and decode URI components
    shell.showItemInFolder(decodeURIComponent(filePath.replace("file://", "")));
}

export async function callPlayerctl(_: IpcMainInvokeEvent, command: string, ...args: any[]): Promise<any> {
    // Try directly calling the method on PlayerctlInterface
    const method = (PlayerctlInterface as any)[command];
    if (typeof method === "function") {
        return await method(...args);
    } else {
        console.error("Unknown command " + command);
        throw new Error(`Method ${command} not found on PlayerctlInterface`);
    }
}

export async function startPlayerctlListener(e: IpcMainInvokeEvent, mediaPlayerSettings: MediaPlayerSettings) {
    await debugLog(e, "Starting playerctl listener with settings:", mediaPlayerSettings);
    await PlayerctlInterface.Start(e, mediaPlayerSettings);
}

export async function updatePlayerctlSettings(e: IpcMainInvokeEvent, mediaPlayerSettings: MediaPlayerSettings) {
    await PlayerctlInterface.Restart(e, mediaPlayerSettings);
}

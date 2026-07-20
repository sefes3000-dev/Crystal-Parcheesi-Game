"use strict";

const APP = {
    NAME: "Crystal Parcheesi",
    VERSION: "2.0.0",
    LANGUAGE: "ar"
};

const COLORS = [
    "red",
    "green",
    "yellow",
    "blue"
];

const START_IDX = {
    red:0,
    green:13,
    yellow:26,
    blue:39
};

const SAFE_CELLS = new Set([
    0,8,13,21,26,34,39,47
]);

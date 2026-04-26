#!/usr/bin/env bash

butler push android/app/build/outputs/apk/release/app-release.apk masterpose/middle-earth-maps:android
butler status masterpose/middle-earth-maps:android

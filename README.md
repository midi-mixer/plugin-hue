# Philips Hue Plugin

Currently this is a proof-of-concept plugin to show some practical usage of [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin). It provides a basic Philips Hue integration by adding all lights and groups connected to your Philips Hue Hub to your MIDI Mixer assignments list, allowing you to:

- Control brightness/hue with a fader
- Toggle light/group on/off with a Mute button
- Toggle between controlling brightness/hue with an Assign button

## Usage

1. Follow the [Philips Hue Get Started](https://developers.meethue.com/develop/get-started-2/) guide to get the IP and user for your hub
2. [Download the plugin](https://github.com/midi-mixer/plugin-hue/archive/main.zip)
3. Extract the `plugin-hue-main` folder to `%appdata%/midi-mixer-app/plugins` (create `plugins` if it doesn't exist)
4. Enter your IP and bridge user from step 1 in the plugin's settings in-app

For more information on how this plugin was made (or to make your own) check out [midi-mixer-plugin](https://github.com/midi-mixer/midi-mixer-plugin) and the [midi-mixer/plugin-template](https://github.com/midi-mixer/plugin-template) repository.

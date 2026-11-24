# Parts List – Controller Hub

The hub must support:
- Hardwired arcade buttons/joysticks
- USB controllers
- Bluetooth controllers (maybe)

## Core

1x Arduino UNO R4 WiFi
https://www.elextra.dk/p/arduino-uno-r4-wi-fi/H52248

1x Seeed studio base shield v2
https://dk.rs-online.com/web/p/shields-til-arduino/1743233

1x USB-C data cable (hub → PC)

## Hardwired buttons

1x Arcade Buttons and Sticks with switches (2x 8-way joysticks + 14 buttons = 22 inputs)
https://www.arcadexpress.com/en/arcade-joystick-kits/414-1418-kit-joysticks-americanos-2-jugadores-16-botones-.html

3x I²C expansion modules (3x 8 = 24 inputs; set addresses to 0x20, 0x21 and 0x22 with the A0–A2 jumpers)
https://rlx.sk/en/various-boards/4719-pcf8574-io-expansion-board-waveshare-8-bit-io-expander-for-i2c-bus.html

3x Grove to female jumper cables (Seeed shield I²C port → PCF8574 board)

~50x 4.8 mm female quick-disconnect terminals (or a pre-made 4.8 mm arcade wiring harness)

1x Spool of wire + daisy-chain ground harness for the microswitches

Optional: 3x screw-terminal adapters for the PCF8574 IO headers

## USB and Bluetooth input

The UNO R4's USB port is used as the HID gamepad towards the PC and the Arduino core has no USB host support, so USB controllers go through a USB Host Shield. The UNO R4 WiFi's ESP32-S3 only supports BLE, so Bluetooth Classic controllers (PS4/PS5/Switch) go through a separate ESP32.

1x USB Host Shield 2.0 (MAX3421E) – verify USB_Host_Shield_2.0 library support for UNO R4 (Renesas) before buying

1x Small USB hub (the shield only has one USB-A port)

1x ESP32-WROOM DevKit (original ESP32, supports Bluetooth Classic + BLE) running Bluepad32, connected to the UNO over I²C/UART

1x 5V 2A power supply (USB controllers can draw up to 500 mA per port)

## Enclosure

1x Enclosure / control panel (28 mm button holes + joystick mounts)

M3 standoffs and screws for mounting the boards

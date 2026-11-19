# Parts List – Controller Hub (Simplified)

The hub shows up as 4 gamepads in the browser (Gamepad API) and takes input from arcade buttons, USB and Bluetooth controllers.

| Qty needed | Have | Part | Used for | Link |
|---|---|---|---|---|
| 1 | 1 | Arduino UNO R4 WiFi | Main controller, USB gamepads → PC | https://www.elextra.dk/p/arduino-uno-r4-wi-fi/H52248 |
| 1 | 1 | Seeed Studio Base Shield v2 | Grove I²C ports | https://dk.rs-online.com/web/p/shields-til-arduino/1743233 |
| 1 |  | Arcade kit (2 joysticks + 14 buttons) | Hardwired controls for 2 players | https://www.arcadexpress.com/en/arcade-joystick-kits/414-1418-kit-joysticks-americanos-2-jugadores-16-botones-.html |
| 3 | 2 | Waveshare PCF8574 IO expansion board | 24 inputs for the arcade kit (addresses 0x20, 0x21, 0x22) | https://rlx.sk/en/various-boards/4719-pcf8574-io-expansion-board-waveshare-8-bit-io-expander-for-i2c-bus.html |
| 3 | 3 | Grove 4-pin to female jumper conversion cable (sold in packs of 5) | Shield I²C ports → PCF8574 boards | https://www.seeedstudio.com/Grove-4-pin-Female-Jumper-to-Grove-4-pin-Conversion-Cable-5-PCs-per-PAck.html |
| 1 |  | Ultimarc daisy-chain ground harness, 4.8 mm (32 connectors) | GND to the COM tab of all 22 microswitches | https://www.pinballshop.nl/virtual-pinball/wire-wire-harnesses-cable-manage/ultimarc-daisy-chain-ground-harness/?sl=en |
| 22 |  | Signal wire with 4.8 mm female terminal on one end (~50 cm) | Microswitch NO tab → PCF8574 pin (DuPont or screw terminal on the other end) | |
| 1 |  | Adafruit USB Host FeatherWing (MAX3421E) | External wired USB controllers (SPI + IRQ to the UNO) | https://www.adafruit.com/product/5858 |
| 1 |  | 4-channel bidirectional logic level shifter (3.3 V ↔ 5 V) | UNO R4 (5 V) ↔ FeatherWing (3.3 V) SPI lines | |
| 1 |  | Small USB hub | More USB ports for the FeatherWing (it only has one) | |
| 1 |  | ESP32-WROOM DevKit | Bluetooth controllers (Bluepad32) | |
| 1 |  | 5V 2A power supply | Power for USB controllers | |
| 1 | 1 | USB-A (male) to USB-C (male) data cable | PC USB-A port → UNO R4 WiFi USB-C port (use USB-C to USB-C if the PC only has USB-C) | |

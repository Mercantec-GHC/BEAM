#include <Wire.h>
#include <HID.h>
#include "tusb.h"

const uint8_t PLAYER_COUNT = 2;   // number of gamepads the PC sees
const uint8_t BUTTONS_PER_PLAYER = 7;
const uint8_t EXPANDER_ADDRESSES[] = { 0x20, 0x21, 0x22 };
const uint8_t EXPANDER_COUNT = sizeof(EXPANDER_ADDRESSES);

static const uint8_t GAMEPAD_DESCRIPTOR_TEMPLATE[] = {
  0x05, 0x01, // Usage Page (Generic Desktop): following usages are general input devices
  0x09, 0x05, // Usage (Gamepad): tells the OS/browser this device is a gamepad
  0xA1, 0x01, // Collection (Application): start of the gamepad's definition
  0x85, 0x00, // Report ID (0 = placeholder, overwritten per player at REPORT_ID_INDEX)

  // Buttons: 8 x 1-bit fields -> GamepadReport.buttons
  0x05, 0x09, //   Usage Page (Button)
  0x19, 0x01, //   Usage Minimum (Button 1)
  0x29, 0x08, //   Usage Maximum (Button 8)
  0x15, 0x00, //   Logical Minimum (0 = released)
  0x25, 0x01, //   Logical Maximum (1 = pressed)
  0x75, 0x01, //   Report Size (1 bit per button)
  0x95, 0x08, //   Report Count (8 buttons)
  0x81, 0x02, //   Input (Data, Variable, Absolute): one independent bit per button

  // Axes: 2 x signed 8-bit fields -> GamepadReport.x and GamepadReport.y
  0x05, 0x01, //   Usage Page (Generic Desktop)
  0x09, 0x30, //   Usage (X): left/right
  0x09, 0x31, //   Usage (Y): up/down
  0x15, 0x81, //   Logical Minimum (-127)
  0x25, 0x7F, //   Logical Maximum (127)
  0x75, 0x08, //   Report Size (8 bits per axis)
  0x95, 0x02, //   Report Count (2 axes: X then Y)
  0x81, 0x02, //   Input (Data, Variable, Absolute): axis position, not relative movement

  0xC0        // End Collection
};
const uint8_t REPORT_ID_INDEX = 7;
struct DescriptorRegistration {
  DescriptorRegistration() {
    for (uint8_t p = 0; p < PLAYER_COUNT; p++) { // for each player
      uint8_t desc[sizeof(GAMEPAD_DESCRIPTOR_TEMPLATE)]; // create descriptor a byte array
      memcpy(desc, GAMEPAD_DESCRIPTOR_TEMPLATE, sizeof(desc)); // copy template to descriptor
      desc[REPORT_ID_INDEX] = p + 1;   // player 1 = report ID 1, ...
      HIDSubDescriptor node(desc, sizeof(desc)); // create HID subdescriptor node for this player
      HID().AppendDescriptor(&node); // append this player's descriptor to the HID device
    }
  }
} descriptorRegistration;
void sendChangedReports() {
  for (uint8_t p = 0; p < PLAYER_COUNT; p++) {
    if (memcmp(&currentReports[p], &sentReports[p], sizeof(GamepadReport)) == 0) continue;
    if (!tud_hid_ready()) return;
    if (tud_hid_report(p + 1, &currentReports[p], sizeof(GamepadReport))) sentReports[p] = currentReports[p];
  }
}

void setup() {
  Wire.begin();
  for (uint8_t i = 0; i < EXPANDER_COUNT; i++) {  // all pins HIGH = inputs with pull-ups
    Wire.beginTransmission(EXPANDER_ADDRESSES[i]);
    Wire.write(0xFF);
    Wire.endTransmission();
  }
}

void loop() {
  sendChangedReports();
  delay(1);
}
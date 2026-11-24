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

// static const uint8_t REPORT_DESCRIPTOR[] = { GAMEPAD_DESC(1), GAMEPAD_DESC(2) };

struct __attribute__((packed)) GamepadReport {
  uint8_t buttons;  // bit n = button n+1
  int8_t x;          // -127 left .. 127 right
  int8_t y;          // -127 up .. 127 down
};

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

#define EXP_PIN(exp, pin) (uint8_t)(((exp) << 3) | (pin)) // macro for finding the pin number in the expander

struct PlayerPins { uint8_t up, down, left, right; uint8_t buttons[BUTTONS_PER_PLAYER]; };

const PlayerPins PLAYER_PINS[PLAYER_COUNT] = {
  { EXP_PIN(0,0), EXP_PIN(0,1), EXP_PIN(0,2), EXP_PIN(0,3),
    { EXP_PIN(0,4), EXP_PIN(0,5), EXP_PIN(0,6), EXP_PIN(0,7), EXP_PIN(2,0), EXP_PIN(2,1), EXP_PIN(2,2) } },
  { EXP_PIN(1,0), EXP_PIN(1,1), EXP_PIN(1,2), EXP_PIN(1,3),
    { EXP_PIN(1,4), EXP_PIN(1,5), EXP_PIN(1,6), EXP_PIN(1,7), EXP_PIN(2,4), EXP_PIN(2,5), EXP_PIN(2,6) } },
};

uint8_t expanderStates[EXPANDER_COUNT];
GamepadReport currentReports[PLAYER_COUNT];
GamepadReport sentReports[PLAYER_COUNT];

void readExpanders() {
  for (uint8_t i = 0; i < EXPANDER_COUNT; i++) {
    expanderStates[i] = 0xFF;  // missing expander = nothing pressed
    if (Wire.requestFrom(EXPANDER_ADDRESSES[i], (size_t)1) == 1) expanderStates[i] = Wire.read();
  }
}

bool isPressed(uint8_t p) { return (expanderStates[p >> 3] & (1 << (p & 7))) == 0; }

int8_t axis(bool neg, bool pos) { return neg == pos ? 0 : (neg ? -127 : 127); }

void updateReports() {
  for (uint8_t p = 0; p < PLAYER_COUNT; p++) {
    const PlayerPins &pins = PLAYER_PINS[p];
    GamepadReport &r = currentReports[p];
    r.buttons = 0;
    for (uint8_t b = 0; b < BUTTONS_PER_PLAYER; b++)
      if (isPressed(pins.buttons[b])) r.buttons |= (1 << b);
    r.x = axis(isPressed(pins.left), isPressed(pins.right));
    r.y = axis(isPressed(pins.up), isPressed(pins.down));
  }
}

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
  readExpanders();
  updateReports();
  sendChangedReports();
  delay(1);
}
#include <Wire.h>

const int button = 2;       // connect a button
const int buzzer = 3;       // connect a buzzer

void setup() {
  Wire.begin();
  Serial.begin(9600);
  Serial.println("Scanner efter I2C-enheder...");

  pinMode(button, INPUT); //set button as an INPUT device
  pinMode(buzzer, OUTPUT);   //set LED as an OUTPUT device

}

void loop() {
  byte error, address;
  int nDevices = 0;

  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C-enhed fundet paa adresse 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      nDevices++;
    }
  }
  
  if (nDevices == 0) Serial.println("Ingen I2C-enheder fundet\n");

  int btn = digitalRead(button); //read the status of the button
  digitalWrite(buzzer, btn);
  delay(10);
}
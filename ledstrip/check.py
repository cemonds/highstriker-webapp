#!/usr/bin/python
import sys
import time

from bootstrap import *

#setup colors to loop through for fade
NUM_LEDS = 66
FIRST_EYE = 66
RED = Color(255.0,0.0,0.0)
GREEN = Color(0.0,255.0,0.0)
BLUE = Color(0.0,0.0,255.0)
WHITE = Color(255.0,255.0,255.0)
OFF = Color(0.0,0.0,0.0)

for l in range(NUM_LEDS):
    led.set(l, GREEN)
led.update()
time.sleep(3)

for l in range(NUM_LEDS):
    led.set(l, OFF)
led.update()
time.sleep(3)

for l in range(NUM_LEDS):
    led.set(l, GREEN)
led.update()
time.sleep(3)

for l in range(NUM_LEDS):
    led.set(l, OFF)
led.update()
time.sleep(3)

for l in range(NUM_LEDS):
    led.set(l, GREEN)
led.update()
time.sleep(3)

for l in range(NUM_LEDS):
    led.set(l, OFF)
led.update()

#!/usr/bin/python
import sys
import time
import random

from bootstrap import *

#setup colors to loop through for fade
NUM_LEDS = 70
FIRST_EYE = 66
RED = Color(255.0,0.0,0.0)
GREEN = Color(0.0,255.0,0.0)
BLUE = Color(0.0,0.0,255.0)
WHITE = Color(255.0,255.0,255.0)
OFF = Color(0.0,0.0,0.0)

NUM_ANIMATIONS = 3

animation = random.randint(1, NUM_ANIMATIONS)

if animation == 1:
    for l in range(FIRST_EYE):
        led.set(l, RED)
        led.update()
    time.sleep(3)

    for l in range(FIRST_EYE):
        led.set(l, OFF)
        led.update()

else if animation == 2:
    for l in range(FIRST_EYE):
        led.set(l, GREEN)
        led.update()
    time.sleep(3)

    for l in range(FIRST_EYE):
        led.set(l, OFF)
        led.update()

else if animation == 3:
    for l in range(FIRST_EYE):
        led.set(l, BLUE)
        led.update()
    time.sleep(3)

    for l in range(FIRST_EYE):
        led.set(l, OFF)
        led.update()



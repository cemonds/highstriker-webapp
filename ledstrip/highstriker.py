#!/usr/bin/python
import sys

from bootstrap import *

#setup colors to loop through for fade
NUM_LEDS = 160
STEPS = 1000
STEP_SIZE = 0.15
RED = Color(255.0,0.0,0.0)
OFF = Color(0.0,0.0,0.0)
initial_velocity = min(55,int(sys.argv[1]))
acceleration = 10
velocity = initial_velocity
height = 0

for step in range(STEPS):
	for l in range(NUM_LEDS):
		if l < height:
			led.set(l, RED)
		else:
			led.set(l, OFF)
	led.update()
	if height < 0: 
		break
	height += velocity * STEP_SIZE
	velocity -= acceleration * STEP_SIZE




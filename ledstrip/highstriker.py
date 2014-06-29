#!/usr/bin/python
import sys

from bootstrap import *

#setup colors to loop through for fade
NUM_LEDS = 70
FIRST_EYE = 70
STEPS = 1000
STEP_SIZE = 0.075
RED = Color(255.0,0.0,0.0)
GREEN = Color(0.0,255.0,0.0)
BLUE = Color(0.0,0.0,255.0)
WHITE = Color(255.0,255.0,255.0)
OFF = Color(0.0,0.0,0.0)
initial_velocity = min(55,int(sys.argv[1]))-10
acceleration = 7
velocity = initial_velocity
height = 0

for step in range(STEPS):
	for l in range(NUM_LEDS):
		if l < height:
		   if l >= FIRST_EYE:
				   led.set(l, WHITE)
		   else:
				   led.set(l, RED)
		else:
			led.set(l, OFF)
	led.update()
	if height < 0: 
		break
	height += velocity * STEP_SIZE
	velocity -= acceleration * STEP_SIZE




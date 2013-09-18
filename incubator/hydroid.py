import cgi
import sys
import math
import time
import json
import requests
import RPi.GPIO as GPIO


# port constants
PO_SOLENOID = 18
PI_BUTTON = 24
PO_BLINKER = 25

# MCP3008 ports
PI_DIN = 23
PO_CLK = 4
PO_DOUT = 17
PO_CS = 22

# MCP3008 analog channels (8 channels available between 0 and 7)
AC_TEMPERATURE = 0
AC_MOISTURE = 7

# port setup
GPIO.setmode(GPIO.BCM)   # not GPIO.BOARD which is sequential numbering system

GPIO.setup(PI_BUTTON, GPIO.IN)
GPIO.setup(PO_SOLENOID, GPIO.OUT)
GPIO.setup(PO_BLINKER, GPIO.OUT)

GPIO.setup(PI_DIN, GPIO.IN)
GPIO.setup(PO_CLK, GPIO.OUT)
GPIO.setup(PO_DOUT, GPIO.OUT)
GPIO.setup(PO_CS, GPIO.OUT)

# other constants
SATURATION = 777.0	# Grove moisture sensor registers about 777 count in water
#API_URL = 'http://waterthem.appspot.com/app/jsonApi'
API_URL = 'http://192.168.2.110:8080/app/jsonApi'

# internal button control
lastButtonValue = False
buttonOnToggles = 0	# number of button press event

# solenoid control
MAX_SQUIRTS = 5
squirtQueue = 0		# number of squirts pending
solenoidHigh = False

# web requests
listenToWeb = False
ticketNo = 0



def getMilliSinceEphoc():
	return int(time.time() * 1000)


def cleanup():
	print "cleaning up and exiting..."
	GPIO.output(PO_SOLENOID, GPIO.LOW)
	GPIO.output(PO_BLINKER, GPIO.LOW)


def fireJsonApi(command, parameters):
	headers = {'content-type': 'application/json'}

	payload = {'command': command}
	payload.update(parameters)

	response = requests.post(API_URL, data=json.dumps(payload), headers=headers)

	# check for communication error
	if response.status_code != requests.codes.ok:
		print('error: %d' % response.status_code)
		print(response.text)
		return None

	# check for api error
	if 'apierror' in response.json:
		print(response.text)
		return None

	# return the valid api response
	#print(response.json)
	return response

# read SPI data from MCP3008 chip, 8 possible adc's (0 thru 7)
def readadc(adcnum):
	if ((adcnum > 7) or (adcnum < 0)):
		return -1

	GPIO.output(PO_CS, True)
	GPIO.output(PO_CLK, False) # start clock low
	GPIO.output(PO_CS, False) # bring CS low

	commandout = adcnum
	commandout |= 0x18 # start bit + single-ended bit
	commandout <<= 3 # we only need to send 5 bits here

	for i in range(5):
		if (commandout & 0x80):
			GPIO.output(PO_DOUT, True)
		else:
			GPIO.output(PO_DOUT, False)
		commandout <<= 1
		GPIO.output(PO_CLK, True)
		GPIO.output(PO_CLK, False)

	adcout = 0
	# read in one empty bit, one null bit and 10 ADC bits
	for i in range(12):
		GPIO.output(PO_CLK, True)
		GPIO.output(PO_CLK, False)
		adcout <<= 1
		if (GPIO.input(PI_DIN)):
			adcout |= 0x1

	GPIO.output(PO_CS, True)

	adcout /= 2 # first bit is 'null' so drop it
	return adcout

def readMoisturePercent():
	count = readadc(AC_MOISTURE)
	return min(100, count/SATURATION * 100)


def queueSquirt(ticket, drops):
	global squirtQueue, ticketNo

	if squirtQueue <= 0: 	# only if not squirting already - do not floot it
		squirtQueue = min(math.fabs(drops), MAX_SQUIRTS)
		ticketNo = ticket
		print "squirt qeued for ticket %d with %d drops" % (ticketNo, squirtQueue)


def onSquirtDelivered(ticketNo):
	# send a quick confirm
	fireJsonApi('confirmSquirtDelivery', {
		'ticket': ticketNo,
		'deliveryDate': getMilliSinceEphoc(),
		'deliveryNote': 'OK'})
	print "squirt delivery confirmation sent for ticket %d" % ticketNo

	# send a slow photo confirm
	response = fireJsonApi('procureUploadURL', {})
	if response:
		fileName = 'test.jpg'
		uploadURL = response.json['url']
		print 'uplaod URL: %s' % uploadURL
		r = requests.post(uploadURL, files={'file': open(fileName, 'rb')}, headers={'ticket':str(ticketNo)})
		print 'image file %s uploaded' % fileName


def onQuarterTime(quarter, second, loop):
	global lastButtonValue, buttonOnToggles, squirtQueue, solenoidHigh, ticketNo
	#print "on quater %d, %d, %d" % (quarter, second, loop)

	# process blinker
	if quarter == 0:
		GPIO.output(PO_BLINKER, GPIO.HIGH)
	elif quarter == 3:
		GPIO.output(PO_BLINKER, GPIO.LOW)

	# process button
	buttonValue = GPIO.input(PI_BUTTON)
	if buttonValue != lastButtonValue:
		lastButtonValue = buttonValue 
		if (buttonValue == True):
			buttonOnToggles = buttonOnToggles + 1
			print "Button pressed " + str(buttonOnToggles)
			queueSquirt(0, 1)

	# service squirting
	if squirtQueue > 0:
		if quarter == 1 and not solenoidHigh:
			print "====== solenoid (ticket:%d, drop:%d) ===========> Open" % (ticketNo, squirtQueue)
			GPIO.output(PO_SOLENOID, GPIO.HIGH)
			solenoidHigh = True
		elif quarter == 3 and solenoidHigh:
			print "====== solenoid (ticket:%d, drop:%d) ===========> Close" % (ticketNo, squirtQueue)
			GPIO.output(PO_SOLENOID, GPIO.LOW)
			solenoidHigh = False
			squirtQueue -= 1

			# respond to the web request and give the delivery confirmation
			if squirtQueue == 0 and ticketNo > 0:
				onSquirtDelivered(ticketNo)
				ticketNo = 0


def onSecondTime(second, loop):
	#print "on second %d, %d" % (second, loop)
	pass


def onLoopTime(loop):
	#print "on loop %d" % (loop)
	print "moisture: %d %%" % readMoisturePercent()

	# check if any web request pending
	if listenToWeb:
		try:
			response = fireJsonApi('fetchPendingRequest', {})
			if response and response.json['drops'] > 0:
				ticket = response.json['ticket']
				drops = response.json['drops']
				print "web request received for ticket %d with %d drops" % (ticket, drops)
				queueSquirt(ticket, drops)
		except:
			pass	# can't access the server? keep on trying forever - it may work again


def doTimedLoop(loopDurationInSeconds=5):
	quarterCounter = 0	# quarter of a second quantity
	targetQuarterTime = startTime = getMilliSinceEphoc()
	while True:
		# set the target quarter time
		targetQuarterTime = getMilliSinceEphoc() + 250	# 250 milliseconds from now

		# resolution counters
		quarter = quarterCounter % 4
		second = (quarterCounter / 4) % loopDurationInSeconds
		loop = quarterCounter / (4 * loopDurationInSeconds)

		# do some work
		onQuarterTime(quarter, second, loop)
		if quarterCounter % 4 == 3:
			onSecondTime(second, loop)
		if quarterCounter % (4 * loopDurationInSeconds) == (4 * loopDurationInSeconds) - 1:
			onLoopTime(loop)

		# eat up the remainder of the quarter time if any
		totalTimeDelta = getMilliSinceEphoc() - (startTime + quarterCounter * 250)  # overall time adjustment
		#print "at quater %d, %d, %d, (%d, %d)" % (quarter, second, loop, quarterCounter, totalTimeDelta)
		remainingQuarterTime = targetQuarterTime - getMilliSinceEphoc() - totalTimeDelta
		if remainingQuarterTime > 5:	# too small of quantity may not hold well
			#print "sleeping %d" % remainingQuarterTime
			time.sleep(remainingQuarterTime/1000.0)

		# next quarter
		quarterCounter += 1

		# set some limit if it is polling the web
		if listenToWeb and quarterCounter > 24 * 60 * 60 * 4:
		#if listenToWeb and quarterCounter > 20 * 4:
			break


#
#main
#
webProcessInterval = 5

if (len(sys.argv) > 1):
	webProcessInterval = int(sys.argv[1])

if webProcessInterval > 0:
	# validate the minimum web process interval
	webProcessInterval = max(3, webProcessInterval)
	listenToWeb = True

# report the listening mode
if listenToWeb:
	print "listening to web requests for every %d seconds" %  webProcessInterval
else:
	print "not listening to web requests, only internal requests are listened to"

# enter the application loop
doTimedLoop(webProcessInterval if webProcessInterval > 0 else 5)
cleanup()


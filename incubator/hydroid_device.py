import datetime
import RPi.GPIO as GPIO
from SimpleCV import Display, Camera, VideoStream, Image, DrawingLayer, Color
from time import sleep


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

# internal button control
rpiButtonPressCallback
lastButtonValue = False

# solenoid control
squirtQueue = 0        # number of squirts pending
solenoidHigh = False

# camera
camera = None
display = None
IMAGE_WIDTH = 320
IMAGE_HEIGHT = 240


def setup(buttonPressCallback):
    setupGPIOPorts()
    setupCamera()

    global rpiButtonPressCallback
    rpiButtonPressCallback = buttonPressCallback


def cleanup():
    print "cleaning up GPIO ports..."
    GPIO.output(PO_SOLENOID, GPIO.LOW)
    GPIO.output(PO_BLINKER, GPIO.LOW)


def setupGPIOPorts():
    GPIO.setmode(GPIO.BCM)   # not GPIO.BOARD which is sequential numbering system

    GPIO.setup(PI_BUTTON, GPIO.IN)
    GPIO.setup(PO_SOLENOID, GPIO.OUT)
    GPIO.setup(PO_BLINKER, GPIO.OUT)

    GPIO.setup(PI_DIN, GPIO.IN)
    GPIO.setup(PO_CLK, GPIO.OUT)
    GPIO.setup(PO_DOUT, GPIO.OUT)
    GPIO.setup(PO_CS, GPIO.OUT)


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

    adcout /= 2  # first bit is 'null' so drop it
    return adcout


def setupCamera():
    global camera, display
    width = IMAGE_WIDTH
    height = IMAGE_HEIGHT
    camera = Camera(prop_set={'width':width, 'height':height})
    display = Display(resolution=(320, 240))


def isCameraReady():
    return camera is not None


def takeSnapshot(fileName):
    if not camera:
        return

    frame = camera.getImage()
    if display:
        frame.save(display)
    frame.save(fileName)


def addText(fileName, text):
    image = Image(fileName)
    draw = DrawingLayer((IMAGE_WIDTH, IMAGE_HEIGHT))
    draw.rectangle((8, 8), (121, 18), filled=True, color=Color.YELLOW)
    draw.setFontSize(20)
    draw.text(text, (10, 9), color=Color.BLUE)
    image.addDrawingLayer(draw)
    image.save(fileName)


def takePhoto(ticket, runid):
    fileName = 'hydroid-%d-%d.jpg' % (ticket, runid)
    takeSnapshot(fileName)

    timeText = datetime.datetime.now().strftime("%H:%M:%S %m/%d/%Y")
    addText(fileName, timeText)
    return fileName


def onRpiSystemTick(job, isLast):
    global lastButtonValue, squirtQueue, solenoidHigh, ticketNo

    tick = job.runid % 4
    #print "------ rpi tick: %d" % tick

    # process blinker
    if tick == 0:
        GPIO.output(PO_BLINKER, GPIO.HIGH)
    elif tick == 3:
        GPIO.output(PO_BLINKER, GPIO.LOW)

    # process button
    buttonValue = GPIO.input(PI_BUTTON)
    if buttonValue != lastButtonValue:
        lastButtonValue = buttonValue 
        if (buttonValue == True):
            print "Button pressed"
            rpiButtonPressCallback()

    # service squirting
    if squirtQueue > 0:
        if tick == 1 and not solenoidHigh:
            print "====== solenoid (ticket:%d, drop:%d) ===========> Open" % (ticketNo, squirtQueue)
            GPIO.output(PO_SOLENOID, GPIO.HIGH)
            solenoidHigh = True
        if tick == 2 and job.photo and job.runid == 1 and camera:   # take photo in the midstream
            job.imageFileName = takePhoto(job.id, job.runid)
        elif tick == 3 and solenoidHigh:
            print "====== solenoid (ticket:%d, drop:%d) ===========> Close" % (ticketNo, squirtQueue)
            GPIO.output(PO_SOLENOID, GPIO.LOW)
            solenoidHigh = False
            squirtQueue -= 1

            # squirting done
            if squirtQueue == 0 and ticketNo > 0:
                ticketNo = 0


def readTemperature():
    return readadc(AC_TEMPERATURE)


def readMoisture():
    return readadc(AC_MOISTURE)


def testADC():
    setupGPIOPorts()

    while True:
        tcount = readadc(AC_TEMPERATURE)
        millivolts = tcount * (3300. / 1023.)
        tempc = ((millivolts - 100.) / 10.) - 40.
        tempf = (tempc * 9./5.) + 32

        mcount = readadc(AC_MOISTURE)
        moistp = min(100, mcount / 777. * 100)

        print "temp: %dF, count: %d, mosit: %d%%, count: %d" % (tempf, tcount, moistp, mcount)
        sleep(1)

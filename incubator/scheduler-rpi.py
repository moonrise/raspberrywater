import cgi
import sys
import math
import time
import json
import requests
import RPi.GPIO as GPIO
from SimpleCV import Display, Camera, VideoStream
from time import sleep


API_URL = 'http://waterthem.appspot.com/app/jsonApi'
API_URL = 'http://localhost:8080/app/jsonApi'
API_URL = 'http://192.168.2.110:8080/app/jsonApi'

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

# other constants - this should be dropped and moved to the client app (JavaScript)
SATURATION = 777.0    # Grove moisture sensor registers about 777 count in water

# internal button control
lastButtonValue = False

# solenoid control
MAX_SQUIRTS = 5
squirtQueue = 0        # number of squirts pending
solenoidHigh = False

# web requests
listenToWeb = False
ticketNo = 0

# camera
camera = None
display = None

cronQueue = {}
cronActive = {}
cronFinished = {}


def setupGPIOPorts():
    GPIO.setmode(GPIO.BCM)   # not GPIO.BOARD which is sequential numbering system

    GPIO.setup(PI_BUTTON, GPIO.IN)
    GPIO.setup(PO_SOLENOID, GPIO.OUT)
    GPIO.setup(PO_BLINKER, GPIO.OUT)

    GPIO.setup(PI_DIN, GPIO.IN)
    GPIO.setup(PO_CLK, GPIO.OUT)
    GPIO.setup(PO_DOUT, GPIO.OUT)
    GPIO.setup(PO_CS, GPIO.OUT)


def cleanup():
    print "cleaning up and exiting..."
    GPIO.output(PO_SOLENOID, GPIO.LOW)
    GPIO.output(PO_BLINKER, GPIO.LOW)


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


def queueSquirt(ticket, drops):
    global squirtQueue, ticketNo

    if squirtQueue <= 0:     # only if not squirting already - do not floot it
        squirtQueue = min(math.fabs(drops), MAX_SQUIRTS)
        ticketNo = ticket
        print "squirt qeued for ticket %d with %d drops" % (ticketNo, squirtQueue)


def setupCamera():
    global camera, display
    width = 320
    height = 240
    camera = Camera(prop_set={'width':width, 'height':height})
    display = Display(resolution=(320, 240))


def takeSnapshot(fileName):
    if not camera:
        return

    frame = camera.getImage()
    if display:
        frame.save(display)
    frame.save(fileName)
    #sleep(2)


def getMilliSinceEpoch():
    return int(time.time() * 1000)


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
    if response.text.find('apiError') >= 0:
        print(response.text)
        return None

    # return the valid api response in json format
    #print(response.text)
    #return response.json    # works in Rpi ?!!
    return json.loads(response.text)    # works in elsewhere


def pollServer():
    try:
        response = fireJsonApi('fetchPendingRequest', {})
        if response and response['requestDate'] > 0:
            handleServerJob(response)
    except:
        pass    # can't access the server? keep on trying forever - it may work again


def getIntervalMilliForUnit(unit):
    if unit == 'm':
        return 60*1000
    elif unit == 'h':
        return 60*60*1000
    elif unit == 'd':
        return 24*60*60*1000
    return 1000     # assume 's' (second)


def handleServerJob(job):
    ticket = job['ticket']

    if ticket in cronQueue or ticket in cronActive or ticket in cronFinished:
        print "==0==> job %d is being worked on already" % ticket
        return      # already aware of it

    drops = job['drops']
    photo = job['photo'] != '0'
    envread = job['envread'] != '0'

    runs = job['runs']
    start = job['start']

    if runs == 1 and start < 0:   # once immediately
        job['interval'] = 0
        queueJob(OneShotJob(ticket, onUserTask, drops, photo, envread))
    else:
        startTime = job['start']
        if startTime < 0:
            startTime = getMilliSinceEpoch()    # use now as the start time
        interval = job['interval'] * getIntervalMilliForUnit(job['intervalUnit'])
        endTime = startTime + interval * (runs - 1) + interval * 0.9    # not too much lag
        queueJob(Job(ticket, runs, interval, startTime, endTime, onUserTask, drops, photo, envread))


class Job:
    # parameters:
    # - id (int): job id (ticket id)
    # - interval (int) > 0 or 0 for one shot
    # - startTime (int) > 0
    # - endTime (int) > startTime or 0 for forever
    # - callback (fn): mandatory function ref with the signature (eventSequence, isLast, job)
    # - drops (int): squirt count
    # - photo (bool): take photo
    # - envread (bool): read environment vars like temperature and moisture
    def __init__(self, id, runs, interval, startTime, endTime, callback, drops, photo, envread):
        self.id = id
        self.runs = runs
        self.interval = interval
        self.startTime = startTime
        self.endTime = endTime
        self.callback = callback
        self.drops = drops
        self.photo = photo
        self.envread = envread

        # work variables
        self.lastEventTime = startTime - interval
        self.lastEventIndex = -1        # index may skip if falling behind
        self.runid = -1                 # runid does not skip

        # task ack
        self.temperature = -1
        self.moisture = -1
        self.squirts = -1                # delivered against the requested self.drops
        self.imageFileName = None


    def dump(self):
        print "id: %d, interval: %d, start: %d, end: %d" % (self.id, self.interval, self.startTime, self.endTime)

    # returns false if it needs to be deactivated (i.e. no more callbacks!)
    def onTimerTick(self, currentTime):
        if self.interval == 0:  # one shot job
            self.runid = 1
            self.callback(self, True)
            return False

        # multiple shots
        if self.id > 0 and self.runid < 0:
            self.runid = 0
            onQuickAck(self)         # so that the pending request is removed in the remote

        currentTimeIndex = (currentTime - self.startTime) / self.interval
        if currentTime < self.startTime + currentTimeIndex * self.interval - self.interval * 0.05:
            return True

        if self.lastEventIndex >= currentTimeIndex:
            return True

        # fire now
        self.lastEventIndex = currentTimeIndex
        self.runid += 1
        delta = currentTime - (self.startTime + self.lastEventIndex * self.interval)
        isLast = self.runid >= self.runs or (self.endTime > 0) and (currentTime + self.interval > self.endTime)
        self.callback(self, isLast)
        # if self.id > 0:
        #     print "=== callback ===> ticket: %d, index: %d, runid: %d, delta: %d, isLast:%d" %\
        #          (self.id, self.lastEventIndex, self.runid, delta, isLast)
        return not isLast


class SystemJob(Job):
    def __init__(self, id, interval, callback):
        Job.__init__(self, id, sys.maxint, interval, getMilliSinceEpoch(), 0, callback, 0, 0, 0)


class OneShotJob(Job):
    def __init__(self, id, callback, drops, photo, envread):
        Job.__init__(self, id, 1, 0, 0, 0, callback, drops, photo, envread)


def queueJob(job):
    cronQueue[job.id] = job


def addJob(job):
    cronActive[job.id] = job


def removeJob(job):
    cronFinished[job.id] = job
    del cronActive[job.id]


def doTimedLoop(resolution=100):
    startTime = getMilliSinceEpoch()
    while True:
        currentTime = getMilliSinceEpoch()

        # add queued jobs - queuing needed to avoid collection change while iterating
        for q in cronQueue.itervalues():
            addJob(q)
        cronQueue.clear()

        # do some work
        finishedItems = []
        for v in cronActive.itervalues():
            if not v.onTimerTick(currentTime):
                finishedItems.append(v)

        # handle the finished items if any
        for f in finishedItems:
            removeJob(f)

        # sleep away for the remaining time if any
        tick = (currentTime - startTime) / resolution
        spareTime = startTime + (tick + 1) * resolution - currentTime
        #print "tick: %d, spare: %d" % (tick, spareTime)
        if (spareTime > 5):
            time.sleep(spareTime / 1000.0)

        # for debug
        # if tick > 5000:
        #     break


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
            queueSquirt(0, 1)

    # service squirting
    if squirtQueue > 0:
        if tick == 1 and not solenoidHigh:
            print "====== solenoid (ticket:%d, drop:%d) ===========> Open" % (ticketNo, squirtQueue)
            GPIO.output(PO_SOLENOID, GPIO.HIGH)
            solenoidHigh = True
        elif tick == 3 and solenoidHigh:
            print "====== solenoid (ticket:%d, drop:%d) ===========> Close" % (ticketNo, squirtQueue)
            GPIO.output(PO_SOLENOID, GPIO.LOW)
            solenoidHigh = False
            squirtQueue -= 1

            # squirting done
            if squirtQueue == 0 and ticketNo > 0:
                ticketNo = 0


def onServerPoll(job, isLast):
    pollServer()


def onUserTask(job, isLast):
    print "== task ==> ticket:%d, runid:%d, isLast:%d, drops:%d, photo:%s, envread:%s" %\
          (job.id, job.runid, isLast, job.drops, job.photo, job.envread)

    if job.envread:
        job.temperature = readadc(AC_TEMPERATURE)
        job.moisture = readadc(AC_MOISTURE)

    if job.drops > 0:
        queueSquirt(job.id, job.drops)
        job.squirts = job.drops     # no way of confirming the drops, so echo back for now

    if job.photo and camera:
        job.imageFileName = 'hydroid-%d-%d.jpg' % (job.id, job.runid)
        takeSnapshot(job.imageFileName)

    onDelivered(job, isLast)


def onQuickAck(job):
    # send a quick ack to inform a job is queued
    fireJsonApi('confirmDelivery', {
        'ticket': job.id,
        'runs': job.runs,
        'runid': job.runid,
        'finished': '0',
        'deliveryDate': getMilliSinceEpoch(),
        'deliveryNote': 'waiting'})
    print "delivery ask sent for ticket %d" % job.id


def onDelivered(job, isLast):
    # completion ack
    fireJsonApi('confirmDelivery', {
        'ticket': job.id,
        'runs': job.runs,
        'runid': job.runid,
        'finished': '1' if isLast else '0',
        'temperature': job.temperature,
        'moisture': job.moisture,
        'deliveryDate': getMilliSinceEpoch(),
        'deliveryNote': 'finished' if isLast else 'running'})
    print "delivery confirmation sent for ticket %d" % job.id

    # upload the image file after the ack
    if job.photo:
        response = fireJsonApi('procureUploadURL', {})
        if not response:
            return

        uploadURL = response['url']
        r = requests.post(uploadURL, files={'file': open(job.imageFileName, 'rb')},
                          headers={'ticket': str(job.id), 'runid': str(job.runid), 'runs': str(job.runs)})
        print 'image file %s uploaded with URL %s' % (job.imageFileName, uploadURL)


def testADC():
    while True:
        tcount = readadc(AC_TEMPERATURE)
        millivolts = tcount * (3300. / 1023.)
        tempc = ((millivolts - 100.) / 10.) - 40.
        tempf = (tempc * 9./5.) + 32

        mcount = readadc(AC_MOISTURE)
        moistp = min(100, mcount / 777. * 100)

        print "temp: %dF, count: %d, mosit: %d%%, count: %d" % (tempf, tcount, moistp, mcount)
        sleep(1)


#
# main
#

webProcessInterval = 5

if (len(sys.argv) > 1 and sys.argv[1] == 'adc'):
    print "testing adc..."
    setupGPIOPorts()
    testADC()
    exit

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

# hardware setup
setupGPIOPorts()
setupCamera()

# system scheduler setup
addJob(SystemJob(-1, 250, onRpiSystemTick))
if listenToWeb:
    addJob(SystemJob(-2, webProcessInterval*1000, onServerPoll))

# enter the app loop
doTimedLoop()
cleanup();

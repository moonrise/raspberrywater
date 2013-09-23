import time
import json
import requests

API_URL = 'http://192.168.2.110:8080/app/jsonApi'

cronQueue = {}
cronActive = {}
cronFinished = {}


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

    if ticket in cronQueue or ticket in cronActive or ticket in cronFinished != None:
        print "==0==> job %d is being worked on already" % ticket
        return      # already aware of it

    drops = job['drops']
    photo = job['photo'] != '0'
    envread = job['envread'] != '0'

    runs = job['runs']
    start = job['start']


    if runs == 1 and start < 0:   # once immediately
        queueJob(OneShotJob(ticket, onUserTask, drops, photo, envread))
    else:
        startTime = job['start']
        interval = job['interval'] * getIntervalMilliForUnit(job['interval'])
        if runs == 1:
            endTime = startTime + interval * 0.9
        else:
            endTime = startTime + interval * runs + interval * 0.1
        queueJob(Job(ticket, interval, startTime, endTime, onUserTask, drops, photo, envread))


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
    def __init__(self, id, interval, startTime, endTime, callback, drops, photo, envread):
        self.id = id
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
        self.lastEventSequence = -1     # sequence does not skip

    def dump(self):
        print "id: %d, interval: %d, start: %d, end: %d" % (self.id, self.interval, self.startTime, self.endTime)

    # returns false if it needs to be deactivated (i.e. no more callbacks!)
    def onTimerTick(self, currentTime):
        if self.interval == 0:  # one shot job
            self.callback(0, True, self)
            return

        # multiple shots
        currentTimeIndex = (currentTime - self.startTime) / self.interval
        if currentTime < self.startTime + currentTimeIndex * self.interval - self.interval * 0.05:
            return True

        if self.lastEventIndex >= currentTimeIndex:
            return True

        # fire now
        self.lastEventIndex = currentTimeIndex
        self.lastEventSequence += 1
        delta = currentTime - (self.startTime + self.lastEventIndex * self.interval)
        isLast = (self.endTime > 0) and (currentTime + self.interval > self.endTime)
        self.callback(self.lastEventSequence, isLast, self)
        #print "=== event fire ===> sid: %d, index: %d, seq: %d, delta: %d, isLast:%d" %\
        #      (self.id, self.lastEventIndex, self.lastEventSequence, delta, isLast)
        return not isLast


class SystemJob(Job):
    def __init__(self, id, interval, callback):
        Job.__init__(self, id, interval, getMilliSinceEpoch(), 0, callback, 0, 0, 0)


class OneShotJob(Job):
    def __init__(self, id, callback, drops, photo, envread):
        Job.__init__(self, id, 0, 0, 0, callback, drops, photo, envread)


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
        if tick > 5000:
            break


def onRpiSystemTick(tick, isLast, job):
    #print "rpi tick: %d" % tick
    pass


def onServerPoll(tick, isLast, job):
    pollServer()


def onUserTask(tick, isLast, job):
    print "== task ==> ticket:%d, tick:%d, isLast:%d, drops:%d, photo:%s, envread:%s" %\
          (job.id, tick, isLast, job.drops, job.photo, job.envread)
    onSquirtDelivered(job)
    pass


def onSquirtDelivered(job):
    # send a quick confirm
    fireJsonApi('confirmSquirtDelivery', {
        'ticket': job.id,
        'deliveryDate': getMilliSinceEpoch(),
        'deliveryNote': 'OK'})
    print "delivery confirmation sent for ticket %d" % job.id

    # send a slow photo confirm
    if job.photo:
        response = fireJsonApi('procureUploadURL', {})
        if response:
            fileName = 'test.jpg'
            uploadURL = response['url']
            print 'uplaod URL: %s' % uploadURL
            r = requests.post(uploadURL, files={'file': open(fileName, 'rb')}, headers={'ticket': str(job.id)})
            print 'image file %s uploaded' % fileName

#
# main
#

# permanent system jobs
# addJob(SystemJob(-1, 250, onRpiSystemTick))
addJob(SystemJob(-2, 5000, onServerPoll))

# enter the app loop
doTimedLoop()

import math
import time

cronQueue = {}
cronActive = {}
cronFinished = {}

def getMilliSinceEpoch():
    return int(time.time() * 1000)

class Schedule:
    # assumes interval > 0, startTime > 0, endTime > startTime or 0 (forever)
    def __init__(self, id, interval, startTime, endTime, callback):
        self.id = id
        self.interval = interval
        self.startTime = startTime
        self.endTime = endTime
        self.callback = callback

        # work variables
        self.lastEventTime = startTime - interval
        self.lastEventIndex = -1        # index may skip if falling behind
        self.lastEventSequence = -1     # sequence does not skip

    def dump(self):
        print "id: %d, interval: %d, start: %d, end: %d" % (self.id, self.interval, self.startTime, self.endTime)

    # returns false if it needs to be deactivated (i.e. no more callbacks!)
    def onTimerTick(self, currentTime):
        currentTimeIndex = (currentTime - self.startTime) / self.interval

        # we have served this period already; give small margin of starting earlier so that we don't fall behind
        if currentTimeIndex == self.lastEventIndex and (currentTime - self.lastEventTime) < self.interval*0.99:
            return True

        # now we fire since we are in a new event index, but ensure events are not spaced
        # too closely if we're falling behind. The fraction of the interval should be close
        # to 1 so that we catch up eventually.
        if currentTime > self.lastEventTime + self.interval * 0.85:
            self.lastEventIndex = currentTimeIndex
            self.lastEventSequence += 1
            lag = currentTime - (self.startTime + self.lastEventIndex * self.interval)
            elapsed = currentTime - self.lastEventTime
            print "=== event fire ===> index: %d, seq: %d, lag: %d, duration: %d" %\
                  (self.lastEventIndex, self.lastEventSequence, lag, elapsed)
            self.lastEventTime = currentTime
            #self.callback(self.lastEventSequence)   # fire the event

def doTimedLoop(s, resolution=100):
    timeCounter = 0
    while True:
        # mark the target time
        timeCounter += 1
        currentTime = getMilliSinceEpoch()
        targetTime = currentTime + resolution

        # do some work
        s.onTimerTick(currentTime)

        # sleep away for the remaining time if any
        spareTime = targetTime - getMilliSinceEpoch()
        print "time: %d, spare: %d" % (timeCounter, spareTime)
        if (spareTime > 5):
            time.sleep(spareTime/1000.0)

        # for debug
        if timeCounter > 1000:
            break

s0 = Schedule(101, 100, getMilliSinceEpoch(), 0, None)
s0.dump()
doTimedLoop(s0)


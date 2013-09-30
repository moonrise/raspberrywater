#
# nil device module for hook up in IDE where no physical devices are available
#

photos = 0


def setup(buttonPressCallback):
    pass


def cleanup():
    pass


def setupCamera():
    pass


def isCameraReady():
    return True


def readTemperature():
    return 199


def readMoisture():
    return 299


def onRpiSystemTick(job, isLast):
    pass


def takePhoto(ticket, runid):
    global photos
    photos += 1
    return "test-photo1.jpg" if photos % 2 == 1 else "test-photo2.jpg"


def queueSquirt(ticket, drops):
    pass


def testADC():
    pass

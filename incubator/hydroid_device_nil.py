#
# nil device module for hook up in IDE where no physical devices are available
#


def setup(buttonPressCallback):
    pass


def cleanup():
    pass


def setupCamera():
    pass


def isCameraReady():
    return False


def readTemperature():
    return 199


def readMoisture():
    return 299


def onRpiSystemTick(job, isLast):
    pass


def takePhoto(ticket, runid):
    pass


def queueSquirt(ticket, drops):
    pass


def testADC():
    pass

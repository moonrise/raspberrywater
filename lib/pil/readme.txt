Python Imaging Library (PIL)

PIL library was thought to be needed for get_serving_url() to work on a local development server
(see https://developers.google.com/appengine/docs/python/images/).

For that reason, PIL 1.1.7 for windows 32 bit version for Python 2.7 was installed.
Initially the installer did not work because Python 2.7 installed was 64 bit.
Apparently, 64bit Python is useless and more trouble with 32 bit libraries like PIL.
where PIL installer could not continue because no installed Python was found (64 bit is ignored).
Before this fact was recognized, Windows registration was manually done using pilregister.py
downloaded from the web, and this did not help 32/64 bit issue.
What ended up was to install 32bit version of Python, then PIL was installed.

All that work did not pay off because get_serving_url() ended up working in local server
without PIL explicitly added in app.yaml as so:

- name: PIL
  version: latest

Now this entry has been remvoed.
Not sure if the runtime still uses PIL, but it seemed PIL is not needed after all?
With so much work went into it, and just in case if it is required, this stuff should be
saved for later.

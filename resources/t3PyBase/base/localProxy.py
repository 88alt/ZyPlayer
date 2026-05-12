# -*- coding: utf-8 -*-
# File  : localProxy.py

class Proxy:
    @staticmethod
    def getUrl(local):
        return f'http://127.0.0.1:{Proxy.getPort()}/proxy'

    @staticmethod
    def getPort():
        return 9978

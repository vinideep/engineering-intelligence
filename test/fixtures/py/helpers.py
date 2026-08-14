"""Helper functions and a small cache class for the fixture."""


def compute_total(items):
    total = 0
    for item in items:
        total = total + item
    return total


def normalize(value):
    return value.strip().lower()


class Cache:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def put(self, key, value):
        normalized = normalize(key)
        self.store[normalized] = value
